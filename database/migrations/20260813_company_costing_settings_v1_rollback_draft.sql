-- STDTEX Company Costing Settings V1 rollback
-- STAGING ROLLBACK DRAFT
-- REVIEW BEFORE EXECUTION
-- DO NOT APPLY TO PRODUCTION
--
-- Reverses only objects introduced by:
--   20260813_company_costing_settings_v1_draft.sql
--
-- Must not affect existing STDTEX objects:
--   companies, profiles, company_memberships, company_groups,
--   company_group_memberships, audit_logs, negotiation_rows,
--   collections, styles, canvas, or any pre-existing product data.

begin;

-- ---------------------------------------------------------------------------
-- Public RPC grants/functions
-- ---------------------------------------------------------------------------

revoke all on function public.set_company_cost_source(uuid, text, text, uuid, text) from public;
revoke all on function public.create_cost_config_draft(uuid, text, text, text, jsonb, uuid, text, text, text) from public;
revoke all on function public.duplicate_cost_config(uuid, text, text) from public;
revoke all on function public.update_cost_config_draft(uuid, jsonb) from public;
revoke all on function public.upsert_cost_override(uuid, text, text, text, jsonb, text) from public;
revoke all on function public.remove_cost_override(uuid) from public;
revoke all on function public.add_cost_component(uuid, jsonb) from public;
revoke all on function public.update_cost_component(uuid, jsonb) from public;
revoke all on function public.remove_cost_component(uuid) from public;
revoke all on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) from public;
revoke all on function public.activate_cost_config(uuid) from public;
revoke all on function public.archive_cost_config(uuid) from public;

drop function if exists public.archive_cost_config(uuid);
drop function if exists public.activate_cost_config(uuid);
drop function if exists public.mark_cost_config_semantically_validated(uuid, integer, jsonb);
drop function if exists public.remove_cost_component(uuid);
drop function if exists public.update_cost_component(uuid, jsonb);
drop function if exists public.add_cost_component(uuid, jsonb);
drop function if exists public.remove_cost_override(uuid);
drop function if exists public.upsert_cost_override(uuid, text, text, text, jsonb, text);
drop function if exists public.update_cost_config_draft(uuid, jsonb);
drop function if exists public.duplicate_cost_config(uuid, text, text);
drop function if exists public.create_cost_config_draft(uuid, text, text, text, jsonb, uuid, text, text, text);
drop function if exists public.set_company_cost_source(uuid, text, text, uuid, text);

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists cost_additional_components_admin_select on public.cost_additional_components;
drop policy if exists cost_config_overrides_admin_select on public.cost_config_overrides;
drop policy if exists cost_config_versions_admin_select on public.cost_config_versions;
drop policy if exists company_costing_settings_admin_select on public.company_costing_settings;
drop policy if exists cost_models_platform_admin_select on public.cost_models;

-- ---------------------------------------------------------------------------
-- Triggers and private helper functions introduced by the migration
-- ---------------------------------------------------------------------------

drop trigger if exists company_costing_settings_validate_before_write on public.company_costing_settings;
drop trigger if exists cost_additional_components_draft_parent_guard on public.cost_additional_components;
drop trigger if exists cost_additional_components_normalize_before_write on public.cost_additional_components;
drop trigger if exists cost_config_overrides_draft_parent_guard on public.cost_config_overrides;
drop trigger if exists cost_config_overrides_normalize_before_write on public.cost_config_overrides;
drop trigger if exists cost_config_versions_locked_delete_guard on public.cost_config_versions;
drop trigger if exists cost_config_versions_locked_update_guard on public.cost_config_versions;
drop trigger if exists cost_config_versions_normalize_before_write on public.cost_config_versions;

drop function if exists private.costing_validate_company_settings();
drop function if exists private.costing_assert_parent_config_is_draft();
drop function if exists private.costing_normalize_component();
drop function if exists private.costing_normalize_override();
drop function if exists private.costing_prevent_locked_config_delete();
drop function if exists private.costing_prevent_locked_config_update();
drop function if exists private.costing_reset_semantic_validation();
drop function if exists private.costing_assert_can_manage_company(uuid);
drop function if exists private.current_can_manage_costing_company(uuid);
drop function if exists private.normalize_costing_trim_key(text);
drop function if exists private.normalize_costing_upper_key(text);
drop function if exists private.costing_command_is_active();

-- ---------------------------------------------------------------------------
-- Tables in dependency order
-- ---------------------------------------------------------------------------

drop table if exists public.cost_additional_components;
drop table if exists public.cost_config_overrides;
drop table if exists public.company_costing_settings;
drop table if exists public.cost_config_versions;
drop table if exists public.cost_models;

commit;
