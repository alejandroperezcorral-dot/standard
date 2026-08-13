# Cost Model 001

## Purpose

Cost Model 001 formalizes the current operational costing behavior implemented by `cm()` in `index.html`.

CURRENT: The model provides optional cost intelligence for landed cost, IMU, markup, gap, target FOB and transit-day timing support.

CURRENT: STDTEX remains FOB-first. FOB can be used without costing.

## Current Source

CURRENT source of truth:

- `index.html:3756` `frCU(org, tr, u, w, cat)`
- `index.html:3775` `dutyFor(org, cat)`
- `index.html:3787` `cm(r)`
- `index.html:3827` `hodFor(r)`

Cost Model 001 preserves the current behavior instead of correcting or generalizing it.

## Identity

- id: `cost-model-001`
- name: `Cost Model 001`
- version: `1`
- status: `CHARACTERIZED`
- source: `STDTEX internal costing model`

Status is not `HISTORICALLY_VALIDATED` yet because no real historical reference set has been approved for finance validation.

## Default Configuration

Cost Model 001 starts populated with current production defaults. It must not start empty.

| Variable | Current value | Source |
| --- | ---: | --- |
| Insurance | `0.003` | `P.ins` |
| Gross weight uplift | `0.11` | `P.nw2gw` |
| RUB exchange rate | `87` | `P.rub` |
| EUR exchange rate | `1.16` | `P.eur` |
| VAT | `0.2` | `P.tax` |
| Target IMU | `0.72` | `cm()` fallback |
| Fallback duty | `0.13` | `dutyFor()` fallback |
| Default origin | `BANGLADESH` | `cm()` fallback |
| Default transport | `SEA-TRUCK` | `cm()` fallback |

Freight route defaults come from `FR`.

Duty, fixed duty and load-norm defaults come from `DUTIES`.

## Variables

Every commercial assumption is represented by named metadata in `COST_MODEL_001_VARIABLES`.

Metadata includes:

- key
- label
- description
- type
- unit
- defaultValue
- currentValue
- editable
- scope
- category
- validation

This is enough for a future Company Admin settings screen to render variables without handwritten UI logic for every field.

## Formulas

### FOB Priority

`selected FOB = fob_closed || fob3 || fob2 || fob1 || 0`

This preserves legacy JavaScript truthiness. For example numeric `0` falls through, while string `"0"` is truthy.

### Freight Per Unit

`units_per_container = load_norm / (weight * (1 + grossWeightUplift))`

`containers = units / units_per_container`

`freight_per_unit = (freight_route_cost * containers) / units`

If route is missing, freight is `0` and days are `0`.

If weight is missing or zero, freight is `0` and route transit days are still returned.

If category has no matching load norm, freight is `0` and route transit days are still returned.

### Duty

Exact category match by origin/country and category selects the duty row.

If category is empty:

`fixed = 0`

`pct = 0`

If category exists but no matching duty row is found for the origin:

`fixed = 0`

`pct = fallbackDutyRate`

### Customs

`fixed_customs = fixed_eur_per_kg * eurExchangeRate * weight`

`percentage_customs = selected_fob * duty_pct`

`customs = MAX(fixed_customs, percentage_customs)`

### Landed Cost

`landed_cost = selected_fob * (1 + insuranceRate) + freight_per_unit + customs`

Legacy field name: `ldp`.

### Net Retail

`net_retail_usd = pvp_rub / ((1 + vatRate) * rubExchangeRate)`

Legacy field name: `pU`.

### IMU

If `net_retail_usd > 0`:

`imu = (net_retail_usd - landed_cost) / net_retail_usd`

Otherwise:

`imu = 0`

### Markup

If `imu < 1 && imu > -10`:

`markup = imu / (1 - imu)`

Otherwise:

`markup = 0`

Legacy field name: `mu`.

### Gap

`gap = imu - target_imu`

### Target FOB

Fixed-duty inverse branch:

`target_fob_fixed = (net_retail_usd * (1 - target_imu) - freight_per_unit - fixed_customs) / (1 + insuranceRate)`

Percentage-duty inverse branch:

`target_fob_pct = (net_retail_usd * (1 - target_imu) - freight_per_unit) / (1 + insuranceRate + duty_pct)`

Branch choice:

`target_fob = fixed_customs >= duty_pct * MAX(target_fob_fixed, 0) ? target_fob_fixed : target_fob_pct`

Legacy field name: `fobT`.

### HOD / FSD

CURRENT: `hodFor(r)` is still in `index.html`.

If `r.hod` exists, HOD is `r.hod`.

If no HOD and no FSD, HOD is empty.

If FSD exists:

`HOD = FSD - transit_days`

CURRENT UI `calcFSD()` calculates:

`FSD = HOD + transit_days`

The UI may optionally snap FSD to Thursday. This Thursday snapping is UI behavior, not part of the pure Cost Model 001 evaluator.

## Outputs

Cost Model 001 returns current supported outputs:

- selected FOB: `fob`, `selectedFob`
- landed cost: `ldp`, `landedCost`
- net retail USD: `pU`, `netRetailUsd`
- IMU: `imu`
- markup: `mu`, `markup`
- target IMU: `tgt`, `targetImu`
- gap: `gap`
- target FOB: `fobT`, `targetFob`
- freight per unit: `cu`, `freightPerUnit`
- customs/duty: `cust`, `duty`
- customs percentage: `custPct`, `dutyRate`
- transit days: `days`, `transitDays`
- cost basis: `LANDED_COST`
- model id/version/source/status

## Rounding

CURRENT: `cm()` returns raw JavaScript numbers.

CURRENT: Display rounding lives in UI call sites using `.toFixed()`, `fU()`, `fP()` and related formatting helpers.

