-- STDTEX Company Costing Settings V1
-- STAGING MIGRATION DRAFT
-- REVIEW BEFORE EXECUTION
-- DO NOT APPLY TO PRODUCTION
--
-- This migration draft creates dormant costing configuration infrastructure.
-- It does not modify negotiation_rows, current costing runtime, UI, routes,
-- existing product data, existing companies, or existing collections.
--
-- Execution status:
--   DRAFT ONLY. Do not execute against staging or production until approved.
--
-- Key product guarantees:
--   - No company is auto-enabled.
--   - FOB_ONLY remains the safe default.
--   - Cost formulas remain in domain code, not PostgreSQL.
--   - Company-owned configuration lives in versioned data.
--   - ACTIVE and ARCHIVED configs are immutable outside controlled commands.

begin;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('private.current_is_platform_admin()') is null then
    raise exception 'Required helper private.current_is_platform_admin() is missing';
  end if;

  if to_regprocedure('private.current_is_company_admin_for(uuid)') is null then
    raise exception 'Required helper private.current_is_company_admin_for(uuid) is missing';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.cost_models (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  source_type text not null,
  status text not null default 'AVAILABLE',
  current_formula_version integer,
  template_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cost_models_code_key unique (code),
  constraint cost_models_code_not_blank check (length(btrim(code)) > 0),
  constraint cost_models_name_not_blank check (length(btrim(name)) > 0),
  constraint cost_models_source_type_check check (
    source_type in ('STDTEX_MODEL', 'ERP', 'COMPANY_API', 'THIRD_PARTY')
  ),
  constraint cost_models_status_check check (
    status in ('AVAILABLE', 'DEPRECATED', 'DISABLED')
  ),
  constraint cost_models_formula_version_check check (
    current_formula_version is null or current_formula_version > 0
  ),
  constraint cost_models_template_key_check check (
    template_key is null or length(btrim(template_key)) > 0
  )
);

comment on table public.cost_models is
  'Platform catalog of selectable costing model identities. No formula code is stored here.';
comment on column public.cost_models.code is
  'Stable domain implementation code, e.g. cost-model-001.';
comment on column public.cost_models.current_formula_version is
  'Formula implementation version, not a configuration version.';
comment on column public.cost_models.template_key is
  'Application/domain template key used by backend services to instantiate complete company drafts.';

create table public.cost_config_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cost_model_id uuid not null references public.cost_models(id) on delete restrict,
  formula_version integer not null,
  config_code text not null,
  config_label text not null,
  lifecycle_status text not null default 'DRAFT',
  base_config jsonb not null,
  based_on_config_version_id uuid references public.cost_config_versions(id) on delete set null,
  season_key text,
  effective_from timestamptz,
  effective_to timestamptz,
  semantic_validation_status text not null default 'NOT_VALIDATED',
  semantic_validated_at timestamptz,
  semantic_validated_by uuid references auth.users(id) on delete set null,
  semantic_validation_result jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  source_reference text,
  notes text,

  constraint cost_config_versions_formula_version_check check (formula_version > 0),
  constraint cost_config_versions_config_code_not_blank check (length(btrim(config_code)) > 0),
  constraint cost_config_versions_config_label_not_blank check (length(btrim(config_label)) > 0),
  constraint cost_config_versions_lifecycle_status_check check (
    lifecycle_status in ('DRAFT', 'ACTIVE', 'ARCHIVED')
  ),
  constraint cost_config_versions_base_config_object check (
    jsonb_typeof(base_config) = 'object'
  ),
  constraint cost_config_versions_semantic_validation_status_check check (
    semantic_validation_status in ('NOT_VALIDATED', 'VALID', 'INVALID')
  ),
  constraint cost_config_versions_validation_result_object check (
    semantic_validation_result is null
    or jsonb_typeof(semantic_validation_result) = 'object'
  ),
  constraint cost_config_versions_validated_at_check check (
    (semantic_validation_status = 'VALID' and semantic_validated_at is not null)
    or semantic_validation_status <> 'VALID'
  ),
  constraint cost_config_versions_season_normalized check (
    season_key is null or season_key = upper(btrim(season_key))
  ),
  constraint cost_config_versions_effective_range_check check (
    effective_from is null or effective_to is null or effective_from < effective_to
  ),
  constraint cost_config_versions_company_model_code_key unique (
    company_id,
    cost_model_id,
    config_code
  )
);

comment on table public.cost_config_versions is
  'Company-owned versioned assumption snapshots. Formula version and config version are deliberately separate.';
comment on column public.cost_config_versions.lifecycle_status is
  'DRAFT is editable through commands. ACTIVE and ARCHIVED are immutable except controlled lifecycle transitions.';
comment on column public.cost_config_versions.semantic_validation_status is
  'Domain/service validation state. SQL enforces structure; Cost Model variable semantics stay in domain code.';

