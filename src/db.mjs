import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { TEMPLATE } from './studies.mjs';
import { fixtureJobs, fixtureJobSchema } from './fixture-jobs.mjs';
import { policySnapshots, policySnapshotSchema } from './policy-snapshots.mjs';

const SAMPLE_ID = '76d2d4df-5b51-47ab-a238-db547c64362a';

export function openStudies(filename) {
  const location = filename === ':memory:' ? filename : resolve(filename);
  if (location !== ':memory:') mkdirSync(dirname(location), { recursive: true });
  const db = new DatabaseSync(location);
  try {
    db.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
    const revision = db.prepare('PRAGMA user_version').get().user_version;
    if (revision > 3) throw new Error('This BlindBench database needs a newer runtime.');
    if (revision === 0) {
      db.exec(`
        CREATE TABLE studies (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 80),
          minimum_batch INTEGER NOT NULL CHECK (minimum_batch BETWEEN 30 AND 500),
          window_hours INTEGER NOT NULL CHECK (window_hours BETWEEN 1 AND 168),
          sample INTEGER NOT NULL CHECK (sample IN (0, 1)),
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
        ) STRICT;
        PRAGMA user_version = 1;
      `);
      db.prepare('INSERT INTO studies VALUES (?, ?, ?, ?, 1, ?, 1)').run(
        SAMPLE_ID, TEMPLATE.title, TEMPLATE.minimumBatch, TEMPLATE.windowHours, new Date().toISOString(),
      );
    }
    if (revision < 2) db.exec(fixtureJobSchema + 'PRAGMA user_version = 2;');
    if (revision < 3) db.exec(policySnapshotSchema + 'PRAGMA user_version = 3;');
    db.exec('COMMIT;');
  } catch (error) {
    db.close();
    throw error;
  }

  const columns = `id, title, minimum_batch AS minimumBatch, window_hours AS windowHours,
    sample, updated_at AS updatedAt, version`;
  const list = db.prepare(`SELECT ${columns} FROM studies ORDER BY updated_at DESC, id DESC`);
  const get = db.prepare(`SELECT ${columns} FROM studies WHERE id = ?`);
  const insert = db.prepare('INSERT INTO studies VALUES (?, ?, ?, ?, 0, ?, 1)');
  const update = db.prepare(`UPDATE studies SET title = ?, minimum_batch = ?, window_hours = ?,
    updated_at = ?, version = version + 1 WHERE id = ? AND sample = 0 AND version = ?`);

  return {
    fixtures: fixtureJobs(db),
    policies: policySnapshots(db),
    list: () => list.all(),
    get: (id) => get.get(id),
    create(draft) {
      const id = randomUUID();
      insert.run(id, draft.title, draft.minimumBatch, draft.windowHours, new Date().toISOString());
      return id;
    },
    update(id, version, draft) {
      return update.run(draft.title, draft.minimumBatch, draft.windowHours, new Date().toISOString(), id, version).changes === 1;
    },
    close: () => db.close(),
  };
}
