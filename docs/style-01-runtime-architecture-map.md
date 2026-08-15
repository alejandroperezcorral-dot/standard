# STYLE-01 Runtime Architecture Map

This document records the current STDTEX Style lifecycle before broader entity migration. It is intentionally conservative: `negotiation_rows` remains the active compatibility surface.

## Current Runtime Sources

- Explore reads visible styles from the existing `ROWS` runtime projection, backed by `negotiation_rows`.
- Collections use `showroom_collections_scoped` for collection metadata and `style_collection_assignments.row_id` to link existing rows.
- Negotiation and Closed are still table views over `negotiation_rows`.
- Chat conversations are still tied to existing row/style identifiers and must not be broken by STYLE-01.
- Canvas keeps its existing linked row/style contract and is not rewritten in this phase.
- Supplier showroom creation still uses the existing legacy creation path.

## STYLE-01 Additive Boundary

- `styles` is the proposed canonical product identity table.
- `brand_style_contexts` is the proposed Brand-private operational context table.
- `company_departments` and `company_categories` are proposed company-owned taxonomy tables.
- `negotiation_rows.style_id` is the proposed additive bridge from legacy rows to canonical styles.

## Ownership Rules

- Supplier-created styles are owned by the supplier company.
- Brand-created styles are owned by the brand company.
- Collection membership never changes canonical ownership.
- Saving a supplier style to a brand collection does not duplicate the style.
- Brand-specific Department, Category, target price and future costing references belong to `brand_style_contexts`, never to the supplier-owned canonical style.

## Security Rules

- Canonical style rows are company-private until a future STYLE-02 publication/sharing layer explicitly grants visibility.
- Brand contexts are private to the Brand company.
- Brand A must not read Brand B context for the same canonical style.
- Company Admins can manage their company taxonomy.
- Company Members cannot manage taxonomy.
- Platform Admin behavior is preserved, with the legacy `hello@athletestandards.com` shortcut documented as technical debt.

## Runtime Decision

Automatic dual-write from the current production creation flow into the new canonical tables is deliberately not wired in STYLE-01 until the reviewed migration is applied in an approved non-production/prod rollout path. The current runtime includes a compatible My Styles shell that can read canonical styles when available and safely falls back to existing `negotiation_rows`.

## Deliberately Unchanged

- No production database mutation.
- No Costing activation.
- No `negotiation_rows` replacement.
- No Collections rewrite.
- No Canvas rewrite.
- No Explore publication/sharing rewrite.
