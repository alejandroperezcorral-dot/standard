const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/features/costing/costResultModel.js',
  'src/features/costing/costConnector.js',
  'src/features/costing/costModel.js',
  'src/features/costing/costService.js',
  'src/features/costing/index.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const html = fs.readFileSync('index.html', 'utf8');

function extractDeclaration(name) {
  const start = html.indexOf(`var ${name}=`);
  assert.ok(start >= 0, `missing ${name}`);
  const after = html.slice(start);
  const end = after.indexOf(';\n');
  assert.ok(end > 0, `missing ${name} terminator`);
  return after.slice(4, end);
}

const context = {};
vm.createContext(context);
vm.runInContext(`var ${extractDeclaration('FR')}; var ${extractDeclaration('P')}; var ${extractDeclaration('DUTIES')};`, context);

const configuration = CostingDomain.createModel001Configuration({
  assumptions: {
    insuranceRate: context.P.ins,
    grossWeightUplift: context.P.nw2gw,
    rubExchangeRate: context.P.rub,
    eurExchangeRate: context.P.eur,
    vatRate: context.P.tax,
    targetImu: 0.72,
    fallbackDutyRate: 0.13,
    defaultOrigin: 'BANGLADESH',
    defaultTransportMode: 'SEA-TRUCK'
  },
  freightRoutes: context.FR,
  dutyRows: context.DUTIES
});

function legacyFrCU(org, tr, u, w, cat) {
  const f = context.FR[`${org}|${tr}`];
  if (!f) return { cu: 0, days: 0 };
  if (!w) return { cu: 0, days: f.days };
  let upc = 0;
  if (cat) {
    const cty = org.charAt(0).toUpperCase() + org.slice(1).toLowerCase();
    for (let i = 0; i < context.DUTIES.length; i += 1) {
      const d = context.DUTIES[i];
      if (String(d.country).toLowerCase() === cty.toLowerCase() && d.cat === cat && d.load_norm > 0) {
        upc = d.load_norm / (w * (1 + context.P.nw2gw));
        break;
      }
    }
  }
  if (!upc) return { cu: 0, days: f.days };
  const cont = (u || 1) / upc;
  return { cu: (f.cost * cont) / (u || 1), days: f.days };
}

function legacyDutyFor(org, cat) {
  if (!cat) return { fixed: 0, pct: 0 };
  const cty = org.charAt(0).toUpperCase() + org.slice(1).toLowerCase();
  let best = null;
  for (let i = 0; i < context.DUTIES.length; i += 1) {
    const d = context.DUTIES[i];
    if (String(d.country).toLowerCase() === cty.toLowerCase()) {
      if (d.cat === cat) {
        best = d;
        break;
      }
    }
  }
  return best ? { fixed: best.fixed, pct: best.pct } : { fixed: 0, pct: 0.13 };
}

function legacyCm(r) {
  const fob = r.fob_closed || r.fob3 || r.fob2 || r.fob1 || 0;
  const pvp = r.pvp_rub || 0;
  const fr = legacyFrCU(r.origin || 'BANGLADESH', r.transport || 'SEA-TRUCK', r.units || 1, r.weight || 0, r.cat || '');
  const du = legacyDutyFor(r.origin || 'BANGLADESH', r.cat || '');
  const fixedCust = r.weight ? du.fixed * context.P.eur * r.weight : 0;
  const pctCust = fob * du.pct;
  const cust = Math.max(fixedCust, pctCust);
  const ldp = fob * (1 + context.P.ins) + fr.cu + cust;
  const pU = pvp / ((1 + (context.P.tax || 0.2)) * context.P.rub);
  const imu = pU > 0 ? (pU - ldp) / pU : 0;
  const mu = (imu < 1 && imu > -10) ? imu / (1 - imu) : 0;
  const tgt = r.target_imu || 0.72;
  const gap = imu - tgt;
  const fobT_fixed = pU > 0 ? (pU * (1 - tgt) - fr.cu - fixedCust) / (1 + context.P.ins) : 0;
  const fobT_pct = pU > 0 ? (pU * (1 - tgt) - fr.cu) / (1 + context.P.ins + du.pct) : 0;
  const fobT = (fixedCust >= du.pct * Math.max(fobT_fixed, 0)) ? fobT_fixed : fobT_pct;
  const custPct = fob > 0 ? cust / fob : 0;
  return { fob, ldp, pU, imu, mu, tgt, gap, fobT, cu: fr.cu, cust, custPct, days: fr.days };
}

