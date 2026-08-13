const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const {
  HistoricalSourceClassification,
  HistoricalValidationResult,
  normalizeHistoricalValidationRecord,
  validateCostModel001,
  classifyHistoricalSource
} = require('../tools/costing/costModel001HistoricalValidation');

[
  'src/features/costing/costResultModel.js',
  'src/features/costing/costConnector.js',
  'src/features/costing/costModel.js',
  'src/features/costing/costService.js',
  'src/features/costing/index.js'
].forEach((file) => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const config = CostingDomain.createModel001Configuration({
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
    'BANGLADESH|SEA-TRUCK': { cost: 9162, days: 65 }
  },
  dutyRows: [
    { country: 'Bangladesh', cat: 'Jeans Commercial', fixed: 1.9, pct: 0.13, load_norm: 12000 }
  ]
});

const inputs = {
  fob1: 5.9,
  pvp_rub: 3499,
  origin: 'BANGLADESH',
  transport: 'SEA-TRUCK',
  cat: 'Jeans Commercial',
  units: 1200,
  weight: 0.71,
  target_imu: 0.72
};
const expected = CostingDomain.evaluateModel001(inputs, config);

const validation = validateCostModel001([
  {
    styleReference: 'SYNTHETIC-HARNESS-001',
    inputs,
    reference: {
      landedCost: expected.landedCost,
      imu: expected.imu,
      targetFob: expected.targetFob,
      freightPerUnit: expected.freightPerUnit,
      duty: expected.duty,
      transitDays: expected.transitDays
    },
    provenance: {
      sourceName: 'Synthetic harness fixture',
      sourceType: HistoricalSourceClassification.SYNTHETIC,
      referenceMethod: 'Generated only to verify harness mechanics'
    }
  }
], { costingDomain: CostingDomain, configuration: config });

assert.strictEqual(validation.summary.records, 1);
assert.strictEqual(validation.summary.mismatches, 0);
assert.ok(validation.summary.exactMatches > 0);
assert.strictEqual(validation.styles[0].fields.find((field) => field.field === 'markup').result, HistoricalValidationResult.REFERENCE_MISSING);

const mapped = normalizeHistoricalValidationRecord({
  Style: 'MAP-001',
  FOB: '5.90',
  ReferenceLDP: '8.04',
  ReferenceIMU: '72.5%'
}, {
  provenance: { sourceName: 'Column mapping smoke test' },
  fields: {
    styleReference: 'Style',
    fob1: 'FOB',
    reference_landedCost: 'ReferenceLDP',
    reference_imu: 'ReferenceIMU'
  }
});

assert.strictEqual(mapped.styleReference, 'MAP-001');
assert.strictEqual(mapped.inputs.fob1, '5.90');
assert.strictEqual(mapped.reference.landedCost, 8.04);
assert.strictEqual(mapped.reference.imu, 0.725);

assert.strictEqual(
  classifyHistoricalSource({ exists: true, hasIndependentReferenceOutputs: true, provenanceVerified: true }),
  HistoricalSourceClassification.INDEPENDENT_REFERENCE
);
assert.strictEqual(
  classifyHistoricalSource({ exists: true, synthetic: true }),
  HistoricalSourceClassification.SYNTHETIC
);

console.log('cost model 001 historical validation harness ok');
