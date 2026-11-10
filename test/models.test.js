import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sanitizeModelConfig, listModels } from '../server/models.js';

test('nastavení vlastního modelu: jen známé klíče a rozumné hodnoty', () => {
  assert.deepEqual(sanitizeModelConfig(null), {});
  assert.deepEqual(sanitizeModelConfig([1, 2]), {});
  const cfg = sanitizeModelConfig({
    rotateY: 900, scale: 0.01, lift: 0.2, toon: 'auto', outline: false, idle: 'Idle', walk: 'x'.repeat(200),
    hide: ['Podstavec', 5, '', 'Pozadi'], evil: '<script>', __proto__: { polluted: true },
  });
  assert.equal(cfg.rotateY, 360);
  assert.equal(cfg.scale, 0.1);
  assert.equal(cfg.lift, 0.2);
  assert.equal(cfg.toon, 'auto');
  assert.equal(cfg.outline, false);
  assert.equal(cfg.idle, 'Idle');
  assert.equal(cfg.walk, undefined, 'příliš dlouhé jméno animace se zahodí');
  assert.deepEqual(cfg.hide, ['Podstavec', 'Pozadi']);
  assert.equal(cfg.evil, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(sanitizeModelConfig({ toon: 'ano' }).toon, undefined);
  const hat = sanitizeModelConfig({ head: 'mixamorigHead', hatScale: 9, hatOffset: [0, 0.1, -7] });
  assert.equal(hat.head, 'mixamorigHead');
  assert.equal(hat.hatScale, 5);
  assert.deepEqual(hat.hatOffset, [0, 0.1, -3]);
  assert.equal(sanitizeModelConfig({ hatOffset: [0, 'x', 1] }).hatOffset, undefined);
});

test('seznam modelů: .glb podle klíče druhu, nastavení z .json vedle', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monsterra-models-'));
  try {
    fs.writeFileSync(path.join(dir, 'jiskrik.glb'), 'x');
    fs.writeFileSync(path.join(dir, 'jiskrik.json'), JSON.stringify({ rotateY: 180, hide: ['Podstavec'] }));
    fs.writeFileSync(path.join(dir, 'hlodik.glb'), 'x');
    fs.writeFileSync(path.join(dir, 'hlodik.json'), '{ tohle není json');
    fs.writeFileSync(path.join(dir, 'Spatne Jmeno.glb'), 'x');
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'x');
    const list = listModels(dir);
    assert.deepEqual(Object.keys(list).sort(), ['hlodik', 'jiskrik']);
    assert.deepEqual(list.jiskrik, { rotateY: 180, hide: ['Podstavec'] });
    assert.deepEqual(list.hlodik, {}, 'rozbitý .json neshodí server, model se použije bez nastavení');
    assert.deepEqual(listModels(path.join(dir, 'neexistuje')), {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
