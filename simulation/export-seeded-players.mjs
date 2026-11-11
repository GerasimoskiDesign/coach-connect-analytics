// Writes simulation/seeded-players.json from the mock backend's seed data, so
// the simulation and the e2e tests log in with real seeded accounts. Re-run it
// whenever src/app/core/mock/mock-data.ts changes:
//
//   node simulation/export-seeded-players.mjs
//
// Only the email (synthetic, @players.example) and the skill level are exported.

import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'src', 'app', 'core', 'mock', 'mock-data.ts');

const out = mkdtempSync(join(tmpdir(), 'cc-seed-'));
try {
  const file = join(out, 'mock-data.mjs');
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: file, logLevel: 'error' });
  const { PLAYERS } = await import(pathToFileURL(file).href);
  const players = PLAYERS.map(p => ({ email: p.email, skillLevel: p.skillLevel }));
  writeFileSync(join(here, 'seeded-players.json'), JSON.stringify(players, null, 2) + '\n');
  console.log(`Wrote simulation/seeded-players.json (${players.length} players)`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
