const assert = require('assert');
const core = require('../src/features/costing/core/costModel001.js');
const contract = require('../supabase/functions/calculate-style-cost/contract.js');

const TOLERANCE = 1e-9;

function close(actual, expected, label) {
  const a = Number(actual);
  const e = Number(expected);
  assert.ok(Math.abs(a - e) <= TOLERANCE, `${label}: expected ${e}, got ${a}`);
}

function baseConfiguration(extra = {}) {
  return core.createCostModel001Configuration({
    assumptions: {
      insuranceRate: 0.003,
      grossWeightUplift: 0.11,
      rubExchangeRate: 87,
      eurExchangeRate: 1.16,
      vatRate: 0.2,
      targetImu: 0.72,
      fallbackDutyRate: 0.13,
      defaultOrigin: 'BANGLADESH',
      defaultTransportMode: 'SEA-TRUCK',
      ...(extra.assumptions || {})
    },
    freightRoutes: {
      'BANGLADESH|SEA-TRUCK': { cost: 9162, days: 65 },
      'BANGLADESH|AIR': { cost: 58343, days: 20 },
      'VIETNAM|SEA-TRUCK': { cost: 9306, days: 44 },
      'VIETNAM|AIR': { cost: 49725, days: 17 },
      'CHINA|SEA-TRAIN': { cost: 7086, days: 50 },
      'CHINA|SEA-TRUCK': { cost: 9258, days: 44 },
      'INDIA|SEA': { cost: 6253, days: 59 },
      'PAKISTAN|AIR': { cost: 44920, days: 20 },
      ...(extra.freightRoutes || {})
    },
    dutyRows: [
      { country: 'BANGLADESH', cat: 'Jeans Color', fixed: 1.9, pct: 0.1, load_norm: 10000 },
      { country: 'BANGLADESH', cat: 'Polo', fixed: 0.5, pct: 0.153, load_norm: 12000 },
      { country: 'VIETNAM', cat: 'Pants Commercial', fixed: 1.1, pct: 0.13, load_norm: 9000 },
      { country: 'VIETNAM', cat: 'Jct Nondenim', fixed: 1.2, pct: 0.13, load_norm: 8500 },
      { country: 'CHINA', cat: 'Jackets', fixed: 2.4, pct: 0.1, load_norm: 7000 },
      { country: 'INDIA', cat: 'Overshirts', fixed: 0, pct: 0.16, load_norm: 8000 },
      ...(extra.dutyRows || [])
    ],
    dutyOverrides: extra.dutyOverrides || core.createCostModel001Fw26DutyOverrides()
  });
}

function normalizedResolved(row, config) {
  const normalized = core.normalizeCostingInput(row, {
    season: row.temporada || row.season || null,
    department: row.dept || row.department || null,
    category: row.cat || row.category || null,
    origin: row.origin || null,
    currency: row.currency || 'USD'
  });
  const resolved = core.resolveCostModelConfiguration({
    model: config,
    context: normalized.context
  });
  return { normalized, resolved };
}

function edgeLikeResult(styleId, row, config) {
  const { normalized, resolved } = normalizedResolved(row, config);
  return contract.sanitizeCostResult(styleId, core.evaluateCostModel001(normalized, resolved), {
    currency: normalized.currency,
    configurationVersion: resolved.configurationVersion
  });
}

function assertEdgeMatchesCore(name, row, config = baseConfiguration()) {
  const { normalized, resolved } = normalizedResolved(row, config);
  const coreResult = core.evaluateCostModel001(normalized, resolved);
  const edgeResult = edgeLikeResult(row.id || 1, row, config);
  const keys = [
    ['selectedFob', 'selectedFob'],
    ['fob', 'fob'],
    ['landedCost', 'landedCost'],
    ['estimatedLandedCost', 'landedCost'],
    ['imu', 'imu'],
    ['markup', 'markup'],
    ['gap', 'gap'],
    ['targetFob', 'targetFob'],
    ['freightPerUnit', 'freightPerUnit'],
    ['customs', 'duty'],
    ['customsPct', 'dutyRate'],
    ['transitDays', 'transitDays']
  ];
  keys.forEach(([edgeKey, coreKey]) => close(edgeResult[edgeKey], coreResult[coreKey], `${name} ${edgeKey}`));
  assert.strictEqual(edgeResult.status, 'READY', `${name} status`);
  assert.strictEqual(edgeResult.model, 'cost-model-001', `${name} model`);
  assert.strictEqual(contract.responseContainsForbiddenKey(edgeResult), false, `${name} privacy`);
  return { normalized, resolved, coreResult, edgeResult };
}

