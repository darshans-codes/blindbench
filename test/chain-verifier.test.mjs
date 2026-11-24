import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { inspectAnchor, ledgerStudyKey, readAnchorProfile } from '../public/chain-verifier.mjs';

const code = '0x6000';
const profile = {
  address: `0x${'1'.repeat(40)}`,
  codeSha256: createHash('sha256').update(Buffer.from(code.slice(2), 'hex')).digest('hex'),
  rpcUrl: 'http://127.0.0.1:8545',
  selector: '0x12345678',
};
const result = {
  kind: 'result',
  studyId: '76d2d4df-5b51-47ab-a238-db547c64362a',
  policyHash: '2'.repeat(64),
  digest: '3'.repeat(64),
};
const word = (state) => String(state).padStart(64, '0');
const published = `0x${result.policyHash}${result.digest}${word(3)}`;
const methods = ['eth_chainId', 'eth_blockNumber', 'eth_getCode', 'eth_call'];

function fixture(overrides = {}) {
  const values = { eth_chainId: '0x7a69', eth_blockNumber: '0x2a', eth_getCode: code, eth_call: published, ...overrides };
  const calls = [];
  const fetch = async (url, request) => {
    assert.equal(url, `${profile.rpcUrl}/`);
    assert.equal(request.credentials, 'omit');
    assert.equal(request.redirect, 'error');
    assert.equal(request.method, 'POST');
    const call = JSON.parse(request.body);
    calls.push(call);
    return Response.json({ jsonrpc: '2.0', id: 1, result: values[call.method] });
  };
  return { calls, fetch };
}

test('uses a fixed block for the trusted contract bytecode and ABI read', async () => {
  const { calls, fetch } = fixture();
  const key = createHash('sha256').update(`blindbench/ledger/study/v1\0${result.studyId}`).digest('hex');
  assert.equal(await ledgerStudyKey(result.studyId), key);
  assert.deepEqual(await inspectAnchor(result, profile, { fetch }), { status: 'MATCH', block: '0x2a' });
  assert.deepEqual(calls.map(({ method }) => method), methods);
  assert.deepEqual(calls[2].params, [profile.address, '0x2a']);
  assert.deepEqual(calls[3].params, [{ to: profile.address, data: profile.selector + key }, '0x2a']);
});

test('identifies changed data, missing commitments, wrong chain, and bad responses', async () => {
  for (const [overrides, expected, callCount] of [
    [{ eth_call: published.replace(result.digest, '4'.repeat(64)) }, 'MISMATCH', 4],
    [{ eth_call: published.replace(result.policyHash, '4'.repeat(64)) }, 'MISMATCH', 4],
    [{ eth_call: published.slice(0, -64) + word(2) }, 'UNANCHORED', 4],
    [{ eth_call: published.slice(0, -64) + word(4) }, 'UNANCHORED', 4],
    [{ eth_call: `0x${'0'.repeat(128)}${word(3)}` }, 'UNAVAILABLE', 4],
    [{ eth_call: `0x0${published.slice(2)}` }, 'UNAVAILABLE', 4],
    [{ eth_chainId: '0x1' }, 'WRONG_CHAIN', 1],
    [{ eth_blockNumber: 'latest' }, 'UNAVAILABLE', 2],
    [{ eth_getCode: '0x' }, 'UNANCHORED', 3],
    [{ eth_getCode: '0x6001' }, 'UNAVAILABLE', 3],
    [{ eth_getCode: `0x${'00'.repeat(33_000)}` }, 'UNAVAILABLE', 3],
  ]) {
    const { calls, fetch } = fixture(overrides);
    assert.equal((await inspectAnchor(result, profile, { fetch })).status, expected);
    assert.equal(calls.length, callCount);
  }
  const { fetch, calls } = fixture();
  assert.equal((await inspectAnchor({ kind: 'policy-preview' }, profile, { fetch })).status, 'UNANCHORED');
  assert.equal((await inspectAnchor(result, null, { fetch })).status, 'UNAVAILABLE');
  assert.equal(calls.length, 0);
  assert.equal((await inspectAnchor(result, profile, { fetch: async () => { throw new Error('offline'); } })).status, 'UNAVAILABLE');
});

test('rejects remote, disguised and unsupported RPC configuration', () => {
  for (const rpcUrl of [
    'http://localhost:8545', 'https://127.0.0.1:8545', 'http://127.0.0.1:8545/@evil',
    'http://127.0.0.1:8545?foo', 'http://127.0.0.1:443', 'http://127.0.0.1:65536',
    'http://127.0.0.1:8545@outside.invalid', 'http://127.1:8545',
  ]) assert.throws(() => readAnchorProfile({ ...profile, rpcUrl }));
  assert.throws(() => readAnchorProfile({ ...profile, address: `0x${'0'.repeat(40)}` }));
  assert.throws(() => readAnchorProfile({ ...profile, token: 'unexpected' }));
});
