const localChain = '0x7a69';
const zeroDigest = '0'.repeat(64);
const maxResponseBytes = 65_536;
const sha256Digest = /^[0-9a-f]{64}$/u;
const hexWord = /^[0-9a-f]{64}$/u;
const quantity = /^0x(?:0|[1-9a-f][0-9a-f]*)$/u;

export function readAnchorProfile(input) {
  const expected = 'address,codeSha256,rpcUrl,selector';
  if (!input || typeof input !== 'object' || Object.keys(input).sort().join(',') !== expected ||
      typeof input.rpcUrl !== 'string' || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}\/?$/u.test(input.rpcUrl) ||
      typeof input.address !== 'string' || !/^0x[0-9a-f]{40}$/u.test(input.address) || /^0x0+$/u.test(input.address) ||
      typeof input.selector !== 'string' || !/^0x[0-9a-f]{8}$/u.test(input.selector) ||
      typeof input.codeSha256 !== 'string' || !sha256Digest.test(input.codeSha256) || input.codeSha256 === zeroDigest) {
    throw new Error('Anchor profile requires a local RPC URL, contract address, selector and runtime code digest.');
  }
  const url = new URL(input.rpcUrl);
  const port = Number(url.port);
  if (port < 1024 || port > 65_535) throw new Error('Anchor profile requires an allowed local port.');
  return { ...input, rpcUrl: url.href };
}

async function boundedJSON(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('RPC response has no body.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let json = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) throw new Error('RPC response exceeds the size limit.');
      json += decoder.decode(value, { stream: true });
    }
    return JSON.parse(json + decoder.decode());
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function readRpc(fetch, profile, method, params) {
  const response = await fetch(profile.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('RPC returned an HTTP error.');
  }
  const payload = await boundedJSON(response);
  if (payload?.jsonrpc !== '2.0' || payload.id !== 1 || Object.hasOwn(payload, 'error') || typeof payload.result !== 'string') {
    throw new Error('RPC returned an invalid result.');
  }
  return payload.result;
}

async function sha256(bytes, subtle) {
  const result = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result), (n) => n.toString(16).padStart(2, '0')).join('');
}

export async function ledgerStudyKey(studyId, subtle = globalThis.crypto.subtle) {
  if (typeof studyId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(studyId)) {
    throw new Error('Invalid study identifier.');
  }
  return sha256(new TextEncoder().encode(`blindbench/ledger/study/v1\0${studyId}`), subtle);
}

export async function inspectAnchor(result, profile, { fetch = globalThis.fetch, subtle = globalThis.crypto.subtle } = {}) {
  if (result?.kind !== 'result') return { status: 'UNANCHORED' };
  if (!profile) return { status: 'UNAVAILABLE' };
  try {
    const anchor = readAnchorProfile(profile);
    if (!sha256Digest.test(result.digest) || !sha256Digest.test(result.policyHash)) return { status: 'INVALID_FORMAT' };
    const key = await ledgerStudyKey(result.studyId, subtle);
    const chainId = await readRpc(fetch, anchor, 'eth_chainId', []);
    if (!quantity.test(chainId)) return { status: 'UNAVAILABLE' };
    if (chainId !== localChain) return { status: 'WRONG_CHAIN' };
    const block = await readRpc(fetch, anchor, 'eth_blockNumber', []);
    if (!quantity.test(block)) return { status: 'UNAVAILABLE' };
    const code = await readRpc(fetch, anchor, 'eth_getCode', [anchor.address, block]);
    if (code === '0x') return { status: 'UNANCHORED' };
    if (!/^0x(?:[0-9a-f]{2}){1,24576}$/u.test(code)) return { status: 'UNAVAILABLE' };
    const codeBytes = Uint8Array.from(code.slice(2).match(/../gu), (octet) => parseInt(octet, 16));
    if (await sha256(codeBytes, subtle) !== anchor.codeSha256) return { status: 'UNAVAILABLE' };
    const payload = await readRpc(fetch, anchor, 'eth_call', [{ to: anchor.address, data: anchor.selector + key }, block]);
    const words = payload.startsWith('0x') ? payload.slice(2).match(/.{64}/gu) : null;
    if (payload.length !== 194 || words?.length !== 3 || !words.every((word) => hexWord.test(word))) {
      return { status: 'UNAVAILABLE' };
    }
    const [policy, digest, word] = words;
    if (!/^0{63}[0-4]$/u.test(word)) return { status: 'UNAVAILABLE' };
    if (word !== '3'.padStart(64, '0')) return { status: 'UNANCHORED' };
    if (policy === zeroDigest || digest === zeroDigest) return { status: 'UNAVAILABLE' };
    return { status: policy === result.policyHash && digest === result.digest ? 'MATCH' : 'MISMATCH', block };
  } catch {
    return { status: 'UNAVAILABLE' };
  }
}
