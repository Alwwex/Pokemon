// Procedurální kresba tvorů podle popisu `art` v shared/species.js.
// Kreslí se do souřadnic 100×100 (nohy kolem y=92), výsledek se škáluje.
import { SPECIES } from '/shared/species.js';
import { shade, mix, hueShift, hexToRgb } from './util.js';

const TAU = Math.PI * 2;

function P(build) { const p = new Path2D(); build(p); return p; }
const E = (cx, cy, rx, ry, rot = 0) => P((p) => p.ellipse(cx, cy, rx, ry, rot, 0, TAU));
const C = (cx, cy, r) => E(cx, cy, r, r);
function poly(pts) {
  return P((p) => { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); });
}
function rrect(x, y, w, h, r) {
  return P((p) => {
    p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); p.closePath();
  });
}
// Lístek / plamínek mezi dvěma body.
function leafPath(x1, y1, x2, y2, wide = 0.45) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const nx = -dy * wide;
  const ny = dx * wide;
  return P((p) => { p.moveTo(x1, y1); p.quadraticCurveTo(mx + nx, my + ny, x2, y2); p.quadraticCurveTo(mx - nx, my - ny, x1, y1); p.closePath(); });
}
function flamePath(cx, cy, w, h, lean = 0) {
  return P((p) => {
    p.moveTo(cx - w, cy);
    p.bezierCurveTo(cx - w, cy - h * 0.45, cx - w * 0.3 + lean * 0.4, cy - h * 0.55, cx + lean, cy - h);
    p.bezierCurveTo(cx + w * 0.45 + lean * 0.3, cy - h * 0.55, cx + w, cy - h * 0.4, cx + w, cy);
    p.bezierCurveTo(cx + w, cy + w * 0.9, cx - w, cy + w * 0.9, cx - w, cy);
    p.closePath();
  });
}

class Drawer {
  constructor(g, col) {
    this.g = g;
    this.col = col;
    this.lw = 2.3;
  }
  part(path, fill, o = {}) {
    const g = this.g;
    g.save();
    if (o.alpha != null) g.globalAlpha = o.alpha;
    if (o.flat) {
      g.fillStyle = fill;
      g.fill(path);
    } else {
      g.fillStyle = shade(fill, -0.24);
      g.fill(path);
      g.save();
      g.clip(path);
      g.translate(-1.9, -2.5);
      g.fillStyle = fill;
      g.fill(path);
      g.translate(1.9, 2.5);
      if (o.hl !== false) {
        const p2 = new Path2D();
        p2.addPath(path);
        p2.addPath(path, new DOMMatrix().translate(1.5, 1.9));
        g.globalAlpha = (o.alpha ?? 1) * 0.6;
        g.fillStyle = shade(fill, 0.38);
        g.fill(p2, 'evenodd');
      }
      g.restore();
    }
    if (o.outline !== false) {
      g.lineWidth = o.lw || this.lw;
      g.strokeStyle = o.stroke || this.col.line;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.stroke(path);
    }
    g.restore();
  }
  stroke(path, color, w = 2) {
    const g = this.g;
    g.save();
    g.lineWidth = w;
    g.strokeStyle = color || this.col.line;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke(path);
    g.restore();
  }
  // čára s obrysem (např. ocásek, nožky hmyzu)
  limb(path, color, w) {
    this.stroke(path, this.col.line, w + this.lw * 1.6);
    this.stroke(path, color, w);
  }
  flat(path, fill, alpha) {
    const g = this.g;
    g.save();
    if (alpha != null) g.globalAlpha = alpha;
    g.fillStyle = fill;
    g.fill(path);
    g.restore();
  }
}

