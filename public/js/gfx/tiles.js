// Procedurálně kreslené pixelové dlaždice a budovy (16×16 px).
import { hash2, shade, makeCanvas } from './util.js';
import { TILES } from '/shared/tiles.js';

export const TS = 16;

const BASE = {
  grass: '#86d063', grass2: '#72bd52', grass3: '#9ade74', tall: '#4aa94a', tall2: '#2f8236', tall3: '#6cc45a',
  path: '#e4ca92', path2: '#cdb07a', path3: '#f0dcae', tree: '#2f8a40', tree2: '#46a84e', tree3: '#6cc860', trunk: '#7a4a2a',
  water: '#4f9fe8', water2: '#8fcaf6', water3: '#3a84d0', sand: '#f0dca4', sand2: '#e0c88a', rock: '#a0a0a8', cliff: '#a88e6e', cliff2: '#8a7258',
};

const THEMES = {
  town: BASE,
  route: BASE,
  forest: { ...BASE, grass: '#6cb850', grass2: '#5aa444', grass3: '#80c862', tall: '#3c923e', tall2: '#23702e', tall3: '#58b04c', tree: '#22703a', tree2: '#348a44', tree3: '#52a858', path: '#cdaa76', path2: '#ae8c5e', path3: '#dcc092' },
  swamp: { ...BASE, grass: '#8aa45c', grass2: '#76904c', grass3: '#9ab46a', tall: '#5e7e40', tall2: '#40602c', tall3: '#76944e', tree: '#3c5e3c', tree2: '#4e744a', tree3: '#66905a', water: '#4e8274', water2: '#79a898', water3: '#3c6a5e', path: '#a8946a', path2: '#8c7a54', path3: '#bca880', trunk: '#4a3a2a' },
  snow: { ...BASE, grass: '#eef4fc', grass2: '#dce8f6', grass3: '#ffffff', tall: '#c0d8ee', tall2: '#8eb4d8', tall3: '#e0eefa', tree: '#2c6a4c', tree2: '#3e8460', tree3: '#5ea07c', path: '#d6d0c6', path2: '#b8b0a4', path3: '#e8e4dc', water: '#78b8e8', water2: '#c0e2fa', water3: '#5e9ed4' },
  mountain: { ...BASE, grass: '#b8c49a', grass2: '#a2b086', grass3: '#cad4ae', tall: '#8ea070', tall2: '#6a7e52', tall3: '#a8b886', path: '#c8b8a0', path2: '#a89a84', path3: '#dccebc', tree: '#2c6a4c', tree2: '#3e8460', tree3: '#5ea07c' },
  cave: { ...BASE, floor: '#86766a', floor2: '#72645a', floor3: '#988a7c', wall: '#4c3e36', wall2: '#66564a', wall3: '#7e6c5e' },
  castle: { ...BASE, floor: '#7c7c8a', floor2: '#6a6a78', floor3: '#8e8e9c', wall: '#4a4a58', wall2: '#5e5e6e', wall3: '#74748a' },
  interior: { ...BASE, floor: '#dcae72', floor2: '#c4945c', floor3: '#e8c08a', wall: '#f0e4d0', wall2: '#d6c4a8', wall3: '#b89c7a' },
  gym: { ...BASE, floor: '#d0c8b8', floor2: '#b8b0a0', floor3: '#e0d8c8', wall: '#e8e0d0', wall2: '#c8bca8', wall3: '#a89880' },
};

export function themeOf(map) {
  const t = THEMES[map.theme] || BASE;
  if (map.gymColor) return { ...t, floor: map.gymColor, floor2: shade(map.gymColor, -0.15), floor3: shade(map.gymColor, 0.15) };
  return t;
}

// ---------- pixelové pomůcky ----------
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };

export function disc(g, cx, cy, r, c) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}

export function ellipse(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)) + 0.5);
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}

// Vzor ze znaků: každý znak = barva z palety, '.' = průhledné.
export function pattern(g, ox, oy, rows, pal) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || !pal[ch]) continue;
      g.fillStyle = pal[ch];
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

const TALL = [
  '.a....a.',
  'aba..aba',
  'aba.abba',
  'bbbabbbb',
  'bcbbbcbb',
  'bccbbccb',
  'cccbcccc',
  'cccccccc',
];

const FLOWER_COLORS = ['#f2545b', '#f7d84a', '#ffffff', '#f58ad0', '#7ab6ff', '#ffa040'];

function isTile(map, x, y, chars) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  return chars.includes(map.rows[y][x]);
}

function ground(g, ox, oy, tx, ty, T, theme) {
  if (theme === 'cave') return caveFloor(g, ox, oy, tx, ty, T);
  if (theme === 'castle' || theme === 'gym' || theme === 'interior') return floorTile(g, ox, oy, tx, ty, T);
  rect(g, ox, oy, 16, 16, T.grass);
  for (let i = 0; i < 5; i++) {
    px(g, ox + Math.floor(hash2(tx * 16 + i, ty, 1) * 16), oy + Math.floor(hash2(tx, ty * 16 + i, 2) * 16), T.grass2);
  }
  if (hash2(tx, ty, 3) < 0.3) {
    const x = ox + 3 + Math.floor(hash2(tx, ty, 4) * 9);
    const y = oy + 4 + Math.floor(hash2(tx, ty, 5) * 9);
    px(g, x, y, T.grass2); px(g, x + 2, y, T.grass2); px(g, x + 1, y - 1, T.grass2);
    px(g, x + 1, y - 2, T.grass3);
  }
}

