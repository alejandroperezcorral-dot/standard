# STDTEX Production Baseline Manifest

Checkpoint date: 2026-08-12
Production project ref: `vtyffyywmqnlfemzlsbz`
Status: REPLAY VALIDATED against standalone Supabase staging project `stdtex-staging` (`amitkdqyfblymzdsrplx`) on 2026-08-12.

## Expected Inventory

- Public tables: 15
- Public RLS-enabled tables: 15
- Public policies: 44
- Public constraints: 63
- Public indexes: 38
- Public columns: 175
- Public functions: 1
- Public trigger events: 2
- Storage buckets: 1 (`product-photos`)
- Role grant statements: 28

## Baseline Files

- `current_production_schema.sql`: schema, tables, indexes, function, trigger, RLS enablement and storage bucket baseline.
- `current_production_policies.sql`: complete materialized policy baseline generated from `pg_policies`.
- `current_production_grants.sql`: complete materialized table grants for `anon` and `authenticated`.
- `current_production_policy_extraction.sql`: read-only extractor used to regenerate policy DDL from a live catalog.
- `verify_schema_parity.sql`: read-only parity checks to run after bootstrap.
- `staging_bootstrap.sql`: ordered bootstrap notes.

## Security Baseline

All 15 public tables are RLS-enabled in the captured baseline:

- `app_state`
- `approval_requests`
- `audit_logs`
- `companies`
- `company_group_memberships`
- `company_groups`
- `company_invitations`
- `company_memberships`
- `folder_shares`
- `folders`
- `negotiation_rows`
- `profiles`
- `showroom_collections_scoped`
- `style_collection_assignments`
- `supplier_brand_access`

Policy coverage:

- `app_state`: 3
- `approval_requests`: 2
- `audit_logs`: 2
- `companies`: 6
- `company_group_memberships`: 3
- `company_groups`: 3
- `company_invitations`: 4
- `company_memberships`: 2
- `folder_shares`: 1
- `folders`: 1
- `negotiation_rows`: 4
- `profiles`: 3
- `showroom_collections_scoped`: 4
- `style_collection_assignments`: 4
- `supplier_brand_access`: 2

## Critical Constraints

- `company_memberships_one_company_per_user`: preserves one company per user.
- `style_collection_assignments_row_id_owner_company_owner_gro_key`: preserves scoped collection assignment uniqueness.
- `trg_single_supplier_company_membership`: enforces single supplier-company membership through `enforce_single_supplier_company_membership()`.

## Legacy Figma Status

Runtime Figma code has already been removed in prior approved work.
The baseline SQL files contain no active references to:

- `figma`
- `Figma`
- `FIGMA`
- `figma_collection_connections`
- `figma_style_links`

## Data Policy

This baseline contains schema/security DDL only. It does not contain production table data, auth users, passwords, API keys or service-role secrets.

## Replay Status

REPLAY VALIDATED.

Validated against standalone staging project:

- Project name: `stdtex-staging`
- Project ref: `amitkdqyfblymzdsrplx`
- Validation date: 2026-08-12

Final parity result:

- Public tables: 15 / 15
- Public columns: 175 / 175
- Public RLS-enabled tables: 15 / 15
- Public policies: 44 / 44
- Public indexes: 38 / 38
- Public functions: 1 / 1
- Public trigger events: 2 / 2
- Storage buckets: 1 / 1 (`product-photos`)
- Grants: exact parity for `anon` and `authenticated`

The only accepted catalog-level difference is non-semantic constraint fingerprint drift from `information_schema` generated names. Real `pg_constraint` definitions match semantically.