const fixtures = [
  ['basic standard Style', { id: 1, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color', dept: 'Menswear', temporada: 'FW26', target_imu: 0.72, fsd: '2026-12-23' }],
  ['fob_closed wins', { id: 2, pvp_rub: 3499, fob_closed: 6.8, fob3: 7, fob2: 7.2, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color' }],
  ['fob3 fallback', { id: 3, pvp_rub: 1999, fob_closed: null, fob3: 3.4, fob2: 3.6, fob1: 3.75, origin: 'CHINA', transport: 'SEA-TRUCK', units: 2000, weight: 0.23, cat: 'Jackets' }],
  ['fob2 fallback', { id: 4, pvp_rub: 1599, fob_closed: null, fob3: null, fob2: 2.95, fob1: 3.2, origin: 'INDIA', transport: 'SEA', units: 3000, weight: 0.22, cat: 'Overshirts' }],
  ['fob1 fallback', { id: 5, pvp_rub: 2799, fob_closed: null, fob3: null, fob2: null, fob1: 8.75, origin: 'PAKISTAN', transport: 'AIR', units: 900, weight: 0.42, cat: 'Unknown Category' }],
  ['fob fallback', { id: 6, pvp_rub: 1299, fob_closed: null, fob3: null, fob2: null, fob1: null, fob: 2.25, origin: 'VIETNAM', transport: 'AIR', units: 500, weight: 0.31, cat: 'Pants Commercial' }],
  ['zero truthiness FOB edge', { id: 7, pvp_rub: 1299, fob_closed: 0, fob3: '0', fob2: 2.25, fob1: 2.5, origin: 'VIETNAM', transport: 'AIR', units: 500, weight: 0.31, cat: 'Pants Commercial' }],
  ['pvp_rub normal', { id: 8, pvp_rub: 9999, fob1: 1.1, origin: 'CHINA', transport: 'SEA-TRAIN', units: 10000, weight: 0.8, cat: 'Jackets', target_imu: 0.75 }],
  ['pvp_rub missing ignores pvp', { id: 9, pvp: 9999, fob1: 1.1, origin: 'CHINA', transport: 'SEA-TRAIN', units: 10000, weight: 0.8, cat: 'Jackets' }],
  ['row target_imu override', { id: 10, pvp_rub: 3499, fob1: 6, target_imu: 0.64, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color' }],
  ['configuration target IMU fallback', { id: 11, pvp_rub: 3499, fob1: 6, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color' }],
  ['fixed-duty branch', { id: 12, pvp_rub: 1999, fob1: 2.2, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 1.1, cat: 'Jeans Color' }],
  ['percentage-duty branch', { id: 13, pvp_rub: 1999, fob1: 18, origin: 'INDIA', transport: 'SEA', units: 1200, weight: 0.2, cat: 'Overshirts' }],
  ['fallback-duty branch', { id: 14, pvp_rub: 1999, fob1: 8.75, origin: 'PAKISTAN', transport: 'AIR', units: 900, weight: 0.42, cat: 'Unknown Category' }],
  ['freight route SEA-TRUCK', { id: 15, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color' }],
  ['freight route AIR', { id: 16, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'AIR', units: 1200, weight: 0.71, cat: 'Jeans Color' }],
  ['weight variation', { id: 17, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.23, cat: 'Jeans Color' }],
  ['units variation', { id: 18, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 8000, weight: 0.71, cat: 'Jeans Color' }],
  ['VAT/FX sensitive case', { id: 19, pvp_rub: 499, fob1: 18, origin: 'VIETNAM', transport: 'SEA-TRUCK', units: 100, weight: 1.2, cat: 'Pants Commercial' }, baseConfiguration({ assumptions: { rubExchangeRate: 81, vatRate: 0.18 } })],
  ['HOD/FSD/transit case', { id: 20, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color', fsd: '2026-12-23', hod: '2026-10-19' }],
  ['season FW26', { id: 21, pvp_rub: 3499, fob1: 7.45, origin: 'VIETNAM', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Pants Commercial', temporada: 'FW26' }],
  ['different season', { id: 22, pvp_rub: 3499, fob1: 7.45, origin: 'VIETNAM', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Pants Commercial', temporada: 'SS27' }],
  ['origin variation', { id: 23, pvp_rub: 3499, fob1: 7.45, origin: 'CHINA', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jackets' }],
  ['category variation', { id: 24, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Polo' }],
  ['Department present', { id: 25, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color', dept: 'Menswear' }],
  ['Department null', { id: 26, pvp_rub: 3499, fob1: 7.45, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jeans Color', dept: null }],
  ['same Category different Department A', { id: 27, pvp_rub: 3499, fob1: 7.45, origin: 'VIETNAM', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Pants Commercial', dept: 'Menswear', temporada: 'FW26' }],
  ['same Category different Department B', { id: 28, pvp_rub: 3499, fob1: 7.45, origin: 'VIETNAM', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Pants Commercial', dept: 'Accessories', temporada: 'FW26' }],
  ['same Department different Category', { id: 29, pvp_rub: 3499, fob1: 7.45, origin: 'VIETNAM', transport: 'SEA-TRUCK', units: 1200, weight: 0.71, cat: 'Jct Nondenim', dept: 'Menswear', temporada: 'FW26' }],
  ['null optional values', { id: 30, pvp_rub: null, fob_closed: null, fob3: null, fob2: null, fob1: null, fob: null, origin: null, transport: null, units: null, weight: null, cat: null, dept: null, temporada: null }],
  ['numeric strings', { id: 31, pvp_rub: '3499', fob1: '7.45', origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: '1200', weight: '0.71', cat: 'Jeans Color', target_imu: '0.72' }],
  ['zero values', { id: 32, pvp_rub: 0, fob_closed: 0, fob3: 0, fob2: 0, fob1: 0, fob: 0, origin: 'BANGLADESH', transport: 'SEA-TRUCK', units: 0, weight: 0, cat: 'Jeans Color', target_imu: 0 }]
];

const results = fixtures.map(([name, row, config]) => [name, assertEdgeMatchesCore(name, row, config)]);

const byName = Object.fromEntries(results);
assert.strictEqual(byName['pvp_rub missing ignores pvp'].coreResult.pU, 0, 'pvp alone must not replace pvp_rub');
assert.strictEqual(byName['row target_imu override'].coreResult.targetImu, 0.64);
assert.strictEqual(byName['configuration target IMU fallback'].coreResult.targetImu, 0.72);
assert.strictEqual(byName['fob_closed wins'].coreResult.fob, 6.8);
assert.strictEqual(byName['fob3 fallback'].coreResult.fob, 3.4);
assert.strictEqual(byName['fob2 fallback'].coreResult.fob, 2.95);
assert.strictEqual(byName['fob1 fallback'].coreResult.fob, 8.75);
assert.strictEqual(byName['fob fallback'].coreResult.fob, 2.25);
assert.strictEqual(byName['zero truthiness FOB edge'].coreResult.fob, '0');
assert.strictEqual(byName['HOD/FSD/transit case'].edgeResult.hod, null, 'Edge response currently does not derive HOD');

const fw26 = byName['season FW26'];
const ss27 = byName['different season'];
assert.notStrictEqual(core.costModel001DutyFor('VIETNAM', 'Pants Commercial', fw26.resolved).fixed, core.costModel001DutyFor('VIETNAM', 'Pants Commercial', ss27.resolved).fixed);
assert.strictEqual(core.costModel001DutyFor('VIETNAM', 'Pants Commercial', fw26.resolved).fixed, 2.2);
assert.strictEqual(core.costModel001DutyFor('VIETNAM', 'Jct Nondenim', byName['same Department different Category'].resolved).fixed, 2.25);
assert.strictEqual(core.costModel001DutyFor('BANGLADESH', 'Jeans Color', byName['basic standard Style'].resolved).fixed, 1.9);

assert.strictEqual(byName['same Category different Department A'].normalized.context.category, 'Pants Commercial');
assert.strictEqual(byName['same Category different Department A'].normalized.context.department, 'Menswear');
assert.strictEqual(byName['same Category different Department B'].normalized.context.category, 'Pants Commercial');
assert.strictEqual(byName['same Category different Department B'].normalized.context.department, 'Accessories');
close(byName['same Category different Department A'].coreResult.landedCost, byName['same Category different Department B'].coreResult.landedCost, 'same category with different department current V1 result');
assert.notStrictEqual(byName['same Category different Department A'].normalized.context.department, byName['same Category different Department B'].normalized.context.department);
assert.strictEqual(byName['same Department different Category'].normalized.context.department, 'Menswear');
assert.strictEqual(byName['same Department different Category'].normalized.context.category, 'Jct Nondenim');

assert.strictEqual(contract.normalizeStyleIds(Array.from({ length: 100 }, (_, i) => i + 1)).ok, true);
assert.strictEqual(contract.normalizeStyleIds(Array.from({ length: 101 }, (_, i) => i + 1)).error, 'STYLE_IDS_LIMIT_EXCEEDED');
assert.strictEqual(contract.responseContainsForbiddenKey({ ok: true, results: results.map(([, r]) => r.edgeResult) }), false);

console.log('costing edge local parity characterization passed');