// ---------- tělesné typy ----------
const BODIES = {
  quad: {
    anchors(m) {
      const hr = 18 - m * 3.5;
      const hy = 47 - m * 3;
      return {
        head: { x: 50, y: hy, r: hr }, eyeY: hy - 1, eyeDX: hr * 0.42, eyeS: 1 - m * 0.15, mouthY: hy + hr * 0.55,
        earY: hy - hr * 0.72, earDX: hr * 0.68, top: { x: 50, y: hy - hr }, tail: { x: 70 + m * 3, y: 66, dir: 1 },
        body: { x: 50, y: 70, rx: 24 + m * 4, ry: 15 + m * 1.5 }, neck: { x: 50, y: hy + hr * 0.85, w: hr * 0.95 },
        hands: [{ x: 41, y: 90 }, { x: 59, y: 90 }], back: { x: 50, y: 58, w: 40 + m * 6 }, muzzle: { x: 50, y: hy + hr * 0.42 },
      };
    },
    body(d, A, back, c) {
      const b = A.body;
      d.part(E(b.x - b.rx * 0.66, 82, 5.5, 9), shade(c.main, -0.12));
      d.part(E(b.x + b.rx * 0.66, 82, 5.5, 9), shade(c.main, -0.12));
      d.part(E(b.x, b.y, b.rx, b.ry), c.main);
      if (!back) d.part(E(b.x, b.y + 5, b.rx * 0.5, b.ry * 0.55), c.sec, { outline: false });
      for (const fx of [41, 59]) {
        d.part(rrect(fx - 4.5, 72, 9, 18, 4), c.main);
        d.part(E(fx, 89, 4.8, 2.6), c.sec, { lw: 1.6 });
      }
    },
    head(d, A, back, c, spec) {
      const h = A.head;
      d.part(E(h.x, h.y, h.r * 1.05, h.r * 0.95), c.main);
      if (!back) {
        d.part(E(A.muzzle.x, A.muzzle.y, h.r * 0.52, h.r * 0.36), c.sec, { lw: 1.8 });
        if (!(spec.x || []).includes('nose')) d.part(E(A.muzzle.x, A.muzzle.y - h.r * 0.14, 2.6, 1.8), c.line, { hl: false, lw: 1 });
      }
    },
  },
  biped: {
    anchors(m) {
      const hr = 17 - m * 3;
      const hy = 37 - m * 2;
      return {
        head: { x: 50, y: hy, r: hr }, eyeY: hy + 1, eyeDX: hr * 0.42, eyeS: 1 - m * 0.12, mouthY: hy + hr * 0.52,
        earY: hy - hr * 0.7, earDX: hr * 0.7, top: { x: 50, y: hy - hr }, tail: { x: 64, y: 78, dir: 1 },
        body: { x: 50, y: 66, rx: 17 + m * 4, ry: 19 + m * 2 }, neck: { x: 50, y: hy + hr * 0.9, w: hr * 0.9 },
        hands: [{ x: 29 - m * 3, y: 72 }, { x: 71 + m * 3, y: 72 }], feet: [{ x: 41, y: 90 }, { x: 59, y: 90 }],
        back: { x: 50, y: 52, w: 32 },
      };
    },
    body(d, A, back, c) {
      const b = A.body;
      for (const fx of [41, 59]) {
        d.part(E(fx, 84, 6.5, 7.5), shade(c.main, -0.08));
        d.part(E(fx, 90, 7.5, 3.4), c.sec, { lw: 1.8 });
      }
      d.part(E(b.x, b.y, b.rx, b.ry), c.main);
      if (!back) d.part(E(b.x, b.y + 4, b.rx * 0.62, b.ry * 0.66), c.sec, { outline: false });
      const [hl, hr2] = A.hands;
      d.part(E((hl.x + 36) / 2 + 1, 62, 5.5, 11, 0.42), c.main);
      d.part(E((hr2.x + 64) / 2 - 1, 62, 5.5, 11, -0.42), c.main);
    },
    head(d, A, back, c) {
      const h = A.head;
      d.part(E(h.x, h.y, h.r * 1.05, h.r), c.main);
    },
  },
  bird: {
    anchors(m) {
      return {
        head: { x: 50, y: 38 - m * 2, r: 15 }, eyeY: 37 - m * 2, eyeDX: 6.5, eyeS: 1, mouthY: 45 - m * 2,
        earY: 26 - m * 2, earDX: 10, top: { x: 50, y: 23 - m * 2 }, tail: { x: 50, y: 84, dir: 1 },
        body: { x: 50, y: 63, rx: 21 + m * 2, ry: 23 }, neck: { x: 50, y: 51, w: 13 }, wing: { y: 58 },
        feet: [{ x: 43, y: 90 }, { x: 57, y: 90 }], hands: [{ x: 26, y: 70 }, { x: 74, y: 70 }], back: { x: 50, y: 50, w: 30 }, beak: true,
      };
    },
    body(d, A, back, c, spec) {
      const b = A.body;
      if (spec.tail !== 'flame') {
        for (const [dx, rot] of [[-7, 0.5], [0, 0], [7, -0.5]]) d.part(E(50 + dx, 86, 4.5, 10, rot), shade(c.main, -0.15));
      }
      for (const fx of [43, 57]) d.part(P((p) => { p.moveTo(fx - 4, 92); p.lineTo(fx, 84); p.lineTo(fx + 4, 92); p.closePath(); }), '#f2a93a', { lw: 1.5 });
      d.part(E(b.x, b.y, b.rx, b.ry), c.main);
      if (!back) d.part(E(b.x, b.y + 6, b.rx * 0.62, b.ry * 0.62), c.sec, { outline: false });
    },
    head(d, A, back, c) {
      d.part(C(A.head.x, A.head.y, A.head.r), c.main);
    },
  },
  fish: {
    anchors() {
      return {
        head: { x: 34, y: 54, r: 14 }, eye1: { x: 31, y: 51 }, eyeY: 51, eyeDX: 0, eyeS: 1.1, mouthY: 59, mouthX: 20,
        top: { x: 50, y: 38 }, tail: { x: 76, y: 56, dir: 1 }, body: { x: 48, y: 56, rx: 30, ry: 18 }, neck: { x: 40, y: 56, w: 14 },
        hands: [{ x: 50, y: 64 }], back: { x: 50, y: 40, w: 30 }, side: true,
      };
    },
    body(d, A, back, c, spec) {
      d.part(poly([[72, 56], [95, 38], [89, 56], [95, 74]]), shade(c.acc, -0.05));
      if (spec.back === 'fins') d.part(P((p) => { p.moveTo(36, 42); p.quadraticCurveTo(50, 22, 64, 41); p.closePath(); }), c.acc);
      d.part(E(48, 56, 30, 18), c.main);
      d.part(E(46, 64, 22, 8), c.sec, { outline: false });
      d.part(E(52, 63, 7, 4, 0.6), c.acc, { lw: 1.6 });
    },
    head() {},
  },
  larva: {
    anchors() {
      return {
        head: { x: 40, y: 60, r: 16 }, eyeY: 59, eyeDX: 6, eyeS: 0.9, mouthY: 67, top: { x: 40, y: 44 },
        body: { x: 62, y: 80, rx: 20, ry: 10 }, neck: { x: 44, y: 72, w: 12 }, earY: 48, earDX: 10, back: { x: 60, y: 72, w: 30 },
      };
    },
    body(d, A, back, c, spec) {
      const segs = [[80, 84, 7], [68, 82, 9], [55, 79, 10.5]];
      for (const [x, y, r] of segs) {
        d.part(C(x, y, r), c.main);
        if (spec.mark === 'spots') d.part(C(x - 1, y - r * 0.4, r * 0.28), c.acc, { lw: 1.2 });
        d.flat(E(x, y + r - 1, 2, 1.5), c.line);
      }
    },
    head(d, A, back, c) {
      d.part(C(A.head.x, A.head.y, A.head.r), c.main);
      if (!back) d.part(E(A.head.x, A.head.y + 7, 8, 5), c.sec, { outline: false });
    },
  },
  blob: {
    anchors() {
      return {
        head: { x: 50, y: 60, r: 24 }, eyeY: 62, eyeDX: 9, eyeS: 1.1, mouthY: 73, top: { x: 50, y: 38 }, earY: 42, earDX: 16,
        body: { x: 50, y: 68, rx: 33, ry: 24 }, neck: { x: 50, y: 78, w: 26 }, back: { x: 50, y: 44, w: 40 }, hands: [{ x: 22, y: 80 }, { x: 78, y: 80 }],
      };
    },
    body(d, A, back, c) {
      const path = P((p) => { p.moveTo(16, 90); p.bezierCurveTo(13, 60, 28, 38, 50, 38); p.bezierCurveTo(72, 38, 87, 60, 84, 90); p.quadraticCurveTo(50, 95, 16, 90); p.closePath(); });
      d.part(path, c.main);
      if (!back) d.part(E(50, 80, 18, 8), c.sec, { outline: false, alpha: 0.7 });
    },
    head() {},
  },
  ghost: {
    anchors() {
      return {
        head: { x: 50, y: 48, r: 24 }, eyeY: 48, eyeDX: 8.5, eyeS: 1.15, mouthY: 60, top: { x: 50, y: 24 }, earY: 30, earDX: 15,
        body: { x: 50, y: 58, rx: 24, ry: 26 }, neck: { x: 50, y: 64, w: 22 }, hands: [{ x: 21, y: 62 }, { x: 79, y: 62 }], back: { x: 50, y: 34, w: 40 }, float: true,
      };
    },
    body(d, A, back, c) {
      d.part(E(22, 60, 5, 8.5, 0.5), shade(c.main, -0.05));
      d.part(E(78, 60, 5, 8.5, -0.5), shade(c.main, -0.05));
      const path = P((p) => {
        p.moveTo(26, 76); p.lineTo(26, 48); p.arc(50, 48, 24, Math.PI, 0); p.lineTo(74, 76);
        p.quadraticCurveTo(70, 86, 62, 78); p.quadraticCurveTo(56, 88, 50, 78); p.quadraticCurveTo(44, 88, 38, 78); p.quadraticCurveTo(30, 86, 26, 76); p.closePath();
      });
      d.part(path, c.main);
      if (!back) d.part(E(50, 66, 14, 8), c.sec, { outline: false, alpha: 0.5 });
    },
    head() {},
  },
  bug: {
    anchors() {
      return {
        head: { x: 50, y: 40, r: 15 }, eyeY: 40, eyeDX: 6.5, eyeS: 1, mouthY: 48, top: { x: 50, y: 25 }, earY: 28, earDX: 10,
        body: { x: 50, y: 72, rx: 16, ry: 16 }, neck: { x: 50, y: 52, w: 12 }, wing: { y: 50 }, hands: [{ x: 28, y: 64 }, { x: 72, y: 64 }], back: { x: 50, y: 60, w: 30 },
      };
    },
    body(d, A, back, c, spec) {
      for (const side of [-1, 1]) {
        for (const [ex, ey] of [[24, 60], [22, 74], [27, 88]]) {
          const x2 = 50 + side * (50 - ex);
          d.limb(P((p) => { p.moveTo(50 + side * 8, 60); p.quadraticCurveTo(50 + side * 16, ey - 6, x2, ey); }), shade(c.main, -0.3), 2.2);
        }
      }
      d.part(E(50, 74, 16, 15), c.main);
      if (spec.mark === 'stripes') {
        d.g.save();
        d.g.clip(E(50, 74, 16, 15));
        for (const y of [68, 76, 84]) d.flat(E(50, y, 18, 2.6), c.acc);
        d.g.restore();
        d.stroke(E(50, 74, 16, 15), c.line, d.lw);
      }
      d.part(E(50, 57, 11, 9), shade(c.main, -0.08));
    },
    head(d, A, back, c) {
      d.part(C(A.head.x, A.head.y, A.head.r), c.main);
    },
  },
  golem: {
    anchors() {
      return {
        head: { x: 50, y: 33, r: 12 }, eyeY: 32, eyeDX: 5.5, eyeS: 0.9, mouthY: 39, top: { x: 50, y: 21 }, earY: 24, earDX: 10,
        body: { x: 50, y: 62, rx: 24, ry: 20 }, neck: { x: 50, y: 44, w: 18 }, hands: [{ x: 17, y: 78 }, { x: 83, y: 78 }], back: { x: 50, y: 42, w: 46 },
      };
    },
    body(d, A, back, c, spec) {
      for (const lx of [36, 54]) d.part(rrect(lx, 76, 11, 16, 3), shade(c.main, -0.12));
      d.part(E(20, 60, 9, 15, 0.2), c.main);
      d.part(E(80, 60, 9, 15, -0.2), c.main);
      d.part(rrect(26, 42, 48, 40, 12), c.main);
      if (!back) d.part(rrect(36, 52, 28, 22, 6), c.sec, { outline: false, alpha: 0.85 });
      d.part(C(17, 78, 8), shade(c.main, 0.06));
      d.part(C(83, 78, 8), shade(c.main, 0.06));
    },
    head(d, A, back, c) {
      d.part(rrect(37, 21, 26, 23, 7), c.main);
    },
  },
  jelly: {
    anchors() {
      return {
        head: { x: 50, y: 42, r: 24 }, eyeY: 44, eyeDX: 9, eyeS: 1.05, mouthY: 52, top: { x: 50, y: 20 }, earY: 26, earDX: 14,
        body: { x: 50, y: 44, rx: 26, ry: 20 }, neck: { x: 50, y: 56, w: 22 }, back: { x: 50, y: 24, w: 30 }, float: true, hands: [{ x: 30, y: 80 }, { x: 70, y: 80 }],
      };
    },
    body(d, A, back, c) {
      for (let i = 0; i < 5; i++) {
        const x = 32 + i * 9;
        const path = P((p) => { p.moveTo(x, 52); p.bezierCurveTo(x - 6, 62, x + 6, 72, x - 2, 88 - (i % 2) * 6); });
        d.limb(path, mix(c.main, c.sec, 0.3), 3);
      }
      const bell = P((p) => {
        p.moveTo(23, 54); p.bezierCurveTo(20, 18, 80, 18, 77, 54);
        p.quadraticCurveTo(70, 60, 63, 55); p.quadraticCurveTo(56, 61, 50, 55); p.quadraticCurveTo(44, 61, 37, 55); p.quadraticCurveTo(30, 60, 23, 54); p.closePath();
      });
      d.part(bell, c.main, { alpha: 0.92 });
      d.flat(E(42, 32, 10, 6, -0.4), '#ffffff', 0.35);
    },
    head() {},
  },
  shroom: {
    anchors() {
      return {
        head: { x: 50, y: 66, r: 14 }, eyeY: 65, eyeDX: 7, eyeS: 0.95, mouthY: 74, top: { x: 50, y: 22 }, earY: 30, earDX: 20,
        body: { x: 50, y: 70, rx: 16, ry: 18 }, neck: { x: 50, y: 58, w: 16 }, hands: [{ x: 29, y: 70 }, { x: 71, y: 70 }], back: { x: 50, y: 30, w: 50 }, cap: true,
      };
    },
    body(d, A, back, c, spec) {
      for (const fx of [41, 59]) d.part(E(fx, 89, 6.5, 3.4), shade(c.sec, -0.25), { lw: 1.6 });
      d.part(E(29, 70, 4.5, 7, 0.3), c.sec);
      d.part(E(71, 70, 4.5, 7, -0.3), c.sec);
      d.part(rrect(34, 50, 32, 39, 11), c.sec);
      const cap = P((p) => { p.moveTo(13, 56); p.bezierCurveTo(12, 14, 88, 14, 87, 56); p.quadraticCurveTo(50, 65, 13, 56); p.closePath(); });
      d.part(cap, c.main);
      if (spec.mark === 'spots') {
        for (const [x, y, r] of [[30, 40, 5], [50, 28, 6], [68, 42, 5.5], [42, 50, 3.5], [62, 54, 3], [24, 52, 3]]) d.part(C(x, y, r), c.acc, { lw: 1.4, hl: false });
      }
    },
    head() {},
  },
  crab: {
    anchors() {
      return {
        head: { x: 50, y: 66, r: 20 }, eyeY: 46, eyeDX: 8, eyeS: 0.95, mouthY: 72, top: { x: 50, y: 38 }, earY: 40, earDX: 10,
        body: { x: 50, y: 68, rx: 26, ry: 15 }, neck: { x: 50, y: 58, w: 20 }, hands: [{ x: 16, y: 40 }, { x: 84, y: 40 }], back: { x: 50, y: 56, w: 40 },
      };
    },
    body(d, A, back, c) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          d.limb(P((p) => { p.moveTo(50 + side * 20, 70 + i * 3); p.quadraticCurveTo(50 + side * (32 + i * 3), 72 + i * 4, 50 + side * (34 + i * 2), 88); }), shade(c.main, -0.2), 2.4);
        }
        d.limb(P((p) => { p.moveTo(50 + side * 20, 64); p.quadraticCurveTo(50 + side * 34, 62, 50 + side * 33, 48); }), c.main, 5);
        const cx = 50 + side * 34;
        const claw = P((p) => {
          p.moveTo(cx, 50); p.bezierCurveTo(cx - side * 12, 48, cx - side * 12, 30, cx - side * 2, 28);
          p.lineTo(cx + side * 1, 38); p.lineTo(cx + side * 8, 30); p.bezierCurveTo(cx + side * 12, 36, cx + side * 10, 48, cx, 50); p.closePath();
        });
        d.part(claw, c.main);
        d.limb(P((p) => { p.moveTo(50 + side * 7, 58); p.lineTo(50 + side * 8, 48); }), shade(c.main, -0.1), 2.6);
      }
      d.part(E(50, 68, 26, 15), c.main);
      if (!back) d.part(E(50, 74, 15, 6), c.sec, { outline: false });
    },
    head() {},
  },
  wisp: {
    anchors() {
      return {
        head: { x: 50, y: 66, r: 18 }, eyeY: 64, eyeDX: 7, eyeS: 1, mouthY: 73, top: { x: 50, y: 26 }, earY: 50, earDX: 14,
        body: { x: 50, y: 64, rx: 22, ry: 22 }, neck: { x: 50, y: 74, w: 18 }, back: { x: 50, y: 40, w: 30 }, float: true, hands: [{ x: 30, y: 70 }, { x: 70, y: 70 }],
      };
    },
    body(d, A, back, c) {
      const outer = P((p) => {
        p.moveTo(50, 87); p.bezierCurveTo(24, 87, 22, 60, 34, 47); p.bezierCurveTo(38, 42, 36, 32, 42, 22);
        p.bezierCurveTo(45, 34, 52, 38, 55, 28); p.bezierCurveTo(59, 40, 67, 43, 67, 52); p.bezierCurveTo(80, 62, 75, 87, 50, 87); p.closePath();
      });
      d.part(outer, c.main);
      d.part(P((p) => { p.moveTo(50, 84); p.bezierCurveTo(34, 84, 33, 66, 42, 56); p.bezierCurveTo(46, 52, 46, 46, 50, 40); p.bezierCurveTo(54, 50, 60, 52, 61, 60); p.bezierCurveTo(68, 70, 64, 84, 50, 84); p.closePath(); }), c.sec, { outline: false, alpha: 0.85 });
    },
    head() {},
  },
};

