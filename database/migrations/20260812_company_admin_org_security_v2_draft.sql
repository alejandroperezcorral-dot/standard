-- DRAFT ONLY - DO NOT EXECUTE.
-- SECURITY DESIGN CORRECTION ONLY.
--
-- Purpose:
--   Harden STDTEX organization security before staging validation.
--   This v2 draft fixes the v1 STOP findings:
--     1. No broad profile self-update.
--     2. Platform Admin cannot accept normal company invitations.
--     3. Company Admin cannot generically update invitation rows.
--     4. Sensitive membership/invitation mutations move to controlled RPCs.
--
-- Important:
--   This file is a review draft. It has not been executed in staging or production.
--   Application code must later be aligned to call the RPCs before this migration
--   can be safely promoted.

begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function private.normalize_org_role(role_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(role_text, ''))) in ('company admin', 'admin company') then 'Company Admin'
    when lower(btrim(coalesce(role_text, ''))) in ('company member', 'member', 'user', '') then 'Company Member'
    else null
  end;
$$;

create or replace function private.org_role_is_allowed(role_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.normalize_org_role(role_text) in ('Company Member', 'Company Admin');
$$;

create or replace function private.membership_status_is_allowed(status_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(status_text, 'Active') in ('Active', 'Inactive', 'Removed', 'Pending approval');
$$;

create or replace function private.current_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'hello@athletestandards.com'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.access_role = 'Platform Admin'
          or lower(coalesce(p.email, '')) = 'hello@athletestandards.com'
        )
    );
$$;

create or replace function private.is_platform_admin_user(target_user_id uuid, target_email text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    lower(coalesce(target_email, '')) = 'hello@athletestandards.com'
    or exists (
      select 1
      from public.profiles p
      where p.id = target_user_id
        and (
          p.role = 'admin'
          or p.access_role = 'Platform Admin'
          or lower(coalesce(p.email, '')) = 'hello@athletestandards.com'
        )
    );
$$;

create or replace function private.current_company_admin_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cm.company_id
  from public.company_memberships cm
  where cm.user_id = auth.uid()
    and cm.membership_status = 'Active'
    and cm.access_role = 'Company Admin'
  order by cm.created_at asc
  limit 1;
$$;

create or replace function private.current_is_company_admin_for(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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

revoke all on function private.normalize_org_role(text) from public, anon;
revoke all on function private.org_role_is_allowed(text) from public, anon;
revoke all on function private.membership_status_is_allowed(text) from public, anon;
revoke all on function private.current_is_platform_admin() from public, anon;
revoke all on function private.is_platform_admin_user(uuid, text) from public, anon;
revoke all on function private.current_company_admin_company_id() from public, anon;
revoke all on function private.current_is_company_admin_for(uuid) from public, anon;

grant execute on function private.normalize_org_role(text) to authenticated;
grant execute on function private.org_role_is_allowed(text) to authenticated;
grant execute on function private.membership_status_is_allowed(text) to authenticated;
grant execute on function private.current_is_platform_admin() to authenticated;
grant execute on function private.current_is_company_admin_for(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Schema additions required for controlled invitations
-- ---------------------------------------------------------------------------

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

create unique index if not exists company_memberships_one_company_per_user
  on public.company_memberships (user_id);

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
-- No direct self UPDATE policy exists in v2.
-- Users can read their own profile and insert a minimal first profile row.
-- Self-editable profile changes must use public.update_own_profile(...).
-- Organization/security fields are system-managed by RPCs or Platform Admin.

alter table public.profiles enable row level security;

drop policy if exists profiles_self on public.profiles;
drop policy if exists profiles_company_admin_read on public.profiles;
drop policy if exists profiles_company_admin_update on public.profiles;
drop policy if exists profiles_self_or_platform_admin_all on public.profiles;
drop policy if exists profiles_company_admin_member_read on public.profiles;
drop policy if exists profiles_self_select_v2 on public.profiles;
drop policy if exists profiles_self_insert_minimal_v2 on public.profiles;
drop policy if exists profiles_platform_admin_all_v2 on public.profiles;
drop policy if exists profiles_company_admin_member_read_v2 on public.profiles;

create policy profiles_self_select_v2
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_self_insert_minimal_v2
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and coalesce(role, 'user') = 'user'
  and coalesce(access_role, 'Company Member') = 'Company Member'
  and coalesce(approved, false) = false
  and nullif(coalesce(company_name, ''), '') is null
  and nullif(coalesce(active_company_name, ''), '') is null
  and nullif(coalesce(supplier_company, ''), '') is null
  and nullif(coalesce(company_type, ''), '') is null
);

create policy profiles_platform_admin_all_v2
on public.profiles
for all
to authenticated
using (private.current_is_platform_admin())
with check (private.current_is_platform_admin());

create policy profiles_company_admin_member_read_v2
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships target_cm
    where target_cm.user_id = profiles.id
      and target_cm.membership_status = 'Active'
      and private.current_is_company_admin_for(target_cm.company_id)
  )
);

