const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const styleRepository = fs.readFileSync('src/features/styles/styleRepository.js', 'utf8');
const costingRuntimeSource = fs.readFileSync('src/features/costing/costingRuntime.js', 'utf8');

function snippetBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `Missing snippet start: ${start}`);
  assert.ok(endIndex > startIndex, `Missing snippet end: ${end}`);
  return source.slice(startIndex, endIndex);
}

assert.ok(
  html.includes('<script src="src/features/costing/costingRuntime.js"></script>'),
  'index.html must load the shared Costing runtime module'
);

assert.ok(
  styleRepository.includes('id,style_id,fecha'),
  'style repository must select both negotiation row id and canonical style_id'
);

const styleIdKeySnippet = snippetBetween(html, 'function styleIdKey', 'function resetCostResultState');
assert.ok(
  styleIdKeySnippet.includes('rowOrId.style_id||rowOrId.styleId||null'),
  'styleIdKey must prefer canonical style_id from row objects'
);
assert.ok(
  !styleIdKeySnippet.includes('?rowOrId.id:rowOrId'),
  'styleIdKey must not treat negotiation row id as canonical style id'
);

const runtimeBridgeSnippet = snippetBetween(html, 'function costModel001RuntimeConfiguration', 'function styleIdKey');
assert.ok(
  runtimeBridgeSnippet.includes('StdtexCostingRuntime.evaluateLegacyRow'),
  'legacy row calculations must pass through the shared Costing runtime'
);
assert.ok(
  runtimeBridgeSnippet.includes('StdtexCostingRuntime.activeConfiguration'),
  'index bridge must read active configuration from the shared runtime'
);
assert.ok(
  runtimeBridgeSnippet.includes('StdtexCostingRuntime.ensureActiveConfiguration'),
  'index bridge must load active configuration through the shared runtime'
);
assert.ok(
  !runtimeBridgeSnippet.includes('ACTIVE_COSTING_CONFIG_CACHE'),
  'index.html must not own the active Costing configuration cache'
);

