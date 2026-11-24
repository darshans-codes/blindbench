import { BINS, EXAMPLE_RESULT, TEMPLATE } from './studies.mjs';
import { button, definitionList, escape, icon, pageHeading, pill, relativeDate } from './layout.mjs';
import { histogram } from './home.mjs';
import { describeHistogram } from '../public/release-insights.mjs';

const sampleLabel = (study) => pill(study.sample ? 'Example draft' : 'Draft', study.sample ? 'local' : 'purple');
const studyLink = (study) => `/studies/${study.id}`;
const createAction = button('New study', '/studies/create', 'primary', 'plus');
const unavailable = (label, title, message) => `<section class="panel empty-state"><span class="stage-icon">${icon('lock')}</span><div><h2>${title}</h2><p>${message}</p></div>${pill(label, 'amber')}</section>`;

function studyRows(studies) {
  return studies.map((study) => `<a class="study-row" href="${studyLink(study)}" data-study-title="${escape(study.title.toLowerCase())}">
    <span class="row-symbol">${icon('chart')}</span><span><strong>${escape(study.title)}</strong><small>Compensation histogram</small></span>
    ${sampleLabel(study)}<time datetime="${escape(study.updatedAt)}">${relativeDate(study.updatedAt)}</time>${icon('arrow')}</a>`).join('');
}

export function overview(studies, { ledgerConfigured = false } = {}) {
  const drafts = studies.filter((study) => !study.sample);
  return `${pageHeading('Overview', 'Design and inspect a synthetic privacy study.', createAction, 'DEMO WORKSPACE')}
    <section class="workbench-intro panel"><div><p class="eyebrow">START HERE</p><h2>Build a study you can explain.</h2>
    <p>Set up a fixed histogram and review its release policy. The protocol reference follows the data from participant to published result.</p>
    <div class="inline-actions">${button('Browse studies', '/studies')}${button('Read the protocol', '/docs', 'outline')}</div></div>
    <div class="intro-design" aria-hidden="true"><span>${icon('lock')}</span><span>${icon('layers')}</span><span>${icon('chart')}</span></div></section>
    <div class="stats-grid">
      <article class="panel stat"><p>${icon('list')} Saved drafts</p><strong>${drafts.length}</strong><small>Created in this workspace</small></article>
      <article class="panel stat"><p>${icon('layers')} Private compute</p><strong class="status-value">Unavailable</strong><small>Aggregator integration is pending</small></article>
      <article class="panel stat"><p>${icon('link')} Audit ledger</p><strong class="status-value">${ledgerConfigured ? 'Configured' : 'Unconfigured'}</strong><small>${ledgerConfigured ? 'Verify a manifest to check the contract' : 'Local manifest hashing is available'}</small></article>
    </div>
    <section class="panel listing"><header><div><h2>Recent studies</h2><p>Open a draft to review its measurement and release policy.</p></div><a class="text-link" href="/studies">All studies ${icon('arrow')}</a></header>${studyRows(studies.slice(0, 5))}</section>`;
}

export function studiesPage(studies) {
  return `${pageHeading('Studies', 'Create and review drafts in the local synthetic workspace.', createAction)}
    <section class="panel listing"><header><div><h2>Study inventory</h2><p aria-live="polite" data-filter-count>${studies.length} ${studies.length === 1 ? 'study' : 'studies'}</p></div>
    <label class="search">${icon('search')}<input type="search" aria-label="Filter studies" placeholder="Filter by name…" data-study-filter></label></header>
    ${studyRows(studies)}<p class="filter-empty" data-filter-empty hidden>No drafts match your search.</p></section>`;
}