-- ---------------------------------------------------------------------------
-- RLS: company_memberships
-- ---------------------------------------------------------------------------
-- Company Admins can read own-company memberships.
-- Company Admin writes happen through update_company_member/remove_company_member.
-- Platform Admin keeps direct global table authority.

alter table public.company_memberships enable row level security;

drop policy if exists memberships_admin_or_self_read on public.company_memberships;
drop policy if exists memberships_admin_write on public.company_memberships;
drop policy if exists company_memberships_admin_read_write on public.company_memberships;
drop policy if exists company_memberships_company_admin_read_write on public.company_memberships;
drop policy if exists company_memberships_company_admin_select on public.company_memberships;
drop policy if exists company_memberships_company_admin_insert on public.company_memberships;
drop policy if exists company_memberships_company_admin_update on public.company_memberships;
drop policy if exists company_memberships_company_admin_delete on public.company_memberships;
drop policy if exists company_memberships_select_v2 on public.company_memberships;
drop policy if exists company_memberships_platform_admin_insert_v2 on public.company_memberships;
drop policy if exists company_memberships_platform_admin_update_v2 on public.company_memberships;
drop policy if exists company_memberships_platform_admin_delete_v2 on public.company_memberships;

create policy company_memberships_select_v2
on public.company_memberships
for select
to authenticated
using (
  private.current_is_platform_admin()
  or user_id = auth.uid()
  or private.current_is_company_admin_for(company_id)
);

create policy company_memberships_platform_admin_insert_v2
on public.company_memberships
for insert
to authenticated
with check (private.current_is_platform_admin());

create policy company_memberships_platform_admin_update_v2
on public.company_memberships
for update
to authenticated
using (private.current_is_platform_admin())
with check (private.current_is_platform_admin());

create policy company_memberships_platform_admin_delete_v2
on public.company_memberships
for delete
to authenticated
using (private.current_is_platform_admin());

-- ---------------------------------------------------------------------------
-- RLS: company_group_memberships
-- ---------------------------------------------------------------------------
-- Company Admins can read own-company group membership.
-- Company Admin writes happen through controlled RPCs.

alter table public.company_group_memberships enable row level security;

drop policy if exists company_group_memberships_admin_write on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_read_write on public.company_group_memberships;
drop policy if exists company_group_memberships_self_read on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_select on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_insert on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_update on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_delete on public.company_group_memberships;
drop policy if exists company_group_memberships_select_v2 on public.company_group_memberships;
drop policy if exists company_group_memberships_platform_admin_insert_v2 on public.company_group_memberships;
drop policy if exists company_group_memberships_platform_admin_update_v2 on public.company_group_memberships;
drop policy if exists company_group_memberships_platform_admin_delete_v2 on public.company_group_memberships;

create policy company_group_memberships_select_v2
on public.company_group_memberships
for select
to authenticated
using (
  private.current_is_platform_admin()
  or user_id = auth.uid()
  or private.current_is_company_admin_for(company_id)
);

create policy company_group_memberships_platform_admin_insert_v2
on public.company_group_memberships
for insert
to authenticated
with check (private.current_is_platform_admin());

