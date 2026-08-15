# Cost Model 001 Production Security Certification

Status: review checkpoint only. No production mutation was performed.

Canonical artifact:

- `database/production_rollout/20260815_cost_model_001_canonical_dormant_forward.sql`
- bytes: 67,965
- lines by current PowerShell read: 2,055
- SHA256: `BDC642C92F760A762850726F0CFC1E99C49CD969679C9C8374E05EB296753C6A`

## Static Security Review

The revised canonical migration creates `private` before any private helper is referenced. It revokes public access to the schema, grants usage only to `authenticated` and `service_role`, and defines the required authorization helpers with `security definer` and `set search_path = ''`.

Helpers:

- `private.current_is_platform_admin()`
- `private.current_is_company_admin_for(uuid)`

The helpers are aligned with the existing production authorization model:

- platform admin by auth email `hello@athletestandards.com`
- platform admin by `profiles.role = 'admin'`
- platform admin by `profiles.access_role = 'Platform Admin'`
- company admin by active `company_memberships.access_role = 'Company Admin'`

Anonymous access is explicitly revoked from the helpers and from the Costing RPC surface. The semantic validation function remains restricted to `service_role`.

## Dependency Order

The file guards against existing Costing objects before creating new objects. It then creates required extension/schema/helpers before table policies and RPCs depend on them.

Required existing production dependencies:

- `auth.uid()`
- `auth.jwt()`
- `public.profiles`
- `public.company_memberships`
- `public.companies`
- `auth.users`
- `extensions.pgcrypto`

## Dormant State

The migration is designed to seed Cost Model 001 without activating any company configuration.

Expected after execution:

- Costing tables exist.
- Cost Model 001 exists as dormant infrastructure.
- active Costing configs = 0.
- no company is auto-enabled.
- default costing mode remains `FOB_ONLY` until a Company Admin or Platform Admin explicitly activates a config.

## Risk Areas

- Production execution is still blocked until the approved execution path can run the canonical SQL as a complete artifact.
- `negotiation_rows` remains outside this migration and is intentionally unchanged.
- The current line count differs from a previous note, while bytes and SHA256 match the expected canonical artifact. The hash should be treated as the stronger identity check.

## Certification Result

PASS for static dependency order and helper-security review.

NOT EXECUTED in production.