create unique index cost_config_versions_one_active_per_company_model
  on public.cost_config_versions(company_id, cost_model_id)
  where lifecycle_status = 'ACTIVE';

create index cost_config_versions_company_model_status_idx
  on public.cost_config_versions(company_id, cost_model_id, lifecycle_status);

create index cost_config_versions_company_status_idx
  on public.cost_config_versions(company_id, lifecycle_status);

create index cost_config_versions_cost_model_id_idx
  on public.cost_config_versions(cost_model_id);

create table public.company_costing_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  cost_source_type text not null default 'FOB_ONLY',
  active_cost_model_id uuid references public.cost_models(id) on delete restrict,
  active_config_version_id uuid references public.cost_config_versions(id) on delete restrict,
  fallback_behavior text not null default 'FOB_ONLY',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint company_costing_settings_source_type_check check (
    cost_source_type in ('FOB_ONLY', 'STDTEX_MODEL', 'ERP', 'COMPANY_API', 'THIRD_PARTY')
  ),
  constraint company_costing_settings_fallback_check check (
    fallback_behavior in ('FOB_ONLY', 'NOT_AVAILABLE', 'CODE_DEFAULT_DURING_MIGRATION')
  ),
  constraint company_costing_settings_local_model_required check (
    (
      cost_source_type = 'STDTEX_MODEL'
      and active_cost_model_id is not null
      and active_config_version_id is not null
    )
    or (
      cost_source_type <> 'STDTEX_MODEL'
      and active_cost_model_id is null
      and active_config_version_id is null
    )
  )
);

comment on table public.company_costing_settings is
  'One active costing choice per company. FOB_ONLY/ERP/API sources are not forced into local config versions.';

create index company_costing_settings_source_idx
  on public.company_costing_settings(cost_source_type);

create index company_costing_settings_active_model_idx
  on public.company_costing_settings(active_cost_model_id)
  where active_cost_model_id is not null;

create index company_costing_settings_active_config_idx
  on public.company_costing_settings(active_config_version_id)
  where active_config_version_id is not null;

create table public.cost_config_overrides (
  id uuid primary key default gen_random_uuid(),
  config_version_id uuid not null references public.cost_config_versions(id) on delete cascade,
  season_key text not null,
  origin_key text not null,
  category_key text not null,
  values jsonb not null,
  source_reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint cost_config_overrides_values_object check (
    jsonb_typeof(values) = 'object'
  ),
  constraint cost_config_overrides_season_not_blank check (length(btrim(season_key)) > 0),
  constraint cost_config_overrides_origin_not_blank check (length(btrim(origin_key)) > 0),
  constraint cost_config_overrides_category_not_blank check (length(btrim(category_key)) > 0),
  constraint cost_config_overrides_season_normalized check (season_key = upper(btrim(season_key))),
  constraint cost_config_overrides_origin_normalized check (origin_key = upper(btrim(origin_key))),
  constraint cost_config_overrides_category_trimmed check (category_key = btrim(category_key)),
  constraint cost_config_overrides_exact_scope_key unique (
    config_version_id,
    season_key,
    origin_key,
    category_key
  )
);

comment on table public.cost_config_overrides is
  'Partial values applied over a config snapshot for the proven V1 scope: season + origin + category.';
comment on column public.cost_config_overrides.values is
  'Partial override payload. Allowed keys and types are validated by command/domain layer, not SQL formulas.';

create index cost_config_overrides_lookup_idx
  on public.cost_config_overrides(config_version_id, season_key, origin_key, category_key);

create table public.cost_additional_components (
  id uuid primary key default gen_random_uuid(),
  config_version_id uuid not null references public.cost_config_versions(id) on delete cascade,
  name text not null,
  calculation_type text not null,
  value numeric not null,
  currency text,
  percentage_basis text,
  enabled boolean not null default true,
  season_key text,
  origin_key text,
  category_key text,
  source_reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint cost_additional_components_name_not_blank check (length(btrim(name)) > 0),
  constraint cost_additional_components_calculation_type_check check (
    calculation_type in ('FIXED_PER_UNIT', 'PERCENTAGE_OF_BASE')
  ),
  constraint cost_additional_components_value_check check (value >= 0),
  constraint cost_additional_components_currency_check check (
    currency is null or currency = upper(btrim(currency))
  ),
  constraint cost_additional_components_percentage_basis_check check (
    percentage_basis is null
    or percentage_basis in ('FOB', 'FOB_PLUS_FREIGHT', 'LANDED_BEFORE_ADDITIONAL_COSTS')
  ),
  constraint cost_additional_components_percentage_requires_basis check (
    (calculation_type = 'PERCENTAGE_OF_BASE' and percentage_basis is not null)
    or (calculation_type <> 'PERCENTAGE_OF_BASE')
  ),
  constraint cost_additional_components_season_normalized check (
    season_key is null or season_key = upper(btrim(season_key))
  ),
  constraint cost_additional_components_origin_normalized check (
    origin_key is null or origin_key = upper(btrim(origin_key))
  ),
  constraint cost_additional_components_category_trimmed check (
    category_key is null or category_key = btrim(category_key)
  )
);