function caveFloor(g, ox, oy, tx, ty, T) {
  rect(g, ox, oy, 16, 16, T.floor);
  for (let i = 0; i < 6; i++) {
    const x = ox + Math.floor(hash2(tx * 9 + i, ty, 7) * 15);
    const y = oy + Math.floor(hash2(tx, ty * 9 + i, 8) * 15);
    px(g, x, y, i % 2 ? T.floor2 : T.floor3);
  }
  if (hash2(tx, ty, 9) < 0.2) { ellipse(g, ox + 8, oy + 10, 2, 1, T.floor2); px(g, ox + 7, oy + 9, T.floor3); }
}

function floorTile(g, ox, oy, tx, ty, T) {
  rect(g, ox, oy, 16, 16, T.floor);
  for (let i = 0; i < 4; i++) rect(g, ox, oy + i * 4 + 3, 16, 1, T.floor2);
  const off = Math.floor(hash2(tx, ty, 11) * 8);
  for (let i = 0; i < 4; i++) px(g, ox + ((off + i * 7) % 16), oy + i * 4, T.floor2);
  px(g, ox + 3, oy + 1, T.floor3);
}

function waterTile(g, ox, oy, tx, ty, T, frame, map) {
  rect(g, ox, oy, 16, 16, T.water);
  const ph = frame % 2;
  for (let i = 0; i < 3; i++) {
    const wx = Math.floor(hash2(tx, ty * 5 + i, 21) * 11);
    const wy = (Math.floor(hash2(tx * 5 + i, ty, 22) * 13) + ph * 2) % 14;
    rect(g, ox + wx, oy + wy, 3 + (i % 2), 1, T.water2);
    px(g, ox + wx + 1, oy + wy + 1, T.water3);
  }
  const W = '~';
  if (!isTile(map, tx, ty - 1, W + '=')) { rect(g, ox, oy, 16, 2, T.water2); rect(g, ox, oy + 2, 16, 1, shade(T.water, 0.15)); }
  if (!isTile(map, tx, ty + 1, W + '=')) rect(g, ox, oy + 15, 16, 1, T.water3);
  if (!isTile(map, tx - 1, ty, W + '=')) rect(g, ox, oy, 1, 16, T.water2);
  if (!isTile(map, tx + 1, ty, W + '=')) rect(g, ox + 15, oy, 1, 16, T.water3);
}

function pathTile(g, ox, oy, tx, ty, T, map) {
  rect(g, ox, oy, 16, 16, T.path);
  for (let i = 0; i < 5; i++) px(g, ox + Math.floor(hash2(tx * 7 + i, ty, 31) * 16), oy + Math.floor(hash2(tx, ty * 7 + i, 32) * 16), i % 2 ? T.path2 : T.path3);
  const P = ':=mdu';
  if (!isTile(map, tx, ty - 1, P) && ty > 0) rect(g, ox, oy, 16, 1, T.path2);
  if (!isTile(map, tx, ty + 1, P) && ty < map.h - 1) rect(g, ox, oy + 15, 16, 1, T.path2);
  if (!isTile(map, tx - 1, ty, P) && tx > 0) rect(g, ox, oy, 1, 16, T.path2);
  if (!isTile(map, tx + 1, ty, P) && tx < map.w - 1) rect(g, ox + 15, oy, 1, 16, T.path2);
}

function treeTile(g, ox, oy, tx, ty, T, over, snow) {
  ellipse(g, ox + 8, oy + 14, 7, 2, shade(T.grass, -0.25));
  rect(g, ox + 7, oy + 10, 3, 5, T.trunk);
  rect(g, ox + 9, oy + 10, 1, 5, shade(T.trunk, -0.3));
  const draw = (gg, dy) => {
    disc(gg, ox + 8, oy + 5 + dy, 7, shade(T.tree, -0.25));
    disc(gg, ox + 8, oy + 4 + dy, 7, T.tree);
    disc(gg, ox + 7, oy + 3 + dy, 5, T.tree2);
    disc(gg, ox + 5, oy + 1 + dy, 2, T.tree3);
    px(gg, ox + 11, oy + 7 + dy, shade(T.tree, -0.25));
    px(gg, ox + 4, oy + 8 + dy, shade(T.tree, -0.25));
    if (snow) { rect(gg, ox + 4, oy - 2 + dy, 7, 2, '#ffffff'); px(gg, ox + 3, oy - 1 + dy, '#e8f0fa'); }
  };
  draw(g, 0);
  if (over) {
    // horní přesah koruny do dlaždice nad stromem kreslíme i do vrstvy „nad postavami“
    over.save();
    over.beginPath();
    over.rect(ox, oy - 4, 16, 4);
    over.clip();
    draw(over, 0);
    over.restore();
  }
}

function pineTile(g, ox, oy, tx, ty, T, snow) {
  ellipse(g, ox + 8, oy + 14, 6, 2, shade(T.grass, -0.25));
  rect(g, ox + 7, oy + 12, 2, 3, T.trunk);
  const layers = [[3, 4], [7, 6], [11, 7]];
  for (const [y, half] of layers) {
    for (let i = 0; i < 5; i++) {
      const w = Math.max(1, Math.round(half * (i + 1) / 5));
      rect(g, ox + 8 - w, oy + y - 4 + i, w * 2, 1, i < 2 ? T.tree2 : T.tree);
    }
    if (snow) rect(g, ox + 8 - Math.round(half / 2), oy + y - 3, Math.round(half), 1, '#ffffff');
  }
  rect(g, ox + 7, oy - 2, 2, 2, snow ? '#ffffff' : T.tree2);
}