export function draftForm({ study, csrf, fields = {}, errors = {}, conflict = false }) {
  const values = { title: study?.title ?? '', minimumBatch: study?.minimumBatch ?? 30, windowHours: study?.windowHours ?? 24, ...fields };
  const error = (key) => errors[key] ? `<small class="input-error" id="${key}-error">${escape(errors[key])}</small>` : '';
  const invalid = (key) => errors[key] ? ` aria-invalid="true" aria-describedby="${key}-error"` : '';
  const target = study ? `${studyLink(study)}/edit` : '/studies/create';
  return `${pageHeading(study ? 'Edit draft' : 'New study', 'Configure a synthetic compensation histogram and save its policy as a draft.')}
    <div class="split-grid">
      <form class="panel form-panel" method="post" action="${target}" aria-label="Study draft">
        <input type="hidden" name="csrf" value="${csrf}">${study ? `<input type="hidden" name="version" value="${study.version}">` : ''}
        <h2>Study settings</h2><p>Use a fictional name. Drafts are stored on this device.</p>
        ${Object.keys(errors).length ? '<p class="form-alert" role="alert">Check the highlighted fields and try again.</p>' : ''}
        ${conflict ? '<p class="form-alert" role="alert">This draft changed since you opened it. Compare your entries with the saved draft before submitting again.</p>' : ''}
        <label for="title">Study name</label><input id="title" name="title" required minlength="3" maxlength="80" placeholder="e.g. Fictional graduate cohort" value="${escape(values.title)}"${invalid('title')}>${error('title')}
        <label for="minimumBatch">Minimum batch size</label><input id="minimumBatch" name="minimumBatch" type="number" required min="30" max="500" step="1" value="${escape(values.minimumBatch)}"${invalid('minimumBatch')}>${error('minimumBatch')}
        <label for="windowHours">Collection window (hours)</label><input id="windowHours" name="windowHours" type="number" required min="1" max="168" step="1" value="${escape(values.windowHours)}"${invalid('windowHours')}>${error('windowHours')}
        <div class="inline-actions form-actions"><button class="button button-primary" type="submit">Save draft ${icon('arrow')}</button>
        ${button('Cancel', study ? studyLink(study) : '/studies', 'quiet', '')}</div>
      </form>
      <section class="panel policy-panel"><span class="stage-icon">${icon('shield')}</span><h2>Release policy</h2><p>Fixed settings for the compensation template.</p>
      ${definitionList([['Privacy parameter', 'ε = 1 · δ = 0'], ['Privacy unit', 'One eligible participant'], ['Adjacency', TEMPLATE.adjacency], ['Release plan', 'One histogram for a fixed batch']])}
      <p class="policy-note">This foundation saves draft policy. Collection and release require the protected protocol services.</p></section>
    </div>`;
}

