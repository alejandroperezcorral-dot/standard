alter table public.cost_config_versions
  add column if not exists semantic_validation_hash text;

create or replace function private.costing_validation_canonical_payload(p_config_version_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'modelCode', cm.code,
    'formulaVersion', ccv.formula_version,
    'baseConfig', ccv.base_config,
    'overrides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seasonKey', co.season_key,
        'originKey', co.origin_key,
        'categoryKey', co.category_key,
        'values', co.values
      ) order by co.season_key, co.origin_key, co.category_key)
      from public.cost_config_overrides co
      where co.config_version_id = ccv.id
    ), '[]'::jsonb),
    'additionalComponents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', cac.name,
        'calculationType', cac.calculation_type,
        'value', cac.value,
        'currency', cac.currency,
        'percentageBasis', cac.percentage_basis,
        'enabled', cac.enabled,
        'seasonKey', cac.season_key,
        'originKey', cac.origin_key,
        'categoryKey', cac.category_key
      ) order by cac.name, cac.calculation_type, cac.value, cac.currency, cac.percentage_basis, cac.enabled, cac.season_key, cac.origin_key, cac.category_key)
      from public.cost_additional_components cac
      where cac.config_version_id = ccv.id
    ), '[]'::jsonb)
  ))
  from public.cost_config_versions ccv
  join public.cost_models cm on cm.id = ccv.cost_model_id
  where ccv.id = p_config_version_id
$function$;

create or replace function private.costing_current_validation_hash(p_config_version_id uuid)
returns text
language sql
security definer
set search_path = ''
as $function$
  select encode(extensions.digest(convert_to(private.costing_validation_canonical_payload(p_config_version_id)::text, 'UTF8'), 'sha256'), 'hex')
$function$;

create or replace function private.costing_reset_semantic_validation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_setting('stdtex.costing_command', true) = '1' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (
    new.base_config is distinct from old.base_config
    or new.cost_model_id is distinct from old.cost_model_id
    or new.formula_version is distinct from old.formula_version
  ) then
    new.semantic_validation_status := 'NOT_VALIDATED';
    new.semantic_validated_at := null;
    new.semantic_validated_by := null;
    new.semantic_validation_result := null;
    new.semantic_validation_hash := null;
  end if;
  return new;
end;
$function$;

create or replace function private.costing_invalidate_parent_semantic_validation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_config_version_id uuid;
begin
  if current_setting('stdtex.costing_command', true) = '1' then
    return coalesce(new, old);
  end if;

  v_config_version_id := coalesce(new.config_version_id, old.config_version_id);
  if v_config_version_id is null then
    return coalesce(new, old);
  end if;

  perform set_config('stdtex.costing_command', '1', true);
  update public.cost_config_versions
  set semantic_validation_status = 'NOT_VALIDATED',
      semantic_validated_at = null,
      semantic_validated_by = null,
      semantic_validation_result = null,
      semantic_validation_hash = null,
      updated_at = now()
  where id = v_config_version_id
    and lifecycle_status = 'DRAFT';

  return coalesce(new, old);
end;
$function$;

drop trigger if exists cost_config_overrides_invalidate_semantic_validation on public.cost_config_overrides;
create trigger cost_config_overrides_invalidate_semantic_validation
after insert or update or delete on public.cost_config_overrides
for each row execute function private.costing_invalidate_parent_semantic_validation();

drop trigger if exists cost_additional_components_invalidate_semantic_validation on public.cost_additional_components;
create trigger cost_additional_components_invalidate_semantic_validation
after insert or update or delete on public.cost_additional_components
for each row execute function private.costing_invalidate_parent_semantic_validation();

create or replace function public.mark_cost_config_semantically_validated(
  p_config_version_id uuid,
  p_formula_version integer,
  p_validation_result jsonb default '{}'::jsonb
)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_config public.cost_config_versions%rowtype;
  v_hash text;
