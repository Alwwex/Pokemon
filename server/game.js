// Herní svět: hráči, pohyb, NPC, souboje, obchody, výměny, chat.
import {
  MAPS, START, npcVisible, solidAt, objectAt, passable, warpAt, encounterTile, edgeTarget, frontOf,
} from '../shared/maps/index.js';
import { DIRS } from '../shared/tiles.js';
import { SPECIES, STARTERS } from '../shared/species.js';
import { ITEMS, HAT_TIERS } from '../shared/items.js';
import { MOVES } from '../shared/moves.js';
import { sanitizeLook } from '../shared/looks.js';
import { monName, expForLevel } from '../shared/formulas.js';
import { Battle, itemUseError } from './battle.js';
import {
  createMon, healFull, ownView, gainExp, learnMove, levelEvolution, tradeEvolution, evolve, canLearnTM, maxHp,
} from './monsters.js';
import { Store } from './store.js';
import { uid, randInt, weightedPick, deepClone, clamp, pick } from './util.js';

export const BADGE_NAMES = ['', 'Mlýnský kámen', 'Kapka', 'Jiskra', 'Lísteček', 'Lucerna', 'Vločka'];
const BOX_COUNT = 8;
const BOX_SIZE = 30;
const REQUEST_TTL = 30000;
const PVP_TURN_MS = 90000;
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const COUNTER = { jiskrik: 'cvachtik', cvachtik: 'pupinek', pupinek: 'jiskrik' };
const LINES = {
  jiskrik: ['jiskrik', 'plamenlis', 'pekelis'],
  cvachtik: ['cvachtik', 'vlnovyd', 'bourovyd'],
  pupinek: ['pupinek', 'listoroh', 'lesmir'],
};
const RIVAL_REWARD = { 1: 100, 2: 600, 3: 2000, 4: 5000 };

function rivalTeam(stage, playerStarter) {
  const line = LINES[COUNTER[playerStarter] || 'cvachtik'];
  switch (stage) {
    case 1: return [[line[0], 5]];
    case 2: return [['pipak', 9], [line[0], 10]];
    case 3: return [['sipak', 21], ['hrabacek', 20], ['svitivka', 20], [line[1], 23]];
    default: return [['vichrol', 40], ['rypoun', 39], ['hromeduza', 40], ['mystik', 41], [line[2], 43]];
  }
}

const SHOP_TIERS = [
  [0, ['orb', 'lektvar', 'protijed', 'uvolnovac', 'budicek']],
  [1, ['super_orb', 'mast', 'rozmrazovac', 'odpuzovac']],
  [2, ['super_lektvar', 'ozivovac']],
  [3, ['ultra_orb', 'hyper_lektvar', 'uplne_vyleceni', 'super_odpuzovac']],
  [5, ['max_lektvar', 'eter']],
];

class Session {
  constructor(ws, ip) {
    this.ws = ws;
    this.ip = ip;
    this.p = null;
    this.battle = null;
    this.ui = null;
    this.prompts = [];
    this.prompt = null;
    this.trade = null;
    this.bucket = 4;
    this.lastRefill = Date.now();
    this.chatBucket = 4;
    this.chatRefill = Date.now();
    this.authTries = 0;
    this.dirty = false;
    this.joined = Date.now();
  }
  send(obj) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }
  get busy() {
    return !!(this.battle || this.prompt || this.prompts.length || this.trade || (this.ui && this.ui.kind === 'starter'));
  }
}

