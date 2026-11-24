export const MANIFEST_LIMIT = 16_384;
const schemaKeys = ['counts', 'delta', 'epsilon', 'policyHash', 'releaseId', 'schemaVersion', 'studyId'];
const policyKeys = ['adjacency', 'delta', 'epsilon', 'kind', 'measurement', 'minimumBatch',
  'protocol', 'schemaVersion', 'studyId', 'studyVersion', 'windowHours'];
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/u;
const digest = /^[0-9a-f]{64}$/u;

function readStrict(text) {
  if (new TextEncoder().encode(text).byteLength > MANIFEST_LIMIT) throw new Error('Choose a JSON manifest up to 16 KiB.');
  if (text.includes('\\')) throw new Error('The manifest schema uses literal ASCII keys and identifiers.');
  const value = JSON.parse(text);
  const keys = [...text.matchAll(/"([a-zA-Z]+)"\s*:/gu)].map((match) => match[1]).sort();
  if (!value || typeof value !== 'object' || Array.isArray(value) || !matches(keys, Object.keys(value).sort())) {
    throw new Error('The manifest schema requires unique keys.');
  }
  return { value, keys };
}

function matches(keys, expected) {
  return keys.length === expected.length && expected.every((key, index) => keys[index] === key);
}

function readResultPayload({ value, keys }) {
  if (!matches(keys, schemaKeys) ||
      value.schemaVersion !== 1 || !uuid.test(value.studyId ?? '') ||
      !uuid.test(value.releaseId ?? '') || !digest.test(value.policyHash ?? '') ||
      typeof value.studyId !== 'string' || typeof value.releaseId !== 'string' || typeof value.policyHash !== 'string' ||
      value.epsilon !== 1 || value.delta !== 0 || !Array.isArray(value.counts) || value.counts.length !== 7 ||
      value.counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('The file does not match the v1 synthetic histogram manifest schema.');
  }
  return value;
}

export function readManifest(text) {
  return readResultPayload(readStrict(text));
}

function readPolicyPayload({ value, keys }) {
  const validInteger = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  if (!matches(keys, policyKeys) || value.schemaVersion !== 1 || value.kind !== 'study-policy-preview' ||
      value.measurement !== 'compensation-inr-lakh-v1' || value.protocol !== 'dap-09' ||
      value.adjacency !== 'add-remove' || value.epsilon !== 1 || value.delta !== 0 ||
      typeof value.studyId !== 'string' || !uuid.test(value.studyId) ||
      !validInteger(value.studyVersion, 1, Number.MAX_SAFE_INTEGER) ||
      !validInteger(value.minimumBatch, 30, 500) || !validInteger(value.windowHours, 1, 168)) {
    throw new Error('The file does not match the study policy preview schema.');
  }
  return value;
}

export function readPolicyPreview(text) {
  return readPolicyPayload(readStrict(text));
}

export function policyPreviewBytes(policy) {
  const canonical = JSON.stringify(Object.fromEntries(policyKeys.map((key) => [key, policy[key]])));
  return new TextEncoder().encode(`blindbench/study-policy-preview/v1\0${canonical}`);
}

async function sha256(bytes, subtle) {
  const hash = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintManifest(manifest, subtle = globalThis.crypto.subtle) {
  // Schema v1 consists of fixed ASCII keys, ASCII identifiers and safe nonnegative integers.
  const canonical = JSON.stringify(Object.fromEntries(schemaKeys.map((key) => [key, manifest[key]])));
  return sha256(new TextEncoder().encode(`blindbench/result/v1\0${canonical}`), subtle);
}

export async function fingerprintFile(text, subtle = globalThis.crypto.subtle) {
  const parsed = readStrict(text);
  if (parsed.value.kind === 'study-policy-preview') {
    return { kind: 'policy-preview', digest: await sha256(policyPreviewBytes(readPolicyPayload(parsed)), subtle) };
  }
  const manifest = readResultPayload(parsed);
  return { kind: 'result', digest: await fingerprintManifest(manifest, subtle),
    studyId: manifest.studyId, policyHash: manifest.policyHash };
}
