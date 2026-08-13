-- STDTEX Company Costing Settings V1 static verification
-- READ-ONLY SQL FOR FUTURE STAGING USE
-- DO NOT MODIFY DATA
--
-- Intended use after applying the reviewed staging migration draft.

-- ---------------------------------------------------------------------------
-- 1. Expected tables and RLS
-- ---------------------------------------------------------------------------

select
  'expected_tables' as check_name,
  c.relname as object_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
order by c.relname;

-- ---------------------------------------------------------------------------
-- 2. Expected columns
-- ---------------------------------------------------------------------------

select
  'expected_columns' as check_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
order by table_name, ordinal_position;

-- ---------------------------------------------------------------------------
-- 3. Constraints
-- ---------------------------------------------------------------------------

select
  'constraints' as check_name,
  conrelid::regclass::text as table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.cost_models'::regclass,
  'public.company_costing_settings'::regclass,
  'public.cost_config_versions'::regclass,
  'public.cost_config_overrides'::regclass,
  'public.cost_additional_components'::regclass
)
order by table_name, conname;

-- ---------------------------------------------------------------------------
-- 4. Indexes, including one-active-config enforcement
-- ---------------------------------------------------------------------------

select
  'indexes' as check_name,
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
order by tablename, indexname;

select
  'one_active_config_index' as check_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'cost_config_versions'
  and indexname = 'cost_config_versions_one_active_per_company_model';

-- ---------------------------------------------------------------------------
-- 5. Policies and anon exposure
-- ---------------------------------------------------------------------------

select
  'policies' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
order by tablename, policyname;

select
  'anon_or_public_costing_policies' as check_name,
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
  and (
    roles::text ilike '%anon%'
    or roles::text ilike '%public%'
  )
order by tablename, policyname;

-- Expected: zero rows.

select
  'costing_table_privileges' as check_name,
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
order by table_name, grantee, privilege_type;

select
  'unexpected_costing_table_privileges' as check_name,
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
  and (
    grantee in ('PUBLIC', 'anon')
    or (grantee = 'authenticated' and privilege_type <> 'SELECT')
  )
order by table_name, grantee, privilege_type;

-- Expected: zero rows.

-- ---------------------------------------------------------------------------
-- 6. Functions and grants
-- ---------------------------------------------------------------------------

select
  'costing_functions' as check_name,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in (
    'set_company_cost_source',
    'create_cost_config_draft',
    'duplicate_cost_config',
    'update_cost_config_draft',
    'upsert_cost_override',
    'remove_cost_override',
    'add_cost_component',
    'update_cost_component',
    'remove_cost_component',
    'mark_cost_config_semantically_validated',
    'activate_cost_config',
    'archive_cost_config'
  ))
  or (n.nspname = 'private' and p.proname like 'costing_%')
  or (n.nspname = 'private' and p.proname in (
    'normalize_costing_upper_key',
    'normalize_costing_trim_key',
    'current_can_manage_costing_company'
  ))
order by schema_name, function_name, arguments;

select
  'public_or_anon_execute_grants' as check_name,
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema in ('public', 'private')
  and routine_name in (
    'set_company_cost_source',
    'create_cost_config_draft',
    'duplicate_cost_config',
    'update_cost_config_draft',
    'upsert_cost_override',
    'remove_cost_override',
    'add_cost_component',
    'update_cost_component',
    'remove_cost_component',
    'mark_cost_config_semantically_validated',
    'activate_cost_config',
    'archive_cost_config'
  )
  and grantee in ('PUBLIC', 'anon')
order by routine_schema, routine_name, grantee;

-- Expected: zero rows.

select
  'service_only_semantic_validation' as check_name,
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'mark_cost_config_semantically_validated'
order by grantee;

-- ---------------------------------------------------------------------------
-- 7. Cost Model 001 seed metadata
-- ---------------------------------------------------------------------------

select
  'cost_model_001_seed' as check_name,
  code,
  source_type,
  status,
  current_formula_version,
  template_key
from public.cost_models
where code = 'cost-model-001';

-- ---------------------------------------------------------------------------
-- 8. Existing product safety checks
-- ---------------------------------------------------------------------------

select
  'negotiation_rows_unchanged_shape_reference' as check_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'negotiation_rows'
  and column_name in ('id', 'fob1', 'fob2', 'fob3', 'fob_closed', 'origin', 'temporada', 'cat')
order by ordinal_position;

-- ---------------------------------------------------------------------------
-- 9. Dependency scan
-- ---------------------------------------------------------------------------

select
  'costing_dependencies' as check_name,
  dependent_ns.nspname as dependent_schema,
  dependent_view.relname as dependent_object,
  source_ns.nspname as source_schema,
  source_table.relname as source_object
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class dependent_view on dependent_view.oid = r.ev_class
join pg_namespace dependent_ns on dependent_ns.oid = dependent_view.relnamespace
join pg_class source_table on source_table.oid = d.refobjid
join pg_namespace source_ns on source_ns.oid = source_table.relnamespace
where source_ns.nspname = 'public'
  and source_table.relname in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  )
order by dependent_schema, dependent_object, source_object;
