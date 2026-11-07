import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../server/battle.js';
import { createMon, maxHp } from '../server/monsters.js';
import { SPECIES_LIST, SPECIES } from '../shared/species.js';
import { effectiveness } from '../shared/types.js';
import { MOVES } from '../shared/moves.js';

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const randomParty = (n, lo, hi) => Array.from({ length: n }, () => createMon(rnd(SPECIES_LIST), lo + Math.floor(Math.random() * (hi - lo + 1))));

function runBattle(kind, p0, p1, chooser) {
  const b = new Battle({
    id: 't',
    kind,
    sides: [
      { kind: 'player', name: 'A', party: p0 },
      kind === 'pvp' ? { kind: 'player', name: 'B', party: p1 } : { kind: 'ai', ai: kind === 'wild' ? 'wild' : 'smart', name: 'B', party: p1, items: { super_lektvar: 2 } },
    ],
  });
  b.start();
  let guard = 0;
  while (!b.over && guard++ < 500) {
    for (const si of [0, 1]) {
      const s = b.sides[si];
      if (s.need === 'action') b.choose(si, chooser(b, si));
      else if (s.need === 'switch') {
        const idx = s.party.findIndex((m, i) => m.hp > 0 && i !== s.active);
        b.chooseSwitch(si, idx);
      }
    }
    b.flush();
  }
  return { b, guard };
}

const randomChooser = (b, si) => {
  const s = b.sides[si];
  const r = Math.random();
  if (r < 0.1) {
    const idx = s.party.findIndex((m, i) => m.hp > 0 && i !== s.active);
    if (idx >= 0) return { type: 'switch', idx };
  }
  if (r < 0.15 && b.kind === 'wild') return { type: 'item', item: 'orb' };
  if (r < 0.18 && b.kind !== 'pvp') return { type: 'item', item: 'super_lektvar', target: s.active };
  const m = s.party[s.active];
  const usable = m.moves.map((x, i) => (x.pp > 0 ? i : -1)).filter((i) => i >= 0);
  return { type: 'move', idx: usable.length ? rnd(usable) : 0 };
};

test('typová tabulka', () => {
  assert.equal(effectiveness('water', ['fire']), 2);
  assert.equal(effectiveness('electric', ['earth']), 0);
  assert.equal(effectiveness('fire', ['plant', 'bug']), 4);
  assert.equal(effectiveness('normal', ['spirit']), 0);
});

test('vytvoření tvora', () => {
  const m = createMon('jiskrik', 5);
  assert.equal(m.lvl, 5);
  assert.ok(m.moves.length >= 1 && m.moves.length <= 4);
  assert.equal(m.hp, maxHp(m));
  for (const mv of m.moves) assert.ok(MOVES[mv.id]);
});

test('stovky náhodných soubojů proběhnou bez chyby', () => {
  for (let i = 0; i < 400; i++) {
    const kind = rnd(['wild', 'trainer', 'pvp']);
    const p0 = randomParty(1 + Math.floor(Math.random() * 6), 3, 70);
    const p1 = kind === 'wild' ? randomParty(1, 2, 60) : randomParty(1 + Math.floor(Math.random() * 6), 3, 70);
    const { b, guard } = runBattle(kind, p0, p1, randomChooser);
    assert.ok(guard < 500, `souboj ${i} se zasekl`);
    assert.ok(b.over);
    for (const m of [...p0, ...p1]) {
      assert.ok(m.hp >= 0 && m.hp <= maxHp(m), `HP mimo rozsah: ${SPECIES[m.s].n} ${m.hp}/${maxHp(m)}`);
      for (const mv of m.moves) assert.ok(mv.pp >= 0);
    }
  }
});

test('divoký souboj: výhra dá zkušenosti', () => {
  const p0 = [createMon('plamenlis', 30)];
  const p1 = [createMon('hlodik', 3)];
  const exp0 = p0[0].exp;
  const { b } = runBattle('wild', p0, p1, (bb, si) => ({ type: 'move', idx: bb.sides[si].party[bb.sides[si].active].moves.findIndex((m) => MOVES[m.id].c !== 'X') }));
  assert.equal(b.result.winner, 0);
  assert.ok(p0[0].exp > exp0);
});

test('chycení prizmatickým orbem', () => {
  const p0 = [createMon('jiskrik', 10)];
  const p1 = [createMon('meluzina', 50)];
  const { b } = runBattle('wild', p0, p1, () => ({ type: 'item', item: 'prizmaticky_orb' }));
  assert.equal(b.result.reason, 'catch');
  assert.equal(b.caught, p1[0]);
});

test('textové události mají správné značky', () => {
  const p0 = [createMon('jiskrik', 10)];
  const p1 = [createMon('hlodik', 5)];
  const b = new Battle({ id: 'x', kind: 'wild', sides: [{ kind: 'player', name: 'A', party: p0 }, { kind: 'ai', ai: 'wild', party: p1 }] });
  b.start();
  b.flush();
  b.choose(0, { type: 'move', idx: 0 });
  const ev = b.flush();
  const used = ev.find((e) => e.e === 'txt' && e.t.includes('použil'));
  assert.ok(used);
  assert.match(used.t, /\u0001[01]\u0002[^\u0003]+\u0003 použil/);
});