export class Game {
  constructor(store) {
    this.store = store;
    this.online = new Map();
    this.maps = new Map();
    this.battles = new Map();
    this.challenges = new Map();
    this.tradeReqs = new Map();
    this.lastSave = Date.now();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  // ---------- spojení ----------
  attach(wss) {
    wss.on('connection', (ws, req) => {
      const fwd = req.headers['x-forwarded-for'];
      const ip = (fwd ? String(fwd).split(',')[0].trim() : '') || req.socket.remoteAddress;
      const s = new Session(ws, ip);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        if (!msg || typeof msg.t !== 'string') return;
        this.handle(s, msg).catch((e) => {
          console.error('Chyba při zpracování', msg.t, e);
          s.send({ t: 'notice', msg: 'Na serveru nastala chyba.' });
        });
      });
      ws.on('close', () => this.onClose(s));
      ws.on('error', () => {});
    });
    this.wss = wss;
  }

  async handle(s, m) {
    if (!s.p) {
      if (m.t === 'register') return this.register(s, m);
      if (m.t === 'login') return this.login(s, m);
      if (m.t === 'resume') return this.resume(s, m);
      return;
    }
    const h = HANDLERS[m.t];
    if (h) return h.call(this, s, m);
  }

  tick() {
    const now = Date.now();
    for (const [k, c] of this.challenges) if (now - c.t > REQUEST_TTL) this.challenges.delete(k);
    for (const [k, c] of this.tradeReqs) if (now - c.t > REQUEST_TTL) this.tradeReqs.delete(k);
    if (now - this.lastSave > 30000) {
      this.lastSave = now;
      for (const s of this.online.values()) if (s.dirty) this.save(s);
    }
    if (this.wss && now % 30000 < 1000) {
      for (const ws of this.wss.clients) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch { /* ignore */ }
      }
    }
  }

  save(s) {
    if (!s.p) return;
    s.dirty = false;
    this.store.savePlayer(s.p);
  }

  saveAllSync() {
    for (const s of this.online.values()) if (s.p) this.store.savePlayerSync(s.p);
  }

  // ---------- účty ----------
  async register(s, m) {
    const name = String(m.name || '').trim().normalize('NFC');
    if (!/^[\p{L}\p{N}_]{3,16}$/u.test(name)) return s.send({ t: 'auth_err', msg: 'Jméno musí mít 3–16 znaků (písmena, číslice, podtržítko).' });
    const pass = String(m.pass || '');
    if (pass.length < 4 || pass.length > 64) return s.send({ t: 'auth_err', msg: 'Heslo musí mít 4 až 64 znaků.' });
    if (this.store.getAccount(name)) return s.send({ t: 'auth_err', msg: 'Toto jméno už někdo používá.' });
    const acc = await this.store.createAccount(name, pass);
    if (!acc) return s.send({ t: 'auth_err', msg: 'Toto jméno už někdo používá.' });
    const p = this.newPlayer(acc, sanitizeLook(m.look));
    await this.store.savePlayer(p);
    this.enterGame(s, p);
  }

  async login(s, m) {
    if (++s.authTries > 8) { s.send({ t: 'auth_err', msg: 'Příliš mnoho pokusů.' }); s.ws.close(); return; }
    const acc = this.store.getAccount(String(m.name || '').trim());
    if (!acc || !(await this.store.verifyPassword(acc, String(m.pass || '')))) return s.send({ t: 'auth_err', msg: 'Špatné jméno nebo heslo.' });
    this.enterGame(s, this.takeOver(acc.id));
  }

  async resume(s, m) {
    if (++s.authTries > 8) { s.ws.close(); return; }
    const acc = this.store.getAccount(String(m.name || '').trim());
    if (!acc) return s.send({ t: 'auth_err', msg: 'Přihlas se prosím znovu.', silent: true });
    const p = this.takeOver(acc.id, true);
    if (!p || !p.tokens || !p.tokens.includes(Store.tokenHash(m.token))) return s.send({ t: 'auth_err', msg: 'Přihlas se prosím znovu.', silent: true });
    this.enterGame(s, this.takeOver(acc.id));
  }

  // Vrátí objekt hráče; je-li už online, odpojí starou relaci a převezme její data.
  takeOver(id, peekOnly = false) {
    const old = this.online.get(id);
    if (old) {
      if (peekOnly) return old.p;
      const p = old.p;
      old.send({ t: 'kicked', msg: 'Přihlásil ses z jiného místa.' });
      this.detach(old);
      old.p = null;
      try { old.ws.close(); } catch { /* ignore */ }
      return p;
    }
    return this.store.loadPlayer(id);
  }

  newPlayer(acc, look) {
    return {
      id: acc.id,
      name: acc.name,
      look,
      map: START.map,
      x: START.x,
      y: START.y,
      dir: START.dir,
      money: 3000,
      badges: [],
      flags: {},
      trainers: {},
      items: {},
      bag: { lektvar: 2 },
      party: [],
      boxes: Array.from({ length: BOX_COUNT }, () => []),
      dex: { seen: {}, caught: {} },
      respawn: { map: 'liskova_domov', x: 5, y: 5 },
      repel: 0,
      stats: { battles: 0, wins: 0, caught: 0, pvpWins: 0, steps: 0 },
      created: Date.now(),
      lastSeen: Date.now(),
      playtime: 0,
      tokens: [],
    };
  }

  enterGame(s, p) {
    if (!p) return s.send({ t: 'auth_err', msg: 'Účet se nepodařilo načíst.' });
    const token = Store.newToken();
    p.tokens = [Store.tokenHash(token), ...(p.tokens || [])].slice(0, 5);
    s.p = p;
    s.joined = Date.now();
    this.online.set(p.id, s);
    const map = MAPS[p.map];
    if (!map || solidAt(map, p.x, p.y)) Object.assign(p, { map: START.map, x: START.x, y: START.y, dir: START.dir });
    if (p.party.length && !p.party.some((m) => m.hp > 0)) {
      for (const m of p.party) healFull(m);
      Object.assign(p, { map: p.respawn.map, x: p.respawn.x, y: p.respawn.y, dir: 'down' });
    }
    this.addToMap(s);
    s.send({ t: 'auth_ok', token, me: this.meView(p), map: p.map, x: p.x, y: p.y, dir: p.dir, players: this.mapList(s), online: this.online.size });
    this.broadcastOnline();
    s.dirty = true;
  }

  // Uvolní relaci (odpojení nebo převzetí jiným spojením).
  detach(s) {
    if (!s.p) return;
    if (s.battle) {
      const rec = s.battle;
      const si = rec.sessions.indexOf(s);
      s.battle = null;
      if (rec.kind === 'pvp' && !rec.battle.over) {
        rec.sessions[si] = null;
        rec.battle.forfeit(si, 'disconnect');
        this.pumpBattle(rec);
      } else {
        this.battles.delete(rec.id);
        clearTimeout(rec.timer);
      }
    }
    if (s.trade) this.cancelTrade(s.trade, `${s.p.name} odešel.`);
    s.prompts = [];
    s.prompt = null;
    this.removeFromMap(s);
    if (this.online.get(s.p.id) === s) this.online.delete(s.p.id);
    s.p.playtime = (s.p.playtime || 0) + Math.floor((Date.now() - s.joined) / 1000);
    s.p.lastSeen = Date.now();
    this.store.savePlayer(s.p);
    this.broadcastOnline();
  }

  onClose(s) {
    if (s.p && this.online.get(s.p.id) === s) this.detach(s);
  }

  // ---------- mapy a přítomnost ----------
  mapSet(id) {
    let set = this.maps.get(id);
    if (!set) { set = new Set(); this.maps.set(id, set); }
    return set;
  }

  addToMap(s) {
    this.mapSet(s.p.map).add(s);
    this.toMap(s.p.map, { t: 'p_add', p: this.pubPlayer(s) }, s);
  }

  removeFromMap(s) {
    const set = this.maps.get(s.p.map);
    if (set) set.delete(s);
    this.toMap(s.p.map, { t: 'p_del', id: s.p.id }, s);
  }

  toMap(mapId, msg, except) {
    const set = this.maps.get(mapId);
    if (!set) return;
    const str = JSON.stringify(msg);
    for (const o of set) if (o !== except && o.ws.readyState === 1) o.ws.send(str);
  }

  broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const s of this.online.values()) if (s.ws.readyState === 1) s.ws.send(str);
  }

  broadcastOnline() {
    clearTimeout(this.onlineTimer);
    this.onlineTimer = setTimeout(() => this.broadcast({ t: 'online', n: this.online.size }), 300);
  }

  pubPlayer(s) {
    const p = s.p;
    const lead = p.party[0];
    return { id: p.id, name: p.name, look: p.look, x: p.x, y: p.y, dir: p.dir, battle: !!s.battle, lead: lead ? { s: lead.s, shiny: lead.shiny, hat: lead.hat || null } : null, champ: !!p.flags.champion, badges: p.badges.length };
  }

  mapList(s) {
    const set = this.maps.get(s.p.map) || new Set();
    return [...set].filter((o) => o !== s && o.p).map((o) => this.pubPlayer(o));
  }

  ctx(p) {
    return { flags: p.flags, badges: p.badges.length, trainers: p.trainers, items: p.items };
  }

  meView(p) {
    return {
      id: p.id, name: p.name, look: p.look, money: p.money, badges: p.badges, flags: p.flags, trainers: p.trainers,
      items: p.items, bag: p.bag, party: p.party.map(ownView), dex: p.dex, repel: p.repel, stats: p.stats, playtime: p.playtime,
    };
  }

  sendMe(s) {
    s.send({ t: 'me', me: this.meView(s.p) });
  }

  sendPos(s) {
    s.send({ t: 'pos', x: s.p.x, y: s.p.y, dir: s.p.dir, map: s.p.map });
  }

  fill(text, p) {
    return String(text).replaceAll('{name}', p.name);
  }

  dialog(s, lines, opts = {}) {
    s.send({ t: 'dialog', lines: lines.map((l) => this.fill(l, s.p)), name: opts.name || null, npc: opts.npc || null, face: opts.face || null });
  }

  notice(s, msg) {
    s.send({ t: 'notice', msg });
  }

  seq(s, steps) {
    for (const st of steps) if (st.lines) st.lines = st.lines.map((l) => this.fill(l, s.p));
    s.send({ t: 'seq', steps });
  }

  needOk(p, need) {
    if (need.flag && !p.flags[need.flag]) return false;
    if (need.badges && p.badges.length < need.badges) return false;
    return true;
  }

  warpTo(s, mapId, x, y, dir, edge = false) {
    const p = s.p;
    s.ui = null;
    this.removeFromMap(s);
    Object.assign(p, { map: mapId, x, y, dir });
    this.addToMap(s);
    s.send({ t: 'map', map: mapId, x, y, dir, players: this.mapList(s), edge });
    s.dirty = true;
  }

  isNight() {
    const h = new Date().getHours();
    return h >= 20 || h < 6;
  }

  // ---------- pohyb ----------
  move(s, m) {
    const p = s.p;
    const dir = m.dir;
    if (!DIRS[dir]) return;
    if (s.busy) return this.sendPos(s);
    const now = Date.now();
    s.bucket = Math.min(4, s.bucket + (now - s.lastRefill) / 95);
    s.lastRefill = now;
    if (s.bucket < 1) return this.sendPos(s);
    s.bucket -= 1;
    s.ui = null;
    const map = MAPS[p.map];
    p.dir = dir;
    const pushWarp = warpAt(map, p.x, p.y, dir);
    if (pushWarp) return this.warpTo(s, pushWarp.to, pushWarp.tx, pushWarp.ty, pushWarp.face || dir);
    const d = DIRS[dir];
    const nx = p.x + d.dx;
    const ny = p.y + d.dy;
    const ctx = this.ctx(p);
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) {
      const tg = edgeTarget(map, p.x, p.y, dir);
      if (!tg) return this.sendPos(s);
      if (tg.need && !this.needOk(p, tg.need)) {
        this.sendPos(s);
        return this.dialog(s, [tg.need.msg]);
      }
      if (!passable(tg.map, tg.x, tg.y, ctx)) return this.sendPos(s);
      this.warpTo(s, tg.map.id, tg.x, tg.y, dir, true);
      return this.afterStep(s);
    }
    if (map.rows[ny][nx] === '^' && dir === 'down') {
      if (ny + 1 < map.h && passable(map, nx, ny + 1, ctx)) {
        p.x = nx;
        p.y = ny + 1;
        this.toMap(p.map, { t: 'p_move', id: p.id, x: p.x, y: p.y, dir, jump: true }, s);
        return this.afterStep(s);
      }
      return this.sendPos(s);
    }
    if (!passable(map, nx, ny, ctx)) return this.sendPos(s);
    p.x = nx;
    p.y = ny;
    this.toMap(p.map, { t: 'p_move', id: p.id, x: nx, y: ny, dir, run: !!m.run }, s);
    const w = warpAt(map, nx, ny, null);
    if (w) return this.warpTo(s, w.to, w.tx, w.ty, w.face || dir);
    this.afterStep(s);
  }

  face(s, m) {
    if (!DIRS[m.dir] || s.busy) return;
    s.p.dir = m.dir;
    this.toMap(s.p.map, { t: 'p_face', id: s.p.id, dir: m.dir }, s);
  }

  afterStep(s) {
    const p = s.p;
    const map = MAPS[p.map];
    p.stats.steps = (p.stats.steps || 0) + 1;
    s.dirty = true;
    if (p.repel > 0 && --p.repel === 0) this.notice(s, 'Účinek odpuzovače vyprchal.');
    if (this.checkTrainers(s)) return;
    if (encounterTile(map, p.x, p.y)) this.tryEncounter(s, map);
  }

  checkTrainers(s) {
    const p = s.p;
    if (!p.party.some((m) => m.hp > 0)) return false;
    const map = MAPS[p.map];
    const ctx = this.ctx(p);
    for (const npc of map.npcs) {
      const tr = npc.trainer;
      if (!tr || !tr.sight || p.trainers[npc.id] || !npcVisible(npc, ctx)) continue;
      const d = DIRS[npc.dir];
      for (let i = 1; i <= tr.sight; i++) {
        const tx = npc.x + d.dx * i;
        const ty = npc.y + d.dy * i;
        if (tx === p.x && ty === p.y) {
          this.startTrainerBattle(s, npc, true);
          return true;
        }
        if (solidAt(map, tx, ty) || objectAt(map, tx, ty, ctx)) break;
      }
    }
    return false;
  }

  tryEncounter(s, map) {
    const p = s.p;
    if (!p.party.some((m) => m.hp > 0)) return;
    if (Math.random() >= (map.enc.rate || 0.1)) return;
    const e = weightedPick(map.enc.list);
    const lvl = randInt(e.min, e.max);
    if (p.repel > 0) {
      const lead = p.party.find((m) => m.hp > 0);
      if (lead && lvl < lead.lvl) return;
    }
    this.startWild(s, e.s, lvl, map);
  }

  // ---------- interakce ----------
  interact(s) {
    if (s.busy) return;
    const p = s.p;
    const map = MAPS[p.map];
    const ctx = this.ctx(p);
    const f = frontOf(p.x, p.y, p.dir);
    let tx = f.x;
    let ty = f.y;
    if (map.rows[ty] && map.rows[ty][tx] === 'k') {
      const f2 = frontOf(tx, ty, p.dir);
      tx = f2.x;
      ty = f2.y;
    }
    const obj = objectAt(map, tx, ty, ctx) || objectAt(map, f.x, f.y, ctx);
    if (obj) {
      if (obj.kind === 'npc') return this.talk(s, obj.obj);
      if (obj.kind === 'item') return this.pickItem(s, obj.obj);
      if (obj.kind === 'legend') return this.legendBattle(s, obj.obj);
    }
    const sign = map.signs.find((g) => g.x === f.x && g.y === f.y);
    if (sign) return this.dialog(s, [sign.text]);
    if (map.pc && map.pc.x === f.x && map.pc.y === f.y) return this.openPC(s);
    const ch = map.rows[f.y] && map.rows[f.y][f.x];
    if (ch === 'b') return this.dialog(s, [pick(['Police plná knih o tvorech.', 'Kniha: „Jak vychovat šampiona“. Zajímavé!', 'Atlas hub Velhory. Raději nejíst nic, co svítí.'])]);
    if (ch === 'h') return this.dialog(s, ['Léčebný přístroj. Tiše bzučí.']);
  }

  talk(s, npc) {
    const p = s.p;
    const tr = npc.trainer;
    const name = npc.name || (tr ? `${tr.cls} ${tr.name}` : null);
    const face = OPPOSITE[p.dir];
    if (tr) {
      if (!p.party.some((m) => m.hp > 0)) return this.dialog(s, npc.say || [tr.intro || '…'], { name, npc: npc.id, face });
      if (!p.trainers[npc.id]) return this.startTrainerBattle(s, npc, false);
      return this.dialog(s, [tr.after || '…'], { name, npc: npc.id, face });
    }
    if (npc.script && SCRIPTS[npc.script]) return SCRIPTS[npc.script].call(this, s, npc, face);
    if (npc.give) {
      const flag = 'gift_' + npc.id;
      if (!p.flags[flag]) {
        p.flags[flag] = true;
        const qty = npc.give.qty || 1;
        this.addItem(p, npc.give.item, qty);
        this.sendMe(s);
        return this.dialog(s, [...(npc.say || []), `Dostal jsi ${ITEMS[npc.give.item].n}${qty > 1 ? ' ×' + qty : ''}!`], { name, npc: npc.id, face });
      }
      return this.dialog(s, npc.after || npc.say || ['…'], { name, npc: npc.id, face });
    }
    return this.dialog(s, npc.say || ['…'], { name, npc: npc.id, face });
  }

  pickItem(s, it) {
    const p = s.p;
    const qty = it.qty || 1;
    p.items[it.id] = true;
    this.addItem(p, it.item, qty);
    s.dirty = true;
    this.sendMe(s);
    this.dialog(s, [`Našel jsi ${ITEMS[it.item].n}${qty > 1 ? ' ×' + qty : ''}!`]);
  }

  addItem(p, id, qty = 1) {
    p.bag[id] = (p.bag[id] || 0) + qty;
  }

  takeItem(p, id, qty = 1) {
    p.bag[id] = (p.bag[id] || 0) - qty;
    if (p.bag[id] <= 0) delete p.bag[id];
  }

  seen(p, s) { p.dex.seen[s] = 1; }

  caught(p, s) { p.dex.seen[s] = 1; p.dex.caught[s] = 1; }

  // ---------- souboje ----------
  startWild(s, species, lvl, map, opts = {}) {
    const p = s.p;
    const wild = createMon(species, lvl, { met: map.name, ivMin: opts.legend ? 20 : undefined });
    this.seen(p, species);
    const b = new Battle({
      id: uid('b'), kind: 'wild', env: map.bg, night: this.isNight(),
      sides: [
        { kind: 'player', name: p.name, playerId: p.id, party: p.party },
        { kind: 'ai', ai: opts.ai || 'wild', name: '', party: [wild] },
      ],
    });
    const rec = { id: b.id, battle: b, kind: 'wild', sessions: [s, null], meta: { legend: opts.legend || null, map: map.id, music: opts.music || 'wild' } };
    this.beginBattle(rec, opts.pre);
  }

  startTrainerBattle(s, npc, spotted) {
    const p = s.p;
    if (!p.party.some((m) => m.hp > 0)) return;
    const tr = npc.trainer;
    const teamDef = tr.rival ? rivalTeam(tr.rival, p.flags.starter) : tr.team;
    const strong = tr.badge || tr.rival || tr.champion || tr.boss;
    const party = teamDef.map(([sp, l, mv]) => createMon(sp, l, { ivMin: strong ? 18 : 6, moves: mv }));
    for (const m of party) this.seen(p, m.s);
    const name = `${tr.cls} ${tr.name}`;
    const map = MAPS[p.map];
    const b = new Battle({
      id: uid('b'), kind: 'trainer', env: map.bg, night: this.isNight(),
      sides: [
        { kind: 'player', name: p.name, playerId: p.id, party: p.party },
        { kind: 'ai', ai: tr.ai || (strong ? 'smart' : 'trainer'), name, party, items: tr.items },
      ],
    });
    const towards = OPPOSITE[p.dir];
    const pre = [];
    if (spotted) pre.push({ k: 'exclaim', npc: npc.id });
    pre.push({ k: 'dialog', name, npc: npc.id, face: spotted ? npc.dir : towards, lines: [this.fill(tr.intro || 'Souboj!', p)] });
    const music = tr.champion ? 'champion' : tr.badge || tr.boss ? 'leader' : tr.rival ? 'rival' : 'trainer';
    const rec = {
      id: b.id, battle: b, kind: 'trainer', sessions: [s, null],
      meta: { trainer: tr, npc, cls: tr.cls, tname: tr.name, look: npc.look, music, noBlackout: tr.rival === 1 },
    };
    this.beginBattle(rec, pre);
  }

  legendBattle(s, lg) {
    const p = s.p;
    if (!p.party.some((m) => m.hp > 0)) return;
    const pre = [{ k: 'dialog', lines: [lg.cry || `${SPECIES[lg.s].n}: Kíííí!`] }];
    this.startWild(s, lg.s, lg.lvl, MAPS[p.map], { legend: lg, ai: 'trainer', pre, music: 'legend' });
  }

  startPvp(a, b) {
    const clone = (party) => party.map((m) => { const c = deepClone(m); healFull(c); return c; });
    const battle = new Battle({
      id: uid('b'), kind: 'pvp', env: MAPS[a.p.map].bg,
      sides: [
        { kind: 'player', name: a.p.name, playerId: a.p.id, party: clone(a.p.party) },
        { kind: 'player', name: b.p.name, playerId: b.p.id, party: clone(b.p.party) },
      ],
    });
    const rec = { id: battle.id, battle, kind: 'pvp', sessions: [a, b], meta: { music: 'pvp' } };
    this.beginBattle(rec, [{ k: 'dialog', lines: [`Souboj trenérů: ${a.p.name} vs. ${b.p.name}!`] }]);
  }

  battleInfo(rec, si) {
    const b = rec.battle;
    const o = b.sides[1 - si];
    let look = rec.meta.look || null;
    if (o.kind === 'player') {
      const os = rec.sessions[1 - si];
      look = os && os.p ? os.p.look : null;
    }
    return {
      id: b.id, kind: b.kind, env: b.env, side: si, night: b.night, music: rec.meta.music,
      foe: { name: o.kind === 'player' ? o.name : rec.meta.tname || '', cls: o.kind === 'player' ? 'Trenér' : rec.meta.cls || null, kind: o.kind, look, count: o.party.length },
      party: b.sides[si].party.map(ownView),
    };
  }

  beginBattle(rec, pre) {
    this.battles.set(rec.id, rec);
    for (const ss of rec.sessions) {
      if (!ss) continue;
      ss.battle = rec;
      ss.ui = null;
      this.toMap(ss.p.map, { t: 'p_state', id: ss.p.id, battle: true }, ss);
    }
    rec.battle.start();
    const ev = rec.battle.flush();
    rec.sessions.forEach((ss, si) => {
      if (ss) ss.send({ t: 'battle_start', pre: pre || null, ...this.battleInfo(rec, si), events: ev, req: rec.battle.requestFor(si) });
    });
    this.armTimer(rec);
  }

  armTimer(rec) {
    clearTimeout(rec.timer);
    if (rec.kind !== 'pvp' || rec.battle.over) return;
    rec.timer = setTimeout(() => {
      const b = rec.battle;
      if (b.over) return;
      b.sides.forEach((side, si) => {
        if (side.need === 'switch') b.chooseSwitch(si, side.party.findIndex((m, i) => m.hp > 0 && i !== side.active));
        else if (side.need === 'action') {
          const mon = side.party[side.active];
          const usable = mon.moves.map((mv, i) => (mv.pp > 0 ? i : -1)).filter((i) => i >= 0);
          b.choose(si, { type: 'move', idx: usable.length ? pick(usable) : 0 });
        }
      });
      this.pumpBattle(rec);
    }, PVP_TURN_MS);
  }

  battleAction(s, m) {
    const rec = s.battle;
    if (!rec) return;
    const si = rec.sessions.indexOf(s);
    const a = m.a && typeof m.a === 'object' ? m.a : {};
    if (a.type === 'item' && !(s.p.bag[a.item] > 0)) return this.battleErr(s, rec, si, 'Tento předmět nemáš.');
    if (a.type === 'item' && rec.kind === 'wild' && rec.meta.legend && ITEMS[a.item] && ITEMS[a.item].cat === 'orb') {
      // legendy jdou chytit jen oslabené – žádné zvláštní pravidlo, jen informace
    }
    const r = rec.battle.choose(si, a);
    if (!r.ok) return this.battleErr(s, rec, si, r.msg || 'To teď nejde.');
    if (a.type === 'item') this.takeItem(s.p, a.item, 1);
    this.pumpBattle(rec);
  }

  battleSwitch(s, m) {
    const rec = s.battle;
    if (!rec) return;
    const si = rec.sessions.indexOf(s);
    const r = rec.battle.chooseSwitch(si, m.idx | 0);
    if (!r.ok) return this.battleErr(s, rec, si, r.msg || 'To teď nejde.');
    this.pumpBattle(rec);
  }

  battleErr(s, rec, si, msg) {
    s.send({ t: 'battle_err', msg, req: rec.battle.requestFor(si) });
  }

  pumpBattle(rec) {
    const b = rec.battle;
    const ev = b.flush();
    if (!ev.length && !b.over) return;
    rec.sessions.forEach((ss, si) => {
      if (ss) ss.send({ t: 'battle_ev', events: ev, req: b.over ? null : b.requestFor(si) });
    });
    if (b.over) this.finishBattle(rec);
    else this.armTimer(rec);
  }

  finishBattle(rec) {
    this.battles.delete(rec.id);
    clearTimeout(rec.timer);
    const b = rec.battle;
    const res = b.result || { winner: null, reason: 'faint' };
    rec.sessions.forEach((s, si) => {
      if (!s || !s.p) return;
      const p = s.p;
      s.battle = null;
      this.toMap(p.map, { t: 'p_state', id: p.id, battle: false }, s);
      const msgs = [];
      let outcome;
      let warp = null;
      if (rec.kind === 'pvp') {
        outcome = res.winner === si ? 'win' : res.winner == null ? 'draw' : 'lose';
        const other = b.sides[1 - si].name;
        if (outcome === 'win') {
          p.stats.pvpWins = (p.stats.pvpWins || 0) + 1;
          msgs.push(res.reason === 'disconnect' || res.reason === 'forfeit' ? `${other} vzdal souboj. Vyhrál jsi!` : `Porazil jsi hráče ${other}!`);
        } else if (outcome === 'lose') msgs.push(`Hráč ${other} tě porazil. Příště to vyjde!`);
        else msgs.push('Souboj skončil remízou.');
      } else {
        p.stats.battles = (p.stats.battles || 0) + 1;
        if (res.reason === 'catch') { outcome = 'catch'; this.addCaught(s, b, msgs, rec); }
        else if (res.reason === 'run') outcome = 'run';
        else if (res.winner === 0) { outcome = 'win'; p.stats.wins = (p.stats.wins || 0) + 1; this.battleWon(s, rec, msgs); }
        else {
          outcome = 'lose';
          if (rec.meta.noBlackout) {
            for (const m of p.party) healFull(m);
          } else warp = this.blackout(s, msgs);
        }
      }
      s.send({ t: 'battle_end', outcome, msgs: msgs.map((x) => this.fill(x, p)), me: this.meView(p) });
      if (warp) this.warpTo(s, warp.map, warp.x, warp.y, 'down');
      if (rec.kind !== 'pvp') this.queuePostBattle(s, b);
      const hook = rec.meta.trainer && rec.meta.trainer.rival === 1 ? 'rival1' : rec.meta.trainer && rec.meta.trainer.hook;
      if (hook && AFTER_HOOKS[hook]) AFTER_HOOKS[hook].call(this, s, outcome, rec);
      this.nextPrompt(s);
      s.dirty = true;
      this.save(s);
    });
  }

  battleWon(s, rec, msgs) {
    const p = s.p;
    if (rec.kind === 'trainer') {
      const tr = rec.meta.trainer;
      const npc = rec.meta.npc;
      p.trainers[npc.id] = true;
      if (tr.flagOnWin) p.flags[tr.flagOnWin] = true;
      if (tr.lose) msgs.push(`${tr.name}: „${tr.lose}“`);
      const money = tr.rival ? RIVAL_REWARD[tr.rival] || 500 : tr.reward || 100;
      p.money += money;
      msgs.push(`Za vítězství jsi dostal ${money} zl.`);
      if (tr.badge && !p.badges.includes(tr.badge)) {
        p.badges.push(tr.badge);
        p.badges.sort((a, b) => a - b);
        msgs.push(`Získal jsi Odznak ${BADGE_NAMES[tr.badge]}!`);
      }
      if (tr.tm && !p.bag[tr.tm]) {
        this.addItem(p, tr.tm, 1);
        msgs.push(`Dostal jsi ${ITEMS[tr.tm].n}!`);
      }
      if (tr.gift) {
        this.addItem(p, tr.gift.item, tr.gift.qty || 1);
        msgs.push(`Dostal jsi ${ITEMS[tr.gift.item].n}${(tr.gift.qty || 1) > 1 ? ' ×' + tr.gift.qty : ''}!`);
      }
      if (tr.champion && !p.flags.champion) {
        p.flags.champion = true;
        msgs.push('Gratuluji! Stal ses šampionem regionu Velhora!');
      }
    } else if (rec.meta.legend) {
      p.flags[rec.meta.legend.id] = true;
      msgs.push(`${SPECIES[rec.meta.legend.s].n} se rozplynul v dálce…`);
    }
  }

  addCaught(s, b, msgs, rec) {
    const p = s.p;
    const mon = b.caught;
    mon.ot = p.name;
    mon.otId = p.id;
    mon.orb = b.caughtOrb || 'orb';
    mon.met = MAPS[p.map].name;
    const isNew = !p.dex.caught[mon.s];
    this.caught(p, mon.s);
    p.stats.caught = (p.stats.caught || 0) + 1;
    if (isNew) msgs.push(`Údaje o tvorovi ${SPECIES[mon.s].n} byly zapsány do Atlasu.`);
    if (rec.meta.legend) p.flags[rec.meta.legend.id] = true;
    if (p.party.length < 6) {
      p.party.push(mon);
      msgs.push(`${monName(mon)} se přidal do tvého týmu!`);
    } else {
      const box = p.boxes.findIndex((bx) => bx.length < BOX_SIZE);
      if (box < 0) msgs.push('Všechny boxy jsou plné! Tvor se vrátil do divočiny.');
      else {
        healFull(mon);
        p.boxes[box].push(mon);
        msgs.push(`${monName(mon)} byl poslán do počítače (Box ${box + 1}).`);
      }
    }
  }

  blackout(s, msgs) {
    const p = s.p;
    const lost = Math.floor(p.money * 0.1);
    p.money -= lost;
    for (const m of p.party) healFull(m);
    msgs.push('Všichni tví tvorové omdleli!');
    if (lost) msgs.push(`V panice jsi ztratil ${lost} zl.`);
    msgs.push('Spěcháš zpátky do bezpečí…');
    return p.respawn || { map: START.map, x: 5, y: 5 };
  }

  queuePostBattle(s, b) {
    for (const L of b.pendingLearn) s.prompts.push({ k: 'learn', uid: L.uid, move: L.move });
    for (const m of s.p.party) {
      if (!b.leveled.has(m.uid)) continue;
      const to = levelEvolution(m);
      if (to) s.prompts.push({ k: 'evolve', uid: m.uid, to });
    }
  }

  findMon(p, uidv) {
    return p.party.find((m) => m.uid === uidv) || null;
  }

  nextPrompt(s) {
    if (s.prompt || !s.p) return;
    while (s.prompts.length) {
      const pr = s.prompts.shift();
      const mon = this.findMon(s.p, pr.uid);
      if (!mon) continue;
      if (pr.k === 'learn') {
        if (mon.moves.some((x) => x.id === pr.move)) continue;
        if (mon.moves.length < 4) {
          learnMove(mon, pr.move);
          this.dialog(s, [`${monName(mon)} se naučil ${MOVES[pr.move].n}!`]);
          continue;
        }
        s.prompt = pr;
        s.send({ t: 'learn', uid: mon.uid, move: pr.move, mon: ownView(mon) });
        return;
      }
      if (pr.k === 'evolve') {
        if (!pr.trade && levelEvolution(mon) !== pr.to) continue;
        s.prompt = pr;
        s.send({ t: 'evolve', uid: mon.uid, from: mon.s, to: pr.to, name: monName(mon), shiny: mon.shiny });
        return;
      }
    }
    this.sendMe(s);
  }

  learnReply(s, m) {
    const pr = s.prompt;
    if (!pr || pr.k !== 'learn') return;
    const mon = this.findMon(s.p, pr.uid);
    s.prompt = null;
    if (mon) {
      const idx = m.idx | 0;
      if (m.idx != null && idx >= 0 && idx < mon.moves.length) {
        const old = MOVES[mon.moves[idx].id].n;
        learnMove(mon, pr.move, idx);
        this.dialog(s, [`1, 2 a… Puf! ${monName(mon)} zapomněl ${old}…`, `…a naučil se ${MOVES[pr.move].n}!`]);
      } else this.dialog(s, [`${monName(mon)} se ${MOVES[pr.move].n} nenaučil.`]);
    }
    s.dirty = true;
    this.nextPrompt(s);
  }

  evolveReply(s, m) {
    const pr = s.prompt;
    if (!pr || pr.k !== 'evolve') return;
    const mon = this.findMon(s.p, pr.uid);
    s.prompt = null;
    if (mon) {
      if (m.ok) {
        const oldName = monName(mon);
        const newMoves = evolve(mon, pr.to);
        this.caught(s.p, pr.to);
        this.dialog(s, [`Gratuluji! ${oldName} se vyvinul v tvora ${SPECIES[pr.to].n}!`]);
        for (const mv of newMoves.reverse()) s.prompts.unshift({ k: 'learn', uid: mon.uid, move: mv });
      } else this.dialog(s, [`Hm? ${monName(mon)} se přestal vyvíjet.`]);
    }
    s.dirty = true;
    this.nextPrompt(s);
  }

  starterPick(s, m) {
    const p = s.p;
    if (!s.ui || s.ui.kind !== 'starter' || p.flags.starter) return;
    if (!STARTERS.includes(m.s)) return;
    s.ui = null;
    const mon = createMon(m.s, 5, { ot: p.name, otId: p.id, met: 'Lísková', ivMin: 10 });
    p.party.push(mon);
    p.flags.starter = m.s;
    this.caught(p, m.s);
    s.dirty = true;
    this.sendMe(s);
    const lab = MAPS.liskova_lab;
    const rival = lab.npcs.find((n) => n.id === 'lab_rival');
    this.dialog(s, [`${SPECIES[m.s].n} si tě hned oblíbil! Postarej se o něj dobře.`], { name: 'Profesorka Javorová', npc: 'prof' });
    if (rival) this.startTrainerBattle(s, rival, false);
  }

  // ---------- obchod ----------
  shopList(p, map) {
    const n = p.badges.length;
    const list = [];
    for (const [b, items] of SHOP_TIERS) if (n >= b) list.push(...items);
    for (const extra of map.shop || []) if (!list.includes(extra)) list.push(extra);
    return list;
  }

  uiOk(s, kind) {
    const u = s.ui;
    return u && u.kind === kind && u.map === s.p.map && u.x === s.p.x && u.y === s.p.y && !s.battle;
  }

  buy(s, m) {
    if (!this.uiOk(s, 'shop')) return;
    const p = s.p;
    const id = String(m.item);
    const qty = clamp(m.qty | 0, 1, 99);
    if (!s.ui.list.includes(id) || !ITEMS[id]) return;
    const cost = ITEMS[id].price * qty;
    if (p.money < cost) return s.send({ t: 'shop_res', ok: false, msg: 'Na to nemáš dost peněz.' });
    p.money -= cost;
    this.addItem(p, id, qty);
    let msg = `Koupil jsi ${ITEMS[id].n} ×${qty}.`;
    if (id === 'orb' && qty >= 10) {
      this.addItem(p, 'super_orb', Math.floor(qty / 10));
      msg += ` Jako bonus dostáváš ${Math.floor(qty / 10)}× Super orb!`;
    }
    s.dirty = true;
    s.send({ t: 'shop_res', ok: true, msg, me: this.meView(p) });
  }

  sell(s, m) {
    if (!this.uiOk(s, 'shop')) return;
    const p = s.p;
    const id = String(m.item);
    const it = ITEMS[id];
    const qty = clamp(m.qty | 0, 1, 99);
    if (!it || it.cat === 'key' || !it.price || (p.bag[id] || 0) < qty) return;
    const gain = Math.floor(it.price / 2) * qty;
    this.takeItem(p, id, qty);
    p.money += gain;
    s.dirty = true;
    s.send({ t: 'shop_res', ok: true, msg: `Prodal jsi ${it.n} ×${qty} za ${gain} zl.`, me: this.meView(p) });
  }

  // ---------- počítač ----------
  openPC(s) {
    const p = s.p;
    s.ui = { kind: 'pc', map: p.map, x: p.x, y: p.y };
    this.sendPC(s, 'Zapnul jsi počítač. Úložiště tvorů je připraveno.');
  }

  sendPC(s, msg) {
    const p = s.p;
    s.send({ t: 'pc', boxes: p.boxes.map((b) => b.map(ownView)), party: p.party.map(ownView), msg: msg || null });
  }

  pcOp(s, m) {
    if (!this.uiOk(s, 'pc')) return;
    const p = s.p;
    const box = clamp(m.box | 0, 0, BOX_COUNT - 1);
    const i = m.idx | 0;
    let msg = null;
    if (m.op === 'deposit') {
      const mon = p.party[i];
      if (!mon) return;
      if (p.party.length <= 1) msg = 'V týmu musí zůstat aspoň jeden tvor.';
      else if (!p.party.some((x, k) => k !== i && x.hp > 0)) msg = 'V týmu musí zůstat aspoň jeden zdravý tvor.';
      else if (p.boxes[box].length >= BOX_SIZE) msg = 'Tento box je plný.';
      else {
        p.party.splice(i, 1);
        healFull(mon);
        p.boxes[box].push(mon);
        msg = `${monName(mon)} uložen do Boxu ${box + 1}.`;
      }
    } else if (m.op === 'withdraw') {
      const mon = p.boxes[box][i];
      if (!mon) return;
      if (p.party.length >= 6) msg = 'Tvůj tým je plný (max. 6 tvorů).';
      else {
        p.boxes[box].splice(i, 1);
        p.party.push(mon);
        msg = `${monName(mon)} se přidal do týmu.`;
      }
    } else if (m.op === 'release') {
      const mon = p.boxes[box][i];
      if (!mon) return;
      p.boxes[box].splice(i, 1);
      msg = `${monName(mon)} byl vypuštěn do divočiny. Sbohem!`;
    } else if (m.op === 'move') {
      const to = clamp(m.to | 0, 0, BOX_COUNT - 1);
      const mon = p.boxes[box][i];
      if (!mon || to === box) return;
      if (p.boxes[to].length >= BOX_SIZE) msg = 'Cílový box je plný.';
      else {
        p.boxes[box].splice(i, 1);
        p.boxes[to].push(mon);
        msg = `${monName(mon)} přesunut do Boxu ${to + 1}.`;
      }
    } else return;
    s.dirty = true;
    this.sendPC(s, msg);
    this.sendMe(s);
  }

  // ---------- předměty mimo souboj ----------
  useItem(s, m) {
    if (s.busy) return;
    const p = s.p;
    const id = String(m.item);
    const it = ITEMS[id];
    if (!it || !(p.bag[id] > 0)) return this.notice(s, 'Tento předmět nemáš.');
    if (it.repel) {
      p.repel = it.repel;
      this.takeItem(p, id);
      this.sendMe(s);
      return this.dialog(s, [`Použil jsi ${it.n}. Slabí divocí tvorové se ti teď budou vyhýbat.`]);
    }
    if (it.cat === 'orb' || it.cat === 'key') return this.dialog(s, ['Teď to nelze použít.']);
    const mon = this.findMon(p, m.target);
    if (!mon) return;
    if (it.cat === 'hat') {
      if (mon.hat === id) return this.dialog(s, [`${monName(mon)} už ${it.n} nosí.`]);
      this.takeItem(p, id);
      const old = mon.hat;
      if (old && ITEMS[old]) this.addItem(p, old, 1);
      mon.hat = id;
      s.dirty = true;
      this.sendMe(s);
      if (p.party[0] === mon) this.toMap(p.map, { t: 'p_add', p: this.pubPlayer(s) }, s);
      return this.dialog(s, [`${monName(mon)} má teď na hlavě ${it.n}!${old && ITEMS[old] ? ` (${ITEMS[old].n} se vrátila do Batohu.)` : ''}`]);
    }
    if (it.cat === 'tm') {
      const mv = it.move;
      if (!canLearnTM(mon.s, mv)) return this.dialog(s, [`${monName(mon)} se útok ${MOVES[mv].n} nemůže naučit.`]);
      if (mon.moves.some((x) => x.id === mv)) return this.dialog(s, [`${monName(mon)} už útok ${MOVES[mv].n} umí.`]);
      if (mon.moves.length >= 4) {
        const r = m.replace | 0;
        if (m.replace == null || r < 0 || r >= mon.moves.length) return;
        const old = MOVES[mon.moves[r].id].n;
        learnMove(mon, mv, r);
        this.dialog(s, [`${monName(mon)} zapomněl ${old} a naučil se ${MOVES[mv].n}!`]);
      } else {
        learnMove(mon, mv);
        this.dialog(s, [`${monName(mon)} se naučil ${MOVES[mv].n}!`]);
      }
      s.dirty = true;
      return this.sendMe(s);
    }
    const err = itemUseError(it, mon);
    if (err) return this.dialog(s, [err]);
    this.takeItem(p, id);
    s.dirty = true;
    if (it.rare) {
      const sp = SPECIES[mon.s];
      const need = Math.max(1, expNeed(sp.gr, mon));
      const res = gainExp(mon, need);
      this.dialog(s, [`${monName(mon)} postoupil na úroveň ${mon.lvl}!`]);
      for (const mv of res.newMoves) s.prompts.push({ k: 'learn', uid: mon.uid, move: mv });
      const to = levelEvolution(mon);
      if (to) s.prompts.push({ k: 'evolve', uid: mon.uid, to });
      this.sendMe(s);
      return this.nextPrompt(s);
    }
    const mh = maxHp(mon);
    const out = [];
    if (it.revive) {
      mon.hp = Math.max(1, Math.floor(mh * it.revive));
      mon.status = null;
      out.push(`${monName(mon)} se probral!`);
    }
    if (it.heal) {
      const before = mon.hp;
      mon.hp = Math.min(mh, mon.hp + it.heal);
      out.push(`${monName(mon)} si obnovil ${mon.hp - before} HP.`);
    }
    if (it.cure && mon.status && (it.cure.includes('all') || it.cure.includes(mon.status))) {
      mon.status = null;
      mon.slp = 0;
      out.push(`${monName(mon)} je vyléčený!`);
    }
    if (it.pp) {
      for (const mv of mon.moves) mv.pp = Math.min(MOVES[mv.id].pp, mv.pp + it.pp);
      out.push(`${monName(mon)} má obnovené PP.`);
    }
    this.sendMe(s);
    this.dialog(s, out.length ? out : ['Nic se nestalo.']);
  }

  unhat(s, m) {
    if (s.battle || s.trade) return;
    const p = s.p;
    const mon = this.findMon(p, m.uid);
    if (!mon || !mon.hat) return;
    const id = mon.hat;
    mon.hat = null;
    if (ITEMS[id]) this.addItem(p, id, 1);
    s.dirty = true;
    this.sendMe(s);
    if (p.party[0] === mon) this.toMap(p.map, { t: 'p_add', p: this.pubPlayer(s) }, s);
    this.notice(s, `${monName(mon)} sundal ${ITEMS[id] ? ITEMS[id].n : 'čepici'}. Je zpátky v Batohu.`);
  }

  partySwap(s, m) {
    if (s.battle || s.trade) return;
    const p = s.p;
    const a = m.a | 0;
    const b = m.b | 0;
    if (!p.party[a] || !p.party[b] || a === b) return;
    [p.party[a], p.party[b]] = [p.party[b], p.party[a]];
    s.dirty = true;
    this.sendMe(s);
    this.toMap(p.map, { t: 'p_add', p: this.pubPlayer(s) }, s);
  }

  rename(s, m) {
    const p = s.p;
    const mon = this.findMon(p, m.uid) || p.boxes.flat().find((x) => x.uid === m.uid);
    if (!mon) return;
    const nick = String(m.nick || '').trim().normalize('NFC');
    if (nick && !/^[\p{L}\p{N} _.\-!?]{1,12}$/u.test(nick)) return this.notice(s, 'Přezdívka může mít 1–12 znaků.');
    mon.nick = nick && nick !== SPECIES[mon.s].n ? nick : null;
    s.dirty = true;
    this.sendMe(s);
  }

  // ---------- chat ----------
  chat(s, m) {
    const p = s.p;
    const text = String(m.text || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '').trim().slice(0, 140);
    if (!text) return;
    const now = Date.now();
    s.chatBucket = Math.min(4, s.chatBucket + (now - s.chatRefill) / 1500);
    s.chatRefill = now;
    if (s.chatBucket < 1) return this.notice(s, 'Píšeš moc rychle, zpomal trochu.');
    s.chatBucket -= 1;
    if (text === '/who' || text === '/hraci') return this.who(s);
    this.broadcast({ t: 'chat', id: p.id, name: p.name, text, map: p.map, mapName: MAPS[p.map].name, champ: !!p.flags.champion });
  }

  who(s) {
    const list = [...this.online.values()].filter((o) => o.p).map((o) => ({ id: o.p.id, name: o.p.name, map: MAPS[o.p.map].name, battle: !!o.battle, badges: o.p.badges.length, champ: !!o.p.flags.champion }));
    s.send({ t: 'who', list });
  }

  // ---------- výzvy a výměny ----------
  target(s, id) {
    const o = this.online.get(String(id));
    if (!o || o === s || !o.p) { this.notice(s, 'Hráč už není online.'); return null; }
    return o;
  }

  challenge(s, m) {
    const o = this.target(s, m.id);
    if (!o) return;
    if (s.busy) return this.notice(s, 'Teď nemůžeš nikoho vyzvat.');
    if (!s.p.party.some((x) => x.hp > 0)) return this.notice(s, 'Nemáš žádného tvora schopného boje.');
    if (o.busy) return this.notice(s, `${o.p.name} je právě zaneprázdněný.`);
    this.challenges.set(o.p.id, { from: s.p.id, t: Date.now() });
    o.send({ t: 'challenge', from: { id: s.p.id, name: s.p.name, badges: s.p.badges.length } });
    this.notice(s, `Vyzval jsi hráče ${o.p.name} k souboji. Čeká se na odpověď…`);
  }

  challengeReply(s, m) {
    const c = this.challenges.get(s.p.id);
    if (!c || c.from !== String(m.id)) return;
    this.challenges.delete(s.p.id);
    const o = this.online.get(c.from);
    if (!o || !o.p) return this.notice(s, 'Vyzyvatel už není online.');
    if (!m.ok) return this.notice(o, `${s.p.name} odmítl souboj.`);
    if (s.busy || o.busy) return this.notice(s, 'Souboj teď nelze začít.');
    if (!s.p.party.some((x) => x.hp > 0) || !o.p.party.some((x) => x.hp > 0)) return this.notice(s, 'Jeden z vás nemá tvora schopného boje.');
    s.ui = null;
    o.ui = null;
    this.startPvp(o, s);
  }

  tradeRequest(s, m) {
    const o = this.target(s, m.id);
    if (!o) return;
    if (s.busy) return this.notice(s, 'Teď nemůžeš měnit.');
    if (o.busy) return this.notice(s, `${o.p.name} je právě zaneprázdněný.`);
    this.tradeReqs.set(o.p.id, { from: s.p.id, t: Date.now() });
    o.send({ t: 'trade_req', from: { id: s.p.id, name: s.p.name } });
    this.notice(s, `Nabídl jsi výměnu hráči ${o.p.name}. Čeká se na odpověď…`);
  }

  tradeReply(s, m) {
    const c = this.tradeReqs.get(s.p.id);
    if (!c || c.from !== String(m.id)) return;
    this.tradeReqs.delete(s.p.id);
    const o = this.online.get(c.from);
    if (!o || !o.p) return this.notice(s, 'Hráč už není online.');
    if (!m.ok) return this.notice(o, `${s.p.name} odmítl výměnu.`);
    if (s.busy || o.busy) return this.notice(s, 'Výměnu teď nelze začít.');
    const t = { id: uid('t'), a: o, b: s, offer: [null, null], ready: [false, false] };
    o.trade = t;
    s.trade = t;
    o.ui = null;
    s.ui = null;
    this.sendTrade(t);
  }

  sendTrade(t) {
    [t.a, t.b].forEach((s, i) => {
      const other = i === 0 ? t.b : t.a;
      const mine = t.offer[i] ? s.p.party.find((x) => x.uid === t.offer[i]) : null;
      const theirs = t.offer[1 - i] ? other.p.party.find((x) => x.uid === t.offer[1 - i]) : null;
      s.send({
        t: 'trade', other: other.p.name, party: s.p.party.map(ownView),
        mine: mine ? mine.uid : null, theirs: theirs ? ownView(theirs) : null,
        ready: t.ready[i], theirReady: t.ready[1 - i],
      });
    });
  }

  tradeOffer(s, m) {
    const t = s.trade;
    if (!t) return;
    const i = t.a === s ? 0 : 1;
    const mon = s.p.party.find((x) => x.uid === m.uid);
    if (!mon) return;
    t.offer[i] = mon.uid;
    t.ready = [false, false];
    this.sendTrade(t);
  }

  tradeReady(s, m) {
    const t = s.trade;
    if (!t) return;
    const i = t.a === s ? 0 : 1;
    if (!t.offer[0] || !t.offer[1]) return;
    t.ready[i] = !!m.ok;
    if (t.ready[0] && t.ready[1]) return this.executeTrade(t);
    this.sendTrade(t);
  }

  executeTrade(t) {
    const pa = t.a.p;
    const pb = t.b.p;
    const ia = pa.party.findIndex((x) => x.uid === t.offer[0]);
    const ib = pb.party.findIndex((x) => x.uid === t.offer[1]);
    if (ia < 0 || ib < 0) return this.cancelTrade(t, 'Výměna se nezdařila.');
    const ma = pa.party[ia];
    const mb = pb.party[ib];
    pa.party[ia] = mb;
    pb.party[ib] = ma;
    this.caught(pa, mb.s);
    this.caught(pb, ma.s);
    t.a.trade = null;
    t.b.trade = null;
    for (const [s, got, gave] of [[t.a, mb, ma], [t.b, ma, mb]]) {
      s.send({ t: 'trade_done', got: ownView(got), gave: ownView(gave), me: this.meView(s.p) });
      const to = tradeEvolution(got);
      if (to) s.prompts.push({ k: 'evolve', uid: got.uid, to, trade: true });
      s.dirty = true;
      this.save(s);
      this.nextPrompt(s);
      this.toMap(s.p.map, { t: 'p_add', p: this.pubPlayer(s) }, s);
    }
  }

  cancelTrade(t, msg) {
    for (const s of [t.a, t.b]) {
      if (s.trade !== t) continue;
      s.trade = null;
      s.send({ t: 'trade_end', msg });
    }
  }

  tradeCancel(s) {
    if (s.trade) this.cancelTrade(s.trade, `${s.p.name} výměnu zrušil.`);
  }
}