comment on table public.cost_additional_components is
  'Optional safe structured costs. No raw formulas, JavaScript, SQL or expression strings.';

create index cost_additional_components_config_enabled_idx
  on public.cost_additional_components(config_version_id)
  where enabled = true;

create index cost_additional_components_scope_idx
  on public.cost_additional_components(config_version_id, season_key, origin_key, category_key);

-- ---------------------------------------------------------------------------
-- RLS and grants: default deny, authenticated reads only where explicitly scoped
-- ---------------------------------------------------------------------------

alter table public.cost_models enable row level security;
alter table public.company_costing_settings enable row level security;
alter table public.cost_config_versions enable row level security;
alter table public.cost_config_overrides enable row level security;
alter table public.cost_additional_components enable row level security;

revoke all on table public.cost_models from public;
revoke all on table public.company_costing_settings from public;
revoke all on table public.cost_config_versions from public;
revoke all on table public.cost_config_overrides from public;
revoke all on table public.cost_additional_components from public;

revoke all on table public.cost_models from anon;
revoke all on table public.company_costing_settings from anon;
revoke all on table public.cost_config_versions from anon;
revoke all on table public.cost_config_overrides from anon;
revoke all on table public.cost_additional_components from anon;

grant select on table public.cost_models to authenticated;
grant select on table public.company_costing_settings to authenticated;
grant select on table public.cost_config_versions to authenticated;
grant select on table public.cost_config_overrides to authenticated;
grant select on table public.cost_additional_components to authenticated;

create policy cost_models_platform_admin_select
on public.cost_models
for select
to authenticated
using (
  private.current_is_platform_admin()
  or exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.membership_status = 'Active'
      and cm.access_role = 'Company Admin'
  )
);

create policy company_costing_settings_admin_select
on public.company_costing_settings
for select
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
);

create policy cost_config_versions_admin_select
on public.cost_config_versions
for select
to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_company_admin_for(company_id)
);

create policy cost_config_overrides_admin_select
on public.cost_config_overrides
for select
to authenticated
using (
  private.current_is_platform_admin()
  or exists (
    select 1
    from public.cost_config_versions ccv
    where ccv.id = cost_config_overrides.config_version_id
      and private.current_is_company_admin_for(ccv.company_id)
  )
);

create policy cost_additional_components_admin_select
on public.cost_additional_components
for select
to authenticated
using (
  private.current_is_platform_admin()
  or exists (
    select 1
    from public.cost_config_versions ccv
    where ccv.id = cost_additional_components.config_version_id
      and private.current_is_company_admin_for(ccv.company_id)
  )
);

-- ---------------------------------------------------------------------------
-- Private helpers and triggers
-- ---------------------------------------------------------------------------

create or replace function private.costing_command_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(current_setting('stdtex.costing_command', true), '') = '1';
$$;

create or replace function private.normalize_costing_upper_key(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(btrim(raw_value)), '');
$$;

create or replace function private.normalize_costing_trim_key(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(raw_value), '');
$$;

create or replace function private.current_can_manage_costing_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_company_id is not null
    and (
      private.current_is_platform_admin()
      or private.current_is_company_admin_for(target_company_id)
    );
$$;

