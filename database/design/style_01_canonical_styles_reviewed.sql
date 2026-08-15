-- STDTEX STYLE-01 canonical Style reviewed migration artifact.
-- REVIEW ONLY. Do not execute against production until separately approved.
-- Scope: additive canonical styles, Brand private contexts, Brand taxonomy,
-- and legacy negotiation_rows compatibility.

begin;

create schema if not exists private;

create or replace function private.current_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'hello@athletestandards.com'
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.membership_status = 'Active'
        and cm.access_role = 'Platform Admin'
    );
$$;

create or replace function private.current_is_active_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_is_platform_admin()
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = p_company_id
        and cm.membership_status = 'Active'
    );
$$;

create or replace function private.current_is_company_admin_for(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_is_platform_admin()
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = p_company_id
        and cm.membership_status = 'Active'
        and cm.access_role in ('Company Admin', 'Platform Admin')
    );
$$;

create table if not exists public.styles (
  id uuid primary key default gen_random_uuid(),
  legacy_negotiation_row_id bigint unique,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_by_type text not null check (created_by_type in ('SUPPLIER','BRAND')),
  owner_company_id uuid references public.companies(id) on delete restrict,
  owner_company_name text not null default '',
  creator_company_id uuid references public.companies(id) on delete restrict,
  creator_company_name text not null default '',
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','ARCHIVED')),
  publication_state text not null default 'PRIVATE' check (publication_state in ('PRIVATE','SHARED','PUBLISHED','ARCHIVED')),
  archived_at timestamptz,
  supplier_reference text,
  fabric_reference text,
  style_ref text,
  title text,
  description text,
  master_attributes jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.styles add column if not exists created_by_email text;
alter table public.styles add column if not exists owner_company_name text not null default '';
alter table public.styles add column if not exists creator_company_name text not null default '';
alter table public.styles add column if not exists publication_state text not null default 'PRIVATE';
alter table public.styles add column if not exists title text;

create table if not exists public.brand_style_contexts (
  id uuid primary key default gen_random_uuid(),
  brand_company_id uuid not null references public.companies(id) on delete cascade,
  style_id uuid not null references public.styles(id) on delete cascade,
  department_id uuid,
  category_id uuid,
  target_price numeric,
  target_currency text not null default 'USD',
  internal_reference text,
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
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.company_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid not null references public.company_departments(id) on delete restrict,
  name text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, department_id, name)
);

alter table public.negotiation_rows
  add column if not exists style_id uuid references public.styles(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brand_style_contexts_department_fk'
      and conrelid = 'public.brand_style_contexts'::regclass
  ) then
    alter table public.brand_style_contexts
      add constraint brand_style_contexts_department_fk
      foreign key (department_id) references public.company_departments(id) on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'brand_style_contexts_category_fk'
      and conrelid = 'public.brand_style_contexts'::regclass
  ) then
    alter table public.brand_style_contexts
      add constraint brand_style_contexts_category_fk
      foreign key (category_id) references public.company_categories(id) on delete restrict
      not valid;
  end if;
end $$;

create index if not exists styles_owner_company_id_idx on public.styles(owner_company_id);
create index if not exists styles_created_by_idx on public.styles(created_by);
create index if not exists styles_created_by_type_idx on public.styles(created_by_type);
create index if not exists styles_legacy_negotiation_row_id_idx on public.styles(legacy_negotiation_row_id);
create index if not exists negotiation_rows_style_id_idx on public.negotiation_rows(style_id);
create index if not exists brand_style_contexts_brand_idx on public.brand_style_contexts(brand_company_id);
create index if not exists brand_style_contexts_style_idx on public.brand_style_contexts(style_id);
create index if not exists company_departments_company_idx on public.company_departments(company_id);
create index if not exists company_categories_company_department_idx on public.company_categories(company_id, department_id);

alter table public.styles enable row level security;
alter table public.brand_style_contexts enable row level security;
alter table public.company_departments enable row level security;
alter table public.company_categories enable row level security;

revoke all on public.styles from anon;
revoke all on public.brand_style_contexts from anon;
revoke all on public.company_departments from anon;
revoke all on public.company_categories from anon;
grant select, insert, update, delete on public.styles to authenticated;
grant select, insert, update, delete on public.brand_style_contexts to authenticated;
grant select, insert, update on public.company_departments to authenticated;
grant select, insert, update on public.company_categories to authenticated;

drop policy if exists styles_company_private_select on public.styles;
create policy styles_company_private_select on public.styles
for select to authenticated
using (
  private.current_is_platform_admin()
  or private.current_is_active_company_member(owner_company_id)
);

drop policy if exists styles_company_private_insert on public.styles;
create policy styles_company_private_insert on public.styles
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.current_is_active_company_member(owner_company_id)
  and publication_state = 'PRIVATE'
);

drop policy if exists styles_company_private_update on public.styles;
create policy styles_company_private_update on public.styles
for update to authenticated
using (
  created_by = auth.uid()
  or private.current_is_company_admin_for(owner_company_id)
)
with check (
  private.current_is_active_company_member(owner_company_id)
);

drop policy if exists styles_company_private_delete on public.styles;
create policy styles_company_private_delete on public.styles
for delete to authenticated
using (
  private.current_is_platform_admin()
  or created_by = auth.uid()
  or private.current_is_company_admin_for(owner_company_id)
);

drop policy if exists brand_context_private_select on public.brand_style_contexts;
create policy brand_context_private_select on public.brand_style_contexts
for select to authenticated
using (private.current_is_active_company_member(brand_company_id));

drop policy if exists brand_context_private_insert on public.brand_style_contexts;
create policy brand_context_private_insert on public.brand_style_contexts
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.current_is_active_company_member(brand_company_id)
);

drop policy if exists brand_context_private_update on public.brand_style_contexts;
create policy brand_context_private_update on public.brand_style_contexts
for update to authenticated
using (private.current_is_active_company_member(brand_company_id))
with check (private.current_is_active_company_member(brand_company_id));

drop policy if exists taxonomy_company_select on public.company_departments;
create policy taxonomy_company_select on public.company_departments
for select to authenticated
using (private.current_is_active_company_member(company_id));

drop policy if exists taxonomy_company_insert on public.company_departments;
create policy taxonomy_company_insert on public.company_departments
for insert to authenticated
with check (private.current_is_company_admin_for(company_id));

drop policy if exists taxonomy_company_update on public.company_departments;
create policy taxonomy_company_update on public.company_departments
for update to authenticated
using (private.current_is_company_admin_for(company_id))
with check (private.current_is_company_admin_for(company_id));

drop policy if exists category_company_select on public.company_categories;
create policy category_company_select on public.company_categories
for select to authenticated
using (private.current_is_active_company_member(company_id));

drop policy if exists category_company_insert on public.company_categories;
create policy category_company_insert on public.company_categories
for insert to authenticated
with check (private.current_is_company_admin_for(company_id));

drop policy if exists category_company_update on public.company_categories;
create policy category_company_update on public.company_categories
for update to authenticated
using (private.current_is_company_admin_for(company_id))
with check (private.current_is_company_admin_for(company_id));

comment on table public.styles is 'STYLE-01 canonical product identity. Private by default; negotiation_rows remains the legacy compatibility surface.';
comment on table public.brand_style_contexts is 'Brand-private operational context for one canonical Style. Unique per Brand company and Style.';
comment on table public.company_departments is 'Company-owned Brand taxonomy. Deactivate instead of deleting referenced historical values.';
comment on table public.company_categories is 'Company-owned Brand taxonomy under company_departments. Deactivate instead of deleting referenced historical values.';

commit;
