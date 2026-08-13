import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url);
const BASE = 'http://127.0.0.1:8788';
const STAGING_REF = 'amitkdqyfblymzdsrplx';
const PROD_REF = 'vtyffyywmqnlfemzlsbz';
const ADMIN_EMAIL = 'companya.admin@example.test';
const MEMBER_EMAIL = 'companya.member1@example.test';
const PLATFORM_EMAIL = 'platform.admin@example.test';
const INVITED_EMAIL = 'invited.new@example.test';

function ok(name, details = {}) {
  return { name, status: 'PASS', ...details };
}

function fail(name, error, details = {}) {
  return { name, status: 'FAIL', error: String(error && error.message || error), ...details };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readSecret(name) {
  return (await readFile(new URL(`.codex-secrets/${name}`, ROOT), 'utf8')).trim();
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
    await new Promise((resolve) => setTimeout(resolve, step));
  }
  if (last) throw last;
  throw new Error('Timed out');
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

class CdpTab {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.requests = [];
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
          method: msg.params.request.method,
          url: msg.params.request.url
        });
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        this.console.push({ type: msg.params.type, text: (msg.params.args || []).map((a) => a.value || a.description || '').join(' ') });
      }
      if (msg.method === 'Runtime.exceptionThrown') this.console.push({ type: 'exception', text: msg.params.exceptionDetails?.text || 'exception' });
    });
  }
  async ready() {
    await waitFor(() => this.ws.readyState === WebSocket.OPEN, 10000, 100);
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Network.enable');
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
      }, 20000);
    });
  }
  async goto(path) {
    await this.send('Page.navigate', { url: `${BASE}${path}` });
    await this.waitLoad();
  }
  async waitLoad() {
    await waitFor(() => this.events.some((e) => e.method === 'Page.loadEventFired'), 15000, 100).catch(() => null);
    this.events = this.events.filter((e) => e.method !== 'Page.loadEventFired');
    await this.sleep(500);
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async eval(expression, awaitPromise = true) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    return result.result?.value;
  }
  async text() {
    return this.eval('document.body ? document.body.innerText : ""');
  }
  async close() {
    try { this.ws.close(); } catch {}
  }
}

