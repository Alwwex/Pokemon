import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game } from '../server/game.js';
import { Store } from '../server/store.js';
import { createMon, setLevel } from '../server/monsters.js';
import { expForLevel } from '../shared/formulas.js';
import { MOVES } from '../shared/moves.js';
import { MAPS } from '../shared/maps/index.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monsterra-game-'));
const game = new Game(new Store(dir));
const wss = { on(ev, fn) { this.cb = fn; }, clients: new Set() };
game.attach(wss);
test.after(() => { clearInterval(game.timer); fs.rmSync(dir, { recursive: true, force: true }); });

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function client() {
  const handlers = {};
  const ws = {
    readyState: 1, sent: [],
    send(s) { this.sent.push(JSON.parse(s)); },
    on(ev, fn) { handlers[ev] = fn; },
    close() { if (handlers.close) handlers.close(); },
    ping() {}, terminate() {},
  };
  wss.cb(ws, { headers: {}, socket: { remoteAddress: '127.0.0.1' } });
  const c = {
    ws,
    send: (m) => handlers.message(JSON.stringify(m)),
    async wait(t, ms = 3000) {
      const start = Date.now();
      for (;;) {
        const i = ws.sent.findIndex((m) => m.t === t);
        if (i >= 0) return ws.sent.splice(i, 1)[0];
        if (Date.now() - start > ms) throw new Error('nepřišla zpráva ' + t + '; mám: ' + ws.sent.map((m) => m.t).join(','));
        await tick(10);
      }
    },
    clear() { ws.sent.length = 0; },
  };
  return c;
}

let seq = 0;
async function newPlayer(prefix) {
  const name = `${prefix}${++seq}x${Math.floor(Math.random() * 1e5)}`;
  const c = client();
  c.send({ t: 'register', name, pass: 'heslo123' });
  const ok = await c.wait('auth_ok');
  c.p = game.online.get(ok.me.id).p;
  c.s = game.online.get(ok.me.id);
  c.p.flags.starter = 'jiskrik';
  c.p.flags.intro = true;
  return c;
}

function place(c, map, x, y, dir) {
  game.removeFromMap(c.s);
  Object.assign(c.p, { map, x, y, dir });
  game.addToMap(c.s);
}

// Odehraje souboj nejsilnějším útokem. Vrací zprávu battle_end.
async function fight(c, startMsg) {
  let req = startMsg.req;
  for (let turn = 0; turn < 120; turn++) {
    if (req) {
      if (req.need === 'switch') {
        c.send({ t: 'bswitch', idx: req.party.findIndex((m, i) => m.hp > 0 && i !== req.active) });
      } else {
        const mon = req.party[req.active];
        let best = 0;
        mon.moves.forEach((mv, i) => { if (mv.pp > 0 && MOVES[mv.id].p > (MOVES[mon.moves[best].id].p || 0)) best = i; });
        c.send({ t: 'battle', a: { type: 'move', idx: best } });
      }
    }
    await tick(5);
    const end = c.ws.sent.find((m) => m.t === 'battle_end');
    if (end) { c.ws.sent.splice(c.ws.sent.indexOf(end), 1); return end; }
    const ev = c.ws.sent.filter((m) => m.t === 'battle_ev' || m.t === 'battle_err').pop();
    req = ev ? ev.req : null;
    c.ws.sent = c.ws.sent.filter((m) => m.t !== 'battle_ev' && m.t !== 'battle_err');
  }
  throw new Error('souboj neskončil');
}

test('porážka vedoucího stadionu dá odznak, TD a peníze', async () => {
  const c = await newPlayer('Gym');
  c.p.party = [createMon('pekelis', 70, { ivMin: 31, moves: ['plamenny_proud', 'temny_puls', 'prehrati', 'kousnuti'] })];
  place(c, 'mlynov_stadion', 5, 3, 'up');
  const money = c.p.money;
  c.clear();
  c.send({ t: 'interact' });
  const bs = await c.wait('battle_start');
  assert.equal(bs.kind, 'trainer');
  assert.equal(bs.foe.name, 'Bořek');
  const end = await fight(c, bs);
  assert.equal(end.outcome, 'win');
  assert.ok(c.p.badges.includes(1), 'má odznak');
  assert.equal(c.p.bag.td01, 1);
  assert.ok(c.p.money > money);
  assert.ok(end.msgs.some((m) => m.includes('Odznak')));
  // druhá interakce už souboj nespustí
  c.clear();
  c.send({ t: 'interact' });
  const d = await c.wait('dialog');
  assert.match(d.lines[0], /Cestě 2/);
});

