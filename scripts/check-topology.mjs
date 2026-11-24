import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../infra/protocol/compose.yml', import.meta.url));
const bootstrap = fileURLToPath(new URL('../infra/protocol/isolate-janus.sh', import.meta.url));
const resolved = spawnSync('docker', ['compose', '-f', path, 'config', '--format', 'json'], {
  encoding: 'utf8',
  timeout: 15_000,
});
if (resolved.error || resolved.status !== 0) {
  console.error('Docker Compose could not resolve the fictional fixture topology.');
  process.exit(1);
}

try {
  const { networks, services } = JSON.parse(resolved.stdout);
  assert.deepEqual(Object.keys(services).sort(), ['collector', 'helper', 'leader', 'probe']);
  assert.deepEqual(Object.keys(networks), ['protocol']);
  assert.equal(networks.protocol.internal, true);
  for (const [role, service] of Object.entries(services)) {
    assert.deepEqual(Object.keys(service.networks), ['protocol'], role);
    assert.ok(!service.ports?.length && !service.privileged && !service.network_mode, role);
    assert.ok(!service.volumes_from?.length && !service.cap_add?.length && !service.devices?.length, role);
    assert.deepEqual(Object.keys(service.environment ?? {}), role === 'probe' ? ['BLINDBENCH_FIXTURE'] : [], role);
    const mounts = service.volumes ?? [];
    const aggregator = role === 'leader' || role === 'helper';
    assert.equal(mounts.length, aggregator ? 1 : 0, role);
    if (aggregator) {
      assert.equal(mounts[0].type, 'bind', role);
      assert.equal(mounts[0].read_only, true, role);
      assert.equal(resolve(mounts[0].source), bootstrap, role);
      assert.equal(mounts[0].target, '/opt/blindbench/isolate-janus.sh', role);
    }
  }
  assert.equal(services.probe.user, 'pwuser');
  console.log('Compose topology passed: private network, no published ports, read-only aggregator bootstrap, unprivileged probe.');
} catch (error) {
  console.error('Fictional fixture topology check failed:', error.message);
  process.exitCode = 1;
}
