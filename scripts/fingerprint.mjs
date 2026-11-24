import { open, readFile } from 'node:fs/promises';
import { inspectAnchor, readAnchorProfile } from '../public/chain-verifier.mjs';
import { fingerprintFile, MANIFEST_LIMIT } from '../public/manifest.mjs';

try {
  const [filename, flag, profilePath] = process.argv.slice(2);
  if (!filename || (flag !== undefined && (flag !== '--anchor' || !profilePath || process.argv.length !== 5))) {
    throw new Error('Usage: node scripts/fingerprint.mjs <manifest.json> [--anchor <profile.json>]');
  }
  const profile = profilePath ? readAnchorProfile(JSON.parse(await readFile(profilePath, 'utf8'))) : null;
  const file = await open(filename, 'r');
  try {
    const data = Buffer.alloc(MANIFEST_LIMIT + 1);
    const { bytesRead } = await file.read(data);
    if (bytesRead > MANIFEST_LIMIT) throw new Error('Choose a JSON manifest up to 16 KiB.');
    const result = await fingerprintFile(new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(0, bytesRead)));
    console.log(result.digest);
    if (profile) {
      const verification = await inspectAnchor(result, profile);
      console.log(verification.status, verification.block ?? '');
      if (verification.status !== 'MATCH') process.exitCode = 1;
    } else {
      console.log(result.kind === 'policy-preview' ? 'Local policy preview. No chain commitment.' : 'Chain verification unavailable. This command computes a file fingerprint.');
    }
  } finally {
    await file.close();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
