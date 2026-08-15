# STDTEX Style Creation Flows Architecture

This document records the approved product rule from `STDTEX_Style_Creation_Flows (2).docx` as an architecture checkpoint.

## Source Of Truth

STDTEX has one canonical Style object. A Style may be created by a Supplier or by a Brand, but it remains the same kind of object through its lifecycle.

Required identity fields:

- `style_id`
- `created_by`
- `created_by_type`: `SUPPLIER` or `BRAND`
- `owner_company_id`
- `creator_company_id`
- supplier reference
- fabric reference
- lifecycle state
- publication/share state

## Core Rules

- My Styles is the creator company's own style library.
- Explore is a publication and discovery surface, not the master database.
- Newly created styles do not automatically enter Explore.
- Supplier-created styles can be published or shared into Explore.
- Brand-created styles stay private unless explicitly shared through RFQ or another approved relationship.
- Created is not Saved.
- Saved is a user or Brand action applied after discovery.
- One Supplier Style can be selected independently by many Brands.
- A Brand confirmation does not globally close or confirm the Supplier Style for other Brands.

## Supplier Flow

Supplier creates a Style, sees it under My Styles / Created, organizes it in Supplier collections or showroom, then explicitly publishes or shares it. Only after sharing does the Style appear in the receiving Brand's Explore. A Brand may then save it, add it to its own collection, request quotation, negotiate, and close its own relationship.

## Brand Flow

Brand creates a Style, sees it under My Styles / Created, keeps it private, may add it to Brand collections or Canvas, and can send RFQs to one or more Suppliers. Each Supplier can reply with a separate quotation. The Brand compares, negotiates, awards, and closes its own relationship.

## Brand Context Layer

Brand-specific fields do not belong on the global Style master record. They belong in a Brand Style Context.

Examples:

- Brand department
- Brand category
- target price
- internal status
- costing configuration mapping
- collection context
- RFQ and negotiation state

This protects privacy and allows multiple Brands to work with the same Supplier Style without seeing each other's commercial information.

## Compatibility

The current application still uses `negotiation_rows` as the legacy product table. The first implementation keeps `negotiation_rows` untouched and adds a pure compatibility model that can derive a canonical Style shape from an existing row.

No production database migration is applied by this document. The future schema must be additive and must preserve existing `negotiation_rows` data until a verified migration path exists.

## Existing Dependency Map

`negotiation_rows` is still used directly by:

- Explore read and card rendering
- Collections assignment reads and writes
- Canvas linked style references through `linked_style_id`
- Negotiation table editing, bulk update, insert, delete, and save flows
- Closed view through row status
- Chat style detail and system messages
- Supplier showroom visibility and supplier-created rows
- Current RLS policies for owner, supplier, admin, shared Brand, and collection-scoped reads

Current Collections infrastructure already represents relationship/assignment semantics and must be reused:

- `showroom_collections_scoped`
- `style_collection_assignments`
- legacy `folders` and `folder_shares` only where still needed for backward compatibility

Current Canvas must keep using stable style identity and must not clone commercial data. Future Canvas persistence can reference either canonical `styles.id` or the existing bridge `negotiation_rows.id` while migration is in progress.

## Proposed Entities

The target model should be additive and relationship-based:

- `styles`: canonical product/style identity and shared master attributes.
- `style_publications`: Supplier publication state for private, shared, or published visibility.
- `style_shares`: explicit company/group sharing relationships.
- `brand_style_contexts`: Brand-private operational and costing context for a Style.
- `company_departments`: Brand-owned taxonomy.
- `company_categories`: Brand-owned taxonomy under departments.
- `company_costing_mappings`: Brand admin mapping from taxonomy to Costing config/version.
- `style_rfqs`: Brand request for quotation against a Style.
- `style_rfq_suppliers`: suppliers invited to quote.
- `style_quotations`: independent supplier quotation records.
- `style_negotiations`: relationship-based negotiation state.
- `style_confirmed_outcomes`: closed commercial Brand-Supplier-Style outcome.
- `style_collection_assignments`: existing collection relationship table, reused rather than duplicated.
- Canvas item references: existing `linked_style_id` behavior, later bridged to canonical Style IDs.

## Safest Migration Strategy

Option A is the safest first step: keep `negotiation_rows` as the current backing source while introducing a compatibility layer and additive canonical tables later.

Do not choose option B yet, where a new `styles` table becomes authoritative and `negotiation_rows` becomes commercial context. That requires a data migration, new RLS, and UI workflow migration.

No destructive migration is approved at this checkpoint.
