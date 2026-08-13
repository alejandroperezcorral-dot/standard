const assert = require('assert');
const {
  HistoricalSourceClassification,
  classifyHistoricalSource
} = require('../tools/costing/costModel001HistoricalValidation');
const {
  FW26_BOTTOMS_HISTORICAL_SOURCE,
  isFw26BottomsHistoricalStyleRow,
  normalizeFw26BottomsHistoricalRow
} = require('../tools/costing/adapters/fw26BottomsHistoricalAdapter');

const fixture = {
  'Style number': 'BJN018700',
  Department: 'Menswear',
  Category: 'Jeans Commercial',
  Description: 'BARREL COLOUR DENIM PANT',
  COLLECTION: 'Denim Colour',
  Colour: 'Brown',
  SUPPLIER: 'STW',
  'Order status': 'Closed',
  'Final planned units to buy': 1200,
  'Planned PVP (RRP)': 3499,
  'Purchase price USD (FOB)': 7.45,
  'Buying IMU': 0.735,
  'Target IMU': 0.72,
  'Pickup origin': 'CHINA',
  'Type of transport': 'SEA-TRAIN',
  'Date ex-factory': '2026-10-01',
  'Plan FSD': '2026-12-23',
  'Transit days': 50,
  'Landed cost per units USD (LDP)': 8.91,
  'Garment weight net, kg': 0.71,
  'Transport costs new': 0.51,
  'Total Customs duties new': 0.95
};

assert.strictEqual(isFw26BottomsHistoricalStyleRow(fixture), true);
assert.strictEqual(isFw26BottomsHistoricalStyleRow({}), false);

const normalized = normalizeFw26BottomsHistoricalRow(fixture);
assert.strictEqual(normalized.styleReference, 'BJN018700');
assert.strictEqual(normalized.inputs.fob, 7.45);
assert.strictEqual(normalized.inputs.pvp_rub, 3499);
assert.strictEqual(normalized.inputs.origin, 'CHINA');
assert.strictEqual(normalized.inputs.transport, 'SEA-TRAIN');
assert.strictEqual(normalized.inputs.cat, 'Jeans Commercial');
assert.strictEqual(normalized.inputs.fsd, '2026-12-23');
assert.strictEqual(normalized.reference.landedCost, 8.91);
assert.strictEqual(normalized.reference.imu, 0.735);
assert.strictEqual(normalized.reference.freightPerUnit, 0.51);
assert.strictEqual(normalized.reference.duty, 0.95);
assert.strictEqual(normalized.reference.transitDays, 50);
assert.strictEqual(normalized.provenance.sourceName, FW26_BOTTOMS_HISTORICAL_SOURCE.sourceName);
assert.strictEqual(
  classifyHistoricalSource({ exists: true, hasIndependentReferenceOutputs: true, provenanceVerified: true, partial: true }),
  HistoricalSourceClassification.PARTIAL_INDEPENDENT_REFERENCE
);

console.log('fw26 bottoms historical adapter ok');
