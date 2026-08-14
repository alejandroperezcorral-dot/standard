# Secure Costing Service Contract

This is the pre-Edge contract for the future STDTEX secure costing service.
It is documentation only. No Edge Function, Supabase mutation, RLS change, `negotiation_rows` change, UI change or deployment is included in this checkpoint.

## Target Runtime Boundary

The future service should follow this path:

1. Buyer or company member requests costing for one or more style ids.
2. Server verifies the Supabase JWT.
3. Server derives the user, company, role and group context.
4. Server loads only authorized style data.
5. Server loads the active private company costing configuration.
6. Server normalizes context: season, department, category and origin.
7. Server resolves Cost Model 001 configuration.
8. Server evaluates the same portable Cost Model 001 engine used by browser compatibility.
9. Server returns Cost Result only.

Raw costing configuration must not be exposed to normal buyers.

## Request Shape

The browser should eventually send a minimal request:

```json
{
  "styleIds": ["style-id-1", "style-id-2"],
  "costModel": "cost-model-001",
  "configuration": "CURRENT"
}
```

The browser may supply requested ids and display context, but it must not supply trusted calculation inputs or company identity.

## Trusted Inputs

The server must load or validate these fields from authorized STDTEX data:

- `pvp_rub`
- `fob1`
- `fob2`
- `fob3`
- `fob_closed`
- `target_imu`
- `origin`
- `transport`
- `units`
- `weight`
- `cat`
- `dept`
- `temporada`
- `fsd`
- `hod`
- `currency`

Legacy mappings remain explicit:

- `cat` maps to domain `category`.
- `dept` maps to domain `department`.
- `temporada` maps to domain `season`.
- `transport` maps to domain `transportMode`.

Department and Category are different dimensions. They must not be merged or inferred from each other.

## Cost Model 001 Formula Source

There must be one authoritative formula implementation:

- `src/features/costing/core/costModel001.js`

Current browser compatibility keeps:

- `src/features/costing/costModel.js` as the global adapter.
- `cm(row)` in `index.html` as the legacy facade.

The evaluator must not know whether configuration came from legacy `P/FR/DUTIES`, Company Costing Settings or a future Edge source.

## Legacy Config Adapter

Current browser runtime still adapts:

- `P`
- `FR`
- `DUTIES`

into the same Cost Model 001 configuration shape.

This remains compatibility-only and must not be treated as the future secure server source.

## Future Private Config Adapter

The future server adapter should map:

- active company costing settings
- active freight routes
- active duty rows
- season/category/origin overrides

into the same configuration shape consumed by `CostModel001Core.evaluateCostModel001()`.

## Trust Classification

| Field or object | Classification |
| --- | --- |
| Authenticated user id | SERVER_AUTHORITATIVE |
| Company id | SERVER_AUTHORITATIVE |
| Company role | SERVER_AUTHORITATIVE |
| Group membership | SERVER_AUTHORITATIVE |
| Style id requested by browser | CLIENT_TRANSIENT |
| Style calculation input loaded from authorized rows | SERVER_AUTHORITATIVE |
| `origin`, `category`, `department`, `season` when stored on style | SERVER_AUTHORITATIVE |
| Active company cost configuration | CONFIG_PRIVATE |
| FX, VAT, insurance, freight routes, duty rows | CONFIG_PRIVATE |
| LDP, IMU, markup, gap, target FOB | DERIVED |
| Cost result returned to client | DERIVED |

## Current RLS Finding

The secure costing audit observed this staging behavior with real JWTs:

- Company A Admin: 10 `negotiation_rows` visible.
- Company A Member: 0 `negotiation_rows` visible.
- Platform Admin: 10 `negotiation_rows` visible.

The rows currently use the Company Admin's `user_id`.

That means `negotiation_rows.user_id` currently behaves at least partly as creator or legacy owner, not a complete company-level authorization boundary.

The future service must not simply grant all company members raw `negotiation_rows` access. Costing requires its own deliberate server authorization contract.

## Style Authorization Options

### Option A: Edge service role with explicit authorization

The Edge Function verifies JWT, derives company membership, then uses service-role access only after applying STDTEX business authorization in server code.

Security: high if implemented carefully.
Consistency: high because business rules can match the application.
Complexity: medium.
Risk: medium because service-role code must be small and heavily tested.

### Option B: Dedicated secure RPC/view

Create a database RPC or view that returns only authorized style costing inputs for the current authenticated company context.

Security: high.
Consistency: high if it reuses Organization Security functions.
Complexity: medium-high.
Risk: lower at runtime, higher during SQL rollout.

### Option C: Broaden `negotiation_rows` RLS

Change `negotiation_rows` RLS to company-level semantics so browser users can read all company rows directly.

Security: risky.
Consistency: uncertain.
Complexity: medium.
Risk: high because it may expose broad row data beyond costing needs.

## Recommendation

Prefer Option B for the long-term data-access boundary, or Option A as a tightly scoped first implementation if speed is needed.

Do not use Option C as the first secure costing implementation.

The next phase should prove the authorization query/RPC with staging JWTs before exposing any costing endpoint to production users.

## Response Shape

The future server response should return Cost Result only:

```json
{
  "results": [
    {
      "styleId": "style-id-1",
      "costModelId": "cost-model-001",
      "costModelVersion": 1,
      "fob": 7.45,
      "landedCost": 9.12,
      "imu": 0.734,
      "targetImu": 0.72,
      "gap": 0.014,
      "targetFob": 7.88,
      "status": "ESTIMATED"
    }
  ]
}
```

It must not return raw freight route tables, duty tables, private FX assumptions or full company config.

## Stop Gate

Ready to implement the secure Costing Edge service only when:

1. Cost Model 001 is portable/importable.
2. The browser still uses the same formula source.
3. `cm(row)` compatibility passes.
4. The complete input contract is documented and tested.
5. Department and Category remain separate.
6. Legacy `P/FR/DUTIES` and future private config map to the same domain shape.
7. Style authorization is implemented server-side without broadening raw buyer access.
