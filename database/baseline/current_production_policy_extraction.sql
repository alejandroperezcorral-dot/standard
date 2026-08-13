-- STDTEX current production policy DDL extractor
-- Run read-only against production to regenerate exact CREATE POLICY statements.
-- This file is versioned because current_production_schema.sql originally lacked
-- materialized policy DDL. It should be used to create the policy section of an
-- empty-environment bootstrap before replay.
--
-- This query does not modify the database.

with policies as (
  select
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check,
    format(
      'create policy %I on %I.%I as permissive for %s to %s%s%s;',
      policyname,
      schemaname,
      tablename,
      case cmd
        when 'ALL' then 'all'
        when 'SELECT' then 'select'
        when 'INSERT' then 'insert'
        when 'UPDATE' then 'update'
        when 'DELETE' then 'delete'
        else lower(cmd)
      end,
      array_to_string(array(select quote_ident(r) from unnest(roles) as r), ', '),
      case when qual is null then '' else E'\nusing (' || qual || ')' end,
      case when with_check is null then '' else E'\nwith check (' || with_check || ')' end
    ) as ddl
  from pg_policies
  where schemaname = 'public'
)
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check,
  ddl
from policies
order by tablename, policyname;

