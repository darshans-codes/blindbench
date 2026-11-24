import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fingerprintFile, fingerprintManifest, readManifest } from '../public/manifest.mjs';
import { startWorkspace } from '../src/server.mjs';
import { openStudies } from '../src/db.mjs';

async function formToken(url, path) {
  const response = await fetch(`${url}${path}`);
  assert.equal(response.status, 200);
  const page = await response.text();
  return {
    csrf: page.match(/name="csrf" value="([^"]+)"/u)[1],
    version: page.match(/name="version" value="([^"]+)"/u)?.[1] ?? '',
  };
}

function save(url, path, fields, origin = url) {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: { Origin: origin },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  });
}

test('local study can be created, edited, and reopened from persistent storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blindbench-storage-'));
  const database = join(directory, 'draft.sqlite');
  let app = await startWorkspace({ database, port: 0 });
  try {
    const create = '/studies/create';
    const credentials = await formToken(app.url, create);
    const fields = { ...credentials, title: 'Fictional QA cohort', minimumBatch: '42', windowHours: '36' };
    const response = await save(app.url, create, fields);
    assert.equal(response.status, 303);
    const path = response.headers.get('location').split('?')[0];
    const page = await (await fetch(`${app.url}${path}`)).text();
    assert.match(page, /Fictional QA cohort/u);
    assert.match(page, /42 eligible contributions/u);
    assert.match(page, /Protected collection is closed/u);
    const edit = `${path}/edit`;
    const editFields = { ...fields, ...await formToken(app.url, edit), title: 'Updated fictional cohort' };
    assert.equal((await save(app.url, edit, editFields)).status, 303);
    assert.equal((await save(app.url, edit, editFields)).status, 409);
    await app.close();
    app = await startWorkspace({ database, port: 0 });
    const inventory = await (await fetch(`${app.url}/studies`)).text();
    assert.match(inventory, /Updated fictional cohort/u);
    assert.match(inventory, /Synthetic compensation study/u);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('saved policy previews survive draft edits and verify without revealing draft titles', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blindbench-policy-'));
  const database = join(directory, 'draft.sqlite');
  let app = await startWorkspace({ database, port: 0 });
  try {
    const create = '/studies/create';
    const fields = { title: 'Fictional policy cohort', minimumBatch: '42', windowHours: '36' };
    const created = await save(app.url, create, { ...fields, ...await formToken(app.url, create) });
    const path = created.headers.get('location').split('?')[0];
    const action = `${path}/policy`;
    const first = `${action}/1.json`;
    assert.equal((await fetch(`${app.url}${first}`)).status, 404);
    const token = await formToken(app.url, path);
    assert.equal((await save(app.url, action, { ...token, minimumBatch: '99' })).status, 409);
    const attempts = await Promise.all([save(app.url, action, token), save(app.url, action, token)]);
    assert.deepEqual(attempts.map(({ status }) => status), [303, 303]);
    const response = await fetch(`${app.url}${first}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /study-policy-v1\.json/u);
    const manifest = await response.text();
    assert.doesNotMatch(manifest, /Fictional policy cohort|counts|releaseId/u);
    const fingerprint = await fingerprintFile(manifest);
    assert.equal(fingerprint.kind, 'policy-preview');
    const modified = JSON.stringify({ ...JSON.parse(manifest), minimumBatch: 43 });
    assert.notEqual(fingerprint.digest, (await fingerprintFile(modified)).digest);
    const view = await (await fetch(`${app.url}${path}`)).text();
    assert.match(view, new RegExp(fingerprint.digest, 'u'));
    assert.equal((await save(app.url, `${path}/edit`, { ...fields, minimumBatch: '43', ...await formToken(app.url, `${path}/edit`) })).status, 303);
    assert.equal((await save(app.url, action, token)).status, 409);
    assert.equal((await save(app.url, action, await formToken(app.url, path))).status, 303);
    const second = await (await fetch(`${app.url}${action}/2.json`)).text();
    assert.notEqual(fingerprint.digest, (await fingerprintFile(second)).digest);
    await app.close();
    app = await startWorkspace({ database, port: 0 });
    assert.equal(await (await fetch(`${app.url}${first}`)).text(), manifest);
    assert.equal(await (await fetch(`${app.url}${action}/2.json`)).text(), second);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('the fixture route queues once, persists its snapshot and exposes only a safe receipt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blindbench-fixture-'));
  const database = join(directory, 'draft.sqlite');
  const app = await startWorkspace({ database, port: 0 });
  try {
    const path = '/studies/create';
    const created = await save(app.url, path, { ...await formToken(app.url, path),
      title: 'Synthetic test study', minimumBatch: '42', windowHours: '36' });
    const studyPath = created.headers.get('location').split('?')[0];
    const fixturePath = `${studyPath}/fixture`;
    const fields = { ...await formToken(app.url, studyPath), fixture: 'fictional-v1' };
    assert.equal((await save(app.url, fixturePath, { ...fields, measurement: '42' })).status, 409);
    assert.equal((await save(app.url, fixturePath, fields, 'https://example.invalid')).status, 403);
    const queued = await Promise.all([save(app.url, fixturePath, fields), save(app.url, fixturePath, fields)]);
    assert.deepEqual(queued.map((response) => response.status), [303, 303]);
    assert.equal((await fetch(`${app.url}${fixturePath}`)).status, 404);
    const page = await (await fetch(`${app.url}${studyPath}`)).text();
    const id = page.match(/npm run fixture:run -- ([a-f0-9-]+)/u)[1];
    const owner = openStudies(database);
    try {
      const job = owner.fixtures.claim(id);
      assert.equal(job.minimumBatch, 42);
      assert.equal(job.windowHours, 36);
      assert.equal(owner.fixtures.claim(id), undefined);
      assert.ok(owner.fixtures.finish(id, job.attempts, true));
    } finally {
      owner.close();
    }
    const receipt = await (await fetch(`${app.url}${studyPath}`)).text();
    assert.match(receipt, /matched the fictional fixture/u);
    assert.doesNotMatch(receipt, /npm run fixture:run -- /u);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('expired fixture leases recover with a bounded retry and fence stale workers', () => {
  const store = openStudies(':memory:');
  try {
    const study = store.list()[0];
    const job = store.fixtures.enqueue(study.id, study.version);
    const first = store.fixtures.claim(job.id, 1000);
    assert.equal(store.fixtures.claim(job.id, first.leaseUntil - 1), undefined);
    const next = store.fixtures.claim(job.id, first.leaseUntil);
    assert.equal(next.attempts, 2);
    assert.equal(store.fixtures.finish(job.id, first.attempts, true, first.leaseUntil + 1), false);
    assert.equal(store.fixtures.claim(job.id, next.leaseUntil), undefined);
    assert.equal(store.fixtures.find(study.id, study.version, next.leaseUntil).state, 'failed');
  } finally {
    store.close();
  }
});

test('origin protection, input limits, and closed collection keep the draft boundary', async () => {
  const { url, close } = await startWorkspace({ database: ':memory:', port: 0 });
  try {
    const path = '/studies/create';
    const credentials = await formToken(url, path);
    const fields = { ...credentials, title: 'Test draft', minimumBatch: '30', windowHours: '24' };
    assert.equal((await save(url, path, fields, 'https://example.invalid')).status, 403);
    assert.equal((await save(url, path, { ...fields, csrf: '0'.repeat(64) })).status, 403);
    assert.equal((await save(url, path, { ...fields, title: 'A'.repeat(5000) })).status, 413);
    const rejected = await save(url, path, { ...fields, title: '<strong>invalid</strong>', minimumBatch: '10' });
    assert.equal(rejected.status, 422);
    const form = await rejected.text();
    assert.match(form, /Check the highlighted fields/u);
    assert.match(form, /&lt;strong&gt;invalid&lt;\/strong&gt;/u);
    assert.equal((await save(url, '/v1/reports/admit', {})).status, 404);
    const ready = await (await fetch(`${url}/readyz`)).json();
    assert.deepEqual(ready, { status: 'ready', aggregation: 'unavailable', ledger: 'unconfigured' });
    for (let index = 0; index < 27; index++) {
      assert.equal((await save(url, path, { ...fields, csrf: '' })).status, 403);
    }
    const limited = await save(url, path, fields);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  } finally {
    await close();
  }
});

test('public sample fingerprint is canonical and changes after a bin update', async () => {
  const { url, close } = await startWorkspace({ database: ':memory:', port: 0 });
  try {
    const response = await fetch(`${url}/examples/result-manifest.json`);
    const text = await response.text();
    const sample = readManifest(text);
    const reordered = readManifest(JSON.stringify(Object.fromEntries(Object.entries(sample).reverse())));
    assert.equal(await fingerprintManifest(sample), await fingerprintManifest(reordered));
    const altered = readManifest(JSON.stringify({ ...sample, counts: [4, ...sample.counts.slice(1)] }));
    assert.notEqual(await fingerprintManifest(sample), await fingerprintManifest(altered));
    assert.throws(() => readManifest(JSON.stringify({ ...sample, counts: [4.2] })), /schema/u);
    assert.throws(() => readManifest(text.replace('"epsilon": 1', '"epsilon": 2, "epsilon": 1')), /schema/u);
    assert.throws(() => readManifest(text.replace('"epsilon": 1', '"e\\u0070silon": 2, "epsilon": 1')), /schema/u);
    assert.throws(() => readManifest(' '.repeat(16_385)), /16 KiB/u);
  } finally {
    await close();
  }
});

test('all advertised pages respond and missing routes return a useful 404', async () => {
  const { url, close } = await startWorkspace({ database: ':memory:', port: 0 });
  try {
    const paths = ['/', '/overview', '/studies', '/studies/create', '/compute', '/privacy', '/ledger', '/verify', '/insights', '/benchmarks', '/docs'];
    for (const path of paths) {
      const page = await fetch(`${url}${path}`);
      assert.equal(page.status, 200, path);
      assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/u);
      assert.match(await page.text(), /<main.*id="main"/u);
    }
    const missing = await fetch(`${url}/missing`);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /Back to workspace/u);
  } finally {
    await close();
  }
});