begin
  select *
  into v_config
  from public.cost_config_versions
  where id = p_config_version_id
  for update;

  if not found then
    raise exception 'Cost config not found';
  end if;

  if v_config.lifecycle_status <> 'DRAFT' then
    raise exception 'Only draft cost configs may be marked validated';
  end if;

  if p_formula_version <> v_config.formula_version then
    raise exception 'Semantic validation formula version mismatch';
  end if;

  if p_validation_result is null or jsonb_typeof(p_validation_result) <> 'object' then
    raise exception 'Validation result must be a JSON object';
  end if;

  v_hash := private.costing_current_validation_hash(p_config_version_id);
  if v_hash is null then
    raise exception 'Semantic validation hash could not be computed';
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  update public.cost_config_versions
  set semantic_validation_status = 'VALID',
      semantic_validated_at = now(),
      semantic_validated_by = auth.uid(),
      semantic_validation_result = p_validation_result,
      semantic_validation_hash = v_hash,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_config_version_id
  returning * into v_config;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_config.semantic_validated',
    auth.uid(),
    v_config.company_id,
    'cost_config_versions',
    v_config.id::text,
    jsonb_build_object('formula_version', p_formula_version, 'validation_result', p_validation_result),
    'Costing domain service marked config as semantically validated'
  );

  return v_config;
end;
$function$;

revoke all on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) from public;
revoke all on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) from anon;
revoke all on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) from authenticated;
grant execute on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) to service_role;

create or replace function public.activate_cost_config(p_config_version_id uuid)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_config public.cost_config_versions%rowtype;
  v_model public.cost_models%rowtype;
  v_previous_active_id uuid;
  v_current_hash text;
begin
  select *
  into v_config
  from public.cost_config_versions
  where id = p_config_version_id
  for update;

  if not found then
    raise exception 'Cost config not found';
  end if;

  perform private.costing_assert_can_manage_company(v_config.company_id);

  if v_config.lifecycle_status <> 'DRAFT' then
    raise exception 'Only draft cost configs may be activated';
  end if;

  select *
  into v_model
  from public.cost_models
  where id = v_config.cost_model_id
  for share;

  if not found or v_model.status <> 'AVAILABLE' then
    raise exception 'Cost model is not available';
  end if;

  if v_model.current_formula_version is distinct from v_config.formula_version then
    raise exception 'Cost config formula version is not current for the selected model';
  end if;

  if v_config.semantic_validation_status <> 'VALID' or v_config.semantic_validation_hash is null then
    raise exception 'SEMANTIC_VALIDATION_STALE';
  end if;

  v_current_hash := private.costing_current_validation_hash(v_config.id);
  if v_current_hash is null or v_current_hash is distinct from v_config.semantic_validation_hash then
    raise exception 'SEMANTIC_VALIDATION_STALE';
  end if;

  perform 1
  from public.company_costing_settings ccs
  where ccs.company_id = v_config.company_id
  for update;

  perform set_config('stdtex.costing_command', '1', true);

  select id
  into v_previous_active_id
  from public.cost_config_versions
  where company_id = v_config.company_id
    and cost_model_id = v_config.cost_model_id
    and lifecycle_status = 'ACTIVE'
  for update;

  if v_previous_active_id is not null then
    update public.cost_config_versions
    set lifecycle_status = 'ARCHIVED',
        archived_by = auth.uid(),
        archived_at = now(),
        updated_by = auth.uid(),
        updated_at = now()
    where id = v_previous_active_id;
  end if;

  update public.cost_config_versions
  set lifecycle_status = 'ACTIVE',
      activated_by = auth.uid(),
      activated_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_config.id
  returning * into v_config;

  insert into public.company_costing_settings (
    company_id,
    cost_source_type,
    active_cost_model_id,
    active_config_version_id,
    fallback_behavior,
    updated_by,
    updated_at
  ) values (
    v_config.company_id,
    'STDTEX_MODEL',
    v_config.cost_model_id,
    v_config.id,
    'FOB_ONLY',
    auth.uid(),
    now()
  )
  on conflict (company_id) do update
  set cost_source_type = 'STDTEX_MODEL',
      active_cost_model_id = excluded.active_cost_model_id,
      active_config_version_id = excluded.active_config_version_id,
      fallback_behavior = excluded.fallback_behavior,
      updated_by = excluded.updated_by,
      updated_at = now();

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, previous_value, new_value, reason
  ) values (
    'cost_config.activated',
    auth.uid(),
    v_config.company_id,
    'cost_config_versions',
    v_config.id::text,
    jsonb_build_object('previous_active_config_version_id', v_previous_active_id),
    jsonb_build_object('active_config_version_id', v_config.id, 'cost_model_id', v_config.cost_model_id),
    'Company costing config activated atomically through controlled RPC'
  );

  return v_config;
end;
$function$;

grant execute on function public.activate_cost_config(uuid) to authenticated;
grant execute on function public.activate_cost_config(uuid) to service_role;
