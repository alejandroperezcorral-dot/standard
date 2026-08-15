-- STDTEX Cost Model 001 dormant production verification
-- READ ONLY. Do not run in a transaction that mutates data.

with expected_tables(table_name) as (
  values
    ('cost_models'),
    ('company_costing_settings'),
    ('cost_config_versions'),
    ('cost_config_overrides'),
    ('cost_additional_components')
)
select
  'costing_tables_exist' as check_name,
  case when count(c.relname) = 5 then 'PASS' else 'FAIL' end as status,
  jsonb_agg(e.table_name order by e.table_name) as expected_tables,
  jsonb_agg(c.relname order by e.table_name) filter (where c.relname is not null) as existing_tables
from expected_tables e
left join pg_class c
  on c.relname = e.table_name
 and c.relnamespace = 'public'::regnamespace
 and c.relkind = 'r';

select
  'rls_enabled' as check_name,
  case when bool_and(c.relrowsecurity) then 'PASS' else 'FAIL' end as status,
  jsonb_object_agg(c.relname, c.relrowsecurity order by c.relname) as table_rls
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  );

select
  'costing_policies' as check_name,
  case when count(*) >= 5 then 'PASS' else 'FAIL' end as status,
  jsonb_agg(policyname order by tablename, policyname) as policies
from pg_policies
where schemaname = 'public'
  and tablename in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  );

select
  'browser_role_grants' as check_name,
  case when count(*) = 5 then 'PASS' else 'FAIL' end as status,
  jsonb_agg(table_name order by table_name) as authenticated_select_tables
from information_schema.table_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type = 'SELECT'
  and table_name in (
    'cost_models',
    'company_costing_settings',
    'cost_config_versions',
    'cost_config_overrides',
    'cost_additional_components'
  );

select
  'trusted_validation_function_permissions' as check_name,
  case
    when has_function_privilege('service_role', 'public.mark_cost_config_semantically_validated(uuid, integer, jsonb)', 'EXECUTE')
     and not has_function_privilege('authenticated', 'public.mark_cost_config_semantically_validated(uuid, integer, jsonb)', 'EXECUTE')
     and not has_function_privilege('anon', 'public.mark_cost_config_semantically_validated(uuid, integer, jsonb)', 'EXECUTE')
    then 'PASS'
    else 'FAIL'
  end as status,
  has_function_privilege('service_role', 'public.mark_cost_config_semantically_validated(uuid, integer, jsonb)', 'EXECUTE') as service_role_execute,
  has_function_privilege('authenticated', 'public.mark_cost_config_semantically_validated(uuid, integer, jsonb)', 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', 'public.mark_cost_config_semantically_validated(uuid, integer, jsonb)', 'EXECUTE') as anon_execute;

select
  'model_001_seed' as check_name,
  case
    when count(*) = 1
     and min(name) = 'STDTEX Cost Model 001'
     and min(source_type) = 'STDTEX_MODEL'
     and min(status) = 'AVAILABLE'
     and min(current_formula_version) = 1
     and min(template_key) = 'cost-model-001/current'
    then 'PASS'
    else 'FAIL'
  end as status,
  count(*) as rows
from public.cost_models
where code = 'cost-model-001';

select
  'active_costing_configs_zero' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  count(*) as active_configs
from public.cost_config_versions
where lifecycle_status = 'ACTIVE';

select
  'enabled_company_costing_zero' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  count(*) as enabled_company_settings
from public.company_costing_settings
where cost_source_type <> 'FOB_ONLY'
   or active_cost_model_id is not null
   or active_config_version_id is not null;

select 'company_count_reference' as check_name, count(*) as companies from public.companies;
select 'negotiation_rows_reference' as check_name, count(*) as negotiation_rows from public.negotiation_rows;