function expNeed(gr, mon) {
  return expForLevel(gr, mon.lvl + 1) - mon.exp;
}

// ---------- skripty NPC ----------
const SCRIPTS = {
  mom(s, npc, face) {
    const p = s.p;
    const opts = { name: npc.name, npc: npc.id, face };
    if (!p.flags.intro) {
      p.flags.intro = true;
      s.dirty = true;
      this.sendMe(s);
      return this.dialog(s, [
        '{name}! Konečně jsi vzhůru.',
        'Profesorka Javorová tě dnes čeká v laboratoři. Říkala, že pro tebe má něco moc důležitého!',
        'Laboratoř je na jihu vesnice, hned u rybníčku. Tak utíkej!',
      ], opts);
    }
    if (p.party.length) {
      for (const m of p.party) healFull(m);
      this.sendMe(s);
      return this.seq(s, [
        { k: 'dialog', ...opts, lines: ['Vypadáš unaveně, {name}. Odpočiň si chvilku…'] },
        { k: 'heal' },
        { k: 'dialog', ...opts, lines: ['Tak! Tví tvorové jsou zase plní sil. Dávej na sebe pozor!'] },
      ]);
    }
    return this.dialog(s, ['Laboratoř je na jihu vesnice. Profesorka už čeká!'], opts);
  },

  prof(s, npc, face) {
    const p = s.p;
    const opts = { name: npc.name, npc: npc.id, face };
    if (!p.flags.starter) {
      s.ui = { kind: 'starter' };
      return this.seq(s, [
        { k: 'dialog', ...opts, lines: [
          'Á, {name}! Vítej v mé laboratoři.',
          'Svět Velhory je plný tvorů. Někteří žijí v trávě, jiní ve vodě, v jeskyních nebo vysoko v horách.',
          'Lidé a tvorové spolu žijí jako přátelé. Společně trénují, cestují a zažívají dobrodružství.',
          'Tady na stole mám tři mladé tvory. Jednoho si vyber – bude to tvůj první parťák!',
        ] },
        { k: 'starter' },
      ]);
    }
    const seen = Object.keys(p.dex.seen).length;
    const caught = Object.keys(p.dex.caught).length;
    const comment = caught < 10 ? 'Je to dobrý začátek! Chytej dál.' : caught < 30 ? 'Pěkná sbírka! Jen tak dál.' : caught < 60 ? 'Úžasné! Brzy budeš znát celou Velhoru.' : 'Neuvěřitelné! Jsi opravdový mistr tvorů!';
    return this.dialog(s, [`Jak se daří, {name}? V Atlasu máš ${seen} viděných a ${caught} chycených tvorů.`, comment], opts);
  },

  heal(s, npc, face) {
    const p = s.p;
    for (const m of p.party) healFull(m);
    const map = MAPS[p.map];
    if (map.respawn) p.respawn = { map: map.id, x: map.respawn.x, y: map.respawn.y };
    s.dirty = true;
    this.sendMe(s);
    const opts = { name: npc.name, npc: npc.id, face };
    this.seq(s, [
      { k: 'dialog', ...opts, lines: ['Vítej v Centru tvorů!', 'Postarám se o tvé tvory. Chvilku strpení…'] },
      { k: 'heal' },
      { k: 'dialog', ...opts, lines: ['Hotovo! Tví tvorové jsou zase plní sil.', 'Ať se ti daří, {name}!'] },
    ]);
  },

  hats(s, npc) {
    const p = s.p;
    const list = [];
    for (const [b, items] of HAT_TIERS) if (p.badges.length >= b) list.push(...items);
    s.ui = { kind: 'shop', map: p.map, x: p.x, y: p.y, list };
    s.send({ t: 'shop', name: npc.name, hats: true, items: list.map((id) => ({ id, price: ITEMS[id].price })) });
  },

  shop(s, npc) {
    const p = s.p;
    const list = this.shopList(p, MAPS[p.map]);
    s.ui = { kind: 'shop', map: p.map, x: p.x, y: p.y, list };
    s.send({ t: 'shop', name: npc.name, items: list.map((id) => ({ id, price: ITEMS[id].price })) });
  },

  hint(s, npc, face) {
    const p = s.p;
    const n = p.badges.length;
    const hints = [
      'Prvním vedoucím stadionu je Bořek v Mlýnově, na sever po Cestě 1.',
      'Hana v Rybníkově na východě čeká na vyzyvatele.',
      'Viktor v Jiskrově za Šedou jeskyní používá elektrické tvory.',
      'Libuše v Hájově, uprostřed Temného hvozdu, vládne rostlinám.',
      'Dorota ve Strašíně za Blaty má stadion plný přízraků.',
      'Radek v Mrazově vysoko v horách je mistrem ledu.',
      'Máš všech šest odznaků! Vydej se přes Cestu 7 na Korunu a vyzvi šampiona!',
    ];
    this.dialog(s, [hints[Math.min(n, 6)]], { name: npc.name, npc: npc.id, face });
  },
};