// ---------- uši, rohy, ocasy, křídla ----------
function ears(d, A, spec, c) {
  const type = spec.ear;
  if (!type) return;
  for (const side of [-1, 1]) {
    const x = A.head.x + side * A.earDX;
    const y = A.earY;
    switch (type) {
      case 'pointy': {
        d.part(poly([[x - 7 * side * -1 - side * 1, y + 8], [x + side * 5, y - 12], [x + side * 8, y + 6]]), c.main);
        d.part(poly([[x - side * -1.5, y + 5], [x + side * 4.6, y - 6.5], [x + side * 6.4, y + 4]]), c.acc === c.main ? c.sec : mix(c.sec, c.acc, 0.4), { outline: false });
        break;
      }
      case 'round':
        d.part(C(x + side * 2, y + 1, 7), c.main);
        d.part(C(x + side * 2, y + 1.5, 3.8), c.sec, { outline: false });
        break;
      case 'long':
        d.part(E(x + side * 1, y - 13, 5.5, 15, side * 0.18), c.main);
        d.part(E(x + side * 1.4, y - 12, 2.6, 10, side * 0.18), c.acc, { outline: false });
        break;
      case 'floppy':
        d.part(E(x + side * 6, y + 9, 5, 11, side * -0.55), shade(c.main, -0.06));
        break;
      case 'tuft':
        d.part(poly([[x - side * 3, y + 4], [x + side * 5, y - 9], [x + side * 6, y + 5]]), shade(c.main, -0.05));
        break;
      case 'fin':
        d.part(P((p) => { p.moveTo(A.head.x + side * A.head.r * 0.8, y + 4); p.quadraticCurveTo(A.head.x + side * (A.head.r + 12), y - 10, A.head.x + side * (A.head.r + 10), y + 12); p.closePath(); }), c.acc);
        break;
      case 'leaf':
        d.part(leafPath(x - side * 2, y + 6, x + side * 14, y - 10), c.acc);
        d.stroke(P((p) => { p.moveTo(x - side * 1, y + 5); p.lineTo(x + side * 11, y - 7); }), shade(c.acc, -0.4), 1);
        break;
      case 'bat':
        d.part(poly([[x - side * 2, y + 10], [x + side * 9, y - 16], [x + side * 12, y + 8]]), c.main);
        d.part(poly([[x + side * 1, y + 7], [x + side * 8.4, y - 9], [x + side * 10, y + 6]]), c.acc, { outline: false });
        break;
      default:
    }
  }
}

function horns(d, A, spec, c) {
  const t = spec.horn;
  if (!t) return;
  const { x, y } = A.top;
  const bone = '#efe2c8';
  switch (t) {
    case 'nub':
      for (const s of [-1, 1]) d.part(poly([[x + s * 3, y + 4], [x + s * 7, y - 6], [x + s * 10, y + 5]]), bone, { lw: 1.8 });
      break;
    case 'curved':
      for (const s of [-1, 1]) {
        d.part(P((p) => { p.moveTo(x + s * 4, y + 5); p.bezierCurveTo(x + s * 6, y - 12, x + s * 22, y - 14, x + s * 22, y - 4); p.bezierCurveTo(x + s * 16, y - 8, x + s * 11, y - 4, x + s * 11, y + 6); p.closePath(); }), shade(c.acc === c.main ? bone : bone, -0.05));
      }
      break;
    case 'antlers': {
      const col = '#8a5a3a';
      for (const s of [-1, 1]) {
        const path = P((p) => {
          p.moveTo(x + s * 5, y + 4); p.quadraticCurveTo(x + s * 10, y - 8, x + s * 16, y - 18);
          p.moveTo(x + s * 9, y - 6); p.lineTo(x + s * 18, y - 6);
          p.moveTo(x + s * 13, y - 13); p.lineTo(x + s * 10, y - 22);
          p.moveTo(x + s * 16, y - 18); p.lineTo(x + s * 22, y - 20);
        });
        d.limb(path, col, 2.6);
        if ((spec.x || []).includes('flower')) {
          for (const [fx, fy] of [[18, -6], [10, -22], [22, -20]]) {
            for (let k = 0; k < 5; k++) d.flat(C(x + s * fx + Math.cos(k * 1.256) * 2.2, y + fy + Math.sin(k * 1.256) * 2.2, 1.7), c.acc);
            d.flat(C(x + s * fx, y + fy, 1.2), '#ffe86a');
          }
        }
      }
      break;
    }
    case 'unicorn':
      d.part(poly([[x - 4, y + 4], [x, y - 16], [x + 4, y + 4]]), bone);
      break;
    case 'crest':
      for (const [dx, h, rot] of [[-5, 12, -0.5], [0, 16, 0], [5, 12, 0.5]]) d.part(E(x + dx, y - h * 0.4, 3, h * 0.6, rot), c.acc, { lw: 1.8 });
      break;
    case 'antennae':
      for (const s of [-1, 1]) {
        d.limb(P((p) => { p.moveTo(x + s * 4, y + 3); p.quadraticCurveTo(x + s * 6, y - 10, x + s * 13, y - 14); }), shade(c.main, -0.35), 1.6);
        d.part(C(x + s * 13, y - 14, 3), c.acc, { lw: 1.6 });
      }
      break;
    case 'crown': {
      const path = poly([[x - 11, y + 3], [x - 12, y - 9], [x - 6, y - 3], [x, y - 12], [x + 6, y - 3], [x + 12, y - 9], [x + 11, y + 3]]);
      d.part(path, '#f4c63a');
      d.part(C(x, y - 2, 2.2), '#e84a6a', { lw: 1.2 });
      break;
    }
    case 'bud':
      d.part(leafPath(x + 2, y + 2, x + 12, y - 4, 0.5), '#4aa84a', { lw: 1.6 });
      d.part(P((p) => { p.moveTo(x - 5, y + 3); p.quadraticCurveTo(x - 6, y - 8, x, y - 13); p.quadraticCurveTo(x + 6, y - 8, x + 5, y + 3); p.closePath(); }), '#f58ab0', { lw: 1.8 });
      break;
    case 'drill': {
      const m = A.muzzle || { x: A.head.x, y: A.head.y };
      d.part(poly([[m.x - 6, m.y - 4], [m.x, m.y - 26], [m.x + 6, m.y - 4]]), '#b8c0cc');
      for (let i = 0; i < 3; i++) d.stroke(P((p) => { p.moveTo(m.x - 5 + i * 1.4, m.y - 8 - i * 6); p.lineTo(m.x + 5 - i * 1.4, m.y - 10 - i * 6); }), '#6a7280', 1.2);
      break;
    }
    default:
  }
}

