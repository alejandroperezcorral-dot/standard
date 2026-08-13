# STDTEX Supabase schema baseline

This folder documents the current production schema as a replay-validated reproducible baseline for empty, isolated Supabase environments.

This is not a production forward migration. Do not apply these files to an existing production database.

## Files

- `current_production_schema.sql`: schema-only baseline captured from read-only production catalog inspection.
- `current_production_policies.sql`: materialized current production RLS policies generated from `pg_policies`.
- `current_production_grants.sql`: materialized current production table grants for `anon` and `authenticated`.
- `current_production_policy_extraction.sql`: read-only query that generates exact `CREATE POLICY` DDL from `pg_policies`.
- `staging_bootstrap.sql`: bootstrap manifest and execution order for an empty standard Supabase project.
- `verify_schema_parity.sql`: read-only structural inventory for production vs replay comparison.
- `baseline_manifest.md`: expected object counts and security coverage for the captured baseline.

## Scope

Included:

- STDTEX-owned public tables
- constraints and indexes
- helper functions
- triggers
- RLS enablement
- storage bucket metadata for `product-photos`

Excluded:

- production data
- auth users
- invitation tokens
- uploaded storage objects
- service keys or secrets
- deprecated Figma tables or policies

## Missing production migration files

Production contains migration history that is not present as SQL files in this repository:

- `20260809041939 strict_supplier_company_scope`
- `20260809043126 company_platform_structure`
- `20260809043217 enforce_single_supplier_company_membership`
- `20260809045510 supplier_brand_explore_access`
- `20260809053530 scoped_showroom_collections`
- `20260809170909 fix_collection_and_style_delete_rls`
- `20260809173809 fix_collection_group_membership_rls_fallback`
- `20260809174419 relax_company_collection_write_scope`
- `20260809192642 add_buying_tool_lookup_indexes`
- `20260809192825 add_company_membership_lookup_indexes`
- `20260809202954 drop_legacy_collection_scope_policies`
- `20260809211441 company_admin_manage_company_collections`
- `20260810072143 allow_group_collection_rows_select`

Known migration names are documented here. Their exact historical SQL bodies are not reconstructed or invented.

## Bootstrap strategy

The baseline represents the current production schema state at checkpoint-06.

Replay status: `REPLAY VALIDATED`

Validated staging project:

- Name: `stdtex-staging`
- Ref: `amitkdqyfblymzdsrplx`
- Validation date: 2026-08-12

Final parity:

- Public tables: 15
- Public columns: 175
- Public RLS-enabled tables: 15
- Public policies: 44
- Public indexes: 38
- Public functions: 1
- Public trigger events: 2
- Storage bucket metadata: `product-photos`
- Grants: exact parity for `anon` and `authenticated`

The only accepted catalog-level difference is non-semantic constraint fingerprint drift from `information_schema` generated names. Real `pg_constraint` definitions match semantically.

Future database changes should be added as forward migrations under `database/migrations/` after this baseline, not by rewriting the historical production migration chain.

For any future disposable environment, replay this baseline in an empty database and compare structure against production before applying later forward migrations.

## Empty project reconstruction steps

1. Create or identify an empty disposable standard Supabase/Postgres database.
2. Confirm it contains no STDTEX public application tables.
3. Apply `current_production_schema.sql`.
4. Apply `current_production_grants.sql`.
5. Apply `current_production_policies.sql`.
6. Run `verify_schema_parity.sql` against production and the disposable database.
7. Compare tables, columns, constraints, indexes, RLS, policies, functions, triggers and storage bucket metadata.

Use `current_production_policy_extraction.sql` only to regenerate policy DDL if production drift must be checked before replay.

Do not run any baseline file against existing production.
