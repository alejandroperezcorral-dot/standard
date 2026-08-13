const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const {
  normalizeFw26BottomsHistoricalRows
} = require('../tools/costing/adapters/fw26BottomsHistoricalAdapter');

[
  'src/features/costing/costResultModel.js',
  'src/features/costing/costConnector.js',
  'src/features/costing/costModel.js',
  'src/features/costing/costService.js',
  'src/features/costing/index.js'
].forEach((file) => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const rows = [
  {
    'Style number': 'FW26-DUTY-GAP-VN-PANTS',
    Department: 'PANTS',
    Category: 'Pants Commercial',
    'Final planned units to buy': 1000,
    'Planned PVP (RRP)': 3499,
    'Purchase price USD (FOB)': 7,
    'Buying IMU': 0.71,
    'Target IMU': 0.72,
    'Pickup origin': 'VIETNAM',
    'Type of transport': 'SEA-TRUCK',
    'Transit days': 44,
    'Landed cost per units USD (LDP)': 7.5106,
    'Garment weight net, kg': 0.2,
    'Transport costs new': 0,
    'Total Customs duties new': 0.5104
  },
  {
    'Style number': 'FW26-DUTY-GAP-BD-JEANS',
    Department: 'JEANS',
    Category: 'Jeans Color',
    'Final planned units to buy': 1000,
    'Planned PVP (RRP)': 3499,
    'Purchase price USD (FOB)': 5,
    'Buying IMU': 0.71,
    'Target IMU': 0.72,
    'Pickup origin': 'BANGLADESH',
    'Type of transport': 'SEA-TRUCK',
    'Transit days': 65,
    'Landed cost per units USD (LDP)': 5.57304,
    'Garment weight net, kg': 0.26,
    'Transport costs new': 0,
    'Total Customs duties new': 0.57304
  }
];

const records = normalizeFw26BottomsHistoricalRows(rows);
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
    { country: 'Bangladesh', dept: 'Jeans', cat: 'Jeans Color', fixed: 2.25, pct: 0.1, load_norm: 10000 }
  ],
  dutyOverrides: CostingDomain.createModel001Fw26DutyOverrides()
});

const baseResults = records.map((record) => CostingDomain.evaluateModel001(record.inputs, baseConfiguration));
const historicalResults = records.map((record) => {
  const configuration = CostingDomain.resolveModelConfiguration({
    model: baseConfiguration,
    context: { season: 'FW26', origin: record.inputs.origin, category: record.inputs.category || record.inputs.cat }
  });
  return CostingDomain.evaluateModel001(record.inputs, configuration);
});

assert.ok(Math.abs(baseResults[0].duty - records[0].reference.duty) > 0.01);
assert.ok(Math.abs(baseResults[1].duty - records[1].reference.duty) > 0.01);

assert.ok(Math.abs(historicalResults[0].duty - records[0].reference.duty) <= 0.01);
assert.ok(Math.abs(historicalResults[1].duty - records[1].reference.duty) <= 0.01);

console.log('fw26 bottoms duty gap characterization ok');
