-- LOCAL DRAFT ONLY. Do not apply to production without clean-room certification.
-- Canonical relation: one Brand parent style can receive many Supplier response styles.

create table if not exists public.brand_supplier_style_responses (
  id uuid primary key default gen_random_uuid(),
  parent_brand_style_id uuid not null references public.styles(id) on delete cascade,
  supplier_style_id uuid not null references public.styles(id) on delete cascade,
  brand_company_id uuid not null references public.companies(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  response_type text not null default 'NEW_STYLE',
  status text not null default 'ACTIVE',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_supplier_style_responses_response_type_check
    check (response_type in ('NEW_STYLE','EXISTING_STYLE')),
  constraint brand_supplier_style_responses_status_check
    check (status in ('ACTIVE','REVOKED','SELECTED','ARCHIVED')),
  constraint brand_supplier_style_responses_distinct_styles_check
    check (parent_brand_style_id <> supplier_style_id)
);

create unique index if not exists brand_supplier_style_responses_unique_link
  on public.brand_supplier_style_responses (parent_brand_style_id, supplier_company_id, supplier_style_id);

create index if not exists brand_supplier_style_responses_parent_idx
  on public.brand_supplier_style_responses (parent_brand_style_id, status);

create index if not exists brand_supplier_style_responses_supplier_idx
  on public.brand_supplier_style_responses (supplier_company_id, status);

alter table public.brand_supplier_style_responses enable row level security;

revoke all on public.brand_supplier_style_responses from public, anon, authenticated;
grant select, insert on public.brand_supplier_style_responses to authenticated;
grant update (status, updated_at) on public.brand_supplier_style_responses to authenticated;
grant all on public.brand_supplier_style_responses to service_role;

create or replace function private.touch_brand_supplier_style_responses_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_brand_supplier_style_responses_updated_at() from public, anon, authenticated;

drop trigger if exists brand_supplier_style_responses_touch_updated_at
  on public.brand_supplier_style_responses;
create trigger brand_supplier_style_responses_touch_updated_at
before update on public.brand_supplier_style_responses
for each row execute function private.touch_brand_supplier_style_responses_updated_at();

create or replace function private.active_company_member(
  p_company_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.membership_status = 'Active'
  );
$$;

revoke all on function private.active_company_member(uuid, uuid) from public, anon;

create or replace function private.brand_company_has_unlocked_supplier_names(
  p_brand_company_id uuid,
  p_supplier_company_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.supplier_brand_access access
    join public.companies brand
      on brand.id = p_brand_company_id
     and lower(btrim(brand.name)) = lower(btrim(access.brand_company))
    join public.companies supplier
      on supplier.id = p_supplier_company_id
     and lower(btrim(supplier.name)) = lower(btrim(access.supplier_company))
    where coalesce(access.status, 'Active') = 'Active'
  );
$$;

revoke all on function private.brand_company_has_unlocked_supplier_names(uuid, uuid)
  from public, anon;

drop policy if exists brand_supplier_style_responses_select_participants
  on public.brand_supplier_style_responses;
create policy brand_supplier_style_responses_select_participants
on public.brand_supplier_style_responses
for select
to authenticated
using (
  private.active_company_member(brand_company_id, (select auth.uid()))
  or private.active_company_member(supplier_company_id, (select auth.uid()))
);

drop policy if exists brand_supplier_style_responses_insert_supplier
  on public.brand_supplier_style_responses;
create policy brand_supplier_style_responses_insert_supplier
on public.brand_supplier_style_responses
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'ACTIVE'
  and private.active_company_member(supplier_company_id, (select auth.uid()))
  and private.brand_company_has_unlocked_supplier_names(brand_company_id, supplier_company_id)
  and exists (
    select 1
    from public.styles parent
    where parent.id = parent_brand_style_id
      and parent.owner_company_id = brand_company_id
      and parent.created_by_type = 'BRAND'
      and parent.lifecycle_state = 'ACTIVE'
  )
  and exists (
    select 1
    from public.styles supplier_style
    where supplier_style.id = supplier_style_id
      and supplier_style.owner_company_id = supplier_company_id
      and supplier_style.created_by_type = 'SUPPLIER'
      and supplier_style.lifecycle_state = 'ACTIVE'
  )
);

drop policy if exists brand_supplier_style_responses_update_participants
  on public.brand_supplier_style_responses;
create policy brand_supplier_style_responses_update_participants
on public.brand_supplier_style_responses
for update
to authenticated
using (
  private.active_company_member(brand_company_id, (select auth.uid()))
  or private.active_company_member(supplier_company_id, (select auth.uid()))
)
with check (
  private.active_company_member(brand_company_id, (select auth.uid()))
  or private.active_company_member(supplier_company_id, (select auth.uid()))
);
