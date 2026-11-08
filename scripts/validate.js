// Kontrola konzistence herních dat: node scripts/validate.js
import { SPECIES } from '../shared/species.js';
import { MOVES, TMS } from '../shared/moves.js';
import { ABILITIES } from '../shared/abilities.js';
import { TYPES } from '../shared/types.js';
import { ITEMS } from '../shared/items.js';

const errors = [];
const err = (m) => errors.push(m);

const BODIES = new Set(['quad', 'biped', 'bird', 'fish', 'larva', 'blob', 'ghost', 'bug', 'golem', 'jelly', 'shroom', 'crab', 'wisp']);
const nos = new Set();
for (const [k, sp] of Object.entries(SPECIES)) {
  if (nos.has(sp.no)) err(`${k}: duplicitní číslo ${sp.no}`);
  nos.add(sp.no);
  if (!sp.n) err(`${k}: chybí jméno`);
  if (!Array.isArray(sp.bs) || sp.bs.length !== 6) err(`${k}: špatné staty`);
  for (const t of sp.ty) if (!TYPES[t]) err(`${k}: neznámý typ ${t}`);
  for (const a of sp.ab) if (!ABILITIES[a]) err(`${k}: neznámá schopnost ${a}`);
  for (const [lvl, mv] of sp.ls) {
    if (!MOVES[mv]) err(`${k}: neznámý útok ${mv}`);
    if (typeof lvl !== 'number' || lvl < 1 || lvl > 100) err(`${k}: špatná úroveň ${lvl}`);
  }
  if (!sp.ls.some(([l]) => l === 1)) err(`${k}: žádný útok na úrovni 1`);
  for (const e of sp.evo || []) if (!SPECIES[e.to]) err(`${k}: neznámý vývoj ${e.to}`);
  if (!['f', 'mf', 'ms', 's'].includes(sp.gr)) err(`${k}: neznámý růst ${sp.gr}`);
  if (!sp.art || !BODIES.has(sp.art.b)) err(`${k}: neznámé tělo ${sp.art && sp.art.b}`);
  if (!sp.d) err(`${k}: chybí popis`);
}
for (const [id, m] of Object.entries(MOVES)) {
  if (m.t && !TYPES[m.t]) err(`útok ${id}: neznámý typ ${m.t}`);
  if (!['P', 'S', 'X'].includes(m.c)) err(`útok ${id}: neznámá kategorie`);
}
for (const [tm, mv] of Object.entries(TMS)) if (!MOVES[mv]) err(`${tm}: neznámý útok ${mv}`);
for (const [id, it] of Object.entries(ITEMS)) if (!it.n || !it.cat) err(`předmět ${id}: chybí údaje`);

let mapsChecked = 0;
try {
  const maps = await import('../shared/maps/index.js');
  maps.validateMaps().forEach(err);
  reachability(maps).forEach(err);
  mapsChecked = Object.keys(maps.MAPS).length;
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') err('mapy: ' + e.stack);
}

// Prohledá svět do šířky od startu (s odemčenými podmínkami) a ověří,
// že je dosažitelná každá mapa, každé NPC, předmět, cedule i dveře.
function reachability({ MAPS, START, solidAt, warpAt, edgeTarget, npcVisible }) {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const ctx = { flags: { starter: 'jiskrik', soumrak_boss: true, champion: true }, badges: 6, trainers: {}, items: {} };
  const key = (m, x, y) => `${m}|${x}|${y}`;
  const blocked = (map, x, y) => solidAt(map, x, y) || map.npcs.some((n) => n.x === x && n.y === y && npcVisible(n, ctx));
  const seen = new Set([key(START.map, START.x, START.y)]);
  const q = [[START.map, START.x, START.y]];
  const push = (m, x, y) => { const k = key(m, x, y); if (!seen.has(k)) { seen.add(k); q.push([m, x, y]); } };
  while (q.length) {
    const [mid, x, y] = q.shift();
    const map = MAPS[mid];
    const sw = warpAt(map, x, y, null);
    if (sw) push(sw.to, sw.tx, sw.ty);
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const pw = warpAt(map, x, y, d);
      if (pw) push(pw.to, pw.tx, pw.ty);
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) {
        const tg = edgeTarget(map, x, y, d);
        if (tg && !blocked(tg.map, tg.x, tg.y)) push(tg.map.id, tg.x, tg.y);
      } else if (map.rows[ny][nx] === '^') {
        if (d === 'down' && ny + 1 < map.h && !blocked(map, nx, ny + 1)) push(mid, nx, ny + 1);
      } else if (!blocked(map, nx, ny)) push(mid, nx, ny);
    }
  }
  const out = [];
  const reached = new Set([...seen].map((k) => k.split('|')[0]));
  for (const id of Object.keys(MAPS)) if (!reached.has(id)) out.push(`dosažitelnost: mapa ${id} není dosažitelná`);
  for (const map of Object.values(MAPS)) {
    const objs = [...map.npcs, ...map.items, ...map.legends, ...map.signs.map((g, i) => ({ ...g, id: 'cedule' + i }))];
    for (const o of objs) {
      const ok = Object.values(DIRS).some(([dx, dy]) => seen.has(key(map.id, o.x + dx, o.y + dy))
        || (map.rows[o.y + dy] && map.rows[o.y + dy][o.x + dx] === 'k' && seen.has(key(map.id, o.x + 2 * dx, o.y + 2 * dy))));
      if (!ok) out.push(`dosažitelnost: ${map.id}/${o.id} (${o.x},${o.y}) nelze oslovit`);
    }
    for (const b of map.buildings) {
      if ((b.to || b.open) && !seen.has(key(map.id, b.x + b.door, b.y + b.h))) out.push(`dosažitelnost: ${map.id} – ke dveřím ${b.to || b.style} se nedá dojít`);
    }
  }
  return out;
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} chyb.`);
  process.exit(1);
}
console.log(`OK – ${Object.keys(SPECIES).length} tvorů, ${Object.keys(MOVES).length} útoků, ${Object.keys(ITEMS).length} předmětů, ${mapsChecked} map.`);
