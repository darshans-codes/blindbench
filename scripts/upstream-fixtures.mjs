import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const options = { stdio: 'inherit', timeout: 20 * 60_000 };
const engine = spawnSync('docker', ['info', '--format', '{{.OSType}}'], { encoding: 'utf8', timeout: 15_000 });
if (engine.status !== 0 || engine.stdout.trim() !== 'linux') {
  console.error('BLOCKED: a reachable Linux Docker engine is required for the upstream vectors.');
  process.exitCode = 1;
} else {
  const name = `blindbench-upstream-${randomBytes(5).toString('hex')}`;
  const run = spawnSync('docker', [
    'run', '--rm', '--name', name, '--entrypoint', '/bin/sh', 'rust:1.95.0-bookworm', '-ec',
    `git -c advice.detachedHead=false clone --depth 1 --branch 0.16.8 https://github.com/divviup/libprio-rs.git /tmp/libprio
cd /tmp/libprio
test "$(git rev-parse HEAD)" = fff80d421196dd9ac9cef970cd8a0b5f64341a64
rustc --version
test_name=vdaf::prio3_test::tests::test_vec_prio3_histogram
output=$(mktemp)
if ! cargo test --locked -p prio --lib "$test_name" -- --exact > "$output" 2>&1; then
  cat "$output"
  exit 1
fi
cat "$output"
grep -Fq "test $test_name ... ok" "$output"`,
  ], options);
  if (run.error?.code === 'ETIMEDOUT') {
    console.error(`Upstream vectors timed out. Removing disposable container ${name}.`);
    spawnSync('docker', ['rm', '-f', name], { stdio: 'inherit', timeout: 30_000 });
  }
  process.exitCode = run.error ? 1 : (run.status ?? 1);
}
