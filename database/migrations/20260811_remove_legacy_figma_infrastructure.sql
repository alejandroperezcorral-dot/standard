-- STDTEX Phase B: remove deprecated Figma database infrastructure.
-- Runtime Figma code was removed at commit 412bae4 and production was
-- validated before this migration.
--
-- Scope:
--   - Drop legacy Figma RLS policies.
--   - Drop child table public.figma_style_links.
--   - Drop parent table public.figma_collection_connections.
--
-- No CASCADE is used. This migration must fail if unexpected external
-- dependencies still exist.

drop policy if exists "figma_links_all" on public.figma_style_links;
drop policy if exists "figma_connections_all" on public.figma_collection_connections;

drop table if exists public.figma_style_links;
drop table if exists public.figma_collection_connections;
