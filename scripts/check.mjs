import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'public', 'scripts', 'test', 'infra', 'packages'];
const sources = roots.flatMap((root) => readdirSync(root, { recursive: true })
  .filter((file) => file.endsWith('.mjs')).map((file) => `${root}/${file}`));

for (const file of sources) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Checked ${sources.length} JavaScript modules.`);