assert.ok(
  costingRuntimeSource.includes('activeConfigCache'),
  'shared Costing runtime owns active company Costing config cache'
);
assert.ok(
  costingRuntimeSource.includes("settings.cost_source_type!=='STDTEX_MODEL'"),
  'shared Costing runtime must distinguish FOB_ONLY from active Cost Model mode'
);
assert.ok(
  !/\.(insert|upsert|update|delete)\s*\(/i.test(costingRuntimeSource),
  'shared Costing runtime must not perform writes'
);

const costDisplaySnippet = snippetBetween(html, 'function costDisplayForRow', 'function costHasNumber');
assert.ok(costDisplaySnippet.includes('function localModelDisplay'), 'legacy rows need local model fallback');
assert.ok(costDisplaySnippet.includes('if(local.unavailable)return unavailableDisplay'), 'unavailable legacy costing must not render as zero');
assert.ok(costDisplaySnippet.includes('if(key)return unavailableDisplay'), 'canonical rows must not fall back to legacy row calculation');
assert.ok(
  !/\b(supabase|from\(|insert|upsert|update|delete)\b/i.test(costDisplaySnippet),
  'display fallback must not perform data access or writes'
);

const displayHelpersSnippet = snippetBetween(html, 'function costHasNumber', 'function costColor');
assert.ok(displayHelpersSnippet.includes('function isCostDisplayNumber'), 'display helpers must distinguish unavailable from zero');

const renderStyleDetailSnippet = snippetBetween(html, 'function renderStyleDetail', 'function toggleDetailCollectionMode');
assert.ok(
  renderStyleDetailSnippet.includes("ensureActiveCostingConfiguration('style-detail')"),
  'Product Detail sidebar must preload the same active company Costing configuration'
);
assert.ok(
  renderStyleDetailSnippet.includes('costDisplayForRow(r)'),
  'Product Detail sidebar must consume the same normalized row Costing display as the table'
);

const renderNegSnippet = snippetBetween(html, 'function renderNeg', 'function renderClosed');
assert.ok(
  renderNegSnippet.includes("ensureActiveCostingConfiguration('negotiation')"),
  'Negotiation must preload the active company Costing configuration for legacy-row calculations'
);

const renderClosedSnippet = snippetBetween(html, 'function renderClosed', 'function openClosedDetail');
assert.ok(
  renderClosedSnippet.includes("ensureActiveCostingConfiguration('closed')"),
  'Closed must preload the active company Costing configuration for legacy-row calculations'
);

const sandbox = { globalThis: {}, window: {} };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(costingRuntimeSource, sandbox);

const calls = [];
const fakeDomain = {
  createModel001Configuration(input) {
    return Object.assign({ created: true }, input);
  },
  normalizeInput(row) {
    return { context: { season: row.temporada, origin: row.origin, category: row.cat } };
  },
  resolveModelConfiguration(input) {
    calls.push(input.context);
    return Object.assign({}, input.model, { resolvedContext: input.context });
  },
  evaluateModel001(row, config) {
    return {
      status: 'LOCAL_MODEL',
      selectedFob: row.fob1,
      targetFob: 4.91,
      landedCost: 3.18,
      imu: 0.725,
      markup: 2.64,
      gap: 0.005,
      freightPerUnit: 0,
      customs: 0.58,
      customsPct: 0.153,
      transitDays: 47,
      config
    };
  }
};

async function loadRuntime(data) {
  sandbox.StdtexCostingRuntime.clear();
  await sandbox.StdtexCostingRuntime.ensureActiveConfiguration({
    authUser: { id: 'user-1' },
    client: {},
    settingsService: { load: async () => data },
    companyId: 'company-a',
    companyName: 'Gloria Jeans'
  });
}

(async () => {
  await loadRuntime({
    settings: { cost_source_type: 'FOB_ONLY' },
    versions: [],
    overrides: []
  });
  const fobOnly = sandbox.StdtexCostingRuntime.evaluateLegacyRow({
    domain: fakeDomain,
    companyId: 'company-a',
    companyName: 'Gloria Jeans',
    row: { fob1: 2 }
  });
  assert.strictEqual(fobOnly.unavailable, true, 'FOB_ONLY companies must produce unavailable Costing values');
  assert.strictEqual(fobOnly.reason, 'FOB_ONLY');

  await loadRuntime({
    settings: { cost_source_type: 'STDTEX_MODEL', active_config_version_id: 'v1' },
    versions: [{ id: 'v1', base_config: { assumptions: { rubExchangeRate: 81 }, dutyRows: [] } }],
    overrides: [{ id: 'ov-1', season_key: 'FW26', origin_key: 'BANGLADESH', category_key: 'Denim', values: { fixedDuty: 1.9 }, source_reference: 'test' }]
  });
  const active = sandbox.StdtexCostingRuntime.evaluateLegacyRow({
    domain: fakeDomain,
    companyId: 'company-a',
    companyName: 'Gloria Jeans',
    row: { fob1: 2, temporada: 'FW26', origin: 'BANGLADESH', cat: 'Denim' }
  });
  assert.strictEqual(active.status, 'LOCAL_MODEL', 'active Cost Model mode must calculate through shared runtime');
  assert.strictEqual(active.freightPerUnit, 0, 'genuine zero remains distinguishable from unavailable');
  assert.deepStrictEqual(calls.pop(), { season: 'FW26', origin: 'BANGLADESH', category: 'Denim' });

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function normalizeStyleId(value) {
    const text = value == null ? '' : String(value).trim();
    if (!UUID_RE.test(text)) return null;
    return text.toLowerCase();
  }
  function styleIdKey(rowOrId) {
    const value = rowOrId && typeof rowOrId === 'object' ? (rowOrId.style_id || rowOrId.styleId || null) : rowOrId;
    return normalizeStyleId(value);
  }
  function rowsWithCostIds(rows) {
    const seen = {};
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const key = styleIdKey(row);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  const STYLE_A = '7b1bd243-f544-46ab-8025-f9230aa5f3da';
  const STYLE_B = 'c116f5eb-3f9c-438c-aca8-f10b9270b1e7';

  assert.strictEqual(styleIdKey({ id: 999, style_id: STYLE_A.toUpperCase() }), STYLE_A);
  assert.strictEqual(styleIdKey({ id: 999, style_id: 1242947655 }), null);
  assert.strictEqual(styleIdKey({ id: 999, style_id: null }), null);
  assert.strictEqual(styleIdKey({ id: 999 }), null);
  assert.deepStrictEqual(
    rowsWithCostIds([
      { id: 101, style_id: STYLE_A },
      { id: 102, style_id: STYLE_A.toUpperCase() },
      { id: 103, style_id: null },
      { id: 104, style_id: STYLE_B },
    ]).map((row) => styleIdKey(row)),
    [STYLE_A, STYLE_B]
  );

  function isCostDisplayNumber(value) {
    return value != null && value !== '' && Number.isFinite(Number(value));
  }
  function costUsd(value) {
    return isCostDisplayNumber(value) ? `$${Number(value).toFixed(2)}` : '-';
  }
  function costExportNumber(value, decimals) {
    return isCostDisplayNumber(value) ? +Number(value).toFixed(decimals == null ? 2 : decimals) : '';
  }

  assert.strictEqual(costUsd(0), '$0.00', 'legitimate zero must remain visible');
  assert.strictEqual(costUsd(null), '-', 'unavailable null must not be rendered as zero');
  assert.strictEqual(costUsd(''), '-', 'unavailable blank must not be rendered as zero');
  assert.strictEqual(costExportNumber(0), 0, 'legitimate export zero must remain zero');
  assert.strictEqual(costExportNumber(null), '', 'unavailable export value must remain blank');

  console.log('negotiation cost display characterization ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
