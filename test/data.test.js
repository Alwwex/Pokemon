import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('herní data a mapy jsou konzistentní a celý svět je dosažitelný', () => {
  const r = spawnSync(process.execPath, ['scripts/validate.js'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /OK – 82 tvorů/);
});
