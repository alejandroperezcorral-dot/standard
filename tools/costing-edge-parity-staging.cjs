#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../src/features/costing/core/costModel001.js');
const contract = require('../supabase/functions/calculate-style-cost/contract.js');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_PATH = path.join(ROOT, '.codex-secrets', 'stdtex-staging-runtime.json');
const PASSWORD_PATH = path.join(ROOT, '.codex-secrets', 'staging-auth-test-password.txt');

const COMPANY_A_ID = '03d6172b-fbbd-499b-a5ab-0b65f17a35ea';
const COMPANY_B_ID = 'b5ac132b-12e6-4678-b30e-551c0931f9fa';
const COMPANY_A_ADMIN = 'companya.admin@example.test';
const COMPANY_A_MEMBER = 'companya.member1@example.test';
const COMPANY_B_ADMIN = 'companyb.admin@example.test';
const PLATFORM_ADMIN = 'platform.admin@example.test';
const TOLERANCE = 1e-9;
const FIXTURE_MARKER = 'QA-COSTING-E2E';
const FIXTURE_COLUMNS = [
  'id', 'modelo', 'description', 'supplier', 'origin', 'transport', 'temporada',
  'dept', 'cat', 'pvp_rub', 'fob1', 'fob2', 'fob3', 'fob_closed', 'weight',
  'units', 'target_imu', 'status', 'fsd', 'hod', 'user_id'
];

const FIXTURES = [
  {
    id: -770001,
    modelo: 'QA-COST-STD',
    description: 'QA costing standard denim',
    supplier: 'QA Supplier A',
    origin: 'BANGLADESH',
    transport: 'SEA-TRUCK',
    temporada: 'FW26',
    dept: 'Menswear',
    cat: 'Jeans Color',
    pvp_rub: 3499,
    fob1: 7.45,
    weight: 0.71,
    units: 1200,
    target_imu: 0.72,
    status: 'PENDING',
    fsd: '2026-12-23',
    hod: '2026-10-19'
  },
  {
    id: -770002,
    modelo: 'QA-COST-FOB-CLOSED',
    description: 'QA costing fob closed',
    supplier: 'QA Supplier A',
    origin: 'VIETNAM',
    transport: 'SEA-TRUCK',
    temporada: 'FW26',
    dept: 'Menswear',
    cat: 'Pants Commercial',
    pvp_rub: 2999,
    fob_closed: 6.8,
    fob3: 7,
    fob2: 7.2,
    fob1: 7.45,
    weight: 0.52,
    units: 900,
    status: 'PENDING'
  },
  {
    id: -770003,
    modelo: 'QA-COST-PCT-DUTY',
    description: 'QA costing percentage duty',
    supplier: 'QA Supplier A',
    origin: 'INDIA',
    transport: 'SEA',
    temporada: 'SS27',
    dept: null,
    cat: 'Overshirts',
    pvp_rub: 1999,
    fob1: 18,
    weight: 0.2,
    units: 1200,
    status: 'PENDING'
  },
  {
    id: -770004,
    modelo: 'QA-COST-FALLBACK-DUTY',
    description: 'QA costing fallback duty',
    supplier: 'QA Supplier A',
    origin: 'PAKISTAN',
    transport: 'AIR',
    temporada: 'FW26',
    dept: 'Accessories',
    cat: 'Unknown Category',
    pvp_rub: 1999,
    fob1: 8.75,
    weight: 0.42,
    units: 900,
    status: 'PENDING'
  },
  {
    id: -770005,
    modelo: 'QA-COST-AIR-FREIGHT',
    description: 'QA costing air freight',
    supplier: 'QA Supplier A',
    origin: 'BANGLADESH',
    transport: 'AIR',
    temporada: 'FW26',
    dept: 'Menswear',
    cat: 'Jeans Color',
    pvp_rub: 3499,
    fob1: 7.45,
    weight: 0.71,
    units: 1200,
    status: 'PENDING'
  },
  {
    id: -770006,
    modelo: 'QA-COST-WRONG-SEASON',
    description: 'QA costing wrong season',
    supplier: 'QA Supplier A',
    origin: 'VIETNAM',
    transport: 'SEA-TRUCK',
    temporada: 'SS27',
    dept: 'Menswear',
    cat: 'Pants Commercial',
    pvp_rub: 2999,
    fob1: 7.45,
    weight: 0.52,
    units: 900,
    status: 'PENDING'
  },
  {
    id: -770007,
    modelo: 'QA-COST-DIFFERENT-CAT',
    description: 'QA costing different category',
    supplier: 'QA Supplier A',
    origin: 'VIETNAM',
    transport: 'SEA-TRUCK',
    temporada: 'FW26',
    dept: 'Menswear',
    cat: 'Jct Nondenim',
    pvp_rub: 2999,
    fob1: 7.45,
    weight: 0.52,
    units: 900,
    status: 'PENDING'
  },
  {
    id: -770008,
    modelo: 'QA-COST-QTY',
    description: 'QA costing quantity variation',
    supplier: 'QA Supplier A',
    origin: 'CHINA',
    transport: 'SEA-TRAIN',
    temporada: 'FW26',
    dept: 'Menswear',
    cat: 'Jackets',
    pvp_rub: 9999,
    fob1: 1.1,
    weight: 0.8,
    units: 10000,
    target_imu: 0.75,
    status: 'PENDING'
  },
  {
    id: -770009,
    modelo: 'QA-COST-COMPANY-B',
    description: 'QA costing foreign company row',
    supplier: 'Company B',
    origin: 'BANGLADESH',
    transport: 'SEA-TRUCK',
    temporada: 'FW26',
    dept: 'Menswear',
    cat: 'Jeans Color',
    pvp_rub: 3499,
    fob1: 7.45,
    weight: 0.71,
    units: 1200,
    status: 'PENDING'
  }
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
}

