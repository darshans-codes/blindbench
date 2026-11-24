import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openStudies } from '../src/db.mjs';

test('online draft backup opens as an independent workspace without overwriting prior backups', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bb-backup-test-'));
  const source = join(directory, 'source.sqlite');
  const output = join(directory, 'backup.sqlite');
  const workspace = openStudies(source);
  try {
    const id = workspace.create({ title: 'Fictional backup study', minimumBatch: 30, windowHours: 24 });
    const { digest } = workspace.policies.save(workspace.get(id));
    const invoke = () => spawnSync(process.execPath, ['scripts/backup.mjs', output], {
      encoding: 'utf8', env: { ...process.env, BLINDBENCH_DB: source },
    });
    const saved = invoke();
    assert.equal(saved.status, 0, saved.stderr);
    assert.equal(workspace.update(id, 1, { title: 'Edited after backup', minimumBatch: 30, windowHours: 24 }), true);
    const repeated = invoke();
    assert.equal(repeated.status, 1);
    assert.match(repeated.stderr, /already exists/u);
    const restored = openStudies(output);
    try {
      assert.equal(restored.get(id).title, 'Fictional backup study');
      assert.equal(restored.get(id).version, 1);
      assert.equal(restored.policies.find(id, 1).digest, digest);
    } finally {
      restored.close();
    }
  } finally {
    workspace.close();
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