Cost Model 001 does not move UI rounding into calculation logic.

## Known Non-Universal Assumptions

These are Model 001 defaults, not STDTEX global standards:

- RUB-based retail conversion
- VAT value
- EUR fixed-duty conversion
- fallback duty rate
- freight allocation methodology
- gross weight uplift
- 72% default target IMU
- Russia-style fixed-vs-percentage customs logic

## Scope Architecture

CURRENT: Cost Model 001 uses one global model default.

FUTURE: Configuration can resolve through:

1. model default
2. department override
3. category override
4. optional explicit style override later

The most specific configured value wins.

Departments and categories must come from company configuration/domain data later. They are not hardcoded inside the costing engine.

## Future Company Admin Configuration

FUTURE, NOT IMPLEMENTED:

Company Settings -> Costing -> Cost Models

A Company Admin should eventually be able to:

- select active model
- see variables
- edit values
- add company-specific cost amounts
- configure assumptions
- configure percentages
- configure fixed costs
- configure departments
- configure categories
- assign values by department/category
- create additional models
- activate/deactivate models
- test a model before activation

## Versioning

FUTURE: Changing an active model configuration must create a new version instead of silently rewriting historical commercial decisions.

Historical calculations should retain model id and version so decisions remain explainable.

## Validation Status

CURRENT: Characterization tests compare legacy `cm()` behavior against `evaluateCostModel001()` fixtures.

NOT YET DONE: Real historical validation against 50-100 approved historical styles.

Recommendation after this phase: validate Cost Model 001 against real historical styles before broad runtime replacement.

## Historical Validation

CURRENT STATUS: `AWAITING REAL HISTORICAL REFERENCE DATA`.

Cost Model 001 has been code-characterized, but it is not historically validated yet.

Historical validation must compare Cost Model 001 against outputs produced independently by the original company costing methodology. Reference outputs must not be generated from current `cm()`, `evaluateCostModel001()`, or any implementation derived from this codebase.

### Source Audit

Available local project candidates were inspected in read-only mode:

| Source | Classification | Notes |
| --- | --- | --- |
| `Book1.xlsx` | `UNUSABLE` for full historical validation | Contains `Duty Calculator GJ` with duty/load-norm assumptions. It does not contain style-level historical reference outputs such as LDP, IMU, target FOB, freight per unit and duty results. |
| `FW26 QUOTATION FILE - BOTTOMS.xlsb` | `UNKNOWN_PROVENANCE` | Binary Excel workbook exists locally, but the current approved runtime does not include a safe parser for `.xlsb`. It may be a future candidate only after independent provenance and reference-output columns are confirmed. |
| Current runtime/exported `cm()` values | `DERIVED_FROM_CURRENT_CM` | Useful for code characterization only. Not acceptable as independent historical reference data. |
| Characterization fixtures | `SYNTHETIC` | Useful to protect code behavior. Not acceptable as independent historical reference data. |

No source currently qualifies as `INDEPENDENT_REFERENCE`.

### Required Historical Validation Record

The validation harness expects normalized records with:

- `styleReference`
- `inputs`: available Cost Model 001 inputs such as FOB, RRP/PVP, weight, units, origin, category, department, transport, target IMU, FSD and HOD
- `reference`: independently calculated outputs such as landed cost/LDP, IMU, markup, target FOB, freight per unit, duty and transit days
- `provenance`: source name, source type, source date if known, reference method, currency context and notes

The template is available at:

`docs/templates/cost-model-001-historical-validation-template.csv`

### Tolerance Policy

Tolerances are declared before validation:

| Output type | Tolerance |
| --- | ---: |
| Money values | `0.01` |
| Percentage ratios | `0.0005` |
| Generic ratios | `0.0005` |
| Days | `0` |
| Exact fields | `0` |

Rounding-only matches are reported separately from exact/internal calculation matches.

### Validation Harness

The historical validation harness lives in:

`tools/costing/costModel001HistoricalValidation.js`

It provides:

- source classification helpers
- normalized validation record creation
- external-field mapping into normalized records
- `validateCostModel001(records)` runner
- field-level comparison results: `MATCH`, `ROUNDING_ONLY`, `MISMATCH`, `REFERENCE_MISSING`, `INPUT_MISSING`
- aggregate summary by output

The harness deliberately keeps source-specific column mappings outside the Cost Model 001 formula engine.

### Current Result

Real styles validated: `0`.

Sample size: `0`.

Scenario coverage: not available.

Known mismatches: not evaluated.

Model status remains `CHARACTERIZED`.

### Future Configuration Evidence

No real historical validation evidence is available yet to prove which variables should become Company Admin settings or department/category overrides.

Preliminary candidates to investigate once real data is supplied:

| Variable | Future classification to test |
| --- | --- |
| RUB exchange rate | `LIKELY_TIME_VERSIONED_VALUE` |
| EUR exchange rate | `LIKELY_TIME_VERSIONED_VALUE` |
| VAT | `LIKELY_COMPANY_SETTING` or `LIKELY_TIME_VERSIONED_VALUE` |
| Target IMU | `LIKELY_COMPANY_SETTING`, possibly department/category override |
| Fixed duty | `LIKELY_CATEGORY_OVERRIDE` |
| Percentage duty | `LIKELY_CATEGORY_OVERRIDE` |
| Freight route cost | `LIKELY_TIME_VERSIONED_VALUE` |
| Freight allocation/load norm | `LIKELY_CATEGORY_OVERRIDE` |
| Insurance | `LIKELY_COMPANY_SETTING` |
| Gross weight uplift | `LIKELY_COMPANY_SETTING` or category override |

These are analysis notes only. No settings UI, schema, or formula changes are implemented.
