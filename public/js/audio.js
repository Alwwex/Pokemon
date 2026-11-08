// Čiptunová hudba (generovaná ze semínek a akordových postupů), zvukové efekty a hlasy tvorů.
import { SPECIES } from '/shared/species.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  hminor: [0, 2, 3, 5, 7, 8, 11],
};

const SONGS = {
  title: { key: 60, mode: 'major', bpm: 112, prog: [0, 5, 3, 4, 0, 5, 3, 4], style: 'march', seed: 11 },
  town: { key: 65, mode: 'major', bpm: 96, prog: [0, 3, 4, 0, 5, 3, 1, 4], style: 'calm', seed: 3 },
  town2: { key: 67, mode: 'major', bpm: 100, prog: [0, 4, 5, 3, 0, 4, 3, 4], style: 'calm', seed: 7 },
  home: { key: 64, mode: 'major', bpm: 84, prog: [0, 5, 3, 4], style: 'calm', seed: 31 },
  lab: { key: 62, mode: 'major', bpm: 92, prog: [0, 3, 1, 4], style: 'calm', seed: 37 },
  route: { key: 62, mode: 'major', bpm: 126, prog: [0, 4, 5, 3, 0, 4, 3, 4], style: 'adventure', seed: 21 },
  forest: { key: 57, mode: 'minor', bpm: 104, prog: [0, 5, 6, 4, 0, 5, 3, 4], style: 'mystic', seed: 5 },
  swamp: { key: 55, mode: 'minor', bpm: 86, prog: [0, 3, 5, 4], style: 'mystic', seed: 9 },
  cave: { key: 52, mode: 'minor', bpm: 78, prog: [0, 5, 3, 4], style: 'eerie', seed: 13 },
  snow: { key: 64, mode: 'major', bpm: 90, prog: [0, 5, 3, 4, 0, 3, 4, 0], style: 'calm', seed: 17 },
  mountain: { key: 60, mode: 'minor', bpm: 110, prog: [0, 6, 5, 4], style: 'adventure', seed: 19 },
  castle: { key: 50, mode: 'hminor', bpm: 88, prog: [0, 5, 3, 4], style: 'eerie', seed: 23 },
  center: { key: 69, mode: 'major', bpm: 92, prog: [0, 3, 4, 0], style: 'calm', seed: 2 },
  gym: { key: 60, mode: 'hminor', bpm: 120, prog: [0, 5, 3, 4], style: 'march', seed: 41 },
  wild: { key: 57, mode: 'hminor', bpm: 152, prog: [0, 5, 3, 4, 0, 5, 6, 4], style: 'battle', seed: 43 },
  trainer: { key: 52, mode: 'hminor', bpm: 160, prog: [0, 3, 5, 4], style: 'battle', seed: 47 },
  rival: { key: 62, mode: 'minor', bpm: 164, prog: [0, 6, 5, 4], style: 'battle', seed: 53 },
  leader: { key: 55, mode: 'hminor', bpm: 168, prog: [0, 5, 3, 4, 0, 5, 6, 4], style: 'battle', seed: 59 },
  champion: { key: 60, mode: 'hminor', bpm: 172, prog: [0, 5, 6, 4, 3, 1, 4, 4], style: 'battle', seed: 61 },
  legend: { key: 50, mode: 'hminor', bpm: 140, prog: [0, 6, 5, 4], style: 'epic', seed: 67 },
  pvp: { key: 59, mode: 'minor', bpm: 166, prog: [0, 5, 3, 4], style: 'battle', seed: 71 },
};

