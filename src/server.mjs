import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openStudies } from './db.mjs';
import { home } from './home.mjs';
import { layout } from './layout.mjs';
import {
  benchmarksPage, computePage, docsPage, draftForm, errorPage, insightsPage, ledgerPage, overview,
  privacyPage, studiesPage, studyDetail, verifyPage,
} from './pages.mjs';
import { EXAMPLE_RESULT, validateDraft } from './studies.mjs';
import { readAnchorProfile } from '../public/chain-verifier.mjs';

const host = '127.0.0.1';
const uuid = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const pathStudy = new RegExp(`^/studies/(${uuid})(/edit|/fixture|/policy)?$`, 'u');
const pathPolicy = new RegExp(`^/studies/(${uuid})/policy/([1-9][0-9]{0,15})\\.json$`, 'u');
const assets = new Map([
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/mark.svg', ['mark.svg', 'image/svg+xml']],
  ['/workbench.mjs', ['workbench.mjs', 'text/javascript; charset=utf-8']],
  ['/manifest.mjs', ['manifest.mjs', 'text/javascript; charset=utf-8']],
  ['/chain-verifier.mjs', ['chain-verifier.mjs', 'text/javascript; charset=utf-8']],
  ['/release-insights.mjs', ['release-insights.mjs', 'text/javascript; charset=utf-8']],
].map(([path, [file, type]]) => [path, { type, bytes: readFileSync(new URL(`../public/${file}`, import.meta.url)) }]));
const stages = {
  '/compute': ['Compute', computePage],
  '/privacy': ['Privacy', privacyPage],
  '/insights': ['Histogram insights', insightsPage],
  '/benchmarks': ['Benchmarks', benchmarksPage],
  '/docs': ['Documentation', docsPage],
};

const sample = {
  schemaVersion: 1,
  studyId: '76d2d4df-5b51-47ab-a238-db547c64362a',
  releaseId: 'fc2caf85-c904-49fd-bffc-fe9e3113686c',
  policyHash: '0'.repeat(64),
  epsilon: 1,
  delta: 0,
  counts: EXAMPLE_RESULT,
};

function send(res, status, type, body, method) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(method === 'HEAD' ? undefined : body);
}

function json(res, status, value, method) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(value, null, 2), method);
}

function csrfMatches(expected, input) {
  return typeof input === 'string' && /^[a-f0-9]{64}$/u.test(input) &&
    timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input, 'hex'));
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (part) => {
      size += part.length;
      if (size <= 4096) parts.push(part);
      else reject(new Error('Form too large'));
    });
    req.once('error', reject);
    req.once('end', () => {
      if (size <= 4096) resolve(new URLSearchParams(Buffer.concat(parts).toString('utf8')));
    });
  });
}

