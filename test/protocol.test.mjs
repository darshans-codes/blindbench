import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runProtocol } from '../infra/protocol/protocol.mjs';
import { nativePeers } from '../infra/protocol/native-peers.mjs';

function interopStub({ sharedKey = false, wrongResult = false, minimumBatch = 30 } = {}) {
  const uploads = [];
  const provisions = new Map();
  const queries = [];
  let polls = 0;

  function fetch(url, init) {
    const peer = url.hostname === '127.0.0.1'
      ? { 18181: 'leader', 18182: 'helper', 18183: 'collector' }[url.port] : url.hostname;
    const path = url.pathname;
    if (path === '/internal/test/ready') return Response.json({});
    if (path === '/internal/test/endpoint_for_task') return Response.json({ status: 'success', endpoint: '/dap/' });
    if (path === '/internal/test/add_task') {
      provisions.set(peer, JSON.parse(init.body));
      return Response.json({ status: 'success', collector_hpke_config: 'publicfixtureconfigonly' });
    }
    if (path === '/dap/hpke_config') {
      assert.equal(url.searchParams.get('task_id'), provisions.get(peer).task_id);
      const fill = sharedKey || peer === 'leader' ? 1 : 2;
      const key = Buffer.alloc(32, fill);
      const header = Buffer.from([0, 41, peer === 'leader' ? 1 : 2, 0, 32, 0, 1, 0, 1, 0, 32]);
      return new Response(Buffer.concat([header, key]), { headers: { 'Content-Type': 'application/dap-hpke-config-list' } });
    }
    if (path.startsWith('/dap/tasks/')) {
      assert.equal(peer, 'leader');
      assert.equal(init.method, 'PUT');
      assert.equal(init.headers['Content-Type'], 'application/dap-report');
      assert.equal(path, `/dap/tasks/${provisions.get(peer).task_id}/reports`);
      uploads.push(init.body);
      return new Response(null, { status: init.body.length ? 200 : 400 });
    }
    assert.equal(peer, 'collector');
    if (path === '/internal/test/collection_start') {
      queries.push(JSON.parse(init.body));
      return Response.json({ status: 'success', handle: 'fixture-handle' });
    }
    assert.equal(path, '/internal/test/collection_poll');
    if (++polls === 1) return Response.json({ status: 'in progress' });
    const result = wrongResult ? ['3', '3', '4', '7', '6', '5', '2'] : [String(2 + minimumBatch - 30), '3', '4', '8', '6', '5', '2'];
    return Response.json({ status: 'complete', report_count: minimumBatch, result });
  }

  return { fetch, uploads, provisions, queries };
}

function standInEnvelopes(config) {
  assert.deepEqual(Object.keys(config).sort(),
    ['batchStart', 'chunkLength', 'fictionalBins', 'helperConfig', 'leaderConfig', 'length', 'precision', 'taskId']);
  assert.equal(config.length, 7);
  assert.equal(config.chunkLength, 3);
  assert.equal(config.fictionalBins.length, 30);
  return config.fictionalBins.map((_, index) => Buffer.alloc(64, index));
}

test('isolated orchestration scopes tasks, uploads, and collection queries', async () => {
  const stub = interopStub();
  const events = [];
  await runProtocol({ fetch: stub.fetch, generateReports: standInEnvelopes, pause() {}, log: (message) => events.push(message) });
  const leader = stub.provisions.get('leader');
  const helper = stub.provisions.get('helper');
  assert.equal(leader.task_id, helper.task_id);
  assert.equal(leader.min_batch_size, 30);
  assert.equal(leader.max_batch_query_count, 1);
  assert.equal(leader.collector_authentication_token, stub.provisions.get('collector').collector_authentication_token);
  assert.equal(Object.hasOwn(helper, 'collector_authentication_token'), false);
  assert.equal(stub.uploads.length, 32);
  assert.ok(stub.uploads[0].equals(stub.uploads[30]));
  assert.equal(stub.uploads[31].length, 0);
  assert.equal(stub.queries.length, 1);
  assert.equal(stub.queries[0].query.batch_interval_duration, 60);
  assert.match(events.at(-1), /^MATCH:/u);
  assert.ok(!events.some((line) => line.includes(leader.collector_authentication_token)));
});

test('isolated orchestration fails before generation when HPKE public keys match across roles', async () => {
  const stub = interopStub({ sharedKey: true });
  await assert.rejects(
    runProtocol({ fetch: stub.fetch, generateReports() { assert.fail('generation must not start'); }, pause() {} }),
    /same HPKE public key/u,
  );
  assert.equal(stub.uploads.length, 0);
});

test('isolated orchestration rejects a different per-bin result even when the total matches', async () => {
  const stub = interopStub({ wrongResult: true });
  const events = [];
  await assert.rejects(
    runProtocol({ fetch: stub.fetch, generateReports: standInEnvelopes, pause() {}, log: (message) => events.push(message) }),
    /did not match the known fixture/u,
  );
  assert.equal(events.some((line) => line.startsWith('MATCH:')), false);
});

test('native mode accepts distinct loopback ports and keeps interop roles separate', async () => {
  const stub = interopStub();
  const peers = nativePeers('18181,18182,18183');
  assert.throws(() => nativePeers('18181,18181,18183'));
  assert.throws(() => nativePeers('18181,18182,65536'));
  assert.throws(() => nativePeers('http://example.invalid,18182,18183'));
  await runProtocol({ fetch: stub.fetch, generateReports: standInEnvelopes, pause() {}, peers });
  const leader = stub.provisions.get('leader');
  assert.equal(leader.leader, 'http://127.0.0.1:18181/dap/');
  assert.equal(leader.helper, 'http://127.0.0.1:18182/dap/');
  assert.equal(stub.provisions.get('collector').leader, leader.leader);
});

test('study fixture scopes the minimum batch and collection interval to the saved policy', async () => {
  const stub = interopStub({ minimumBatch: 31 });
  let reportTime;
  await runProtocol({ fetch: stub.fetch, pause() {}, fixture: { minimumBatch: 31, windowHours: 24 },
    generateReports(config) {
      reportTime = config.batchStart;
      assert.equal(config.precision, 24 * 3600);
      assert.equal(config.fictionalBins.length, 31);
      return config.fictionalBins.map((_, index) => Buffer.alloc(64, index));
    },
  });
  assert.equal(stub.provisions.get('leader').min_batch_size, 31);
  assert.equal(stub.provisions.get('leader').time_precision, 24 * 3600);
  assert.equal(stub.provisions.get('helper').time_precision, 24 * 3600);
  const query = stub.queries[0].query;
  assert.equal(query.batch_interval_duration, 24 * 3600);
  assert.equal(query.batch_interval_start, reportTime);
  assert.equal(reportTime % query.batch_interval_duration, 0);
  await assert.rejects(runProtocol({ fixture: { minimumBatch: 501, windowHours: 24 } }), /out of range/u);
});
