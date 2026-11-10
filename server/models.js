// Vlastní 3D modely tvorů: public/models/<druh>.glb a volitelné nastavení <druh>.json.
import fs from 'node:fs';
import path from 'node:path';

// Nastavení modelu – propustí jen známé klíče a rozumné hodnoty.
export function sanitizeModelConfig(raw) {
  const cfg = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return cfg;
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
  const str = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : undefined);
  const set = (k, v) => { if (v !== undefined) cfg[k] = v; };
  set('rotateY', num(raw.rotateY, -360, 360));
  set('scale', num(raw.scale, 0.1, 5));
  set('lift', num(raw.lift, -2, 2));
  if (raw.toon === true || raw.toon === false || raw.toon === 'auto') cfg.toon = raw.toon;
  if (typeof raw.outline === 'boolean') cfg.outline = raw.outline;
  for (const k of ['idle', 'walk', 'attack', 'head']) set(k, str(raw[k]));
  set('hatScale', num(raw.hatScale, 0.2, 5));
  if (Array.isArray(raw.hatOffset) && raw.hatOffset.length === 3 && raw.hatOffset.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    cfg.hatOffset = raw.hatOffset.map((v) => Math.max(-3, Math.min(3, v)));
  }
  if (Array.isArray(raw.hide)) {
    const hide = raw.hide.filter((x) => typeof x === 'string' && x.length > 0 && x.length <= 64).slice(0, 64);
    if (hide.length) cfg.hide = hide;
  }
  return cfg;
}

// { druh: nastavení } pro všechny .glb ve složce (bez složky prázdný objekt)
export function listModels(dir) {
  const out = {};
  let files;
  try { files = fs.readdirSync(dir); } catch { return out; }
  for (const f of files) {
    if (!/^[a-z0-9_]+\.glb$/.test(f)) continue;
    const key = f.slice(0, -4);
    let cfg = {};
    if (files.includes(key + '.json')) {
      try { cfg = sanitizeModelConfig(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))); } catch (e) {
        console.warn(`Nastavení modelu ${key}.json nejde přečíst: ${e.message}`);
      }
    }
    out[key] = cfg;
  }
  return out;
}
