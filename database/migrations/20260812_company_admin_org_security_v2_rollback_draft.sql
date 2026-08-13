-- DRAFT ONLY - DO NOT EXECUTE.
-- SECURITY DESIGN CORRECTION ROLLBACK DRAFT.
--
-- This rollback is intentionally non-destructive for data.
-- It removes v2 functions and v2 policies, then restores the legacy policy shape
-- that existed before the v2 draft. It does NOT drop invitation columns by default.
--
-- Pre-production rollback:
--   Safe to run on an isolated staging branch if v2 has been applied there.
--
-- Post-production recovery:
--   Do not blindly drop columns or delete invitation data. Export affected tables
--   first and restore from backup/PITR if a production migration ever has to be
--   reversed after users have accepted invitations.

begin;

drop function if exists public.remove_company_member(uuid);
drop function if exists public.update_company_member(uuid, text, uuid[], text, text);
drop function if exists public.accept_company_invitation(text);
drop function if exists public.revoke_company_invitation(uuid);
drop function if exists public.create_company_invitation(text, text, text, text, text, text, uuid[], timestamptz);
drop function if exists public.touch_own_profile_seen();
drop function if exists public.update_own_profile(text, text, text, text);
drop function if exists public.update_own_profile(text, text, text, text, text);

drop policy if exists profiles_self_select_v2 on public.profiles;
drop policy if exists profiles_self_insert_minimal_v2 on public.profiles;
drop policy if exists profiles_platform_admin_all_v2 on public.profiles;
drop policy if exists profiles_company_admin_member_read_v2 on public.profiles;

drop policy if exists company_memberships_select_v2 on public.company_memberships;
drop policy if exists company_memberships_platform_admin_insert_v2 on public.company_memberships;
drop policy if exists company_memberships_platform_admin_update_v2 on public.company_memberships;
drop policy if exists company_memberships_platform_admin_delete_v2 on public.company_memberships;

drop policy if exists company_group_memberships_select_v2 on public.company_group_memberships;
drop policy if exists company_group_memberships_platform_admin_insert_v2 on public.company_group_memberships;
drop policy if exists company_group_memberships_platform_admin_update_v2 on public.company_group_memberships;
drop policy if exists company_group_memberships_platform_admin_delete_v2 on public.company_group_memberships;

drop policy if exists company_invitations_select_v2 on public.company_invitations;
drop policy if exists company_invitations_platform_admin_insert_v2 on public.company_invitations;
drop policy if exists company_invitations_platform_admin_update_v2 on public.company_invitations;
drop policy if exists company_invitations_platform_admin_delete_v2 on public.company_invitations;

-- Restore legacy profile policies from the repository bootstrap SQL.
create policy profiles_self
on public.profiles
for all
to authenticated
using (auth.uid() = id or (auth.jwt() ->> 'email') = 'hello@athletestandards.com');

create policy profiles_company_admin_read
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or (auth.jwt() ->> 'email') = 'hello@athletestandards.com'
  or exists (
    select 1
    from public.company_memberships my_cm
    join public.company_memberships target_cm on target_cm.company_id = my_cm.company_id
    where my_cm.user_id = auth.uid()
      and my_cm.membership_status = 'Active'
      and my_cm.access_role in ('Company Admin', 'Platform Admin')
      and target_cm.user_id = public.profiles.id
  )
);

create policy profiles_company_admin_update
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or (auth.jwt() ->> 'email') = 'hello@athletestandards.com'
  or exists (
    select 1
    from public.company_memberships my_cm
    join public.company_memberships target_cm on target_cm.company_id = my_cm.company_id
    where my_cm.user_id = auth.uid()
      and my_cm.membership_status = 'Active'
      and my_cm.access_role in ('Company Admin', 'Platform Admin')
      and target_cm.user_id = public.profiles.id
  )
)
with check (
  id = auth.uid()
  or (auth.jwt() ->> 'email') = 'hello@athletestandards.com'
  or exists (
    select 1
    from public.company_memberships my_cm
    join public.company_memberships target_cm on target_cm.company_id = my_cm.company_id
    where my_cm.user_id = auth.uid()
      and my_cm.membership_status = 'Active'
      and my_cm.access_role in ('Company Admin', 'Platform Admin')
      and target_cm.user_id = public.profiles.id
  )
);

-- Restore legacy organization policies from the repository bootstrap SQL.
create policy company_memberships_admin_read_write
on public.company_memberships
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'hello@athletestandards.com' or user_id = auth.uid())
with check ((auth.jwt() ->> 'email') = 'hello@athletestandards.com' or user_id = auth.uid());

create policy company_memberships_company_admin_read_write
on public.company_memberships
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.companies c on lower(c.name) = lower(coalesce(p.active_company_name, p.company_name, p.supplier_company, ''))
    where p.id = auth.uid()
      and p.approved is not false
      and p.access_role in ('Company Admin', 'Platform Admin')
      and c.id = public.company_memberships.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.companies c on lower(c.name) = lower(coalesce(p.active_company_name, p.company_name, p.supplier_company, ''))
    where p.id = auth.uid()
      and p.approved is not false
      and p.access_role in ('Company Admin', 'Platform Admin')
      and c.id = public.company_memberships.company_id
  )
);

create policy company_group_memberships_admin_read_write
on public.company_group_memberships
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'hello@athletestandards.com' or user_id = auth.uid())
with check ((auth.jwt() ->> 'email') = 'hello@athletestandards.com');

create policy company_group_memberships_company_admin_read_write
on public.company_group_memberships
for all
to authenticated
using (
  (auth.jwt() ->> 'email') = 'hello@athletestandards.com'
  or exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = public.company_group_memberships.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role in ('Company Admin', 'Platform Admin')
  )
)
with check (
  (auth.jwt() ->> 'email') = 'hello@athletestandards.com'
  or exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = public.company_group_memberships.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role in ('Company Admin', 'Platform Admin')
  )
);

create policy company_invitations_company_admin_all
on public.company_invitations
for all
to authenticated
using (
  (auth.jwt() ->> 'email') = 'hello@athletestandards.com'
  or exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = public.company_invitations.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role in ('Company Admin', 'Platform Admin')
  )
)
with check (
  (auth.jwt() ->> 'email') = 'hello@athletestandards.com'
  or exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = public.company_invitations.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role in ('Company Admin', 'Platform Admin')
  )
);

create policy company_invitations_invitee_update
on public.company_invitations
for update
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and status = 'Pending'
)
with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop function if exists private.current_is_company_admin_for(uuid);
drop function if exists private.current_company_admin_company_id();
drop function if exists private.is_platform_admin_user(uuid, text);
drop function if exists private.current_is_platform_admin();
drop function if exists private.membership_status_is_allowed(text);
drop function if exists private.org_role_is_allowed(text);
drop function if exists private.normalize_org_role(text);

-- Keep private schema if other future migrations use it.
-- drop schema if exists private;

commit;
