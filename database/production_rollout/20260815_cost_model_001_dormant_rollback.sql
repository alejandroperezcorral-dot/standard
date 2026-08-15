-- STDTEX Cost Model 001 dormant rollback
-- DESTRUCTIVE. DO NOT RUN after any real Costing company config, draft, override,
-- component, activation, audit-dependent workflow, or production usage exists.
-- This rollback is suitable ONLY immediately after the dormant production migration
-- if active Costing configs remain 0 and no company has been enabled.

begin;

do $$
declare
  v_active_configs integer;
  v_versions integer;
  v_overrides integer;
  v_components integer;
  v_enabled_companies integer;
begin
  select count(*) into v_active_configs
  from public.cost_config_versions
  where lifecycle_status = 'ACTIVE';

  select count(*) into v_versions from public.cost_config_versions;
  select count(*) into v_overrides from public.cost_config_overrides;
  select count(*) into v_components from public.cost_additional_components;

  select count(*) into v_enabled_companies
  from public.company_costing_settings
  where cost_source_type <> 'FOB_ONLY'
     or active_cost_model_id is not null
     or active_config_version_id is not null;

  if v_active_configs <> 0
     or v_versions <> 0
     or v_overrides <> 0
     or v_components <> 0
     or v_enabled_companies <> 0 then
    raise exception 'DORMANT_ROLLBACK_REFUSED: Costing data exists';
  end if;
end $$;

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

drop function if exists private.costing_current_validation_hash(uuid);
drop function if exists private.costing_validation_canonical_payload(uuid);
drop function if exists private.costing_invalidate_parent_semantic_validation();
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

drop table if exists public.company_costing_settings;
drop table if exists public.cost_additional_components;
drop table if exists public.cost_config_overrides;
drop table if exists public.cost_config_versions;
drop table if exists public.cost_models;

commit;
