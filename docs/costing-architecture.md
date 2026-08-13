# STDTEX Costing Architecture

## Core Boundary

CURRENT: STDTEX owns the buying decision flow: Supplier -> Explore -> Collections -> Negotiation -> Select -> Connect.

CURRENT: FOB is the universal native commercial cost field. Existing rows store supplier offers in `fob1`, `fob2`, `fob3`, and the final agreed price in `fob_closed`.

FUTURE: Landed cost is optional cost intelligence. It must enrich the decision layer without turning STDTEX into a logistics platform, freight marketplace, customs platform, ERP, PLM, or production management system.

## Current Calculation Inventory

CURRENT: Runtime calculation is embedded in `index.html` in `frCU`, `dutyFor`, and `cm`.

CURRENT formula source data:

- `P`: exchange and costing constants.
- `FR`: freight route costs and transit days by origin and transport mode.
- `DUTIES`: country/category duty rows with fixed EUR/kg, FOB percentage, and load norms.
- `negotiation_rows`: style rows with FOB, RRP, origin, transport, category, units, weight, target IMU, status, FSD and HOD fields.

CURRENT formulas:

- Active FOB: `fob_closed || fob3 || fob2 || fob1 || 0`.
- Freight units per container: `load_norm / (weight * (1 + P.nw2gw))`.
- Fractional containers: `units / units_per_container`.
- Freight per unit: `(freight_route_cost * fractional_containers) / units`.
- Fixed customs: `fixed_eur_per_kg * P.eur * weight`.
- Percent customs: `fob * duty_pct`.
- Customs per unit: `MAX(fixed_customs, percent_customs)`.
- LDP: `fob * (1 + P.ins) + freight_per_unit + customs_per_unit`.
- Net retail in USD: `pvp_rub / ((1 + P.tax) * P.rub)`.
- IMU: `(net_retail_usd - ldp) / net_retail_usd`.
- Markup: `imu / (1 - imu)` when the IMU is in a bounded range.
- Target IMU: row `target_imu`, default `0.72`.
- Gap: `imu - target_imu`.
- FOB target fixed-duty branch: `(net_retail_usd * (1 - target_imu) - freight_per_unit - fixed_customs) / (1 + P.ins)`.
- FOB target percent-duty branch: `(net_retail_usd * (1 - target_imu) - freight_per_unit) / (1 + P.ins + duty_pct)`.
- FOB target branch choice: fixed branch when fixed customs dominates the percent duty at the candidate FOB; otherwise percent branch.
- HOD from FSD: `FSD - transit_days`.
- FSD from HOD: `HOD + transit_days`, optionally snapped to Thursday in the UI.

CURRENT hardcoded/default assumptions:

- Insurance ratio default: `0.003`.
- Net-to-gross weight uplift default: `0.11`.
- USD/RUB default: `87`.
- EUR/USD default: `1.16`.
- VAT/tax default: `0.2`.
- Target IMU default: `0.72`.
- Fallback duty if origin exists but category does not match: `13%` FOB.
- Missing weight disables freight allocation and fixed-duty customs.
- Missing category disables category-specific duty and load-norm matching.
- Freight routes and duty/load norms are editable in settings but are still directly consumed by the monolithic calculation.

## Classification

CORE COMMERCIAL INPUT:

- FOB offers and closed FOB.
- Supplier.
- Origin.
- Quantity.
- Category.
- Weight when provided.
- RRP and target IMU as commercial planning inputs.

COST ENGINE OUTPUT:

- Estimated landed cost.
- Freight per unit.
- Customs duties.
- Insurance component.
- Cost source, status, timestamp, confidence, and breakdown.

DECISION DERIVED METRIC:

- IMU.
- Markup.
- Target gap.
- Target FOB.

UNKNOWN / PRODUCT DECISION:

- Whether future company-specific IMU should use FOB, landed cost, ERP cost, or another company-defined cost basis.
- Which company roles can activate or edit costing models.
- Which existing Russia/GJ calculation should become Cost Model 001 after a real reference methodology is formally approved.

## Cost Connector

CURRENT: The new `src/features/costing` boundary defines a connector contract only. It does not replace `cm`, change Negotiation, call Supabase, or alter UI behavior.

FUTURE connector input:

- `styleId`
- `supplier`
- `origin`
- `fob`
- `currency`
- `quantity`
- `category`
- `weight`
- `cbm`
- `destination`
- `transportMode`
- `incoterm`