function tail(d, A, spec, c) {
  const t = spec.tail;
  if (!t || !A.tail || ['fan', 'fin'].includes(t)) return;
  const { x, y } = A.tail;
  switch (t) {
    case 'fluffy': {
      const path = P((p) => { p.moveTo(x - 4, y + 6); p.bezierCurveTo(x + 26, y + 8, x + 30, y - 30, x + 10, y - 34); p.bezierCurveTo(x + 22, y - 18, x + 8, y - 4, x - 6, y - 2); p.closePath(); });
      d.part(path, c.main);
      d.part(E(x + 14, y - 30, 6, 5, 0.4), c.sec, { lw: 1.6 });
      break;
    }
    case 'flame': {
      d.limb(P((p) => { p.moveTo(x - 4, y + 2); p.quadraticCurveTo(x + 14, y, x + 14, y - 16); }), c.main, 6);
      d.part(flamePath(x + 15, y - 18, 8, 20, 4), c.acc);
      d.part(flamePath(x + 15, y - 17, 4.5, 11, 2), '#fff3b0', { outline: false });
      break;
    }
    case 'leaf':
      d.limb(P((p) => { p.moveTo(x - 4, y + 2); p.quadraticCurveTo(x + 10, y, x + 12, y - 10); }), c.main, 4);
      d.part(leafPath(x + 10, y - 8, x + 26, y - 26, 0.5), c.acc);
      break;
    case 'thin':
      d.limb(P((p) => { p.moveTo(x - 4, y + 2); p.bezierCurveTo(x + 14, y + 6, x + 22, y - 4, x + 24, y - 16); }), c.main, 4);
      break;
    case 'devil':
      d.limb(P((p) => { p.moveTo(x - 4, y + 2); p.bezierCurveTo(x + 14, y + 6, x + 20, y - 4, x + 20, y - 14); }), c.main, 3);
      d.part(poly([[x + 15, y - 12], [x + 21, y - 24], [x + 26, y - 12]]), c.main);
      break;
    case 'bolt':
      d.part(poly([[x - 2, y + 2], [x + 10, y - 8], [x + 6, y - 10], [x + 18, y - 22], [x + 10, y - 12], [x + 14, y - 10], [x + 2, y + 4]]), c.acc);
      break;
    case 'paddle':
      d.part(E(x + 8, y + 12, 13, 6, 0.45), shade(c.acc, 0.05));
      for (let i = 0; i < 3; i++) d.stroke(P((p) => { p.moveTo(x + 2 + i * 5, y + 8 + i * 2); p.lineTo(x + 6 + i * 5, y + 14 + i * 2); }), shade(c.acc, -0.35), 1);
      break;
    case 'club':
      d.limb(P((p) => { p.moveTo(x - 4, y + 2); p.quadraticCurveTo(x + 12, y + 4, x + 16, y - 6); }), c.main, 4.5);
      d.part(C(x + 18, y - 9, 7), shade(c.sec, -0.1));
      break;
    case 'ring': {
      const path = P((p) => { p.moveTo(x - 2, y + 2); p.bezierCurveTo(x + 22, y + 4, x + 30, y - 26, x + 14, y - 40); });
      d.limb(path, c.main, 7);
      d.g.save();
      d.g.setLineDash([5, 5]);
      d.stroke(path, c.sec, 7);
      d.g.restore();
      break;
    }
    case 'pom':
      d.part(C(x + 4, y + 2, 7), c.sec);
      break;
    case 'wisp':
      d.part(P((p) => { p.moveTo(x - 6, y); p.quadraticCurveTo(x + 20, y + 10, x + 26, y - 6); p.quadraticCurveTo(x + 14, y - 2, x - 6, y - 8); p.closePath(); }), c.main, { alpha: 0.8 });
      break;
    default:
  }
}

function wings(d, A, spec, c) {
  const t = spec.wing;
  if (!t) return;
  const wy = A.wing ? A.wing.y : A.body.y - 10;
  for (const side of [-1, 1]) {
    const bx = 50 + side * (A.body.rx * 0.7);
    switch (t) {
      case 'feather': {
        const path = P((p) => {
          p.moveTo(bx, wy - 8);
          p.bezierCurveTo(bx + side * 22, wy - 22, bx + side * 34, wy - 4, bx + side * 30, wy + 18);
          p.quadraticCurveTo(bx + side * 24, wy + 14, bx + side * 22, wy + 22);
          p.quadraticCurveTo(bx + side * 16, wy + 16, bx + side * 12, wy + 22);
          p.quadraticCurveTo(bx + side * 6, wy + 14, bx, wy + 12);
          p.closePath();
        });
        d.part(path, shade(c.main, -0.05));
        d.part(P((p) => { p.moveTo(bx + side * 22, wy + 22); p.quadraticCurveTo(bx + side * 26, wy + 8, bx + side * 30, wy + 18); p.quadraticCurveTo(bx + side * 24, wy + 14, bx + side * 22, wy + 22); }), c.acc, { outline: false });
        break;
      }
      case 'bat': {
        const path = P((p) => {
          p.moveTo(bx, wy - 6);
          p.lineTo(bx + side * 20, wy - 22);
          p.lineTo(bx + side * 38, wy - 12);
          p.quadraticCurveTo(bx + side * 32, wy + 2, bx + side * 34, wy + 14);
          p.quadraticCurveTo(bx + side * 24, wy + 4, bx + side * 20, wy + 16);
          p.quadraticCurveTo(bx + side * 12, wy + 6, bx, wy + 10);
          p.closePath();
        });
        d.part(path, shade(c.main, -0.1));
        d.stroke(P((p) => { p.moveTo(bx + side * 20, wy - 22); p.lineTo(bx + side * 20, wy + 16); p.moveTo(bx + side * 20, wy - 22); p.lineTo(bx + side * 34, wy + 14); }), shade(c.main, -0.45), 1.4);
        break;
      }
      case 'insect':
        d.part(E(bx + side * 14, wy - 6, 15, 8, side * -0.5), '#e8f4ff', { alpha: 0.6, lw: 1.6, hl: false });
        d.part(E(bx + side * 12, wy + 8, 11, 6, side * 0.4), '#e8f4ff', { alpha: 0.55, lw: 1.6, hl: false });
        break;
      case 'butterfly':
        d.part(E(bx + side * 16, wy - 8, 20, 15, side * -0.6), c.main);
        d.part(E(bx + side * 13, wy + 12, 14, 10, side * 0.5), shade(c.main, -0.08));
        d.part(C(bx + side * 20, wy - 10, 6), c.acc, { lw: 1.4 });
        d.part(C(bx + side * 14, wy + 13, 4), c.sec, { lw: 1.2 });
        d.flat(C(bx + side * 26, wy - 16, 2.4), '#ffffff', 0.9);
        break;
      case 'tiny':
        d.part(poly([[bx, wy - 2], [bx + side * 14, wy - 14], [bx + side * 16, wy + 2], [bx + side * 8, wy + 4]]), c.acc, { lw: 1.8 });
        break;
      default:
    }
  }
}