function legacyHodFor(r) {
  if (r.hod) return r.hod;
  if (!r.fsd) return '';
  const f = context.FR[`${r.origin || 'BANGLADESH'}|${r.transport || 'SEA-TRUCK'}`];
  const days = f ? f.days : 0;
  const d = new Date(r.fsd);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function assertNear(a, b, key, fixtureName) {
  const delta = Math.abs((a || 0) - (b || 0));
  assert.ok(delta < 1e-12, `${fixtureName} ${key}: ${a} !== ${b}`);
}

const fixtures = [
  {
    name: 'fob closed priority and percentage duty',
    row: { pvp_rub: 3499, fob1: 7.45, fob2: 7.2, fob3: 7.0, fob_closed: 6.8, origin: 'BANGLADESH', transport: 'SEA-TRUCK', cat: 'Jeans Commercial', units: 1200, weight: 0.71, target_imu: 0.72, fsd: '2026-12-23' }
  },
  {
    name: 'fob3 priority with fixed duty branch',
    row: { pvp_rub: 1999, fob1: 3.75, fob2: 3.6, fob3: 3.4, origin: 'CHINA', transport: 'SEA-TRUCK', cat: 'Polo', units: 2000, weight: 0.23, target_imu: 0.72, fsd: '2026-11-30' }
  },
  {
    name: 'fob2 priority and missing weight disables freight',
    row: { pvp_rub: 1599, fob1: 3.2, fob2: 2.95, origin: 'INDIA', transport: 'SEA', cat: 'T-Shirts S-sl', units: 3000, weight: 0, pvp: 1599 }
  },
  {
    name: 'fob1 priority and fallback duty',
    row: { pvp_rub: 2799, fob1: 8.75, origin: 'PAKISTAN', transport: 'AIR', cat: 'UNKNOWN CATEGORY', units: 900, weight: 0.42, target_imu: 0.68 }
  },
  {
    name: 'zero fob truthiness selects next nonzero fob',
    row: { pvp_rub: 1299, fob_closed: 0, fob3: '0', fob2: 2.25, fob1: 2.5, origin: 'VIETNAM', transport: 'AIR', cat: 'Pants Commercial', units: 500, weight: 0.31 }
  },
  {
    name: 'empty and null values',
    row: { pvp_rub: null, fob_closed: '', fob3: null, fob2: undefined, fob1: '', origin: '', transport: '', cat: '', units: null, weight: undefined, target_imu: null }
  },
  {
    name: 'high retail and low fob',
    row: { pvp_rub: 9999, fob1: 1.1, origin: 'UZBEKISTAN', transport: 'TRUCK', cat: 'Jct Denim', units: 10000, weight: 0.8, target_imu: 0.75 }
  },
  {
    name: 'low retail and high fob',
    row: { pvp_rub: 499, fob1: 18, origin: 'MYANMAR', transport: 'SEA-TRUCK', cat: 'Outw Vest', units: 100, weight: 1.2, target_imu: 0.72 }
  }
];

fixtures.forEach(({ name, row }) => {
  const oldResult = legacyCm(row);
  const newResult = CostingDomain.evaluateModel001(row, configuration);
  ['fob', 'ldp', 'pU', 'imu', 'mu', 'tgt', 'gap', 'fobT', 'cu', 'cust', 'custPct', 'days'].forEach(key => {
    assertNear(oldResult[key], newResult[key], key, name);
  });
});

assert.strictEqual(legacyHodFor(fixtures[0].row), '2026-10-19');
assert.strictEqual(legacyHodFor({ hod: '2026-10-01', fsd: '2026-12-23' }), '2026-10-01');
assert.strictEqual(legacyHodFor({}), '');

const metadata = CostingDomain.getModel001VariableMetadata();
['insuranceRate', 'grossWeightUplift', 'rubExchangeRate', 'eurExchangeRate', 'vatRate', 'targetImu', 'fallbackDutyRate'].forEach(key => {
  assert.ok(metadata.some(item => item.key === key && item.editable === true), `missing metadata for ${key}`);
});

console.log('cost model 001 characterization ok');
