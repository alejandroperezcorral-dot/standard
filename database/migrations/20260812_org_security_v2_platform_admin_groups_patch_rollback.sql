-- STDTEX Organization Security v2 Platform Admin groups patch rollback
--
-- STAGING VALIDATION ONLY.
-- Removes only policies introduced by:
-- 20260812_org_security_v2_platform_admin_groups_patch.sql

begin;

drop policy if exists company_groups_platform_admin_select_v2 on public.company_groups;
drop policy if exists company_groups_platform_admin_insert_v2 on public.company_groups;
drop policy if exists company_groups_platform_admin_update_v2 on public.company_groups;
drop policy if exists company_groups_platform_admin_delete_v2 on public.company_groups;

commit;
