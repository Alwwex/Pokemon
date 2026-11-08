// Instance tvorů: tvorba, zkušenosti, učení útoků, vývoj.
import { SPECIES } from '../shared/species.js';
import { MOVES, UNIVERSAL_TM } from '../shared/moves.js';
import { calcStats, expForLevel, NATURE_KEYS, STATS } from '../shared/formulas.js';
import { randInt, pick, uid } from './util.js';

export const SHINY_CHANCE = 1 / 512;

export function defaultMoves(s, lvl) {
  const learned = [];
  for (const [l, m] of SPECIES[s].ls) {
    if (l > lvl) continue;
    const i = learned.indexOf(m);
    if (i >= 0) learned.splice(i, 1);
    learned.push(m);
  }
  return learned.slice(-4);
}

export function createMon(s, lvl, opts = {}) {
  const sp = SPECIES[s];
  if (!sp) throw new Error('Neznámý druh ' + s);
  lvl = Math.max(1, Math.min(100, lvl | 0));
  const iv = {};
  const ev = {};
  for (const st of STATS) {
    iv[st] = opts.ivMin != null ? randInt(opts.ivMin, 31) : randInt(0, 31);
    ev[st] = 0;
  }
  const mon = {
    uid: uid('m'),
    s,
    nick: null,
    lvl,
    exp: expForLevel(sp.gr, lvl),
    nature: opts.nature || pick(NATURE_KEYS),
    ability: opts.ability || pick(sp.ab),
    iv,
    ev,
    hp: 1,
    status: null,
    slp: 0,
    moves: [],
    shiny: opts.shiny != null ? !!opts.shiny : Math.random() < SHINY_CHANCE,
    ot: opts.ot || null,
    otId: opts.otId || null,
    orb: opts.orb || 'orb',
    met: opts.met || null,
  };
  const ids = (opts.moves && opts.moves.length ? opts.moves : defaultMoves(s, lvl)).filter((id) => MOVES[id]);
  mon.moves = ids.slice(0, 4).map((id) => ({ id, pp: MOVES[id].pp }));
  mon.hp = calcStats(mon).hp;
  return mon;
}

export function maxHp(mon) {
  return calcStats(mon).hp;
}

export function healFull(mon) {
  mon.hp = maxHp(mon);
  mon.status = null;
  mon.slp = 0;
  for (const m of mon.moves) m.pp = MOVES[m.id].pp;
}

export function isAlive(mon) {
  return mon && mon.hp > 0;
}

export function movesAtLevel(s, lvl) {
  return SPECIES[s].ls.filter(([l]) => l === lvl).map(([, m]) => m);
}

// Přidá zkušenosti. Vrací seznam postupů na úrovně a nově dostupných útoků.
export function gainExp(mon, amount) {
  const sp = SPECIES[mon.s];
  const res = { levels: [], newMoves: [] };
  if (mon.lvl >= 100 || amount <= 0) return res;
  mon.exp += amount;
  while (mon.lvl < 100 && mon.exp >= expForLevel(sp.gr, mon.lvl + 1)) {
    const before = maxHp(mon);
    mon.lvl++;
    const after = maxHp(mon);
    if (mon.hp > 0) mon.hp = Math.min(after, mon.hp + (after - before));
    res.levels.push({ lvl: mon.lvl, hp: mon.hp, mhp: after });
    for (const mv of movesAtLevel(mon.s, mon.lvl)) {
      if (!mon.moves.some((m) => m.id === mv) && !res.newMoves.includes(mv)) res.newMoves.push(mv);
    }
  }
  if (mon.lvl >= 100) mon.exp = expForLevel(sp.gr, 100);
  return res;
}

export function setLevel(mon, lvl) {
  const sp = SPECIES[mon.s];
  const need = expForLevel(sp.gr, lvl) - mon.exp;
  return gainExp(mon, need);
}