function fullConfig(extra = {}) {
  return {
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
      'BANGLADESH|AIR': { cost: 58343, days: 20 },
      'VIETNAM|SEA-TRUCK': { cost: 9306, days: 44 },
      'VIETNAM|AIR': { cost: 49725, days: 17 },
      'CHINA|SEA-TRAIN': { cost: 7086, days: 50 },
      'INDIA|SEA': { cost: 6253, days: 59 },
      'PAKISTAN|AIR': { cost: 44920, days: 20 }
    },
    dutyRows: [
      { country: 'BANGLADESH', cat: 'Jeans Color', fixed: 1.9, pct: 0.1, load_norm: 10000 },
      { country: 'BANGLADESH', cat: 'Polo', fixed: 0.5, pct: 0.153, load_norm: 12000 },
      { country: 'VIETNAM', cat: 'Pants Commercial', fixed: 1.1, pct: 0.13, load_norm: 9000 },
      { country: 'VIETNAM', cat: 'Jct Nondenim', fixed: 1.2, pct: 0.13, load_norm: 8500 },
      { country: 'CHINA', cat: 'Jackets', fixed: 2.4, pct: 0.1, load_norm: 7000 },
      { country: 'INDIA', cat: 'Overshirts', fixed: 0, pct: 0.16, load_norm: 8000 }
    ],
    ...extra
  };
}

function mapOverride(row) {
  return {
    id: row.id,
    scope: { origin: row.origin_key, category: row.category_key },
    period: { season: row.season_key },
    values: row.values || {},
    source: row.source_reference || 'Company override'
  };
}

function buildModel(version, overrides) {
  return core.createCostModel001Configuration({
    ...((version && version.base_config) || {}),
    dutyOverrides: (overrides || []).map(mapOverride),
    configurationVersion: version && version.config_code ? version.config_code : null
  });
}

function normalizeRow(row) {
  return core.normalizeCostingInput(row, {
    season: row.temporada || null,
    department: row.dept || null,
    category: row.cat || null,
    origin: row.origin || null,
    currency: 'USD'
  });
}