async function createTab(port) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(BASE + '/')}`, { method: 'PUT' });
  const tab = new CdpTab(target.webSocketDebuggerUrl);
  await tab.ready();
  return tab;
}

async function logout(tab) {
  await tab.eval(`(async()=>{try{await sb.auth.signOut()}catch(e){}; try{localStorage.clear();sessionStorage.clear()}catch(e){}; location.href='/'; return true;})()`);
  await tab.sleep(1000);
}

async function login(tab, email, password, path = '/') {
  await tab.goto(path);
  await tab.sleep(500);
  const hasLogin = await tab.eval(`!!document.getElementById('auth-email')`);
  if (!hasLogin) {
    await logout(tab);
    await tab.goto(path);
  }
  await tab.eval(`document.getElementById('auth-email').value=${JSON.stringify(email)};document.getElementById('auth-pwd').value=${JSON.stringify(password)};doLoginForm();`);
  await waitFor(async () => {
    const text = await tab.text();
    return !text.includes('Hi boss,') && !text.includes('Please enter email');
  }, 20000, 500);
  await tab.sleep(1500);
}

async function waitForText(tab, predicate, message, ms = 15000) {
  return waitFor(async () => {
    const text = await tab.text();
    return predicate(text) ? text : false;
  }, ms, 500).catch(() => {
    throw new Error(message);
  });
}

function routeChecks() {
  return [
    ['/explore', (t) => t.includes('All') && t.includes('Saved')],
    ['/collections', (t) => t.includes('My collections') && t.includes('My Groups Collections')],
    ['/mycompany', (t) => t.includes('Company Profile') && t.includes('Team') && t.includes('Groups')],
    ['/negotiation', (t) => t.includes('Negotiation') || t.includes('LINES')],
    ['/closed', (t) => t.includes('Closed') || t.includes('FOB CLOSED')],
    ['/suppliers', (t) => t.includes('Suppliers')],
    ['/chat', (t) => t.includes('Chats')],
    ['/admin', (t) => t.includes('Administration') || t.includes('User management')]
  ];
}

async function main() {
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9333 + Math.floor(Math.random() * 200);
  const profile = await mkdtemp(join(tmpdir(), 'stdtex-cdp-'));
  const password = await readSecret('staging-auth-test-password.txt');
  const child = spawn(chrome, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--new-window',
    BASE + '/'
  ], { stdio: 'ignore', detached: false });

  const report = { browser: 'Chrome CDP isolated profile', results: [], console: [] };
  let tab;
  try {
    await waitFor(async () => {
      try { await fetchJson(`http://127.0.0.1:${port}/json/version`); return true; } catch { return false; }
    }, 15000, 250);
    tab = await createTab(port);

    report.results.push(await (async () => {
      try {
        await tab.goto('/');
        const env = await tab.eval(`(() => { const c=window.STDTEX_RUNTIME_CONFIG||{}; return {projectRef:c.projectRef||'', supabaseUrl:c.supabaseUrl||'', href:location.href}; })()`);
        assert(env.projectRef === STAGING_REF, `runtime projectRef ${env.projectRef}`);
        assert(String(env.supabaseUrl).includes(STAGING_REF), 'runtime URL is not staging');
        return ok('staging runtime verification', { env });
      } catch (e) { return fail('staging runtime verification', e); }
    })());

    report.results.push(await (async () => {
      try {
        await login(tab, ADMIN_EMAIL, password, '/mycompany');
        const text = await waitForText(tab, (t) => t.includes('Company Profile') && t.includes('Team') && t.includes('Groups'), 'My Company UI not visible');
        const href = await tab.eval('location.href');
        assert(href.endsWith('/mycompany'), `route changed to ${href}`);
        assert(!text.includes('Buying List') && !text.includes('USD/RUB'), 'legacy Buying List visible');
        return ok('/mycompany login-preservation E2E', { href });
      } catch (e) { return fail('/mycompany login-preservation E2E', e); }
    })());

    for (const [path, predicate] of [['/', (t) => t.includes('All') && t.includes('Saved')], ['/index.html', (t) => t.includes('All') && t.includes('Saved')]]) {
      report.results.push(await (async () => {
        try {
          await tab.goto(path);
        const text = await waitForText(tab, predicate, `${path} did not render Explore`);
        assert(predicate(text), `${path} did not render Explore`);
          return ok(`root regression ${path}`, { href: await tab.eval('location.href') });
        } catch (e) { return fail(`root regression ${path}`, e); }
      })());
    }

    for (const [path, predicate] of routeChecks()) {
      report.results.push(await (async () => {
        try {
          await tab.goto(path);
          const text = await waitForText(tab, predicate, `${path} surface assertion failed`);
          assert(predicate(text), `${path} surface assertion failed`);
          return ok(`route ${path}`, { href: await tab.eval('location.href') });
        } catch (e) { return fail(`route ${path}`, e); }
      })());
    }

    report.results.push(await (async () => {
      try {
        await tab.goto('/mycompany');
        const text = await waitForText(tab, (t) => t.includes('Company A') && t.includes('companya.member1@example.test'), 'Company A not shown');
        assert(text.includes('Company A'), 'Company A not shown');
        assert(text.includes('companya.member1@example.test'), 'Company A member missing');
        assert(text.includes('A Group 1') || text.includes('QA'), 'Company A groups missing');
        assert(!text.includes('Company B'), 'Company B data visible');
        return ok('Company Admin My Company E2E');
      } catch (e) { return fail('Company Admin My Company E2E', e); }
    })());

    report.results.push(await (async () => {
      try {
        const email = INVITED_EMAIL;
        const before = tab.requests.length;
        const result = await tab.eval(`(async()=>{openInviteUserModal(); await new Promise(r=>setTimeout(r,100)); document.getElementById('team-invite-email').value=${JSON.stringify(email)}; document.getElementById('team-invite-first').value='Invite'; document.getElementById('team-invite-last').value='CDP'; document.getElementById('team-invite-position').value='Buyer'; const cb=document.querySelector('.team-invite-group-check'); if(cb&&!cb.checked)cb.click(); await createTeamInvite(); await new Promise(r=>setTimeout(r,1000)); return {err:(document.getElementById('team-invite-err')||{}).textContent||'', link:(document.getElementById('team-invite-link')||{}).value||''};})()`);
        assert(!result.err, result.err || 'invite error');
        assert(result.link.includes('?invite='), 'invite link not generated');
        const reqs = tab.requests.slice(before);
        assert(reqs.some((r) => r.url.includes('/rpc/create_company_invitation')), 'create_company_invitation RPC not observed');
        assert(!reqs.some((r) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method) && r.url.includes('/company_invitations') && !r.url.includes('/rpc/')), 'direct company_invitations write observed');
        report.createdInviteLink = result.link.replace(/invite=[^&]+/, 'invite=<redacted>');
        report.createdInviteToken = result.link.split('invite=')[1] || '';
        report.createdInviteEmail = email;
        return ok('Invite create E2E', { rpcObserved: true });
      } catch (e) { return fail('Invite create E2E', e); }
    })());

    report.results.push(await (async () => {
      try {
        const token = report.createdInviteToken;
        assert(token, 'no created token to test');
        const anon = await createTab(port);
        const before = anon.requests.length;
        await anon.goto(`/?invite=${encodeURIComponent(token)}`);
        const text = await waitForText(anon, (t) => t.includes('Team invite') || t.includes('Join team') || t.includes('Hi boss,'), 'generic invite UI missing');
        const reqs = anon.requests.slice(before);
        await anon.close();
        assert(text.includes('Team invite') || text.includes('Join team') || text.includes('Hi boss,'), 'generic invite UI missing');
        assert(!text.includes('Company A'), 'private company exposed before auth');
        assert(!text.includes('Company Admin') && !text.includes('A Group'), 'private role/group exposed before auth');
        assert(!reqs.some((r) => r.url.includes('/company_invitations') && !r.url.includes('/rpc/')), 'anonymous direct company_invitations read observed');
        return ok('Anonymous invite landing');
      } catch (e) { return fail('Anonymous invite landing', e); }
    })());

    report.results.push(await (async () => {
      try {
        const token = report.createdInviteToken;
        const inviteEmail = INVITED_EMAIL;
        const acceptTab = await createTab(port);
        await logout(acceptTab);
        await acceptTab.goto(`/?invite=${encodeURIComponent(token)}`);
        const before = acceptTab.requests.length;
        await acceptTab.eval(`setAuthMode('login');document.getElementById('auth-email').value=${JSON.stringify(inviteEmail)};document.getElementById('auth-pwd').value=${JSON.stringify(password)};doLoginForm();`);
        await acceptTab.sleep(4000);
        const text = await acceptTab.text();
        const reqs = acceptTab.requests.slice(before);
        const storage = await acceptTab.eval(`({local:localStorage.getItem('stdtex:pending-invite'), session:sessionStorage.getItem('stdtex:pending-invite')})`);
        await acceptTab.close();
        assert(reqs.some((r) => r.url.includes('/rpc/accept_company_invitation')), 'accept_company_invitation RPC not observed');
        assert(!reqs.some((r) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method) && r.url.includes('/company_memberships') && !r.url.includes('/rpc/')), 'client membership write sequence observed during accept');
        assert(!text.includes('Under Review'), 'Under Review shown after accept');
        assert(!storage.local && !storage.session, 'pending invite token retained');
        await login(tab, ADMIN_EMAIL, password, '/mycompany');
        return ok('Invite acceptance E2E', { tokenCleaned: true });
      } catch (e) { return fail('Invite acceptance E2E', e); }
    })());

    report.results.push(await (async () => {
      try {
        await tab.goto('/mycompany');
        await tab.sleep(1000);
        const before = tab.requests.length;
        const result = await tab.eval(`(async()=>{openInviteUserModal(); await new Promise(r=>setTimeout(r,100)); document.getElementById('team-invite-email').value='revoke-${Date.now()}@example.test'; document.getElementById('team-invite-first').value='Revoke'; document.getElementById('team-invite-last').value='CDP'; document.getElementById('team-invite-position').value='Buyer'; const cb=document.querySelector('.team-invite-group-check'); if(cb&&!cb.checked)cb.click(); await createTeamInvite(); await new Promise(r=>setTimeout(r,500)); const inv=(COMPANY_INVITES_CACHE[companyKey(activeCompanyName())]||[])[0]; if(!inv)return 'missing invite'; window.confirm=()=>true; await cancelCompanyInvite(inv.id); await new Promise(r=>setTimeout(r,700)); return true;})()`);
        assert(result === true, 'revoke flow did not complete');
        const reqs = tab.requests.slice(before);
        assert(reqs.some((r) => r.url.includes('/rpc/revoke_company_invitation')), 'revoke_company_invitation RPC not observed');
        assert(!reqs.some((r) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method) && r.url.includes('/company_invitations') && r.url.includes('status') && !r.url.includes('/rpc/')), 'direct invitation status update observed');
        return ok('Invite revoke');
      } catch (e) { return fail('Invite revoke', e); }
    })());

    report.results.push(await (async () => {
      try {
        await tab.goto('/mycompany');
        await tab.sleep(1000);
        const before = tab.requests.length;
        const result = await tab.eval(`(async()=>{await loadCompanyMembersFor(activeCompanyName()); renderCompanyPage('team'); await new Promise(r=>setTimeout(r,300)); const m=companyMembersList().find(x=>x.email==='companya.member1@example.test'); if(!m)return 'missing: '+companyMembersList().map(x=>x.email).join(', '); openEditTeamUserModal(m.id); await new Promise(r=>setTimeout(r,100)); document.getElementById('team-invite-position').value='Buyer'; const checks=[...document.querySelectorAll('.team-invite-group-check')]; checks.forEach((c,i)=>{ if(i<2&&!c.checked)c.click(); }); await saveTeamUserEdit(); await new Promise(r=>setTimeout(r,1000)); return true;})()`);
        assert(result === true, String(result));
        const reqs = tab.requests.slice(before);
        assert(reqs.some((r) => r.url.includes('/rpc/update_company_member')), 'update_company_member RPC not observed');
        return ok('Member edit / group / role management');
      } catch (e) { return fail('Member edit / group / role management', e); }
    })());

    report.results.push(await (async () => {
      try {
        const memberTab = await createTab(port);
        await login(memberTab, MEMBER_EMAIL, password, '/mycompany');
        const text = await memberTab.text();
        const canSeeAdminActions = text.includes('Add user') || text.includes('Remove') || text.includes('Generate link');
        const server = await memberTab.eval(`(async()=>{try{return await OrganizationService.createInvitation(sb,{email:'blocked-${Date.now()}@example.test',accessRole:'Company Member',firstName:'Blocked',groupIds:[]})}catch(e){return {error:{message:e.message}}}})()`);
        await memberTab.close();
        assert(!canSeeAdminActions, 'normal member can see admin organization actions');
        assert(server && server.error, 'normal member mutation was not rejected');
        return ok('Normal-member security');
      } catch (e) { return fail('Normal-member security', e); }
    })());

    report.results.push(await (async () => {
      try {
        const platformTab = await createTab(port);
        await login(platformTab, PLATFORM_EMAIL, password, '/admin');
        await platformTab.sleep(1500);
        const text = await platformTab.text();
        await platformTab.close();
        assert(text.includes('Administration') || text.includes('User management'), 'platform admin surface missing');
        return ok('Platform Admin regression');
      } catch (e) { return fail('Platform Admin regression', e); }
    })());

    report.requestCount = tab.requests.length;
    report.console = tab.console.filter((x) => x.type === 'error' || x.type === 'exception');
    report.productionRequests = Array.from(new Set(tab.requests.map((r) => r.url).filter((u) => u.includes(PROD_REF) || u.includes('stdtex.com'))));
    report.stagingRequests = tab.requests.filter((r) => r.url.includes(STAGING_REF) || r.url.includes('/sb/')).length;
    report.activeFailures = report.results.filter((r) => r.status !== 'PASS');
    delete report.createdInviteToken;
    delete report.createdInviteEmail;
  } finally {
    if (tab) await tab.close();
    child.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.activeFailures.length) process.exit(1);
  if (report.productionRequests.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
