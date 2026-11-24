import { createHash } from 'node:crypto';
import { policyPreviewBytes, readPolicyPreview } from '../public/manifest.mjs';

export const policySnapshotSchema = `
  CREATE TABLE study_policy_snapshots (
    study_id TEXT NOT NULL REFERENCES studies(id),
    study_version INTEGER NOT NULL CHECK (study_version >= 1),
    manifest TEXT NOT NULL,
    digest TEXT NOT NULL CHECK (length(digest) = 64),
    PRIMARY KEY (study_id, study_version)
  ) STRICT;
  CREATE TRIGGER study_policy_snapshots_immutable
    BEFORE UPDATE ON study_policy_snapshots
    BEGIN SELECT RAISE(ABORT, 'Policy snapshots are immutable'); END;
`;

export function policySnapshots(db) {
  const find = db.prepare('SELECT manifest, digest FROM study_policy_snapshots WHERE study_id = ? AND study_version = ?');
  const create = db.prepare(`
    INSERT INTO study_policy_snapshots (study_id, study_version, manifest, digest)
    SELECT id, version, ?, ? FROM studies WHERE id = ? AND version = ?
    ON CONFLICT (study_id, study_version) DO NOTHING
  `);
  const list = db.prepare('SELECT study_version AS version, digest FROM study_policy_snapshots WHERE study_id = ? ORDER BY study_version DESC');
  return {
    find: (id, version) => find.get(id, version),
    list: (id) => list.all(id),
    save(study) {
      const document = JSON.stringify({
        schemaVersion: 1,
        kind: 'study-policy-preview',
        studyId: study.id,
        studyVersion: study.version,
        measurement: 'compensation-inr-lakh-v1',
        protocol: 'dap-09',
        adjacency: 'add-remove',
        epsilon: 1,
        delta: 0,
        minimumBatch: study.minimumBatch,
        windowHours: study.windowHours,
      });
      const digest = createHash('sha256').update(policyPreviewBytes(readPolicyPreview(document))).digest('hex');
      create.run(document, digest, study.id, study.version);
      return find.get(study.id, study.version);
    },
  };
}