test('vývoj po zvýšení úrovně a učení útoku', async () => {
  const c = await newPlayer('Evo');
  const mon = createMon('jiskrik', 15, { moves: ['skrabnuti', 'rev', 'zhava_jiskra', 'rychly_vypad'] });
  mon.exp = expForLevel('ms', 16) - 1;
  c.p.party = [mon];
  place(c, 'cesta1', 9, 20, 'up');
  c.clear();
  game.startWild(c.s, 'hlodik', 6, MAPS.cesta1);
  const bs = await c.wait('battle_start');
  const end = await fight(c, bs);
  assert.equal(end.outcome, 'win');
  assert.ok(mon.lvl >= 16);
  const evo = await c.wait('evolve');
  assert.equal(evo.to, 'plamenlis');
  c.send({ t: 'evolve', ok: true });
  await tick(30);
  assert.equal(mon.s, 'plamenlis');
});

test('učení nového útoku při plné sadě nabídne výběr', async () => {
  const c = await newPlayer('Learn');
  const mon = createMon('hlodik', 7, { moves: ['uder', 'zly_pohled', 'rychly_vypad', 'skrabnuti'] });
  mon.exp = expForLevel('mf', 8) - 1;
  c.p.party = [mon];
  place(c, 'cesta1', 9, 20, 'up');
  c.clear();
  game.startWild(c.s, 'housik', 4, MAPS.cesta1);
  const end = await fight(c, await c.wait('battle_start'));
  assert.equal(end.outcome, 'win');
  const learn = await c.wait('learn');
  assert.equal(learn.move, 'kousnuti');
  c.send({ t: 'learn', idx: 3 });
  await tick(30);
  assert.ok(mon.moves.some((m) => m.id === 'kousnuti'));
  assert.ok(!mon.moves.some((m) => m.id === 'skrabnuti'));
});

test('obchod: nákup a prodej', async () => {
  const c = await newPlayer('Shop');
  c.p.party = [createMon('jiskrik', 5)];
  place(c, 'mlynov_centrum', 11, 4, 'up');
  c.clear();
  c.send({ t: 'interact' });
  const shop = await c.wait('shop');
  assert.ok(shop.items.some((i) => i.id === 'orb'));
  const money = c.p.money;
  c.send({ t: 'buy', item: 'orb', qty: 10 });
  const r = await c.wait('shop_res');
  assert.ok(r.ok);
  assert.equal(c.p.money, money - 2000);
  assert.equal(c.p.bag.orb, 10);
  assert.equal(c.p.bag.super_orb, 1, 'bonus za 10 orbů');
  c.send({ t: 'sell', item: 'orb', qty: 2 });
  await c.wait('shop_res');
  assert.equal(c.p.bag.orb, 8);
  assert.equal(c.p.money, money - 2000 + 200);
  // po odchodu od pultu už nakupovat nelze
  c.send({ t: 'move', dir: 'down' });
  await tick(20);
  c.send({ t: 'buy', item: 'orb', qty: 1 });
  await tick(20);
  assert.equal(c.p.bag.orb, 8);
});

