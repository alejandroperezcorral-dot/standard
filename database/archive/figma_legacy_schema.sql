-- STDTEX legacy Figma schema archive.
-- Created during Phase B after runtime removal commit 412bae4.
-- Supabase project: fw26-buying-tool (vtyffyywmqnlfemzlsbz).
-- Pre-removal rows confirmed:
--   public.figma_collection_connections = 0
--   public.figma_style_links = 0
--
-- This file is for audit and rollback reference only. It is not executed by
-- the application.

create table if not exists public.figma_collection_connections (
  id uuid not null default gen_random_uuid(),
  stdtex_collection_key text not null,
  collection_scope text not null,
  collection_name text not null,
  figma_file_id text not null,
  figma_node_id text not null,
  figma_node_type text default 'frame'::text,
  status text not null default 'Disconnected'::text,
  last_synced_at timestamp with time zone,
  last_sync_summary jsonb default '{}'::jsonb,
  last_snapshot jsonb default '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint figma_collection_connections_pkey primary key (id),
  constraint figma_collection_connections_stdtex_collection_key_key unique (stdtex_collection_key),
  constraint figma_collection_connections_status_check check (
    status = any (
      array[
        'Synced'::text,
        'Changes available'::text,
        'Syncing'::text,
        'Conflicts'::text,
        'Disconnected'::text
      ]
    )
  )
);

alter table public.figma_collection_connections enable row level security;

create policy "figma_connections_all"
on public.figma_collection_connections
for all
to authenticated
using (
  ((select (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text)
  or (created_by = (select auth.uid() as uid))
)
with check (
  ((select (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text)
  or (created_by = (select auth.uid() as uid))
);

create index if not exists figma_collection_connections_collection_key_idx
on public.figma_collection_connections using btree (stdtex_collection_key);

create table if not exists public.figma_style_links (
  id uuid not null default gen_random_uuid(),
  collection_connection_id uuid not null,
  row_id bigint not null,
  figma_instance_id text not null,
  last_snapshot jsonb default '{}'::jsonb,
  sync_status text not null default 'Synced'::text,
  review_required boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint figma_style_links_pkey primary key (id),
  constraint figma_style_links_collection_connection_id_row_id_key unique (collection_connection_id, row_id),
  constraint figma_style_links_collection_connection_id_figma_instance_i_key unique (collection_connection_id, figma_instance_id),
  constraint figma_style_links_collection_connection_id_fkey
    foreign key (collection_connection_id)
    references public.figma_collection_connections(id)
    on delete cascade,
  constraint figma_style_links_row_id_fkey
    foreign key (row_id)
    references public.negotiation_rows(id)
    on delete cascade,
  constraint figma_style_links_sync_status_check check (
    sync_status = any (
      array[
        'Synced'::text,
        'Changes available'::text,
        'Syncing'::text,
        'Conflicts'::text,
        'Disconnected'::text
      ]
    )
  )
);

alter table public.figma_style_links enable row level security;

create policy "figma_links_all"
on public.figma_style_links
for all
to authenticated
using (
  ((select (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text)
  or exists (
    select 1
    from public.figma_collection_connections c
    where c.id = figma_style_links.collection_connection_id
      and c.created_by = (select auth.uid() as uid)
  )
)
with check (
  ((select (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text)
  or exists (
    select 1
    from public.figma_collection_connections c
    where c.id = figma_style_links.collection_connection_id
      and c.created_by = (select auth.uid() as uid)
  )
);

create index if not exists figma_style_links_connection_idx
on public.figma_style_links using btree (collection_connection_id);

create index if not exists figma_style_links_row_idx
on public.figma_style_links using btree (row_id);