create or replace function private.costing_assert_can_manage_company(target_company_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.current_can_manage_costing_company(target_company_id) then
    raise exception 'Company Admin access required';
  end if;
end;
$$;

create or replace function private.costing_reset_semantic_validation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.base_config is distinct from old.base_config
       or new.formula_version is distinct from old.formula_version
       or new.cost_model_id is distinct from old.cost_model_id then
      new.semantic_validation_status := 'NOT_VALIDATED';
      new.semantic_validated_at := null;
      new.semantic_validated_by := null;
      new.semantic_validation_result := null;
    end if;
    new.updated_at := now();
  end if;

  new.config_code := upper(btrim(new.config_code));
  new.config_label := btrim(new.config_label);
  new.season_key := private.normalize_costing_upper_key(new.season_key);

  return new;
end;
$$;

create or replace function private.costing_prevent_locked_config_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.lifecycle_status in ('ACTIVE', 'ARCHIVED')
     and not private.costing_command_is_active() then
    raise exception 'Active or archived cost configs are immutable';
  end if;

  if old.lifecycle_status in ('ACTIVE', 'ARCHIVED')
     and private.costing_command_is_active()
     and (
       new.company_id is distinct from old.company_id
       or new.cost_model_id is distinct from old.cost_model_id
       or new.formula_version is distinct from old.formula_version
       or new.config_code is distinct from old.config_code
       or new.base_config is distinct from old.base_config
       or new.based_on_config_version_id is distinct from old.based_on_config_version_id
       or new.season_key is distinct from old.season_key
       or new.effective_from is distinct from old.effective_from
       or new.effective_to is distinct from old.effective_to
     ) then
    raise exception 'Lifecycle command cannot mutate locked cost config assumptions';
  end if;

  return new;
end;
$$;

create or replace function private.costing_prevent_locked_config_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.lifecycle_status <> 'DRAFT' then
    raise exception 'Only draft cost configs may be deleted';
  end if;
  return old;
end;
$$;

create or replace function private.costing_normalize_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.season_key := private.normalize_costing_upper_key(new.season_key);
  new.origin_key := private.normalize_costing_upper_key(new.origin_key);
  new.category_key := private.normalize_costing_trim_key(new.category_key);

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create or replace function private.costing_normalize_component()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.currency := private.normalize_costing_upper_key(new.currency);
  new.season_key := private.normalize_costing_upper_key(new.season_key);
  new.origin_key := private.normalize_costing_upper_key(new.origin_key);
  new.category_key := private.normalize_costing_trim_key(new.category_key);

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create or replace function private.costing_assert_parent_config_is_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select ccv.lifecycle_status
  into v_status
  from public.cost_config_versions ccv
  where ccv.id = case
    when tg_op = 'DELETE' then old.config_version_id
    else new.config_version_id
  end;

  if v_status is distinct from 'DRAFT' then
    raise exception 'Cost config child records can only be changed for draft configs';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function private.costing_validate_company_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config record;
begin
  new.updated_at := now();

  if new.cost_source_type = 'STDTEX_MODEL' then
    select ccv.company_id, ccv.cost_model_id, ccv.lifecycle_status
    into v_config
    from public.cost_config_versions ccv
    where ccv.id = new.active_config_version_id;

    if not found then
      raise exception 'Active cost config not found';
    end if;

    if v_config.company_id <> new.company_id then
      raise exception 'Active cost config belongs to another company';
    end if;

    if v_config.cost_model_id <> new.active_cost_model_id then
      raise exception 'Active cost config belongs to another cost model';
    end if;

    if v_config.lifecycle_status <> 'ACTIVE' then
      raise exception 'Active config version must have ACTIVE lifecycle status';
    end if;
  end if;

  return new;
end;
$$;

create trigger cost_config_versions_normalize_before_write
before insert or update on public.cost_config_versions
for each row execute function private.costing_reset_semantic_validation();

create trigger cost_config_versions_locked_update_guard
before update on public.cost_config_versions
for each row execute function private.costing_prevent_locked_config_update();

create trigger cost_config_versions_locked_delete_guard
before delete on public.cost_config_versions
for each row execute function private.costing_prevent_locked_config_delete();

create trigger cost_config_overrides_normalize_before_write
before insert or update on public.cost_config_overrides
for each row execute function private.costing_normalize_override();

create trigger cost_config_overrides_draft_parent_guard
before insert or update or delete on public.cost_config_overrides
for each row execute function private.costing_assert_parent_config_is_draft();

create trigger cost_additional_components_normalize_before_write
before insert or update on public.cost_additional_components
for each row execute function private.costing_normalize_component();

create trigger cost_additional_components_draft_parent_guard
before insert or update or delete on public.cost_additional_components
for each row execute function private.costing_assert_parent_config_is_draft();

create trigger company_costing_settings_validate_before_write
before insert or update on public.company_costing_settings
for each row execute function private.costing_validate_company_settings();

-- ---------------------------------------------------------------------------
-- Command RPCs
-- ---------------------------------------------------------------------------

create or replace function public.set_company_cost_source(
  p_company_id uuid,
  p_cost_source_type text,
  p_cost_model_code text default null,
  p_active_config_version_id uuid default null,
  p_fallback_behavior text default 'FOB_ONLY'
)
returns public.company_costing_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text := upper(btrim(coalesce(p_cost_source_type, 'FOB_ONLY')));
  v_fallback text := upper(btrim(coalesce(p_fallback_behavior, 'FOB_ONLY')));
  v_model_id uuid;
  v_settings public.company_costing_settings%rowtype;
begin
  perform private.costing_assert_can_manage_company(p_company_id);

  if v_source not in ('FOB_ONLY', 'STDTEX_MODEL', 'ERP', 'COMPANY_API', 'THIRD_PARTY') then
    raise exception 'Unsupported cost source type';
  end if;

  if v_source = 'STDTEX_MODEL' then
    select id
    into v_model_id
    from public.cost_models
    where code = btrim(coalesce(p_cost_model_code, ''))
      and source_type = 'STDTEX_MODEL'
      and status = 'AVAILABLE';

    if not found then
      raise exception 'Available STDTEX cost model not found';
    end if;

    if p_active_config_version_id is null then
      raise exception 'Active config version is required for STDTEX_MODEL';
    end if;
  else
    v_model_id := null;
    p_active_config_version_id := null;
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  insert into public.company_costing_settings (
    company_id,
    cost_source_type,
    active_cost_model_id,
    active_config_version_id,
    fallback_behavior,
    updated_by,
    updated_at
  ) values (
    p_company_id,
    v_source,
    v_model_id,
    p_active_config_version_id,
    v_fallback,
    auth.uid(),
    now()
  )
  on conflict (company_id) do update
  set cost_source_type = excluded.cost_source_type,
      active_cost_model_id = excluded.active_cost_model_id,
      active_config_version_id = excluded.active_config_version_id,
      fallback_behavior = excluded.fallback_behavior,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning * into v_settings;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_source.changed',
    auth.uid(),
    p_company_id,
    'company_costing_settings',
    p_company_id::text,
    jsonb_build_object(
      'cost_source_type', v_settings.cost_source_type,
      'active_cost_model_id', v_settings.active_cost_model_id,
      'active_config_version_id', v_settings.active_config_version_id,
      'fallback_behavior', v_settings.fallback_behavior
    ),
    'Company costing source changed through controlled RPC'
  );

  return v_settings;
