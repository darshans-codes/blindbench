import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const compose = fileURLToPath(new URL('../infra/protocol/compose.yml', import.meta.url));
const project = `blindbench-protocol-${randomBytes(5).toString('hex')}`;
const args = ['compose', '--project-name', project, '--file', compose];
const docker = (command, timeout, capture = false) => spawnSync('docker', command, {
  stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  encoding: 'utf8',
  timeout,
});

function requireSuccess(result, label, timeoutMessage = `${label} timed out.`) {
  if (result.error?.code === 'ETIMEDOUT') throw new Error(timeoutMessage);
  if (result.status !== 0) throw new Error(`${label} failed.`);
  return result.stdout?.trim();
}

const version = docker(['compose', 'version'], 10_000);
if (version.status !== 0) {
  console.error('BLOCKED: Docker Compose is required to run the isolated DAP spike.');
  process.exitCode = 1;
} else if (docker(['info', '--format', '{{.OSType}}'], 15_000, true).stdout?.trim() !== 'linux') {
  console.error('BLOCKED: Docker Desktop must be running with a reachable Linux engine.');
  process.exitCode = 1;
} else if (docker([...args, 'config', '--quiet'], 15_000).status !== 0) {
  console.error('FAILED: the spike topology did not pass Docker Compose validation.');
  process.exitCode = 1;
} else {
  try {
    console.log(`Building probe for ${project} (first build can take several minutes).`);
    requireSuccess(docker([...args, 'build', 'probe'], 1_800_000), 'Probe image build', 'Probe image build exceeded 30 minutes.');
    requireSuccess(docker([...args, 'up', '--detach', '--no-build'], 1_200_000), 'Service startup');
    const probe = requireSuccess(docker([...args, 'ps', '--all', '--quiet', 'probe'], 15_000, true), 'Probe lookup');
    if (!/^[a-f0-9]{12,64}$/u.test(probe ?? '')) throw new Error('Expected one probe container.');

    console.log('Waiting for the browser and collector checks.');
    const wait = docker(['container', 'wait', probe], 300_000, true);
    const logs = docker([...args, 'logs', '--no-color', 'probe'], 30_000);
    const status = requireSuccess(wait, 'Probe wait', 'The probe did not exit within five minutes.');
    if (!/^\d{1,3}$/u.test(status ?? '') || Number(status) > 255) throw new Error('Docker did not return a valid probe exit code.');
    console.log(`Probe exited with code ${status}.`);
    requireSuccess(logs, 'Probe log retrieval');
    if (status === '0') {
      const images = requireSuccess(docker([...args, 'config', '--images', 'leader', 'helper', 'collector'], 15_000, true), 'Janus image lookup');
      const refs = [...new Set((images ?? '').split(/\r?\n/u).filter(Boolean))];
      if (refs.length !== 2 || refs.some((ref) => !ref.startsWith('us-west2-docker.pkg.dev/divviup-artifacts-public/janus/'))) {
        throw new Error('Expected the pinned Janus aggregator and collector images.');
      }
      console.log('Janus image digests:');
      requireSuccess(docker(['image', 'inspect', '--format', '{{range .RepoDigests}}{{println .}}{{end}}', ...refs], 15_000), 'Janus image inspection');
    }
    process.exitCode = Number(status);
  } catch (error) {
    console.error(`FAILED: ${error.message}`);
    process.exitCode = 1;
  } finally {
    console.log(`Cleaning up ${project}.`);
    if (docker([...args, 'down', '--volumes'], 90_000).status !== 0) {
      console.error(`Cleanup incomplete for disposable Docker project ${project}.`);
      process.exitCode = 1;
    }
  }
}