create policy company_group_memberships_platform_admin_update_v2
on public.company_group_memberships
for update
to authenticated
using (private.current_is_platform_admin())
with check (private.current_is_platform_admin());

create policy company_group_memberships_platform_admin_delete_v2
on public.company_group_memberships
for delete
to authenticated
using (private.current_is_platform_admin());

-- ---------------------------------------------------------------------------
-- RLS: company_invitations
-- ---------------------------------------------------------------------------
-- Direct Company Admin INSERT/UPDATE/DELETE is removed.
-- Company Admin invitation mutations happen only through RPCs.

alter table public.company_invitations enable row level security;

drop policy if exists company_invitations_company_admin_all on public.company_invitations;
drop policy if exists company_invitations_invitee_update on public.company_invitations;
drop policy if exists invitations_admin_write on public.company_invitations;
drop policy if exists company_invitations_company_admin_select on public.company_invitations;
drop policy if exists company_invitations_company_admin_insert on public.company_invitations;
drop policy if exists company_invitations_company_admin_update on public.company_invitations;
drop policy if exists company_invitations_company_admin_delete on public.company_invitations;
drop policy if exists company_invitations_select_v2 on public.company_invitations;
drop policy if exists company_invitations_platform_admin_insert_v2 on public.company_invitations;
drop policy if exists company_invitations_platform_admin_update_v2 on public.company_invitations;
drop policy if exists company_invitations_platform_admin_delete_v2 on public.company_invitations;

create policy company_invitations_select_v2
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

create policy company_invitations_platform_admin_insert_v2
on public.company_invitations
for insert
to authenticated
with check (private.current_is_platform_admin());

create policy company_invitations_platform_admin_update_v2
on public.company_invitations
for update
to authenticated
using (private.current_is_platform_admin())
with check (private.current_is_platform_admin());

create policy company_invitations_platform_admin_delete_v2
on public.company_invitations
for delete
to authenticated
using (private.current_is_platform_admin());

-- Existing company_invitations_public_token_read is intentionally not dropped.
-- It supports logged-out invitation previews and must remain read-only.

-- ---------------------------------------------------------------------------
-- RPC: personal profile self-service
-- ---------------------------------------------------------------------------

