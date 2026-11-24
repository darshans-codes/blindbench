import { fingerprintFile, MANIFEST_LIMIT, readManifest } from './manifest.mjs';
import { inspectAnchor } from './chain-verifier.mjs';
import { describeHistogram } from './release-insights.mjs';

const filter = document.querySelector('[data-study-filter]');
if (filter) {
  const scope = [...document.querySelectorAll('[data-study-title]')];
  const empty = document.querySelector('[data-filter-empty]');
  const count = document.querySelector('[data-filter-count]');
  filter.addEventListener('input', () => {
    const query = filter.value.trim().toLowerCase();
    for (const study of scope) study.hidden = !study.dataset.studyTitle.includes(query);
    const visible = scope.filter((study) => !study.hidden).length;
    empty.hidden = visible > 0;
    count.textContent = `${visible} ${visible === 1 ? 'study' : 'studies'}`;
  });
}

const example = document.querySelector('[data-example]');
if (example) {
  const count = document.querySelector('[data-example-count]');
  const cell = document.querySelector('[data-example-cell]');
  const bar = document.querySelector('[data-example-bar]');
  const button = document.querySelector('[data-example-toggle]');
  const summary = document.querySelector('[data-example-summary]');
  const baseline = Number(count.textContent);
  button.addEventListener('click', () => {
    const active = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!active));
    button.textContent = active ? 'Add one fictional contribution' : 'Remove fictional contribution';
    const value = baseline + Number(!active);
    count.textContent = String(value);
    cell.textContent = String(value);
    bar.classList.toggle('raised-count', !active);
    summary.textContent = active ? 'Baseline cohort restored.' : 'One bin increased by 1. The L1 distance between the histograms is 1.';
  });
}

const verifier = document.querySelector('[data-verifier]');
if (verifier) {
  const input = verifier.querySelector('input[type=file]');
  const output = document.querySelector('[data-verifier-output]');
  const status = output.querySelector('[data-verifier-status]');
  const message = output.querySelector('[data-verifier-message]');
  const digest = output.querySelector('[data-verifier-digest]');
  const copy = output.querySelector('[data-copy]');
  const insights = output.querySelector('[data-verified-insights]');
  const facts = insights.querySelector('dl');
  const button = verifier.querySelector('button');
  const anchor = verifier.dataset.anchor ? JSON.parse(verifier.dataset.anchor) : null;
  verifier.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    output.hidden = false;
    digest.hidden = true;
    copy.hidden = true;
    insights.hidden = true;
    facts.replaceChildren();
    status.textContent = 'Reading manifest';
    message.textContent = '';
    try {
      const file = input.files[0];
      if (!file || file.size > MANIFEST_LIMIT) throw new Error('Choose a JSON manifest up to 16 KiB.');
      const text = await file.text();
      const result = await fingerprintFile(text);
      digest.textContent = result.digest;
      digest.hidden = false;
      copy.hidden = !navigator.clipboard;
      copy.textContent = 'Copy digest';
      status.textContent = result.kind === 'policy-preview' ? 'Local policy fingerprint' : 'Chain verification unavailable';
      message.textContent = result.kind === 'policy-preview'
        ? 'Compare this SHA-256 fingerprint with the saved snapshot. This preview has no chain commitment.'
        : 'Calculated a local SHA-256 fingerprint. This workspace has no configured commitment contract.';
      if (result.kind === 'result' && anchor) {
        status.textContent = 'Checking local chain';
        message.textContent = '';
        const check = await inspectAnchor(result, anchor);
        const descriptions = {
          MATCH: `Policy and result digests match the published commitment at block ${check.block}.`,
          MISMATCH: 'The manifest differs from the published policy or result commitment.',
          UNANCHORED: 'The configured chain has no published commitment for this study.',
          WRONG_CHAIN: 'The RPC endpoint is connected to a different chain.',
          UNAVAILABLE: 'The RPC response or contract could not be verified.',
          INVALID_FORMAT: 'The manifest could not be validated.',
        };
        status.textContent = check.status;
        message.textContent = descriptions[check.status];
        if (check.status === 'MATCH') {
          for (const [label, value] of describeHistogram(readManifest(text).counts)) {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = label;
            description.textContent = value;
            row.append(term, description);
            facts.append(row);
          }
          insights.hidden = false;
        }
      }
    } catch (error) {
      status.textContent = 'Manifest could not be read';
      message.textContent = error instanceof SyntaxError ? 'The file contains invalid JSON.' : error.message;
    } finally {
      button.disabled = false;
    }
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(digest.textContent);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Select the digest to copy';
    }
  });
}