export async function startWorkspace({ port = 3000, database = '.local/blindbench.sqlite', anchorProfile = null } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new RangeError('PORT must be an integer between 0 and 65535.');
  const anchor = anchorProfile ? readAnchorProfile(anchorProfile) : null;
  const studies = openStudies(database);
  const csrf = randomBytes(32).toString('hex');
  let writes = 0;
  let resetAt = Date.now() + 60_000;

  const server = createServer({ requestTimeout: 10_000, headersTimeout: 8_000 }, (req, res) => {
    route(req, res).catch(() => {
      if (!res.headersSent) json(res, 500, { code: 'INTERNAL_ERROR' }, req.method);
      else res.destroy();
    });
  });

  async function route(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const authority = `${host}:${server.address().port}`;
    if (req.headers.host !== authority && req.headers.host !== `localhost:${server.address().port}`) {
      return json(res, 421, { code: 'LOCAL_HOST_REQUIRED' }, req.method);
    }
    if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) {
      return json(res, 400, { code: 'INVALID_PATH' }, req.method);
    }
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD, POST');
      return json(res, 405, { code: 'METHOD_NOT_ALLOWED' }, req.method);
    }
    const url = new URL(req.url, `http://${authority}`);
    const { pathname } = url;
    const rpcOrigin = anchor && pathname === '/verify' && req.method !== 'POST' ? ` ${new URL(anchor.rpcUrl).origin}` : '';
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'${rpcOrigin}; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`);
    const html = (title, content, current = pathname, status = 200) =>
      send(res, status, 'text/html; charset=utf-8', layout(title, content, current), req.method);
    const missing = () => html('Page unavailable', errorPage('Page unavailable', 'This page or study could not be found.'), '', 404);

    if (req.method === 'POST') {
      const match = pathname.match(pathStudy);
      if (pathname !== '/studies/create' && !match?.[2]) {
        return json(res, 404, { code: 'UNKNOWN_MUTATION' }, req.method);
      }
      if (req.headers.origin !== `http://${req.headers.host}`) {
        return json(res, 403, { code: 'ORIGIN_DENIED' }, req.method);
      }
      if (Date.now() >= resetAt) {
        resetAt = Date.now() + 60_000;
        writes = 0;
      }
      if (++writes > 30) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
        return html('Try again shortly', errorPage('Try again shortly', 'The local workspace reached its write limit. Return to the form after the limit resets.'), '/studies', 429);
      }
      if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
        return json(res, 415, { code: 'FORM_ENCODING_REQUIRED' }, req.method);
      }
      let input;
      try {
        input = await readForm(req);
      } catch {
        return json(res, 413, { code: 'FORM_TOO_LARGE' }, req.method);
      }
      if (!csrfMatches(csrf, input.get('csrf'))) {
        return html('Form expired', errorPage('Form expired', 'Open the study form again to obtain a new session token.'), '/studies', 403);
      }
      const previous = match ? studies.get(match[1]) : undefined;
      if (match?.[2] === '/policy') {
        if (!previous) return missing();
        if (input.size !== 2 || input.get('version') !== String(previous.version) || !studies.policies.save(previous)) {
          return html('Policy preview unavailable', errorPage('Policy preview unavailable', 'Open the current study draft to save its policy preview.'), '/studies', 409);
        }
        res.writeHead(303, { Location: `/studies/${previous.id}#policy-preview` });
        return res.end();
      }
      if (match?.[2] === '/fixture') {
        if (!previous) return missing();
        const version = input.get('version');
        if (input.size !== 3 || input.get('fixture') !== 'fictional-v1' || version !== String(previous.version) ||
            !studies.fixtures.enqueue(previous.id, previous.version)) {
          return html('Fixture request unavailable', errorPage('Fixture request unavailable', 'Open the current study draft to queue its fictional fixture.'), '/studies', 409);
        }
        res.writeHead(303, { Location: `/studies/${previous.id}#fictional-fixture` });
        return res.end();
      }
      if (match && (!previous || previous.sample)) return missing();
      const { fields, errors, draft } = validateDraft(input);
      const title = previous ? 'Edit draft' : 'New study';
      if (Object.keys(errors).length) {
        return html(title, draftForm({ study: previous, csrf, fields, errors }), '/studies', 422);
      }
      const version = Number(input.get('version'));
      if (previous && (!Number.isSafeInteger(version) || version < 1 || !studies.update(previous.id, version, draft))) {
        return html(title, draftForm({ study: studies.get(previous.id), csrf, fields, conflict: true }), '/studies', 409);
      }
      const id = previous?.id ?? studies.create(draft);
      res.writeHead(303, { Location: `/studies/${id}?saved=1` });
      return res.end();
    }

    if (pathname === '/healthz') return json(res, 200, { status: 'ok' }, req.method);
    if (pathname === '/readyz') {
      studies.list();
      return json(res, 200, { status: 'ready', aggregation: 'unavailable', ledger: anchor ? 'configured' : 'unconfigured' }, req.method);
    }
    if (assets.has(pathname)) {
      const { type, bytes } = assets.get(pathname);
      return send(res, 200, type, bytes, req.method);
    }
    if (pathname === '/examples/result-manifest.json') {
      res.setHeader('Content-Disposition', 'attachment; filename="fictional-result-manifest.json"');
      return json(res, 200, sample, req.method);
    }
    if (pathname === '/') return send(res, 200, 'text/html; charset=utf-8', home(), req.method);
    if (pathname === '/overview') return html('Overview', overview(studies.list(), { ledgerConfigured: Boolean(anchor) }));
    if (pathname === '/studies') return html('Studies', studiesPage(studies.list()));
    if (pathname === '/studies/create') return html('New study', draftForm({ csrf }), '/studies');
    if (pathname === '/verify') return html('Verify manifest', verifyPage(anchor));
    if (pathname === '/ledger') return html('Ledger', ledgerPage(anchor));
    const requestedPolicy = pathname.match(pathPolicy);
    if (requestedPolicy) {
      const version = Number(requestedPolicy[2]);
      const policy = Number.isSafeInteger(version) ? studies.policies.find(requestedPolicy[1], version) : undefined;
      if (!policy) return missing();
      res.setHeader('Content-Disposition', `attachment; filename="study-policy-v${version}.json"`);
      return send(res, 200, 'application/json; charset=utf-8', policy.manifest, req.method);
    }
    if (Object.hasOwn(stages, pathname)) {
      const [title, view] = stages[pathname];
      return html(title, view());
    }
    const match = pathname.match(pathStudy);
    if (match) {
      const study = studies.get(match[1]);
      if (!study || (match[2] && (match[2] !== '/edit' || study.sample))) return missing();
      return match[2] ? html('Edit draft', draftForm({ study, csrf }), '/studies') :
        html(study.title, studyDetail(study, url.searchParams.get('saved') === '1', csrf,
          studies.fixtures.find(study.id, study.version), studies.policies.list(study.id)), '/studies');
    }
    return missing();
  }

  server.once('close', () => studies.close());
  server.listen(port, host);
  try {
    await once(server, 'listening');
  } catch (error) {
    studies.close();
    throw error;
  }
  return { url: `http://${host}:${server.address().port}`, close: () => new Promise((done) => server.close(done)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const anchorPath = process.env.BLINDBENCH_ANCHOR_PROFILE;
  const app = await startWorkspace({
    port: Number(process.env.PORT ?? 3000),
    database: process.env.BLINDBENCH_DB ?? '.local/blindbench.sqlite',
    anchorProfile: anchorPath ? JSON.parse(readFileSync(anchorPath, 'utf8')) : null,
  });
  console.log(`BlindBench workspace: ${app.url}`);
}
