const {
  HistoricalSourceClassification,
  createHistoricalValidationRecord
} = require('../costModel001HistoricalValidation');

const FW26_BOTTOMS_HISTORICAL_SOURCE = Object.freeze({
  sourceName: 'FW26 QUOTATION FILE - BOTTOMS.xlsb',
  sourceType: HistoricalSourceClassification.PARTIAL_INDEPENDENT_REFERENCE,
  sourceDate: '2026-06-11',
  referenceMethod: 'Excel PLANIFICACION formulas using Control panel GJ and Duty Calculator GJ',
  currencyContext: 'FOB/LDP USD; PVP RUB VAT-inclusive; USD/RUB 87; EUR/USD 1.16',
  notes: 'Read-only exported validation copy. Historical source has LDP, IMU, freight, duty and transit outputs but no independent markup or target FOB output.'
});

const FW26_BOTTOMS_HISTORICAL_COLUMN_MAP = Object.freeze({
  styleReference: 'Style number',
  department: 'Department',
  category: 'Category',
  description: 'Description',
  collection: 'COLLECTION',
  colour: 'Colour',
  supplier: 'SUPPLIER',
  orderStatus: 'Order status',
  pendingUnits: 'Pending Buy Units',
  finalUnits: 'Final planned units to buy',
  pvpRub: 'Planned PVP (RRP)',
  fobUsd: 'Purchase price USD (FOB)',
  buyingImu: 'Buying IMU',
  targetImu: 'Target IMU',
  origin: 'Pickup origin',
  transport: 'Type of transport',
  exFactoryDate: 'Date ex-factory',
  fsd: 'Plan FSD',
  transitDays: 'Transit days',
  landedCost: 'Landed cost per units USD (LDP)',
  weightKg: 'Garment weight net, kg',
  totalProductCostFob: 'Total Product cost (FOB)',
  freightPerUnit: 'Transport costs new',
  duty: 'Total Customs duties new'
});

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

function toNumber(value) {
  if (isBlank(value)) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/[%,$€₽\s]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return isBlank(value) ? '' : String(value).trim();
}

function normalizeUpperText(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeTransport(value) {
  const text = normalizeUpperText(value).replace(/\s+/g, '-');
  if (text === 'AIR') return 'AIR';
  if (text === 'SEA-AIR') return 'SEA-AIR';
  if (text === 'SEA-TRAIN') return 'SEA-TRAIN';
  if (text === 'SEA-TRUCK') return 'SEA-TRUCK';
  if (text === 'SEA') return 'SEA';
  if (text === 'TRUCK') return 'TRUCK';
  return text;
}

function normalizeDate(value) {
  if (isBlank(value)) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function readColumn(row, key) {
  return row ? row[FW26_BOTTOMS_HISTORICAL_COLUMN_MAP[key]] : undefined;
}

function isFw26BottomsHistoricalStyleRow(row) {
  return Boolean(normalizeText(readColumn(row, 'styleReference')));
}

function normalizeFw26BottomsHistoricalRow(row, options) {
  options = options || {};
  const reference = {};
  const landedCost = toNumber(readColumn(row, 'landedCost'));
  const imu = toNumber(readColumn(row, 'buyingImu'));
  const freightPerUnit = toNumber(readColumn(row, 'freightPerUnit'));
  const duty = toNumber(readColumn(row, 'duty'));
  const transitDays = toNumber(readColumn(row, 'transitDays'));

  if (landedCost !== null) reference.landedCost = landedCost;
  if (imu !== null) reference.imu = imu;
  if (freightPerUnit !== null) reference.freightPerUnit = freightPerUnit;
  if (duty !== null) reference.duty = duty;
  if (transitDays !== null) reference.transitDays = transitDays;

  return createHistoricalValidationRecord({
    styleReference: normalizeText(readColumn(row, 'styleReference')),
    inputs: {
      fob: toNumber(readColumn(row, 'fobUsd')),
      pvp_rub: toNumber(readColumn(row, 'pvpRub')),
      weight: toNumber(readColumn(row, 'weightKg')),
      units: toNumber(readColumn(row, 'finalUnits')),
      origin: normalizeUpperText(readColumn(row, 'origin')),
      transport: normalizeTransport(readColumn(row, 'transport')),
      cat: normalizeText(readColumn(row, 'category')),
      category: normalizeText(readColumn(row, 'category')),
      department: normalizeText(readColumn(row, 'department')),
      target_imu: toNumber(readColumn(row, 'targetImu')),
      fsd: normalizeDate(readColumn(row, 'fsd')),
      hod: normalizeDate(readColumn(row, 'exFactoryDate'))
    },
    reference,
    provenance: Object.assign({}, FW26_BOTTOMS_HISTORICAL_SOURCE, options.provenance || {})
  });
}

function normalizeFw26BottomsHistoricalRows(rows, options) {
  return (rows || [])
    .filter(isFw26BottomsHistoricalStyleRow)
    .map((row) => normalizeFw26BottomsHistoricalRow(row, options));
}

module.exports = {
  FW26_BOTTOMS_HISTORICAL_SOURCE,
  FW26_BOTTOMS_HISTORICAL_COLUMN_MAP,
  isFw26BottomsHistoricalStyleRow,
  normalizeFw26BottomsHistoricalRow,
  normalizeFw26BottomsHistoricalRows
};