function expectedResult(styleId, row, model) {
  const input = normalizeRow(row);
  const resolved = core.resolveCostModelConfiguration({
    model,
    context: {
      season: input.season,
      department: input.department,
      category: input.category,
      origin: input.origin
    }
  });
  return contract.sanitizeCostResult(styleId, core.evaluateCostModel001(input, resolved), {
    currency: input.currency,
    configurationVersion: resolved.configurationVersion
  });
}

function close(actual, expected, label) {
  const a = Number(actual);
  const e = Number(expected);
  assert.ok(Math.abs(a - e) <= TOLERANCE, `${label}: expected ${e}, got ${a}`);
}

function compareReady(label, edge, expected) {
  assert.strictEqual(edge.status, 'READY', `${label} status`);
  for (const key of ['fob', 'selectedFob', 'landedCost', 'estimatedLandedCost', 'imu', 'markup', 'gap', 'targetFob', 'freightPerUnit', 'customs', 'customsPct', 'transitDays']) {
    close(edge[key], expected[key], `${label} ${key}`);
  }
  assert.strictEqual(edge.source, expected.source, `${label} source`);
  assert.strictEqual(edge.model, expected.model, `${label} model`);
  assert.strictEqual(edge.formulaVersion, expected.formulaVersion, `${label} formulaVersion`);
  assert.strictEqual(contract.responseContainsForbiddenKey(edge), false, `${label} response privacy`);
}

async function requestJson(url, init, allowEmpty = false) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data && (data.message || data.error || data.code) ? JSON.stringify(data) : text;
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }
  return data == null && allowEmpty ? null : data;
}