end;
$$;

create or replace function public.create_cost_config_draft(
  p_company_id uuid,
  p_cost_model_code text,
  p_config_code text,
  p_config_label text,
  p_base_config jsonb default null,
  p_based_on_config_version_id uuid default null,
  p_season_key text default null,
  p_source_reference text default null,
  p_notes text default null
)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_model public.cost_models%rowtype;
  v_based_on public.cost_config_versions%rowtype;
  v_config public.cost_config_versions%rowtype;
  v_base_config jsonb;
begin
  perform private.costing_assert_can_manage_company(p_company_id);

  select *
  into v_model
  from public.cost_models
  where code = btrim(coalesce(p_cost_model_code, ''))
    and source_type = 'STDTEX_MODEL'
    and status = 'AVAILABLE';

  if not found then
    raise exception 'Available STDTEX cost model not found';
  end if;

  if p_based_on_config_version_id is not null then
    select *
    into v_based_on
    from public.cost_config_versions
    where id = p_based_on_config_version_id
    for share;

    if not found then
      raise exception 'Base config version not found';
    end if;

    if v_based_on.company_id <> p_company_id then
      raise exception 'Base config belongs to another company';
    end if;

    if v_based_on.cost_model_id <> v_model.id then
      raise exception 'Base config belongs to another cost model';
    end if;

    v_base_config := v_based_on.base_config;
  else
    v_base_config := p_base_config;
  end if;

  if v_base_config is null or jsonb_typeof(v_base_config) <> 'object' then
    raise exception 'Draft base_config must be a JSON object supplied by validated domain code';
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  insert into public.cost_config_versions (
    company_id,
    cost_model_id,
    formula_version,
    config_code,
    config_label,
    lifecycle_status,
    base_config,
    based_on_config_version_id,
    season_key,
    created_by,
    updated_by,
    source_reference,
    notes
  ) values (
    p_company_id,
    v_model.id,
    v_model.current_formula_version,
    p_config_code,
    p_config_label,
    'DRAFT',
    v_base_config,
    p_based_on_config_version_id,
    p_season_key,
    auth.uid(),
    auth.uid(),
    p_source_reference,
    p_notes
  )
  returning * into v_config;

  if p_based_on_config_version_id is not null then
    insert into public.cost_config_overrides (
      config_version_id, season_key, origin_key, category_key, values,
      source_reference, created_by, updated_by
    )
    select
      v_config.id, season_key, origin_key, category_key, values,
      source_reference, auth.uid(), auth.uid()
    from public.cost_config_overrides
    where config_version_id = p_based_on_config_version_id;

    insert into public.cost_additional_components (
      config_version_id, name, calculation_type, value, currency, percentage_basis,
      enabled, season_key, origin_key, category_key, source_reference, created_by, updated_by
    )
    select
      v_config.id, name, calculation_type, value, currency, percentage_basis,
      enabled, season_key, origin_key, category_key, source_reference, auth.uid(), auth.uid()
    from public.cost_additional_components
    where config_version_id = p_based_on_config_version_id;
  end if;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_config.created',
    auth.uid(),
    p_company_id,
    'cost_config_versions',
    v_config.id::text,
    jsonb_build_object('config_code', v_config.config_code, 'cost_model_id', v_config.cost_model_id),
    'Company costing draft created through controlled RPC'
  );

  return v_config;
end;
$$;

create or replace function public.duplicate_cost_config(
  p_config_version_id uuid,
  p_new_config_code text,
  p_new_config_label text
)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.cost_config_versions%rowtype;
begin
  select *
  into v_source
  from public.cost_config_versions
  where id = p_config_version_id
  for share;

  if not found then
    raise exception 'Cost config not found';
  end if;

  return public.create_cost_config_draft(
    v_source.company_id,
    (select cm.code from public.cost_models cm where cm.id = v_source.cost_model_id),
    p_new_config_code,
    p_new_config_label,
    null,
    p_config_version_id,
    v_source.season_key,
    v_source.source_reference,
    v_source.notes
  );
