#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.STDTEX_E2E_BASE || 'http://127.0.0.1:8790';
const RUNTIME_PATH = path.join(ROOT, '.codex-secrets', 'stdtex-staging-runtime.json');
const PASSWORD_PATH = path.join(ROOT, '.codex-secrets', 'staging-auth-test-password.txt');
const STAGING_REF = 'amitkdqyfblymzdsrplx';
const PROD_REF = 'vtyffyywmqnlfemzlsbz';
const COMPANY_A_ID = '03d6172b-fbbd-499b-a5ab-0b65f17a35ea';
const COMPANY_A_ADMIN = 'companya.admin@example.test';
const COMPANY_A_MEMBER = 'companya.member1@example.test';
const PLATFORM_ADMIN = 'platform.admin@example.test';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, ms = 15000, step = 250) {
  const started = Date.now();
  let last;
  while (Date.now() - started < ms) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (e) {
      last = e;
    }
    await sleep(step);
  }
  if (last) throw last;
  throw new Error('Timed out');
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

async function loginToken(runtime, email, password) {
  const data = await requestJson(`${runtime.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: runtime.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.ok(data.access_token, `missing access token for ${email}`);
  return data.access_token;
}

async function rest(runtime, token, table, query) {
  return requestJson(`${runtime.supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'GET',
    headers: headers(runtime, token)
  });
}

async function restInsert(runtime, token, table, payload, query = 'select=*') {
  return requestJson(`${runtime.supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'POST',
    headers: { ...headers(runtime, token), Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
}

async function restDelete(runtime, token, table, query) {
  return requestJson(`${runtime.supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { ...headers(runtime, token), Prefer: 'return=minimal' }
  }, true);
}

