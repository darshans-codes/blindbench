import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { startWorkspace } from '../src/server.mjs';
import { fingerprintFile } from '../public/manifest.mjs';

const candidates = [
  process.env.CHROMIUM_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
let executable;
for (const candidate of candidates) {
  if (await access(candidate).then(() => true, () => false)) {
    executable = candidate;
    break;
  }
}
if (!executable) throw new Error('Set CHROMIUM_PATH to a local Chromium-based browser executable.');

const withProtocol = process.argv.includes('--with-protocol');
if (withProtocol && process.env.BLINDBENCH_NATIVE_PORTS === undefined) {
  const engine = spawnSync('docker', ['info', '--format', '{{.OSType}}'], {
    encoding: 'utf8', timeout: 15_000,
  });
  if (engine.status !== 0 || engine.stdout?.trim() !== 'linux') {
    console.error('BLOCKED: the live study smoke test requires access to a Linux Docker engine.');
    process.exit(1);
  }
}
const directory = await mkdtemp(join(tmpdir(), 'bb-browser-'));
const database = withProtocol ? join(directory, 'study.sqlite') : ':memory:';
const app = await startWorkspace({ database, port: 0 });
const profile = join(directory, 'profile');
const browser = spawn(executable, [
  '--headless=new', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
  '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true });
let browserError;
let diagnostics = '';
browser.once('error', (error) => { browserError = error; });
browser.stderr.on('data', (chunk) => { diagnostics = (diagnostics + chunk).slice(-2500); });

async function endpoint() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (browserError) throw browserError;
    if (browser.exitCode !== null) throw new Error(`Chromium exited (${browser.exitCode}). ${diagnostics}`);
    const port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
    if (port) {
      const origin = `http://127.0.0.1:${port.split(/\r?\n/u)[0]}`;
      const response = await fetch(`${origin}/json/list`);
      const targets = await response.json();
      return targets.find((target) => target.type === 'page').webSocketDebuggerUrl;
    }
    await pause(150);
  }
  throw new Error(`Chromium DevTools did not start. ${diagnostics}`);
}

let socket;
let rpc;
let anchoredApp;
try {
  socket = new WebSocket(await endpoint());
  socket.addEventListener('error', () => {});
  await once(socket, 'open');
  const requests = new Map();
  const failures = [];
  const network = [];
  let sequence = 0;

  socket.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data);
    const handler = requests.get(event.id);
    if (handler) handler(event);
    if (event.method === 'Runtime.exceptionThrown') failures.push(event.params.exceptionDetails.text);
    if (event.method === 'Log.entryAdded' && event.params.entry.source === 'security') failures.push(event.params.entry.text);
    if (event.method === 'Network.requestWillBeSent') network.push(event.params.request.url);
  });

  async function call(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        requests.delete(id);
        reject(new Error(`Chromium command timed out: ${method}`));
      }, 5000);
      requests.set(id, ({ result, error }) => {
        clearTimeout(timeout);
        requests.delete(id);
        if (error) reject(new Error(`${method}: ${error.message}`));
        else resolve(result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function value(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }

  async function until(expression) {
    for (let attempt = 0; attempt < 65; attempt++) {
      if (await value(expression).catch(() => false)) return;
      await pause(60);
    }
    const context = await value('location.pathname + location.search + " · " + document.title').catch(() => 'page unavailable');
    throw new Error(`Browser condition timed out: ${expression} (${context})`);
  }

  async function visit(path, base = app.url) {
    await call('Page.navigate', { url: `${base}${path}` });
    await until(`location.href === ${JSON.stringify(base + path)} && document.readyState === "complete"`);
  }

  async function screenshot(name) {
    if (!process.env.BLINDBENCH_CAPTURE_DIR) return;
    await mkdir(process.env.BLINDBENCH_CAPTURE_DIR, { recursive: true });
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(process.env.BLINDBENCH_CAPTURE_DIR, name), Buffer.from(data, 'base64'));
  }

  await call('Runtime.enable');
  await call('Log.enable');
  await call('Network.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await visit('/');
  assert.match(await value("document.querySelector('h1').innerText"), /Learn together\.\s+Reveal less\./u);
  assert.ok(await value("document.querySelector('.bar').getBoundingClientRect().height > 5"));
  await screenshot('homepage-desktop.png');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await value("document.activeElement.textContent"), 'Skip to content');
  await value("document.querySelector('.hero-actions .button-primary').click()");
  await until('location.pathname === "/overview" && document.readyState === "complete"');
  await screenshot('overview-desktop.png');
  await visit('/studies/create');
  await value(`document.querySelector('#title').value = 'Browser check cohort';
    document.querySelector('form').requestSubmit()`);
  await until('location.search === "?saved=1" && document.readyState === "complete"');
  assert.match(await value("document.querySelector('h1').innerText"), /Browser check cohort/u);
  const studyPath = await value('location.pathname');
  await value("document.querySelector('#policy-preview form').requestSubmit()");
  await until('location.hash === "#policy-preview" && document.querySelector("[data-policy-digest]")');
  const policyDigest = await value("document.querySelector('[data-policy-digest]').textContent");
  const policyFile = await (await fetch(`${app.url}${studyPath}/policy/1.json`)).text();
  await value("document.querySelector('#fictional-fixture form').requestSubmit()");
  await until('location.hash === "#fictional-fixture" && document.querySelector("#fictional-fixture pre")');
  const command = await value("document.querySelector('#fictional-fixture pre').textContent");
  const fixtureId = command.match(/^npm run fixture:run -- ([a-f0-9-]+)$/u)?.[1];
  assert.ok(fixtureId);
  if (withProtocol) {
    const worker = spawn(process.execPath, ['scripts/fixture-run.mjs', fixtureId], {
      stdio: 'inherit', env: { ...process.env, BLINDBENCH_DB: database },
    });
    const [status] = await once(worker, 'exit');
    assert.equal(status, 0, 'The isolated fixture worker must complete.');
    await visit(studyPath);
    assert.match(await value("document.querySelector('#fictional-fixture').textContent"), /matched the fictional fixture/u);
    assert.doesNotMatch(await value("document.querySelector('#fictional-fixture').textContent"), /npm run fixture:run/u);
  }
  await visit('/studies');
  await value(`const f = document.querySelector('[data-study-filter]');
    f.value = 'does not exist'; f.dispatchEvent(new Event('input', { bubbles: true }))`);
  assert.equal(await value("document.querySelector('[data-filter-empty]').hidden"), false);
  await visit('/privacy');
  await value("document.querySelector('[data-example-toggle]').click()");
  assert.match(await value("document.querySelector('[data-example-summary]').textContent"), /distance between the histograms is 1/u);
  assert.equal(await value("document.querySelector('[data-example-cell]').textContent"), '23');

  await visit('/verify');
  const sample = await (await fetch(`${app.url}/examples/result-manifest.json`)).text();
  await value(`const files = new DataTransfer();
    files.items.add(new File([${JSON.stringify(sample)}], 'sample.json', { type: 'application/json' }));
    document.querySelector('#manifest').files = files.files;
    document.querySelector('form').requestSubmit()`);
  await until('document.querySelector("[data-verifier-digest]")?.textContent.length === 64');
  assert.match(await value("document.querySelector('[data-verifier-status]').textContent"), /Chain verification unavailable/u);
  const originalDigest = await value("document.querySelector('[data-verifier-digest]').textContent");
  await value(`const altered = new DataTransfer();
    const manifest = ${sample}; manifest.counts[0] += 1;
    altered.items.add(new File([JSON.stringify(manifest)], 'edited.json', { type: 'application/json' }));
    document.querySelector('#manifest').files = altered.files;
    document.querySelector('form').requestSubmit()`);
  await until(`!document.querySelector('[data-verifier-digest]').hidden && document.querySelector('[data-verifier-digest]').textContent !== ${JSON.stringify(originalDigest)}`);
  await value(`const malformed = new DataTransfer();
    malformed.items.add(new File(['{'], 'bad.json', { type: 'application/json' }));
    document.querySelector('#manifest').files = malformed.files;
    document.querySelector('form').requestSubmit()`);
  await until('document.querySelector("[data-verifier-status]")?.textContent === "Manifest could not be read"');
  assert.equal(await value("document.querySelector('[data-verifier-digest]').hidden"), true);
  await value(`const preview = new DataTransfer();
    preview.items.add(new File([${JSON.stringify(policyFile)}], 'policy.json', { type: 'application/json' }));
    document.querySelector('#manifest').files = preview.files;
    document.querySelector('form').requestSubmit()`);
  await until('document.querySelector("[data-verifier-status]")?.textContent === "Local policy fingerprint"');
  assert.equal(await value("document.querySelector('[data-verifier-digest]').textContent"), policyDigest);
  assert.equal(network.filter((url) => url.startsWith(`${app.url}/verify`)).length, 1);

  const committed = { ...JSON.parse(sample), policyHash: '9'.repeat(64) };
  const committedText = JSON.stringify(committed);
  const committedResult = await fingerprintFile(committedText);
  const calls = [];
  const rpcResults = {
    eth_chainId: '0x7a69',
    eth_blockNumber: '0xc',
    eth_getCode: '0x6000',
    eth_call: `0x${committed.policyHash}${committedResult.digest}${'3'.padStart(64, '0')}`,
  };
  rpc = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', anchoredApp.url);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    const parts = [];
    for await (const part of req) parts.push(part);
    const call = JSON.parse(Buffer.concat(parts).toString());
    calls.push(call);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result: rpcResults[call.method] }));
  });
  rpc.listen(0, '127.0.0.1');
  await once(rpc, 'listening');
  const anchorProfile = {
    address: `0x${'1'.repeat(40)}`,
    codeSha256: createHash('sha256').update(Buffer.from('6000', 'hex')).digest('hex'),
    rpcUrl: `http://127.0.0.1:${rpc.address().port}`,
    selector: '0x12345678',
  };
  anchoredApp = await startWorkspace({ database: ':memory:', port: 0, anchorProfile });
  const homeCsp = (await fetch(anchoredApp.url)).headers.get('content-security-policy');
  assert.equal(homeCsp.includes(anchorProfile.rpcUrl), false);
  await visit('/ledger', anchoredApp.url);
  assert.match(await value('document.querySelector("main").textContent'), /Configured local contract/u);
  await visit('/verify', anchoredApp.url);
  async function submitManifest(text, expected) {
    await value(`{
      const data = new DataTransfer();
      data.items.add(new File([${JSON.stringify(text)}], 'manifest.json', { type: 'application/json' }));
      document.querySelector('#manifest').files = data.files;
      document.querySelector('form').requestSubmit();
    }`);
    await until(`document.querySelector('[data-verifier-status]').textContent === ${JSON.stringify(expected)}`);
  }
  await submitManifest(committedText, 'MATCH');
  assert.equal(await value("document.querySelector('[data-verified-insights]').hidden"), false);
  assert.match(await value("document.querySelector('[data-verified-insights]').textContent"), /Approximate median band/u);
  await submitManifest(JSON.stringify({ ...committed, counts: committed.counts.map((count) => count + 1) }), 'MISMATCH');
  assert.equal(await value("document.querySelector('[data-verified-insights]').hidden"), true);
  assert.deepEqual(calls.map(({ method }) => method), [...Object.keys(rpcResults), ...Object.keys(rpcResults)]);
  assert.equal(calls.some((call) => JSON.stringify(call).includes(committed.releaseId)), false);
  rpcResults.eth_chainId = '0x1';
  await submitManifest(committedText, 'WRONG_CHAIN');
  assert.equal(calls.at(-1).method, 'eth_chainId');
  rpcResults.eth_chainId = 'invalid';
  await submitManifest(committedText, 'UNAVAILABLE');

  rpcResults.eth_chainId = '0x7a69';
  const cliManifest = join(directory, 'manifest.json');
  const cliProfile = join(directory, 'anchor.json');
  await writeFile(cliManifest, committedText);
  await writeFile(cliProfile, JSON.stringify(anchorProfile));
  const cli = spawn(process.execPath, ['scripts/fingerprint.mjs', cliManifest, '--anchor', cliProfile], { windowsHide: true });
  let output = '';
  cli.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  const [exit] = await once(cli, 'close');
  assert.equal(exit, 0);
  assert.match(output, /MATCH 0xc/u);

  await visit('/compute');
  await value("document.querySelector('a[href=\"/docs#protocol-spike\"]').click()");
  await until('location.hash === "#protocol-spike" && document.readyState === "complete"');
  assert.match(await value("document.querySelector('#protocol-spike pre').textContent"), /npm run test:protocol/u);

  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const path of ['/', '/overview', '/studies', '/studies/create', studyPath, '/compute', '/privacy', '/verify', '/insights', '/docs']) {
    await visit(path);
    assert.equal(await value('document.documentElement.scrollWidth <= window.innerWidth'), true, path);
    if (path === '/') await screenshot('homepage-mobile.png');
  }
  await visit('/overview');
  await value("document.querySelector('.mobile-header summary').click()");
  assert.equal(await value("document.querySelector('.mobile-header details').open"), true);
  assert.deepEqual(failures, []);
  console.log('Browser smoke passed at 1440 px and 390 px. Browser and CLI also verified manifests against a test JSON-RPC endpoint.');
} finally {
  socket?.close();
  if (browser.exitCode === null && browser.pid) {
    const stopped = once(browser, 'exit');
    browser.kill();
    await Promise.race([stopped, pause(2000)]).catch(() => {});
  }
  await app.close();
  await anchoredApp?.close();
  if (rpc?.listening) await new Promise((resolve) => rpc.close(resolve));
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
}