function backFeature(d, A, spec, c, layer) {
  const t = spec.back;
  if (!t) return;
  const h = A.head;
  const ring = (n, a0, a1, rOff, fn) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / (n - 1);
      fn(h.x + Math.cos(a) * (h.r + rOff), h.y + Math.sin(a) * (h.r + rOff), a);
    }
  };
  const behind = ['spikes', 'quills', 'mane', 'flames', 'leaves', 'crystals', 'shell', 'fins'].includes(t);
  if ((layer === 'behind') !== behind) return;
  switch (t) {
    case 'spikes':
      ring(5, -2.6, -0.54, -2, (x, y, a) => d.part(poly([[x - Math.sin(a) * 4, y + Math.cos(a) * 4], [x + Math.cos(a) * 10, y + Math.sin(a) * 10], [x + Math.sin(a) * 4, y - Math.cos(a) * 4]]), c.acc, { lw: 1.8 }));
      break;
    case 'quills':
      ring(9, -3.0, -0.14, -4, (x, y, a) => {
        d.part(poly([[x - Math.sin(a) * 5, y + Math.cos(a) * 5], [x + Math.cos(a) * 17, y + Math.sin(a) * 17], [x + Math.sin(a) * 5, y - Math.cos(a) * 5]]), c.acc, { lw: 1.8 });
      });
      ring(6, -2.8, -0.34, 0, (x, y, a) => {
        d.part(poly([[x - Math.sin(a) * 4, y + Math.cos(a) * 4], [x + Math.cos(a) * 13, y + Math.sin(a) * 13], [x + Math.sin(a) * 4, y - Math.cos(a) * 4]]), c.main, { lw: 1.6 });
      });
      break;
    case 'mane':
      ring(9, -0.2, Math.PI + 0.2, -3, (x, y) => d.part(C(x, y + 2, 7), c.sec, { lw: 1.8 }));
      ring(7, -2.7, -0.44, -2, (x, y) => d.part(C(x, y, 6.5), shade(c.main, -0.1), { lw: 1.8 }));
      break;
    case 'flames':
      ring(7, -2.9, -0.24, -3, (x, y, a) => {
        const lean = Math.cos(a) * 8;
        d.part(flamePath(x, y + 3, 6, 18, lean), c.acc);
        d.part(flamePath(x, y + 3, 3, 10, lean * 0.6), '#fff1a8', { outline: false });
      });
      break;
    case 'leaves':
      ring(6, -2.8, -0.34, -4, (x, y, a) => d.part(leafPath(x, y, x + Math.cos(a) * 18, y + Math.sin(a) * 18, 0.42), c.acc, { lw: 1.8 }));
      break;
    case 'crystals': {
      const b = A.body;
      for (const [dx, hgt, rot] of [[-14, 18, -0.4], [-2, 26, -0.05], [11, 20, 0.35]]) {
        const x = b.x + dx;
        const y = spec.b === 'blob' ? A.top.y + 12 : b.y - b.ry * 0.6;
        d.g.save();
        d.g.translate(x, y);
        d.g.rotate(rot);
        d.part(poly([[-5, 0], [-5, -hgt + 6], [0, -hgt], [5, -hgt + 6], [5, 0]]), c.acc, { lw: 1.8 });
        d.flat(poly([[-3, -2], [-3, -hgt + 7], [0, -hgt + 3], [0, -2]]), '#ffffff', 0.35);
        d.g.restore();
      }
      break;
    }
    case 'shell':
      d.part(E(A.body.x, A.body.y - 6, A.body.rx + 4, A.body.ry + 6), c.sec);
      break;
    case 'fins':
      if (A.side) break;
      ring(3, -2.4, -0.74, -3, (x, y, a) => d.part(leafPath(x, y, x + Math.cos(a) * 14, y + Math.sin(a) * 14, 0.3), c.acc, { lw: 1.6 }));
      break;
    case 'plates': {
      const b = A.body;
      d.g.save();
      d.g.clip(E(b.x, b.y, b.rx, b.ry));
      for (let i = -2; i <= 2; i++) {
        d.flat(E(b.x + i * b.rx * 0.38, b.y - b.ry * 0.4, b.rx * 0.2, b.ry * 0.95), shade(c.sec, -0.12));
        d.stroke(E(b.x + i * b.rx * 0.38, b.y - b.ry * 0.4, b.rx * 0.2, b.ry * 0.95), d.col.line, 1.4);
      }
      d.g.restore();
      d.stroke(E(b.x, b.y, b.rx, b.ry), d.col.line, d.lw);
      break;
    }
    case 'moss':
      for (const [dx, dy, r] of [[-12, -2, 7], [0, -6, 8], [12, -2, 7], [-6, 4, 5], [7, 3, 5]]) d.part(C(h.x + dx, h.y - h.r * 0.75 + dy, r), '#5aa04a', { lw: 1.6 });
      break;
    case 'snow':
      d.part(E(h.x, h.y - h.r * 0.8, h.r * 0.9, h.r * 0.35), '#ffffff', { lw: 1.6 });
      break;
    default:
  }
}

// ---------- obličej ----------
function eyes(d, A, spec, c) {
  const type = spec.eye || 'cute';
  const s = (A.eyeS || 1) * 1;
  const pts = A.side ? [{ x: A.eye1.x, y: A.eye1.y, side: -1 }] : [{ x: A.head.x - A.eyeDX, y: A.eyeY, side: -1 }, { x: A.head.x + A.eyeDX, y: A.eyeY, side: 1 }];
  const g = d.g;
  for (const p of pts) {
    switch (type) {
      case 'big':
        d.part(E(p.x, p.y, 4.8 * s, 5.6 * s), '#ffffff', { lw: 1.6, hl: false });
        d.flat(E(p.x + p.side * 0.6, p.y + 0.6, 3.2 * s, 3.9 * s), spec.eyeC || '#3a2a4a');
        d.flat(E(p.x + p.side * 0.6, p.y + 0.8, 1.7 * s, 2.2 * s), '#120a14');
        d.flat(C(p.x - 1.2 * s, p.y - 1.8 * s, 1.4 * s), '#ffffff');
        break;
      case 'fierce':
        d.flat(E(p.x, p.y + 0.5, 3.2 * s, 3.6 * s), '#1c1424');
        d.flat(C(p.x - 0.9 * s, p.y - 0.6 * s, 1.1 * s), '#ffffff');
        d.stroke(P((pp) => { pp.moveTo(p.x - p.side * 5 * s, p.y - 5.4 * s); pp.lineTo(p.x + p.side * 4 * s, p.y - 2.6 * s); }), d.col.line, 2.2);
        break;
      case 'sleepy':
        d.stroke(P((pp) => { pp.moveTo(p.x - 3.5 * s, p.y); pp.quadraticCurveTo(p.x, p.y + 3 * s, p.x + 3.5 * s, p.y); }), d.col.line, 2);
        break;
      case 'glow':
        g.save();
        g.shadowColor = spec.eyeC || '#ffe85a';
        g.shadowBlur = 6;
        d.flat(E(p.x, p.y, 3.6 * s, 4.2 * s), spec.eyeC || '#ffe85a');
        g.restore();
        d.flat(E(p.x - 0.6, p.y - 0.8, 1.5 * s, 2 * s), '#ffffff');
        d.stroke(E(p.x, p.y, 3.6 * s, 4.2 * s), d.col.line, 1.2);
        break;
      case 'bead':
        d.flat(C(p.x, p.y, 2.4 * s), '#1c1424');
        d.flat(C(p.x - 0.8, p.y - 0.8, 0.8 * s), '#ffffff');
        break;
      default:
        d.flat(E(p.x, p.y, 3.2 * s, 4.3 * s), '#1c1424');
        d.flat(C(p.x - 1 * s, p.y - 1.7 * s, 1.4 * s), '#ffffff');
        d.flat(C(p.x + 1.1 * s, p.y + 1.6 * s, 0.7 * s), '#ffffff');
    }
  }
}

function mouth(d, A, spec, c) {
  const t = spec.mouth || 'smile';
  const x = A.side ? A.mouthX : A.head.x;
  const y = A.mouthY;
  const line = d.col.line;
  if (A.beak || t === 'beak') {
    d.part(poly([[x - 4.5, y - 4], [x + 4.5, y - 4], [x, y + 3.5]]), '#f4b23c', { lw: 1.6 });
    return;
  }
  switch (t) {
    case 'smile':
      d.stroke(P((p) => { p.moveTo(x - 3.2, y - 0.5); p.quadraticCurveTo(x, y + 2.8, x + 3.2, y - 0.5); }), line, 1.7);
      break;
    case 'fang':
      d.stroke(P((p) => { p.moveTo(x - 4, y - 0.5); p.quadraticCurveTo(x, y + 3, x + 4, y - 0.5); }), line, 1.7);
      d.part(poly([[x + 0.6, y + 0.8], [x + 3.4, y + 0.2], [x + 2, y + 3.8]]), '#ffffff', { lw: 1, hl: false });
      d.part(poly([[x - 0.6, y + 0.8], [x - 3.4, y + 0.2], [x - 2, y + 3.8]]), '#ffffff', { lw: 1, hl: false });
      break;
    case 'grin':
      d.part(P((p) => { p.moveTo(x - 6, y - 1); p.quadraticCurveTo(x, y + 6, x + 6, y - 1); p.closePath(); }), '#ffffff', { lw: 1.6, hl: false });
      d.stroke(P((p) => { p.moveTo(x - 2, y - 0.5); p.lineTo(x - 2, y + 2.4); p.moveTo(x + 2, y - 0.5); p.lineTo(x + 2, y + 2.4); }), line, 0.9);
      break;
    case 'frown':
      d.stroke(P((p) => { p.moveTo(x - 3.5, y + 1.5); p.quadraticCurveTo(x, y - 1.6, x + 3.5, y + 1.5); }), line, 1.8);
      break;
    case 'teeth':
      d.stroke(P((p) => { p.moveTo(x - 3, y - 1); p.quadraticCurveTo(x, y + 1, x + 3, y - 1); }), line, 1.5);
      d.part(rrect(x - 2.4, y, 2.3, 3.4, 0.5), '#ffffff', { lw: 1, hl: false });
      d.part(rrect(x + 0.1, y, 2.3, 3.4, 0.5), '#ffffff', { lw: 1, hl: false });
      break;
    case 'open':
      d.part(E(x, y + 1, 3, 2.6), '#5a1a2a', { lw: 1.4, hl: false });
      d.flat(E(x, y + 2.3, 1.8, 1), '#ff8a9a');
      break;
    default:
  }
}