end;
$$;

create or replace function public.update_cost_config_draft(
  p_config_version_id uuid,
  p_patch jsonb
)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.cost_config_versions%rowtype;
  v_forbidden text[] := array[
    'id', 'company_id', 'cost_model_id', 'formula_version', 'created_by',
    'activated_by', 'archived_by', 'lifecycle_status'
  ];
  v_key text;
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
    raise exception 'Only draft cost configs may be updated';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Patch must be a JSON object';
  end if;

  foreach v_key in array v_forbidden loop
    if p_patch ? v_key then
      raise exception 'Forbidden patch field: %', v_key;
    end if;
  end loop;

  perform set_config('stdtex.costing_command', '1', true);

  update public.cost_config_versions
  set base_config = base_config || p_patch,
      updated_by = auth.uid(),
      updated_at = now(),
      semantic_validation_status = 'NOT_VALIDATED',
      semantic_validated_at = null,
      semantic_validated_by = null,
      semantic_validation_result = null
  where id = p_config_version_id
  returning * into v_config;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_config.updated',
    auth.uid(),
    v_config.company_id,
    'cost_config_versions',
    v_config.id::text,
    jsonb_build_object('patch_keys', (select jsonb_agg(k) from jsonb_object_keys(p_patch) as keys(k))),
    'Company costing draft updated through controlled RPC'
  );

  return v_config;
end;
$$;

create or replace function public.upsert_cost_override(
  p_config_version_id uuid,
  p_season_key text,
  p_origin_key text,
  p_category_key text,
  p_values jsonb,
  p_source_reference text default null
)
returns public.cost_config_overrides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.cost_config_versions%rowtype;
  v_override public.cost_config_overrides%rowtype;
  v_season text := private.normalize_costing_upper_key(p_season_key);
  v_origin text := private.normalize_costing_upper_key(p_origin_key);
  v_category text := private.normalize_costing_trim_key(p_category_key);
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
    raise exception 'Only draft cost configs may receive overrides';
  end if;

  if v_season is null or v_origin is null or v_category is null then
    raise exception 'Override requires season, origin and category';
  end if;

  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'Override values must be a JSON object';
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  insert into public.cost_config_overrides (
    config_version_id,
    season_key,
    origin_key,
    category_key,
    values,
    source_reference,
    created_by,
    updated_by
  ) values (
    p_config_version_id,
    v_season,
    v_origin,
    v_category,
    p_values,
    p_source_reference,
    auth.uid(),
    auth.uid()
  )
  on conflict (config_version_id, season_key, origin_key, category_key) do update
  set values = excluded.values,
      source_reference = excluded.source_reference,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning * into v_override;

  update public.cost_config_versions
  set semantic_validation_status = 'NOT_VALIDATED',
      semantic_validated_at = null,
      semantic_validated_by = null,
      semantic_validation_result = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_config_version_id;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_override.upserted',
    auth.uid(),
    v_config.company_id,
    'cost_config_overrides',
    v_override.id::text,
    jsonb_build_object('season_key', v_season, 'origin_key', v_origin, 'category_key', v_category),
    'Company costing override upserted through controlled RPC'
  );

  return v_override;
end;
$$;

create or replace function public.remove_cost_override(
  p_override_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_override public.cost_config_overrides%rowtype;
  v_config public.cost_config_versions%rowtype;
begin
  select *
  into v_override
  from public.cost_config_overrides
  where id = p_override_id
  for update;

  if not found then
    raise exception 'Cost override not found';
  end if;

  select *
  into v_config
  from public.cost_config_versions
  where id = v_override.config_version_id
  for update;

  perform private.costing_assert_can_manage_company(v_config.company_id);

  if v_config.lifecycle_status <> 'DRAFT' then
    raise exception 'Only draft cost config overrides may be removed';
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  delete from public.cost_config_overrides
  where id = p_override_id;

  update public.cost_config_versions
  set semantic_validation_status = 'NOT_VALIDATED',
      semantic_validated_at = null,
      semantic_validated_by = null,
      semantic_validation_result = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_config.id;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, previous_value, reason
  ) values (
    'cost_override.removed',
    auth.uid(),
    v_config.company_id,
    'cost_config_overrides',
    p_override_id::text,
    to_jsonb(v_override),
    'Company costing override removed through controlled RPC'
  );

  return jsonb_build_object('status', 'removed', 'override_id', p_override_id);
end;
$$;

