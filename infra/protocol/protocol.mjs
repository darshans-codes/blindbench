import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFixturePolicy } from '../../packages/study-policy/index.mjs';

const composePeers = {
  collector: new URL('http://collector:8080/'),
  aggregators: [new URL('http://leader:8080/'), new URL('http://helper:8080/')],
};
const standalonePrecision = 60;
const baseline = [2, 3, 4, 8, 6, 5, 2];
const baselineSize = baseline.reduce((total, count) => total + count, 0);
const vdaf = { type: 'Prio3Histogram', length: String(baseline.length), chunk_length: '3' };
const reportType = 'application/dap-report';
const publicKeyType = 'application/dap-hpke-config-list';

export class ProtocolFailure extends Error {}

function testRequest(fetch, peer, path, value) {
  return fetch(new URL(`internal/test/${path}`, peer), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
}

async function exchange(fetch, peer, path, value, allowed = ['success']) {
  let data;
  const stage = `${peer.hostname}/${path}`;
  try {
    const response = await testRequest(fetch, peer, path, value);
    if (!response.ok) throw new ProtocolFailure(`${stage} returned HTTP ${response.status}.`);
    data = await response.json();
  } catch (error) {
    if (error instanceof ProtocolFailure) throw error;
    throw new ProtocolFailure(`${stage} did not return a readable response within its request limit.`);
  }
  if (!allowed.includes(data?.status)) throw new ProtocolFailure(`${stage} reported a failed or unexpected status.`);
  return data;
}

async function waitForReadiness(fetch, pause, peers) {
  const deadline = Date.now() + 90_000;
  for (let attempt = 0; attempt < 45 && Date.now() < deadline; attempt++) {
    const checks = await Promise.allSettled(peers.map(async (peer) => {
      const response = await testRequest(fetch, peer, 'ready', {});
      await response.body?.cancel();
      return response.ok;
    }));
    if (checks.every((check) => check.status === 'fulfilled' && check.value)) return;
    await pause(1000);
  }
  throw new ProtocolFailure('Leader, Helper and Collector did not all become ready.');
}

async function dapEndpoint(fetch, peer) {
  const { endpoint } = await exchange(fetch, peer, 'endpoint_for_task', {});
  if (typeof endpoint !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/)*$/u.test(endpoint)) {
    throw new ProtocolFailure('Invalid DAP serving prefix.');
  }
  return new URL(endpoint, peer);
}

async function publicKeys(fetch, peer, taskId) {
  const url = new URL('hpke_config', peer);
  url.searchParams.set('task_id', taskId);
  try {
    const response = await fetch(url, {
      headers: { Accept: publicKeyType },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok && response.headers.get('content-type')?.split(';')[0] === publicKeyType) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 0 && bytes.length <= 16_384) return bytes;
    } else {
      await response.body?.cancel();
    }
  } catch {
    throw new ProtocolFailure(`Failed to receive HPKE configuration from ${peer.hostname}.`);
  }
  throw new ProtocolFailure(`Unexpected HPKE configuration response from ${peer.hostname}.`);
}

function x25519Key(config) {
  // One HPKE entry: two-byte list length, config ID, three suite IDs, key length, then 32 key bytes.
  if (config.length !== 43 || config.readUInt16BE(0) !== 41 ||
      config.readUInt16BE(3) !== 0x20 || config.readUInt16BE(5) !== 1 ||
      config.readUInt16BE(7) !== 1 || config.readUInt16BE(9) !== 32) {
    throw new ProtocolFailure('The HPKE configuration did not match the fixture suite.');
  }
  return config.subarray(11);
}