function marks(d, A, spec, c, back) {
  const t = spec.mark;
  if (!t) return;
  const h = A.head;
  const b = A.body;
  switch (t) {
    case 'cheeks':
      if (back || A.side) return;
      for (const s of [-1, 1]) d.flat(E(h.x + s * (A.eyeDX + 4), A.eyeY + 6, 3.4, 2.2), '#ff6a7a', 0.6);
      break;
    case 'spots':
      if (spec.b === 'shroom' || spec.b === 'larva') return;
      for (const [dx, dy, r] of [[-0.45, -0.3, 0.13], [0.15, -0.5, 0.11], [0.5, -0.1, 0.12], [-0.15, 0.25, 0.09], [0.32, 0.38, 0.08]]) {
        d.flat(C(b.x + dx * b.rx, b.y + dy * b.ry, r * b.rx), spec.b === 'quad' && c.acc !== c.main ? c.acc : c.sec, 0.9);
      }
      break;
    case 'bolt':
      if (back) return;
      d.part(poly([[h.x - 1, h.y - h.r * 0.75], [h.x + 3.5, h.y - h.r * 0.75], [h.x + 1, h.y - h.r * 0.45], [h.x + 4, h.y - h.r * 0.45], [h.x - 2.5, h.y - h.r * 0.05], [h.x - 0.5, h.y - h.r * 0.38], [h.x - 3.5, h.y - h.r * 0.38]]), c.acc, { lw: 1.2, hl: false });
      break;
    case 'star': {
      if (back) return;
      const cx = h.x;
      const cy = h.y - h.r * 0.55;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 2.4 : 5.6;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      d.part(poly(pts), c.acc, { lw: 1.2, hl: false });
      break;
    }
    case 'moon':
      if (back) return;
      d.part(P((p) => { p.arc(h.x, h.y - h.r * 0.55, 5.5, 0.6, Math.PI * 2 - 0.6); p.arc(h.x + 2.6, h.y - h.r * 0.6, 4.4, Math.PI * 2 - 0.9, 0.9, true); p.closePath(); }), c.acc, { lw: 1.2, hl: false });
      break;
    case 'third':
      if (back) return;
      d.part(E(h.x, h.y - h.r * 0.52, 2.6, 3.8), c.acc, { lw: 1.2, hl: false });
      d.flat(E(h.x, h.y - h.r * 0.52, 1, 2), '#2a1a3a');
      break;
    case 'scales':
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) d.stroke(P((p) => { p.arc(b.x - 8 + i * 9, b.y - 7 + j * 8, 4, 0.2, Math.PI - 0.2); }), shade(c.main, -0.3), 1.2);
      }
      break;
    case 'cracks':
      d.stroke(P((p) => { p.moveTo(b.x - b.rx * 0.5, b.y - b.ry * 0.4); p.lineTo(b.x - b.rx * 0.3, b.y - b.ry * 0.1); p.lineTo(b.x - b.rx * 0.42, b.y + b.ry * 0.2); p.moveTo(b.x + b.rx * 0.4, b.y - b.ry * 0.6); p.lineTo(b.x + b.rx * 0.28, b.y - b.ry * 0.3); }), shade(c.main, -0.45), 1.4);
      break;
    case 'stripes':
    case 'belly':
    default:
  }
}

// ---------- doplňky ----------
function extrasBehind(d, A, spec, c) {
  const x = spec.x || [];
  const g = d.g;
  if (x.includes('glow') || x.includes('aura')) {
    const col = x.includes('aura') ? c.acc : c.main;
    const grd = g.createRadialGradient(50, 58, 4, 50, 58, 50);
    const [r, gg, b] = hexToRgb(col);
    grd.addColorStop(0, `rgba(${r},${gg},${b},0.45)`);
    grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 100, 100);
  }
  if (x.includes('cape')) {
    const n = A.neck;
    d.part(P((p) => { p.moveTo(n.x - n.w, n.y); p.quadraticCurveTo(n.x - n.w * 2.2, 80, n.x - n.w * 1.8, 92); p.lineTo(n.x + n.w * 1.8, 92); p.quadraticCurveTo(n.x + n.w * 2.2, 80, n.x + n.w, n.y); p.closePath(); }), shade(c.acc, -0.2));
  }
  if (x.includes('wisps')) {
    for (const [wx, wy, rot] of [[18, 40, -0.6], [82, 44, 0.6], [26, 80, -0.3], [76, 82, 0.4]]) d.part(leafPath(wx, wy, wx + Math.sin(rot) * 10, wy - 14, 0.35), c.sec, { alpha: 0.7, lw: 1.4 });
  }
}

