// Mapa regionu Velhora: města, cesty, stadiony (odznaky), tvoje poloha a hráči online.
import { MAPS } from '/shared/maps/index.js';
import { h, openPanel } from './ui.js';

// polohy míst na mapě (0–100 × 0–72)
const NODES = {
  liskova: { x: 12, y: 62, kind: 'town', icon: 'home' },
  cesta1: { x: 12, y: 50, kind: 'route' },
  mlynov: { x: 12, y: 37, kind: 'town', badge: 1, icon: 'mill' },
  cesta2: { x: 25, y: 37, kind: 'route' },
  rybnikov: { x: 38, y: 37, kind: 'town', badge: 2 },
  cesta3: { x: 38, y: 27, kind: 'route' },
  seda_jeskyne: { x: 38, y: 19, kind: 'cave' },
  jiskrov: { x: 38, y: 9, kind: 'town', badge: 3 },
  cesta4: { x: 52, y: 9, kind: 'route', icon: 'forest' },
  hajov: { x: 66, y: 9, kind: 'town', badge: 4 },
  cesta5: { x: 66, y: 21, kind: 'route', icon: 'swamp' },
  strasin: { x: 66, y: 33, kind: 'town', badge: 5, icon: 'castle' },
  cesta6: { x: 78, y: 33, kind: 'route', icon: 'mountain' },
  mrazov: { x: 90, y: 33, kind: 'town', badge: 6 },
  cesta7: { x: 90, y: 21, kind: 'route', icon: 'mountain' },
  koruna: { x: 90, y: 8, kind: 'peak', icon: 'castle' },
  cesta8: { x: 38, y: 50, kind: 'route' },
  solnice: { x: 38, y: 63, kind: 'town', icon: 'lighthouse' },
};
const LINKS = [
  ['liskova', 'cesta1'], ['cesta1', 'mlynov'], ['mlynov', 'cesta2'], ['cesta2', 'rybnikov'], ['rybnikov', 'cesta3'],
  ['cesta3', 'seda_jeskyne'], ['seda_jeskyne', 'jiskrov'], ['jiskrov', 'cesta4'], ['cesta4', 'hajov'], ['hajov', 'cesta5'],
  ['cesta5', 'strasin'], ['strasin', 'cesta6'], ['cesta6', 'mrazov'], ['mrazov', 'cesta7'], ['cesta7', 'koruna'],
  ['rybnikov', 'cesta8'], ['cesta8', 'solnice'],
];
const BADGE_COLORS = ['', '#a8742a', '#3a7ad8', '#f2c42c', '#4aa84a', '#8a4ad8', '#7ad0f0'];

// místo na mapě regionu pro libovolnou mapu (i interiér)
export function regionNode(mapId) {
  let id = mapId;
  for (let i = 0; i < 4 && id && !NODES[id]; i++) {
    const m = MAPS[id];
    id = m ? m.parent || m.region : null;
  }
  return NODES[id] ? id : null;
}

function rnd(i) { const x = Math.sin(i * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); }