function cliffTile(g, ox, oy, tx, ty, T, map, theme) {
  const c1 = theme === 'snow' ? '#b8c4d4' : theme === 'cave' ? T.wall2 : T.cliff;
  const c2 = theme === 'snow' ? '#94a2b6' : theme === 'cave' ? T.wall : T.cliff2;
  rect(g, ox, oy, 16, 16, c1);
  for (let i = 0; i < 3; i++) {
    const y = oy + 3 + i * 5 + Math.floor(hash2(tx, ty + i, 41) * 2);
    rect(g, ox, y, 16, 1, c2);
    rect(g, ox + Math.floor(hash2(tx + i, ty, 42) * 12), y - 2, 1, 2, c2);
  }
  if (!isTile(map, tx, ty - 1, '#C')) { rect(g, ox, oy, 16, 3, theme === 'snow' ? '#ffffff' : theme === 'cave' ? T.wall3 : T.grass); rect(g, ox, oy + 3, 16, 1, shade(c1, 0.2)); }
  if (!isTile(map, tx, ty + 1, '#C')) rect(g, ox, oy + 14, 16, 2, shade(c2, -0.3));
}

function caveWall(g, ox, oy, tx, ty, T, map) {
  rect(g, ox, oy, 16, 16, T.wall);
  for (let i = 0; i < 4; i++) {
    const x = ox + Math.floor(hash2(tx + i, ty, 51) * 13);
    const y = oy + Math.floor(hash2(tx, ty + i, 52) * 13);
    rect(g, x, y, 3, 2, T.wall2);
    px(g, x, y, T.wall3);
  }
  if (!isTile(map, tx, ty + 1, 'C#')) {
    rect(g, ox, oy + 10, 16, 6, T.wall2);
    rect(g, ox, oy + 10, 16, 1, T.wall3);
    for (let i = 0; i < 4; i++) rect(g, ox + i * 4 + 1, oy + 12, 1, 4, T.wall);
  }
}

function fenceTile(g, ox, oy, tx, ty, map) {
  const wood = '#c8935a';
  const dark = '#8a5a32';
  const left = isTile(map, tx - 1, ty, 'f');
  const right = isTile(map, tx + 1, ty, 'f');
  rect(g, ox + (left ? 0 : 3), oy + 6, 16 - (left ? 0 : 3) - (right ? 0 : 3), 2, wood);
  rect(g, ox + (left ? 0 : 3), oy + 10, 16 - (left ? 0 : 3) - (right ? 0 : 3), 2, wood);
  rect(g, ox + (left ? 0 : 3), oy + 8, 16 - (left ? 0 : 3) - (right ? 0 : 3), 1, dark);
  for (const x of [3, 11]) {
    rect(g, ox + x, oy + 3, 2, 11, wood);
    rect(g, ox + x + 1, oy + 3, 1, 11, dark);
    px(g, ox + x, oy + 3, '#e8b880');
  }
}

function rockTile(g, ox, oy, T) {
  ellipse(g, ox + 8, oy + 13, 7, 2, 'rgba(0,0,0,0.18)');
  disc(g, ox + 8, oy + 8, 6, shade(T.rock, -0.3));
  disc(g, ox + 8, oy + 7, 6, T.rock);
  disc(g, ox + 7, oy + 6, 4, shade(T.rock, 0.15));
  disc(g, ox + 6, oy + 4, 1, '#e8e8f0');
  rect(g, ox + 9, oy + 9, 3, 1, shade(T.rock, -0.3));
}

function bushTile(g, ox, oy, T) {
  ellipse(g, ox + 8, oy + 13, 7, 2, 'rgba(0,0,0,0.18)');
  disc(g, ox + 8, oy + 9, 6, shade(T.tree, -0.15));
  disc(g, ox + 5, oy + 8, 4, T.tree2);
  disc(g, ox + 11, oy + 8, 4, T.tree2);
  disc(g, ox + 8, oy + 6, 4, T.tree2);
  px(g, ox + 6, oy + 4, T.tree3); px(g, ox + 10, oy + 5, T.tree3); px(g, ox + 4, oy + 7, T.tree3);
}

function flowerTile(g, ox, oy, tx, ty) {
  for (let i = 0; i < 2; i++) {
    const c = FLOWER_COLORS[Math.floor(hash2(tx + i, ty, 61) * FLOWER_COLORS.length)];
    const x = ox + 3 + i * 7 + Math.floor(hash2(tx, ty + i, 62) * 3);
    const y = oy + 3 + i * 6 + Math.floor(hash2(tx + i, ty + i, 63) * 3);
    px(g, x, y - 1, c); px(g, x - 1, y, c); px(g, x + 1, y, c); px(g, x, y + 1, c);
    px(g, x, y, '#f7d84a');
    px(g, x, y + 2, '#3a8a3a'); px(g, x, y + 3, '#3a8a3a');
  }
}

function ledgeTile(g, ox, oy, T) {
  rect(g, ox, oy + 10, 16, 2, shade(T.grass, 0.15));
  rect(g, ox, oy + 12, 16, 3, shade(T.grass, -0.35));
  rect(g, ox, oy + 15, 16, 1, shade(T.grass, -0.5));
  for (let i = 0; i < 4; i++) px(g, ox + i * 4 + 2, oy + 13, shade(T.grass, -0.2));
}

function bridgeTile(g, ox, oy, tx, ty, map) {
  const horiz = isTile(map, tx - 1, ty, ':=.,s') || isTile(map, tx + 1, ty, ':=.,s');
  rect(g, ox, oy, 16, 16, '#b8844a');
  if (horiz) {
    for (let i = 0; i < 4; i++) rect(g, ox + i * 4 + 3, oy, 1, 16, '#8a5a2e');
    rect(g, ox, oy, 16, 2, '#6a4422');
    rect(g, ox, oy + 14, 16, 2, '#6a4422');
  } else {
    for (let i = 0; i < 4; i++) rect(g, ox, oy + i * 4 + 3, 16, 1, '#8a5a2e');
    rect(g, ox, oy, 2, 16, '#6a4422');
    rect(g, ox + 14, oy, 2, 16, '#6a4422');
  }
}

