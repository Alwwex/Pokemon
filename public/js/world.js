// Herní svět: stav mapy, pohyb hráče, ostatní hráči a NPC. Kreslí ho zvolený renderer (2D nebo 3D).
import { MAPS, passable, warpAt, edgeTarget } from '/shared/maps/index.js';
import { DIRS } from '/shared/tiles.js';
import { TS } from './gfx/tiles.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { UI } from './ui.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class World {
  constructor(app) {
    this.app = app;
    this.renderer = null;
    this.map = null;
    this.player = { x: 0, y: 0, dir: 'down', px: 0, py: 0, moving: false, frame: 0, lift: 0, parity: false, walkT: 0 };
    this.others = new Map();
    this.npcState = new Map();
    this.pending = false;
    this.pendingSince = 0;
    this.locked = false;
    this.fade = 0;
    this.lastBump = 0;
    this.turnedAt = 0;
    this.trail = [];
    this.grassStep = null;
  }

  setRenderer(r) {
    this.renderer = r;
    if (this.map) r.setMap(this.map, this);
  }

  setMap(mapId, x, y, dir, players = []) {
    this.map = MAPS[mapId];
    const p = this.player;
    Object.assign(p, { x, y, dir, px: x * TS, py: y * TS, moving: false, frame: 0, lift: 0 });
    this.trail = [];
    this.others.clear();
    for (const o of players) this.addPlayer(o);
    this.npcState.clear();
    for (const n of this.map.npcs) this.npcState.set(n.id, { dir: n.dir, until: 0, exclaim: 0, hidden: false });
    this.pending = false;
    if (this.renderer) this.renderer.setMap(this.map, this);
  }

  // ---------- ostatní hráči ----------
  addPlayer(o) {
    const prev = this.others.get(o.id);
    this.others.set(o.id, {
      ...o,
      px: o.x * TS, py: o.y * TS, fromX: o.x, fromY: o.y, t: 1, dur: 200, moving: false, frame: 0, lift: 0,
      bubble: prev ? prev.bubble : null, trail: prev ? prev.trail : [],
    });
  }

  movePlayer(id, x, y, dir, run, jump) {
    const o = this.others.get(id);
    if (!o) return;
    const dist = Math.abs(o.x - x) + Math.abs(o.y - y);
    o.dir = dir;
    o.trail = [{ x: o.x, y: o.y }, ...(o.trail || [])].slice(0, 3);
    if (dist > 2) { o.x = x; o.y = y; o.px = x * TS; o.py = y * TS; o.moving = false; o.trail = []; return; }
    o.fromX = o.px / TS;
    o.fromY = o.py / TS;
    o.x = x;
    o.y = y;
    o.t = 0;
    o.dur = jump ? 380 : run ? 125 : 215;
    o.jump = !!jump;
    o.moving = true;
    o.parity = !o.parity;
  }

  // ---------- pohyb hráče ----------
  canControl() {
    return !this.locked && !this.pending && !UI.isOpen() && !this.app.busy();
  }

  update(dt, now) {
    const p = this.player;
    if (!this.map) return;
    if (this.pending && now - this.pendingSince > 2500) this.pending = false;
    if (p.moving) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.px = lerp(p.fromX, p.toX, k) * TS;
      p.py = lerp(p.fromY, p.toY, k) * TS;
      p.lift = p.jump ? Math.sin(k * Math.PI) * 7 : 0;
      p.frame = k < 0.5 ? (p.parity ? 1 : 2) : 0;
      p.walkT += dt;
      if (k >= 1) {
        p.moving = false;
        p.frame = 0;
        p.x = p.toX;
        p.y = p.toY;
        this.onStepDone(now);
      }
    }
    if (!p.moving && this.canControl()) {
      const d = input.dir();
      if (d) this.tryMove(d, now);
    }
    for (const o of this.others.values()) {
      if (!o.moving) continue;
      o.t += dt;
      const k = Math.min(1, o.t / o.dur);
      o.px = lerp(o.fromX, o.x, k) * TS;
      o.py = lerp(o.fromY, o.y, k) * TS;
      o.lift = o.jump ? Math.sin(k * Math.PI) * 7 : 0;
      o.frame = k < 0.5 ? (o.parity ? 1 : 2) : 0;
      if (k >= 1) { o.moving = false; o.frame = 0; o.px = o.x * TS; o.py = o.y * TS; }
    }
    for (const n of this.map.npcs) {
      if (!n.turn || n.trainer) continue;
      const st = this.npcState.get(n.id);
      if (st && now > st.until) {
        st.until = now + 2500 + Math.random() * 4000;
        if (Math.random() < 0.5) st.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      }
    }
  }

  tryMove(d, now) {
    const p = this.player;
    const app = this.app;
    if (p.dir !== d) {
      // krátký stisk jiného směru jen otočí postavu
      p.dir = d;
      app.send({ t: 'face', dir: d });
      this.turnedAt = now;
      return;
    }
    if (this.turnedAt && now - this.turnedAt < 120) return;
    const map = this.map;
    const ctx = app.ctx();
    const run = input.isRunning();
    if (warpAt(map, p.x, p.y, d)) {
      app.send({ t: 'move', dir: d });
      this.pending = true;
      this.pendingSince = now;
      audio.sfx('door');
      return;
    }
    const nx = p.x + DIRS[d].dx;
    const ny = p.y + DIRS[d].dy;
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) {
      const tg = edgeTarget(map, p.x, p.y, d);
      if (tg && passable(tg.map, tg.x, tg.y, ctx)) {
        app.send({ t: 'move', dir: d });
        this.pending = true;
        this.pendingSince = now;
      } else this.bump(now);
      return;
    }
    if (map.rows[ny][nx] === '^') {
      if (d === 'down' && ny + 1 < map.h && passable(map, nx, ny + 1, ctx)) {
        this.step(nx, ny + 1, 380, true);
        app.send({ t: 'move', dir: d });
        audio.sfx('jump');
      } else this.bump(now);
      return;
    }
    if (!passable(map, nx, ny, ctx)) { this.bump(now); return; }
    this.step(nx, ny, run ? 125 : 215, false);
    app.send({ t: 'move', dir: d, run });
  }

  step(nx, ny, dur, jump) {
    const p = this.player;
    this.trail = [{ x: p.x, y: p.y }, ...this.trail].slice(0, 3);
    Object.assign(p, { fromX: p.x, fromY: p.y, toX: nx, toY: ny, moving: true, t: 0, dur, jump, parity: !p.parity });
    if (this.map.rows[ny][nx] === ',') this.grassStep = { x: nx, y: ny, t: performance.now() };
  }

  bump(now) {
    if (now - this.lastBump > 350) { audio.sfx('bump'); this.lastBump = now; }
  }

  onStepDone(now) {
    const p = this.player;
    if (warpAt(this.map, p.x, p.y, null)) {
      this.pending = true;
      this.pendingSince = now;
      audio.sfx('door');
    }
  }

  snapTo(x, y, dir) {
    const p = this.player;
    Object.assign(p, { x, y, dir: dir || p.dir, px: x * TS, py: y * TS, moving: false, frame: 0, lift: 0 });
    this.trail = [];
    this.pending = false;
  }

  front() {
    const p = this.player;
    return { x: p.x + DIRS[p.dir].dx, y: p.y + DIRS[p.dir].dy };
  }

  playerAt(x, y) {
    for (const o of this.others.values()) if (o.x === x && o.y === y) return o;
    return null;
  }

  draw(now) {
    if (this.renderer && this.map) this.renderer.draw(this, now);
  }
}