const RHYTHMS = {
  calm: [[4, 2, 2, 4, 4], [6, 2, 4, 4], [4, 4, 2, 2, 4], [2, 2, 4, 8]],
  adventure: [[2, 2, 2, 2, 4, 4], [3, 3, 2, 4, 4], [2, 2, 4, 2, 2, 4], [4, 2, 2, 2, 2, 4]],
  march: [[4, 2, 2, 4, 4], [3, 1, 4, 4, 4], [2, 2, 2, 2, 8]],
  battle: [[2, 2, 2, 2, 2, 2, 4], [1, 1, 2, 2, 2, 4, 4], [2, 1, 1, 2, 2, 2, 2, 4], [3, 3, 2, 2, 2, 4]],
  mystic: [[6, 2, 4, 4], [4, 4, 8], [2, 2, 4, 8]],
  eerie: [[8, 8], [4, 4, 8], [12, 4]],
  epic: [[4, 2, 2, 4, 4], [2, 2, 2, 2, 8], [6, 2, 8]],
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

function degreeNote(cfg, deg) {
  const sc = SCALES[cfg.mode];
  const oct = Math.floor(deg / 7);
  const d = ((deg % 7) + 7) % 7;
  return cfg.key + sc[d] + 12 * oct;
}

// Vytvoří seznam not písně: {t, d, n, inst, v}
function compose(id) {
  const cfg = SONGS[id];
  const rnd = mulberry(cfg.seed * 7919 + 13);
  const rh = RHYTHMS[cfg.style];
  const notes = [];
  const bars = cfg.prog.length;
  // dva motivy: kontura (kroky stupnice) + rytmus
  const motifs = [0, 1].map(() => {
    const r = rh[Math.floor(rnd() * rh.length)];
    const steps = r.map((_, i) => (i === 0 ? 0 : Math.floor(rnd() * 5) - 2));
    return { r, steps };
  });
  for (let b = 0; b < bars; b++) {
    const root = cfg.prog[b];
    const t0 = b * 16;
    const m = motifs[(b >> 1) % 2 === 0 ? 0 : 1];
    const last = b === bars - 1;
    let deg = root + 7 + (b % 4 === 3 ? 2 : 0);
    let t = t0;
    m.r.forEach((len, i) => {
      deg += m.steps[i];
      const strong = (t - t0) % 8 === 0;
      if (strong) {
        const opts = [root, root + 2, root + 4].map((x) => x + 7);
        deg = opts.reduce((best, o) => (Math.abs(o - deg) < Math.abs(best - deg) ? o : best), opts[0]);
      }
      deg = Math.max(root + 4, Math.min(root + 13, deg));
      if (last && i === m.r.length - 1) deg = root + 7;
      notes.push({ t, d: len, n: degreeNote(cfg, deg), inst: 'lead', v: 0.16 });
      t += len;
    });
    // bas
    const bn = degreeNote(cfg, root) - 24;
    const fifth = degreeNote(cfg, root + 4) - 24;
    const pat = {
      calm: [[0, 8, bn], [8, 8, fifth]],
      adventure: [[0, 4, bn], [4, 2, fifth], [6, 2, bn], [8, 4, bn + 12], [12, 4, fifth]],
      march: [[0, 4, bn], [4, 4, bn], [8, 4, fifth], [12, 4, bn]],
      battle: [0, 2, 4, 6, 8, 10, 12, 14].map((x, i) => [x, 2, i % 2 ? bn + 12 : bn]),
      mystic: [[0, 12, bn], [12, 4, fifth]],
      eerie: [[0, 16, bn]],
      epic: [0, 2, 4, 6, 8, 10, 12, 14].map((x) => [x, 2, bn]),
    }[cfg.style];
    for (const [x, d, n] of pat) notes.push({ t: t0 + x, d, n, inst: 'bass', v: 0.22 });
    // arpeggio / akord
    const chord = [root, root + 2, root + 4].map((x) => degreeNote(cfg, x) - 12);
    if (cfg.style === 'battle' || cfg.style === 'epic' || cfg.style === 'adventure') {
      const step = cfg.style === 'adventure' ? 2 : 1;
      for (let x = 0; x < 16; x += step) notes.push({ t: t0 + x, d: step, n: chord[(x / step) % 3] + (cfg.style === 'adventure' ? 12 : 0), inst: 'arp', v: 0.05 });
    } else if (cfg.style !== 'eerie') {
      for (let x = 0; x < 16; x += 4) notes.push({ t: t0 + x + 2, d: 2, n: chord[(x / 4) % 3] + 12, inst: 'arp', v: 0.05 });
    } else {
      notes.push({ t: t0, d: 16, n: chord[1] + 12, inst: 'pad', v: 0.05 });
    }
    // bicí
    const drums = {
      battle: { k: [0, 8, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
      epic: { k: [0, 6, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
      adventure: { k: [0, 6, 8], s: [4, 12], h: [0, 4, 8, 12] },
      march: { k: [0, 8], s: [4, 12, 14], h: [2, 6, 10, 14] },
      calm: { k: [0], s: [], h: [4, 12] },
      mystic: { k: [0], s: [12], h: [] },
      eerie: { k: [], s: [], h: [] },
    }[cfg.style];
    for (const x of drums.k) notes.push({ t: t0 + x, d: 1, inst: 'kick', v: 0.5 });
    for (const x of drums.s) notes.push({ t: t0 + x, d: 1, inst: 'snare', v: 0.2 });
    for (const x of drums.h) notes.push({ t: t0 + x, d: 1, inst: 'hat', v: 0.06 });
  }
  notes.sort((a, b) => a.t - b.t);
  return { notes, len: bars * 16, step: 60 / cfg.bpm / 4 };
}

const JINGLES = {
  victory: { step: 0.11, notes: [[0, 2, 67], [2, 2, 67], [4, 2, 67], [6, 6, 72], [12, 2, 71], [14, 2, 72], [16, 8, 76], [24, 4, 79]] },
  heal: { step: 0.12, notes: [[0, 2, 72], [2, 2, 76], [4, 2, 79], [6, 4, 84], [11, 2, 79], [13, 6, 84]] },
  levelup: { step: 0.07, notes: [[0, 2, 72], [2, 2, 76], [4, 2, 79], [6, 6, 84]] },
  caught: { step: 0.1, notes: [[0, 2, 72], [2, 2, 74], [4, 2, 76], [6, 2, 79], [8, 4, 84], [12, 2, 79], [14, 8, 84]] },
  evolve: { step: 0.1, notes: [[0, 4, 60], [4, 4, 64], [8, 4, 67], [12, 4, 72], [16, 4, 76], [20, 8, 79], [28, 8, 84]] },
  badge: { step: 0.1, notes: [[0, 2, 67], [2, 2, 72], [4, 2, 76], [6, 4, 79], [10, 2, 76], [12, 8, 84]] },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    try {
      const s = JSON.parse(localStorage.getItem('monsterra_audio') || '{}');
      if (s.music === false) this.musicOn = false;
      if (s.sfx === false) this.sfxOn = false;
    } catch { /* bez úložiště */ }
    this.current = null;
    this.song = null;
    this.timer = null;
    this.songCache = {};
  }

  save() {
    try { localStorage.setItem('monsterra_audio', JSON.stringify({ music: this.musicOn, sfx: this.sfxOn })); } catch { /* ignore */ }
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.55 : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.8 : 0;
    this.sfxGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const real = new Float32Array(32);
    const imag = new Float32Array(32);
    for (let i = 1; i < 32; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * 0.25);
    this.pulse25 = this.ctx.createPeriodicWave(real, imag);
    if (this.current) { const c = this.current; this.current = null; this.music(c); }
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    this.save();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.8 : 0;
    this.save();
  }

  tone(dest, t, dur, freq, type, vol, opts = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (type === 'pulse') o.setPeriodicWave(this.pulse25);
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    if (opts.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opts.vib;
      lg.gain.value = freq * 0.03;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.7, t + Math.min(0.08, dur * 0.5));
    g.gain.setValueAtTime(vol * 0.7, t + Math.max(0.01, dur - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseHit(dest, t, dur, vol, filter, freq) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  playNote(n, t, step, dest) {
    const dur = n.d * step;
    switch (n.inst) {
      case 'lead': this.tone(dest, t, dur * 0.92, mtof(n.n), 'pulse', n.v, { vib: dur > 0.3 ? 5 : 0 }); break;
      case 'bass': this.tone(dest, t, dur * 0.9, mtof(n.n), 'triangle', n.v); break;
      case 'arp': this.tone(dest, t, dur * 0.8, mtof(n.n), 'square', n.v); break;
      case 'pad': this.tone(dest, t, dur, mtof(n.n), 'triangle', n.v); break;
      case 'kick': this.tone(dest, t, 0.14, 150, 'sine', n.v, { slide: 40 }); break;
      case 'snare': this.noiseHit(dest, t, 0.12, n.v, 'bandpass', 1800); break;
      case 'hat': this.noiseHit(dest, t, 0.03, n.v, 'highpass', 7000); break;
      default:
    }
  }

  music(id) {
    if (!SONGS[id]) id = 'route';
    if (this.current === id) return;
    this.current = id;
    if (!this.ctx) return;
    clearInterval(this.timer);
    if (this.songGain) {
      const old = this.songGain;
      old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      setTimeout(() => old.disconnect(), 600);
    }
    this.songGain = this.ctx.createGain();
    this.songGain.connect(this.musicGain);
    const song = this.songCache[id] || (this.songCache[id] = compose(id));
    const start = this.ctx.currentTime + 0.12;
    let idx = 0;
    let loop = 0;
    const gain = this.songGain;
    const tick = () => {
      if (!this.ctx) return;
      const horizon = this.ctx.currentTime + 0.2;
      for (;;) {
        const n = song.notes[idx];
        const t = start + (loop * song.len + n.t) * song.step;
        if (t > horizon) break;
        if (t >= this.ctx.currentTime - 0.02) this.playNote(n, t, song.step, gain);
        idx++;
        if (idx >= song.notes.length) { idx = 0; loop++; }
      }
    };
    tick();
    this.timer = setInterval(tick, 50);
  }

  stopMusic() {
    this.current = null;
    clearInterval(this.timer);
    if (this.songGain && this.ctx) this.songGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  jingle(id) {
    if (!this.ctx) return 0;
    const j = JINGLES[id];
    const t0 = this.ctx.currentTime + 0.03;
    if (this.songGain) {
      this.songGain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.05);
      const len = (j.notes[j.notes.length - 1][0] + j.notes[j.notes.length - 1][1]) * j.step;
      setTimeout(() => this.songGain && this.songGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2), len * 1000 + 200);
    }
    for (const [t, d, n] of j.notes) {
      this.tone(this.sfxGain, t0 + t * j.step, d * j.step * 0.95, mtof(n), 'pulse', 0.18);
      this.tone(this.sfxGain, t0 + t * j.step, d * j.step * 0.95, mtof(n - 12), 'triangle', 0.14);
    }
    return (j.notes[j.notes.length - 1][0] + j.notes[j.notes.length - 1][1]) * j.step;
  }

  sfx(name) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + 0.01;
    const d = this.sfxGain;
    switch (name) {
      case 'select': this.tone(d, t, 0.06, 880, 'square', 0.12); this.tone(d, t + 0.05, 0.06, 1320, 'square', 0.1); break;
      case 'cursor': this.tone(d, t, 0.04, 660, 'square', 0.07); break;
      case 'back': this.tone(d, t, 0.07, 520, 'square', 0.1, { slide: 300 }); break;
      case 'bump': this.tone(d, t, 0.08, 110, 'square', 0.12, { slide: 70 }); break;
      case 'door': this.noiseHit(d, t, 0.18, 0.25, 'lowpass', 900); this.tone(d, t, 0.15, 220, 'triangle', 0.15, { slide: 110 }); break;
      case 'step': this.noiseHit(d, t, 0.03, 0.05, 'lowpass', 600); break;
      case 'jump': this.tone(d, t, 0.18, 300, 'square', 0.1, { slide: 700 }); break;
      case 'hit': this.noiseHit(d, t, 0.18, 0.5, 'lowpass', 1200); this.tone(d, t, 0.12, 160, 'square', 0.18, { slide: 60 }); break;
      case 'super': this.noiseHit(d, t, 0.3, 0.6, 'lowpass', 2400); this.tone(d, t, 0.2, 240, 'sawtooth', 0.2, { slide: 50 }); break;
      case 'weak': this.noiseHit(d, t, 0.12, 0.3, 'lowpass', 600); break;
      case 'faint': this.tone(d, t, 0.6, 600, 'square', 0.15, { slide: 60 }); break;
      case 'throw': this.noiseHit(d, t, 0.25, 0.2, 'bandpass', 3000); this.tone(d, t, 0.25, 400, 'triangle', 0.08, { slide: 900 }); break;
      case 'shake': this.tone(d, t, 0.06, 300, 'square', 0.12); this.noiseHit(d, t, 0.05, 0.15, 'highpass', 3000); break;
      case 'pop': this.tone(d, t, 0.1, 800, 'square', 0.12, { slide: 1600 }); break;
      case 'exclaim': this.tone(d, t, 0.08, 1200, 'square', 0.12); this.tone(d, t + 0.08, 0.12, 1600, 'square', 0.12); break;
      case 'stat_up': for (let i = 0; i < 4; i++) this.tone(d, t + i * 0.06, 0.08, 500 + i * 160, 'square', 0.08); break;
      case 'stat_down': for (let i = 0; i < 4; i++) this.tone(d, t + i * 0.06, 0.08, 900 - i * 160, 'square', 0.08); break;
      case 'heal': for (let i = 0; i < 5; i++) this.tone(d, t + i * 0.07, 0.1, 700 + i * 120, 'triangle', 0.12); break;
      case 'deny': this.tone(d, t, 0.15, 200, 'square', 0.12); this.tone(d, t + 0.12, 0.2, 150, 'square', 0.12); break;
      case 'chat': this.tone(d, t, 0.05, 1000, 'sine', 0.08); break;
      case 'buy': this.tone(d, t, 0.08, 1047, 'square', 0.1); this.tone(d, t + 0.08, 0.14, 1568, 'square', 0.1); break;
      default:
    }
  }

  // Hlas tvora odvozený z jeho jména a velikosti.
  cry(speciesKey) {
    if (!this.ctx || !this.sfxOn) return;
    const sp = SPECIES[speciesKey];
    if (!sp) return;
    let h = 0;
    for (const ch of speciesKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = mulberry(h);
    const size = sp.art.s || 0.6;
    const base = 900 - size * 520 + rnd() * 200;
    const t = this.ctx.currentTime + 0.02;
    const segs = 2 + Math.floor(rnd() * 2);
    let tt = t;
    for (let i = 0; i < segs; i++) {
      const dur = 0.1 + rnd() * 0.16;
      const f1 = base * (0.8 + rnd() * 0.6);
      const f2 = f1 * (0.6 + rnd() * 0.9);
      this.tone(this.sfxGain, tt, dur, f1, rnd() < 0.5 ? 'square' : 'sawtooth', 0.12, { slide: f2, vib: 18 + rnd() * 20 });
      tt += dur * 0.85;
    }
  }
}

export const audio = new AudioEngine();