export function gainEvs(mon, foeSpecies) {
  const sp = SPECIES[foeSpecies];
  if (!sp) return;
  const bst = sp.bs.reduce((a, b) => a + b, 0);
  const n = bst >= 470 ? 3 : bst >= 380 ? 2 : 1;
  const st = STATS[sp.bs.indexOf(Math.max(...sp.bs))];
  const total = STATS.reduce((a, k) => a + mon.ev[k], 0);
  const add = Math.min(n, 252 - mon.ev[st], 510 - total);
  if (add > 0) {
    const before = maxHp(mon);
    mon.ev[st] += add;
    const after = maxHp(mon);
    if (mon.hp > 0) mon.hp += after - before;
  }
}

// Naučí útok; replaceIdx = index zapomenutého útoku (nebo -1 pro přidání).
export function learnMove(mon, moveId, replaceIdx = -1) {
  if (!MOVES[moveId] || mon.moves.some((m) => m.id === moveId)) return false;
  const entry = { id: moveId, pp: MOVES[moveId].pp };
  if (mon.moves.length < 4) {
    mon.moves.push(entry);
    return true;
  }
  if (replaceIdx >= 0 && replaceIdx < mon.moves.length) {
    mon.moves[replaceIdx] = entry;
    return true;
  }
  return false;
}

export function levelEvolution(mon) {
  for (const e of SPECIES[mon.s].evo || []) if (e.lvl && mon.lvl >= e.lvl) return e.to;
  return null;
}

export function tradeEvolution(mon) {
  for (const e of SPECIES[mon.s].evo || []) if (e.trade) return e.to;
  return null;
}

// Vývoj. Vrací útoky, které se nový druh učí na aktuální úrovni.
export function evolve(mon, to) {
  const oldSp = SPECIES[mon.s];
  const nsp = SPECIES[to];
  const before = maxHp(mon);
  const abIdx = Math.max(0, oldSp.ab.indexOf(mon.ability));
  mon.s = to;
  mon.ability = nsp.ab[Math.min(abIdx, nsp.ab.length - 1)];
  const after = maxHp(mon);
  if (mon.hp > 0) mon.hp = Math.min(after, mon.hp + (after - before));
  return movesAtLevel(to, mon.lvl).filter((mv) => !mon.moves.some((m) => m.id === mv));
}

const EXTRA_TM_TYPES = {
  stone: ['earth'], earth: ['stone'], water: ['ice'], ice: ['water'],
  dragon: ['fire', 'water', 'electric', 'earth'], brawl: ['stone'], mind: ['fae'], fae: ['mind'],
  spirit: ['shadow', 'mind'], shadow: ['spirit'], fire: ['shadow'], toxic: ['shadow'],
  metal: ['stone', 'electric'], electric: ['metal'],
};

export function canLearnTM(s, moveId) {
  const sp = SPECIES[s];
  const m = MOVES[moveId];
  if (!sp || !m) return false;
  if (sp.bs.reduce((a, b) => a + b, 0) < 220) return false;
  if (UNIVERSAL_TM.has(moveId)) return true;
  if (sp.ls.some(([, x]) => x === moveId)) return true;
  if (m.t === 'normal') return true;
  for (const t of sp.ty) {
    if (t === m.t) return true;
    if ((EXTRA_TM_TYPES[t] || []).includes(m.t)) return true;
  }
  return false;
}

// Plný pohled na vlastního tvora (posílá se jen majiteli).
export function ownView(mon) {
  const stats = calcStats(mon);
  return {
    uid: mon.uid,
    s: mon.s,
    nick: mon.nick,
    lvl: mon.lvl,
    exp: mon.exp,
    nature: mon.nature,
    ability: mon.ability,
    iv: mon.iv,
    ev: mon.ev,
    hp: mon.hp,
    mhp: stats.hp,
    stats,
    status: mon.status,
    moves: mon.moves.map((m) => ({ id: m.id, pp: m.pp, mpp: MOVES[m.id].pp })),
    shiny: mon.shiny,
    ot: mon.ot,
    met: mon.met,
    orb: mon.orb,
    hat: mon.hat || null,
  };
}

// Omezený pohled (soupeř v boji, náhled při výměně).
export function publicView(mon) {
  return {
    uid: mon.uid,
    s: mon.s,
    nick: mon.nick,
    lvl: mon.lvl,
    hp: mon.hp,
    mhp: maxHp(mon),
    status: mon.status,
    shiny: mon.shiny,
    hat: mon.hat || null,
  };
}