create or replace function public.update_own_profile(
  p_first_name text default null,
  p_last_name text default null,
  p_phone text default null,
  p_job_position text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (
    id, email, role, approved, access_role,
    first_name, last_name, phone, job_position
  ) values (
    v_user_id, v_email, 'user', false, 'Company Member',
    nullif(btrim(coalesce(p_first_name, '')), ''),
    nullif(btrim(coalesce(p_last_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_job_position, '')), '')
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    first_name = coalesce(nullif(btrim(coalesce(p_first_name, '')), ''), public.profiles.first_name),
    last_name = coalesce(nullif(btrim(coalesce(p_last_name, '')), ''), public.profiles.last_name),
    phone = coalesce(nullif(btrim(coalesce(p_phone, '')), ''), public.profiles.phone),
    job_position = coalesce(nullif(btrim(coalesce(p_job_position, '')), ''), public.profiles.job_position);

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  return v_profile;
end;
$$;

create or replace function public.touch_own_profile_seen()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_seen_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set last_seen_at = v_seen_at
  where id = v_user_id;

  return v_seen_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: invitation command model
-- ---------------------------------------------------------------------------

create or replace function public.create_company_invitation(
  p_email text,
  p_access_role text default 'Company Member',
  p_first_name text default null,
  p_last_name text default null,
  p_job_position text default null,
  p_department text default null,
  p_group_ids uuid[] default '{}'::uuid[],
  p_expires_at timestamptz default null
)
returns public.company_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_company public.companies%rowtype;
  v_role text;
  v_token text;
  v_inv public.company_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_company_id := private.current_company_admin_company_id();
  if v_company_id is null then
    raise exception 'Company Admin access required';
  end if;

  select *
  into v_company
  from public.companies
  where id = v_company_id
    and coalesce(status, 'Active') in ('Active', 'Approved');

  if not found then
    raise exception 'Active company not found';
  end if;

  v_role := private.normalize_org_role(p_access_role);
  if v_role is null then
    raise exception 'Invitation role is not allowed';
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'Invitation email is required';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_group_ids, '{}'::uuid[])) as gid
    left join public.company_groups g on g.id = gid and g.company_id = v_company_id
    where gid is not null and g.id is null
  ) then
    raise exception 'Invitation contains a group outside the company';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.company_invitations (
    email, company_id, intended_access_role, intended_job_position, intended_department,
    token, status, invited_by, expires_at, first_name, last_name, invite_group,
    invite_link, company_name, company_logo, intended_group_ids
  ) values (
    lower(btrim(p_email)), v_company_id, v_role, nullif(btrim(coalesce(p_job_position, '')), ''),
    nullif(btrim(coalesce(p_department, '')), ''), v_token, 'Pending', v_user_id,
    coalesce(p_expires_at, now() + interval '14 days'),
    nullif(btrim(coalesce(p_first_name, '')), ''),
    nullif(btrim(coalesce(p_last_name, '')), ''),
    (
      select string_agg(g.name, ', ' order by g.name)
      from public.company_groups g
      where g.company_id = v_company_id
        and g.id = any(coalesce(p_group_ids, '{}'::uuid[]))
    ),
    '?invite=' || v_token,
    v_company.name,
    v_company.logo,
    coalesce(p_group_ids, '{}'::uuid[])
  )
  returning * into v_inv;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'company_invitation.created',
    v_user_id,
    v_company_id,
    'company_invitations',
    v_inv.id::text,
    jsonb_build_object('email', v_inv.email, 'role', v_role, 'group_ids', coalesce(p_group_ids, '{}'::uuid[])),
    'Company Admin created invitation through controlled RPC'
  );

  return v_inv;
end;
$$;

create or replace function public.revoke_company_invitation(p_invitation_id uuid)
returns public.company_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inv public.company_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_inv
  from public.company_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if not private.current_is_company_admin_for(v_inv.company_id) then
    raise exception 'Company Admin access required';
  end if;

  if v_inv.status <> 'Pending' then
    raise exception 'Only pending invitations can be revoked';
  end if;

  update public.company_invitations
  set status = 'Cancelled',
      revoked_at = now(),
      revoked_by = v_user_id
  where id = p_invitation_id
  returning * into v_inv;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'company_invitation.revoked',
    v_user_id,
    v_inv.company_id,
    'company_invitations',
    v_inv.id::text,
    jsonb_build_object('status', v_inv.status),
    'Company Admin revoked pending invitation through controlled RPC'
  );

  return v_inv;
end;
$$;

