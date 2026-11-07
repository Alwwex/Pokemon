import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 41000 + Math.floor(Math.random() * 2000);
let proc;
let dataDir;

function startServer() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monsterra-'));
  proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => { if (String(d).includes('běží')) resolve(); });
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
}

class Client {
  constructor() {
    this.ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    this.inbox = [];
    this.waiters = [];
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      this.inbox.push(m);
      this.waiters = this.waiters.filter((w) => {
        const i = this.inbox.findIndex(w.pred);
        if (i >= 0) { w.resolve(this.inbox.splice(i, 1)[0]); return false; }
        return true;
      });
    };
  }
  open() { return new Promise((r) => { this.ws.onopen = r; }); }
  send(m) { this.ws.send(JSON.stringify(m)); }
  wait(pred, ms = 3000) {
    const p = typeof pred === 'string' ? (m) => m.t === pred : pred;
    const i = this.inbox.findIndex(p);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = { pred: p, resolve };
      this.waiters.push(w);
      setTimeout(() => reject(new Error('timeout čekání na zprávu')), ms);
    });
  }
  async moves(dir, n) {
    for (let i = 0; i < n; i++) { this.send({ t: 'move', dir }); await new Promise((r) => setTimeout(r, 110)); }
  }
  close() { this.ws.close(); }
}

test.before(startServer);
test.after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('registrace, výběr startéra a první souboj', async () => {
  const c = new Client();
  await c.open();
  const name = 'Test' + Math.floor(Math.random() * 1e6);
  c.send({ t: 'register', name, pass: 'heslo123', look: { skin: 2, hair: '#e8c06a', hs: 1, shirt: '#3a7ad8', pants: '#2a2a32', hat: null } });
  const ok = await c.wait('auth_ok');
  assert.equal(ok.map, 'liskova_domov');
  assert.ok(ok.token);

  // odchod z domu
  await c.moves('down', 4);
  const m1 = await c.wait('map');
  assert.equal(m1.map, 'liskova');
  // cesta k laboratoři
  await c.moves('right', 6);
  await c.moves('down', 7);
  await c.moves('right', 6);
  await c.moves('up', 1);
  const m2 = await c.wait('map');
  assert.equal(m2.map, 'liskova_lab');
  await c.moves('up', 5);
  c.send({ t: 'face', dir: 'up' });
  c.send({ t: 'interact' });
  const sq = await c.wait('seq');
  assert.ok(sq.steps.some((s) => s.k === 'starter'));
  c.send({ t: 'starter', s: 'jiskrik' });
  const bs = await c.wait('battle_start');
  assert.equal(bs.kind, 'trainer');
  assert.equal(bs.party[0].s, 'jiskrik');
  let req = bs.req;
  let end = null;
  for (let turn = 0; turn < 60 && !end; turn++) {
    if (req && req.need === 'action') {
      const mon = req.party[req.active];
      const idx = mon.moves.findIndex((mv) => mv.pp > 0 && ['skrabnuti', 'zhava_jiskra'].includes(mv.id));
      c.send({ t: 'battle', a: { type: 'move', idx: idx >= 0 ? idx : 0 } });
    }
    const msg = await c.wait((m) => m.t === 'battle_ev' || m.t === 'battle_end' || m.t === 'battle_err');
    if (msg.t === 'battle_end') end = msg;
    else if (msg.t === 'battle_ev') {
      req = msg.req;
      if (!req) end = await c.wait('battle_end');
    } else req = msg.req;
  }
  assert.ok(end, 'souboj skončil');
  assert.ok(['win', 'lose'].includes(end.outcome));
  const me = await c.wait((m) => m.t === 'me' && m.me.flags.rival1);
  assert.ok(me.me.bag.orb >= 5);
  assert.ok(me.me.party[0].hp > 0);
  c.close();

  // znovupřihlášení tokenem
  const c2 = new Client();
  await c2.open();
  c2.send({ t: 'resume', name, token: ok.token });
  const ok2 = await c2.wait('auth_ok');
  assert.equal(ok2.map, 'liskova_lab');
  assert.equal(ok2.me.party.length, 1);
  c2.close();
});

test('dva hráči se vidí na mapě a fungují chat i výzva', async () => {
  const a = new Client();
  const b = new Client();
  await Promise.all([a.open(), b.open()]);
  a.send({ t: 'register', name: 'Alfa' + Math.floor(Math.random() * 1e5), pass: 'abcd' });
  const okA = await a.wait('auth_ok');
  b.send({ t: 'register', name: 'Beta' + Math.floor(Math.random() * 1e5), pass: 'abcd' });
  const okB = await b.wait('auth_ok');
  const add = await a.wait((m) => m.t === 'p_add' && m.p.id === okB.me.id);
  assert.equal(add.p.name, okB.me.name);
  b.send({ t: 'move', dir: 'down' });
  const mv = await a.wait((m) => m.t === 'p_move' && m.id === okB.me.id);
  assert.equal(mv.y, 5);
  a.send({ t: 'chat', text: 'Ahoj světe!' });
  const ch = await b.wait('chat');
  assert.equal(ch.text, 'Ahoj světe!');
  a.send({ t: 'challenge', id: okB.me.id });
  // Alfa nemá tvora → výzva odmítnuta
  const n = await a.wait('notice');
  assert.match(n.msg, /tvora/);
  a.close();
  b.close();
  assert.ok(okA.me.id !== okB.me.id);
});
