// Pixelové postavičky hráčů a NPC (16×20 px, 4 směry × 3 snímky chůze).
import { shade, makeCanvas, outlineCanvas } from './util.js';
import { pattern, ellipse } from './tiles.js';
import { SKINS, lookOf } from '/shared/looks.js';

export const CW = 16;
export const CH = 20;
const DIR_ROW = { down: 0, up: 1, left: 2, right: 3 };

// Základní postava. k kůže, K stín kůže, e oko, s triko, S stín trika, p kalhoty, o boty
const BODY_DOWN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kkkkkkkkkk...',
  '...kkekkkkekk...',
  '...kkekkkkekk...',
  '....kkkkkkkk....',
  '.....KKKKKK.....',
  '....ssssssss....',
  '...ssssssssss...',
  '...ssssssssss...',
  '...kssssssssk...',
  '....SSSSSSSS....',
];
const BODY_UP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kkkkkkkkkk...',
  '...kkkkkkkkkk...',
  '...kkkkkkkkkk...',
  '....kkkkkkkk....',
  '.....KKKKKK.....',
  '....ssssssss....',
  '...ssssssssss...',
  '...ssssssssss...',
  '...kssssssssk...',
  '....SSSSSSSS....',
];
const BODY_LEFT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkk.....',
  '...kkkkkkkkk....',
  '...kekkkkkkk....',
  '...kekkkkkkk....',
  '....kkkkkkk.....',
  '.....KKKKK......',
  '.....ssssss.....',
  '....sssssss.....',
  '....ssssssss....',
  '.....kssssss....',
  '.....SSSSSS.....',
];

const LEGS = {
  down: [
    ['....ppp..ppp....', '....ppp..ppp....', '....ooo..ooo....'],
    ['....ppp..ppp....', '....ooo..ppp....', '.........ooo....'],
    ['....ppp..ppp....', '....ppp..ooo....', '....ooo.........'],
  ],
  left: [
    ['.....pppp.......', '.....pppp.......', '.....oooo.......'],
    ['....pp..pp......', '...ooo..pp......', '........oo......'],
    ['.....ppp........', '.....ppp........', '....oooo........'],
  ],
};

