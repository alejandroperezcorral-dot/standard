const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/features/costing/costResultModel.js',
  'src/features/costing/costConnector.js',
  'src/features/costing/costModel.js',
  'src/features/costing/costService.js',
  'src/features/costing/index.js'
].forEach((file) => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const baseConfiguration = CostingDomain.createModel001Configuration({
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
    'VIETNAM|SEA-TRUCK': { cost: 0, days: 44 },
    'BANGLADESH|SEA-TRUCK': { cost: 0, days: 65 }
  },
  dutyRows: [
    { country: 'Vietnam', dept: 'Pants', cat: 'Pants Commercial', fixed: 0, pct: 0, load_norm: 10000 },
    { country: 'Vietnam', dept: 'Jackets', cat: 'Jct Nondenim', fixed: 2.25, pct: 0.1, load_norm: 11000 },
    { country: 'Bangladesh', dept: 'Jeans', cat: 'Jeans Color', fixed: 2.25, pct: 0.1, load_norm: 10000 },
    { country: 'Bangladesh', dept: 'Jeans', cat: 'Jeans Commercial', fixed: 1.9, pct: 0.13, load_norm: 12000 }
  ],
  dutyOverrides: CostingDomain.createModel001Fw26DutyOverrides()
});

function resolveDuty(context) {
  const resolved = CostingDomain.resolveModelConfiguration({ model: baseConfiguration, context });
  const duty = CostingDomain.evaluateModel001({
    fob: 5,
    pvp_rub: 3499,
    weight: 0.2,
    units: 1000,
    origin: context.origin,
    transport: 'SEA-TRUCK',
    cat: context.category
  }, resolved).duty;
  return { resolved, duty };
}

const currentVietnamPants = resolveDuty({ origin: 'VIETNAM', category: 'Pants Commercial' });
assert.strictEqual(currentVietnamPants.duty, 0);
assert.strictEqual(currentVietnamPants.resolved.configurationVersion, 'CURRENT');
assert.strictEqual(currentVietnamPants.resolved.resolutionTrace.length, 1);

const fw26VietnamPants = resolveDuty({ season: 'FW26', origin: 'VIETNAM', category: 'Pants Commercial' });
assert.ok(Math.abs(fw26VietnamPants.duty - 0.5104) < 1e-12);
assert.strictEqual(fw26VietnamPants.resolved.configurationVersion, 'FW26');
assert.strictEqual(fw26VietnamPants.resolved.resolutionTrace[1].id, 'fw26-vietnam-pants-commercial-duty');

const fw26VietnamJackets = resolveDuty({ season: 'FW26', origin: 'VIETNAM', category: 'Jct Nondenim' });
assert.ok(Math.abs(fw26VietnamJackets.duty - 0.522) < 1e-12);
assert.strictEqual(fw26VietnamJackets.resolved.resolutionTrace[1].id, 'fw26-vietnam-jct-nondenim-duty');

const fw26BangladeshJeans = resolveDuty({ season: 'FW26', origin: 'BANGLADESH', category: 'Jeans Color' });
assert.ok(Math.abs(fw26BangladeshJeans.duty - 0.5) < 1e-12);
assert.strictEqual(fw26BangladeshJeans.resolved.resolutionTrace[1].id, 'fw26-bangladesh-jeans-color-duty');

const wrongPeriod = resolveDuty({ season: 'SS27', origin: 'VIETNAM', category: 'Pants Commercial' });
assert.strictEqual(wrongPeriod.duty, 0);
assert.strictEqual(wrongPeriod.resolved.configurationVersion, 'CURRENT');
assert.strictEqual(wrongPeriod.resolved.resolutionTrace.length, 1);

const unmatchedScope = resolveDuty({ season: 'FW26', origin: 'BANGLADESH', category: 'Jeans Commercial' });
assert.strictEqual(unmatchedScope.resolved.resolutionTrace.length, 1);
assert.ok(Math.abs(unmatchedScope.duty - 0.65) < 1e-12);

console.log('cost model 001 versioned duty configuration ok');
