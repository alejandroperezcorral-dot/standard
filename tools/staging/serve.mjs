import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(process.cwd());
const configPath = path.join(root, '.codex-secrets', 'stdtex-staging-runtime.json');
const port = Number(process.env.STDTEX_STAGING_PORT || 8788);
const stagingRef = 'amitkdqyfblymzdsrplx';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  fail('Missing local staging config: .codex-secrets/stdtex-staging-runtime.json');
}

let runtimeConfig;
try {
  runtimeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
} catch (error) {
  fail('Invalid staging runtime JSON: ' + error.message);
}

if (runtimeConfig.environment !== 'staging') fail('Staging runtime config must set environment to "staging".');
if (runtimeConfig.projectRef !== stagingRef) fail('Staging runtime config must target ' + stagingRef + '.');
if (!String(runtimeConfig.supabaseUrl || '').includes(stagingRef)) fail('Staging Supabase URL must include ' + stagingRef + '.');
if (String(runtimeConfig.supabaseUrl || '').includes('vtyffyywmqnlfemzlsbz')) fail('Refusing to serve staging with production Supabase URL.');
if (runtimeConfig.serviceRoleKey || runtimeConfig.service_role || runtimeConfig.secretKey) fail('Refusing to expose service-role credentials.');
if (!runtimeConfig.publishableKey) fail('Staging runtime config must include publishableKey.');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function injectRuntime(html) {
  const payload = JSON.stringify({
    environment: 'staging',
    projectRef: runtimeConfig.projectRef,
    supabaseUrl: runtimeConfig.supabaseUrl,
    publishableKey: runtimeConfig.publishableKey
  });
  return html.replace(
    '<script src="src/core/runtimeConfig.js"></script>',
    '<script>window.__STDTEX_RUNTIME_CONFIG__=' + payload + ';</script>\n<script src="src/core/runtimeConfig.js"></script>'
  );
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || '/');
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/' || !path.extname(pathname)) pathname = '/index.html';
  const target = path.resolve(root, pathname.replace(/^\/+/, ''));
  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(target).toLowerCase();
  let body = fs.readFileSync(target);
  if (path.basename(target) === 'index.html') body = injectRuntime(body.toString('utf8'));
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  console.log('STDTEX staging runtime: http://127.0.0.1:' + port + '/explore');
  console.log('Supabase project: ' + runtimeConfig.projectRef);
});
