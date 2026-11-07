// Výpočty statů, zkušeností a povah – sdílené serverem i klientem.
import { SPECIES } from './species.js';

export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_NAMES = { hp: 'HP', atk: 'Útok', def: 'Obrana', spa: 'Sp. útok', spd: 'Sp. obrana', spe: 'Rychlost' };

// Povahy: [název, zvýšený stat, snížený stat]
const NAT_STATS = ['atk', 'def', 'spa', 'spd', 'spe'];
const NAT_NAMES = [
  ['Tvrdý', 'Osamělý', 'Neústupný', 'Zlobivý', 'Statečný'],
  ['Smělý', 'Poslušný', 'Hravý', 'Laxní', 'Uvolněný'],
  ['Skromný', 'Mírný', 'Plachý', 'Zbrklý', 'Tichý'],
  ['Klidný', 'Jemný', 'Opatrný', 'Vrtošivý', 'Hrdý'],
  ['Bázlivý', 'Spěchavý', 'Veselý', 'Naivní', 'Vážný'],
];
export const NATURES = {};
NAT_STATS.forEach((up, i) => NAT_STATS.forEach((down, j) => {
  const name = NAT_NAMES[i][j];
  const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  NATURES[key] = { n: name, up: i === j ? null : up, down: i === j ? null : down };
}));
export const NATURE_KEYS = Object.keys(NATURES);

export function natureMult(nature, stat) {
  const n = NATURES[nature];
  if (!n) return 1;
  if (n.up === stat) return 1.1;
  if (n.down === stat) return 0.9;
  return 1;
}

export function calcStats(mon) {
  const sp = SPECIES[mon.s];
  const out = {};
  for (let i = 0; i < 6; i++) {
    const st = STATS[i];
    const base = sp.bs[i];
    const iv = mon.iv ? mon.iv[st] : 15;
    const ev = mon.ev ? mon.ev[st] : 0;
    const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * mon.lvl) / 100);
    if (st === 'hp') out.hp = core + mon.lvl + 10;
    else out[st] = Math.floor((core + 5) * natureMult(mon.nature, st));
  }
  return out;
}

// Křivky růstu
export function expForLevel(growth, n) {
  if (n <= 1) return 0;
  switch (growth) {
    case 'f': return Math.floor((4 * n ** 3) / 5);
    case 'mf': return n ** 3;
    case 'ms': return Math.max(0, Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140));
    case 's': return Math.floor((5 * n ** 3) / 4);
    default: return n ** 3;
  }
}

export function levelFromExp(growth, exp) {
  let l = 1;
  while (l < 100 && expForLevel(growth, l + 1) <= exp) l++;
  return l;
}

export function stageMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

export function accStageMult(stage) {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

export function monName(mon) {
  return mon.nick || (SPECIES[mon.s] ? SPECIES[mon.s].n : '???');
}

export function expProgress(mon) {
  const sp = SPECIES[mon.s];
  const cur = expForLevel(sp.gr, mon.lvl);
  const next = expForLevel(sp.gr, mon.lvl + 1);
  if (mon.lvl >= 100) return { cur: 0, need: 0, frac: 1 };
  return { cur: mon.exp - cur, need: next - cur, frac: Math.max(0, Math.min(1, (mon.exp - cur) / (next - cur))) };
}