function extrasFront(d, A, spec, c, back) {
  const x = spec.x || [];
  const h = A.head;
  const line = d.col.line;
  if (x.includes('whiskers') && !back && !A.side) {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) d.stroke(P((p) => { const mx = (A.muzzle ? A.muzzle.x : h.x) + s * 5; const my = (A.muzzle ? A.muzzle.y : A.mouthY - 3) + i * 1.8 - 1.5; p.moveTo(mx, my); p.lineTo(mx + s * 9, my - 1.5 + i * 1.6); }), line, 0.9);
    }
  }
  if (x.includes('whiskers') && A.side) {
    d.stroke(P((p) => { p.moveTo(20, 60); p.quadraticCurveTo(12, 66, 14, 74); p.moveTo(22, 61); p.quadraticCurveTo(18, 68, 22, 74); }), line, 1.3);
  }
  if (x.includes('nose') && !back) {
    const m = A.muzzle || { x: h.x, y: A.mouthY - 4 };
    d.part(E(m.x, m.y - 2, 4.2, 3.2), c.acc === '#f4d23a' ? '#3a2a2a' : '#ff8aa8', { lw: 1.4 });
  }
  if (x.includes('claws')) {
    for (const p of [...(A.hands || []), ...(A.feet || [])]) {
      for (let i = -1; i <= 1; i++) d.part(poly([[p.x + i * 3 - 1.2, p.y], [p.x + i * 3, p.y + 3.6], [p.x + i * 3 + 1.2, p.y]]), '#f4f0e6', { lw: 0.9, hl: false });
    }
  }
  if (x.includes('gloves')) {
    for (const p of A.hands || []) d.part(C(p.x, p.y, 7.5), c.acc);
  }
  if (x.includes('scarf') || x.includes('bandana')) {
    if (x.includes('scarf')) {
      const n = A.neck;
      d.part(E(n.x, n.y, n.w * 1.05, 4.5), c.acc, { lw: 1.8 });
      d.part(rrect(n.x + n.w * 0.3, n.y, 6, 14, 2), shade(c.acc, -0.08), { lw: 1.6 });
    }
    if (x.includes('bandana')) {
      d.part(rrect(h.x - h.r, h.y - h.r * 0.62, h.r * 2, 5, 2), c.acc, { lw: 1.6 });
      if (back) d.part(poly([[h.x, h.y - h.r * 0.4], [h.x - 8, h.y + 6], [h.x - 3, h.y + 8]]), c.acc, { lw: 1.4 });
      else d.part(poly([[h.x + h.r * 0.9, h.y - h.r * 0.5], [h.x + h.r + 8, h.y - h.r * 0.2], [h.x + h.r + 6, h.y - h.r * 0.75]]), c.acc, { lw: 1.4 });
    }
  }
  if (x.includes('robe')) {
    const b = A.body;
    d.part(P((p) => { p.moveTo(b.x - b.rx * 0.8, b.y - b.ry * 0.6); p.quadraticCurveTo(b.x - b.rx * 1.25, b.y + b.ry * 0.6, b.x - b.rx * 1.05, b.y + b.ry); p.lineTo(b.x + b.rx * 1.05, b.y + b.ry); p.quadraticCurveTo(b.x + b.rx * 1.25, b.y + b.ry * 0.6, b.x + b.rx * 0.8, b.y - b.ry * 0.6); p.closePath(); }), c.acc);
    d.stroke(P((p) => { p.moveTo(b.x - b.rx * 1.05, b.y + b.ry - 2); p.lineTo(b.x + b.rx * 1.05, b.y + b.ry - 2); }), '#f4d23a', 2);
  }
  if (x.includes('beard')) {
    const by = A.mouthY + 1;
    const col = spec.b === 'golem' ? '#e8eef6' : mix(c.sec, '#ffffff', 0.4);
    d.part(P((p) => { p.moveTo(h.x - h.r * 0.75, by - 3); p.quadraticCurveTo(h.x - h.r * 0.8, by + 12, h.x, by + 16); p.quadraticCurveTo(h.x + h.r * 0.8, by + 12, h.x + h.r * 0.75, by - 3); p.quadraticCurveTo(h.x, by + 3, h.x - h.r * 0.75, by - 3); p.closePath(); }), col);
  }
  if (x.includes('hat_top')) {
    const ty = h.y - h.r * 0.75;
    d.part(E(h.x, ty, h.r * 1.15, 4), '#1e2a2a');
    d.part(rrect(h.x - h.r * 0.62, ty - 18, h.r * 1.24, 18, 2), '#1e2a2a');
    d.part(rrect(h.x - h.r * 0.62, ty - 6, h.r * 1.24, 4, 1), '#c83a3a', { lw: 1.4 });
  }
  if (x.includes('hat_wizard')) {
    const ty = h.y - h.r * 0.7;
    d.part(E(h.x, ty, h.r * 1.2, 4.2), c.acc);
    d.part(P((p) => { p.moveTo(h.x - h.r * 0.75, ty); p.quadraticCurveTo(h.x - 2, ty - 18, h.x + 10, ty - 30); p.quadraticCurveTo(h.x + 4, ty - 14, h.x + h.r * 0.75, ty); p.closePath(); }), c.acc);
    for (const [sx, sy] of [[-3, -8], [3, -16]]) d.flat(C(h.x + sx, ty + sy, 1.6), '#f4d23a');
  }
  if (x.includes('hat_gnome')) {
    const ty = h.y - h.r * 0.55;
    d.part(P((p) => { p.moveTo(h.x - h.r * 1.05, ty); p.quadraticCurveTo(h.x - 4, ty - 22, h.x + 4, ty - 34); p.quadraticCurveTo(h.x + 6, ty - 18, h.x + h.r * 1.05, ty); p.quadraticCurveTo(h.x, ty + 4, h.x - h.r * 1.05, ty); p.closePath(); }), c.acc);
  }
  if (x.includes('cap')) {
    const top = A.body.y - A.body.ry * 0.95;
    const cx = A.side ? 46 : h.x;
    d.part(P((p) => { p.moveTo(cx - 13, top + 2); p.quadraticCurveTo(cx, top - 14, cx + 13, top + 2); p.closePath(); }), c.acc);
    d.part(E(cx - 10, top + 2, 9, 2.6), shade(c.acc, -0.3), { lw: 1.4 });
    d.flat(C(cx, top - 3, 2), '#f4d23a');
  }
  if (x.includes('headscarf')) {
    d.part(P((p) => { p.moveTo(h.x - h.r - 2, h.y + 4); p.quadraticCurveTo(h.x - h.r - 2, h.y - h.r - 6, h.x, h.y - h.r - 6); p.quadraticCurveTo(h.x + h.r + 2, h.y - h.r - 6, h.x + h.r + 2, h.y + 4); p.quadraticCurveTo(h.x, h.y - h.r * 0.4, h.x - h.r - 2, h.y + 4); p.closePath(); }), '#f4ead0');
  }
  if (x.includes('sickle')) {
    const sx = 84;
    d.limb(P((p) => { p.moveTo(sx - 4, 84); p.lineTo(sx, 52); }), '#8a5a3a', 2.4);
    d.part(P((p) => { p.moveTo(sx, 52); p.bezierCurveTo(sx + 2, 30, sx - 22, 26, sx - 26, 40); p.bezierCurveTo(sx - 16, 34, sx - 4, 38, sx, 52); p.closePath(); }), '#c8ced8');
  }
  if (x.includes('pipe') && !back) {
    d.limb(P((p) => { p.moveTo(h.x + 3, A.mouthY + 1); p.lineTo(h.x + 12, A.mouthY + 4); }), '#6a4a2a', 1.8);
    d.part(rrect(h.x + 11, A.mouthY - 2, 5, 7, 1.5), '#6a4a2a', { lw: 1.4 });
  }
  if (x.includes('drip')) {
    for (const [dx, dy] of [[-14, 0], [16, 4], [-4, 8]]) d.part(P((p) => { const px0 = A.body.x + dx; const py0 = A.body.y + A.body.ry + dy - 4; p.moveTo(px0, py0 - 5); p.quadraticCurveTo(px0 + 3, py0, px0, py0 + 2); p.quadraticCurveTo(px0 - 3, py0, px0, py0 - 5); }), '#7ac8ff', { lw: 1.2 });
  }
  if (x.includes('halo')) {
    d.stroke(E(h.x, h.y - h.r - 7, h.r * 0.75, 3.4), '#f4d23a', 2.6);
  }
  if (x.includes('flower') && spec.horn !== 'antlers') {
    for (let k = 0; k < 5; k++) d.flat(C(h.x + 8 + Math.cos(k * 1.256) * 2.6, h.y - h.r * 0.8 + Math.sin(k * 1.256) * 2.6, 2), c.acc);
    d.flat(C(h.x + 8, h.y - h.r * 0.8, 1.4), '#ffe86a');
  }
  if (x.includes('leaf_head')) {
    d.part(leafPath(h.x + 2, h.y - h.r * 0.9, h.x + 12, h.y - h.r - 12, 0.5), c.acc, { lw: 1.6 });
  }
  if (x.includes('snowcap')) {
    d.part(P((p) => { p.moveTo(h.x - h.r - 3, h.y - h.r * 0.3); p.quadraticCurveTo(h.x, h.y - h.r * 2, h.x + h.r + 3, h.y - h.r * 0.3); p.quadraticCurveTo(h.x + 4, h.y - h.r * 0.6, h.x - h.r - 3, h.y - h.r * 0.3); p.closePath(); }), '#ffffff');
  }
}

function effects(d, A, spec, c) {
  const x = spec.x || [];
  if (x.includes('sparks')) {
    for (const [sx, sy, s] of [[16, 34, 1], [84, 30, -1], [12, 70, 1], [88, 66, -1]]) {
      d.limb(P((p) => { p.moveTo(sx, sy); p.lineTo(sx + s * 4, sy + 4); p.lineTo(sx, sy + 7); p.lineTo(sx + s * 5, sy + 12); }), '#ffe84a', 1.6);
    }
  }
  if (x.includes('snowflakes')) {
    for (const [sx, sy] of [[14, 28], [86, 36], [18, 74], [84, 76]]) {
      d.stroke(P((p) => { for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; p.moveTo(sx - Math.cos(a) * 3.5, sy - Math.sin(a) * 3.5); p.lineTo(sx + Math.cos(a) * 3.5, sy + Math.sin(a) * 3.5); } }), '#ffffff', 1.4);
    }
  }
  if (x.includes('aura')) {
    for (const [sx, sy, r] of [[18, 30, 2.4], [84, 26, 2], [10, 58, 1.6], [90, 62, 2.2], [26, 86, 1.6], [76, 88, 1.8]]) d.flat(C(sx, sy, r), '#ffffff', 0.85);
  }
}

