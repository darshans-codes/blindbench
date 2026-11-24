import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { nativePeers } from './native-peers.mjs';
import { ProtocolFailure, runProtocol } from './protocol.mjs';

const origin = 'http://127.0.0.1:32123';
const document = '<!doctype html><meta charset="utf-8"><title>BlindBench fictional DAP fixture</title><link rel="icon" href="data:,"><script src="/divviup.js"></script>';
const headers = { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data:" };

async function generateReports(browser, bundle, config) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const keyType = 'application/dap-hpke-config-list';
    const keys = `hpke_config?task_id=${config.taskId}`;
    const publicRoutes = new Map([
      [`${origin}/`, { body: document, contentType: 'text/html; charset=utf-8', headers }],
      [`${origin}/divviup.js`, { body: bundle, contentType: 'text/javascript; charset=utf-8' }],
      [`${origin}/leader/${keys}`, { body: config.leaderConfig, contentType: keyType }],
      [`${origin}/helper/${keys}`, { body: config.helperConfig, contentType: keyType }],
    ]);
    const requested = new Set();
    let unexpected = false;
    await page.route(/./u, async (route) => {
      const request = route.request();
      const response = publicRoutes.get(request.url());
      if (request.method() !== 'GET' || !response) {
        unexpected = true;
        await route.abort();
        return;
      }
      requested.add(request.url());
      await route.fulfill(response);
    });

    await page.goto(`${origin}/`, { waitUntil: 'load' });
    const results = await page.evaluate(async ({ taskId, precision, batchStart, length, chunkLength, fictionalBins, origin }) => {
      const Task = globalThis.divviup?.dap?.Task;
      if (!globalThis.isSecureContext || Task?.protocolVersion !== 'dap-09') return null;

      const task = new Task({
        id: taskId,
        leader: `${origin}/leader/`,
        helper: `${origin}/helper/`,
        timePrecisionSeconds: precision,
        type: 'histogram',
        length,
        chunkLength,
      });
      const timestamp = new Date(batchStart * 1000);
      const reports = [];
      for (const bin of fictionalBins) {
        const report = await task.generateReport(bin, { timestamp });
        reports.push(Array.from(report.encode()));
      }
      return reports;
    }, {
      taskId: config.taskId,
      precision: config.precision,
      batchStart: config.batchStart,
      length: config.length,
      chunkLength: config.chunkLength,
      fictionalBins: config.fictionalBins,
      origin,
    });
    if (unexpected || requested.size !== publicRoutes.size || !Array.isArray(results)) {
      throw new ProtocolFailure('Browser did not use the expected DAP-09 SDK and restricted public-key routes.');
    }
    return results.map((bytes) => Buffer.from(bytes));
  } finally {
    await context.close();
  }
}

async function main() {
  const native = process.argv.includes('--native');
  const peers = native ? nativePeers(process.env.BLINDBENCH_NATIVE_PORTS) : undefined;
  const directory = native ? new URL('../../.local/native-probe/', import.meta.url) : new URL('./', import.meta.url);
  const bundle = await readFile(new URL('divviup.js', directory));
  const [metadata] = JSON.parse(await readFile(new URL('sdk-package.json', directory), 'utf8'));
  const digest = createHash('sha256').update(bundle).digest('hex');
  if (metadata?.name !== '@divviup/dap' || metadata?.version !== '0.9.1' ||
      metadata.integrity !== 'sha512-XdNtsk6813SVN1smVY9WTzrscZyNzxiVDXR/wh6O7DvXeGXTxxKgeoA3ibX4KcKqs4qdN9f+8pAanRyF2rxmQg==' ||
      digest !== '1877b9c1b3548522101d9c0a335a8380c23a56cfc4a2f0d4af98b103e076272e') {
    throw new ProtocolFailure('The bundled SDK does not match the pinned npm package metadata.');
  }

  const require = createRequire(new URL('package.json', directory));
  if (require('playwright/package.json').version !== '1.58.2') {
    throw new ProtocolFailure('The Playwright version must match 1.58.2.');
  }
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    console.log(`Fixture tools: Divvi Up DAP ${metadata.version}, SDK SHA-256 ${digest}, Chromium ${browser.version()}.`);
    console.log(`Divvi Up package integrity: ${metadata.integrity}.`);
    await runProtocol({
      peers,
      fixture: process.env.BLINDBENCH_FIXTURE === undefined ? undefined : JSON.parse(process.env.BLINDBENCH_FIXTURE),
      generateReports: (config) => generateReports(browser, bundle, config),
      log: (message) => console.log(message),
    });
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof ProtocolFailure ? error.message
    : error.message?.startsWith('Set BLINDBENCH_NATIVE_PORTS') ? error.message
    : 'Browser or SDK initialization failed. Check the pinned Playwright install and SDK bundle.';
  console.error(`FAILED: ${message}`);
  process.exitCode = 1;
}
