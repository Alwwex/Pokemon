// Registr map regionu Velhora + pomocné funkce pro kolize a podmínky (server i klient).
import { TILES, DIRS } from '../tiles.js';
import { SPECIES } from '../species.js';
import { ITEMS } from '../items.js';
import { MOVES } from '../moves.js';
import AREA1 from './area1.js';
import AREA2 from './area2.js';
import AREA3 from './area3.js';

export const MAPS = {};

const BUILDING_SIZES = { home: [5, 4], house: [5, 4], center: [6, 4], gym: [8, 5], lab: [7, 4], mill: [5, 5], castle: [9, 6], cave: [3, 2], tower: [4, 6] };

function addMap(def) {
  if (MAPS[def.id]) throw new Error('Duplicitní mapa ' + def.id);
  const w = Math.max(...def.rows.map((r) => r.length));
  const rows = def.rows.map((r) => r.padEnd(w, def.fill || 'T'));
  const map = {
    theme: 'route',
    music: 'route',
    bg: 'grass',
    edges: {},
    buildings: [],
    warps: [],
    npcs: [],
    signs: [],
    items: [],
    legends: [],
    enc: null,
    ...def,
    rows,
    w,
    h: rows.length,
  };
  for (const b of map.buildings) {
    const size = BUILDING_SIZES[b.style] || [5, 4];
    b.w = b.w || size[0];
    b.h = b.h || size[1];
    if (b.door == null) b.door = Math.floor(b.w / 2);
  }
  MAPS[map.id] = map;
  return map;
}

function linkBuildings() {
  for (const map of Object.values(MAPS)) {
    for (const b of map.buildings) {
      if (!b.to) continue;
      const inner = MAPS[b.to];
      if (!inner) throw new Error(`Budova v ${map.id} vede do neznámé mapy ${b.to}`);
      const dx = b.x + b.door;
      const dy = b.y + b.h - 1;
      const mat = inner.mat || { x: Math.floor(inner.w / 2), y: inner.h - 1 };
      map.warps.push({ x: dx, y: dy, to: inner.id, tx: mat.x, ty: mat.y, face: 'up', door: true });
      inner.warps.push({ x: mat.x, y: mat.y, dir: 'down', to: map.id, tx: dx, ty: dy + 1, face: 'down' });
      inner.parent = map.id;
      if (!inner.region) inner.region = map.region || map.id;
    }
  }
}

function buildSolid(map) {
  const solid = new Uint8Array(map.w * map.h);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const t = TILES[map.rows[y][x]];
      if (!t || !t.walk) solid[y * map.w + x] = 1;
    }
  }
  for (const b of map.buildings) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (x === b.x + b.door && y === b.y + b.h - 1 && (b.to || b.open)) continue;
        if (x >= 0 && y >= 0 && x < map.w && y < map.h) solid[y * map.w + x] = 1;
      }
    }
  }
  for (const s of map.signs) solid[s.y * map.w + s.x] = 1;
  if (map.pc) solid[map.pc.y * map.w + map.pc.x] = 1;
  map.solid = solid;
}

for (const area of [AREA1, AREA2, AREA3]) for (const def of area) addMap(def);
linkBuildings();
for (const m of Object.values(MAPS)) buildSolid(m);

export const START = { map: 'liskova_domov', x: 5, y: 4, dir: 'down' };

// ---------- podmínky viditelnosti (NPC, předměty) ----------
// ctx = { flags: {}, badges: number, trainers: {}, items: {} }
export function condOk(c, ctx) {
  if (!c) return true;
  if (c.flag && !ctx.flags[c.flag]) return false;
  if (c.nflag && ctx.flags[c.nflag]) return false;
  if (c.badges != null && ctx.badges < c.badges) return false;
  if (c.nbadges != null && ctx.badges >= c.nbadges) return false;
  return true;
}

export function npcVisible(npc, ctx) {
  return condOk(npc.cond, ctx);
}

export function itemVisible(it, ctx) {
  return !ctx.items[it.id] && condOk(it.cond, ctx);
}

export function legendVisible(lg, ctx) {
  return !ctx.flags[lg.id] && condOk(lg.cond, ctx);
}

export function solidAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  return map.solid[y * map.w + x] === 1;
}

// Objekt (NPC / předmět / legenda), který blokuje dlaždici pro daného hráče.
export function objectAt(map, x, y, ctx) {
  for (const n of map.npcs) if (n.x === x && n.y === y && npcVisible(n, ctx)) return { kind: 'npc', obj: n };
  for (const it of map.items) if (it.x === x && it.y === y && itemVisible(it, ctx)) return { kind: 'item', obj: it };
  for (const lg of map.legends) if (lg.x === x && lg.y === y && legendVisible(lg, ctx)) return { kind: 'legend', obj: lg };
  return null;
}

export function passable(map, x, y, ctx) {
  if (solidAt(map, x, y)) return false;
  return !objectAt(map, x, y, ctx);
}

export function warpAt(map, x, y, dir) {
  for (const w of map.warps) {
    const ww = w.w || 1;
    const hh = w.h || 1;
    if (x >= w.x && x < w.x + ww && y >= w.y && y < w.y + hh) {
      if (w.dir ? w.dir === dir : !dir) return w;
    }
  }
  return null;
}