function drawMap(g, W, H, me, others, now) {
  const sx = (x) => (x / 100) * W;
  const sy = (y) => (y / 72) * H;
  const u = W / 100;
  // moře
  const sea = g.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#5aa8ea');
  sea.addColorStop(1, '#3a84d0');
  g.fillStyle = sea;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = u * 0.25;
  for (let i = 0; i < 26; i++) {
    const x = rnd(i) * W;
    const y = rnd(i + 50) * H;
    g.beginPath();
    g.arc(x, y, u * 1.2, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
  // pevnina: sjednocení kruhů kolem míst a širokých pásů podél cest
  const land = (pad, color) => {
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [a, b] of LINKS) {
      g.lineWidth = u * (16 + pad * 2);
      g.beginPath();
      g.moveTo(sx(NODES[a].x), sy(NODES[a].y));
      g.lineTo(sx(NODES[b].x), sy(NODES[b].y));
      g.stroke();
    }
    for (const n of Object.values(NODES)) { g.beginPath(); g.arc(sx(n.x), sy(n.y), u * (10 + pad), 0, Math.PI * 2); g.fill(); }
    // vnitrozemí (mezi cestami)
    g.beginPath();
    g.moveTo(sx(14), sy(30)); g.lineTo(sx(88), sy(14)); g.lineTo(sx(88), sy(40)); g.lineTo(sx(14), sy(44));
    g.closePath();
    g.fill();
  };
  land(2.2, '#f0dca4');
  land(0, '#8ad064');
  // krajinné oblasti
  const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(sx(x), sy(y), u * r, u * r * 0.7, 0, 0, Math.PI * 2); g.fill(); };
  blob(55, 12, 13, '#4e9a48');
  blob(66, 22, 9, '#7a9a5a');
  blob(84, 22, 14, '#c8ccd8');
  blob(90, 10, 9, '#eef4fc');
  blob(38, 21, 6, '#a89880');
  // ikonky krajiny
  const tree = (x, y, s = 1) => {
    g.fillStyle = '#6a4a2a';
    g.fillRect(sx(x) - u * 0.3 * s, sy(y), u * 0.6 * s, u * 1.4 * s);
    g.fillStyle = '#2e7a3a';
    g.beginPath(); g.arc(sx(x), sy(y) - u * 0.4 * s, u * 1.4 * s, 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 16; i++) tree(46 + rnd(i) * 18, 5 + rnd(i + 9) * 12, 0.8 + rnd(i + 3) * 0.4);
  for (let i = 0; i < 6; i++) tree(4 + rnd(i + 30) * 8, 44 + rnd(i + 40) * 18, 0.7);
  const peak = (x, y, s) => {
    g.fillStyle = '#8a92a8';
    g.beginPath(); g.moveTo(sx(x) - u * 3 * s, sy(y) + u * 2.5 * s); g.lineTo(sx(x), sy(y) - u * 2.8 * s); g.lineTo(sx(x) + u * 3 * s, sy(y) + u * 2.5 * s); g.closePath(); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(sx(x) - u * 1.2 * s, sy(y) - u * 0.6 * s); g.lineTo(sx(x), sy(y) - u * 2.8 * s); g.lineTo(sx(x) + u * 1.2 * s, sy(y) - u * 0.6 * s); g.closePath(); g.fill();
  };
  peak(80, 24, 1.1); peak(86, 17, 0.9); peak(96, 20, 1); peak(84, 6, 0.8); peak(97, 4, 0.9);
  // cesty
  for (const [a, b] of LINKS) {
    g.strokeStyle = '#8a6a3a';
    g.lineWidth = u * 2.3;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx(NODES[a].x), sy(NODES[a].y)); g.lineTo(sx(NODES[b].x), sy(NODES[b].y)); g.stroke();
    g.strokeStyle = '#f0dcae';
    g.lineWidth = u * 1.4;
    g.beginPath(); g.moveTo(sx(NODES[a].x), sy(NODES[a].y)); g.lineTo(sx(NODES[b].x), sy(NODES[b].y)); g.stroke();
  }
  // místa
  const badges = new Set(me.badges || []);
  const fs = Math.max(10, u * 2.1);
  g.textAlign = 'center';
  for (const [id, n] of Object.entries(NODES)) {
    const x = sx(n.x);
    const y = sy(n.y);
    const map = MAPS[id];
    if (n.kind === 'route') {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#5a4a3a';
      g.lineWidth = u * 0.35;
      g.beginPath(); g.arc(x, y, u * 1.1, 0, Math.PI * 2); g.fill(); g.stroke();
      continue;
    }
    const r = u * (n.kind === 'town' ? 2.6 : 2.2);
    g.fillStyle = n.kind === 'cave' ? '#6a5a4a' : n.kind === 'peak' ? '#5a3a7a' : '#e8443a';
    g.strokeStyle = '#2b2742';
    g.lineWidth = u * 0.45;
    g.beginPath(); g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.45); g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(x - r * 0.55, y - r * 0.55, r * 1.1, r * 1.1, r * 0.2); g.fill();
    if (n.badge) {
      const got = badges.has(n.badge);
      g.fillStyle = got ? BADGE_COLORS[n.badge] : 'rgba(40,36,60,0.35)';
      g.beginPath();
      const bx = x + r * 0.95;
      const by = y - r * 0.95;
      g.moveTo(bx, by - u * 1.3); g.lineTo(bx + u * 1.1, by); g.lineTo(bx, by + u * 1.3); g.lineTo(bx - u * 1.1, by); g.closePath();
      g.fill();
      g.strokeStyle = '#2b2742';
      g.lineWidth = u * 0.25;
      g.stroke();
    }
    g.font = `700 ${fs}px "Pixelify Sans", sans-serif`;
    g.lineWidth = u * 0.6;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    const label = map ? map.name : id;
    g.strokeText(label, x, y + r + fs * 1.05);
    g.fillStyle = '#2b2742';
    g.fillText(label, x, y + r + fs * 1.05);
  }
  // hráči online
  const counts = {};
  for (const o of others) { const id = regionNode(o.mapId); if (id) counts[id] = (counts[id] || 0) + 1; }
  for (const [id, c] of Object.entries(counts)) {
    const n = NODES[id];
    const x = sx(n.x) - u * 3.2;
    const y = sy(n.y) - u * 2.8;
    g.fillStyle = '#3a7ad8';
    g.strokeStyle = '#ffffff';
    g.lineWidth = u * 0.3;
    g.beginPath(); g.arc(x, y, u * 1.4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    g.font = `700 ${fs * 0.75}px "Pixelify Sans", sans-serif`;
    g.fillText(String(c), x, y + fs * 0.27);
  }
  // tvoje poloha
  const here = regionNode(me.map);
  if (here) {
    const n = NODES[here];
    const x = sx(n.x);
    const y = sy(n.y);
    const pulse = (Math.sin(now / 250) + 1) / 2;
    g.strokeStyle = `rgba(232,68,58,${0.9 - pulse * 0.6})`;
    g.lineWidth = u * 0.6;
    g.beginPath(); g.arc(x, y, u * (3.6 + pulse * 2.2), 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffd84a';
    g.strokeStyle = '#2b2742';
    g.lineWidth = u * 0.4;
    g.beginPath();
    g.moveTo(x, y - u * 0.6);
    g.lineTo(x - u * 1.5, y - u * 3.6);
    g.lineTo(x + u * 1.5, y - u * 3.6);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

export function openRegionMap(app, mapId) {
  return new Promise((resolve) => {
    const me = { ...app.me, map: mapId };
    let others = [];
    const cv = h('canvas', { class: 'region-canvas' });
    const where = regionNode(me.map);
    const cur = MAPS[me.map];
    const info = h('p', { class: 'small' }, h('b', {}, 'Jsi tady: '), cur ? cur.name : '?', where && where !== me.map && MAPS[where] ? ` (${MAPS[where].name})` : '');
    const legend = h('p', { class: 'small muted' }, '◆ odznak stadionu (barevný = získaný)  ·  ● počet hráčů online  ·  ▼ ty');
    const panel = h('div', { class: 'panel center-panel', style: 'width:min(760px,calc(100vw - 20px))' },
      h('button', { class: 'close-x', onclick: () => close() }, '×'),
      h('h2', {}, 'Mapa regionu Velhora'), cv, info, legend);
    let layer;
    let raf = 0;
    const close = () => { cancelAnimationFrame(raf); app.onWhoMap = null; layer.close(); resolve(); };
    layer = openPanel(panel, (act) => { if (act === 'b' || act === 'a' || act === 'start') close(); }, { onForceClose: () => { cancelAnimationFrame(raf); resolve(); } });
    app.onWhoMap = (list) => { others = list.filter((o) => o.id !== me.id); };
    app.send({ t: 'who', forMap: true });
    const frame = (now) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(200, cv.clientWidth);
      const H = Math.round(W * 0.72);
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = `${H}px`; }
      const g = cv.getContext('2d');
      drawMap(g, cv.width, cv.height, { ...app.me, map: mapId }, others, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