function fictionalFixture(study, csrf, job) {
  const labels = { queued: 'Queued', running: 'Running', failed: 'Failed', passed: 'Passed' };
  const launch = !job ? `<form method="post" action="${studyLink(study)}/fixture">
      <input type="hidden" name="csrf" value="${csrf}">
      <input type="hidden" name="version" value="${study.version}">
      <input type="hidden" name="fixture" value="fictional-v1">
      <button class="button button-outline" type="submit">Queue fictional fixture</button>
    </form>` : '';
  const canRun = job?.state === 'queued' || (job?.state === 'failed' && job.attempts < 2);
  const launcher = canRun ? `<p>With the fictional fixture services running, run this from the workspace in your terminal.</p>
    <pre><code>npm run fixture:run -- ${escape(job.id)}</code></pre>` : '';
  const outcome = job?.state === 'passed' ? '<p role="status">The isolated collector matched the fictional fixture.</p>' : '';
  const failed = job?.state === 'failed' && !canRun ? '<p role="status">Both attempts have been used.</p>' : '';
  return `<section class="panel detail-panel" id="fictional-fixture">
    <div class="detail-title"><h2>Fictional aggregation fixture</h2>${job ? pill(labels[job.state], job.state === 'failed' ? 'amber' : 'local') : ''}</div>
    <p>Exercise the saved batch and window with generated data. The exact histogram stays inside the test harness.</p>
    ${launch}${launcher}${outcome}${failed}
    ${job?.state === 'running' ? button('Refresh fixture status', `${studyLink(study)}#fictional-fixture`, 'outline') : ''}
  </section>`;
}

function policyPreview(study, csrf, snapshots) {
  const currentSaved = snapshots.some(({ version }) => version === study.version);
  const save = currentSaved ? '' : `<form method="post" action="${studyLink(study)}/policy">
    <input type="hidden" name="csrf" value="${csrf}">
    <input type="hidden" name="version" value="${study.version}">
    <button class="button button-outline" type="submit">Save policy preview</button>
  </form>`;
  return `<section class="panel detail-panel" id="policy-preview">
    <div class="detail-title"><h2>Policy previews</h2>${pill('Local only', 'local')}</div>
    <p>Save the current draft revision and compare its fingerprint in the browser verifier. A preview leaves the draft editable and collection closed.</p>
    ${save}
    ${snapshots.map(({ version, digest }) => `<div>
      <a class="button button-outline" href="${studyLink(study)}/policy/${version}.json" download>Download revision ${version} ${icon('external')}</a>
      <pre><code data-policy-digest>${escape(digest)}</code></pre>
    </div>`).join('')}
    ${snapshots.length ? button('Open verifier', '/verify', 'outline', '') : ''}
  </section>`;
}

export function studyDetail(study, saved, csrf, job, snapshots) {
  const label = escape(study.title);
  return `${pageHeading(label, 'Bounded histogram · Annual compensation in INR lakh', study.sample ? '' : button('Edit draft', `${studyLink(study)}/edit`, 'outline', ''), 'STUDY DRAFT')}
    ${saved ? '<p class="form-success" role="status">Draft saved.</p>' : ''}
    <div class="split-grid">
      <section class="panel detail-panel"><div class="detail-title"><h2>Measurement schema</h2>${sampleLabel(study)}</div><p>One bounded category per eligible fictional participant.</p>
      <ul class="bins">${BINS.map((bin) => `<li>${escape(bin)}</li>`).join('')}</ul>
      ${definitionList([['Unit', 'Annual INR lakh'], ['Category rule', 'Lower bound inclusive, upper bound exclusive'], ['Measurement type', 'Fixed histogram']])}</section>
      <section class="panel policy-panel"><span class="stage-icon">${icon('shield')}</span><h2>Draft release policy</h2>
      ${definitionList([['Minimum batch', `${study.minimumBatch} eligible contributions`], ['Collection window', `${study.windowHours} hours`], ['Privacy parameters', 'ε = 1 · δ = 0'], ['Adjacency', TEMPLATE.adjacency]])}</section>
    </div>
    ${unavailable('Unavailable', 'Protected collection is closed', 'Anonymous membership and proof-bound admission are required before this study can accept contributions.')}
    ${fictionalFixture(study, csrf, job)}
    ${policyPreview(study, csrf, snapshots)}`;
}

const stages = [
  ['Browser', 'Prepare encrypted reports on the participant device.'],
  ['Admission', 'Verify membership and bind the proof to the report.'],
  ['Aggregators', 'Validate shares in separate runtimes and compute aggregate shares.'],
  ['Collector', 'Apply the fixed release policy and publish the approved manifest.'],
];

export function computePage() {
  return `${pageHeading('Compute', 'Inspect the path a protected report takes through BlindBench.')}
    ${unavailable('Unavailable', 'Aggregator workers unavailable', 'This workspace has no connected aggregation services. There are no live jobs or timing data.')}
    <section class="panel detail-panel"><h2>Data flow</h2><ol class="flow">${stages.map(([title, text], index) => `<li><span aria-hidden="true">${index + 1}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol>
    ${button('See protocol test instructions', '/docs#protocol-spike', 'outline')}</section>`;
}

export function privacyPage() {
  return `${pageHeading('Privacy', 'See how a single fictional contribution changes a bounded histogram.')}
    <div class="split-grid"><section class="panel detail-panel" data-example><div class="detail-title"><h2>Histogram sensitivity</h2>${pill('Illustrative data', 'purple')}</div>
      <p>Baseline fictional counts by compensation bin (annual INR lakh).</p>${histogram({ interactive: true })}
      <details class="chart-table"><summary>View histogram values</summary><table><thead><tr><th scope="col">INR lakh</th><th scope="col">Fictional count</th></tr></thead><tbody>
      ${EXAMPLE_RESULT.map((count, index) => `<tr><th scope="row">${escape(BINS[index])}</th><td${index === 3 ? ' data-example-cell' : ''}>${count}</td></tr>`).join('')}</tbody></table></details>
      <div class="inline-actions"><button class="button button-primary" type="button" aria-pressed="false" data-example-toggle>Add one fictional contribution</button></div>
      <p class="experiment-output" aria-live="polite" data-example-summary>Baseline cohort is displayed.</p>
    </section><section class="panel policy-panel"><span class="stage-icon">${icon('shield')}</span><h2>What ε measures</h2>
      <p>For this add-or-remove model, one participant changes one bin by one. That is the sensitivity of the histogram. The planned release mechanism uses this bound to calibrate noise.</p>
      ${definitionList([['Contribution bound', 'One bin'], ['L1 sensitivity', '1'], ['Target release', 'ε = 1 · δ = 0']])}
      <p class="policy-note">This example compares fictional histograms before noise. It demonstrates sensitivity only.</p></section></div>`;
}

export function ledgerPage(anchor = null) {
  return `${pageHeading('Ledger', 'Trace which policy and result digests have been anchored.')}
    ${anchor
    ? `<section class="panel detail-panel"><h2>Configured local contract</h2><p>Chain ID 31337</p><code>${escape(anchor.address)}</code></section>`
    : unavailable('Unconfigured', 'Local chain has no configured commitment contract', 'Use a fictional manifest to try the local fingerprinting step.')}
    <section class="panel detail-panel"><h2>Manifest verification</h2><p>Study policy and released results have separate commitments. With a deployed contract, a verifier compares a canonical digest against the expected on-chain commitment.</p>
    ${button('Open manifest verifier', '/verify', 'outline')}</section>`;
}

export function verifyPage(anchor = null) {
  return `${pageHeading('Verify manifest', 'Compute the SHA-256 fingerprint of a policy preview or public result manifest in this browser.')}
    <div class="split-grid"><div><form class="panel form-panel" data-verifier data-anchor="${escape(anchor ? JSON.stringify(anchor) : '')}" aria-label="Manifest verifier">
    <h2>Choose a manifest</h2><p>The file stays on this device.</p>
    <label for="manifest">Public manifest JSON</label><input id="manifest" type="file" required accept=".json,application/json" aria-describedby="manifest-limit"><small id="manifest-limit">JSON files up to 16 KiB</small>
    <div class="inline-actions form-actions"><button class="button button-primary" type="submit">${anchor ? 'Verify manifest' : 'Compute fingerprint'} ${icon('arrow')}</button></div>
    </form><section class="panel detail-panel verifier-result" data-verifier-output role="status" aria-live="polite" hidden>
    <h2 data-verifier-status></h2><p data-verifier-message></p><code data-verifier-digest hidden></code><button class="button button-outline" type="button" data-copy hidden>Copy digest</button><div data-verified-insights hidden>
    <h3>Histogram summary</h3><dl class="definition-list"></dl><p>Percentile bands use the displayed counts. Counts altered by privacy noise can shift those bands.</p></div></section></div>
    <section class="panel policy-panel"><span class="stage-icon">${icon('check')}</span><h2>Try a fictional manifest</h2><p>Use the sample to compute a fingerprint. Edit one bin in a copy and compare the two digests.</p>
    <a class="button button-outline" href="/examples/result-manifest.json" download>Download sample ${icon('external')}</a>
    <p class="policy-note">A fingerprint becomes evidence of integrity when it matches a trusted commitment. Chain verification requires a configured contract.</p></section></div>`;
}

export function insightsPage() {
  const facts = describeHistogram(EXAMPLE_RESULT).map(([label, value]) => [label, escape(value)]);
  return `${pageHeading('Histogram insights', 'Explore the summary generated from a fictional compensation histogram.')}
    <div class="split-grid"><section class="panel detail-panel"><h2>Fictional compensation bands</h2>
    ${histogram()}
    </section><section class="panel policy-panel"><h2>Histogram summary</h2>
    ${definitionList(facts)}
    <p class="policy-note">The summary is calculated locally from the seven displayed counts. Percentiles identify bands in this fictional example. Privacy noise in a release can shift those bands.</p>
    ${button('Verify a result manifest', '/verify', 'outline')}
    </section></div>`;
}

export function benchmarksPage() {
  return `${pageHeading('Benchmarks', 'Inspect measured workload and utility results when they are available.')}
    <section class="panel empty-state"><span class="stage-icon">${icon('chart')}</span><div><h2>No protocol runs recorded</h2><p>The benchmark suite needs real aggregation services to measure report size, throughput and release error.</p></div></section>`;
}

export function docsPage() {
  return `${pageHeading('Documentation', 'Follow the protocol, its trust boundaries, and the current workspace capabilities.')}
    <div class="split-grid"><section class="panel detail-panel"><h2>Protocol overview</h2><ol class="flow">${stages.map(([title, text], index) => `<li><span aria-hidden="true">${index + 1}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol></section>
    <section class="panel policy-panel"><span class="stage-icon">${icon('book')}</span><h2>Run locally</h2><p>Use Node 24.18 and start this workspace on loopback.</p><pre><code>npm ci --offline
npm test
npm run dev</code></pre><p>Drafts are stored in SQLite. The workspace supports local sensitivity examples and manifest fingerprints.</p></section></div>
    <section class="panel detail-panel" id="trust"><h2>Trust boundaries</h2>
    ${definitionList([['Browser', 'Participants trust the code delivered to their browsers.'],
    ['Aggregators', 'The privacy model assumes that the aggregators do not collude.'],
    ['Collector', 'The collector sees the exact aggregate transiently and enforces the release policy.'],
    ['Ledger', 'The commitment authenticates the released bytes. Correct computation also depends on the protocol services.'],
    ['Data', 'Only fictional studies and deliberately public example manifests belong in this workspace.']])}</section>
    <section class="panel detail-panel" id="protocol-spike"><h2>Test private aggregation locally</h2>
    <p>The test starts two Janus aggregators, a collector, and Chromium on an isolated Docker network. Chromium prepares reports for a fixed fictional batch. The test compares the collector’s result against the expected histogram.</p>
    <pre><code>npm run test:protocol</code></pre>
    <p>Requires Docker Compose with Linux containers and access to the image and npm registries. Test results stay in the command output.</p></section>`;
}

export function errorPage(title, message) {
  return `${pageHeading(title, message)}${button('Back to workspace', '/overview', 'outline')}`;
}