// ---------- čepice (kosmetické předměty) ----------
const HATS2D = {
  cepice_ksiltovka(g, x, y, r, back) {
    fillStroke(g, '#e8443a', () => { g.ellipse(x, y + 2, r * 0.82, r * 0.62, 0, Math.PI, TAU); g.closePath(); });
    if (!back) fillStroke(g, '#c0302a', () => g.ellipse(x + r * 0.15, y + 2, r * 0.75, r * 0.2, 0, 0, TAU));
    fillStroke(g, '#ffffff', () => g.arc(x, y - r * 0.5, r * 0.12, 0, TAU), false);
  },
  cepice_party(g, x, y, r) {
    fillStroke(g, '#f058a8', () => { g.moveTo(x - r * 0.42, y + 3); g.lineTo(x + r * 0.42, y + 3); g.lineTo(x + r * 0.12, y - r * 1.25); g.closePath(); });
    for (const [dx, dy] of [[-0.12, -0.1], [0.12, -0.45], [-0.02, -0.75]]) fillStroke(g, '#4ab0f0', () => g.arc(x + r * dx, y + r * dy, r * 0.07, 0, TAU), false);
    fillStroke(g, '#f4d23a', () => g.arc(x + r * 0.12, y - r * 1.28, r * 0.16, 0, TAU));
  },
  cepice_masle(g, x, y, r) {
    const bx = x + r * 0.45;
    const by = y + r * 0.15;
    fillStroke(g, '#f058a8', () => { g.moveTo(bx, by); g.lineTo(bx - r * 0.5, by - r * 0.32); g.lineTo(bx - r * 0.5, by + r * 0.3); g.closePath(); });
    fillStroke(g, '#f058a8', () => { g.moveTo(bx, by); g.lineTo(bx + r * 0.5, by - r * 0.32); g.lineTo(bx + r * 0.5, by + r * 0.3); g.closePath(); });
    fillStroke(g, '#d03a88', () => g.arc(bx, by, r * 0.13, 0, TAU));
  },
  cepice_venecek(g, x, y, r) {
    const cols = ['#ff7aa8', '#ffe86a', '#ffffff', '#8ac8ff'];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      fillStroke(g, cols[i % 4], () => g.arc(x + Math.cos(a) * r * 0.85, y + 4 + Math.sin(a) * r * 0.3, r * 0.16, 0, TAU));
    }
  },
  cepice_slamak(g, x, y, r) {
    fillStroke(g, '#e8c86a', () => g.ellipse(x, y + 3, r * 1.35, r * 0.3, 0, 0, TAU));
    fillStroke(g, '#e8c86a', () => { g.ellipse(x, y + 1, r * 0.62, r * 0.55, 0, Math.PI, TAU); g.closePath(); });
    fillStroke(g, '#c83a3a', () => g.rect(x - r * 0.62, y - 2, r * 1.24, 3), false);
  },
  cepice_kulich(g, x, y, r) {
    fillStroke(g, '#3a8ae8', () => { g.ellipse(x, y + 4, r * 0.86, r * 0.82, 0, Math.PI, TAU); g.closePath(); });
    fillStroke(g, '#ffffff', () => g.rect(x - r * 0.88, y + 1, r * 1.76, 4));
    fillStroke(g, '#ffffff', () => g.arc(x, y - r * 0.8, r * 0.24, 0, TAU));
  },
  cepice_kucharska(g, x, y, r) {
    fillStroke(g, '#ffffff', () => g.rect(x - r * 0.55, y - r * 0.45, r * 1.1, r * 0.55));
    fillStroke(g, '#ffffff', () => { g.arc(x - r * 0.35, y - r * 0.65, r * 0.38, 0, TAU); });
    fillStroke(g, '#ffffff', () => { g.arc(x + r * 0.35, y - r * 0.65, r * 0.38, 0, TAU); });
    fillStroke(g, '#ffffff', () => { g.arc(x, y - r * 0.95, r * 0.42, 0, TAU); }, true);
  },
  cepice_beranice(g, x, y, r) {
    for (const sx of [-1, 1]) fillStroke(g, '#6a4a36', () => g.ellipse(x + sx * r * 0.85, y + r * 0.55, r * 0.22, r * 0.45, 0, 0, TAU));
    fillStroke(g, '#5a4030', () => { g.ellipse(x, y + 3, r * 0.92, r * 0.85, 0, Math.PI, TAU); g.closePath(); });
    for (let i = 0; i < 5; i++) fillStroke(g, '#6a4a36', () => g.arc(x - r * 0.6 + i * r * 0.3, y - r * 0.55 + Math.sin(i) * 2, r * 0.18, 0, TAU), false);
  },
  cepice_helma(g, x, y, r, back) {
    fillStroke(g, '#d83a2a', () => g.ellipse(x, y + 4, r * 1.1, r * 0.22, 0, 0, TAU));
    fillStroke(g, '#d83a2a', () => { g.ellipse(x, y + 3, r * 0.82, r * 0.75, 0, Math.PI, TAU); g.closePath(); });
    if (!back) fillStroke(g, '#f4d23a', () => g.rect(x - r * 0.14, y - r * 0.45, r * 0.28, r * 0.32));
  },
  cepice_cylindr(g, x, y, r) {
    fillStroke(g, '#1e1e2a', () => g.ellipse(x, y + 3, r * 1.05, r * 0.25, 0, 0, TAU));
    fillStroke(g, '#1e1e2a', () => g.rect(x - r * 0.58, y - r * 1.15, r * 1.16, r * 1.18));
    fillStroke(g, '#8a4ad8', () => g.rect(x - r * 0.58, y - r * 0.25, r * 1.16, r * 0.22), false);
  },
  cepice_kouzelnicka(g, x, y, r) {
    fillStroke(g, '#5a3ab0', () => g.ellipse(x, y + 3, r * 1.1, r * 0.26, 0, 0, TAU));
    fillStroke(g, '#5a3ab0', () => { g.moveTo(x - r * 0.6, y + 2); g.quadraticCurveTo(x - r * 0.1, y - r * 0.6, x + r * 0.5, y - r * 1.5); g.quadraticCurveTo(x + r * 0.2, y - r * 0.5, x + r * 0.6, y + 2); g.closePath(); });
    for (const [dx, dy] of [[-0.15, -0.2], [0.18, -0.7]]) fillStroke(g, '#f4d23a', () => star(g, x + r * dx, y + r * dy, r * 0.14), false);
  },
  cepice_koruna(g, x, y, r) {
    fillStroke(g, '#f4c63a', () => {
      g.moveTo(x - r * 0.6, y + 2);
      g.lineTo(x - r * 0.6, y - r * 0.5);
      g.lineTo(x - r * 0.3, y - r * 0.15);
      g.lineTo(x, y - r * 0.65);
      g.lineTo(x + r * 0.3, y - r * 0.15);
      g.lineTo(x + r * 0.6, y - r * 0.5);
      g.lineTo(x + r * 0.6, y + 2);
      g.closePath();
    });
    fillStroke(g, '#3a8ae8', () => g.arc(x, y - r * 0.08, r * 0.11, 0, TAU), false);
  },
};

function fillStroke(g, color, path, stroke = true) {
  g.beginPath();
  path();
  g.fillStyle = color;
  g.fill();
  if (stroke) { g.strokeStyle = '#1a1222'; g.lineWidth = 1.4; g.stroke(); }
}

function star(g, x, y, r) {
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

export const HAT_IDS = Object.keys(HATS2D);

function drawHat(g, A, hat, back) {
  const f = HATS2D[hat];
  if (!f || !A.top) return;
  const r = A.head ? A.head.r : 14;
  g.save();
  g.lineJoin = 'round';
  f(g, A.top.x, A.top.y + r * 0.18, r, back);
  g.restore();
}

// ---------- hlavní funkce ----------
function shinyColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 40) return mix(hex, '#f0c050', 0.5);
  return hueShift(hex, 155, 1.05);
}

function colorsFor(spec, shiny) {
  let [main, sec, acc] = spec.c;
  acc = acc || main;
  if (shiny) { main = shinyColor(main); sec = shinyColor(sec); acc = shinyColor(acc); }
  const line = mix(shade(main, -0.7), '#1a1222', 0.55);
  return { main, sec, acc, line };
}

export function drawCreature(g, speciesKey, opts = {}) {
  const sp = SPECIES[speciesKey];
  if (!sp) return;
  drawArt(g, sp.art, opts);
}

// Nakreslí tvora přímo z popisu `art` (Dílna tvorů), do prostoru 100×100.
export function drawArt(g, spec, opts = {}) {
  const back = !!opts.back;
  const body = BODIES[spec.b] || BODIES.blob;
  const m = Math.max(0, Math.min(1, ((spec.s || 0.6) - 0.5) / 0.5));
  const A = body.anchors(m, spec);
  const c = colorsFor(spec, opts.shiny);
  const d = new Drawer(g, c);
  const sc = 0.66 + 0.34 * (spec.s || 0.6);
  const lift = A.float ? 7 : 0;

  g.save();
  // stín na zemi
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(50, 93, 26 * sc, 4.5 * sc, 0, 0, TAU);
  g.fill();
  g.translate(50, 94 - lift);
  g.scale(sc, sc);
  g.translate(-50, -94);
  if (back && spec.b === 'fish') {
    g.translate(100, 0);
    g.scale(-1, 1);
  }
  const showBack = back && spec.b !== 'fish';
  extrasBehind(d, A, spec, c);
  wings(d, A, spec, c);
  if (!showBack) tail(d, A, spec, c);
  backFeature(d, A, spec, c, 'behind');
  ears(d, A, spec, c);
  if (spec.horn !== 'crown' && spec.horn !== 'drill') horns(d, A, spec, c);
  body.body(d, A, showBack, c, spec);
  body.head(d, A, showBack, c, spec);
  backFeature(d, A, spec, c, 'over');
  if (spec.horn === 'crown' || spec.horn === 'drill') horns(d, A, spec, c);
  if (!showBack) {
    marks(d, A, spec, c, false);
    eyes(d, A, spec, c);
    mouth(d, A, spec, c);
  } else marks(d, A, spec, c, true);
  extrasFront(d, A, spec, c, showBack);
  if (showBack) tail(d, A, spec, c);
  if (opts.hat) drawHat(g, A, opts.hat, showBack);
  effects(d, A, spec, c);
  g.restore();
}

const cache = new Map();

// Vlastní 3D modely (public/models) umí dodat vlastní obrázek – registruje je gfx3d/mon3d.js.
let customSpriteProvider = null;
export function setCustomSpriteProvider(fn) { customSpriteProvider = fn; }
export function invalidateSprites(speciesKey) {
  for (const k of [...cache.keys()]) if (k.startsWith(speciesKey + '|') || k.startsWith('url|' + speciesKey + '|')) cache.delete(k);
}

// Vrátí plátno s tvorem o velikosti `size` px (uloženo do mezipaměti).
export function monSprite(speciesKey, size = 192, opts = {}) {
  const key = `${speciesKey}|${size}|${opts.back ? 1 : 0}|${opts.shiny ? 1 : 0}|${opts.silhouette ? 1 : 0}|${opts.hat || ''}`;
  let c = cache.get(key);
  if (c) return c;
  const custom = customSpriteProvider ? customSpriteProvider(speciesKey, size, opts) : null;
  if (custom) c = custom;
  else {
    c = document.createElement('canvas');
    c.width = size;
    c.height = size;
  }
  const g = c.getContext('2d');
  if (!custom) {
    g.scale(size / 100, size / 100);
    drawCreature(g, speciesKey, opts);
  }
  if (opts.silhouette) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#2a2438';
    g.fillRect(0, 0, size, size);
  }
  cache.set(key, c);
  return c;
}

export function monIconURL(speciesKey, size = 48, opts = {}) {
  const key = `url|${speciesKey}|${size}|${opts.shiny ? 1 : 0}|${opts.silhouette ? 1 : 0}|${opts.hat || ''}`;
  let u = cache.get(key);
  if (u) return u;
  u = monSprite(speciesKey, size, opts).toDataURL();
  cache.set(key, u);
  return u;
}