async function rpc(runtime, token, name, payload) {
  return requestJson(`${runtime.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify(payload || {})
  });
}

async function loadActive(runtime, token) {
  const settings = await rest(runtime, token, 'company_costing_settings', `company_id=eq.${COMPANY_A_ID}&select=company_id,cost_source_type,active_config_version_id,fallback_behavior`);
  assert.strictEqual(settings.length, 1, 'expected one Company A costing setting');
  return settings[0];
}

async function restoreActive(runtime, token, activeId) {
  if (!activeId) return;
  const current = await loadActive(runtime, token);
  if (current.active_config_version_id === activeId) return activeId;
  const draft = await rpc(runtime, token, 'duplicate_cost_config', {
    p_config_version_id: activeId,
    p_new_config_code: `QA-BROWSER-RESTORE-${Date.now()}`,
    p_new_config_label: 'QA Browser Restore'
  });
  await requestJson(`${runtime.supabaseUrl}/functions/v1/validate-cost-config`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify({ configId: draft.id })
  });
  await rpc(runtime, token, 'activate_cost_config', { p_config_version_id: draft.id });
  return draft.id;
}

async function loadProfileByEmail(runtime, token, email) {
  const encodedEmail = encodeURIComponent(email);
  const rows = await rest(runtime, token, 'profiles', `email=eq.${encodedEmail}&select=id,email`);
  assert.strictEqual(rows.length, 1, `expected one profile for ${email}`);
  return rows[0];
}

async function nextPositiveStyleId(runtime, token) {
  const rows = await rest(runtime, token, 'negotiation_rows', 'id=gt.0&select=id&order=id.desc&limit=1');
  const current = rows.length ? Number(rows[0].id) : 1000;
  assert.ok(Number.isSafeInteger(current), 'could not determine current max negotiation row id');
  return Math.max(current + 1, 1000);
}

async function createQaStyle(runtime, token, ownerEmail) {
  const owner = await loadProfileByEmail(runtime, token, ownerEmail);
  const id = await nextPositiveStyleId(runtime, token);
  const marker = `QA-COSTING-BROWSER-E2E-${Date.now()}`;
  const payload = {
    id,
    fecha: '2026-08-15',
    modelo: marker,
    colour: 'QA BLACK',
    description: 'QA costing browser e2e style',
    supplier: 'STW',
    origin: 'VIETNAM',
    transport: 'SEA-TRUCK',
    temporada: 'FW26',
    dept: 'Pants',
    cat: 'Pants Commercial',
    pvp_rub: 1999,
    fob1: 7.45,
    fob2: null,
    fob3: null,
    fob_closed: null,
    weight: 0.5,
    units: 1200,
    target_imu: 0.72,
    notes: marker,
    status: 'PENDING',
    fsd: null,
    hod: null,
    user_id: owner.id,
    updated_at: new Date().toISOString()
  };
  const rows = await restInsert(runtime, token, 'negotiation_rows', [payload], 'select=id,modelo,description,user_id');
  assert.strictEqual(rows.length, 1, 'expected one QA style to be created');
  assert.ok(Number.isSafeInteger(Number(rows[0].id)) && Number(rows[0].id) > 0, 'QA style must have a positive DB id');
  return { id: rows[0].id, marker };
}

async function cleanupQaStyle(runtime, token, qaStyle) {
  if (!qaStyle || !qaStyle.id) return;
  await restDelete(runtime, token, 'negotiation_rows', `id=eq.${qaStyle.id}`);
  const rows = await rest(runtime, token, 'negotiation_rows', `id=eq.${qaStyle.id}&select=id`);
  assert.strictEqual(rows.length, 0, `QA style ${qaStyle.id} was not deleted`);
}

class CdpTab {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.requests = [];
    this.responses = [];
    this.console = [];
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
        return;
      }
      this.events.push(msg);
      if (msg.method === 'Network.requestWillBeSent') {
        this.requests.push({
          requestId: msg.params.requestId,
          method: msg.params.request.method,
          url: msg.params.request.url,
          postData: msg.params.request.postData || ''
        });
      }
      if (msg.method === 'Network.responseReceived') {
        this.responses.push({
          requestId: msg.params.requestId,
          url: msg.params.response.url,
          status: msg.params.response.status
        });
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        this.console.push({ type: msg.params.type, text: (msg.params.args || []).map((a) => a.value || a.description || '').join(' ') });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.console.push({ type: 'exception', text: msg.params.exceptionDetails && msg.params.exceptionDetails.text || 'exception' });
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 25000);
    });
  }
  async ready() {
    await waitFor(() => this.ws.readyState === WebSocket.OPEN, 10000, 100);
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Network.enable');
  }
  async goto(pathname) {
    await this.send('Page.navigate', { url: `${BASE}${pathname}` });
    await this.waitLoad();
  }
  async waitLoad() {
    await waitFor(() => this.events.some((e) => e.method === 'Page.loadEventFired'), 15000, 100).catch(() => null);
    this.events = this.events.filter((e) => e.method !== 'Page.loadEventFired');
    await sleep(700);
  }
  async eval(expression, awaitPromise = true) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(details.exception && (details.exception.description || details.exception.value) || details.text || 'Runtime evaluation failed');
    }
    return result.result && result.result.value;
  }
  async text() {
    return this.eval('document.body ? document.body.innerText : ""');
  }
  async click(selector) {
    await this.eval(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('missing selector ${selector}'); el.click(); return true; })()`);
  }
  async clickByText(selector, text) {
    await this.eval(`(() => {
      const needle=${JSON.stringify(text)};
      const el=Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node)=>String(node.textContent||'').trim().includes(needle));
      if(!el) throw new Error('missing text '+needle);
      el.click();
      return true;
    })()`);
  }
  async setValue(selector, value) {
    await this.eval(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('missing selector ${selector}'); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  }
  async waitSelector(selector, ms = 15000) {
    return waitFor(() => this.eval(`!!document.querySelector(${JSON.stringify(selector)})`), ms, 250);
  }
  async getResponseBodies(filter) {
    const out = [];
    for (const response of this.responses) {
      if (!filter(response)) continue;
      try {
        const body = await this.send('Network.getResponseBody', { requestId: response.requestId });
        out.push({ ...response, body: body.body || '' });
      } catch (e) {
        out.push({ ...response, bodyError: e.message });
      }
    }
    return out;
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function createTab(port) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(BASE + '/')}`, { method: 'PUT' });
  const tab = new CdpTab(target.webSocketDebuggerUrl);
  await tab.ready();
  return tab;
}

async function browserLogin(tab, email, password, route) {
  await tab.goto(route || '/');
  const hasLogin = await tab.eval(`!!document.getElementById('auth-email')`);
  if (!hasLogin) {
    await tab.eval(`(async()=>{try{await sb.auth.signOut()}catch(e){};try{localStorage.clear();sessionStorage.clear()}catch(e){};location.href='/';return true;})()`);
    await sleep(1000);
  }
  await tab.waitSelector('#auth-email');
  await tab.setValue('#auth-email', email);
  await tab.setValue('#auth-pwd', password);
  await tab.eval('doLoginForm()');
  await waitFor(async () => {
    const text = await tab.text();
    return !text.includes('Hi boss,') && !text.includes('Please enter email');
  }, 25000, 500);
  await sleep(1800);
}

async function run() {
  const runtime = readJson(RUNTIME_PATH);
  const password = readText(PASSWORD_PATH);
  assert.strictEqual(runtime.projectRef, STAGING_REF, 'runtime projectRef must be staging');
  assert.ok(String(runtime.supabaseUrl || '').includes(STAGING_REF), 'runtime URL must be staging');
  assert.ok(!String(runtime.supabaseUrl || '').includes(PROD_REF), 'runtime URL points at production');

  const adminToken = await loginToken(runtime, COMPANY_A_ADMIN, password);
  const memberToken = await loginToken(runtime, COMPANY_A_MEMBER, password);
  await loginToken(runtime, PLATFORM_ADMIN, password);
  const started = await loadActive(runtime, adminToken);

  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9340 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stdtex-costing-cdp-'));
  const child = spawn(chrome, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--new-window',
    `${BASE}/`
  ], { stdio: 'ignore', detached: false });

  const report = {
    ok: false,
    base: BASE,
    projectRef: runtime.projectRef,
    startedActiveConfigId: started.active_config_version_id,
    checks: [],
    edgeCalls: [],
    console: []
  };
  let tab;
  let qaStyle = null;
  try {
    await waitFor(async () => {
      try { await fetchJson(`http://127.0.0.1:${port}/json/version`); return true; } catch { return false; }
    }, 15000, 250);
    tab = await createTab(port);

    await browserLogin(tab, COMPANY_A_ADMIN, password, '/mycompany');
    await tab.goto('/mycompany');
    await tab.waitSelector('#company-page-body');
    await waitFor(async () => (await tab.text()).includes('Costing'), 25000, 500);
    await tab.clickByText('button', 'Costing');
    await tab.waitSelector('#company-costing-settings-root');
    try {
      await tab.waitSelector('[data-testid="costing-source-panel"]', 25000);
    } catch (e) {
      const debug = await tab.eval(`(() => ({
        href: location.href,
        costingSettings: typeof window.CostingSettings,
        costingRenderer: typeof window.CostingSettingsRenderer,
        authEmail: window.AUTH_USER && window.AUTH_USER.email,
        activeCompany: typeof activeCompanyName==='function' ? activeCompanyName() : null,
        isCompanyAdmin: typeof isCompanyAdmin==='function' ? isCompanyAdmin() : null,
        rootHtml: (document.getElementById('company-costing-settings-root')||{}).innerHTML || '',
        bodyText: document.body.innerText.slice(0, 2000)
      }))()`);
      throw new Error(`Costing panel did not mount: ${JSON.stringify(debug)}`);
    }
    let text = await tab.text();
    assert.ok(text.includes('Costing'), 'Costing panel did not render');
    report.checks.push('admin login and costing panel PASS');

    const beforeDrafts = await rest(runtime, adminToken, 'cost_config_versions', `company_id=eq.${COMPANY_A_ID}&lifecycle_status=eq.DRAFT&select=id`);
    if (await tab.eval(`!!document.querySelector('[data-testid="costing-create-draft"]')`)) {
      await tab.click('[data-testid="costing-create-draft"]');
    } else {
      await tab.click('[data-testid="costing-new-draft"]');
    }
    await waitFor(async () => (await tab.text()).includes('Draft') && await tab.eval(`!!document.querySelector('[data-testid="costing-save-draft"]')`), 25000, 500);
    const draftId = await tab.eval(`CostingSettingsState.selectedVersion() && CostingSettingsState.selectedVersion().id`);
    assert.ok(draftId, 'no selected draft id after draft creation');
    report.createdDraftId = draftId;
    report.checks.push(`draft creation/select PASS (${draftId}, existing drafts before ${beforeDrafts.length})`);

    await tab.setValue('[data-cost-var="rubExchangeRate"]', '88');
    await tab.click('[data-testid="costing-save-draft"]');
    const savedVersion = await waitFor(async () => {
      const rows = await rest(runtime, adminToken, 'cost_config_versions', `id=eq.${draftId}&select=id,base_config,semantic_validation_status`);
      return rows.length && Number(rows[0].base_config.assumptions.rubExchangeRate) === 88 ? rows : false;
    }, 25000, 500);
    assert.strictEqual(savedVersion.length, 1, 'saved draft not found in DB');
    assert.strictEqual(Number(savedVersion[0].base_config.assumptions.rubExchangeRate), 88, 'draft variable not persisted');
    report.checks.push('draft variable edit and persistence PASS');
    await tab.waitSelector('[data-testid="costing-toggle-logistics"]', 25000);

    await tab.click('[data-testid="costing-toggle-logistics"]');
    await tab.waitSelector('#cost-logistics-origin', 25000);
    const logisticsCount = await tab.eval(`document.querySelectorAll('[data-cost-route-row]').length`);
    assert.ok(logisticsCount >= 21, `expected workbook logistics rows, got ${logisticsCount}`);
    await tab.setValue('#cost-logistics-origin', 'QA ORIGIN');
    await tab.setValue('#cost-logistics-transport', 'QA-TRUCK');
    await tab.setValue('#cost-logistics-cost', '12345');
    await tab.setValue('#cost-logistics-days', '9');
    await tab.click('[data-testid="costing-add-logistics"]');
    await tab.click('[data-testid="costing-save-draft"]');
    await waitFor(async () => {
      const rows = await rest(runtime, adminToken, 'cost_config_versions', `id=eq.${draftId}&select=id,base_config`);
      const route = rows[0] && rows[0].base_config && rows[0].base_config.freightRoutes && rows[0].base_config.freightRoutes['QA ORIGIN|QA-TRUCK'];
      return route && Number(route.cost) === 12345 && Number(route.days) === 9 ? rows : false;
    }, 25000, 500);
    report.checks.push('editable logistics table persistence PASS');
    await tab.waitSelector('[data-testid="costing-toggle-duties"]', 25000);

    await tab.click('[data-testid="costing-toggle-duties"]');
    await tab.waitSelector('#cost-duty-country', 25000);
    const dutyCount = await tab.eval(`document.querySelectorAll('[data-cost-duty-row]').length`);
    assert.ok(dutyCount >= 337, `expected workbook duty rows, got ${dutyCount}`);
    await tab.setValue('#cost-duty-country', 'QA COUNTRY');
    await tab.setValue('#cost-duty-dept', 'QA DEPT');
    await tab.setValue('#cost-duty-cat', 'QA CATEGORY');
    await tab.setValue('#cost-duty-fixed', '2.34');
    await tab.setValue('#cost-duty-pct', '0.05');
    await tab.setValue('#cost-duty-load', '4321');
    await tab.click('[data-testid="costing-add-duty"]');
    await tab.click('[data-testid="costing-save-draft"]');
    await waitFor(async () => {
      const rows = await rest(runtime, adminToken, 'cost_config_versions', `id=eq.${draftId}&select=id,base_config`);
      const dutyRows = rows[0] && rows[0].base_config && rows[0].base_config.dutyRows;
      const match = Array.isArray(dutyRows) && dutyRows.find((row) => row.country === 'QA COUNTRY' && row.dept === 'QA DEPT' && row.cat === 'QA CATEGORY');
      return match && Number(match.fixed) === 2.34 && Number(match.pct) === 0.05 && Number(match.load_norm) === 4321 ? rows : false;
    }, 25000, 500);
    report.checks.push('editable duties table persistence PASS');

    await tab.eval(`CostingSettings.selectVersion(${JSON.stringify(draftId)})`);
    await waitFor(() => tab.eval(`CostingSettingsState.selectedVersion() && CostingSettingsState.selectedVersion().id === ${JSON.stringify(draftId)}`), 25000, 500);
    await tab.waitSelector('[data-testid="costing-add-override"]', 25000);
    await tab.setValue('#cost-override-season', 'FW26');
    await tab.setValue('#cost-override-origin', 'VIETNAM');
    await tab.setValue('#cost-override-category', 'Pants Commercial');
    await tab.setValue('#cost-override-fixed', '1.23');
    await tab.setValue('#cost-override-percent', '13');
    await tab.click('[data-testid="costing-add-override"]');
    await waitFor(async () => {
      const rows = await rest(runtime, adminToken, 'cost_config_overrides', `config_version_id=eq.${draftId}&season_key=eq.FW26&origin_key=eq.VIETNAM&category_key=eq.Pants%20Commercial&select=id,values`);
      return rows.length ? rows : false;
    }, 20000, 500);
    report.checks.push('override add and persistence PASS');

    await tab.eval(`CostingSettings.selectVersion(${JSON.stringify(draftId)})`);
    await waitFor(() => tab.eval(`CostingSettingsState.selectedVersion() && CostingSettingsState.selectedVersion().id === ${JSON.stringify(draftId)}`), 25000, 500);
    await tab.waitSelector('[data-testid="costing-test-config"]', 25000);
    await tab.click('[data-testid="costing-test-config"]');
    const validationRows = await waitFor(async () => {
      const rows = await rest(runtime, adminToken, 'cost_config_versions', `id=eq.${draftId}&select=semantic_validation_status,semantic_validation_hash`);
      return rows.length && rows[0].semantic_validation_status === 'VALID' ? rows : false;
    }, 30000, 500).catch(async (e) => {
      const rows = await rest(runtime, adminToken, 'cost_config_versions', `id=eq.${draftId}&select=semantic_validation_status,semantic_validation_hash`);
      const bodyText = await tab.text();
      throw new Error(`draft validation did not become VALID: ${JSON.stringify(rows)} body=${bodyText.slice(0, 1200)} cause=${e.message}`);
    });
    assert.strictEqual(validationRows[0].semantic_validation_status, 'VALID', 'draft did not become semantically valid');
    report.checks.push('trusted backend validation through UI PASS');

    await tab.eval('window.confirm=()=>true');
    await tab.waitSelector('[data-testid="costing-activate-config"]', 25000);
    await tab.click('[data-testid="costing-activate-config"]');
    await waitFor(async () => {
      const current = await loadActive(runtime, adminToken);
      return current.active_config_version_id === draftId;
    }, 25000, 500);
    report.checks.push('activation through UI PASS');

    qaStyle = await createQaStyle(runtime, adminToken, COMPANY_A_ADMIN);
    report.qaStyleId = qaStyle.id;
    report.checks.push(`QA positive negotiation row created PASS (${qaStyle.id})`);

    await tab.goto('/negotiation');
    await waitFor(async () => {
      const postRequestIds = tab.requests
        .filter((r) => r.method === 'POST' && r.url.includes('/functions/v1/calculate-style-cost'))
        .map((r) => r.requestId);
      return tab.responses.some((r) => postRequestIds.includes(r.requestId) && r.status >= 200 && r.status < 300);
    }, 35000, 500).catch(async (e) => {
      const debug = await tab.eval(`(() => {
        const rows = Array.isArray(window.ROWS) ? window.ROWS : [];
        const pending = rows.filter((r) => typeof window.isOpenBuyingRow === 'function' ? window.isOpenBuyingRow(r) : r && r.status !== 'CLOSED');
        return {
          href: location.href,
          activePage: typeof window.activePageName === 'function' ? window.activePageName() : null,
          authEmail: window.AUTH_USER && window.AUTH_USER.email || null,
          profile: window.AUTH_PROFILE && {
            role: window.AUTH_PROFILE.role,
            access_role: window.AUTH_PROFILE.access_role,
            company_name: window.AUTH_PROFILE.company_name,
            active_company_name: window.AUTH_PROFILE.active_company_name,
            company_type: window.AUTH_PROFILE.company_type
          },
          isAdmin: typeof window.isAdmin === 'function' ? window.isAdmin() : null,
          activeCompanyName: typeof window.activeCompanyName === 'function' ? window.activeCompanyName() : null,
          costingCanRequest: typeof window.costingCanRequestForContext === 'function' ? window.costingCanRequestForContext() : null,
          serviceAvailable: !!window.StdtexCostingCalculationService,
          rows: rows.length,
          pending: pending.length,
          pendingIds: pending.slice(0, 10).map((r) => r && r.id)
        };
      })()`);
      const requestPreview = tab.requests.slice(-25).map((r) => `${r.method} ${r.url}`).join('\n');
      throw new Error(`successful calculate-style-cost POST was not captured: ${e.message}; debug=${JSON.stringify(debug)}; recentRequests=${requestPreview}`);
    });
    text = await tab.text();
    assert.ok(text.includes('LINES') || text.includes('FOB TARGET') || text.includes('FOB Target'), 'Negotiation did not render cost columns');
    const edgeBodies = await tab.getResponseBodies((r) => r.url.includes('/functions/v1/calculate-style-cost') || r.url.includes('/functions/v1/validate-cost-config'));
    report.edgeCalls = edgeBodies.map((r) => ({ url: r.url, status: r.status, bodyPreview: String(r.body || r.bodyError || '').slice(0, 500) }));
    assert.ok(edgeBodies.some((r) => r.url.includes('calculate-style-cost') && r.status >= 200 && r.status < 300), 'no successful calculate-style-cost response captured');
    assert.ok(edgeBodies.some((r) => {
      if (!r.url.includes('calculate-style-cost') || r.status < 200 || r.status >= 300 || !r.body) return false;
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.results) && body.results.some((result) => String(result.styleId) === String(qaStyle.id));
      } catch {
        return false;
      }
    }), `calculate-style-cost response did not include QA style ${qaStyle.id}`);
    report.checks.push('negotiation costing edge consumption PASS');

    const memberRequestStart = tab.requests.length;
    await browserLogin(tab, COMPANY_A_MEMBER, password, '/negotiation');
    await waitFor(async () => {
      const postRequestIds = tab.requests
        .slice(memberRequestStart)
        .filter((r) => r.method === 'POST' && r.url.includes('/functions/v1/calculate-style-cost'))
        .map((r) => r.requestId);
      return tab.responses.some((r) => postRequestIds.includes(r.requestId) && r.status >= 200 && r.status < 300);
    }, 35000, 500).catch(() => null);
    const memberText = await tab.text();
    assert.ok(memberText.includes('LINES') || memberText.includes('FOB TARGET') || memberText.includes('FOB Target'), 'member negotiation did not render');
    const memberRawConfigRequests = tab.requests.slice(memberRequestStart).filter((r) => /company_costing_settings|cost_config_versions|cost_config_overrides|cost_additional_components/.test(r.url));
    report.memberRawConfigRequestCount = memberRawConfigRequests.length;
    assert.strictEqual(memberRawConfigRequests.length, 0, 'member browser made raw costing config table requests');
    report.checks.push('company member costing privacy PASS');

    const productionRequests = tab.requests.filter((r) => r.url.includes(PROD_REF));
    assert.strictEqual(productionRequests.length, 0, 'browser touched production Supabase');
    report.checks.push('production isolation PASS');

    const restoredConfigId = await restoreActive(runtime, adminToken, started.active_config_version_id);
    const restored = await loadActive(runtime, adminToken);
    assert.strictEqual(restored.active_config_version_id, restoredConfigId, 'active config was not restored through lifecycle');
    assert.notStrictEqual(restored.active_config_version_id, draftId, 'QA draft remained active after restore');
    report.restoredActiveConfigId = restored.active_config_version_id;
    report.checks.push('active config restore through lifecycle PASS');

    await cleanupQaStyle(runtime, adminToken, qaStyle);
    qaStyle = null;
    report.checks.push('QA style cleanup PASS');

    report.console = tab.console;
    const activeConsoleErrors = tab.console.filter((c) => c.type === 'error' || c.type === 'exception');
    assert.strictEqual(activeConsoleErrors.length, 0, `console errors: ${JSON.stringify(activeConsoleErrors)}`);
    report.ok = true;
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.error = error && error.stack || String(error);
    try {
      await restoreActive(runtime, adminToken, started.active_config_version_id);
      report.restoreAttempted = true;
    } catch (restoreError) {
      report.restoreError = restoreError && restoreError.stack || String(restoreError);
    }
    if (tab) report.console = tab.console;
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    if (qaStyle) {
      try {
        await cleanupQaStyle(runtime, adminToken, qaStyle);
        report.qaCleanupAttempted = true;
      } catch (cleanupError) {
        report.qaCleanupError = cleanupError && cleanupError.stack || String(cleanupError);
      }
    }
    if (tab) tab.close();
    try { child.kill(); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

run().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
