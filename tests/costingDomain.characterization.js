const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/features/costing/core/costModel001.js',
  'src/features/costing/costResultModel.js',
  'src/features/costing/costConnector.js',
  'src/features/costing/costModel.js',
  'src/features/costing/costService.js',
  'src/features/costing/index.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const style = {
  id: 12,
  supplier: 'STW',
  origin: 'BANGLADESH',
  transport: 'SEA-TRUCK',
  cat: 'Jeans Commercial',
  fob1: 7.45,
  units: 1200,
  weight: 0.71
};

const input = CostingDomain.normalizeInput(style, { destination: 'Russia' });
assert.strictEqual(input.styleId, 12);
assert.strictEqual(input.fob, 7.45);
assert.strictEqual(input.currency, 'USD');
assert.strictEqual(input.quantity, 1200);
assert.strictEqual(input.destination, 'Russia');

const noCost = CostingDomain.createService().estimate(style);
assert.strictEqual(noCost.status, CostingDomain.status.NOT_AVAILABLE);
assert.strictEqual(noCost.source, CostingDomain.sourceType.NONE);
assert.strictEqual(noCost.estimatedLandedCost, null);

const enriched = CostingDomain.createService().enrichStyle(style);
assert.strictEqual(enriched.style, style);
assert.strictEqual(enriched.costingResult.status, CostingDomain.status.NOT_AVAILABLE);

const model = CostingDomain.createModel001Connector({
  metadata: { version: '1.0.0', assumptions: { methodology: 'fixture' } },
  calculate: () => ({
    estimatedLandedCost: 14.728,
    currency: 'USD',
    status: CostingDomain.status.ESTIMATED,
    confidence: 0.9,
    breakdown: { fob: 7.45 }
  })
});
const modeled = CostingDomain.createService(model).estimate(style);
assert.strictEqual(modeled.status, CostingDomain.status.ESTIMATED);
assert.strictEqual(modeled.source, CostingDomain.sourceType.STDTEX_COST_MODEL);
assert.strictEqual(modeled.costModelId, 'cost-model-001');
assert.strictEqual(modeled.costModelVersion, '1.0.0');
assert.strictEqual(modeled.estimatedLandedCost, 14.728);

const characterizedConfig = CostingDomain.createModel001Configuration({
  freightRoutes: {
    'BANGLADESH|SEA-TRUCK': { cost: 9162, days: 65 }
  },
  dutyRows: [
    { country: 'BANGLADESH', cat: 'Jeans Commercial', fixed: 1.9, pct: 0.1, load_norm: 13000 }
  ]
});
const characterizedModel = CostingDomain.createModel001Connector({ configuration: characterizedConfig });
const characterized = characterizedModel.estimate({
  pvp_rub: 3499,
  fob1: 7.45,
  origin: 'BANGLADESH',
  transport: 'SEA-TRUCK',
  cat: 'Jeans Commercial',
  units: 1200,
  weight: 0.71
});
assert.strictEqual(characterized.status, CostingDomain.status.ESTIMATED);
assert.strictEqual(characterized.source, CostingDomain.sourceType.STDTEX_COST_MODEL);
assert.strictEqual(characterized.costModelId, 'cost-model-001');
assert.strictEqual(characterized.costModelVersion, 1);
assert.ok(characterized.estimatedLandedCost > 0);

console.log('costing domain characterization ok');
