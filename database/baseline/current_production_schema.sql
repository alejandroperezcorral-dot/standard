-- STDTEX production schema baseline
-- Generated from read-only Supabase production catalog inspection on 2026-08-12.
--
-- Purpose:
--   Schema-only reconstruction baseline for isolated staging environments.
--
-- This file is NOT a forward production migration.
-- Do NOT apply this file to an existing production database.
--
-- Data intentionally excluded:
--   - auth users
--   - profiles data
--   - company/member/customer rows
--   - invitations and tokens
--   - chats/files/application rows
--   - secrets or API keys
--
-- Policy DDL:
--   Generate exact current production policy DDL with:
--   database/baseline/current_production_policy_extraction.sql
--   Replay policies only after the tables below and RLS enablement exist.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists public.app_state (
  key text not null,
  value jsonb,
  updated_at timestamp with time zone default now(),
  constraint app_state_pkey primary key (key)
);

create table if not exists public.approval_requests (
  id uuid not null default gen_random_uuid(),
  request_type text,
  user_id uuid,
  company_id uuid,
  membership_id uuid,
  status text default 'Pending platform approval'::text,
  submitted_data jsonb,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  constraint approval_requests_pkey primary key (id)
);

create table if not exists public.audit_logs (
  id uuid not null default gen_random_uuid(),
  action text,
  actor_user_id uuid,
  target_user_id uuid,
  company_id uuid,
  entity_type text,
  entity_id text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamp with time zone default now(),
  constraint audit_logs_pkey primary key (id)
);

create table if not exists public.companies (
  id uuid not null default gen_random_uuid(),
  name text not null,
  type text,
  logo text,
  description text,
  country text,
  city text,
  website text,
  main_email text,
  main_phone text,
  address text,
  status text default 'Pending approval'::text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint companies_pkey primary key (id),
  constraint companies_name_key unique (name),
  constraint companies_type_check check (type = any (array['Brand'::text, 'Supplier'::text]))
);

create table if not exists public.company_groups (
  id uuid not null default gen_random_uuid(),
  company_id uuid,
  name text not null,
  description text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint company_groups_pkey primary key (id),
  constraint company_groups_company_id_fkey foreign key (company_id) references public.companies(id) on delete cascade,
  constraint company_groups_company_id_name_key unique (company_id, name)
);

create table if not exists public.company_memberships (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  company_id uuid,
  access_role text default 'Company Member'::text,
  job_position text,
  custom_job_position text,
  department text,
  membership_status text default 'Pending approval'::text,
  invited_by uuid,
  approved_by uuid,
  joined_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint company_memberships_pkey primary key (id),
  constraint company_memberships_company_id_fkey foreign key (company_id) references public.companies(id) on delete cascade,
  constraint company_memberships_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint company_memberships_user_id_company_id_key unique (user_id, company_id)
);

create table if not exists public.company_group_memberships (
  id uuid not null default gen_random_uuid(),
  company_id uuid,
  company_group_id uuid,
  user_id uuid,
  created_at timestamp with time zone default now(),
  constraint company_group_memberships_pkey primary key (id),
  constraint company_group_memberships_company_id_fkey foreign key (company_id) references public.companies(id) on delete cascade,
  constraint company_group_memberships_company_group_id_fkey foreign key (company_group_id) references public.company_groups(id) on delete cascade,
  constraint company_group_memberships_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint company_group_memberships_company_group_id_user_id_key unique (company_group_id, user_id)
);

create table if not exists public.company_invitations (
  id uuid not null default gen_random_uuid(),
  email text not null,
  company_id uuid,
  intended_access_role text,
  intended_job_position text,
  intended_department text,
  token text,
  status text default 'Pending'::text,
  invited_by uuid,
  expires_at timestamp with time zone,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  first_name text,
  last_name text,
  invite_group text,
  invite_link text,
  company_name text,
  company_logo text,
  constraint company_invitations_pkey primary key (id),
  constraint company_invitations_company_id_fkey foreign key (company_id) references public.companies(id) on delete cascade,
  constraint company_invitations_token_key unique (token)
);

create table if not exists public.folders (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamp with time zone default now(),
  constraint folders_pkey primary key (id)
);

create table if not exists public.folder_shares (
  id uuid not null default gen_random_uuid(),
  folder_id uuid,
  owner_id uuid not null,
  shared_with_email text not null,
  created_at timestamp with time zone default now(),
  constraint folder_shares_pkey primary key (id),
  constraint folder_shares_folder_id_fkey foreign key (folder_id) references public.folders(id) on delete cascade
);

create table if not exists public.negotiation_rows (
  id bigint not null,
  fecha date,
  modelo text,
  description text,
  supplier text,
  origin text,
  transport text,
  temporada text,
  dept text,
  cat text,
  pvp_rub numeric,
  fob1 numeric,
  fob2 numeric,
  fob3 numeric,
  fob_closed numeric,
  weight numeric,
  units integer,
  target_imu numeric,
  notes text,
  status text default 'PENDING'::text,
  fsd date,
  ch_off numeric,
  ch_mkt numeric,
  ch_onl numeric,
  sell_thru numeric,
  lc_weeks integer,
  photo text,
  photo2 text,
  cust_profile text,
  capsule text,
  fashionability text,
  n_colours integer,
  updated_at timestamp with time zone default now(),
  colour text,
  hod text,
  user_id uuid,
  folder_id uuid,
  constraint negotiation_rows_pkey primary key (id)
);