function wallTile(g, ox, oy, tx, ty, T, map) {
  rect(g, ox, oy, 16, 16, T.wall);
  for (let i = 0; i < 4; i++) rect(g, ox + i * 4 + 1, oy, 1, 16, shade(T.wall, -0.05));
  const below = isTile(map, tx, ty + 1, 'wh');
  if (!isTile(map, tx, ty - 1, 'wh')) rect(g, ox, oy, 16, 2, T.wall3);
  if (!below) {
    rect(g, ox, oy + 11, 16, 5, T.wall2);
    rect(g, ox, oy + 11, 16, 1, T.wall3);
    rect(g, ox, oy + 15, 16, 1, shade(T.wall3, -0.3));
    if (hash2(tx, ty, 71) < 0.28 && tx > 0 && tx < map.w - 1) {
      rect(g, ox + 3, oy + 1, 10, 8, '#7a5a3a');
      rect(g, ox + 4, oy + 2, 8, 6, '#9ad4f4');
      rect(g, ox + 4, oy + 2, 3, 2, '#d8f0ff');
      rect(g, ox + 7, oy + 2, 1, 6, '#7a5a3a');
    }
  }
}

function counterTile(g, ox, oy) {
  rect(g, ox, oy, 16, 16, '#d8c4a4');
  rect(g, ox, oy, 16, 6, '#f4ecdc');
  rect(g, ox, oy + 6, 16, 1, '#a88a64');
  rect(g, ox, oy + 15, 16, 1, '#8a6c48');
  for (let i = 0; i < 2; i++) rect(g, ox + i * 8 + 3, oy + 9, 4, 4, '#c4ae8a');
}

function shelfTile(g, ox, oy, tx, ty) {
  rect(g, ox, oy, 16, 16, '#8a5a32');
  for (let r = 0; r < 3; r++) {
    rect(g, ox + 1, oy + 1 + r * 5, 14, 4, '#5a3a1e');
    for (let i = 0; i < 6; i++) {
      const c = FLOWER_COLORS[Math.floor(hash2(tx + i, ty + r, 81) * FLOWER_COLORS.length)];
      const h = 3 + Math.floor(hash2(tx * 3 + i, ty + r, 82) * 2);
      rect(g, ox + 2 + i * 2, oy + 5 + r * 5 - h, 2, h, c === '#ffffff' ? '#e8d8b8' : c);
    }
  }
}

function tableTile(g, ox, oy, tx, ty, map) {
  const l = isTile(map, tx - 1, ty, 'j');
  const r = isTile(map, tx + 1, ty, 'j');
  const u = isTile(map, tx, ty - 1, 'j');
  const d = isTile(map, tx, ty + 1, 'j');
  rect(g, ox + (l ? 0 : 1), oy + (u ? 0 : 2), 16 - (l ? 0 : 1) - (r ? 0 : 1), 16 - (u ? 0 : 2) - (d ? 0 : 4), '#c88e58');
  if (!d) {
    rect(g, ox + (l ? 0 : 1), oy + 12, 16 - (l ? 0 : 1) - (r ? 0 : 1), 1, '#8a5a32');
    if (!l) rect(g, ox + 2, oy + 13, 2, 3, '#7a4a28');
    if (!r) rect(g, ox + 12, oy + 13, 2, 3, '#7a4a28');
  }
  if (!u) rect(g, ox + (l ? 0 : 1), oy + 2, 16 - (l ? 0 : 1) - (r ? 0 : 1), 1, '#e0a874');
}

function plantTile(g, ox, oy) {
  rect(g, ox + 4, oy + 10, 8, 6, '#c86a3a');
  rect(g, ox + 4, oy + 10, 8, 1, '#e0884e');
  disc(g, ox + 8, oy + 6, 5, '#2f8a40');
  disc(g, ox + 5, oy + 5, 3, '#46a84e');
  disc(g, ox + 11, oy + 5, 3, '#46a84e');
  disc(g, ox + 8, oy + 2, 3, '#58b85a');
}

function bedTile(g, ox, oy, tx, ty, map) {
  const top = !isTile(map, tx, ty - 1, 'n');
  rect(g, ox + 1, oy, 14, 16, '#7a4a2a');
  if (top) {
    rect(g, ox + 2, oy + 2, 12, 14, '#4a7ad8');
    rect(g, ox + 3, oy + 2, 10, 5, '#ffffff');
    rect(g, ox + 3, oy + 6, 10, 1, '#d8d8e8');
  } else {
    rect(g, ox + 2, oy, 12, 14, '#4a7ad8');
    rect(g, ox + 2, oy, 12, 1, '#6a9ae8');
    rect(g, ox + 2, oy + 13, 12, 1, '#3a5ab0');
  }
}

function pcTile(g, ox, oy, frame) {
  rect(g, ox, oy + 8, 16, 8, '#a8a8b4');
  rect(g, ox, oy + 8, 16, 1, '#d0d0dc');
  rect(g, ox + 2, oy, 12, 9, '#4a4a58');
  rect(g, ox + 3, oy + 1, 10, 6, frame % 2 ? '#7ad0ff' : '#5ab8f0');
  rect(g, ox + 4, oy + 2, 4, 1, '#d8f4ff');
  rect(g, ox + 6, oy + 9, 4, 2, '#3a3a48');
}

function healerTile(g, ox, oy, tx, ty, T, map, frame) {
  wallTile(g, ox, oy, tx, ty, T, map);
  rect(g, ox + 1, oy + 4, 14, 12, '#f4f4f8');
  rect(g, ox + 1, oy + 4, 14, 2, '#e84848');
  for (let i = 0; i < 3; i++) {
    disc(g, ox + 4 + i * 4, oy + 10, 1, frame % 2 && i === 1 ? '#ffe86a' : '#ff8a8a');
  }
  rect(g, ox + 1, oy + 15, 14, 1, '#a8a8b4');
}

