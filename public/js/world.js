// Herní svět: vykreslení mapy, pohyb hráče, ostatní hráči a NPC.
import { MAPS, npcVisible, itemVisible, legendVisible, passable, warpAt, edgeTarget } from '/shared/maps/index.js';
import { DIRS } from '/shared/tiles.js';
import { renderMap, TS, drawOrb, tallGrassOverlay } from './gfx/tiles.js';
import { drawChar } from './gfx/chars.js';
import { monSprite } from './gfx/monart.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { UI } from './ui.js';

const OUTDOOR = new Set(['town', 'route', 'forest', 'swamp', 'snow', 'mountain']);
const lerp = (a, b, t) => a + (b - a) * t;

export class World {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.app = app;
    this.view = document.createElement('canvas');
    this.vg = this.view.getContext('2d');
    this.map = null;
    this.rendered = null;
    this.player = { x: 0, y: 0, dir: 'down', px: 0, py: 0, moving: false, frame: 0, lift: 0, parity: false };
    this.others = new Map();
    this.npcState = new Map();
    this.pending = false;
    this.pendingSince = 0;
    this.locked = false;
    this.zoom = 3;
    this.fade = 0;
    this.lastBump = 0;
    this.snow = [];
    this.lastFace = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = Math.floor(window.innerWidth * dpr);
    const H = Math.floor(window.innerHeight * dpr);
    this.canvas.width = W;
    this.canvas.height = H;
    const portrait = H > W;
    const tw = portrait ? 11 : 15;
    const th = portrait ? 15 : 10;
    this.zoom = Math.max(1, Math.floor(Math.min(W / (TS * tw), H / (TS * th))));
    this.dpr = dpr;
  }

  setMap(mapId, x, y, dir, players = []) {
    this.map = MAPS[mapId];
    this.rendered = renderMap(this.map);
    this.grassOverlay = tallGrassOverlay(this.map);
    const p = this.player;
    Object.assign(p, { x, y, dir, px: x * TS, py: y * TS, moving: false, frame: 0, lift: 0 });
    this.others.clear();
    for (const o of players) this.addPlayer(o);
    this.npcState.clear();
    for (const n of this.map.npcs) this.npcState.set(n.id, { dir: n.dir, until: 0, exclaim: 0, hidden: false });
    this.pending = false;
    this.snow = [];
  }

  // ---------- ostatní hráči ----------
  addPlayer(o) {
    const prev = this.others.get(o.id);
    this.others.set(o.id, {
      ...o,
      px: o.x * TS, py: o.y * TS, fromX: o.x, fromY: o.y, t: 1, dur: 200, moving: false, frame: 0, lift: 0,
      bubble: prev ? prev.bubble : null,
    });
  }

  movePlayer(id, x, y, dir, run, jump) {
    const o = this.others.get(id);
    if (!o) return;
    const dist = Math.abs(o.x - x) + Math.abs(o.y - y);
    o.dir = dir;
    if (dist > 2) { o.x = x; o.y = y; o.px = x * TS; o.py = y * TS; o.moving = false; return; }
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
    if (this.pending && now - this.pendingSince > 2500) this.pending = false;
    if (p.moving) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.px = lerp(p.fromX, p.toX, k) * TS;
      p.py = lerp(p.fromY, p.toY, k) * TS;
      p.lift = p.jump ? Math.sin(k * Math.PI) * 7 : 0;
      p.frame = k < 0.5 ? (p.parity ? 1 : 2) : 0;
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
    // NPC, kteří se rozhlížejí
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
    Object.assign(p, { fromX: p.x, fromY: p.y, toX: nx, toY: ny, moving: true, t: 0, dur, jump, parity: !p.parity });
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

  // ---------- kreslení ----------
  draw(now) {
    const g = this.g;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const z = this.zoom;
    const vw = Math.ceil(W / z);
    const vh = Math.ceil(H / z);
    if (this.view.width !== vw || this.view.height !== vh) { this.view.width = vw; this.view.height = vh; }
    const vg = this.vg;
    vg.imageSmoothingEnabled = false;
    vg.fillStyle = '#0c0a14';
    vg.fillRect(0, 0, vw, vh);
    if (!this.map) return;
    const map = this.map;
    const p = this.player;
    const mw = map.w * TS;
    const mh = map.h * TS;
    let cx = p.px + 8 - vw / 2;
    let cy = p.py + 8 - vh / 2;
    cx = mw > vw ? Math.max(0, Math.min(mw - vw, cx)) : (mw - vw) / 2;
    cy = mh > vh ? Math.max(0, Math.min(mh - vh, cy)) : (mh - vh) / 2;
    cx = Math.round(cx);
    cy = Math.round(cy);
    this.cam = { x: cx, y: cy };
    const frame = Math.floor(now / 650) % 2;
    vg.drawImage(this.rendered.frames[frame], -cx, -cy);

    const ctx = this.app.ctx();
    const list = [];
    for (const it of map.items) {
      if (!itemVisible(it, ctx)) continue;
      list.push({ y: it.y * TS, fn: () => { drawOrb(vg, it.x * TS + 8 - cx, it.y * TS + 9 - cy, 4); if (Math.floor(now / 400 + it.x) % 5 === 0) { vg.fillStyle = '#fff'; vg.fillRect(it.x * TS + 10 - cx, it.y * TS + 4 - cy, 1, 1); } } });
    }
    for (const lg of map.legends) {
      if (!legendVisible(lg, ctx)) continue;
      const spr = monSprite(lg.s, 32);
      const bob = Math.sin(now / 400) * 1.5;
      list.push({ y: lg.y * TS, fn: () => vg.drawImage(spr, lg.x * TS - 8 - cx, lg.y * TS - 14 + bob - cy) });
    }
    for (const n of map.npcs) {
      if (!npcVisible(n, ctx)) continue;
      const st = this.npcState.get(n.id);
      if (st && st.hidden) continue;
      list.push({ y: n.y * TS, fn: () => drawChar(vg, n.look, st ? st.dir : n.dir, 0, n.x * TS - cx, n.y * TS - cy) });
    }
    for (const o of this.others.values()) {
      list.push({ y: o.py + 0.5, fn: () => drawChar(vg, o.look, o.dir, o.frame, Math.round(o.px) - cx, Math.round(o.py) - cy, { lift: o.lift }), tall: o });
    }
    list.push({ y: p.py + 0.6, fn: () => drawChar(vg, this.app.me().look, p.dir, p.frame, Math.round(p.px) - cx, Math.round(p.py) - cy, { lift: p.lift }), tall: p });
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.fn();
    // vysoká tráva přes nohy
    for (const e of list) {
      if (!e.tall) continue;
      const tx = Math.round(e.tall.px / TS);
      const ty = Math.round(e.tall.py / TS);
      if (map.rows[ty] && map.rows[ty][tx] === ',' && !e.tall.lift) vg.drawImage(this.grassOverlay, tx * TS - cx, ty * TS + 8 - cy);
    }
    vg.drawImage(this.rendered.over, -cx, -cy);
    // počasí a denní doba
    if (map.theme === 'snow' || map.theme === 'mountain') this.drawSnow(vg, vw, vh, now);
    const hour = new Date().getHours();
    if (OUTDOOR.has(map.theme)) {
      if (hour >= 20 || hour < 6) { vg.fillStyle = 'rgba(16,24,70,0.38)'; vg.fillRect(0, 0, vw, vh); }
      else if (hour >= 18) { vg.fillStyle = 'rgba(255,120,40,0.12)'; vg.fillRect(0, 0, vw, vh); }
    }
    if (map.dark) {
      const grd = vg.createRadialGradient(p.px + 8 - cx, p.py + 8 - cy, 20, p.px + 8 - cx, p.py + 8 - cy, 110);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.78)');
      vg.fillStyle = grd;
      vg.fillRect(0, 0, vw, vh);
    }
    // ! nad NPC
    for (const n of map.npcs) {
      const st = this.npcState.get(n.id);
      if (st && st.exclaim > now) {
        const x = n.x * TS - cx + 4;
        const y = n.y * TS - cy - 18;
        vg.fillStyle = '#fff';
        vg.fillRect(x, y, 8, 10);
        vg.fillStyle = '#e8443a';
        vg.fillRect(x + 3, y + 1, 2, 5);
        vg.fillRect(x + 3, y + 7, 2, 2);
      }
    }
    g.imageSmoothingEnabled = false;
    g.drawImage(this.view, 0, 0, vw * z, vh * z);
    this.drawLabels(g, z, cx, cy, now);
    if (this.fade > 0) { g.fillStyle = `rgba(0,0,0,${this.fade})`; g.fillRect(0, 0, W, H); }
  }

  drawSnow(vg, vw, vh, now) {
    while (this.snow.length < 60) this.snow.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.3 + Math.random() * 0.7 });
    vg.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.snow) {
      f.y += f.s * 0.6;
      f.x += Math.sin(now / 700 + f.s * 10) * 0.25;
      if (f.y > vh) { f.y = -2; f.x = Math.random() * vw; }
      vg.fillRect(Math.round(f.x), Math.round(f.y), f.s > 0.7 ? 2 : 1, f.s > 0.7 ? 2 : 1);
    }
  }

  drawLabels(g, z, cx, cy, now) {
    const fs = Math.max(11, Math.round(4 * z * 0.9));
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.lineJoin = 'round';
    const label = (o, name, color) => {
      const x = (o.px + 8 - cx) * z;
      const y = (o.py - 7 - cy - (o.lift || 0)) * z;
      g.font = `700 ${fs}px "Pixelify Sans", sans-serif`;
      g.lineWidth = Math.max(3, z);
      g.strokeStyle = 'rgba(20,16,30,0.9)';
      g.strokeText(name, x, y);
      g.fillStyle = color;
      g.fillText(name, x, y);
      if (o.bubble && o.bubble.until > now) this.drawBubble(g, x, y - fs - 4, o.bubble.text, fs);
    };
    for (const o of this.others.values()) {
      label(o, (o.battle ? '⚔ ' : '') + (o.champ ? '♛ ' : '') + o.name, o.champ ? '#ffd84a' : '#ffffff');
    }
    const p = this.player;
    if (p.bubble && p.bubble.until > now) this.drawBubble(g, (p.px + 8 - cx) * z, (p.py - 9 - cy) * z, p.bubble.text, fs);
  }

  drawBubble(g, x, y, text, fs) {
    g.font = `400 ${fs}px "Pixelify Sans", sans-serif`;
    const maxW = fs * 16;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    const shown = lines.slice(0, 3);
    const lh = fs * 1.15;
    const w = Math.min(maxW, Math.max(...shown.map((l) => g.measureText(l).width))) + fs;
    const h = shown.length * lh + fs * 0.5;
    const bx = x - w / 2;
    const by = y - h;
    g.fillStyle = 'rgba(251,247,238,0.96)';
    g.strokeStyle = '#2b2742';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(bx, by, w, h, 8);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(x - 5, by + h);
    g.lineTo(x, by + h + 7);
    g.lineTo(x + 5, by + h);
    g.fill();
    g.fillStyle = '#1d1a2c';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    shown.forEach((l, i) => g.fillText(l, x, by + fs * 0.25 + i * lh));
    g.textBaseline = 'bottom';
  }
}