create table if not exists public.profiles (
  id uuid not null,
  email text,
  role text default 'user'::text,
  approved boolean default false,
  created_at timestamp with time zone default now(),
  supplier_company text,
  company_name text,
  active_company_name text,
  company_type text,
  access_role text,
  first_name text,
  last_name text,
  phone text,
  job_position text,
  department text,
  company_group text,
  company_subgroup text,
  last_seen_at timestamp with time zone,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade
);

create table if not exists public.showroom_collections_scoped (
  id uuid not null default gen_random_uuid(),
  owner_company text not null,
  owner_group text default ''::text,
  owner_type text default 'Brand'::text,
  name text not null,
  fsd date,
  target_company text default ''::text,
  target_group text default ''::text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by_email text,
  constraint showroom_collections_scoped_pkey primary key (id),
  constraint showroom_collections_scoped_owner_company_owner_group_owner_key unique (owner_company, owner_group, owner_type, name)
);

create table if not exists public.style_collection_assignments (
  id uuid not null default gen_random_uuid(),
  row_id bigint not null,
  owner_company text not null,
  owner_group text default ''::text,
  owner_type text default 'Brand'::text,
  collection_name text not null,
  created_by uuid,
  created_at timestamp with time zone default now(),
  constraint style_collection_assignments_pkey primary key (id),
  constraint style_collection_assignments_row_id_fkey foreign key (row_id) references public.negotiation_rows(id) on delete cascade,
  constraint style_collection_assignments_row_id_owner_company_owner_gro_key unique (row_id, owner_company, owner_group, owner_type, collection_name)
);

create table if not exists public.supplier_brand_access (
  id uuid not null default gen_random_uuid(),
  supplier_company text not null,
  brand_company text not null,
  group_name text default ''::text,
  status text default 'Active'::text,
  added_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint supplier_brand_access_pkey primary key (id),
  constraint supplier_brand_access_supplier_company_brand_company_group__key unique (supplier_company, brand_company, group_name)
);

create unique index if not exists company_memberships_one_company_per_user on public.company_memberships using btree (user_id);
create index if not exists company_memberships_company_id_idx on public.company_memberships using btree (company_id);
create index if not exists company_memberships_user_id_idx on public.company_memberships using btree (user_id);
create index if not exists company_memberships_user_status_idx on public.company_memberships using btree (user_id, membership_status);
create index if not exists company_group_memberships_company_id_idx on public.company_group_memberships using btree (company_id);
create index if not exists company_group_memberships_company_user_idx on public.company_group_memberships using btree (company_id, user_id);
create index if not exists company_group_memberships_user_id_idx on public.company_group_memberships using btree (user_id);
create index if not exists company_invitations_company_id_idx on public.company_invitations using btree (company_id);
create index if not exists folder_shares_folder_id_idx on public.folder_shares using btree (folder_id);
create index if not exists negotiation_rows_status_idx on public.negotiation_rows using btree (status);
create index if not exists negotiation_rows_supplier_idx on public.negotiation_rows using btree (lower(coalesce(supplier, ''::text)));
create index if not exists negotiation_rows_user_id_idx on public.negotiation_rows using btree (user_id);
create index if not exists showroom_collections_scoped_scope_idx on public.showroom_collections_scoped using btree (owner_company, owner_type, owner_group, name);
create index if not exists style_collection_assignments_row_id_idx on public.style_collection_assignments using btree (row_id);
create index if not exists style_collection_assignments_scope_idx on public.style_collection_assignments using btree (owner_company, owner_type, owner_group, collection_name);

create or replace function public.enforce_single_supplier_company_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_company_type text;
  existing_count integer;
begin
  select type into new_company_type from public.companies where id = new.company_id;
  if new_company_type = 'Supplier' and coalesce(new.membership_status,'') <> 'Rejected' then
    select count(*) into existing_count
    from public.company_memberships m
    join public.companies c on c.id = m.company_id
    where m.user_id = new.user_id
      and c.type = 'Supplier'
      and coalesce(m.membership_status,'') <> 'Rejected'
      and m.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
    if existing_count > 0 then
      raise exception 'Supplier users can only belong to one supplier company';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_single_supplier_company_membership on public.company_memberships;
create trigger trg_single_supplier_company_membership
before insert or update on public.company_memberships
for each row execute function public.enforce_single_supplier_company_membership();

alter table public.app_state enable row level security;
alter table public.approval_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.companies enable row level security;
alter table public.company_group_memberships enable row level security;
alter table public.company_groups enable row level security;
alter table public.company_invitations enable row level security;
alter table public.company_memberships enable row level security;
alter table public.folder_shares enable row level security;
alter table public.folders enable row level security;
alter table public.negotiation_rows enable row level security;
alter table public.profiles enable row level security;
alter table public.showroom_collections_scoped enable row level security;
alter table public.style_collection_assignments enable row level security;
alter table public.supplier_brand_access enable row level security;

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;
