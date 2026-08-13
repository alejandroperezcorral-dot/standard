# STDTEX Company Costing Settings V1 Security Test Plan

Status: STATIC PLAN ONLY

This plan is for the future staging execution phase. It does not execute SQL and does not change staging or production.

## Actors

Create or reuse JWT sessions for:

- Platform Admin: global STDTEX administrator, no company membership required.
- Company A Admin: active `company_memberships.access_role = 'Company Admin'`.
- Company A Member: active `company_memberships.access_role = 'Company Member'`.
- Company B Admin: active admin for a different company.
- Anon: no authenticated session.
- Service Role / backend: trusted backend only for semantic validation.

## Setup Fixtures

Future staging should create:

- Company A and Company B.
- At least one admin and one member in Company A.
- At least one admin in Company B.
- Seeded `cost-model-001` metadata only.
- Company A draft config with base_config JSON object.
- Company A active config created only after semantic validation.
- Company B draft config.
- Company A scoped override for `FW26 + VIETNAM + Pants Commercial`.

## Access Tests

### Anon

- Cannot select `cost_models`.
- Cannot select `company_costing_settings`.
- Cannot select `cost_config_versions`.
- Cannot select `cost_config_overrides`.
- Cannot select `cost_additional_components`.
- Cannot execute any public costing RPC.

Expected: all denied.

### Company A Member

- Cannot read raw company costing settings.
- Cannot read raw config versions.
- Cannot create draft configs.
- Cannot update draft configs.
- Cannot upsert overrides.
- Cannot add additional components.
- Cannot activate configs.
- Cannot mark semantic validation.

Expected: all denied.

### Company A Admin

- Can read Company A settings and configs.
- Cannot read Company B settings or configs.
- Can create Company A draft config.
- Cannot create Company B draft config.
- Can update Company A draft `base_config` through RPC.
- Cannot update Company A draft through direct table update.
- Cannot update Company B draft through RPC or direct table update.
- Can upsert Company A draft override through RPC.
- Cannot upsert duplicate exact override as a second row.
- Cannot insert override into Company B config.
- Can add/update/remove structured additional cost components on Company A draft.
- Cannot add raw formula strings or unsupported calculation types.
- Cannot activate config before backend semantic validation.
- Can activate after trusted semantic validation.
- Cannot edit active config directly after activation.
- Cannot delete active or archived config.

Expected: own-company command access only, no direct unsafe mutation.

### Company B Admin

- Cannot read Company A settings/configs.
- Cannot update Company A drafts.
- Cannot activate Company A drafts.
- Cannot insert overrides into Company A configs.
- Cannot set Company B settings to Company A active config.

Expected: all cross-company attempts denied.

### Platform Admin

- Can read all costing tables.
- Can run command RPCs globally.
- Does not require membership in the target company.
- Cannot bypass immutable assumptions through ordinary direct REST writes if table mutation grants remain absent.

Expected: global controlled administration works.

### Trusted Backend / Service

- Can call `mark_cost_config_semantically_validated`.
- Browser authenticated users cannot call it.
- Validation marker requires matching `formula_version`.
- Validation marker only works for `DRAFT`.

Expected: semantic validation boundary stays server-side.

## Semantic Validation Attack Tests

These tests belong to the future costing-domain validator before calling
`mark_cost_config_semantically_validated`.

- Reject unknown top-level variable keys.
- Reject values with the wrong JSON type for a known variable.
- Reject negative rates, negative costs and negative day counts where the model expects non-negative numbers.
- Reject NaN-like strings such as `"NaN"`, `"Infinity"` and `"-Infinity"`.
- Reject extremely large values that exceed the domain's bounded ranges.
- Reject unknown nested object keys.
- Reject system metadata keys such as `id`, `company_id`, `created_by`, `updated_by`, `semantic_validation_status`, `activated_by` and `archived_by`.
- Reject prototype-like keys such as `__proto__`, `constructor` and `prototype`.
- Verify rejected configs remain `NOT_VALIDATED` and cannot be activated.

Expected: malformed or hostile JSON never receives trusted semantic validation.

## Audit Privacy Tests

- Verify audit logs record metadata, scopes and changed key names.
- Verify audit logs do not store complete `base_config` payloads.
- Verify audit logs do not store complete override `values` payloads.
- Verify audit logs do not store component numeric values unless later approved as intentional.

Expected: audit logs are useful for traceability without becoming a shadow copy of commercially sensitive costing assumptions.

## Hostile Matrix

| Scenario | Actor | Expected |
| --- | --- | --- |
| Company A Admin creates own draft | Company A Admin | PASS |
| Company A Admin creates Company B draft | Company A Admin | DENIED |
| Member creates draft | Company A Member | DENIED |
| Anon reads tables | Anon | DENIED |
| Anon executes RPC | Anon | DENIED |
| Direct edit ACTIVE base_config | Company A Admin | DENIED |
| Direct edit ARCHIVED base_config | Company A Admin | DENIED |
| Delete ACTIVE config | Company A Admin | DENIED |
| Delete ARCHIVED config | Company A Admin | DENIED |
| Duplicate ACTIVE config per company/model | Company A Admin | DENIED by unique index |
| Duplicate exact override scope | Company A Admin | UPSERT same row, no duplicate |
| FW26 override affects SS27 | Company A Admin | IMPOSSIBLE unless scope matches |
| Activate wrong company config | Company B Admin | DENIED |
| Activate wrong model/source | Company A Admin | DENIED |
| Activate before semantic validation | Company A Admin | DENIED |
| Unknown variable key | Backend/domain validation | DENIED before semantic marker |
| Mark semantic validation from browser | Authenticated user | DENIED |
| Platform Admin global read | Platform Admin | PASS |
| Platform Admin without membership | Platform Admin | PASS |

## Atomic Activation Tests

1. Create two Company A draft configs for `cost-model-001`.
2. Mark draft 1 semantically valid through service-role backend path.
3. Activate draft 1.
4. Verify exactly one ACTIVE config exists for Company A + Model 001.
5. Mark draft 2 semantically valid.
6. Activate draft 2.
7. Verify draft 1 becomes ARCHIVED and draft 2 becomes ACTIVE in one transaction.
8. Verify `company_costing_settings.active_config_version_id` points to draft 2.
9. Verify audit event `cost_config.activated` exists.

## Rollback Tests

After test data is disposable:

1. Apply rollback draft in staging only.
2. Verify all costing tables are gone.
3. Verify costing public RPCs are gone.
4. Verify private costing helper functions are gone.
5. Verify original shared tables still exist:
   - `companies`
   - `profiles`
   - `company_memberships`
   - `company_groups`
   - `company_group_memberships`
   - `audit_logs`
   - `negotiation_rows`
6. Reapply forward draft.
7. Verify forward verification SQL passes again.

## Advisor Checks

Run Supabase advisors after staging execution. Expected areas to inspect:

- SECURITY DEFINER functions and grants.
- Missing FK indexes.
- Multiple permissive policies.
- RLS policy recursion.
- Public/anon execute leakage.
- Public schema table exposure.

Any advisor finding that affects data isolation must block production promotion.