test('čepice: nákup u Kloboučnice, nasazení, výměna a sundání', async () => {
  const c = await newPlayer('Hat');
  c.p.party = [createMon('jiskrik', 5), createMon('pipak', 5)];
  // Kloboučnice stojí v Centru na (11,5) a kouká doleva → hráč na (10,5) čelem doprava
  place(c, 'mlynov_centrum', 10, 5, 'right');
  c.clear();
  c.send({ t: 'interact' });
  const shop = await c.wait('shop');
  assert.ok(shop.hats);
  assert.ok(shop.items.some((i) => i.id === 'cepice_ksiltovka'));
  assert.ok(!shop.items.some((i) => i.id === 'cepice_koruna'), 'korunka až s 6 odznaky');
  c.send({ t: 'buy', item: 'cepice_ksiltovka', qty: 1 });
  c.send({ t: 'buy', item: 'cepice_party', qty: 1 });
  await c.wait('shop_res');
  await c.wait('shop_res');
  assert.equal(c.p.bag.cepice_ksiltovka, 1);
  const lead = c.p.party[0];
  c.send({ t: 'close' });
  c.clear();
  c.send({ t: 'item', item: 'cepice_ksiltovka', target: lead.uid });
  await tick(30);
  assert.equal(lead.hat, 'cepice_ksiltovka');
  assert.ok(!c.p.bag.cepice_ksiltovka);
  // výměna: stará čepice se vrátí do batohu
  c.send({ t: 'item', item: 'cepice_party', target: lead.uid });
  await tick(30);
  assert.equal(lead.hat, 'cepice_party');
  assert.equal(c.p.bag.cepice_ksiltovka, 1);
  // čepice je vidět i ostatním (veřejný pohled na prvního tvora)
  assert.equal(game.pubPlayer(c.s).lead.hat, 'cepice_party');
  c.send({ t: 'unhat', uid: lead.uid });
  await tick(30);
  assert.equal(lead.hat, null);
  assert.equal(c.p.bag.cepice_party, 1);
});

test('počítač: uložení a vyzvednutí tvora', async () => {
  const c = await newPlayer('Pc');
  c.p.party = [createMon('jiskrik', 5), createMon('hlodik', 3)];
  place(c, 'mlynov_centrum', 1, 4, 'up');
  c.clear();
  c.send({ t: 'interact' });
  await c.wait('pc');
  c.send({ t: 'pc', op: 'deposit', box: 0, idx: 1 });
  const pc = await c.wait('pc');
  assert.equal(pc.boxes[0].length, 1);
  assert.equal(c.p.party.length, 1);
  c.send({ t: 'pc', op: 'deposit', box: 0, idx: 0 });
  const pc2 = await c.wait('pc');
  assert.match(pc2.msg, /aspoň jeden/);
  c.send({ t: 'pc', op: 'withdraw', box: 0, idx: 0 });
  await c.wait('pc');
  assert.equal(c.p.party.length, 2);
});

test('prohra: návrat do bezpečí a ztráta peněz', async () => {
  const c = await newPlayer('Lose');
  c.p.party = [createMon('housik', 2, { moves: ['lepkave_vlakno'] })];
  c.p.respawn = { map: 'mlynov_centrum', x: 6, y: 4 };
  c.p.money = 1000;
  place(c, 'cesta1', 9, 20, 'up');
  c.clear();
  const npc = { id: 'test_bully', look: 'youngster', dir: 'down', trainer: { cls: 'Mladík', name: 'Silák', team: [['pekelis', 60]], intro: 'Ha!' } };
  game.startTrainerBattle(c.s, npc, false);
  const end = await fight(c, await c.wait('battle_start'));
  assert.equal(end.outcome, 'lose');
  const map = await c.wait('map');
  assert.equal(map.map, 'mlynov_centrum');
  assert.equal(c.p.money, 900);
  assert.equal(c.p.party[0].hp > 0, true);
});

test('pohyb: zdi, okraje mapy a podmínky průchodu', async () => {
  const c = await newPlayer('Walk');
  c.p.party = [createMon('jiskrik', 5)];
  place(c, 'mlynov', 13, 20, 'down');
  c.clear();
  // na východ bez odznaku nepustí
  place(c, 'mlynov', 27, 16, 'right');
  c.send({ t: 'move', dir: 'right' });
  const d = await c.wait('dialog');
  assert.match(d.lines[0], /odznakem/);
  assert.equal(c.p.map, 'mlynov');
  c.p.badges = [1];
  await tick(120);
  c.send({ t: 'move', dir: 'right' });
  const m = await c.wait('map');
  assert.equal(m.map, 'cesta2');
  // do stromu se vejít nedá
  place(c, 'cesta2', 2, 5, 'up');
  await tick(120);
  for (let i = 0; i < 3; i++) { c.send({ t: 'move', dir: 'up' }); await tick(20); }
  assert.equal(c.p.y, 3, 'na (2,2) stojí strom');
});
