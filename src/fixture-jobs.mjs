import { randomUUID } from 'node:crypto';

const leaseMs = 65 * 60_000;
const maxAttempts = 2;

export const fixtureJobSchema = `
  CREATE TABLE fixture_jobs (
    id TEXT PRIMARY KEY,
    study_id TEXT NOT NULL REFERENCES studies(id),
    study_version INTEGER NOT NULL CHECK (study_version >= 1),
    minimum_batch INTEGER NOT NULL CHECK (minimum_batch BETWEEN 30 AND 500),
    window_hours INTEGER NOT NULL CHECK (window_hours BETWEEN 1 AND 168),
    state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'failed', 'passed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 2),
    lease_until INTEGER,
    UNIQUE (study_id, study_version),
    CHECK ((state = 'running') = (lease_until IS NOT NULL))
  ) STRICT;
`;

export function fixtureJobs(db) {
  const columns = `id, study_id AS studyId, study_version AS studyVersion,
    minimum_batch AS minimumBatch, window_hours AS windowHours, state, attempts, lease_until AS leaseUntil`;
  const find = db.prepare(`SELECT ${columns} FROM fixture_jobs WHERE study_id = ? AND study_version = ?`);
  const enqueue = db.prepare(`
    INSERT INTO fixture_jobs (id, study_id, study_version, minimum_batch, window_hours, state)
    SELECT ?, id, version, minimum_batch, window_hours, 'queued'
    FROM studies WHERE id = ? AND version = ?
    ON CONFLICT (study_id, study_version) DO NOTHING
  `);
  const expire = db.prepare(`UPDATE fixture_jobs SET state = 'failed', lease_until = NULL
    WHERE id = ? AND state = 'running' AND lease_until <= ? AND attempts = ?`);
  const claim = db.prepare(`UPDATE fixture_jobs SET state = 'running', attempts = attempts + 1, lease_until = ?
    WHERE id = ? AND attempts < ? AND (state IN ('failed', 'queued') OR (state = 'running' AND lease_until <= ?))
    RETURNING ${columns}`);
  const finish = db.prepare(`UPDATE fixture_jobs SET state = ?, lease_until = NULL
    WHERE id = ? AND state = 'running' AND attempts = ? AND lease_until > ?`);
  return {
    find(studyId, version, now = Date.now()) {
      const job = find.get(studyId, version);
      if (job?.state !== 'running' || job.leaseUntil > now) return job;
      return { ...job, state: 'failed', leaseUntil: null };
    },
    enqueue(studyId, version) {
      enqueue.run(randomUUID(), studyId, version);
      return find.get(studyId, version);
    },
    claim(id, now = Date.now()) {
      expire.run(id, now, maxAttempts);
      return claim.get(now + leaseMs, id, maxAttempts, now);
    },
    finish(id, attempt, passed, now = Date.now()) {
      return finish.run(passed ? 'passed' : 'failed', id, attempt, now).changes === 1;
    },
  };
}
