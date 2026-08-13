-- STDTEX current production grants baseline
--
-- Purpose:
--   Reconstruct the current production role grants in an empty disposable
--   Supabase/Postgres staging database.
--
-- Source:
--   Read-only extraction from production project ref vtyffyywmqnlfemzlsbz.
--
-- Do not run this against production.

grant delete, insert, references, select, trigger, truncate, update on table public.app_state to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.app_state to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.approval_requests to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.approval_requests to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.audit_logs to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.audit_logs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.companies to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.companies to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.company_group_memberships to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.company_group_memberships to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.company_groups to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.company_groups to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.company_invitations to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.company_invitations to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.company_memberships to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.company_memberships to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.folder_shares to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.folder_shares to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.folders to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.folders to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.negotiation_rows to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.negotiation_rows to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.profiles to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.profiles to authenticated;
revoke delete, insert, references, select, trigger, truncate, update on table public.showroom_collections_scoped from anon;
grant delete, insert, references, select, trigger, truncate, update on table public.showroom_collections_scoped to authenticated;
revoke delete, insert, references, select, trigger, truncate, update on table public.style_collection_assignments from anon;
grant delete, insert, references, select, trigger, truncate, update on table public.style_collection_assignments to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.supplier_brand_access to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.supplier_brand_access to authenticated;
