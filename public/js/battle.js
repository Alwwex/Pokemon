// Scéna souboje: kreslení, animace útoků a přehrávání událostí ze serveru.
import { SPECIES } from '/shared/species.js';
import { MOVES } from '/shared/moves.js';
import { TYPES } from '/shared/types.js';
import { expProgress } from '/shared/formulas.js';
import { monSprite } from './gfx/monart.js';
import { trainerPortrait } from './gfx/chars.js';
import { drawOrb } from './gfx/tiles.js';
import { shade, rgba } from './gfx/util.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { UI, h, makeMenu, pickMon, openBag, showSummary, typeBadge, toast, ask } from './ui.js';

const TOK = new RegExp(String.fromCharCode(1) + '(\\d)' + String.fromCharCode(2) + '([^' + String.fromCharCode(3) + ']*)' + String.fromCharCode(3), 'g');
const STATUS_SHORT = { brn: 'POP', par: 'OCH', psn: 'JED', tox: 'JED', slp: 'SPÍ', frz: 'MRZ' };
const ENVS = {
  grass: { sky: ['#7cc4f4', '#d8f0ff'], ground: ['#9ad870', '#6eb24e'], plat: '#5f9e44', far: '#78b860' },
  town: { sky: ['#86ccf6', '#e4f4ff'], ground: ['#d8c898', '#bca878'], plat: '#a89060', far: '#9cc8a0' },
  water: { sky: ['#78c0f0', '#d4eeff'], ground: ['#5aa0e0', '#3a80c8'], plat: '#cdb880', far: '#6aa8e0' },
  forest: { sky: ['#3e7a4e', '#86b878'], ground: ['#5e9a48', '#3e7a34'], plat: '#2e6a2a', far: '#2a5a34' },
  swamp: { sky: ['#6a8a78', '#b4c8a8'], ground: ['#7a9058', '#5a7040'], plat: '#4a6034', far: '#4e6a50' },
  cave: { sky: ['#2a2420', '#5a4c40'], ground: ['#7a6a5a', '#5a4c40'], plat: '#4a3e34', far: '#3a3028' },
  snow: { sky: ['#a8d0f0', '#eef8ff'], ground: ['#f4f8ff', '#d4e4f4'], plat: '#b8cce4', far: '#dce8f6' },
  mountain: { sky: ['#8ab8e0', '#e0eef8'], ground: ['#b8b098', '#988e78'], plat: '#7e7462', far: '#9aa0a8' },
  gym: { sky: ['#3a3450', '#6a6080'], ground: ['#c8c0b0', '#a8a090'], plat: '#8a8274', far: '#4a4460' },
  castle: { sky: ['#2a2238', '#5a4a6a'], ground: ['#7a7a88', '#5a5a68'], plat: '#4a4a58', far: '#3a3048' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (k) => 1 - Math.pow(1 - k, 3);

export class BattleScene {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.app = app;
    this.active = false;
    this.anims = [];
    this.parts = [];
  }

  // ---------- pomocné ----------
  rel(side) { return side === this.mySide ? 0 : 1; }
  text(t) {
    const prefix = this.kind === 'wild' ? 'divoký ' : this.kind === 'pvp' ? 'soupeřův ' : 'nepřátelský ';
    const s = String(t).replace(TOK, (_, side, name) => (Number(side) === this.mySide ? name : prefix + name));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  tween(dur, fn) {
    return new Promise((resolve) => this.anims.push({ t0: performance.now(), dur, fn, resolve }));
  }
  layout() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const portrait = H > W * 1.1;
    const uiH = (portrait ? 250 : 160) * Math.min(dpr, 3);
    const usable = H - uiH;
    const s = Math.min(W, usable * 1.5);
    this.L = {
      W, H, portrait,
      foe: { x: W * (portrait ? 0.68 : 0.7), y: usable * (portrait ? 0.48 : 0.5), size: Math.round(s * (portrait ? 0.42 : 0.3)) },
      me: { x: W * (portrait ? 0.3 : 0.27), y: usable * (portrait ? 0.93 : 0.97), size: Math.round(s * (portrait ? 0.52 : 0.4)) },
    };
    this.bg = null;
  }

  makeBg() {
    const { W, H } = this.L;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const env = ENVS[this.env] || ENVS.grass;
    const horizon = this.L.foe.y - this.L.foe.size * 0.35;
    let grd = g.createLinearGradient(0, 0, 0, horizon);
    grd.addColorStop(0, this.night ? shade(env.sky[0], -0.55) : env.sky[0]);
    grd.addColorStop(1, this.night ? shade(env.sky[1], -0.5) : env.sky[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, horizon);
    // vzdálené kopce / stromy
    g.fillStyle = this.night ? shade(env.far, -0.45) : env.far;
    g.beginPath();
    g.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 12) {
      const hh = (Math.sin(x * 0.013 + (this.env.length || 1)) * 0.5 + 0.6) * H * 0.08;
      g.quadraticCurveTo(x + W / 24, horizon - hh * 1.4, x + W / 12, horizon);
    }
    g.lineTo(W, horizon);
    g.fill();
    if (this.env === 'cave' || this.env === 'castle') {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 9; i++) g.fillRect((i / 9) * W + 10, 0, 6, horizon * (0.3 + (i % 3) * 0.2));
    }
    grd = g.createLinearGradient(0, horizon, 0, H);
    grd.addColorStop(0, this.night ? shade(env.ground[0], -0.45) : env.ground[0]);
    grd.addColorStop(1, this.night ? shade(env.ground[1], -0.45) : env.ground[1]);
    g.fillStyle = grd;
    g.fillRect(0, horizon, W, H - horizon);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) g.fillRect(0, horizon + ((H - horizon) * i) / 6, W, 2);
    const plat = (p, rx) => {
      g.fillStyle = this.night ? shade(env.plat, -0.4) : env.plat;
      g.beginPath();
      g.ellipse(p.x, p.y, rx, rx * 0.26, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = Math.max(2, rx * 0.025);
      g.beginPath();
      g.ellipse(p.x, p.y - rx * 0.02, rx * 0.95, rx * 0.22, 0, Math.PI, Math.PI * 2);
      g.stroke();
    };
    plat(this.L.foe, this.L.foe.size * 0.62);
    plat(this.L.me, this.L.me.size * 0.62);
    this.bg = c;
  }

  // ---------- DOM ----------
  buildUI() {
    this.root = h('div', { id: 'battle-ui' });
    const mkInfo = (cls) => {
      const el = h('div', { class: 'binfo hide ' + cls });
      el.innerHTML = `<div class="top"><span class="nm"></span><span class="stc"></span><span class="lv"></span></div><div class="hprow"><span class="lbl">HP</span><div class="hp"><i></i></div></div>${cls === 'me' ? '<div class="hpn"></div><div class="exp"><i></i></div>' : ''}`;
      this.root.appendChild(el);
      return el;
    };
    this.infoFoe = mkInfo('foe');
    this.infoMe = mkInfo('me');
    this.balls = h('div', { class: 'balls' });
    this.root.appendChild(this.balls);
    this.msgEl = h('div', { class: 'bmsg' });
    this.cmdEl = h('div', { class: 'bcmd hidden' });
    this.root.appendChild(h('div', { class: 'bbox' }, this.msgEl, this.cmdEl));
    this.waitEl = h('div', { class: 'wait hidden' }, 'Čekám na soupeře…');
    this.root.appendChild(this.waitEl);
    this.msgEl.addEventListener('click', () => this.skipText());
    document.body.appendChild(this.root);
    document.body.classList.add('in-battle');
  }

  setInfo(rel, mon, animateHp = false) {
    const el = rel === 0 ? this.infoMe : this.infoFoe;
    if (!mon) { el.classList.add('hide'); return; }
    el.classList.remove('hide');
    el.querySelector('.nm').textContent = mon.nick || SPECIES[mon.s].n;
    el.querySelector('.nm').className = 'nm' + (mon.shiny ? ' shiny' : '');
    el.querySelector('.lv').textContent = `Úr. ${mon.lvl}`;
    const stc = el.querySelector('.stc');
    stc.innerHTML = '';
    if (mon.status) stc.appendChild(h('span', { class: 'st ' + mon.status }, STATUS_SHORT[mon.status]));
    if (!animateHp) this.drawHp(rel, mon.hp, mon.mhp);
    if (rel === 0) {
      const own = this.party && this.party.find((m) => m.uid === mon.uid);
      if (own) this.setExp(this.expFrac(own));
    }
    this.positionBalls();
  }

  drawHp(rel, hp, mhp) {
    const el = rel === 0 ? this.infoMe : this.infoFoe;
    const f = mhp ? Math.max(0, Math.min(1, hp / mhp)) : 0;
    const bar = el.querySelector('.hp');
    bar.className = 'hp' + (f < 0.2 ? ' low' : f < 0.5 ? ' mid' : '');
    bar.querySelector('i').style.width = `${f * 100}%`;
    bar.querySelector('i').style.transition = 'none';
    if (rel === 0) el.querySelector('.hpn').textContent = `${Math.max(0, Math.round(hp))} / ${mhp}`;
  }

  async animHp(rel, to, mhp) {
    const mon = this.mons[rel];
    if (!mon) return;
    const from = mon.hp;
    mon.hp = to;
    mon.mhp = mhp;
    const dur = Math.min(900, 250 + Math.abs(to - from) / Math.max(1, mhp) * 900);
    await this.tween(dur, (k) => this.drawHp(rel, from + (to - from) * ease(k), mhp));
  }

  expFrac(m) {
    return m.expFrac ?? 0;
  }

  setExp(f) {
    const i = this.infoMe.querySelector('.exp > i');
    if (i) i.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`;
  }

  positionBalls() {
    if (this.kind === 'wild' || this.infoFoe.classList.contains('hide')) { this.balls.innerHTML = ''; return; }
    const r = this.infoFoe.getBoundingClientRect();
    this.balls.style.left = `${r.left}px`;
    this.balls.style.top = `${r.bottom + 6}px`;
    this.balls.innerHTML = '';
    for (let i = 0; i < this.foeCount; i++) this.balls.appendChild(h('i', { class: i < this.foeFainted ? 'out' : '' }));
  }

  // ---------- text ----------
  say(t, opts = {}) {
    return new Promise((resolve) => {
      const text = this.text(t);
      const el = this.msgEl;
      el.textContent = '';
      let pos = 0;
      const speed = Math.max(8, UI.textSpeed * 0.75);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(this.typer);
        el.textContent = text;
        this.skip = null;
        setTimeout(resolve, opts.wait ?? 650);
      };
      this.skip = () => {
        if (pos < text.length) { pos = text.length; el.textContent = text; clearInterval(this.typer); setTimeout(finish, 120); } else finish();
      };
      clearInterval(this.typer);
      this.typer = setInterval(() => {
        pos += 1;
        el.textContent = text.slice(0, pos);
        if (pos >= text.length) { clearInterval(this.typer); setTimeout(finish, 10); }
      }, speed);
    });
  }

  skipText() { if (this.skip) this.skip(); }

  // ---------- start ----------
  async start(msg) {
    this.active = true;
    this.id = msg.id;
    this.kind = msg.kind;
    this.mySide = msg.side;
    this.env = msg.env || 'grass';
    this.night = !!msg.night;
    this.foe = msg.foe;
    this.party = msg.party.map((m) => ({ ...m, expFrac: expProgress(m).frac }));
    this.foeCount = msg.foe.count || 1;
    this.foeFainted = 0;
    this.mons = [null, null];
    this.spr = [this.newSprite(), this.newSprite()];
    this.weather = null;
    this.firstFoeSend = true;
    this.trainerImg = msg.foe.look ? trainerPortrait(msg.foe.look, 8) : null;
    this.trainerX = null;
    this.layout();
    this.buildUI();
    this.onResize = () => { this.layout(); this.positionBalls(); };
    window.addEventListener('resize', this.onResize);
    audio.music(msg.music || 'wild');
    this.removeKey = input.onPress((act) => this.onKey(act));
    // přechod
    this.flash = 1;
    await this.tween(700, (k) => { this.flash = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k * 0.3); });
    this.flash = 0;
    this.intro = 1;
    if (this.kind !== 'wild' && this.trainerImg) {
      this.trainerX = 1;
      await this.tween(500, (k) => { this.trainerX = 1 - ease(k); this.intro = 1 - ease(k); });
      const cls = this.foe.cls ? `${this.foe.cls} ` : '';
      await this.say(this.kind === 'pvp' ? `${this.foe.name} tě vyzývá k souboji!` : `${cls}${this.foe.name} tě vyzývá k souboji!`);
      await this.tween(400, (k) => { this.trainerX = ease(k) * 1.2; });
      this.trainerX = null;
    } else {
      await this.tween(500, (k) => { this.intro = 1 - ease(k); });
    }
    this.intro = 0;
    await this.play(msg.events);
    this.handleReq(msg.req);
  }

  newSprite() {
    return { visible: false, scale: 1, alpha: 1, dx: 0, dy: 0, flash: false, white: 0 };
  }

  async onEvents(msg) {
    this.hideCmd();
    await this.play(msg.events);
    if (!msg.req) return;
    this.handleReq(msg.req);
  }

  async play(events) {
    for (const ev of events || []) {
      switch (ev.e) {
        case 'txt': await this.say(ev.t); break;
        case 'send': await this.sendOut(this.rel(ev.side), ev.mon); break;
        case 'recall': await this.recall(this.rel(ev.side)); break;
        case 'use': await this.moveAnim(this.rel(ev.side), ev.mv); break;
        case 'hit': await this.hitAnim(this.rel(ev.side), ev); break;
        case 'hp': await this.animHp(this.rel(ev.side), ev.hp, ev.mhp); this.syncParty(this.rel(ev.side)); break;
        case 'st': {
          const r = this.rel(ev.side);
          if (this.mons[r]) { this.mons[r].status = ev.st; this.setInfo(r, this.mons[r], true); }
          if (ev.st) this.statusFx(r, ev.st);
          this.syncParty(r);
          break;
        }
        case 'stat': await this.statAnim(this.rel(ev.side), ev.up); break;
        case 'faint': await this.faintAnim(this.rel(ev.side)); break;
        case 'miss': break;
        case 'ball': await this.ballAnim(ev); break;
        case 'exp': await this.expAnim(ev); break;
        case 'lvl': this.levelUp(ev); break;
        case 'wx': this.weather = ev.wx; break;
        default:
      }
    }
  }

  syncParty(r) {
    if (r !== 0 || !this.mons[0]) return;
    const m = this.party.find((x) => x.uid === this.mons[0].uid);
    if (m) { m.hp = this.mons[0].hp; m.status = this.mons[0].status; }
  }

  async sendOut(rel, mon) {
    const own = rel === 0 ? this.party.find((m) => m.uid === mon.uid) : null;
    this.mons[rel] = { ...mon, expFrac: own ? own.expFrac : 0 };
    const sp = this.spr[rel];
    if (rel === 1 && this.kind === 'wild' && this.firstFoeSend) {
      this.firstFoeSend = false;
      Object.assign(sp, { visible: true, scale: 1, alpha: 1, dx: 0, dy: 0 });
      sp.slide = 1;
      audio.cry(mon.s);
      await this.tween(450, (k) => { sp.slide = 1 - ease(k); });
      sp.slide = 0;
      this.setInfo(1, this.mons[1]);
      await this.say(`Divoký ${mon.nick || SPECIES[mon.s].n} se objevil!${mon.shiny ? ' ✨' : ''}`);
      return;
    }
    if (rel === 0) await this.say(`Do toho, ${mon.nick || SPECIES[mon.s].n}!`, { wait: 200 });
    else await this.say(`${this.foe.name} posílá do boje ${mon.nick || SPECIES[mon.s].n}!`, { wait: 200 });
    audio.sfx('pop');
    Object.assign(sp, { visible: true, scale: 0.05, alpha: 1, dx: 0, dy: 0, white: 1 });
    this.burst(this.center(rel), '#ffffff', 14, 'star');
    await this.tween(380, (k) => { sp.scale = 0.05 + 0.95 * ease(k); sp.white = 1 - k; });
    sp.white = 0;
    audio.cry(mon.s);
    this.setInfo(rel, this.mons[rel]);
    if (mon.shiny) { this.burst(this.center(rel), '#ffe84a', 16, 'star'); await sleep(400); }
  }

  async recall(rel) {
    const mon = this.mons[rel];
    const sp = this.spr[rel];
    if (mon) await this.say(rel === 0 ? `${mon.nick || SPECIES[mon.s].n}, vrať se!` : `${this.foe.name} stahuje ${mon.nick || SPECIES[mon.s].n}.`, { wait: 200 });
    await this.tween(300, (k) => { sp.scale = 1 - k; sp.white = k; });
    sp.visible = false;
    sp.white = 0;
    this.setInfo(rel, null);
  }

  center(rel) {
    const p = rel === 0 ? this.L.me : this.L.foe;
    return { x: p.x, y: p.y - p.size * 0.38 };
  }

  // ---------- animace ----------
  burst(c, color, n = 10, shape = 'dot', opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 4) * (0.4 + Math.random());
      this.parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0), life: 1, decay: 0.02 + Math.random() * 0.02, color, size: (opts.size || 6) * (0.6 + Math.random() * 0.8), shape, g: opts.g || 0 });
    }
  }

  async projectile(from, to, color, shape, n = 14, dur = 420) {
    const parts = [];
    for (let i = 0; i < n; i++) parts.push({ off: Math.random() * 0.35, j: (Math.random() - 0.5) * 30 });
    await this.tween(dur, (k) => {
      for (const p of parts) {
        const t = Math.min(1, Math.max(0, (k - p.off) / (1 - p.off)));
        if (t <= 0 || t >= 1) continue;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 40 + p.j * Math.sin(t * 9);
        if (Math.random() < 0.6) this.parts.push({ x, y, vx: 0, vy: 0, life: 0.6, decay: 0.08, color, size: 7, shape, g: 0 });
      }
    });
  }

  async moveAnim(rel, moveId) {
    const mv = MOVES[moveId];
    if (!mv) return;
    const type = mv.t || 'normal';
    const col = TYPES[type] ? TYPES[type].color : '#ffffff';
    const A = this.center(rel);
    const D = this.center(1 - rel);
    const spA = this.spr[rel];
    const shapes = { fire: 'dot', water: 'drop', plant: 'leaf', electric: 'bolt', ice: 'shard', toxic: 'bubble', fae: 'star', mind: 'ring', spirit: 'dot', dragon: 'dot', shadow: 'dot', metal: 'star', bug: 'dot', air: 'ring', earth: 'rock', stone: 'rock', brawl: 'star', normal: 'star' };
    const shape = shapes[type] || 'dot';
    const targetsFoe = mv.c !== 'X' || mv.st || mv.cf || mv.fs || mv.seed;
    if (mv.c === 'X') {
      if (targetsFoe) { audio.sfx('throw'); await this.projectile(A, D, col, shape, 10, 380); this.burst(D, col, 10, shape); }
      else {
        audio.sfx('stat_up');
        for (let i = 0; i < 3; i++) { this.burst(A, col, 8, 'ring', { speed: 2, size: 10 }); await sleep(120); }
      }
      await sleep(200);
      return;
    }
    const contact = mv.f && mv.f.includes('c');
    if (contact && mv.c === 'P') {
      const dx = (D.x - A.x) * 0.35;
      const dy = (D.y - A.y) * 0.35;
      await this.tween(160, (k) => { spA.dx = dx * ease(k); spA.dy = dy * ease(k); });
      this.burst(D, col, 12, shape, { speed: 5 });
      this.burst(D, '#ffffff', 6, 'star', { speed: 6 });
      await this.tween(200, (k) => { spA.dx = dx * (1 - k); spA.dy = dy * (1 - k); });
      spA.dx = 0;
      spA.dy = 0;
      return;
    }
    if (type === 'electric' || type === 'stone' || type === 'ice' && mv.p >= 100) {
      audio.sfx('throw');
      for (let i = 0; i < 5; i++) {
        const x = D.x + (Math.random() - 0.5) * this.L.foe.size * 0.5;
        this.parts.push({ x, y: D.y - this.L.H * 0.3, vx: 0, vy: 14, life: 1, decay: 0.03, color: col, size: 12, shape, g: 0.5 });
        await sleep(60);
      }
      await sleep(260);
      this.burst(D, col, 14, shape, { speed: 5 });
      if (type === 'electric') this.zap = { until: performance.now() + 250, x: D.x, y: D.y };
      return;
    }
    if (type === 'earth') {
      this.shake = { until: performance.now() + 500, amp: 10 };
      for (let i = 0; i < 10; i++) this.parts.push({ x: D.x + (Math.random() - 0.5) * 120, y: D.y + 60, vx: (Math.random() - 0.5) * 3, vy: -6 - Math.random() * 5, life: 1, decay: 0.025, color: '#9a7a52', size: 9, shape: 'rock', g: 0.35 });
      audio.sfx('hit');
      await sleep(450);
      return;
    }
    audio.sfx('throw');
    await this.projectile(A, D, col, shape, 16, mv.p >= 90 ? 520 : 400);
    this.burst(D, col, 14, shape, { speed: 5 });
  }

  async hitAnim(rel, ev) {
    const sp = this.spr[rel];
    audio.sfx(ev.eff > 1 ? 'super' : ev.eff < 1 ? 'weak' : 'hit');
    if (ev.crit || ev.eff > 1) this.shake = { until: performance.now() + 300, amp: ev.crit ? 9 : 6 };
    const hp = this.animHp(rel, ev.hp, ev.mhp);
    await this.tween(420, (k) => { sp.alpha = Math.floor(k * 8) % 2 ? 0.25 : 1; sp.dx = Math.sin(k * 30) * 8 * (1 - k); });
    sp.alpha = 1;
    sp.dx = 0;
    await hp;
    this.syncParty(rel);
  }

  statusFx(rel, st) {
    const col = { brn: '#ff7a3a', par: '#ffe84a', psn: '#b05ad8', tox: '#8a2ab0', slp: '#c8c8e8', frz: '#9ae4ff' }[st] || '#fff';
    this.burst(this.center(rel), col, 16, st === 'slp' ? 'ring' : 'dot', { speed: 3 });
  }

  async statAnim(rel, up) {
    audio.sfx(up ? 'stat_up' : 'stat_down');
    const c = this.center(rel);
    const col = up ? '#ff8a4a' : '#5a9aff';
    for (let i = 0; i < 14; i++) {
      this.parts.push({ x: c.x + (Math.random() - 0.5) * 120, y: c.y + (up ? 60 : -60), vx: 0, vy: up ? -3.5 : 3.5, life: 1, decay: 0.03, color: col, size: 8, shape: 'arrow' + (up ? 'u' : 'd'), g: 0 });
    }
    await sleep(500);
  }

  async faintAnim(rel) {
    const sp = this.spr[rel];
    if (this.mons[rel]) audio.cry(this.mons[rel].s);
    await sleep(250);
    audio.sfx('faint');
    await this.tween(500, (k) => { sp.dy = k * 80; sp.alpha = 1 - k; });
    sp.visible = false;
    sp.dy = 0;
    sp.alpha = 1;
    if (this.mons[rel]) this.mons[rel].hp = 0;
    this.syncParty(rel);
    if (rel === 1) this.foeFainted++;
    this.setInfo(rel, null);
  }

  async ballAnim(ev) {
    const D = this.center(1);
    const S = { x: this.L.W * 0.1, y: this.L.H * 0.8 };
    const sp = this.spr[1];
    const top = { orb: '#3a7ad8', super_orb: '#3aa84a', ultra_orb: '#2a2a32', rychly_orb: '#f2c42c', soumrakovy_orb: '#4a3a6a', sitovy_orb: '#2ab0b0', prizmaticky_orb: '#d84ad8' }[ev.item] || '#3a7ad8';
    this.orb = { x: S.x, y: S.y, top, rot: 0 };
    audio.sfx('throw');
    await this.tween(520, (k) => {
      this.orb.x = S.x + (D.x - S.x) * k;
      this.orb.y = S.y + (D.y - S.y) * k - Math.sin(k * Math.PI) * this.L.H * 0.25;
      this.orb.rot = k * 12;
    });
    audio.sfx('pop');
    this.burst(D, '#ffffff', 16, 'star');
    await this.tween(300, (k) => { sp.scale = 1 - k; sp.white = k; });
    sp.visible = false;
    const groundY = this.L.foe.y - 10;
    await this.tween(300, (k) => { this.orb.y = D.y + (groundY - D.y) * ease(k); this.orb.rot = 0; });
    for (let i = 0; i < ev.shakes; i++) {
      await sleep(350);
      audio.sfx('shake');
      await this.tween(380, (k) => { this.orb.rot = Math.sin(k * Math.PI * 2) * 0.5; });
    }
    await sleep(350);
    if (ev.ok) {
      this.burst({ x: this.orb.x, y: this.orb.y - 20 }, '#ffe84a', 18, 'star', { speed: 3, up: 2 });
      audio.jingle('caught');
      this.orb.dim = true;
      await sleep(1600);
      this.orb = null;
    } else {
      audio.sfx('pop');
      this.burst(D, '#ffffff', 14, 'star');
      this.orb = null;
      sp.visible = true;
      await this.tween(250, (k) => { sp.scale = k; sp.white = 1 - k; });
      sp.white = 0;
      sp.scale = 1;
    }
  }

  async expAnim(ev) {
    const own = this.party.find((m) => m.uid === ev.uid);
    if (own) own.expFrac = ev.to;
    if (!this.mons[0] || this.mons[0].uid !== ev.uid) return;
    const el = this.infoMe.querySelector('.exp > i');
    const go = (f) => new Promise((r) => { el.style.transition = 'width .45s'; el.style.width = `${f * 100}%`; setTimeout(r, 470); });
    for (let i = 0; i < ev.ups; i++) { await go(1); el.style.transition = 'none'; el.style.width = '0%'; await sleep(30); }
    await go(ev.to);
  }

  levelUp(ev) {
    const own = this.party.find((m) => m.uid === ev.uid);
    if (own) { own.lvl = ev.lvl; own.mhp = ev.mhp; own.hp = ev.hp; }
    audio.jingle('levelup');
    if (this.mons[0] && this.mons[0].uid === ev.uid) {
      Object.assign(this.mons[0], { lvl: ev.lvl, hp: ev.hp, mhp: ev.mhp });
      this.setInfo(0, this.mons[0]);
      this.burst(this.center(0), '#ffe84a', 16, 'star', { speed: 3, up: 2 });
    }
  }

  // ---------- příkazy ----------
  hideCmd() {
    this.cmdEl.classList.add('hidden');
    this.cmdEl.innerHTML = '';
    this.menu = null;
  }

  handleReq(req) {
    if (!req || !this.active) return;
    this.req = req;
    this.party = req.party.map((m) => ({ ...m, expFrac: expProgress(m).frac }));
    this.waitEl.classList.add('hidden');
    if (req.need === 'switch') return this.forcedSwitch();
    this.showActions();
  }

  showActions() {
    const req = this.req;
    const mon = req.party[req.active];
    this.msgEl.textContent = `Co udělá ${mon.nick || SPECIES[mon.s].n}?`;
    this.cmdEl.className = 'bcmd';
    this.cmdEl.innerHTML = '';
    const items = [
      { label: 'BOJOVAT', act: 'fight' },
      { label: 'BATOH', act: 'bag', disabled: !req.canItem },
      { label: 'TÝM', act: 'party' },
      { label: this.kind === 'pvp' ? 'VZDÁT SE' : 'UTÉCT', act: 'run', disabled: !req.canRun },
    ];
    this.menu = makeMenu(items, { cols: 2, start: this.lastCmd || 0, onSelect: (it, i) => { this.lastCmd = i; this.command(it.act); } });
    this.cmdEl.append(...this.menu.el.childNodes);
    this.menu.el = this.cmdEl;
  }

  showMoves() {
    const req = this.req;
    const mon = req.party[req.active];
    this.cmdEl.className = 'bcmd moves';
    this.cmdEl.innerHTML = '';
    const info = h('div', { class: 'minfo' });
    const items = mon.moves.map((mv, i) => {
      const md = MOVES[mv.id];
      return { node: h('span', {}, md.n, h('small', {}, `${md.t ? TYPES[md.t].name : ''} · PP ${mv.pp}/${mv.mpp}`)), idx: i, disabled: mv.pp <= 0, id: mv.id };
    });
    const allEmpty = mon.moves.every((m) => m.pp <= 0);
    const menu = makeMenu(items, {
      cols: 2,
      start: this.lastMove || 0,
      onFocus: (it) => {
        const md = MOVES[it.id];
        info.innerHTML = '';
        info.append(md.t ? typeBadge(md.t) : '', h('div', {}, { P: 'Fyzický', S: 'Speciální', X: 'Stavový' }[md.c]), h('div', {}, `Síla ${md.c === 'X' ? '—' : md.fx ? 'úr.' : md.p}`), h('div', {}, `Přesnost ${md.a ? md.a + ' %' : '—'}`));
      },
      onSelect: (it) => { this.lastMove = it.idx; this.act({ type: 'move', idx: it.idx }); },
      onCancel: () => this.showActions(),
    });
    if (allEmpty) items.forEach((it) => { it.disabled = false; });
    [...menu.el.childNodes].forEach((b, i) => {
      b.classList.add('mv');
      const md = MOVES[items[i].id];
      if (md.t) b.style.background = `linear-gradient(90deg, ${rgba(TYPES[md.t].color, 0.28)}, transparent)`;
      this.cmdEl.appendChild(b);
    });
    this.cmdEl.appendChild(info);
    menu.set(this.lastMove || 0);
    this.menu = menu;
  }

  async command(act) {
    const req = this.req;
    if (act === 'fight') return this.showMoves();
    if (act === 'run') {
      if (this.kind === 'pvp') {
        this.menu = null;
        const c = await ask('Opravdu se chceš vzdát?', ['Ne', 'Ano']);
        if (c !== 1) return this.showActions();
      }
      return this.act({ type: 'run' });
    }
    if (act === 'bag') {
      this.menu = null;
      const r = await openBag(this.app.uiCtx, { mode: 'battle', canCatch: req.canCatch, party: req.party });
      if (r) return this.act({ type: 'item', item: r.item, target: r.target });
      return this.showActions();
    }
    if (act === 'party') {
      this.menu = null;
      const i = await pickMon(req.party, { title: 'Tým', subtitle: 'Vyber tvora, kterého chceš poslat do boje.', start: req.active });
      if (i < 0) return this.showActions();
      const m = req.party[i];
      const c = await ask(`${m.nick || SPECIES[m.s].n}:`, ['Poslat do boje', 'Shrnutí', 'Zpět']);
      if (c === 1) { await showSummary(m); return this.showActions(); }
      if (c !== 0) return this.showActions();
      if (m.hp <= 0) { toast('Tento tvor nemůže bojovat!'); return this.showActions(); }
      if (i === req.active) { toast('Tento tvor už bojuje!'); return this.showActions(); }
      return this.act({ type: 'switch', idx: i });
    }
  }

  act(a) {
    this.hideCmd();
    this.app.send({ t: 'battle', a });
    if (this.kind === 'pvp') { this.waitEl.classList.remove('hidden'); this.msgEl.textContent = ''; }
  }

  async forcedSwitch() {
    this.hideCmd();
    this.msgEl.textContent = 'Vyber dalšího tvora!';
    const req = this.req;
    const i = await pickMon(req.party, {
      title: 'Kdo půjde do boje?',
      noCancel: true,
      disabled: (m, k) => (m.hp <= 0 ? 'Tento tvor nemůže bojovat!' : k === req.active ? 'Tento tvor už bojuje!' : false),
    });
    if (i >= 0) {
      this.app.send({ t: 'bswitch', idx: i });
      if (this.kind === 'pvp') this.waitEl.classList.remove('hidden');
    }
  }

  onError(msg) {
    toast(msg.msg || 'To teď nejde.');
    if (msg.req) this.handleReq(msg.req);
  }

  onKey(act) {
    if (!this.active || UI.isOpen()) return false;
    if (this.skip && (act === 'a' || act === 'b')) { this.skipText(); return true; }
    if (this.menu) { this.menu.key(act); return true; }
    return true;
  }

  async end(msg) {
    this.hideCmd();
    this.waitEl.classList.add('hidden');
    if (msg.outcome === 'win' || msg.outcome === 'catch') audio.stopMusic();
    if (msg.outcome === 'win') audio.jingle(this.kind === 'trainer' && msg.msgs.some((m) => m.includes('Odznak')) ? 'badge' : 'victory');
    for (const m of msg.msgs || []) await this.say(m, { wait: 900 });
    await sleep(300);
    await this.tween(450, (k) => { this.fadeOut = k; });
    this.destroy();
  }

  destroy() {
    this.active = false;
    this.fadeOut = 0;
    clearInterval(this.typer);
    if (this.removeKey) this.removeKey();
    window.removeEventListener('resize', this.onResize);
    if (this.root) this.root.remove();
    document.body.classList.remove('in-battle');
    this.anims = [];
    this.parts = [];
    this.orb = null;
  }

  // ---------- kreslení ----------
  update(now) {
    for (const a of [...this.anims]) {
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.fn(k);
      if (k >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.resolve(); }
    }
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.life -= p.decay;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  drawSprite(g, rel, now) {
    const sp = this.spr[rel];
    const mon = this.mons[rel];
    if (!sp.visible || !mon) return;
    const P = rel === 0 ? this.L.me : this.L.foe;
    const size = P.size;
    const img = monSprite(mon.s, size, { back: rel === 0, shiny: mon.shiny });
    const breathe = 1 + Math.sin(now / 420 + rel) * 0.015;
    const w = size * sp.scale;
    const hgt = size * sp.scale * breathe;
    let x = P.x - w / 2 + sp.dx;
    const y = P.y - hgt * 0.96 + sp.dy;
    if (sp.slide) x += (rel === 1 ? -1 : 1) * this.L.W * 0.8 * sp.slide;
    g.save();
    g.globalAlpha = sp.alpha;
    g.drawImage(img, x, y, w, hgt);
    if (sp.white > 0) {
      g.globalAlpha = sp.white;
      g.globalCompositeOperation = 'source-atop';
    }
    g.restore();
    if (sp.white > 0) {
      g.save();
      g.globalAlpha = sp.white * 0.85;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(P.x + sp.dx, P.y - hgt * 0.45, w * 0.35, hgt * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (mon.status === 'slp' && sp.alpha > 0.5) {
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.round(size * 0.12)}px "Pixelify Sans", sans-serif`;
      g.fillText('z', P.x + w * 0.3, y + hgt * 0.15 - Math.abs(Math.sin(now / 500)) * 10);
    }
  }

  drawPart(g, p) {
    g.globalAlpha = Math.max(0, Math.min(1, p.life));
    g.fillStyle = p.color;
    g.strokeStyle = p.color;
    const s = p.size;
    switch (p.shape) {
      case 'star':
        g.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s; const a = (i * Math.PI) / 4; g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
        g.fill();
        break;
      case 'ring':
        g.lineWidth = 3;
        g.beginPath();
        g.arc(p.x, p.y, s * (2 - p.life) * 1.5, 0, Math.PI * 2);
        g.stroke();
        break;
      case 'leaf':
        g.beginPath();
        g.ellipse(p.x, p.y, s, s * 0.45, p.x * 0.05, 0, Math.PI * 2);
        g.fill();
        break;
      case 'drop':
        g.beginPath();
        g.arc(p.x, p.y, s * 0.6, 0, Math.PI * 2);
        g.fill();
        break;
      case 'bolt':
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(p.x, p.y - s * 2);
        g.lineTo(p.x + s * 0.6, p.y - s * 0.5);
        g.lineTo(p.x - s * 0.4, p.y);
        g.lineTo(p.x + s * 0.5, p.y + s * 2);
        g.stroke();
        break;
      case 'shard':
        g.beginPath();
        g.moveTo(p.x, p.y - s);
        g.lineTo(p.x + s * 0.45, p.y);
        g.lineTo(p.x, p.y + s);
        g.lineTo(p.x - s * 0.45, p.y);
        g.fill();
        break;
      case 'bubble':
        g.lineWidth = 2;
        g.beginPath();
        g.arc(p.x, p.y, s * 0.7, 0, Math.PI * 2);
        g.stroke();
        break;
      case 'rock':
        g.fillRect(p.x - s / 2, p.y - s / 2, s, s * 0.8);
        break;
      case 'arrowu':
      case 'arrowd': {
        const d = p.shape === 'arrowu' ? -1 : 1;
        g.beginPath();
        g.moveTo(p.x, p.y + d * s);
        g.lineTo(p.x - s * 0.7, p.y);
        g.lineTo(p.x + s * 0.7, p.y);
        g.fill();
        break;
      }
      default:
        g.beginPath();
        g.arc(p.x, p.y, s * 0.5, 0, Math.PI * 2);
        g.fill();
    }
    g.globalAlpha = 1;
  }

  draw(now) {
    if (!this.active) return;
    const g = this.g;
    const { W, H } = this.L;
    if (!this.bg || this.bg.width !== W) this.makeBg();
    g.save();
    if (this.shake && this.shake.until > now) {
      const a = this.shake.amp;
      g.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }
    g.drawImage(this.bg, 0, 0);
    if (this.intro > 0) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H * 0.5 * this.intro);
      g.fillRect(0, H - H * 0.5 * this.intro, W, H * 0.5 * this.intro);
    }
    this.drawSprite(g, 1, now);
    this.drawSprite(g, 0, now);
    if (this.trainerX != null && this.trainerImg) {
      const s = this.L.foe.size * 1.05;
      const tw = s * (this.trainerImg.width / this.trainerImg.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(this.trainerImg, this.L.foe.x - tw / 2 + this.trainerX * W * 0.6, this.L.foe.y - s * 0.98, tw, s);
    }
    if (this.orb) {
      g.save();
      g.translate(this.orb.x, this.orb.y);
      g.rotate(this.orb.rot);
      const r = Math.round(this.L.foe.size * 0.07);
      g.imageSmoothingEnabled = false;
      drawOrb(g, 0, 0, r, this.orb.dim ? shade(this.orb.top, -0.3) : this.orb.top);
      g.restore();
    }
    for (const p of this.parts) this.drawPart(g, p);
    if (this.zap && this.zap.until > now) { g.fillStyle = 'rgba(255,255,200,0.25)'; g.fillRect(0, 0, W, H); }
    this.drawWeather(g, W, H, now);
    if (this.flash) { g.fillStyle = `rgba(255,255,255,${this.flash})`; g.fillRect(0, 0, W, H); }
    if (this.fadeOut) { g.fillStyle = `rgba(0,0,0,${this.fadeOut})`; g.fillRect(0, 0, W, H); }
    g.restore();
  }

  drawWeather(g, W, H, now) {
    const w = this.weather;
    if (!w) return;
    if (w === 'sun') { g.fillStyle = 'rgba(255,200,80,0.15)'; g.fillRect(0, 0, W, H); return; }
    const n = 70;
    for (let i = 0; i < n; i++) {
      const seed = i * 97.31;
      const sp = w === 'rain' ? 1.6 : w === 'hail' ? 1 : 0.6;
      const x = ((seed * 13.7 + now * 0.25 * sp * (w === 'sand' ? 2 : 0.4)) % (W + 40)) - 20;
      const y = ((seed * 7.3 + now * 0.6 * sp) % (H + 40)) - 20;
      if (w === 'rain') { g.strokeStyle = 'rgba(180,210,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 18); g.stroke(); }
      else if (w === 'hail') { g.fillStyle = 'rgba(240,250,255,0.85)'; g.fillRect(x, y, 5, 5); }
      else { g.fillStyle = 'rgba(210,180,120,0.55)'; g.fillRect(x, y, 4, 3); }
    }
  }
}
