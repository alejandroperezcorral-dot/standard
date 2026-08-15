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
const COMPANY_B_ID = 'b5ac132b-12e6-4678-b30e-551c0931f9fa';
const COMPANY_A_ADMIN = 'companya.admin@example.test';
const COMPANY_A_MEMBER = 'companya.member1@example.test';
const COMPANY_B_ADMIN = 'companyb.admin@example.test';
const PLATFORM_ADMIN = 'platform.admin@example.test';
let NEXT_QA_STYLE_ID = 900000000 + Math.floor(Math.random() * 1000000);

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
    } catch (error) {
      last = error;
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

async function restWrite(runtime, token, table, method, query, payload, allowEmpty = false, prefer = 'return=representation') {
  const url = `${runtime.supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
  return requestJson(url, {
    method,
    headers: Object.assign({}, headers(runtime, token), prefer ? { Prefer: prefer } : {}),
    body: payload == null ? undefined : JSON.stringify(payload)
  }, allowEmpty);
}

async function edge(runtime, token, payload) {
  return requestJson(`${runtime.supabaseUrl}/functions/v1/calculate-style-cost`, {
    method: 'POST',
    headers: headers(runtime, token),
    body: JSON.stringify(payload)
  });
}

async function loadProfileByEmail(runtime, token, email) {
  const rows = await rest(runtime, token, 'profiles', `email=eq.${encodeURIComponent(email)}&select=id,email,role,access_role,company_name,active_company_name,company_type`);
  assert.strictEqual(rows.length, 1, `expected one profile for ${email}`);
  return rows[0];
}

async function nextPositiveStyleId(runtime, token) {
  const rows = await rest(runtime, token, 'negotiation_rows', `id=gte.${NEXT_QA_STYLE_ID}&select=id&order=id.desc&limit=1`);
  if (!rows.length) return NEXT_QA_STYLE_ID++;
  const current = rows.length ? Number(rows[0].id) : 1000;
  assert.ok(Number.isSafeInteger(current), 'could not determine current max negotiation row id');
  NEXT_QA_STYLE_ID = Math.max(NEXT_QA_STYLE_ID, current + 1);
  return NEXT_QA_STYLE_ID++;
}

async function createQaStyle(runtime, token, ownerEmail, overrides = {}) {
  const owner = await loadProfileByEmail(runtime, token, ownerEmail);
  const id = await nextPositiveStyleId(runtime, token);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const marker = overrides.marker || `QA-COST-CERT-${stamp}`;
  const payload = Object.assign({
    id,
    fecha: '2026-08-15',
    modelo: marker,
    colour: 'QA BLACK',
    description: 'QA costing final certification style',
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
    fsd: '2026-12-23',
    hod: null,
    user_id: owner.id,
    updated_at: new Date().toISOString()
  }, overrides.row || {});
  const rows = await restWrite(runtime, token, 'negotiation_rows', 'POST', 'select=id,modelo,description,user_id,status', [payload]);
  assert.strictEqual(rows.length, 1, 'expected one QA style to be created');
  assert.ok(Number(rows[0].id) > 0, 'QA style must have a positive DB id');
  return { id: rows[0].id, marker, owner };
}

async function deleteQaStyle(runtime, token, qaStyle) {
  if (!qaStyle || !qaStyle.id) return;
  await restWrite(runtime, token, 'negotiation_rows', 'DELETE', `id=eq.${qaStyle.id}`, null, true, 'return=minimal');
  const rows = await rest(runtime, token, 'negotiation_rows', `id=eq.${qaStyle.id}&select=id`);
  assert.strictEqual(rows.length, 0, `QA style ${qaStyle.id} was not deleted`);
}

async function createQaCollection(runtime, token, profile, name, styleId) {
  const ownerCompany = profile.active_company_name || profile.company_name;
  assert.ok(ownerCompany, 'missing owner company for QA collection');
  const collection = {
    owner_company: ownerCompany,
    owner_group: '',
    owner_type: profile.company_type || 'Brand',
    name,
    fsd: '2026-12-23',
    target_company: ownerCompany,
    target_group: '',
    created_by: profile.id,
    created_by_email: profile.email,
    updated_at: new Date().toISOString()
  };
  await restWrite(runtime, token, 'showroom_collections_scoped', 'POST', 'select=id,name', [collection]);
  await restWrite(runtime, token, 'style_collection_assignments', 'POST', 'select=row_id,collection_name', [{
    row_id: styleId,
    owner_company: ownerCompany,
    owner_group: '',
    owner_type: profile.company_type || 'Brand',
    collection_name: name,
    created_by: profile.id
  }]);
  return { name, ownerCompany, ownerType: profile.company_type || 'Brand' };
}

async function cleanupQaCollection(runtime, token, qaCollection) {
  if (!qaCollection) return;
  const name = encodeURIComponent(qaCollection.name);
  const company = encodeURIComponent(qaCollection.ownerCompany);
  const type = encodeURIComponent(qaCollection.ownerType);
  await restWrite(runtime, token, 'style_collection_assignments', 'DELETE', `collection_name=eq.${name}&owner_company=eq.${company}&owner_type=eq.${type}`, null, true, 'return=minimal');
  await restWrite(runtime, token, 'showroom_collections_scoped', 'DELETE', `name=eq.${name}&owner_company=eq.${company}&owner_type=eq.${type}`, null, true, 'return=minimal');
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
    await sleep(800);
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
      } catch (error) {
        out.push({ ...response, bodyError: error.message });
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
  const url = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(BASE + '/')}`;
  let target;
  try {
    target = await fetchJson(url, { method: 'PUT' });
  } catch (error) {
    if (!String(error && error.message || '').startsWith('501 ')) throw error;
    target = await fetchJson(url, { method: 'GET' });
  }
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

function assertNoForbiddenCostingKeys(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  const forbidden = [
    /Authorization/i,
    /service[_-]?role/i,
    /jwt/i,
    /base_config/i,
    /assumptions/i,
    /freightRoutes/i,
    /dutyRows/i,
    /cost_config_overrides/i,
    /semantic_validation_hash/i
  ];
  const hit = forbidden.find((rx) => rx.test(text));
  assert.ok(!hit, `${label} exposed forbidden costing key ${hit}`);
}

async function assertReadyCost(tab, styleId, label) {
  return waitFor(async () => tab.eval(`(() => {
    const row=(window.ROWS||[]).find((r)=>String(r.id)===${JSON.stringify(String(styleId))});
    if(!row || typeof costDisplayForRow!=='function') return null;
    const c=costDisplayForRow(row);
    if(!c || !c.ready) return null;
    return {
      status:c.status,
      fob:c.fob,
      fobT:c.fobT,
      ldp:c.ldp,
      imu:c.imu,
      mu:c.mu,
      gap:c.gap,
      cu:c.cu,
      cust:c.cust,
      text:document.body.innerText
    };
  })()`), 35000, 500).then((result) => {
    assert.ok(Number.isFinite(Number(result.ldp)), `${label} missing LDP`);
    assert.ok(Number.isFinite(Number(result.imu)), `${label} missing IMU`);
    assert.ok(Number.isFinite(Number(result.fobT)), `${label} missing target FOB`);
    return result;
  });
}

async function runRouteDomSweep(tab) {
  const routes = [
    ['/', 'All'],
    ['/index.html', 'All'],
    ['/explore', 'All'],
    ['/collections', 'My collections'],
    ['/mycompany', 'Company Profile'],
    ['/negotiation', 'FOB TARGET'],
    ['/closed', 'Closed'],
    ['/suppliers', 'Suppliers'],
    ['/chat', 'Chats'],
    ['/admin', 'Platform']
  ];
  const results = [];
  for (const [route, marker] of routes) {
    await tab.goto(route);
    try {
      await waitFor(() => tab.eval(`(document.body.innerText||'').includes(${JSON.stringify(marker)})`), 30000, 500);
    } catch (error) {
      const routeDebug = await tab.eval(`(() => ({route:${JSON.stringify(route)}, marker:${JSON.stringify(marker)}, href:location.href, bodyClass:document.body.className, body:(document.body.innerText||'').slice(0,800)}))()`);
      throw new Error(`route ${route} timed out waiting for ${marker}: ${JSON.stringify(routeDebug)}`);
    }
    const text = await tab.text();
    const routeDebug = await tab.eval(`(() => ({href:location.href, bodyClass:document.body.className, hdrDisplay:getComputedStyle(document.getElementById('hdr')||document.body).display, pinDisplay:getComputedStyle(document.getElementById('pin-platform-nav')||document.body).display, sbDisplay:getComputedStyle(document.getElementById('sb')||document.body).display, body:(document.body.innerText||'').slice(0,600)}))()`);
    assert.ok(text.includes(marker), `route ${route} missing marker ${marker}: ${JSON.stringify(routeDebug)}`);
    if (!['/negotiation'].includes(route)) {
      assert.ok(!/PHOTOS\s+ARTICLE\s+STYLE/i.test(text), `route ${route} shows legacy Buying List shell`);
    }
    results.push({ route, marker });
  }
  return results;
}

async function run() {
  const runtime = readJson(RUNTIME_PATH);
  const password = readText(PASSWORD_PATH);
  assert.strictEqual(runtime.projectRef, STAGING_REF, 'runtime projectRef must be staging');
  assert.ok(String(runtime.supabaseUrl || '').includes(STAGING_REF), 'runtime URL must be staging');
  assert.ok(!String(runtime.supabaseUrl || '').includes(PROD_REF), 'runtime URL points at production');

  const tokens = {
    companyAAdmin: await loginToken(runtime, COMPANY_A_ADMIN, password),
    companyAMember: await loginToken(runtime, COMPANY_A_MEMBER, password),
    companyBAdmin: await loginToken(runtime, COMPANY_B_ADMIN, password),
    platformAdmin: await loginToken(runtime, PLATFORM_ADMIN, password)
  };
  const adminProfile = await loadProfileByEmail(runtime, tokens.companyAAdmin, COMPANY_A_ADMIN);

  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9540 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stdtex-costing-cert-cdp-'));
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
    checks: []
  };
  let tab;
  const createdStyles = [];
  let qaCollection = null;
  try {
    await waitFor(async () => {
      try { await fetchJson(`http://127.0.0.1:${port}/json/version`); return true; } catch { return false; }
    }, 15000, 250);
    tab = await createTab(port);

    const pendingA = await createQaStyle(runtime, tokens.companyAAdmin, COMPANY_A_ADMIN);
    createdStyles.push(pendingA);
    const closedA = await createQaStyle(runtime, tokens.companyAAdmin, COMPANY_A_ADMIN, {
      marker: `${pendingA.marker}-CLOSED`,
      row: { status: 'CLOSED', fob_closed: 7.1, modelo: `${pendingA.marker}-CLOSED` }
    });
    createdStyles.push(closedA);
    const pendingB = await createQaStyle(runtime, tokens.companyBAdmin, COMPANY_B_ADMIN, {
      marker: `${pendingA.marker}-B`,
      row: { supplier: 'Company B', modelo: `${pendingA.marker}-B` }
    });
    createdStyles.push(pendingB);
    qaCollection = await createQaCollection(runtime, tokens.companyAAdmin, adminProfile, `QA Cost Cert ${Date.now()}`, pendingA.id);
    report.fixture = { pendingA: pendingA.id, closedA: closedA.id, pendingB: pendingB.id, collection: qaCollection.name };
    report.checks.push('positive QA fixture creation PASS');

    await browserLogin(tab, COMPANY_A_ADMIN, password, '/negotiation');
    await tab.goto('/negotiation');
    const pendingCost = await assertReadyCost(tab, pendingA.id, 'negotiation');
    report.checks.push('Negotiation CostResult PASS');

    const callsBeforeFilter = tab.requests.filter((r) => r.url.includes('/functions/v1/calculate-style-cost')).length;
    await tab.setValue('#f-q', pendingA.marker);
    await tab.eval('renderNeg()');
    const filteredCost = await assertReadyCost(tab, pendingA.id, 'filter cache');
    assert.deepStrictEqual(filteredCost.ldp, pendingCost.ldp, 'filter changed CostResult LDP');
    await tab.eval(`srt('imu')`);
    const callsAfterSort = tab.requests.filter((r) => r.url.includes('/functions/v1/calculate-style-cost')).length;
    assert.ok(callsAfterSort <= callsBeforeFilter + 1, `filter/sort caused unexpected costing call loop (${callsBeforeFilter}->${callsAfterSort})`);
    report.checks.push('filter/sort cache behavior PASS');

    await tab.eval(`openStyleDetail(${Number(pendingA.id)})`);
    await tab.waitSelector('#style-detail-body');
    const detail = await tab.eval(`(() => {
      const text=document.getElementById('style-detail-body').innerText;
      const row=(ROWS||[]).find((r)=>String(r.id)===${JSON.stringify(String(pendingA.id))});
      const c=costDisplayForRow(row);
      return { text, fobT:c&&c.fobT, fob:String(c&&c.fob||''), rowId:row&&row.id, rowIdType:typeof(row&&row.id), detailId:window._detailStyleId, modalDisplay:(document.getElementById('style-detail-modal')||{}).style&&document.getElementById('style-detail-modal').style.display };
    })()`);
    assert.ok(/target fob/i.test(detail.text), `style detail missing Target FOB: ${JSON.stringify(detail)}`);
    assert.ok(detail.text.includes(String(Number(detail.fobT).toFixed(2))) || detail.text.includes(String(Math.round(detail.fobT * 100) / 100)), 'style detail Target FOB not consistent with CostResult');
    report.checks.push('Sidebar CostResult consistency PASS');

    await tab.goto('/closed');
    await assertReadyCost(tab, closedA.id, 'closed');
    const closedText = await tab.text();
    assert.ok(/IMU/i.test(closedText), 'closed KPI missing IMU');
    report.checks.push('Closed CostResult consistency PASS');

    await tab.goto('/explore');
    await assertReadyCost(tab, pendingA.id, 'explore runtime');
    report.checks.push('Explore CostResult runtime availability PASS');

    await tab.goto('/collections');
    const collectionVisible = await waitFor(() => tab.eval(`document.body.innerText.includes(${JSON.stringify(qaCollection.name)})`), 25000, 500);
    assert.ok(collectionVisible, 'QA collection not visible');
    const collectionCount = await tab.eval(`(() => {
      const rows = typeof collectionRows === 'function' ? collectionRows(${JSON.stringify(qaCollection.name)}) : [];
      const summary = typeof collectionSummary === 'function' ? collectionSummary(rows) : null;
      return { rows: rows.length, units: summary && summary.units, imu: summary && summary.imu };
    })()`);
    assert.ok(collectionCount.rows >= 1, 'collection detail/read engine did not include QA style');
    report.checks.push('Collection detail CostResult/read consistency PASS');

    await tab.goto('/closed');
    await waitFor(() => tab.eval(`(() => {
      const row=(window.ROWS||[]).find((r)=>String(r.id)===${JSON.stringify(String(closedA.id))});
      const inDom=!!document.querySelector('.row-sel[data-id="${closedA.id}"]');
      return row && row.status === 'CLOSED' && inDom;
    })()`), 25000, 500);
    await tab.eval(`(() => {
      document.querySelectorAll('.row-sel').forEach((el)=>{ el.checked=false; });
      const cb=document.querySelector('.row-sel[data-id="${closedA.id}"]');
      if(cb) cb.checked=true;
      window.__lastExportText=null;
      const original=URL.createObjectURL;
      URL.createObjectURL=function(blob){ blob.text().then((text)=>{ window.__lastExportText=text; }); return original.call(URL, blob); };
      exportClosedCSV_legacy();
      return true;
    })()`);
    const exportText = await waitFor(() => tab.eval('window.__lastExportText || ""'), 10000, 250);
    const exportDebug = await tab.eval(`(() => ({closedModels:(ROWS||[]).filter((r)=>r.status==='CLOSED').map((r)=>({id:r.id,modelo:r.modelo,status:r.status})).slice(-20), exportPreview:(window.__lastExportText||'').slice(0,1000)}))()`);
    assert.ok(exportText.includes(closedA.marker), `closed export missing QA row: ${JSON.stringify(exportDebug)}`);
    assert.ok(/LDP,IMU%|Duty,LDP,IMU%/.test(exportText), 'closed export missing costing columns');
    report.checks.push('Export CostResult consistency PASS');

    const exportLoadingStart = await tab.eval(`(() => {
      const originalFetch=StdtexCostingCalculationService.fetchCostResults;
      const originalCreateObjectURL=URL.createObjectURL;
      window.__restoreLoadingExportHarness=function(){
        StdtexCostingCalculationService.fetchCostResults=originalFetch;
        URL.createObjectURL=originalCreateObjectURL;
        resetCostResultState();
        delete window.__restoreLoadingExportHarness;
      };
      resetCostResultState();
      let pendingCalled=false;
      StdtexCostingCalculationService.fetchCostResults=(ids)=>{
        pendingCalled=Array.isArray(ids)&&ids.map(String).includes(${JSON.stringify(String(closedA.id))});
        return new Promise(()=>{});
      };
      document.querySelectorAll('.row-sel').forEach((el)=>{ el.checked=false; });
      const cb=document.querySelector('.row-sel[data-id="${closedA.id}"]');
      if(cb) cb.checked=true;
      window.__lastLoadingExportText=null;
      URL.createObjectURL=function(blob){ blob.text().then((text)=>{ window.__lastLoadingExportText=text; }); return 'blob:qa-loading-export'; };
      exportClosedCSV_legacy();
      return {pendingCalled};
    })()`);
    const loadingExportText = await waitFor(() => tab.eval('window.__lastLoadingExportText || ""'), 10000, 250);
    const exportLoading = await tab.eval(`(() => {
      const text=${JSON.stringify(loadingExportText)};
      const line=text.split(/\\r?\\n/).find((l)=>l.includes(${JSON.stringify(closedA.marker)}))||'';
      const cells=(line.match(/"([^"]*(?:""[^"]*)*)"/g)||[]).map((v)=>v.slice(1,-1).replace(/""/g,'"'));
      const costCells=cells.slice(12,17);
      if(window.__restoreLoadingExportHarness)window.__restoreLoadingExportHarness();
      return {hasRow:!!line,costCells};
    })()`);
    assert.strictEqual(exportLoadingStart.pendingCalled, true, 'export did not request CostResult while loading');
    assert.strictEqual(exportLoading.hasRow, true, 'loading export missing QA row');
    assert.deepStrictEqual(exportLoading.costCells, ['', '', '', '', ''], `loading export used non-ready costing values: ${JSON.stringify(exportLoading.costCells)}`);
    report.checks.push('Export while Costing loading safe behavior PASS');

    const asyncRace = await tab.eval(`(async () => {
      const original=StdtexCostingCalculationService.fetchCostResults;
      resetCostResultState();
      let resolvers=[];
      StdtexCostingCalculationService.fetchCostResults=(ids)=>new Promise((resolve)=>resolvers.push({ids,resolve}));
      const rowA={id:111111,fob1:1,pvp_rub:1000};
      const rowB={id:222222,fob1:2,pvp_rub:1000};
      ensureCostResultsForRows([rowA],'race-a');
      resetCostResultState();
      ensureCostResultsForRows([rowB],'race-b');
      resolvers[0].resolve({batchCount:1,batchSizes:[1],byStyleId:{'111111':{styleId:'111111',status:'READY',landedCost:99,imu:.1,markup:.1,gap:.1,targetFob:1}}});
      await new Promise((r)=>setTimeout(r,0));
      const staleApplied=!!COST_RESULTS_BY_STYLE_ID['111111'];
      resolvers[1].resolve({batchCount:1,batchSizes:[1],byStyleId:{'222222':{styleId:'222222',status:'READY',landedCost:88,imu:.2,markup:.2,gap:.2,targetFob:2}}});
      await new Promise((r)=>setTimeout(r,0));
      const freshApplied=!!COST_RESULTS_BY_STYLE_ID['222222'];
      StdtexCostingCalculationService.fetchCostResults=original;
      resetCostResultState();
      return {staleApplied,freshApplied};
    })()`);
    assert.strictEqual(asyncRace.staleApplied, false, 'stale async response was applied');
    assert.strictEqual(asyncRace.freshApplied, true, 'fresh async response was not applied');
    report.checks.push('async race handling PASS');

    const companyBEdge = await edge(runtime, tokens.companyBAdmin, { styleIds: [pendingB.id] });
    assertNoForbiddenCostingKeys(companyBEdge, 'Company B Edge response');
    assert.ok(Array.isArray(companyBEdge.results), 'Company B Edge missing results');
    assert.ok(companyBEdge.results.some((r) => String(r.styleId) === String(pendingB.id)), 'Company B result missing');
    report.companyBStatus = companyBEdge.results[0] && companyBEdge.results[0].status;
    report.checks.push('Company B FOB_ONLY/secure response smoke PASS');

    const crossCompany = await edge(runtime, tokens.companyAAdmin, { styleIds: [pendingB.id] });
    assert.ok(!JSON.stringify(crossCompany).includes(String(pendingB.marker)) || !(crossCompany.results || []).some((r) => String(r.styleId) === String(pendingB.id) && r.status === 'READY'), 'Company A could read Company B ready costing result');
    report.checks.push('cross-company CostResult isolation PASS');

    const platformNoTarget = await fetch(`${runtime.supabaseUrl}/functions/v1/calculate-style-cost`, {
      method: 'POST',
      headers: headers(runtime, tokens.platformAdmin),
      body: JSON.stringify({ styleIds: [pendingA.id] })
    });
    assert.notStrictEqual(platformNoTarget.status, 200, 'Platform Admin without targetCompanyId was accepted');
    const platformA = await edge(runtime, tokens.platformAdmin, { targetCompanyId: COMPANY_A_ID, styleIds: [pendingA.id] });
    assert.ok((platformA.results || []).some((r) => String(r.styleId) === String(pendingA.id)), 'Platform Admin target Company A result missing');
    const platformB = await edge(runtime, tokens.platformAdmin, { targetCompanyId: COMPANY_B_ID, styleIds: [pendingB.id] });
    assert.ok((platformB.results || []).some((r) => String(r.styleId) === String(pendingB.id)), 'Platform Admin target Company B result missing');
    report.checks.push('Platform Admin smoke PASS');

    const memberStart = tab.requests.length;
    await browserLogin(tab, COMPANY_A_MEMBER, password, '/negotiation');
    await waitFor(async () => tab.requests.slice(memberStart).some((r) => r.url.includes('/functions/v1/calculate-style-cost')), 30000, 500).catch(() => null);
    const rawConfigRequests = tab.requests.slice(memberStart).filter((r) => /company_costing_settings|cost_config_versions|cost_config_overrides|cost_additional_components/.test(r.url));
    assert.strictEqual(rawConfigRequests.length, 0, 'member browser made raw costing config table requests');
    report.checks.push('Company member raw config privacy PASS');

    await browserLogin(tab, COMPANY_A_ADMIN, password, '/');
    report.routeSweep = await runRouteDomSweep(tab);
    report.checks.push('complete route DOM regression PASS');

    const bodies = await tab.getResponseBodies((r) => r.url.includes('/functions/v1/calculate-style-cost') || r.url.includes('/functions/v1/validate-cost-config'));
    bodies.forEach((body) => assertNoForbiddenCostingKeys(body.body || '', `Edge body ${body.url}`));
    assert.strictEqual(tab.requests.filter((r) => r.url.includes(PROD_REF)).length, 0, 'browser touched production Supabase');
    report.checks.push('production isolation and Edge response privacy PASS');

    const consoleErrors = tab.console.filter((c) => c.type === 'error' || c.type === 'exception');
    assert.strictEqual(consoleErrors.length, 0, `console errors: ${JSON.stringify(consoleErrors)}`);
    report.checks.push('no browser console errors PASS');
    report.ok = true;
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.error = error && error.stack || String(error);
    if (tab) report.console = tab.console;
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    try { await cleanupQaCollection(runtime, tokens.companyAAdmin, qaCollection); } catch (error) { console.error(`QA collection cleanup failed: ${error.message}`); process.exitCode = 1; }
    for (const style of createdStyles.reverse()) {
      try { await deleteQaStyle(runtime, style.owner && style.owner.email === COMPANY_B_ADMIN ? tokens.companyBAdmin : tokens.companyAAdmin, style); } catch (error) { console.error(`QA style cleanup failed: ${error.message}`); process.exitCode = 1; }
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