create or replace function public.add_cost_component(
  p_config_version_id uuid,
  p_component jsonb
)
returns public.cost_additional_components
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.cost_config_versions%rowtype;
  v_component public.cost_additional_components%rowtype;
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
    raise exception 'Only draft cost configs may receive additional costs';
  end if;

  if p_component is null or jsonb_typeof(p_component) <> 'object' then
    raise exception 'Component must be a JSON object';
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  insert into public.cost_additional_components (
    config_version_id,
    name,
    calculation_type,
    value,
    currency,
    percentage_basis,
    enabled,
    season_key,
    origin_key,
    category_key,
    source_reference,
    created_by,
    updated_by
  ) values (
    p_config_version_id,
    p_component ->> 'name',
    p_component ->> 'calculation_type',
    (p_component ->> 'value')::numeric,
    p_component ->> 'currency',
    p_component ->> 'percentage_basis',
    coalesce((p_component ->> 'enabled')::boolean, true),
    p_component ->> 'season_key',
    p_component ->> 'origin_key',
    p_component ->> 'category_key',
    p_component ->> 'source_reference',
    auth.uid(),
    auth.uid()
  )
  returning * into v_component;

  update public.cost_config_versions
  set semantic_validation_status = 'NOT_VALIDATED',
      semantic_validated_at = null,
      semantic_validated_by = null,
      semantic_validation_result = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_config_version_id;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_component.added',
    auth.uid(),
    v_config.company_id,
    'cost_additional_components',
    v_component.id::text,
    to_jsonb(v_component),
    'Company costing component added through controlled RPC'
  );

  return v_component;
end;
$$;

create or replace function public.update_cost_component(
  p_component_id uuid,
  p_patch jsonb
)
returns public.cost_additional_components
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_component public.cost_additional_components%rowtype;
  v_config public.cost_config_versions%rowtype;
begin
  select *
  into v_component
  from public.cost_additional_components
  where id = p_component_id
  for update;

  if not found then
    raise exception 'Cost component not found';
  end if;

  select *
  into v_config
  from public.cost_config_versions
  where id = v_component.config_version_id
  for update;

  perform private.costing_assert_can_manage_company(v_config.company_id);

  if v_config.lifecycle_status <> 'DRAFT' then
    raise exception 'Only draft cost config components may be updated';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Component patch must be a JSON object';
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  update public.cost_additional_components
  set name = coalesce(p_patch ->> 'name', name),
      calculation_type = coalesce(p_patch ->> 'calculation_type', calculation_type),
      value = coalesce((p_patch ->> 'value')::numeric, value),
      currency = case when p_patch ? 'currency' then p_patch ->> 'currency' else currency end,
      percentage_basis = case when p_patch ? 'percentage_basis' then p_patch ->> 'percentage_basis' else percentage_basis end,
      enabled = coalesce((p_patch ->> 'enabled')::boolean, enabled),
      season_key = case when p_patch ? 'season_key' then p_patch ->> 'season_key' else season_key end,
      origin_key = case when p_patch ? 'origin_key' then p_patch ->> 'origin_key' else origin_key end,
      category_key = case when p_patch ? 'category_key' then p_patch ->> 'category_key' else category_key end,
      source_reference = case when p_patch ? 'source_reference' then p_patch ->> 'source_reference' else source_reference end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_component_id
  returning * into v_component;

  update public.cost_config_versions
  set semantic_validation_status = 'NOT_VALIDATED',
      semantic_validated_at = null,
      semantic_validated_by = null,
      semantic_validation_result = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_config.id;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_component.updated',
    auth.uid(),
    v_config.company_id,
    'cost_additional_components',
    v_component.id::text,
    to_jsonb(v_component),
    'Company costing component updated through controlled RPC'
  );

  return v_component;
end;
$$;

create or replace function public.remove_cost_component(
  p_component_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_component public.cost_additional_components%rowtype;
  v_config public.cost_config_versions%rowtype;
begin
  select *
  into v_component
  from public.cost_additional_components
  where id = p_component_id
  for update;

  if not found then
    raise exception 'Cost component not found';
  end if;

  select *
  into v_config
  from public.cost_config_versions
  where id = v_component.config_version_id
  for update;

  perform private.costing_assert_can_manage_company(v_config.company_id);

  if v_config.lifecycle_status <> 'DRAFT' then
    raise exception 'Only draft cost config components may be removed';
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  delete from public.cost_additional_components
  where id = p_component_id;

  update public.cost_config_versions
  set semantic_validation_status = 'NOT_VALIDATED',
      semantic_validated_at = null,
      semantic_validated_by = null,
      semantic_validation_result = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_config.id;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, previous_value, reason
  ) values (
    'cost_component.removed',
    auth.uid(),
    v_config.company_id,
    'cost_additional_components',
    p_component_id::text,
    to_jsonb(v_component),
    'Company costing component removed through controlled RPC'
  );

  return jsonb_build_object('status', 'removed', 'component_id', p_component_id);
end;
$$;

create or replace function public.mark_cost_config_semantically_validated(
  p_config_version_id uuid,
  p_formula_version integer,
  p_validation_result jsonb default '{}'::jsonb
)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.cost_config_versions%rowtype;
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

  perform set_config('stdtex.costing_command', '1', true);

  update public.cost_config_versions
  set semantic_validation_status = 'VALID',
      semantic_validated_at = now(),
      semantic_validated_by = auth.uid(),
      semantic_validation_result = p_validation_result,
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
$$;

