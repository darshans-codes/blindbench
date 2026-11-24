import { link, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

async function saveBackup(sourcePath, outputPath) {
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  let directory;
  try {
    const target = resolve(outputPath);
    directory = await mkdtemp(join(dirname(target), '.blindbench-backup-'));
    const candidate = join(directory, 'drafts.sqlite');
    await backup(source, candidate);
    const copy = new DatabaseSync(candidate, { readOnly: true });
    try {
      if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') {
        throw new Error('The backup failed its integrity check.');
      }
      copy.prepare('SELECT id FROM studies LIMIT 1').get();
    } finally {
      copy.close();
    }
    await link(candidate, target);
  } finally {
    source.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

try {
  if (process.argv.length !== 3) throw new Error('Usage: npm run backup -- <new-backup.sqlite>');
  await saveBackup(process.env.BLINDBENCH_DB ?? '.local/blindbench.sqlite', process.argv[2]);
  console.log('Verified SQLite backup saved.');
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'Choose a new backup path. The destination already exists.' : error.message);
  process.exitCode = 1;
}