function rugTile(g, ox, oy, tx, ty, map) {
  rect(g, ox, oy, 16, 16, '#c84848');
  const R = 'r';
  if (!isTile(map, tx, ty - 1, R)) rect(g, ox, oy, 16, 2, '#f2c442');
  if (!isTile(map, tx, ty + 1, R)) rect(g, ox, oy + 14, 16, 2, '#f2c442');
  if (!isTile(map, tx - 1, ty, R)) rect(g, ox, oy, 2, 16, '#f2c442');
  if (!isTile(map, tx + 1, ty, R)) rect(g, ox + 14, oy, 2, 16, '#f2c442');
  px(g, ox + 8, oy + 8, '#f2c442');
}

function matTile(g, ox, oy) {
  rect(g, ox + 1, oy + 3, 14, 10, '#a8442e');
  rect(g, ox + 2, oy + 4, 12, 8, '#c85a3e');
  for (let i = 0; i < 7; i++) px(g, ox + 2 + i * 2, oy + 13, '#a8442e');
}

function gymTile(g, ox, oy, tx, ty, T) {
  rect(g, ox, oy, 16, 16, (tx + ty) % 2 ? T.floor : T.floor3);
  rect(g, ox, oy, 16, 1, T.floor2);
  rect(g, ox, oy, 1, 16, T.floor2);
}

function pillarTile(g, ox, oy) {
  rect(g, ox + 3, oy + 1, 10, 15, '#b8b8c4');
  rect(g, ox + 3, oy + 1, 3, 15, '#d8d8e4');
  rect(g, ox + 11, oy + 1, 2, 15, '#8a8a98');
  rect(g, ox + 2, oy, 12, 2, '#9a9aa8');
  rect(g, ox + 2, oy + 14, 12, 2, '#8a8a98');
}

function statueTile(g, ox, oy) {
  rect(g, ox + 2, oy + 11, 12, 5, '#8a8a98');
  rect(g, ox + 2, oy + 11, 12, 1, '#b8b8c4');
  disc(g, ox + 8, oy + 7, 4, '#a8a8b4');
  disc(g, ox + 8, oy + 2, 3, '#b8b8c4');
  px(g, ox + 6, oy, '#b8b8c4'); px(g, ox + 10, oy, '#b8b8c4');
  px(g, ox + 7, oy + 2, '#5a5a68'); px(g, ox + 9, oy + 2, '#5a5a68');
}

function lampTile(g, ox, oy, frame, night) {
  ellipse(g, ox + 8, oy + 15, 3, 1, 'rgba(0,0,0,0.25)');
  rect(g, ox + 7, oy + 4, 2, 12, '#3a3a48');
  rect(g, ox + 5, oy, 6, 5, '#3a3a48');
  rect(g, ox + 6, oy + 1, 4, 3, night || frame % 2 ? '#ffe680' : '#fff4c0');
}

function castleWall(g, ox, oy, tx, ty, map) {
  rect(g, ox, oy, 16, 16, '#6e6e7c');
  for (let r = 0; r < 4; r++) {
    const off = r % 2 ? 4 : 0;
    rect(g, ox, oy + r * 4 + 3, 16, 1, '#4e4e5a');
    for (let i = 0; i < 3; i++) rect(g, ox + ((off + i * 8) % 16), oy + r * 4, 1, 3, '#4e4e5a');
  }
  if (!isTile(map, tx, ty - 1, 'K')) { rect(g, ox, oy, 16, 2, '#8e8e9c'); rect(g, ox + 4, oy - 0, 4, 1, '#4e4e5a'); }
}

function crystalTile(g, ox, oy) {
  const c = ['#b890ff', '#d8c0ff', '#8a5ad8'];
  for (const [x, h] of [[4, 9], [8, 12], [11, 7]]) {
    rect(g, ox + x, oy + 15 - h, 3, h, c[0]);
    rect(g, ox + x, oy + 15 - h, 1, h, c[1]);
    px(g, ox + x + 1, oy + 15 - h - 1, c[1]);
    rect(g, ox + x + 2, oy + 15 - h, 1, h, c[2]);
  }
}

function iceTile(g, ox, oy, tx, ty) {
  rect(g, ox, oy, 16, 16, '#c8ecfa');
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(hash2(tx, ty + i, 91) * 10);
    const y = Math.floor(hash2(tx + i, ty, 92) * 12);
    for (let k = 0; k < 4; k++) px(g, ox + x + k, oy + y + k, '#ffffff');
  }
}

function stairsTile(g, ox, oy) {
  for (let i = 0; i < 4; i++) {
    rect(g, ox, oy + i * 4, 16, 4, i % 2 ? '#a8a8b4' : '#c8c8d4');
    rect(g, ox, oy + i * 4 + 3, 16, 1, '#7a7a88');
  }
}

function dirtTile(g, ox, oy, tx, ty) {
  rect(g, ox, oy, 16, 16, '#a88458');
  for (let i = 0; i < 6; i++) px(g, ox + Math.floor(hash2(tx * 3 + i, ty, 95) * 16), oy + Math.floor(hash2(tx, ty * 3 + i, 96) * 16), i % 2 ? '#8a6a42' : '#c09a6a');
}

function snowTile(g, ox, oy, tx, ty, frame) {
  rect(g, ox, oy, 16, 16, '#f2f7fd');
  for (let i = 0; i < 3; i++) px(g, ox + Math.floor(hash2(tx * 5 + i, ty, 97) * 16), oy + Math.floor(hash2(tx, ty * 5 + i, 98) * 16), (i + frame) % 2 ? '#d6e4f4' : '#ffffff');
}

function sandTile(g, ox, oy, tx, ty, T) {
  rect(g, ox, oy, 16, 16, T.sand);
  for (let i = 0; i < 5; i++) px(g, ox + Math.floor(hash2(tx * 4 + i, ty, 99) * 16), oy + Math.floor(hash2(tx, ty * 4 + i, 100) * 16), T.sand2);
}

