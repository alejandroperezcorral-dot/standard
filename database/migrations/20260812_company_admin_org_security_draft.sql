-- DRAFT ONLY - DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL.
-- Purpose:
--   Prepare the Organization Administration + Invitations security migration.
--   Enforce server-side company isolation, Company Admin own-company authority,
--   one-company-per-user, and atomic invitation acceptance.
--
-- Assumptions from live audit on 2026-08-12:
--   - Organization tables are in public.
--   - RLS is enabled on organization tables.
--   - Platform Admin is identified by hello@athletestandards.com and/or
--     profiles.role = 'admin' / profiles.access_role = 'Platform Admin'.
--   - Canonical active membership status is 'Active'.
--   - Organization roles Company Admin may assign are:
--       'Company Member', 'Company Admin'
--   - Company Admin must never assign 'Platform Admin'.
--   - company_memberships_one_company_per_user already exists on user_id.
--
-- Review order:
--   1. Review helpers.
--   2. Review RLS policy replacements.
--   3. Review accept_company_invitation RPC.
--   4. Run security characterization tests on a branch/staging DB.

begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    coalesce(auth.jwt() ->> 'email', '') = 'hello@athletestandards.com'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.access_role = 'Platform Admin'
          or p.email = 'hello@athletestandards.com'
        )
    );
$$;

create or replace function private.current_is_company_admin_for(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    private.current_is_platform_admin()
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
        and cm.membership_status = 'Active'
        and cm.access_role = 'Company Admin'
    );
$$;

create or replace function private.org_role_is_allowed(role_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(role_text, 'Company Member') in ('Company Member', 'Company Admin');
$$;

create or replace function private.membership_status_is_allowed(status_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(status_text, 'Active') in ('Active', 'Inactive', 'Removed', 'Pending approval');
$$;

revoke all on function private.current_is_platform_admin() from public;
revoke all on function private.current_is_company_admin_for(uuid) from public;
revoke all on function private.org_role_is_allowed(text) from public;
revoke all on function private.membership_status_is_allowed(text) from public;
grant execute on function private.current_is_platform_admin() to authenticated;
grant execute on function private.current_is_company_admin_for(uuid) to authenticated;
grant execute on function private.org_role_is_allowed(text) to authenticated;
grant execute on function private.membership_status_is_allowed(text) to authenticated;

-- Normalize invitation schema for atomic acceptance.
alter table public.company_invitations
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists intended_group_ids uuid[] not null default '{}'::uuid[];

create index if not exists company_invitations_email_status_idx
  on public.company_invitations (lower(email), status);

create index if not exists company_invitations_pending_token_idx
  on public.company_invitations (token)
  where status = 'Pending' and token is not null;

-- One user = one company is already enforced by this unique index in production.
-- Keep it explicit and idempotent for review/staging parity.
create unique index if not exists company_memberships_one_company_per_user
  on public.company_memberships (user_id);

-- RLS: company_memberships
drop policy if exists memberships_admin_or_self_read on public.company_memberships;
drop policy if exists memberships_admin_write on public.company_memberships;
drop policy if exists company_memberships_company_admin_select on public.company_memberships;
drop policy if exists company_memberships_company_admin_insert on public.company_memberships;
drop policy if exists company_memberships_company_admin_update on public.company_memberships;
drop policy if exists company_memberships_company_admin_delete on public.company_memberships;

create policy company_memberships_company_admin_select
on public.company_memberships
for select
to authenticated
using (
  private.current_is_platform_admin()
  or user_id = auth.uid()
  or private.current_is_company_admin_for(company_id)
);

create policy company_memberships_company_admin_insert
on public.company_memberships
for insert
to authenticated
with check (
  private.current_is_platform_admin()
  or (
    private.current_is_company_admin_for(company_id)
    and private.org_role_is_allowed(access_role)
    and private.membership_status_is_allowed(membership_status)
  )
);

create policy company_memberships_company_admin_update
on public.company_memberships
for update
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
)
with check (
  private.current_is_platform_admin()
  or (
    private.current_is_company_admin_for(company_id)
    and private.org_role_is_allowed(access_role)
    and private.membership_status_is_allowed(membership_status)
  )
);

create policy company_memberships_company_admin_delete
on public.company_memberships
for delete
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
);

-- RLS: profiles
-- Company Admin may read own-company member profiles, but direct profile mutation
-- remains self/platform-admin only. Organization role changes should happen in
-- company_memberships or controlled RPCs, not broad profile writes.
drop policy if exists profiles_company_admin_read on public.profiles;
drop policy if exists profiles_company_admin_update on public.profiles;
drop policy if exists profiles_self on public.profiles;
drop policy if exists profiles_self_or_platform_admin_all on public.profiles;
drop policy if exists profiles_company_admin_member_read on public.profiles;

create policy profiles_self_or_platform_admin_all
on public.profiles
for all
to authenticated
using (
  id = auth.uid()
  or private.current_is_platform_admin()
)
with check (
  id = auth.uid()
  or private.current_is_platform_admin()
);

