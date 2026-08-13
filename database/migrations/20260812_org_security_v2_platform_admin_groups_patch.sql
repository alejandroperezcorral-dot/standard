-- STDTEX Organization Security v2 patch
-- Purpose: grant Platform Admin global visibility/management of company_groups
-- without requiring company membership.
--
-- STAGING VALIDATION ONLY.
-- Do not apply to production without explicit approval.

begin;

drop policy if exists company_groups_platform_admin_select_v2 on public.company_groups;
create policy company_groups_platform_admin_select_v2
on public.company_groups
as permissive
for select
to authenticated
using (private.current_is_platform_admin());

drop policy if exists company_groups_platform_admin_insert_v2 on public.company_groups;
create policy company_groups_platform_admin_insert_v2
on public.company_groups
as permissive
for insert
to authenticated
with check (private.current_is_platform_admin());

drop policy if exists company_groups_platform_admin_update_v2 on public.company_groups;
create policy company_groups_platform_admin_update_v2
on public.company_groups
as permissive
for update
to authenticated
using (private.current_is_platform_admin())
with check (private.current_is_platform_admin());

drop policy if exists company_groups_platform_admin_delete_v2 on public.company_groups;
create policy company_groups_platform_admin_delete_v2
on public.company_groups
as permissive
for delete
to authenticated
using (private.current_is_platform_admin());

commit;