export function drawTile(g, map, tx, ty, frame, over, T) {
  const ox = tx * TS;
  const oy = ty * TS;
  const ch = map.rows[ty][tx];
  const theme = map.theme;
  const snowy = theme === 'snow';
  const indoor = theme === 'interior' || theme === 'gym' || theme === 'castle';
  switch (ch) {
    case '.': ground(g, ox, oy, tx, ty, T, theme); break;
    case ',': {
      ground(g, ox, oy, tx, ty, T, theme === 'cave' ? 'route' : theme);
      const pal = { a: T.tall3, b: T.tall, c: T.tall2 };
      for (let i = 0; i < 4; i++) pattern(g, ox + (i % 2) * 8, oy + Math.floor(i / 2) * 8, TALL, pal);
      break;
    }
    case ':': pathTile(g, ox, oy, tx, ty, T, map); break;
    case 's': sandTile(g, ox, oy, tx, ty, T); break;
    case '*': ground(g, ox, oy, tx, ty, T, theme); flowerTile(g, ox, oy, tx, ty); break;
    case '=': bridgeTile(g, ox, oy, tx, ty, map); break;
    case 'x': snowTile(g, ox, oy, tx, ty, frame); break;
    case 'c': caveFloor(g, ox, oy, tx, ty, THEMES.cave); break;
    case '_': floorTile(g, ox, oy, tx, ty, T); break;
    case '-': {
      rect(g, ox, oy, 16, 16, '#eceef4');
      rect(g, ox + 8 * ((tx + ty) % 2), oy, 8, 8, '#dadde8');
      rect(g, ox + 8 * ((tx + ty + 1) % 2), oy + 8, 8, 8, '#dadde8');
      break;
    }
    case 'r': rugTile(g, ox, oy, tx, ty, map); break;
    case 'm': (indoor ? floorTile : ground)(g, ox, oy, tx, ty, T, theme); matTile(g, ox, oy); break;
    case 'g': gymTile(g, ox, oy, tx, ty, T); break;
    case 'i': iceTile(g, ox, oy, tx, ty); break;
    case 'u': stairsTile(g, ox, oy); break;
    case 'd': dirtTile(g, ox, oy, tx, ty); break;
    case 'T': ground(g, ox, oy, tx, ty, T, theme === 'cave' ? 'route' : theme); treeTile(g, ox, oy, tx, ty, T, over && !isTile(map, tx, ty - 1, 'TP') ? over : null, snowy); break;
    case 'P': ground(g, ox, oy, tx, ty, T, theme); pineTile(g, ox, oy, tx, ty, T, snowy || theme === 'mountain'); break;
    case 't': ground(g, ox, oy, tx, ty, T, theme); bushTile(g, ox, oy, T); break;
    case '~': waterTile(g, ox, oy, tx, ty, T, frame, map); break;
    case '#': cliffTile(g, ox, oy, tx, ty, theme === 'cave' ? THEMES.cave : T, map, theme); break;
    case '^': ground(g, ox, oy, tx, ty, T, theme); ledgeTile(g, ox, oy, T); break;
    case 'f': ground(g, ox, oy, tx, ty, T, theme); fenceTile(g, ox, oy, tx, ty, map); break;
    case 'o': (theme === 'cave' ? caveFloor : ground)(g, ox, oy, tx, ty, theme === 'cave' ? THEMES.cave : T, theme); rockTile(g, ox, oy, T); break;
    case 'C': caveWall(g, ox, oy, tx, ty, THEMES.cave, map); break;
    case 'w': wallTile(g, ox, oy, tx, ty, T, map); break;
    case 'k': counterTile(g, ox, oy); break;
    case 'b': floorTile(g, ox, oy, tx, ty, T); shelfTile(g, ox, oy, tx, ty); break;
    case 'j': floorTile(g, ox, oy, tx, ty, T); tableTile(g, ox, oy, tx, ty, map); break;
    case 'y': floorTile(g, ox, oy, tx, ty, T); plantTile(g, ox, oy); break;
    case 'n': floorTile(g, ox, oy, tx, ty, T); bedTile(g, ox, oy, tx, ty, map); break;
    case 'p': floorTile(g, ox, oy, tx, ty, T); pcTile(g, ox, oy, frame); break;
    case 'h': healerTile(g, ox, oy, tx, ty, T, map, frame); break;
    case 'G': (indoor ? floorTile : ground)(g, ox, oy, tx, ty, T, theme); pillarTile(g, ox, oy); break;
    case 'l': ground(g, ox, oy, tx, ty, T, theme); lampTile(g, ox, oy, frame); break;
    case 'z': (indoor ? (theme === 'gym' ? gymTile : floorTile) : ground)(g, ox, oy, tx, ty, T, theme); statueTile(g, ox, oy); break;
    case 'K': castleWall(g, ox, oy, tx, ty, map); break;
    case 'Q': caveFloor(g, ox, oy, tx, ty, THEMES.cave); crystalTile(g, ox, oy); break;
    default: rect(g, ox, oy, 16, 16, '#ff00ff');
  }
  if (!TILES[ch]) rect(g, ox, oy, 16, 16, '#ff00ff');
}

// ---------- budovy ----------
function window2(g, x, y) {
  rect(g, x, y, 10, 8, '#6a4a2e');
  rect(g, x + 1, y + 1, 8, 6, '#8ccaf0');
  rect(g, x + 1, y + 1, 3, 2, '#d8f2ff');
  rect(g, x + 5, y + 1, 1, 6, '#6a4a2e');
}

function roof(g, x, y, w, h, color) {
  rect(g, x, y + 1, w, h - 1, color);
  rect(g, x + 2, y, w - 4, 1, shade(color, -0.3));
  for (let i = 3; i < h - 2; i += 3) rect(g, x, y + i, w, 1, shade(color, -0.12));
  rect(g, x, y + 1, w, 2, shade(color, 0.18));
  rect(g, x, y + h - 2, w, 2, shade(color, -0.35));
  rect(g, x, y + 1, 1, h - 1, shade(color, -0.25));
  rect(g, x + w - 1, y + 1, 1, h - 1, shade(color, -0.25));
}

