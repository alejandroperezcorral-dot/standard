# Cost Model 001 Pre-Edge Contract

This document freezes the portable Cost Model 001 boundary before any Edge Function work.
It is a contract note only. It does not change Supabase, RLS, `negotiation_rows`, UI, permissions or runtime behavior.

## Current Runtime Contract

The browser `cm(row)` function delegates to Cost Model 001 with the same formula and legacy coercion rules that existed before extraction.

Input fields currently consumed by the formula:

| Contract field | Current row field / aliases | Formula usage | Default |
| --- | --- | --- | --- |
| `pvp_rub` | `pvp_rub` | Net retail USD: `pvp_rub / ((1 + vatRate) * rubExchangeRate)` | `0` |
| `fob_closed` | `fob_closed` | First FOB candidate | Falls through |
| `fob3` | `fob3` | Second FOB candidate | Falls through |
| `fob2` | `fob2` | Third FOB candidate | Falls through |
| `fob1` | `fob1` | Fourth FOB candidate | Falls through |
| `fob` | `fob` | Final FOB candidate | `0` |
| `target_imu` | `target_imu` | Target gap and target FOB | config `targetImu` |
| `origin` | `origin` | Freight and duty lookup | config `defaultOrigin` |
| `transport` | `transport`, `transportMode` | Freight lookup | config `defaultTransportMode` |
| `units` | `units`, `quantity` | Freight denominator | `1` |
| `weight` | `weight` | Fixed customs and gross weight | `0` |
| `cat` | `cat`, `category` | Duty and freight context | empty string |

Normalized context fields preserved for future server-side resolution:

| Context field | Current row field / aliases | Current formula behavior |
| --- | --- | --- |
| `season` | `temporada`, `season` | Preserved for configuration overrides, not a direct arithmetic input |
| `department` | `dept`, `department` | Preserved independently from category, not currently used for overrides |
| `category` | `cat`, `category` | Used for duty and freight lookup |
| `origin` | `origin` | Used for duty and freight lookup |

Additional normalized metadata retained but not used directly by the current formula:

| Field | Purpose |
| --- | --- |
| `styleId` | Stable style identity for future server-side authorization |
| `supplier` | Display and context |
| `fsd` | Future delivery / collection context |
| `hod` | Future hand-over date context |
| `currency` | Display and future multi-currency context |
| `destination` | Future route context |
| `incoterm` | Future costing context |

## Trust Boundary

Cost Model 001 has four data classes:

| Class | Examples | Rule |
| --- | --- | --- |
| Trusted style data | FOB history, PVP RUB, origin, transport, units, weight, department, category, season | Future Edge runtime must load or validate this server-side for authorized styles |
| Private configuration | FX, VAT, insurance, freight routes, duty rows, overrides | Must remain server-controlled before exposing any Edge endpoint |
| Client context | Requested style ids, selected costing version, display-only route context | May guide the request, but cannot grant access |
| Cost result | FOB selected, landed cost, IMU, target FOB, freight, duty, gap | Derived output only; it must not leak raw private config beyond existing visible values |

## Department and Category Rule

Department and category are independent fields.

The current model uses category for duty and freight lookup. Department is preserved in the normalized context so future resolvers can support department-specific rules without overloading category names.

No department-specific rule is implemented in this phase.

## Proposed Server-Side Authorization Contract

This is a future contract only. It is not implemented in this phase.

A future Edge Function should accept only a small request:

```json
{
  "styleIds": ["..."],
  "costModel": "cost-model-001",
  "configuration": "CURRENT"
}
```

The server must:

1. Verify the Supabase JWT.
2. Resolve the authenticated user id.
3. Resolve company membership, company type and platform-admin status through existing Organization Security RPCs.
4. Load requested styles from `negotiation_rows` only after authorization.
5. Permit platform admins to cost any style.
6. Permit company users only where the style belongs to their company scope or is explicitly shared with their company/group.
7. Permit supplier users only for styles owned by or assigned to their supplier company scope.
8. Omit or reject unauthorized style ids without exposing whether hidden rows exist.
9. Evaluate Cost Model 001 using server-owned configuration.
10. Return a result keyed by style id without raw private configuration.

The function must not broaden RLS, trust client-supplied company ids, or read `negotiation_rows` directly as an anonymous/public user.

## Staging Authorization Finding

During the secure costing audit, staging showed a correct blocker:

- Platform admin could see the full sample style set.
- Company A admin could see the sample rows tied to that company context.
- Company A member could not read those same rows directly through broad `negotiation_rows` selects.

This means the future costing endpoint must use a server-side authorization path instead of relying on browser-side row filtering.

## Output Boundary

Cost Model 001 result fields remain compatible with current browser usage:

| Result field | Meaning |
| --- | --- |
| `fob`, `selectedFob` | FOB selected by legacy priority |
| `ldp`, `landedCost`, `estimatedLandedCost` | Landed cost |
| `pU`, `netRetailUsd` | Net retail USD |
| `imu` | IMU |
| `mu`, `markup` | Markup |
| `tgt`, `targetImu` | Target IMU |
| `gap` | IMU gap vs target |
| `fobT`, `targetFob` | Target FOB |
| `cu`, `freightPerUnit` | Freight cost per unit |
| `duty`, `customs`, `dutyPercent`, `customsPct` | Customs details already visible in current model output |
| `context` | Normalized season / department / category / origin context |

## Explicitly Out Of Scope

- No Edge Function.
- No Supabase schema change.
- No RLS change.
- No `negotiation_rows` change.
- No UI change.
- No permission change.
- No private costing configuration exposure.
- No department-specific resolver behavior.
- No migration away from the current browser `cm(row)` behavior.