// ---------- háčky po souboji ----------
const AFTER_HOOKS = {
  rival1(s) {
    const p = s.p;
    p.flags.rival1 = true;
    for (const m of p.party) healFull(m);
    if (!p.flags.orbs) {
      p.flags.orbs = true;
      this.addItem(p, 'orb', 5);
      this.addItem(p, 'atlas', 1);
    }
    s.dirty = true;
    this.sendMe(s);
    this.seq(s, [
      { k: 'dialog', name: 'Ondra', npc: 'lab_rival', lines: ['Páni, to byl souboj! Jdu trénovat. Uvidíme se na cestě, {name}!'] },
      { k: 'hide', npc: 'lab_rival' },
      { k: 'dialog', name: 'Profesorka Javorová', npc: 'prof', lines: [
        'To byl ale napínavý souboj! Tvoji tvorové jsou teď zase zdraví.',
        'Tady máš pět Orbů. Hoď je po oslabeném divokém tvorovi a možná ho chytíš.',
        'A tohle je Atlas tvorů – zaznamená každého tvora, kterého potkáš.',
        'V regionu Velhora je šest stadionů. Když porazíš jejich vedoucí, můžeš vyzvat samotného šampiona!',
        'Vydej se po Cestě 1 na sever do Mlýnova. Hodně štěstí, {name}!',
      ] },
      { k: 'dialog', lines: ['Dostal jsi 5× Orb a Atlas tvorů!'] },
    ]);
  },
};

const HANDLERS = {
  move: Game.prototype.move,
  face: Game.prototype.face,
  interact: Game.prototype.interact,
  starter: Game.prototype.starterPick,
  battle: Game.prototype.battleAction,
  bswitch: Game.prototype.battleSwitch,
  learn: Game.prototype.learnReply,
  evolve: Game.prototype.evolveReply,
  item: Game.prototype.useItem,
  unhat: Game.prototype.unhat,
  buy: Game.prototype.buy,
  sell: Game.prototype.sell,
  pc: Game.prototype.pcOp,
  swap: Game.prototype.partySwap,
  rename: Game.prototype.rename,
  chat: Game.prototype.chat,
  who: Game.prototype.who,
  challenge: Game.prototype.challenge,
  challenge_reply: Game.prototype.challengeReply,
  trade_req: Game.prototype.tradeRequest,
  trade_reply: Game.prototype.tradeReply,
  trade_offer: Game.prototype.tradeOffer,
  trade_ready: Game.prototype.tradeReady,
  trade_cancel: Game.prototype.tradeCancel,
  close: function close(s) { if (s.ui && s.ui.kind !== 'starter') s.ui = null; },
  ping: function ping(s) { s.send({ t: 'pong' }); },
};
