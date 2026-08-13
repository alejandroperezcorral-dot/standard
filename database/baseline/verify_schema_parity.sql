-- STDTEX schema parity inventory
--
-- Run this read-only query set against production and against a replayed empty
-- baseline database. Compare results structurally.
--
-- This does not modify the database and contains no credentials.

select 'tables' as section, table_schema, table_name, null::text as name, null::text as detail
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'

union all

select
  'columns' as section,
  table_schema,
  table_name,
  column_name as name,
  concat_ws(
    ' | ',
    data_type,
    udt_name,
    is_nullable,
    column_default
  ) as detail
from information_schema.columns
where table_schema = 'public'

union all

select
  'constraints' as section,
  table_schema,
  table_name,
  constraint_name as name,
  constraint_type as detail
from information_schema.table_constraints
where table_schema = 'public'

union all

select
  'indexes' as section,
  schemaname as table_schema,
  tablename as table_name,
  indexname as name,
  indexdef as detail
from pg_indexes
where schemaname = 'public'

union all

select
  'rls' as section,
  n.nspname as table_schema,
  c.relname as table_name,
  'row_level_security' as name,
  concat('enabled=', c.relrowsecurity::text, ' forced=', c.relforcerowsecurity::text) as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'

union all

select
  'policies' as section,
  schemaname as table_schema,
  tablename as table_name,
  policyname as name,
  concat_ws(
    ' | ',
    cmd,
    array_to_string(roles, ','),
    qual,
    with_check
  ) as detail
from pg_policies
where schemaname = 'public'

union all

select
  'functions' as section,
  n.nspname as table_schema,
  null::text as table_name,
  p.proname as name,
  pg_get_functiondef(p.oid) as detail
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'

union all

select
  'triggers' as section,
  trigger_schema as table_schema,
  event_object_table as table_name,
  trigger_name as name,
  concat(action_timing, ' ', event_manipulation, ' ', action_statement) as detail
from information_schema.triggers
where trigger_schema = 'public'

union all

select
  'storage_buckets' as section,
  'storage' as table_schema,
  'buckets' as table_name,
  id as name,
  concat_ws(
    ' | ',
    'name=' || name,
    'public=' || public::text,
    'file_size_limit=' || coalesce(file_size_limit::text, ''),
    'allowed_mime_types=' || coalesce(allowed_mime_types::text, '')
  ) as detail
from storage.buckets

order by section, table_schema, table_name, name, detail;