create or replace function public.accept_company_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv public.company_invitations%rowtype;
  v_company public.companies%rowtype;
  v_existing public.company_memberships%rowtype;
  v_role text;
  v_profile_role text;
  v_group_ids uuid[] := '{}'::uuid[];
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Authentication required';
  end if;

  if private.is_platform_admin_user(v_user_id, v_email) then
    raise exception 'platform_admin_cannot_accept_company_invitation';
  end if;

  if invitation_token is null or length(btrim(invitation_token)) < 20 then
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

  if v_inv.status = 'Accepted' and v_inv.accepted_by = v_user_id then
    return jsonb_build_object(
      'status', 'already_accepted',
      'company_id', v_inv.company_id,
      'invitation_id', v_inv.id
    );
  end if;

  if v_inv.status = 'Accepted' and v_inv.accepted_by <> v_user_id then
    raise exception 'Invitation already accepted by another user';
  end if;

  if v_inv.status <> 'Pending' then
    raise exception 'Invitation is not pending';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at <= now() then
    raise exception 'Invitation has expired';
  end if;

  if lower(v_inv.email) <> v_email then
    raise exception 'Invitation email does not match authenticated user';
  end if;

  select *
  into v_company
  from public.companies
  where id = v_inv.company_id
    and coalesce(status, 'Active') in ('Active', 'Approved');

  if not found then
    raise exception 'Invitation company not found or inactive';
  end if;

  v_role := private.normalize_org_role(v_inv.intended_access_role);
  if v_role is null then
    raise exception 'Invitation role is not allowed';
  end if;

  v_group_ids := coalesce(v_inv.intended_group_ids, '{}'::uuid[]);

  if exists (
    select 1
    from unnest(v_group_ids) as gid
    left join public.company_groups g on g.id = gid and g.company_id = v_company.id
    where gid is not null and g.id is null
  ) then
    raise exception 'Invitation contains a group outside the invitation company';
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

  insert into public.profiles (
    id, email, role, approved, company_name, active_company_name,
    supplier_company, company_type, access_role, first_name, last_name,
    job_position, department, company_group
  ) values (
    v_user_id, v_email, v_profile_role, true, v_company.name, v_company.name,
    case when v_company.type = 'Supplier' then v_company.name else null end,
    v_company.type, v_role, v_inv.first_name, v_inv.last_name,
    v_inv.intended_job_position, v_inv.intended_department, v_inv.invite_group
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    approved = true,
    role = v_profile_role,
    company_name = v_company.name,
    active_company_name = v_company.name,
    supplier_company = case when v_company.type = 'Supplier' then v_company.name else null end,
    company_type = v_company.type,
    access_role = v_role,
    first_name = coalesce(nullif(public.profiles.first_name, ''), excluded.first_name),
    last_name = coalesce(nullif(public.profiles.last_name, ''), excluded.last_name),
    job_position = coalesce(excluded.job_position, public.profiles.job_position),
    department = coalesce(excluded.department, public.profiles.department),
    company_group = coalesce(excluded.company_group, public.profiles.company_group);

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
    access_role = excluded.access_role,
    job_position = excluded.job_position,
    department = excluded.department,
    membership_status = 'Active',
    invited_by = excluded.invited_by,
    approved_by = excluded.approved_by,
    updated_at = now()
  where public.company_memberships.company_id = excluded.company_id;

  delete from public.company_group_memberships
  where company_id = v_company.id
    and user_id = v_user_id;

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
    jsonb_build_object('role', v_role, 'group_ids', v_group_ids),
    'Valid invitation accepted by matching authenticated user'
  );

  return jsonb_build_object(
    'status', 'accepted',
    'company_id', v_company.id,
    'company_name', v_company.name,
    'company_type', v_company.type,
    'access_role', v_role,
    'group_ids', v_group_ids,
    'invitation_id', v_inv.id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: company member management
-- ---------------------------------------------------------------------------

create or replace function public.update_company_member(
  p_member_user_id uuid,
  p_access_role text,
  p_group_ids uuid[] default '{}'::uuid[],
  p_job_position text default null,
  p_department text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_target public.company_memberships%rowtype;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  v_company_id := private.current_company_admin_company_id();
  if v_company_id is null then
    raise exception 'Company Admin access required';
  end if;

  if private.is_platform_admin_user(p_member_user_id, null) then
    raise exception 'Cannot manage Platform Admin as company member';
  end if;

  v_role := private.normalize_org_role(p_access_role);
  if v_role is null then
    raise exception 'Member role is not allowed';
  end if;

  select *
  into v_target
  from public.company_memberships
  where user_id = p_member_user_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'Member not found in your company';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_group_ids, '{}'::uuid[])) as gid
    left join public.company_groups g on g.id = gid and g.company_id = v_company_id
    where gid is not null and g.id is null
  ) then
    raise exception 'Group outside company is not allowed';
  end if;

  update public.company_memberships
  set access_role = v_role,
      job_position = coalesce(nullif(btrim(coalesce(p_job_position, '')), ''), job_position),
      department = coalesce(nullif(btrim(coalesce(p_department, '')), ''), department),
      membership_status = 'Active',
      updated_at = now()
  where user_id = p_member_user_id
    and company_id = v_company_id;

  update public.profiles
  set access_role = v_role,
      job_position = coalesce(nullif(btrim(coalesce(p_job_position, '')), ''), job_position),
      department = coalesce(nullif(btrim(coalesce(p_department, '')), ''), department)
  where id = p_member_user_id
    and not private.is_platform_admin_user(id, email);

  delete from public.company_group_memberships
  where company_id = v_company_id
    and user_id = p_member_user_id;

  insert into public.company_group_memberships (company_id, company_group_id, user_id)
  select distinct v_company_id, gid, p_member_user_id
  from unnest(coalesce(p_group_ids, '{}'::uuid[])) as gid
  where gid is not null
  on conflict (company_group_id, user_id) do nothing;

  insert into public.audit_logs (
    action, actor_user_id, target_user_id, company_id,
    entity_type, entity_id, new_value, reason
  ) values (
    'company_member.updated',
    v_caller,
    p_member_user_id,
    v_company_id,
    'company_memberships',
    p_member_user_id::text,
    jsonb_build_object('role', v_role, 'group_ids', coalesce(p_group_ids, '{}'::uuid[])),
    'Company Admin updated own-company member through controlled RPC'
  );

  return jsonb_build_object('status', 'updated', 'user_id', p_member_user_id, 'access_role', v_role);