function door(g, x, y, color = '#7a4a2a') {
  rect(g, x + 3, y + 3, 10, 13, shade(color, -0.4));
  rect(g, x + 4, y + 4, 8, 12, color);
  rect(g, x + 4, y + 4, 8, 1, shade(color, 0.3));
  px(g, x + 10, y + 10, '#f2c442');
}

function drawBuilding(g, b) {
  const x = b.x * TS;
  const y = b.y * TS;
  const w = b.w * TS;
  const h = b.h * TS;
  const doorX = (b.x + b.door) * TS;
  const doorY = (b.y + b.h - 1) * TS;
  ellipse(g, x + w / 2, y + h - 1, w / 2 + 2, 3, 'rgba(0,0,0,0.18)');
  switch (b.style) {
    case 'center': {
      const rh = Math.round(h * 0.5);
      roof(g, x, y, w, rh, '#e25050');
      rect(g, x + 1, y + rh, w - 2, h - rh, '#f8f4ee');
      rect(g, x + 1, y + h - 2, w - 2, 2, '#cfc6b8');
      disc(g, x + w / 2, y + rh / 2 + 1, 8, '#ffffff');
      rect(g, x + w / 2 - 2, y + rh / 2 - 5, 4, 12, '#e25050');
      rect(g, x + w / 2 - 6, y + rh / 2 - 1, 12, 4, '#e25050');
      for (let i = 0; i < b.w; i++) if (i !== b.door) window2(g, x + i * TS + 3, y + rh + 4);
      rect(g, doorX + 1, doorY + 2, 14, 14, '#4a4a58');
      rect(g, doorX + 2, doorY + 3, 6, 13, '#8ad4f4');
      rect(g, doorX + 8, doorY + 3, 6, 13, '#7ac4e8');
      rect(g, doorX - 4, y + rh + 1, 24, 6, '#e25050');
      g.fillStyle = '#ffffff';
      g.font = 'bold 5px sans-serif';
      g.fillText('CT', doorX + 3, y + rh + 6);
      break;
    }
    case 'gym': {
      const rh = Math.round(h * 0.45);
      const col = b.roof || '#7a6a9a';
      roof(g, x, y, w, rh, col);
      rect(g, x + 1, y + rh, w - 2, h - rh, '#d8d2c6');
      for (let i = 0; i < 3; i++) rect(g, x + 1, y + rh + 6 + i * 8, w - 2, 1, '#bcb4a6');
      rect(g, x + 1, y + h - 3, w - 2, 3, '#a89c8a');
      const cx = x + w / 2;
      const cy = y + rh / 2 + 2;
      g.fillStyle = '#f2c442';
      g.beginPath();
      g.moveTo(cx, cy - 9); g.lineTo(cx + 9, cy); g.lineTo(cx, cy + 9); g.lineTo(cx - 9, cy); g.closePath();
      g.fill();
      g.fillStyle = shade(col, 0.2);
      g.beginPath();
      g.moveTo(cx, cy - 5); g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 5); g.lineTo(cx - 5, cy); g.closePath();
      g.fill();
      for (const fx of [x + 2, x + w - 5]) { rect(g, fx, y - 8, 1, 10, '#5a5a68'); rect(g, fx + 1, y - 8, 5, 4, shade(col, 0.1)); }
      rect(g, doorX - 3, doorY, 22, 16, '#5a4a3a');
      rect(g, doorX - 2, doorY + 1, 10, 15, '#8a6a4a');
      rect(g, doorX + 8, doorY + 1, 10, 15, '#7a5a3a');
      for (let i = 0; i < b.w; i++) if (Math.abs(i - b.door) > 1 && i > 0 && i < b.w - 1) window2(g, x + i * TS + 3, y + rh + 6);
      break;
    }
    case 'lab': {
      const rh = Math.round(h * 0.4);
      roof(g, x, y, w, rh, b.roof || '#8a8a9a');
      rect(g, x + 1, y + rh, w - 2, h - rh, '#f6f6fa');
      rect(g, x + 1, y + h - 2, w - 2, 2, '#c8c8d4');
      for (let i = 0; i < b.w; i++) if (i !== b.door) window2(g, x + i * TS + 3, y + rh + 5);
      rect(g, x + w - 18, y - 6, 2, 8, '#6a6a78');
      ellipse(g, x + w - 17, y - 7, 5, 2, '#c8c8d4');
      door(g, doorX, doorY, '#4a6a9a');
      break;
    }
    case 'mill': {
      rect(g, x + 8, y + 18, w - 16, h - 18, '#d8c4a0');
      rect(g, x + 6, y + 14, w - 12, 6, b.roof || '#a8742a');
      roof(g, x + 10, y + 6, w - 20, 10, b.roof || '#a8742a');
      for (let i = 0; i < 5; i++) rect(g, x + 8, y + 24 + i * 9, w - 16, 1, '#c0aa84');
      const cx = x + w / 2;
      const cy = y + 14;
      g.save();
      g.strokeStyle = '#6a4a2a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - 24, cy - 24); g.lineTo(cx + 24, cy + 24);
      g.moveTo(cx + 24, cy - 24); g.lineTo(cx - 24, cy + 24);
      g.stroke();
      g.fillStyle = '#f4ecd8';
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath();
        g.moveTo(cx + sx * 6, cy + sy * 6);
        g.lineTo(cx + sx * 22, cy + sy * 22);
        g.lineTo(cx + sx * 22 + (sx * sy > 0 ? 6 : -6) * -sy, cy + sy * 22 + 6 * sx * (sx * sy > 0 ? 1 : 1) * 0);
        g.lineTo(cx + sx * 10 + (sy > 0 ? -5 : 5) * sx, cy + sy * 10);
        g.closePath();
        g.fill();
      }
      g.restore();
      disc(g, cx, cy, 3, '#5a3a1e');
      door(g, doorX, doorY);
      break;
    }
    case 'castle': {
      rect(g, x, y + 8, w, h - 8, '#7e7e8c');
      for (let r = 0; r < (h - 8) / 6; r++) {
        rect(g, x, y + 8 + r * 6 + 5, w, 1, '#5e5e6a');
        for (let i = 0; i < w / 12; i++) rect(g, x + ((r % 2 ? 6 : 0) + i * 12) % w, y + 8 + r * 6, 1, 5, '#5e5e6a');
      }
      for (let i = 0; i < w / 8; i++) if (i % 2 === 0) rect(g, x + i * 8, y, 8, 9, '#7e7e8c');
      rect(g, x, y + 8, w, 2, '#9e9eac');
      for (const tx of [x - 2, x + w - 14]) { rect(g, tx, y - 10, 16, h - 4, '#6e6e7c'); roof(g, tx - 2, y - 18, 20, 10, b.roof || '#5a3a7a'); }
      rect(g, doorX - 2, doorY - 6, 20, 22, '#3a2a2a');
      disc(g, doorX + 8, doorY - 4, 10, '#3a2a2a');
      rect(g, doorX + 1, doorY - 2, 14, 18, '#5a3a2a');
      for (let i = 0; i < 3; i++) rect(g, doorX + 3 + i * 4, doorY - 2, 1, 18, '#3a2a1a');
      break;
    }
    case 'tower': {
      rect(g, x + 4, y + 10, w - 8, h - 10, '#7e7e8c');
      for (let r = 0; r < (h - 10) / 6; r++) rect(g, x + 4, y + 10 + r * 6 + 5, w - 8, 1, '#5e5e6a');
      roof(g, x + 2, y, w - 4, 12, b.roof || '#5a3a7a');
      window2(g, x + w / 2 - 5, y + 20);
      door(g, doorX, doorY, '#5a3a2a');
      break;
    }
    case 'cave': {
      disc(g, doorX + 8, doorY + 6, 10, '#2a2018');
      rect(g, doorX - 2, doorY + 6, 20, 10, '#2a2018');
      disc(g, doorX + 8, doorY + 7, 7, '#120c08');
      rect(g, doorX + 1, doorY + 7, 14, 9, '#120c08');
      break;
    }
    default: {
      const rh = Math.round(h * 0.55);
      roof(g, x, y, w, rh, b.roof || '#c85a3a');
      if (b.style === 'home') { rect(g, x + w - 16, y - 4, 7, 9, '#8a4a3a'); rect(g, x + w - 17, y - 5, 9, 2, '#6a3a2a'); }
      rect(g, x + 1, y + rh, w - 2, h - rh, '#f2e6cc');
      rect(g, x + 1, y + rh, w - 2, 1, '#d8c8a8');
      rect(g, x + 1, y + h - 2, w - 2, 2, '#c8b490');
      for (let i = 0; i < b.w; i++) if (i !== b.door) window2(g, x + i * TS + 3, y + rh + 3);
      door(g, doorX, doorY);
    }
  }
}

