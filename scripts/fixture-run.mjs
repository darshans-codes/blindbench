import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openStudies } from '../src/db.mjs';
import { nativePeers } from '../infra/protocol/native-peers.mjs';

const id = process.argv[2];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;

function run() {
  if (process.argv.length !== 3 || !uuid.test(id ?? '')) {
    console.error('Usage: npm run fixture:run -- <fixture-job-id>');
    return 1;
  }
  const native = process.env.BLINDBENCH_NATIVE_PORTS !== undefined;
  if (native) {
    try {
      nativePeers(process.env.BLINDBENCH_NATIVE_PORTS);
    } catch (error) {
      console.error(error.message);
      return 1;
    }
    const directory = new URL('../.local/native-probe/', import.meta.url);
    if (['divviup.js', 'sdk-package.json', 'node_modules/playwright/package.json']
      .some((file) => !existsSync(new URL(file, directory)))) {
      console.error('Install the pinned native probe dependencies before claiming this job.');
      return 1;
    }
  } else {
    const engine = spawnSync('docker', ['info', '--format', '{{.OSType}}'], { encoding: 'utf8', timeout: 15_000 });
    if (engine.status !== 0 || engine.stdout.trim() !== 'linux') {
      console.error('Choose a reachable Linux Docker engine or a native Janus fixture. The queued fixture has not been claimed.');
      return 1;
    }
  }
  const store = openStudies(process.env.BLINDBENCH_DB ?? '.local/blindbench.sqlite');
  try {
    const job = store.fixtures.claim(id);
    if (!job) {
      console.error('This fixture job does not exist, is already running or passed, or used both attempts.');
      return 1;
    }
    const script = native
      ? [fileURLToPath(new URL('../infra/protocol/probe.mjs', import.meta.url)), '--native']
      : [fileURLToPath(new URL('./protocol-spike.mjs', import.meta.url))];
    const fixture = JSON.stringify({ minimumBatch: job.minimumBatch, windowHours: job.windowHours });
    const result = spawnSync(process.execPath, script, {
      stdio: 'inherit',
      timeout: 60 * 60_000,
      env: { ...process.env, BLINDBENCH_FIXTURE: fixture },
    });
    const passed = result.status === 0 && !result.error;
    if (!store.fixtures.finish(job.id, job.attempts, passed)) {
      console.error('The fixture lease expired before the worker could record the outcome.');
      return 1;
    }
    console.log(passed ? 'Fictional fixture passed. Refresh the study page for its receipt.' : 'Fictional fixture failed. Refresh the study page for its status.');
    return passed ? 0 : 1;
  } finally {
    store.close();
  }
}

try {
  process.exitCode = run();
} catch {
  console.error('The local worker could not read or write the fixture job store.');
  process.exitCode = 1;
}
