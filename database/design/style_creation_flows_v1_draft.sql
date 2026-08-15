-- STDTEX Style Creation Flows V1 draft
-- Design artifact only. Do not execute against staging or production until separately reviewed and approved.

begin;

create table if not exists public.styles (
  id uuid primary key default gen_random_uuid(),
  legacy_negotiation_row_id bigint unique,
  created_by uuid references auth.users(id) on delete set null,
  created_by_type text not null check (created_by_type in ('SUPPLIER','BRAND')),
  owner_company_id uuid references public.companies(id) on delete restrict,
  creator_company_id uuid references public.companies(id) on delete restrict,
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','ARCHIVED')),
  archived_at timestamptz,
  supplier_reference text,
  fabric_reference text,
  style_ref text,
  description text,
  master_attributes jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.style_publications (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.styles(id) on delete cascade,
  supplier_company_id uuid references public.companies(id) on delete cascade,
  visibility_state text not null default 'PRIVATE' check (visibility_state in ('PRIVATE','SHARED','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (style_id, supplier_company_id)
);

create table if not exists public.style_shares (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.styles(id) on delete cascade,
  from_company_id uuid not null references public.companies(id) on delete cascade,
  to_company_id uuid references public.companies(id) on delete cascade,
  to_group_id uuid,
  share_type text not null default 'EXPLORE' check (share_type in ('EXPLORE','SHOWROOM','RFQ')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  created_at timestamptz not null default now(),
  unique (style_id, from_company_id, to_company_id, to_group_id, share_type)
);

create table if not exists public.brand_style_contexts (
  id uuid primary key default gen_random_uuid(),
  brand_company_id uuid not null references public.companies(id) on delete cascade,
  style_id uuid not null references public.styles(id) on delete cascade,
  department_id uuid,
  category_id uuid,
  target_price numeric,
  target_currency text not null default 'USD',
  internal_status text not null default 'PENDING',
  costing_model_id uuid,
  costing_config_version_id uuid,
  costing_resolved_at timestamptz,
  private_context jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_company_id, style_id)
);

create table if not exists public.company_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.company_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid references public.company_departments(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, department_id, name)
);

create table if not exists public.company_costing_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid references public.company_departments(id) on delete cascade,
  category_id uuid references public.company_categories(id) on delete cascade,
  cost_model_id uuid,
  cost_config_version_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, department_id, category_id)
);

create table if not exists public.style_rfqs (
  id uuid primary key default gen_random_uuid(),
  brand_company_id uuid not null references public.companies(id) on delete cascade,
  brand_style_context_id uuid references public.brand_style_contexts(id) on delete cascade,
  style_id uuid not null references public.styles(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.style_rfq_suppliers (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.style_rfqs(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'INVITED' check (status in ('INVITED','QUOTED','DECLINED','AWARDED','REJECTED')),
  created_at timestamptz not null default now(),
  unique (rfq_id, supplier_company_id)
);

create table if not exists public.style_quotations (
  id uuid primary key default gen_random_uuid(),
  rfq_supplier_id uuid not null references public.style_rfq_suppliers(id) on delete cascade,
  style_id uuid not null references public.styles(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  fob numeric,
  units numeric,
  currency text not null default 'USD',
  status text not null default 'SUBMITTED' check (status in ('DRAFT','SUBMITTED','REVISED','WITHDRAWN','AWARDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.style_negotiations (
  id uuid primary key default gen_random_uuid(),
  brand_company_id uuid not null references public.companies(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  style_id uuid not null references public.styles(id) on delete cascade,
  quotation_id uuid references public.style_quotations(id) on delete set null,
  status text not null default 'NEGOTIATING' check (status in ('NEGOTIATING','PAUSED','CONFIRMED','REJECTED','CANCELLED')),
  commercial_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.style_confirmed_outcomes (
  id uuid primary key default gen_random_uuid(),
  brand_company_id uuid not null references public.companies(id) on delete restrict,
  supplier_company_id uuid not null references public.companies(id) on delete restrict,
  style_id uuid not null references public.styles(id) on delete restrict,
  quotation_id uuid references public.style_quotations(id) on delete set null,
  negotiation_id uuid references public.style_negotiations(id) on delete set null,
  quantity numeric,
  fob numeric,
  currency text not null default 'USD',
  incoterm text,
  delivery_window text,
  cost_model_id uuid,
  cost_config_version_id uuid,
  commercial_snapshot jsonb not null default '{}'::jsonb,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now()
);

-- Existing collection and Canvas tables are intentionally not duplicated here.
-- `style_collection_assignments` should become a relationship to canonical styles through a compatibility bridge.
-- Canvas keeps visual/layout metadata and references style identity through its existing `linked_style_id` contract first.

create index if not exists styles_owner_company_id_idx on public.styles(owner_company_id);
create index if not exists styles_created_by_type_idx on public.styles(created_by_type);
create index if not exists style_shares_to_company_group_idx on public.style_shares(to_company_id, to_group_id);
create index if not exists brand_style_contexts_brand_idx on public.brand_style_contexts(brand_company_id);
create index if not exists style_rfqs_brand_idx on public.style_rfqs(brand_company_id);
create index if not exists style_negotiations_brand_supplier_idx on public.style_negotiations(brand_company_id, supplier_company_id);
create index if not exists style_confirmed_outcomes_brand_supplier_idx on public.style_confirmed_outcomes(brand_company_id, supplier_company_id);

rollback;