function headers(runtime, token) {
  return {
    apikey: runtime.publishableKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function login(runtime, email, password) {
  const data = await requestJson(`${runtime.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: runtime.publishableKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  assert.ok(data.access_token, `missing access token for ${email}`);
  return data.access_token;
}

async function authUser(runtime, token) {
  const data = await requestJson(`${runtime.supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: headers(runtime, token)
  });
  assert.ok(data.id, 'missing auth user id');
  return data;
}

async function rest(runtime, token, table, query) {
  return requestJson(`${runtime.supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'GET',
    headers: headers(runtime, token)
  });
}

async function restWrite(runtime, token, table, method, query, payload, allowEmpty = false) {
  const url = `${runtime.supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
  return requestJson(url, {
    method,
    headers: Object.assign({}, headers(runtime, token), method === 'POST' ? { Prefer: 'return=representation' } : {}),
    body: payload == null ? undefined : JSON.stringify(payload)
  }, allowEmpty);
}

async function rpc(runtime, token, name, payload) {
  return requestJson(`${runtime.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify(payload || {})
  });
}

async function edge(runtime, token, payload) {
  return requestJson(`${runtime.supabaseUrl}/functions/v1/calculate-style-cost`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify(payload)
  });
}

async function validateConfig(runtime, token, configVersionId) {
  return requestJson(`${runtime.supabaseUrl}/functions/v1/validate-cost-config`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify({ configId: configVersionId })
  });
}

async function loadActive(runtime, token) {
  const settings = await rest(
    runtime,
    token,
    'company_costing_settings',
    `company_id=eq.${COMPANY_A_ID}&select=company_id,cost_source_type,active_config_version_id,fallback_behavior`
  );
  assert.strictEqual(settings.length, 1, 'expected one Company A costing setting');
  const activeId = settings[0].active_config_version_id;
  const versions = await rest(
    runtime,
    token,
    'cost_config_versions',
    `id=eq.${activeId}&select=id,company_id,formula_version,config_code,config_label,lifecycle_status,semantic_validation_status,base_config`
  );
  assert.strictEqual(versions.length, 1, 'expected active config version');
  const overrides = await rest(
    runtime,
    token,
    'cost_config_overrides',
    `config_version_id=eq.${activeId}&select=id,season_key,origin_key,category_key,values,source_reference`
  );
  const components = await rest(
    runtime,
    token,
    'cost_additional_components',
    `config_version_id=eq.${activeId}&enabled=eq.true&select=id`
  );
  return { settings: settings[0], version: versions[0], overrides, components };
}

async function directMarkValidated(runtime, token, configVersionId) {
  return fetch(`${runtime.supabaseUrl}/rest/v1/rpc/mark_cost_config_semantically_validated`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify({
      p_config_version_id: configVersionId,
      p_formula_version: 1,
      p_validation_result: { harness: 'costing-edge-parity', status: 'DIRECT_ATTACK' }
    })
  });
}

async function validateOrThrow(runtime, token, configVersionId, label) {
  const result = await validateConfig(runtime, token, configVersionId);
  assert.strictEqual(result.ok, true, `${label} validation response ok`);
  assert.strictEqual(result.valid, true, `${label} semantic validation`);
  return result;
}

async function expectActivateDenied(runtime, token, configVersionId, label) {
  const response = await fetch(`${runtime.supabaseUrl}/rest/v1/rpc/activate_cost_config`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify({ p_config_version_id: configVersionId })
  });
  assert.notStrictEqual(response.status, 200, `${label} activation denied`);
  const text = await response.text();
  assert.match(text, /SEMANTIC_VALIDATION_STALE|semantically validated|semantic/i, `${label} stale semantic validation reason`);
}

async function createHarnessDraft(runtime, token, stamp, suffix, baseConfig, seasonKey = null, companyId = COMPANY_A_ID) {
  return rpc(runtime, token, 'create_cost_config_draft', {
    p_company_id: companyId,
    p_cost_model_code: 'cost-model-001',
    p_config_code: `QA-COST-${suffix}-${stamp}`,
    p_config_label: `QA Cost ${suffix} ${stamp}`,
    p_base_config: baseConfig,
    p_based_on_config_version_id: null,
    p_season_key: seasonKey,
    p_source_reference: 'Costing Edge parity harness',
    p_notes: 'Temporary costing parity validation draft.'
  });
}

function fixtureRowsForUsers(companyAUserId, companyBUserId) {
  return FIXTURES.map((row) => {
    const normalized = {};
    for (const column of FIXTURE_COLUMNS) normalized[column] = Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null;
    normalized.description = `${FIXTURE_MARKER} ${row.description}`;
    normalized.user_id = row.id === -770009 ? companyBUserId : companyAUserId;
    return normalized;
  });
}

function fixtureIdsQuery() {
  return `id=in.(${FIXTURES.map((row) => row.id).join(',')})`;
}

async function ensureNoFixtureCollision(runtime, token) {
  const existing = await rest(
    runtime,
    token,
    'negotiation_rows',
    `${fixtureIdsQuery()}&select=id,modelo,description,user_id`
  );
  if (!existing.length) return;
  const safeExisting = existing.filter((row) => String(row.description || '').includes(FIXTURE_MARKER));
  if (safeExisting.length !== existing.length) {
    throw new Error(`QA fixture id collision with non-harness rows: ${existing.map((row) => row.id).join(',')}`);
  }
  throw new Error(`QA fixture rows already exist from a previous run: ${existing.map((row) => row.id).join(',')}`);
}

async function setupStyleFixtures(runtime, tokens) {
  const [companyAUser, companyBUser] = await Promise.all([
    authUser(runtime, tokens.companyAAdmin),
    authUser(runtime, tokens.companyBAdmin)
  ]);
  await ensureNoFixtureCollision(runtime, tokens.platformAdmin);
  const rows = fixtureRowsForUsers(companyAUser.id, companyBUser.id);
  const inserted = await restWrite(runtime, tokens.companyAAdmin, 'negotiation_rows', 'POST', '', rows.slice(0, 8));
  const insertedB = await restWrite(runtime, tokens.companyBAdmin, 'negotiation_rows', 'POST', '', rows.slice(8));
  return {
    companyAIds: (inserted || []).map((row) => row.id),
    companyBIds: (insertedB || []).map((row) => row.id),
    allIds: rows.map((row) => row.id)
  };
}

async function deleteOwnedFixtureRows(runtime, token, ids) {
  if (!ids || !ids.length) return;
  await restWrite(
    runtime,
    token,
    'negotiation_rows',
    'DELETE',
    `id=in.(${ids.join(',')})&description=like.*${FIXTURE_MARKER}*`,
    null,
    true
  );
}

async function cleanupStyleFixtures(runtime, tokens, created) {
  if (!created) return;
  await deleteOwnedFixtureRows(runtime, tokens.companyAAdmin, created.companyAIds);
  await deleteOwnedFixtureRows(runtime, tokens.companyBAdmin, created.companyBIds);
  const remaining = await rest(
    runtime,
    tokens.platformAdmin,
    'negotiation_rows',
    `${fixtureIdsQuery()}&description=like.*${FIXTURE_MARKER}*&select=id`
  );
  assert.strictEqual(remaining.length, 0, `QA fixture cleanup left rows: ${remaining.map((row) => row.id).join(',')}`);
}

async function legacyMarkValidated(runtime, token, configVersionId) {
  return rpc(runtime, token, 'mark_cost_config_semantically_validated', {
    p_config_version_id: configVersionId,
    p_formula_version: 1,
    p_validation_result: { harness: 'costing-edge-parity', status: 'PASS' }
  });
}

async function main() {
  const currentOnly = process.argv.includes('--current-only');
  const runtime = readJson(RUNTIME_PATH);
  const password = readText(PASSWORD_PATH);

  assert.strictEqual(runtime.projectRef, 'amitkdqyfblymzdsrplx', 'wrong staging project');
  const tokens = {
    companyAAdmin: await login(runtime, COMPANY_A_ADMIN, password),
    companyAMember: await login(runtime, COMPANY_A_MEMBER, password),
    companyBAdmin: await login(runtime, COMPANY_B_ADMIN, password),
    platformAdmin: await login(runtime, PLATFORM_ADMIN, password)
  };

  const fixtureById = Object.fromEntries(FIXTURES.map((row) => [String(row.id), row]));
  let restoreDraft = null;
  let parityDraft = null;
  let createdFixtures = null;

  try {
    createdFixtures = await setupStyleFixtures(runtime, tokens);
    const started = await loadActive(runtime, tokens.companyAAdmin);
    const startedModel = buildModel(started.version, started.overrides);
    assert.strictEqual(started.components.length, 0, 'active additional components are not currently supported');

    const currentResponse = await edge(runtime, tokens.companyAAdmin, { styleIds: [-770001, -770002, -770003] });
    assert.strictEqual(currentResponse.ok, true, 'current active response ok');
    for (const result of currentResponse.results) {
      compareReady(`current active ${result.styleId}`, result, expectedResult(result.styleId, fixtureById[String(result.styleId)], startedModel));
    }

    const memberResponse = await edge(runtime, tokens.companyAMember, { styleIds: [-770001] });
    compareReady('company member authorized', memberResponse.results[0], expectedResult(-770001, fixtureById['-770001'], startedModel));

    const platformResponse = await edge(runtime, tokens.platformAdmin, { styleIds: [-770001], targetCompanyId: COMPANY_A_ID });
    compareReady('platform admin scoped', platformResponse.results[0], expectedResult(-770001, fixtureById['-770001'], startedModel));

    const deniedNoTarget = await fetch(`${runtime.supabaseUrl}/functions/v1/calculate-style-cost`, {
      method: 'POST',
      headers: headers(runtime, tokens.platformAdmin),
      body: JSON.stringify({ styleIds: [-770001] })
    });
    assert.strictEqual(deniedNoTarget.status, 400, 'platform admin without target rejected');

    const foreignResponse = await edge(runtime, tokens.companyBAdmin, { styleIds: [-770001] });
    assert.strictEqual(foreignResponse.results[0].status, 'DENIED', 'foreign company denied');

    const mixedResponse = await edge(runtime, tokens.companyAAdmin, { styleIds: [-770001, -770009, -779999] });
    assert.strictEqual(mixedResponse.results[0].status, 'READY', 'mixed authorized ready');
    assert.strictEqual(mixedResponse.results[1].status, 'DENIED', 'mixed foreign denied');
    assert.strictEqual(mixedResponse.results[2].status, 'DENIED', 'mixed unknown denied');
    assert.strictEqual(mixedResponse.results[1].reason, 'STYLE_NOT_AVAILABLE', 'mixed foreign no leakage');
    assert.strictEqual(mixedResponse.results[2].reason, 'STYLE_NOT_AVAILABLE', 'mixed unknown no leakage');

    const hundred = await edge(runtime, tokens.companyAAdmin, { styleIds: Array.from({ length: 100 }, () => -770001) });
    assert.strictEqual(hundred.ok, true, '100 style request accepted');
    const hundredOne = await fetch(`${runtime.supabaseUrl}/functions/v1/calculate-style-cost`, {
      method: 'POST',
      headers: headers(runtime, tokens.companyAAdmin),
      body: JSON.stringify({ styleIds: Array.from({ length: 101 }, (_, i) => -770001 - i) })
    });
    assert.strictEqual(hundredOne.status, 400, '101 style request rejected');

    if (currentOnly) {
      console.log(JSON.stringify({
        ok: true,
        mode: 'current-only',
        projectRef: runtime.projectRef,
        startedActiveConfigId: started.version.id,
        currentActiveRows: currentResponse.count,
        companyMemberAuthorization: 'PASS',
        platformAdminScopedAuthorization: 'PASS',
        platformAdminNoTarget: 'PASS',
        crossCompanySecurity: 'PASS',
        mixedSecurity: 'PASS',
        batchLimit: 'PASS',
        responsePrivacy: 'PASS',
        additionalComponents: 'none enabled; enabled components remain unsupported by Edge'
      }, null, 2));
      return;
    }

    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    restoreDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'RESTORE', fullConfig());
    await validateOrThrow(runtime, tokens.companyAAdmin, restoreDraft.id, 'restore draft');

    const directMarkAttack = await directMarkValidated(runtime, tokens.companyAAdmin, restoreDraft.id);
    assert.notStrictEqual(directMarkAttack.status, 200, 'Company Admin direct mark RPC attack denied');

    const normalMemberValidate = await fetch(`${runtime.supabaseUrl}/functions/v1/validate-cost-config`, {
      method: 'POST',
      headers: headers(runtime, tokens.companyAMember),
      body: JSON.stringify({ configId: restoreDraft.id })
    });
    assert.strictEqual(normalMemberValidate.status, 403, 'normal member semantic validation denied');

    const anonValidate = await fetch(`${runtime.supabaseUrl}/functions/v1/validate-cost-config`, {
      method: 'POST',
      headers: {
        apikey: runtime.publishableKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ configId: restoreDraft.id })
    });
    assert.strictEqual(anonValidate.status, 401, 'anon semantic validation denied');

    const companyBDraft = await createHarnessDraft(runtime, tokens.companyBAdmin, stamp, 'COMPANYB', fullConfig(), null, COMPANY_B_ID);
    const crossCompanyValidate = await fetch(`${runtime.supabaseUrl}/functions/v1/validate-cost-config`, {
      method: 'POST',
      headers: headers(runtime, tokens.companyAAdmin),
      body: JSON.stringify({ configId: companyBDraft.id })
    });
    assert.strictEqual(crossCompanyValidate.status, 403, 'cross-company semantic validation denied');
    await validateOrThrow(runtime, tokens.platformAdmin, companyBDraft.id, 'platform admin company B draft');

    const unknownKeyDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'UNKNOWNKEY', fullConfig({ mysteryKey: true }));
    const unknownKeyValidation = await validateConfig(runtime, tokens.companyAAdmin, unknownKeyDraft.id);
    assert.strictEqual(unknownKeyValidation.valid, false, 'unknown semantic key rejected');
    assert.ok((unknownKeyValidation.errors || []).some((err) => err.code === 'UNKNOWN_KEY'), 'unknown key error code');

    const badTypeDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'BADTYPE', fullConfig({ assumptions: { ...fullConfig().assumptions, insuranceRate: '0.003' } }));
    const badTypeValidation = await validateConfig(runtime, tokens.companyAAdmin, badTypeDraft.id);
    assert.strictEqual(badTypeValidation.valid, false, 'bad numeric string rejected');

    const nonFiniteDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'EXTREME', fullConfig({ assumptions: { ...fullConfig().assumptions, targetImu: 2 } }));
    const nonFiniteValidation = await validateConfig(runtime, tokens.companyAAdmin, nonFiniteDraft.id);
    assert.strictEqual(nonFiniteValidation.valid, false, 'out of range numeric rejected');

    const staleBaseDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'STALEBASE', fullConfig());
    await validateOrThrow(runtime, tokens.companyAAdmin, staleBaseDraft.id, 'stale base setup');
    await rpc(runtime, tokens.companyAAdmin, 'update_cost_config_draft', {
      p_config_version_id: staleBaseDraft.id,
      p_patch: { assumptions: { ...fullConfig().assumptions, vatRate: 0.21 } }
    });
    await expectActivateDenied(runtime, tokens.companyAAdmin, staleBaseDraft.id, 'validate-edit-base');

    const staleOverrideDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'STALEOVERRIDE', fullConfig());
    await validateOrThrow(runtime, tokens.companyAAdmin, staleOverrideDraft.id, 'stale override setup');
    await rpc(runtime, tokens.companyAAdmin, 'upsert_cost_override', {
      p_config_version_id: staleOverrideDraft.id,
      p_season_key: 'FW26',
      p_origin_key: 'VIETNAM',
      p_category_key: 'Pants Commercial',
      p_values: { fixedDuty: 2.2, dutyPercent: 0.2, loadNorm: 9100 },
      p_source_reference: 'Costing Edge parity harness'
    });
    await expectActivateDenied(runtime, tokens.companyAAdmin, staleOverrideDraft.id, 'validate-edit-override');

    const staleComponentDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'STALECOMPONENT', fullConfig());
    await validateOrThrow(runtime, tokens.companyAAdmin, staleComponentDraft.id, 'stale component setup');
    await rpc(runtime, tokens.companyAAdmin, 'add_cost_component', {
      p_config_version_id: staleComponentDraft.id,
      p_component: {
        name: 'Disabled QA cost',
        calculation_type: 'FIXED_PER_UNIT',
        value: 0.1,
        currency: 'USD',
        enabled: false,
        source_reference: 'Costing Edge parity harness'
      }
    });
    await expectActivateDenied(runtime, tokens.companyAAdmin, staleComponentDraft.id, 'validate-edit-component');

    const enabledComponentDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'ENABLEDCOMPONENT', fullConfig());
    await rpc(runtime, tokens.companyAAdmin, 'add_cost_component', {
      p_config_version_id: enabledComponentDraft.id,
      p_component: {
        name: 'Enabled QA cost',
        calculation_type: 'FIXED_PER_UNIT',
        value: 0.1,
        currency: 'USD',
        enabled: true,
        source_reference: 'Costing Edge parity harness'
      }
    });
    const enabledComponentValidation = await validateConfig(runtime, tokens.companyAAdmin, enabledComponentDraft.id);
    assert.strictEqual(enabledComponentValidation.valid, false, 'enabled unsupported component rejected');
    assert.ok((enabledComponentValidation.errors || []).some((err) => err.code === 'UNSUPPORTED_ADDITIONAL_COMPONENT'), 'enabled component error code');

    await validateOrThrow(runtime, tokens.companyAAdmin, staleComponentDraft.id, 'revalidated disabled component draft');
    await rpc(runtime, tokens.companyAAdmin, 'activate_cost_config', { p_config_version_id: staleComponentDraft.id });
    restoreDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, `${stamp}R`, 'RESTORE', fullConfig());
    await validateOrThrow(runtime, tokens.companyAAdmin, restoreDraft.id, 'restore after revalidation test');

    parityDraft = await createHarnessDraft(runtime, tokens.companyAAdmin, stamp, 'PARITY', fullConfig(), 'FW26');
    await rpc(runtime, tokens.companyAAdmin, 'upsert_cost_override', {
      p_config_version_id: parityDraft.id,
      p_season_key: 'FW26',
      p_origin_key: 'VIETNAM',
      p_category_key: 'Pants Commercial',
      p_values: { fixedDuty: 2.2, dutyPercent: 0.2, loadNorm: 9100 },
      p_source_reference: 'Costing Edge parity harness'
    });
    await validateOrThrow(runtime, tokens.companyAAdmin, parityDraft.id, 'parity draft');
    await rpc(runtime, tokens.companyAAdmin, 'activate_cost_config', { p_config_version_id: parityDraft.id });

    const activeParity = await loadActive(runtime, tokens.companyAAdmin);
    assert.strictEqual(activeParity.version.id, parityDraft.id, 'temporary parity config active');
    const parityModel = buildModel(activeParity.version, activeParity.overrides);
    const parityIds = [-770001, -770002, -770003, -770004, -770005, -770006, -770007, -770008];
    const startedAt = Date.now();
    const parityResponse = await edge(runtime, tokens.companyAAdmin, { styleIds: parityIds });
    const durationMs = Date.now() - startedAt;
    assert.strictEqual(parityResponse.count, parityIds.length, 'parity batch count');
    for (const result of parityResponse.results) {
      compareReady(`temporary parity ${result.styleId}`, result, expectedResult(result.styleId, fixtureById[String(result.styleId)], parityModel));
    }

    assert.notStrictEqual(parityResponse.results.find((r) => r.styleId === -770002).customs, parityResponse.results.find((r) => r.styleId === -770006).customs, 'FW26 override differs from wrong season');
    assert.notStrictEqual(parityResponse.results.find((r) => r.styleId === -770002).customs, parityResponse.results.find((r) => r.styleId === -770007).customs, 'category mismatch does not receive Pants override');
    assert.strictEqual(contract.responseContainsForbiddenKey(parityResponse), false, 'batch response privacy');

    console.log(JSON.stringify({
      ok: true,
      projectRef: runtime.projectRef,
      startedActiveConfigId: started.version.id,
      restoreDraftId: restoreDraft.id,
      parityDraftId: parityDraft.id,
      currentActiveRows: currentResponse.count,
      parityRows: parityResponse.count,
      mixedSecurity: 'PASS',
      batchLimit: 'PASS',
      responsePrivacy: 'PASS',
      additionalComponents: 'none enabled; enabled components remain unsupported by Edge',
      durationMs
    }, null, 2));
  } finally {
    await cleanupStyleFixtures(runtime, tokens, createdFixtures).catch((error) => {
      console.error('FIXTURE_CLEANUP_FAILED', error.message);
      process.exitCode = 1;
    });
    if (restoreDraft) {
      await validateConfig(runtime, tokens.companyAAdmin, restoreDraft.id).catch(() => null);
      const current = await loadActive(runtime, tokens.companyAAdmin).catch(() => null);
      if (!current || current.version.id !== restoreDraft.id) {
        await rpc(runtime, tokens.companyAAdmin, 'activate_cost_config', { p_config_version_id: restoreDraft.id }).catch((error) => {
          console.error('RESTORE_FAILED', error.message);
          process.exitCode = 1;
        });
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