async function upload(fetch, peer, taskId, bytes) {
  try {
    const response = await fetch(new URL(`tasks/${taskId}/reports`, peer), {
      method: 'PUT',
      headers: { 'Content-Type': reportType },
      body: bytes,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    await response.body?.cancel();
    return response;
  } catch {
    throw new ProtocolFailure('Leader report upload did not complete within its request limit.');
  }
}

function checkReports(reports, reportCount) {
  if (!Array.isArray(reports) || reports.length !== reportCount ||
      reports.some((bytes) => !Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.length > 65_536)) {
    throw new ProtocolFailure('Browser returned an unexpected set of report envelopes.');
  }
  // DAP-09 ReportMetadata starts with a 16-byte report ID.
  const ids = new Set(reports.map((bytes) => bytes.subarray(0, 16).toString('hex')));
  if (ids.size !== reportCount) throw new ProtocolFailure('Browser returned duplicate report IDs before the retry check.');
}

function checkResult(result, expected, reportCount) {
  const bins = result.result;
  if (result.report_count !== reportCount || !Array.isArray(bins) || bins.length !== expected.length ||
      expected.some((count, index) => bins[index] !== String(count))) {
    throw new ProtocolFailure('The collected histogram did not match the known fixture after the same-envelope retry.');
  }
}

export async function runProtocol({ generateReports, log = () => {}, fetch = globalThis.fetch, pause = sleep, fixture, peers = composePeers }) {
  const { aggregators, collector } = peers;
  const policy = readFixturePolicy(fixture);
  if (fixture !== undefined && !policy) {
    throw new ProtocolFailure('Fictional fixture settings are out of range.');
  }
  const reportCount = policy?.minimumBatch ?? baselineSize;
  // The closed collection window is one Janus time bucket. Smaller buckets would
  // require Janus to write empty aggregation shards for the rest of the window.
  const precision = policy ? policy.windowHours * 3600 : standalonePrecision;
  const source = baseline.flatMap((count, bin) => Array(count).fill(bin));
  const fictionalBins = Array.from({ length: reportCount }, (_, index) => source[index % source.length]);
  const expected = baseline.map((_, bin) => fictionalBins.filter((value) => value === bin).length);
  await waitForReadiness(fetch, pause, [...aggregators, collector]);
  const [leader, helper] = await Promise.all(aggregators.map((peer) => dapEndpoint(fetch, peer)));
  log('READY: Leader, Helper and Collector.');

  const taskId = randomBytes(32).toString('base64url');
  const collectorToken = randomBytes(32).toString('base64url');
  const task = { task_id: taskId, leader: leader.href, vdaf, query_type: 1 };
  const { collector_hpke_config } = await exchange(fetch, collector, 'add_task', {
    ...task, collector_authentication_token: collectorToken,
  });
  if (typeof collector_hpke_config !== 'string' || !/^[A-Za-z0-9_-]{16,4096}$/u.test(collector_hpke_config)) {
    throw new ProtocolFailure('Collector returned an invalid public configuration.');
  }
  const aggregatorTask = {
    ...task,
    helper: helper.href,
    leader_authentication_token: randomBytes(32).toString('base64url'),
    vdaf_verify_key: randomBytes(16).toString('base64url'),
    collector_hpke_config,
    max_batch_query_count: 1,
    min_batch_size: reportCount,
    time_precision: precision,
  };
  await Promise.all([
    exchange(fetch, aggregators[0], 'add_task', { ...aggregatorTask, role: 'leader', collector_authentication_token: collectorToken }),
    exchange(fetch, aggregators[1], 'add_task', { ...aggregatorTask, role: 'helper' }),
  ]);
  const [leaderConfig, helperConfig] = await Promise.all([
    publicKeys(fetch, leader, taskId), publicKeys(fetch, helper, taskId),
  ]);
  if (x25519Key(leaderConfig).equals(x25519Key(helperConfig))) {
    throw new ProtocolFailure('The aggregators advertised the same HPKE public key.');
  }

  const batchStart = Math.floor(Date.now() / (precision * 1000)) * precision - precision;
  const reports = await generateReports({
    taskId, leaderConfig, helperConfig, precision, batchStart,
    length: Number(vdaf.length), chunkLength: Number(vdaf.chunk_length),
    fictionalBins,
  });
  checkReports(reports, reportCount);
  log('BROWSER: encrypted envelopes generated for the fictional batch.');

  for (const bytes of reports) {
    const response = await upload(fetch, leader, taskId, bytes);
    if (!response.ok) throw new ProtocolFailure(`A valid report upload returned HTTP ${response.status}.`);
  }
  const retry = await upload(fetch, leader, taskId, reports[0]);
  if (!retry.ok && retry.status !== 400) {
    throw new ProtocolFailure(`The duplicate report upload returned HTTP ${retry.status}.`);
  }
  const malformed = await upload(fetch, leader, taskId, Buffer.alloc(0));
  if (malformed.status !== 400) throw new ProtocolFailure(`The empty report returned HTTP ${malformed.status}; expected 400.`);
  log('UPLOAD: valid envelopes accepted, empty envelope rejected and one envelope retried.');

  const { handle } = await exchange(fetch, collector, 'collection_start', {
    task_id: taskId,
    agg_param: '',
    query: { type: 1, batch_interval_start: batchStart, batch_interval_duration: precision },
  });
  if (typeof handle !== 'string' || handle.length === 0 || handle.length > 200) {
    throw new ProtocolFailure('Collector returned an invalid collection handle.');
  }
  const deadline = Date.now() + 90_000;
  for (let attempt = 0; attempt < 60 && Date.now() < deadline; attempt++) {
    const result = await exchange(fetch, collector, 'collection_poll', { handle }, ['in progress', 'complete']);
    if (result.status === 'complete') {
      checkResult(result, expected, reportCount);
      log('MATCH: the restricted collector result matched all fixture bins without counting the retry twice.');
      return;
    }
    await pause(1000);
  }
  throw new ProtocolFailure('Collection did not complete within its polling limit.');
}
