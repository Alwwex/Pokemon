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
  const { MAPS, validateMaps } = await import('../shared/maps/index.js');
  const mapErrors = validateMaps();
  mapErrors.forEach(err);
  mapsChecked = Object.keys(MAPS).length;
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') err('mapy: ' + e.stack);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} chyb.`);
  process.exit(1);
}
console.log(`OK – ${Object.keys(SPECIES).length} tvorů, ${Object.keys(MOVES).length} útoků, ${Object.keys(ITEMS).length} předmětů, ${mapsChecked} map.`);