create policy profiles_company_admin_member_read
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or private.current_is_platform_admin()
  or exists (
    select 1
    from public.company_memberships target_cm
    where target_cm.user_id = profiles.id
      and private.current_is_company_admin_for(target_cm.company_id)
  )
);

-- RLS: company_group_memberships
drop policy if exists company_group_memberships_admin_write on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_read_write on public.company_group_memberships;
drop policy if exists company_group_memberships_self_read on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_select on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_insert on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_update on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_delete on public.company_group_memberships;

create policy company_group_memberships_company_admin_select
on public.company_group_memberships
for select
to authenticated
using (
  private.current_is_platform_admin()
  or user_id = auth.uid()
  or private.current_is_company_admin_for(company_id)
);

create policy company_group_memberships_company_admin_insert
on public.company_group_memberships
for insert
to authenticated
with check (
  private.current_is_platform_admin()
  or (
    private.current_is_company_admin_for(company_id)
    and exists (
      select 1
      from public.company_groups g
      where g.id = company_group_memberships.company_group_id
        and g.company_id = company_group_memberships.company_id
    )
    and exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = company_group_memberships.user_id
        and cm.company_id = company_group_memberships.company_id
        and cm.membership_status = 'Active'
    )
  )
);

create policy company_group_memberships_company_admin_update
on public.company_group_memberships
for update
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
)
with check (
  private.current_is_platform_admin()
  or (
    private.current_is_company_admin_for(company_id)
    and exists (
      select 1
      from public.company_groups g
      where g.id = company_group_memberships.company_group_id
        and g.company_id = company_group_memberships.company_id
    )
    and exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = company_group_memberships.user_id
        and cm.company_id = company_group_memberships.company_id
        and cm.membership_status = 'Active'
    )
  )
);

create policy company_group_memberships_company_admin_delete
on public.company_group_memberships
for delete
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
);

-- RLS: company_invitations
drop policy if exists company_invitations_company_admin_all on public.company_invitations;
drop policy if exists company_invitations_invitee_update on public.company_invitations;
drop policy if exists invitations_admin_write on public.company_invitations;
drop policy if exists company_invitations_company_admin_select on public.company_invitations;
drop policy if exists company_invitations_company_admin_insert on public.company_invitations;
drop policy if exists company_invitations_company_admin_update on public.company_invitations;
drop policy if exists company_invitations_company_admin_delete on public.company_invitations;

create policy company_invitations_company_admin_select
on public.company_invitations
for select
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
  or (
    status = 'Pending'
    and token is not null
    and (expires_at is null or expires_at > now())
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy company_invitations_company_admin_insert
on public.company_invitations
for insert
to authenticated
with check (
  private.current_is_platform_admin()
  or (
    private.current_is_company_admin_for(company_id)
    and private.org_role_is_allowed(intended_access_role)
    and coalesce(status, 'Pending') = 'Pending'
  )
);

create policy company_invitations_company_admin_update
on public.company_invitations
for update
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
)
with check (
  private.current_is_platform_admin()
  or (
    private.current_is_company_admin_for(company_id)
    and private.org_role_is_allowed(intended_access_role)
  )
);

create policy company_invitations_company_admin_delete
on public.company_invitations
for delete
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
);

-- Public token read is intentionally kept for the logged-out invite preview.
-- It only exposes pending, unexpired invite rows by token and does not grant writes.