function drawSign(g, s) {
  const ox = s.x * TS;
  const oy = s.y * TS;
  ellipse(g, ox + 8, oy + 15, 4, 1, 'rgba(0,0,0,0.2)');
  rect(g, ox + 7, oy + 9, 2, 7, '#7a4a2a');
  rect(g, ox + 1, oy + 2, 14, 8, '#6a4422');
  rect(g, ox + 2, oy + 3, 12, 6, '#c8985a');
  rect(g, ox + 3, oy + 5, 8, 1, '#8a6a3a');
  rect(g, ox + 3, oy + 7, 6, 1, '#8a6a3a');
}

// Vyrenderuje celou mapu: 2 snímky podkladu (animace vody) + vrstvu „nad postavami“.
export function renderMap(map) {
  const W = map.w * TS;
  const H = map.h * TS;
  const T = themeOf(map);
  const frames = [];
  const overC = makeCanvas(W, H);
  for (let f = 0; f < 2; f++) {
    const { c, g } = makeCanvas(W, H);
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) drawTile(g, map, tx, ty, f, f === 0 ? overC.g : null, T);
    }
    for (const b of map.buildings) drawBuilding(g, b);
    for (const s of map.signs) drawSign(g, s);
    frames.push(c);
  }
  return { frames, over: overC.c, w: W, h: H };
}

// Dlaždice vysoké trávy pro překreslení přes nohy postav.
export function tallGrassOverlay(map) {
  const T = themeOf(map);
  const { c, g } = makeCanvas(16, 8);
  const pal = { a: T.tall3, b: T.tall, c: T.tall2 };
  pattern(g, 0, 0, TALL.slice(0, 8), pal);
  pattern(g, 8, 0, TALL.slice(0, 8), pal);
  return c;
}

// Orb (předmět na zemi / ikona).
export function drawOrb(g, cx, cy, r, top = '#3a7ad8') {
  disc(g, cx, cy + 1, r, 'rgba(0,0,0,0.25)');
  disc(g, cx, cy, r, '#f4f4f8');
  g.save();
  g.beginPath();
  g.rect(cx - r - 1, cy - r - 1, r * 2 + 2, r + 1);
  g.clip();
  disc(g, cx, cy, r, top);
  g.restore();
  rect(g, cx - r, cy, r * 2, 1, '#f2c442');
  disc(g, cx, cy, Math.max(1, Math.round(r / 3)), '#f2c442');
  px(g, cx - Math.round(r / 2), cy - Math.round(r / 2), '#ffffff');
}
