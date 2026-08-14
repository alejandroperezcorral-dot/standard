const assert = require('assert');
const core = require('../src/features/costing/core/costModel001.js');

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, got ${actual}`);
}

function legacyEvaluate(input, configuration) {
  const assumptions = configuration.assumptions;
  const fob = input.fob_closed || input.fob3 || input.fob2 || input.fob1 || input.fob || 0;
  const pvp = input.pvp_rub || 0;
  const origin = input.origin || assumptions.defaultOrigin;
  const transport = input.transport || input.transportMode || assumptions.defaultTransportMode;
  const units = input.units || input.quantity || 1;
  const weight = input.weight || 0;
  const category = input.cat || input.category || '';
  const freight = core.costModel001FreightPerUnit(origin, transport, units, weight, category, configuration);
  const duty = core.costModel001DutyFor(origin, category, configuration);
  const fixedCustoms = weight ? duty.fixed * assumptions.eurExchangeRate * weight : 0;
  const percentageCustoms = fob * duty.pct;
  const customs = Math.max(fixedCustoms, percentageCustoms);
  const landedCost = fob * (1 + assumptions.insuranceRate) + freight.costPerUnit + customs;
  const netRetailUsd = pvp / ((1 + (assumptions.vatRate || 0.2)) * assumptions.rubExchangeRate);
  const imu = netRetailUsd > 0 ? (netRetailUsd - landedCost) / netRetailUsd : 0;
  const targetImu = input.target_imu || assumptions.targetImu;
  return {
    fob,
    landedCost,
    pU: netRetailUsd,
    imu,
    targetImu,
    gap: imu - targetImu,
    customs,
    freightPerUnit: freight.costPerUnit
  };
}

const configuration = core.createCostModel001Configuration({
  assumptions: {
    insuranceRate: 0.003,
    grossWeightUplift: 0.11,
    rubExchangeRate: 87,
    eurExchangeRate: 1.16,
    vatRate: 0.2,
    targetImu: 0.72,
    fallbackDutyRate: 0.13,
    defaultOrigin: 'BANGLADESH',
    defaultTransportMode: 'SEA-TRUCK'
  },
  freightRoutes: {
    'BANGLADESH|SEA-TRUCK': { cost: 9162, days: 65 },
    'VIETNAM|SEA-TRUCK': { cost: 0, days: 44 }
  },
  dutyRows: [
    { country: 'BANGLADESH', cat: 'Jeans Color', fixed: 2.25, pct: 0.1, load_norm: 10000 },
    { country: 'VIETNAM', cat: 'Pants Commercial', fixed: 0, pct: 0.13, load_norm: 10000 },
    { country: 'VIETNAM', cat: 'Jct Nondenim', fixed: 0, pct: 0.13, load_norm: 10000 }
  ],
  dutyOverrides: core.createCostModel001Fw26DutyOverrides()
});

const normalized = core.normalizeCostingInput({
  id: 'style-1',
  supplier: 'STW',
  pvp_rub: 3499,
  pvp: 9999,
  fob1: 7.45,
  target_imu: 0.7,
  origin: 'BANGLADESH',
  transport: 'SEA-TRUCK',
  units: 1200,
  quantity: 999,
  weight: 0.71,
  cat: 'Jeans Color',
  category: 'Ignored category alias',
  dept: 'Denim',
  department: 'Ignored department alias',
  temporada: 'FW26',
  fsd: '2026-12-23',
  hod: '2026-09-30',
  currency: 'USD'
});

assert.strictEqual(normalized.styleId, 'style-1');
assert.strictEqual(normalized.pvp_rub, 3499);
assert.strictEqual(normalized.fob, 7.45);
assert.strictEqual(normalized.target_imu, 0.7);
assert.strictEqual(normalized.cat, 'Jeans Color');
assert.strictEqual(normalized.category, 'Jeans Color');
assert.strictEqual(normalized.dept, 'Denim');
assert.strictEqual(normalized.department, 'Denim');
assert.strictEqual(normalized.temporada, 'FW26');
assert.strictEqual(normalized.season, 'FW26');
assert.strictEqual(normalized.fsd, '2026-12-23');
assert.strictEqual(normalized.hod, '2026-09-30');

const legacyInput = {
  pvp_rub: 3499,
  pvp: 9999,
  fob_closed: 0,
  fob3: '',
  fob2: null,
  fob1: 7.45,
  fob: 3,
  target_imu: 0.7,
  origin: 'BANGLADESH',
  transport: 'SEA-TRUCK',
  units: 1200,
  quantity: 999,
  weight: 0.71,
  cat: 'Jeans Color',
  dept: 'Denim',
  temporada: 'FW26'
};
const portable = core.evaluateCostModel001(legacyInput, configuration);
const legacy = legacyEvaluate(legacyInput, configuration);
close(portable.fob, legacy.fob, 'FOB priority');
close(portable.pU, legacy.pU, 'net retail USD');
close(portable.landedCost, legacy.landedCost, 'landed cost');
close(portable.imu, legacy.imu, 'IMU');
close(portable.targetImu, legacy.targetImu, 'target IMU');
close(portable.gap, legacy.gap, 'target gap');

const pvpOnly = core.evaluateCostModel001({ pvp: 3499, fob1: 7.45 }, configuration);
assert.strictEqual(pvpOnly.pU, 0, 'legacy cm ignores pvp unless pvp_rub is present');

const contextA = core.normalizeCostingContext({
  season: 'FW26',
  department: 'Menswear',
  category: 'Pants Commercial',
  origin: 'Vietnam'
});
const contextB = core.normalizeCostingContext({
  season: 'FW26',
  department: 'Kidswear',
  category: 'Pants Commercial',
  origin: 'Vietnam'
});
assert.strictEqual(contextA.category, 'Pants Commercial');
assert.strictEqual(contextA.department, 'Menswear');
assert.strictEqual(contextB.department, 'Kidswear');

const resolvedA = core.resolveCostModelConfiguration({ model: configuration, context: contextA });
const resolvedB = core.resolveCostModelConfiguration({ model: configuration, context: contextB });
assert.deepStrictEqual(resolvedA.dutyRows, resolvedB.dutyRows, 'department is preserved but does not change current duty resolution');

const vietnamPantsDuty = core.costModel001DutyFor('VIETNAM', 'Pants Commercial', resolvedA);
assert.strictEqual(vietnamPantsDuty.fixed, 2.2);
assert.strictEqual(vietnamPantsDuty.pct, 0);

const vietnamJacketResolved = core.resolveCostModelConfiguration({
  model: configuration,
  context: { season: 'FW26', origin: 'Vietnam', category: 'Jct Nondenim', department: 'Jackets' }
});
const vietnamJacketDuty = core.costModel001DutyFor('VIETNAM', 'Jct Nondenim', vietnamJacketResolved);
assert.strictEqual(vietnamJacketDuty.fixed, 2.25);
assert.strictEqual(vietnamJacketDuty.pct, 0.1);

console.log('costModel001Portable characterization passed');