// Vlasy: pole řádků 0–9, kreslí se přes hlavu. h vlasy, H stín vlasů
const HAIR = {
  0: {
    down: ['................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hh......hh...'],
    up: ['................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...HhhhhhhhhH...', '....HHHHHHHH....'],
    left: ['................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '......hhhhhh....', '.......hhhhh....', '........hhh.....'],
  },
  1: {
    down: ['................', '...h..h..h..h...', '...hh.hhhhh.hh..', '...hhhhhhhhhhh..', '..hhhhhhhhhhhh..', '...hhhhhhhhhh...', '...hh.h..h.hh...'],
    up: ['................', '...h..h..h..h...', '...hh.hhhhh.hh..', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...HhhhhhhhhH...', '....HHHHHHHH....'],
    left: ['................', '....h..h..h.....', '....hhhhhhhh.h..', '...hhhhhhhhhhh..', '...hhhhhhhhhhh..', '...hhhhhhhhhh...', '......hhhhhhh...', '.......hhhhhh...', '........hhhh....'],
  },
  2: {
    down: ['................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhh......hhh..', '..hh........hh..', '..hh........hh..', '..hh........hh..', '..hH........Hh..', '..HH........HH..'],
    up: ['................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..HhhhhhhhhhhH..', '...HHHHHHHHHH...', '....HHHHHHHH....'],
    left: ['................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhhh..', '......hhhhhhhh..', '.......hhhhhhh..', '........hhhhhh..', '........hhhhhh..', '.........HHHHH..', '..........HHHH..'],
  },
  3: {
    down: ['......hhhh......', '.....hhhhhh.....', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hh......hh...'],
    up: ['......hhhh......', '.....hhhhhh.....', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...HhhhhhhhhH...', '....HHhhhhHH....', '......hhhh......', '......HhhH......'],
    left: ['.......hhhh.....', '......hhhhhh....', '.....hhhhhhh....', '....hhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhhh..', '......hhhhhhhh..', '.......hhhhh.hh.', '........hhh..hh.', '.............Hh.'],
  },
  4: { down: [], up: [], left: [] },
};

function hatRows(dir) {
  if (dir === 'down') return ['................', '................', '.....tttttt.....', '....tttttttt....', '...tttttttttt...', '...TTTTTTTTTT...', '..TTTTTTTTTTTT..'];
  if (dir === 'up') return ['................', '................', '.....tttttt.....', '....tttttttt....', '...tttttttttt...', '...tttttttttt...', '...TTTTTTTTTT...'];
  return ['................', '................', '.....tttttt.....', '....tttttttt....', '...tttttttttt...', '...tttttttttt...', '.TTTTTTTT.......'];
}

function flip(rows) {
  return rows.map((r) => r.split('').reverse().join(''));
}

function drawFrame(g, ox, oy, look, dir, frame) {
  const L = lookOf(look);
  const skin = SKINS[L.skin] || SKINS[1];
  const x = L.x || [];
  const coat = x.includes('coat');
  const robe = x.includes('robe');
  const shirt = L.shirt;
  const pal = {
    k: skin, K: shade(skin, -0.18), e: '#2a2030',
    s: coat ? '#f4f4f4' : shirt, S: shade(coat ? '#f4f4f4' : shirt, -0.22),
    p: robe ? shirt : L.pants, P: shade(L.pants, -0.25), o: '#3a2e2a',
    h: L.hair, H: shade(L.hair, -0.25), t: L.hat || '#e8443a', T: shade(L.hat || '#e8443a', -0.25),
  };
  const side = dir === 'left' || dir === 'right';
  const mirror = dir === 'right';
  const put = (rows, dy = 0) => pattern(g, ox, oy + dy, mirror ? flip(rows) : rows, pal);

  // plášť a batoh za tělem
  if (x.includes('cape')) {
    const cape = shade(shirt, -0.35);
    g.fillStyle = cape;
    if (dir === 'up') g.fillRect(ox + 3, oy + 11, 10, 8);
    else if (side) g.fillRect(ox + (mirror ? 3 : 9), oy + 11, 4, 7);
    else { g.fillRect(ox + 2, oy + 11, 2, 7); g.fillRect(ox + 12, oy + 11, 2, 7); }
  }
  // tělo
  const body = dir === 'up' ? BODY_UP : side ? BODY_LEFT : BODY_DOWN;
  put(body);
  // nohy
  const legs = side ? LEGS.left[frame] : LEGS.down[frame];
  put(legs, 16);
  if (robe) {
    g.fillStyle = shirt;
    g.fillRect(ox + (side ? 5 : 4), oy + 15, side ? 6 : 8, 3);
  }
  if (coat) {
    g.fillStyle = '#f4f4f4';
    if (dir === 'down') { g.fillRect(ox + 4, oy + 15, 2, 2); g.fillRect(ox + 10, oy + 15, 2, 2); g.fillStyle = shirt; g.fillRect(ox + 7, oy + 11, 2, 4); }
    else if (dir === 'up') g.fillRect(ox + 4, oy + 15, 8, 2);
    else g.fillRect(ox + (mirror ? 5 : 6), oy + 15, 5, 2);
  }
  if (x.includes('apron') && dir !== 'up') {
    g.fillStyle = '#f4f0e8';
    g.fillRect(ox + (side ? (mirror ? 6 : 5) : 5), oy + 12, side ? 4 : 6, 5);
  }
  if (x.includes('belt')) { g.fillStyle = '#2a2a32'; g.fillRect(ox + (side ? 5 : 4), oy + 15, side ? 6 : 8, 1); }
  if (x.includes('emblem') && dir === 'down') { g.fillStyle = '#e8c040'; g.fillRect(ox + 7, oy + 12, 2, 2); }
  if (x.includes('pack')) {
    g.fillStyle = '#a8742a';
    if (dir === 'up') g.fillRect(ox + 4, oy + 11, 8, 5);
    else if (side) g.fillRect(ox + (mirror ? 3 : 10), oy + 11, 3, 5);
  }
  if (x.includes('scarf')) {
    g.fillStyle = L.hat || '#e8443a';
    g.fillRect(ox + (side ? 5 : 4), oy + 10, side ? 6 : 8, 2);
    if (dir === 'up') g.fillRect(ox + 9, oy + 12, 2, 3);
  }
  // vlasy
  const hs = HAIR[L.hs] || HAIR[0];
  const hair = dir === 'up' ? hs.up : side ? hs.left : hs.down;
  if (L.hat) {
    if (dir === 'up' && hs.up.length > 7) put(hs.up.slice(0, 12));
    put(hatRows(side ? 'left' : dir));
  } else if (hair.length) put(hair);
  if (x.includes('beard') && dir !== 'up') {
    g.fillStyle = L.hair === '#e8e8f0' || !L.hair ? '#e8e8f0' : L.hair;
    if (side) g.fillRect(ox + (mirror ? 7 : 3), oy + 8, 6, 3);
    else g.fillRect(ox + 4, oy + 8, 8, 3);
  }
  if (x.includes('glasses') && dir !== 'up') {
    g.fillStyle = '#2a2a3a';
    if (side) g.fillRect(ox + (mirror ? 9 : 2), oy + 7, 5, 1);
    else { g.fillRect(ox + 4, oy + 7, 8, 1); g.fillRect(ox + 4, oy + 8, 1, 1); g.fillRect(ox + 11, oy + 8, 1, 1); }
  }
  if (x.includes('crown')) {
    g.fillStyle = '#f2c442';
    g.fillRect(ox + 5, oy + 1, 6, 2);
    g.fillRect(ox + 5, oy, 1, 1); g.fillRect(ox + 7, oy, 2, 1); g.fillRect(ox + 10, oy, 1, 1);
  }
}

const cache = new Map();

export function charSheet(look) {
  const L = lookOf(look);
  const key = JSON.stringify(L);
  let c = cache.get(key);
  if (c) return c;
  const mk = makeCanvas(CW * 3, CH * 4);
  for (const dir of ['down', 'up', 'left', 'right']) {
    for (let f = 0; f < 3; f++) {
      const fc = makeCanvas(CW, CH);
      drawFrame(fc.g, 0, 0, L, dir, f);
      outlineCanvas(fc.c, '#1c1622');
      mk.g.drawImage(fc.c, f * CW, DIR_ROW[dir] * CH);
    }
  }
  cache.set(key, mk.c);
  return mk.c;
}

// Nakreslí postavu: (px, py) = levý horní roh dlaždice ve světových pixelech.
export function drawChar(g, look, dir, frame, px, py, opts = {}) {
  const sheet = charSheet(look);
  if (!opts.noShadow) ellipse(g, px + 8, py + 14, 5, 2, 'rgba(0,0,0,0.22)');
  const lift = opts.lift || 0;
  g.drawImage(sheet, frame * CW, DIR_ROW[dir] * CH, CW, CH, px, py - 5 - lift, CW, CH);
}

// Velký portrét trenéra pro souboj (zvětšený sprite).
export function trainerPortrait(look, scale = 6) {
  const fc = makeCanvas(CW, CH);
  drawFrame(fc.g, 0, 0, lookOf(look), 'down', 0);
  outlineCanvas(fc.c, '#1c1622');
  const big = makeCanvas(CW * scale, CH * scale);
  big.g.imageSmoothingEnabled = false;
  big.g.drawImage(fc.c, 0, 0, CW * scale, CH * scale);
  return big.c;
}