export function encounterTile(map, x, y) {
  const ch = map.rows[y] && map.rows[y][x];
  if (!map.enc) return false;
  if (ch === ',') return true;
  return !!(map.enc.everywhere && TILES[ch] && TILES[ch].walk);
}

// Kam vede přechod přes okraj mapy.
export function edgeTarget(map, x, y, dir) {
  const e = map.edges[dir];
  if (!e) return null;
  const t = MAPS[e.to];
  if (!t) return null;
  const off = e.off || 0;
  let tx;
  let ty;
  if (dir === 'up') { tx = x + off; ty = t.h - 1; }
  else if (dir === 'down') { tx = x + off; ty = 0; }
  else if (dir === 'left') { tx = t.w - 1; ty = y + off; }
  else { tx = 0; ty = y + off; }
  return { map: t, x: tx, y: ty, need: e.need };
}

export function frontOf(x, y, dir) {
  const d = DIRS[dir];
  return { x: x + d.dx, y: y + d.dy };
}

// ---------- validace ----------
export function validateMaps() {
  const errs = [];
  const ids = new Set();
  const ctx0 = { flags: {}, badges: 0, trainers: {}, items: {} };
  for (const map of Object.values(MAPS)) {
    map.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (!TILES[r[x]]) errs.push(`${map.id}: neznámá dlaždice '${r[x]}' na ${x},${y}`);
    });
    const all = [...map.npcs, ...map.items, ...map.legends];
    for (const o of all) {
      if (!o.id) { errs.push(`${map.id}: objekt bez id na ${o.x},${o.y}`); continue; }
      if (ids.has(o.id)) errs.push(`${map.id}: duplicitní id ${o.id}`);
      ids.add(o.id);
      if (solidAt(map, o.x, o.y) && !(map.rows[o.y] && 'kpn'.includes(map.rows[o.y][o.x]))) errs.push(`${map.id}: objekt ${o.id} stojí na neprůchozím poli ${o.x},${o.y}`);
    }
    for (const n of map.npcs) {
      if (n.trainer) {
        for (const [s, l, mv] of n.trainer.team || []) {
          if (!SPECIES[s]) errs.push(`${map.id}/${n.id}: neznámý tvor ${s}`);
          if (!(l >= 1 && l <= 100)) errs.push(`${map.id}/${n.id}: špatná úroveň`);
          for (const m of mv || []) if (!MOVES[m]) errs.push(`${map.id}/${n.id}: neznámý útok ${m}`);
        }
      }
      if (n.give && !ITEMS[n.give.item]) errs.push(`${map.id}/${n.id}: neznámý dárek ${n.give.item}`);
    }
    for (const it of map.items) if (!ITEMS[it.item]) errs.push(`${map.id}/${it.id}: neznámý předmět ${it.item}`);
    for (const lg of map.legends) if (!SPECIES[lg.s]) errs.push(`${map.id}/${lg.id}: neznámý tvor ${lg.s}`);
    if (map.enc) for (const e of map.enc.list) if (!SPECIES[e.s]) errs.push(`${map.id}: neznámý tvor v trávě ${e.s}`);
    for (const w of map.warps) {
      const t = MAPS[w.to];
      if (!t) { errs.push(`${map.id}: warp do neznámé mapy ${w.to}`); continue; }
      if (solidAt(t, w.tx, w.ty) && !t.buildings.some((b) => b.x + b.door === w.tx && b.y + b.h - 1 === w.ty)) errs.push(`${map.id}: warp do ${w.to} míří na zeď ${w.tx},${w.ty}`);
      if (objectAt(t, w.tx, w.ty, ctx0)) errs.push(`${map.id}: warp do ${w.to} míří na objekt ${w.tx},${w.ty}`);
    }
    for (const [dir, e] of Object.entries(map.edges)) {
      if (!MAPS[e.to]) { errs.push(`${map.id}: okraj ${dir} do neznámé mapy ${e.to}`); continue; }
      const t = MAPS[e.to];
      const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[dir];
      if (!t.edges[back] || t.edges[back].to !== map.id) errs.push(`${map.id}: okraj ${dir} → ${e.to} nemá zpáteční cestu`);
      // každé průchozí okrajové pole musí vést na průchozí pole sousední mapy
      const cells = [];
      if (dir === 'up') for (let x = 0; x < map.w; x++) cells.push([x, 0]);
      if (dir === 'down') for (let x = 0; x < map.w; x++) cells.push([x, map.h - 1]);
      if (dir === 'left') for (let y = 0; y < map.h; y++) cells.push([0, y]);
      if (dir === 'right') for (let y = 0; y < map.h; y++) cells.push([map.w - 1, y]);
      for (const [x, y] of cells) {
        if (solidAt(map, x, y)) continue;
        const tg = edgeTarget(map, x, y, dir);
        if (!tg || solidAt(tg.map, tg.x, tg.y)) errs.push(`${map.id}: okraj ${dir} z ${x},${y} vede do zdi v ${e.to} (${tg && tg.x},${tg && tg.y})`);
      }
    }
  }
  return errs;
}
