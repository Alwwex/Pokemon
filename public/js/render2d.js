// Klasický 2D pixelový renderer světa (záložní režim pro slabší zařízení).
import { npcVisible, itemVisible, legendVisible } from '/shared/maps/index.js';
import { renderMap, TS, drawOrb, tallGrassOverlay } from './gfx/tiles.js';
import { drawChar } from './gfx/chars.js';
import { monSprite } from './gfx/monart.js';
import { drawNameTag, drawBubble, playerLabel } from './labels.js';

const OUTDOOR = new Set(['town', 'route', 'forest', 'swamp', 'snow', 'mountain']);

export class Renderer2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.view = document.createElement('canvas');
    this.vg = this.view.getContext('2d');
    this.snow = [];
    this.zoom = 3;
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
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
  }

  setMap(map) {
    this.map = map;
    this.rendered = renderMap(map);
    this.grassOverlay = tallGrassOverlay(map);
    this.snow = [];
  }

  draw(world, now) {
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
    const map = world.map;
    if (!map || this.map !== map) { if (map) this.setMap(map); else return; }
    const p = world.player;
    const mw = map.w * TS;
    const mh = map.h * TS;
    let cx = p.px + 8 - vw / 2;
    let cy = p.py + 8 - vh / 2;
    cx = mw > vw ? Math.max(0, Math.min(mw - vw, cx)) : (mw - vw) / 2;
    cy = mh > vh ? Math.max(0, Math.min(mh - vh, cy)) : (mh - vh) / 2;
    cx = Math.round(cx);
    cy = Math.round(cy);
    const frame = Math.floor(now / 650) % 2;
    vg.drawImage(this.rendered.frames[frame], -cx, -cy);

    const ctx = world.app.ctx();
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
      const st = world.npcState.get(n.id);
      if (st && st.hidden) continue;
      list.push({ y: n.y * TS, fn: () => drawChar(vg, n.look, st ? st.dir : n.dir, 0, n.x * TS - cx, n.y * TS - cy) });
    }
    for (const o of world.others.values()) {
      list.push({ y: o.py + 0.5, fn: () => drawChar(vg, o.look, o.dir, o.frame, Math.round(o.px) - cx, Math.round(o.py) - cy, { lift: o.lift }), tall: o });
    }
    list.push({ y: p.py + 0.6, fn: () => drawChar(vg, world.app.me().look, p.dir, p.frame, Math.round(p.px) - cx, Math.round(p.py) - cy, { lift: p.lift }), tall: p });
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.fn();
    for (const e of list) {
      if (!e.tall) continue;
      const tx = Math.round(e.tall.px / TS);
      const ty = Math.round(e.tall.py / TS);
      if (map.rows[ty] && map.rows[ty][tx] === ',' && !e.tall.lift) vg.drawImage(this.grassOverlay, tx * TS - cx, ty * TS + 8 - cy);
    }
    vg.drawImage(this.rendered.over, -cx, -cy);
    if (map.theme === 'snow' || map.theme === 'mountain') this.drawSnow(vg, vw, vh, now);
    const hour = new Date().getHours();
    if (OUTDOOR.has(map.theme)) {
      if (hour >= 20 || hour < 6) { vg.fillStyle = 'rgba(16,24,70,0.38)'; vg.fillRect(0, 0, vw, vh); }
      else if (hour >= 18) { vg.fillStyle = 'rgba(255,120,40,0.12)'; vg.fillRect(0, 0, vw, vh); }
    }
    for (const n of map.npcs) {
      const st = world.npcState.get(n.id);
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
    g.clearRect(0, 0, W, H);
    g.drawImage(this.view, 0, 0, vw * z, vh * z);
    // jmenovky a bubliny
    const fs = Math.max(11, Math.round(4 * z * 0.9));
    for (const o of world.others.values()) {
      const x = (o.px + 8 - cx) * z;
      const y = (o.py - 7 - cy - (o.lift || 0)) * z;
      const l = playerLabel(o);
      drawNameTag(g, x, y, l.text, l.color, fs);
      if (o.bubble && o.bubble.until > now) drawBubble(g, x, y - fs - 4, o.bubble.text, fs);
    }
    if (p.bubble && p.bubble.until > now) drawBubble(g, (p.px + 8 - cx) * z, (p.py - 9 - cy) * z, p.bubble.text, fs);
    if (world.fade > 0) { g.fillStyle = `rgba(0,0,0,${world.fade})`; g.fillRect(0, 0, W, H); }
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
}