FUTURE connector output:

- `estimatedLandedCost`
- `currency`
- `status`
- `source`
- `timestamp`
- `confidence`
- `breakdown`
- `costModelId`
- `costModelVersion`
- `errors`

## Cost Result

CURRENT statuses:

- `NOT_AVAILABLE`
- `ESTIMATED`
- `CONFIRMED`
- `STALE`
- `ERROR`

CURRENT source types:

- `NONE`
- `STDTEX_COST_MODEL`
- `ERP`
- `COMPANY_MODEL`
- `CUSTOM_API`
- `THIRD_PARTY`

FUTURE: Buyer UI should display landed cost only when the result is available and appropriately qualified. Estimated values must not appear as absolute truth.

## Cost Model 001

CURRENT: `Cost Model 001` is the formal characterization of the operational `cm()` methodology in `index.html`.

CURRENT files:

- `src/features/costing/costModel.js`
- `docs/cost-model-001.md`
- `tests/costModel001.characterization.js`

CURRENT status: `CHARACTERIZED`.

CURRENT: partial FW26 historical validation exists for bottoms. It proves the formula structure and the need for versioned origin/category Duty configuration, while two source Duty references remain unavailable.

CURRENT: The pure evaluator is `evaluateCostModel001(input, resolvedConfiguration)`. It has no DOM dependency, no Supabase dependency, no routing dependency, no mutable global state dependency and no side effects.

CURRENT: `resolveCostModelConfiguration` separates formula from configuration. It can apply deterministic time-scoped origin/category duty overrides before the evaluator runs.

CURRENT: `CostModel001Connector` can call the evaluator and map the result into `CostResult`.

CURRENT: Runtime `cm()` remains the live commercial source until parity and regression are explicitly accepted.

All business assumptions are named configuration fields. No unexplained costing magic numbers should live in UI or feature renderers.

## Company Cost Models

CURRENT: Costing has one characterized model, Cost Model 001.

FUTURE, NOT IMPLEMENTED: a company may select an active cost source:

- STDTEX Cost Model 001
- another STDTEX cost model
- company model
- ERP
- custom API
- third-party provider

The future domain API should support:

- `getAvailableCostModels(companyId)`
- `getActiveCostModel(companyId)`
- `setActiveCostModel(companyId, modelId)`

For now, local/domain behavior can default to Cost Model 001 when costing is enabled.

## Future Company Admin Settings

FUTURE, NOT IMPLEMENTED:

Company Settings -> Costing -> Cost Models

Conceptual screen:

- Cost Model selector
- Status
- Version
- General variables
- Logistics variables
- Duties variables
- Timing variables
- Additional costs
- Scopes
- Test model
- Save draft
- Activate version

Company Admin should eventually be able to select a model, view variables, edit values, add cost components, define scope, test the model, activate a model, duplicate a model and version a model.

PLATFORM ADMIN can inspect/manage platform-level capabilities.

Normal members and buyers should consume results, not manage cost model configuration, unless future permissions explicitly allow it.

## Variable Metadata

CURRENT: Cost Model 001 variables expose metadata sufficient for a future settings UI:

- key
- label
- description
- type
- unit
- defaultValue
- currentValue
- editable
- scope
- category/group
- validation

Only variables proven by current Model 001 behavior are included.

## Scopes and Inheritance

CURRENT: Cost Model 001 resolves configuration through:

1. model default
2. time-scoped origin/category duty override

The first implemented time key is `season`, because the FW26 historical workbook proves an FW26 configuration but does not prove exact effective-date boundaries.

FUTURE, NOT IMPLEMENTED: configuration may later resolve through company, department, category and explicit style scopes when evidence justifies them. Department is `FUTURE / EVIDENCE PENDING`.

Departments and categories must come from company configuration/domain data. They must not be hardcoded into the costing engine.

Do not duplicate a full model per department/category. Use base configuration plus scoped overrides.

Historical FW26 bottoms duty validation provides evidence that duty configuration needs origin/category and time-versioned override support. The repeated differences were in `VIETNAM / Pants Commercial` and `BANGLADESH / Jeans Color`; the formula structure itself remained the same max fixed-vs-percentage duty method.

Architecture:

`Cost Model -> Configuration Version -> Scope Resolution -> Effective Assumptions -> Evaluator`

Model version and configuration version are different:

- model version changes when formula/business logic changes;
- configuration version changes when assumptions change while formula stays stable.

Future explanation target:

- Cost Model: `Cost Model 001`
- Formula version: `1`
- Configuration: `FW26`
- Scope: `Vietnam / Pants Commercial`
- Duty method: `MAX_FIXED_VS_PERCENT`
- Source: historical company methodology

## Additional Cost Components

FUTURE, NOT IMPLEMENTED: Company Admin may add simple named cost components such as:

- Handling Fee
- Quality Control
- Agent Commission
- Financial Cost
- Warehouse Fee
- Testing Cost
- Custom Cost

Each future component may need:

- id
- name
- type
- value
- currency
- percentage basis
- scope
- enabled

Do not implement arbitrary formulas yet.

## Versioning Safety

CURRENT DESIGN: changing an active model configuration must not silently rewrite historical commercial decisions.

Admin edits should create a new version:

- Cost Model 001 formula v1
- Configuration `CURRENT`
- Admin changes values
- Configuration `CURRENT-2` or another explicit version

Future calculations use the newly activated configuration. Historical calculations can retain model id, formula version and configuration version for explainability.

## Model Evolution

FUTURE:

1. Implement Model 001 from one real methodology.
2. Validate it against historical reference calculations.
3. Implement Model 002 from another real company methodology.
4. Compare differences.
5. Generalize only from observed patterns.
6. Consider a universal cost model engine only after multiple real models prove what should be generalized.

Do not build a drag-and-drop formula builder, arbitrary scripting layer, large rules engine, or universal logistics configurator from assumptions.

## Buyer UI Principles

CURRENT: Negotiation shows FOB, LDP, IMU, target FOB and gap directly from the embedded formula.

FUTURE: Normal buyer UI should stay simple:

- FOB: always available when entered.
- Estimated Landed Cost: shown only when a costing source is configured.
- IMU / margin: shown with explicit cost basis.

Do not expose container cost, packing density, freight tables, duty formulas, insurance, customs rules, or allocation formulas by default in the buyer workflow.

## Future Settings

FUTURE: Company Settings may later include Costing Models:

- View active model.
- Test model.
- Activate model.
- Review assumptions.
- Inspect last calculation status.

Permissions are a product decision. Potential roles: Company Admin, Finance, Logistics, Platform Admin.

## External Integrations

FUTURE: The connector contract should support cost intelligence from:

- STDTEX internal cost model.
- ERP.
- Company methodology.
- Custom API.
- Third-party forwarder or customs provider.

STDTEX UI should not care which provider produced the result.

## PLM / ERP Boundary

CURRENT AND FUTURE: STDTEX answers what should be bought. After selection, PLM or ERP can manage development, production, shipment, compliance, and financial posting.

This costing boundary must not extend into sampling, tech packs, production workflows, shipment management, or compliance workflows.

## Proposed Data Model - Design Only

DO NOT MIGRATE YET.

Possible future tables:

- `cost_models`: stable model identity and owner.
- `cost_model_versions`: formula/business-logic versions.
- `cost_config_versions`: named assumption sets such as `CURRENT` or `FW26`, with status, owner, active flag and immutable historical versions.
- `cost_config_overrides`: scoped assumptions for a configuration version, including period, scope dimensions and values.
- `company_costing_settings`: active model per company or group.
- `style_cost_estimates`: latest and historical costing outputs by style.
- `cost_model_inputs`: optional snapshot of inputs used for reproducible validation.

Minimum concepts:

- model identity
- formula version
- configuration version
- company ownership
- effective period or season
- scope dimensions such as origin/category
- values such as fixed duty and duty percent
- status and activation
- auditability and immutable validated history

Minimum viable DB design should be proposed only after Model 001 has real reference data and authorization rules are settled.

## Validation Strategy

CURRENT: `tests/costingDomain.characterization.js` validates the new boundary is inert, source-agnostic, and can return `NOT_AVAILABLE` without breaking STDTEX.

FUTURE Model 001 validation:

- Load historical style fixtures.
- Compare existing company result against STDTEX Cost Model 001 result.
- Require exact or tolerance-based matches according to finance-approved rules.
- Preserve source, timestamp, assumptions and model version for auditability.

Example target:

- Existing result: `14.728`
- STDTEX engine result: `14.728`
- Status: `MATCH`

Do not claim Model 001 is validated until real reference calculations are available.