create or replace function public.activate_cost_config(
  p_config_version_id uuid
)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.cost_config_versions%rowtype;
  v_model public.cost_models%rowtype;
  v_previous_active_id uuid;
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

  if v_config.semantic_validation_status <> 'VALID' then
    raise exception 'Cost config must be semantically validated by domain code before activation';
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
$$;

create or replace function public.archive_cost_config(
  p_config_version_id uuid
)
returns public.cost_config_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.cost_config_versions%rowtype;
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

  if v_config.lifecycle_status = 'ACTIVE' then
    raise exception 'Active cost config cannot be archived without replacement activation';
  end if;

  if v_config.lifecycle_status = 'ARCHIVED' then
    return v_config;
  end if;

  perform set_config('stdtex.costing_command', '1', true);

  update public.cost_config_versions
  set lifecycle_status = 'ARCHIVED',
      archived_by = auth.uid(),
      archived_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_config_version_id
  returning * into v_config;

  insert into public.audit_logs (
    action, actor_user_id, company_id, entity_type, entity_id, new_value, reason
  ) values (
    'cost_config.archived',
    auth.uid(),
    v_config.company_id,
    'cost_config_versions',
    v_config.id::text,
    jsonb_build_object('lifecycle_status', v_config.lifecycle_status),
    'Company costing config archived through controlled RPC'
  );

  return v_config;
end;
$$;

revoke all on function private.costing_command_is_active() from public;
revoke all on function private.normalize_costing_upper_key(text) from public;
revoke all on function private.normalize_costing_trim_key(text) from public;
revoke all on function private.current_can_manage_costing_company(uuid) from public;
revoke all on function private.costing_assert_can_manage_company(uuid) from public;
revoke all on function private.costing_reset_semantic_validation() from public;
revoke all on function private.costing_prevent_locked_config_update() from public;
revoke all on function private.costing_prevent_locked_config_delete() from public;
revoke all on function private.costing_normalize_override() from public;
revoke all on function private.costing_normalize_component() from public;
revoke all on function private.costing_assert_parent_config_is_draft() from public;
revoke all on function private.costing_validate_company_settings() from public;

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

revoke all on function public.set_company_cost_source(uuid, text, text, uuid, text) from anon;
revoke all on function public.create_cost_config_draft(uuid, text, text, text, jsonb, uuid, text, text, text) from anon;
revoke all on function public.duplicate_cost_config(uuid, text, text) from anon;
revoke all on function public.update_cost_config_draft(uuid, jsonb) from anon;
revoke all on function public.upsert_cost_override(uuid, text, text, text, jsonb, text) from anon;
revoke all on function public.remove_cost_override(uuid) from anon;
revoke all on function public.add_cost_component(uuid, jsonb) from anon;
revoke all on function public.update_cost_component(uuid, jsonb) from anon;
revoke all on function public.remove_cost_component(uuid) from anon;
revoke all on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) from anon;
revoke all on function public.activate_cost_config(uuid) from anon;
revoke all on function public.archive_cost_config(uuid) from anon;

grant execute on function public.set_company_cost_source(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.create_cost_config_draft(uuid, text, text, text, jsonb, uuid, text, text, text) to authenticated;
grant execute on function public.duplicate_cost_config(uuid, text, text) to authenticated;
grant execute on function public.update_cost_config_draft(uuid, jsonb) to authenticated;
grant execute on function public.upsert_cost_override(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.remove_cost_override(uuid) to authenticated;
grant execute on function public.add_cost_component(uuid, jsonb) to authenticated;
grant execute on function public.update_cost_component(uuid, jsonb) to authenticated;
grant execute on function public.remove_cost_component(uuid) to authenticated;
grant execute on function public.activate_cost_config(uuid) to authenticated;
grant execute on function public.archive_cost_config(uuid) to authenticated;

revoke all on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) from authenticated;
grant execute on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) to service_role;

comment on function public.mark_cost_config_semantically_validated(uuid, integer, jsonb) is
  'Called only by trusted backend/service after Costing domain code validates model-specific variables and ranges. Not granted to browser authenticated users.';

-- ---------------------------------------------------------------------------
-- Seed model identity only
-- ---------------------------------------------------------------------------

insert into public.cost_models (
  code,
  name,
  description,
  source_type,
  status,
  current_formula_version,
  template_key
) values (
  'cost-model-001',
  'STDTEX Cost Model 001',
  'STDTEX domain-costing model identity. Formula implementation remains in application/domain code.',
  'STDTEX_MODEL',
  'AVAILABLE',
  1,
  'cost-model-001/current'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    source_type = excluded.source_type,
    status = excluded.status,
    current_formula_version = excluded.current_formula_version,
    template_key = excluded.template_key,
    updated_at = now();

commit;