end;
$$;

create or replace function public.remove_company_member(p_member_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_company_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  v_company_id := private.current_company_admin_company_id();
  if v_company_id is null then
    raise exception 'Company Admin access required';
  end if;

  if p_member_user_id = v_caller then
    raise exception 'Company Admin cannot remove itself through this RPC';
  end if;

  if private.is_platform_admin_user(p_member_user_id, null) then
    raise exception 'Cannot remove Platform Admin as company member';
  end if;

  update public.company_memberships
  set membership_status = 'Removed',
      updated_at = now()
  where user_id = p_member_user_id
    and company_id = v_company_id
    and membership_status = 'Active';

  if not found then
    raise exception 'Active member not found in your company';
  end if;

  delete from public.company_group_memberships
  where company_id = v_company_id
    and user_id = p_member_user_id;

  update public.profiles
  set company_name = '',
      active_company_name = '',
      supplier_company = '',
      company_type = '',
      access_role = 'Company Member',
      company_group = '',
      company_subgroup = '',
      department = ''
  where id = p_member_user_id
    and not private.is_platform_admin_user(id, email);

  insert into public.audit_logs (
    action, actor_user_id, target_user_id, company_id,
    entity_type, entity_id, reason
  ) values (
    'company_member.removed',
    v_caller,
    p_member_user_id,
    v_company_id,
    'company_memberships',
    p_member_user_id::text,
    'Company Admin removed own-company member through controlled RPC'
  );

  return jsonb_build_object('status', 'removed', 'user_id', p_member_user_id);
end;
$$;

-- SECURITY DEFINER exposure is explicit and narrow.
revoke all on function public.update_own_profile(text, text, text, text) from public, anon;
revoke all on function public.touch_own_profile_seen() from public, anon;
revoke all on function public.create_company_invitation(text, text, text, text, text, text, uuid[], timestamptz) from public, anon;
revoke all on function public.revoke_company_invitation(uuid) from public, anon;
revoke all on function public.accept_company_invitation(text) from public, anon;
revoke all on function public.update_company_member(uuid, text, uuid[], text, text) from public, anon;
revoke all on function public.remove_company_member(uuid) from public, anon;

grant execute on function public.update_own_profile(text, text, text, text) to authenticated;
grant execute on function public.touch_own_profile_seen() to authenticated;
grant execute on function public.create_company_invitation(text, text, text, text, text, text, uuid[], timestamptz) to authenticated;
grant execute on function public.revoke_company_invitation(uuid) to authenticated;
grant execute on function public.accept_company_invitation(text) to authenticated;
grant execute on function public.update_company_member(uuid, text, uuid[], text, text) to authenticated;
grant execute on function public.remove_company_member(uuid) to authenticated;

comment on function public.accept_company_invitation(text) is
  'DRAFT v2. Atomic company invitation acceptance. Rejects Platform Admin and derives all authorization from auth.uid plus trusted membership tables.';

commit;
