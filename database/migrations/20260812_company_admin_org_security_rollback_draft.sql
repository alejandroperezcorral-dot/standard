-- DRAFT ONLY - DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL.
-- Rollback for 20260812_company_admin_org_security_draft.sql.
-- Purpose:
--   Restore the organization policies/functions to the pre-migration shape
--   captured during the 2026-08-12 audit.
--
-- Note:
--   This rollback intentionally does not remove accepted membership/profile data.
--   If the RPC has already accepted invitations, data rollback requires a
--   point-in-time restore or targeted recovery from backup/audit logs.

begin;

drop function if exists public.accept_company_invitation(text);

drop policy if exists company_memberships_company_admin_select on public.company_memberships;
drop policy if exists company_memberships_company_admin_insert on public.company_memberships;
drop policy if exists company_memberships_company_admin_update on public.company_memberships;
drop policy if exists company_memberships_company_admin_delete on public.company_memberships;

create policy memberships_admin_or_self_read
on public.company_memberships
for select
using (
  ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or (user_id = auth.uid())
);

create policy memberships_admin_write
on public.company_memberships
for all
using ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
with check ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text);

drop policy if exists profiles_self_or_platform_admin_all on public.profiles;
drop policy if exists profiles_company_admin_member_read on public.profiles;

create policy profiles_self
on public.profiles
for all
using (
  (auth.uid() = id)
  or ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
);

create policy profiles_company_admin_read
on public.profiles
for select
to authenticated
using (
  (id = auth.uid())
  or ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or exists (
    select 1
    from company_memberships my_cm
    join company_memberships target_cm on target_cm.company_id = my_cm.company_id
    where my_cm.user_id = auth.uid()
      and my_cm.membership_status = 'Active'
      and my_cm.access_role = any (array['Company Admin'::text, 'Platform Admin'::text])
      and target_cm.user_id = profiles.id
  )
);

create policy profiles_company_admin_update
on public.profiles
for update
to authenticated
using (
  (id = auth.uid())
  or ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or exists (
    select 1
    from company_memberships my_cm
    join company_memberships target_cm on target_cm.company_id = my_cm.company_id
    where my_cm.user_id = auth.uid()
      and my_cm.membership_status = 'Active'
      and my_cm.access_role = any (array['Company Admin'::text, 'Platform Admin'::text])
      and target_cm.user_id = profiles.id
  )
)
with check (
  (id = auth.uid())
  or ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or exists (
    select 1
    from company_memberships my_cm
    join company_memberships target_cm on target_cm.company_id = my_cm.company_id
    where my_cm.user_id = auth.uid()
      and my_cm.membership_status = 'Active'
      and my_cm.access_role = any (array['Company Admin'::text, 'Platform Admin'::text])
      and target_cm.user_id = profiles.id
  )
);

drop policy if exists company_group_memberships_company_admin_select on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_insert on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_update on public.company_group_memberships;
drop policy if exists company_group_memberships_company_admin_delete on public.company_group_memberships;

create policy company_group_memberships_admin_write
on public.company_group_memberships
for all
to authenticated
using ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
with check ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text);

create policy company_group_memberships_company_admin_read_write
on public.company_group_memberships
for all
to authenticated
using (
  ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or exists (
    select 1 from company_memberships cm
    where cm.company_id = company_group_memberships.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role = any (array['Company Admin'::text, 'Platform Admin'::text])
  )
)
with check (
  ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or exists (
    select 1 from company_memberships cm
    where cm.company_id = company_group_memberships.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role = any (array['Company Admin'::text, 'Platform Admin'::text])
  )
);

create policy company_group_memberships_self_read
on public.company_group_memberships
for select
to authenticated
using (
  ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or (user_id = (select auth.uid() as uid))
);

drop policy if exists company_invitations_company_admin_select on public.company_invitations;
drop policy if exists company_invitations_company_admin_insert on public.company_invitations;
drop policy if exists company_invitations_company_admin_update on public.company_invitations;
drop policy if exists company_invitations_company_admin_delete on public.company_invitations;

create policy company_invitations_company_admin_all
on public.company_invitations
for all
to authenticated
using (
  ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or exists (
    select 1 from company_memberships cm
    where cm.company_id = company_invitations.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role = any (array['Company Admin'::text, 'Platform Admin'::text])
  )
)
with check (
  ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
  or exists (
    select 1 from company_memberships cm
    where cm.company_id = company_invitations.company_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role = any (array['Company Admin'::text, 'Platform Admin'::text])
  )
);

create policy company_invitations_invitee_update
on public.company_invitations
for update
to authenticated
using (
  lower(email) = lower(coalesce((auth.jwt() ->> 'email'::text), ''::text))
  and status = 'Pending'::text
)
with check (
  lower(email) = lower(coalesce((auth.jwt() ->> 'email'::text), ''::text))
);

create policy invitations_admin_write
on public.company_invitations
for all
using ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)
with check ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text);

drop index if exists public.company_invitations_email_status_idx;
drop index if exists public.company_invitations_pending_token_idx;

alter table public.company_invitations
  drop column if exists accepted_by,
  drop column if exists revoked_at,
  drop column if exists revoked_by,
  drop column if exists intended_group_ids;

drop function if exists private.membership_status_is_allowed(text);
drop function if exists private.org_role_is_allowed(text);
drop function if exists private.current_is_company_admin_for(uuid);
drop function if exists private.current_is_platform_admin();
drop schema if exists private;

commit;
