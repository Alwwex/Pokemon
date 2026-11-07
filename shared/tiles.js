// Legenda dlaždic map. walk = průchozí, enc = divocí tvorové, ledge = lze jen seskočit dolů.
export const TILES = {
  '.': { walk: true, n: 'grass' },
  ',': { walk: true, enc: true, n: 'tall' },
  ':': { walk: true, n: 'path' },
  's': { walk: true, n: 'sand' },
  '*': { walk: true, n: 'flowers' },
  '=': { walk: true, n: 'bridge' },
  'x': { walk: true, n: 'snow' },
  'c': { walk: true, n: 'cave' },
  '_': { walk: true, n: 'floor' },
  '-': { walk: true, n: 'tilefloor' },
  'r': { walk: true, n: 'rug' },
  'm': { walk: true, n: 'mat' },
  'g': { walk: true, n: 'gymfloor' },
  'i': { walk: true, n: 'ice' },
  'u': { walk: true, n: 'stairs' },
  'd': { walk: true, n: 'dirt' },
  'T': { walk: false, n: 'tree' },
  'P': { walk: false, n: 'pine' },
  't': { walk: false, n: 'bush' },
  '~': { walk: false, n: 'water' },
  '#': { walk: false, n: 'cliff' },
  '^': { walk: false, ledge: true, n: 'ledge' },
  'f': { walk: false, n: 'fence' },
  'o': { walk: false, n: 'rock' },
  'C': { walk: false, n: 'cavewall' },
  'w': { walk: false, n: 'wall' },
  'k': { walk: false, n: 'counter' },
  'b': { walk: false, n: 'shelf' },
  'j': { walk: false, n: 'table' },
  'y': { walk: false, n: 'plant' },
  'n': { walk: false, n: 'bed' },
  'p': { walk: false, n: 'pc' },
  'h': { walk: false, n: 'healer' },
  'G': { walk: false, n: 'pillar' },
  'l': { walk: false, n: 'lamp' },
  'z': { walk: false, n: 'statue' },
  'K': { walk: false, n: 'castlewall' },
  'Q': { walk: false, n: 'crystal' },
};

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
  return map.rows[y][x];
}

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