create or replace function public.accept_company_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv public.company_invitations%rowtype;
  v_company public.companies%rowtype;
  v_existing public.company_memberships%rowtype;
  v_role text;
  v_profile_role text;
  v_group_name text;
  v_group_id uuid;
  v_group_ids uuid[] := '{}'::uuid[];
  v_result text := 'accepted';
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Authentication required';
  end if;

  if invitation_token is null or length(trim(invitation_token)) < 20 then
    raise exception 'Invalid invitation token';
  end if;

  select *
  into v_inv
  from public.company_invitations
  where token = invitation_token
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if lower(v_inv.email) <> v_email then
    raise exception 'Invitation email does not match authenticated user';
  end if;

  if v_inv.status = 'Accepted' and v_inv.accepted_by = v_user_id then
    return jsonb_build_object(
      'status', 'already_accepted',
      'company_id', v_inv.company_id,
      'invitation_id', v_inv.id
    );
  end if;

  if v_inv.status <> 'Pending' then
    raise exception 'Invitation is not pending';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at <= now() then
    raise exception 'Invitation has expired';
  end if;

  select *
  into v_company
  from public.companies
  where id = v_inv.company_id;

  if not found then
    raise exception 'Invitation company not found';
  end if;

  v_role := coalesce(nullif(v_inv.intended_access_role, ''), 'Company Member');
  if not private.org_role_is_allowed(v_role) then
    raise exception 'Invitation role is not allowed';
  end if;

  select *
  into v_existing
  from public.company_memberships
  where user_id = v_user_id
  for update;

  if found and v_existing.company_id <> v_company.id then
    raise exception 'User already belongs to a different company';
  end if;

  if v_company.type = 'Supplier' then
    v_profile_role := 'supplier';
  else
    v_profile_role := 'user';
  end if;

  update public.profiles
  set
    email = coalesce(email, v_email),
    approved = true,
    role = case when role = 'admin' or access_role = 'Platform Admin' then role else v_profile_role end,
    company_name = v_company.name,
    active_company_name = v_company.name,
    supplier_company = case when v_company.type = 'Supplier' then v_company.name else null end,
    company_type = v_company.type,
    access_role = case when access_role = 'Platform Admin' then access_role else v_role end,
    first_name = coalesce(nullif(first_name, ''), v_inv.first_name),
    last_name = coalesce(nullif(last_name, ''), v_inv.last_name),
    job_position = coalesce(nullif(v_inv.intended_job_position, ''), job_position),
    department = coalesce(nullif(v_inv.intended_department, ''), department),
    company_group = coalesce(nullif(v_inv.invite_group, ''), company_group)
  where id = v_user_id;

  if not found then
    insert into public.profiles (
      id, email, role, approved, company_name, active_company_name,
      supplier_company, company_type, access_role, first_name, last_name,
      job_position, department, company_group
    ) values (
      v_user_id, v_email, v_profile_role, true, v_company.name, v_company.name,
      case when v_company.type = 'Supplier' then v_company.name else null end,
      v_company.type, v_role, v_inv.first_name, v_inv.last_name,
      v_inv.intended_job_position, v_inv.intended_department, v_inv.invite_group
    );
  end if;

  insert into public.company_memberships (
    user_id, company_id, access_role, job_position, department,
    membership_status, invited_by, approved_by, joined_at, updated_at
  ) values (
    v_user_id, v_company.id, v_role, v_inv.intended_job_position,
    v_inv.intended_department, 'Active', v_inv.invited_by, v_inv.invited_by,
    now(), now()
  )
  on conflict (user_id) do update
  set
    company_id = excluded.company_id,
    access_role = excluded.access_role,
    job_position = excluded.job_position,
    department = excluded.department,
    membership_status = 'Active',
    invited_by = excluded.invited_by,
    approved_by = excluded.approved_by,
    joined_at = coalesce(public.company_memberships.joined_at, now()),
    updated_at = now();

  if array_length(v_inv.intended_group_ids, 1) is not null then
    v_group_ids := v_inv.intended_group_ids;
  elsif nullif(trim(coalesce(v_inv.invite_group, '')), '') is not null then
    foreach v_group_name in array regexp_split_to_array(v_inv.invite_group, '\s*,\s*') loop
      select id into v_group_id
      from public.company_groups
      where company_id = v_company.id
        and lower(name) = lower(v_group_name)
      limit 1;
      if v_group_id is not null then
        v_group_ids := array_append(v_group_ids, v_group_id);
      end if;
    end loop;
  end if;

  if exists (
    select 1
    from unnest(v_group_ids) as gid
    left join public.company_groups g on g.id = gid and g.company_id = v_company.id
    where g.id is null
  ) then
    raise exception 'Invitation contains a group outside the invitation company';
  end if;

  insert into public.company_group_memberships (company_id, company_group_id, user_id)
  select distinct v_company.id, gid, v_user_id
  from unnest(v_group_ids) as gid
  where gid is not null
  on conflict (company_group_id, user_id) do nothing;

  update public.company_invitations
  set status = 'Accepted',
      accepted_at = now(),
      accepted_by = v_user_id
  where id = v_inv.id;

  update public.approval_requests
  set status = 'Resolved by invitation',
      reviewed_by = v_inv.invited_by,
      reviewed_at = now()
  where user_id = v_user_id
    and status in ('Pending platform approval', 'Pending');

  insert into public.audit_logs (
    action, actor_user_id, target_user_id, company_id,
    entity_type, entity_id, new_value, reason
  ) values (
    'company_invitation.accepted',
    v_user_id,
    v_user_id,
    v_company.id,
    'company_invitations',
    v_inv.id::text,
    jsonb_build_object('role', v_role, 'groups', v_group_ids),
    'Valid invitation accepted by matching authenticated user'
  );

  return jsonb_build_object(
    'status', v_result,
    'company_id', v_company.id,
    'company_name', v_company.name,
    'company_type', v_company.type,
    'access_role', v_role,
    'group_ids', v_group_ids,
    'invitation_id', v_inv.id
  );
end;
$$;

revoke all on function public.accept_company_invitation(text) from public;
revoke all on function public.accept_company_invitation(text) from anon;
grant execute on function public.accept_company_invitation(text) to authenticated;

comment on function public.accept_company_invitation(text) is
  'Atomically accepts a valid company invitation for the authenticated matching user. DRAFT migration prepared 2026-08-12.';

commit;
