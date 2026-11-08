// Šablony interiérů (centrum, dům, laboratoř …).

// Centrum tvorů – léčení, obchod a počítač s úložištěm.
export function center(id, name, extraNpcs = []) {
  return {
    id,
    name: `${name} – Centrum tvorů`,
    theme: 'interior',
    music: 'center',
    bg: 'town',
    rows: [
      'wwwwwhhhwwwww',
      'wwwwwwwwwwwww',
      '_____________',
      '_p__kkkkkkkkk',
      '_____________',
      'y___________y',
      '___rrrrrrr___',
      '___rrrrrrr___',
      '______m______',
    ],
    mat: { x: 6, y: 8 },
    npcs: [
      { id: `${id}_nurse`, x: 6, y: 2, dir: 'down', look: 'nurse', script: 'heal', name: 'Sestra Alenka' },
      { id: `${id}_clerk`, x: 11, y: 2, dir: 'down', look: 'clerk', script: 'shop', name: 'Prodavač' },
      { id: `${id}_hats`, x: 11, y: 5, dir: 'left', look: 'hatter', script: 'hats', name: 'Kloboučnice Klára' },
      ...extraNpcs,
    ],
    signs: [],
    pc: { x: 1, y: 3 },
    respawn: { x: 6, y: 4 },
  };
}

// Obyčejný dům s obyvateli.
export function house(id, name, npcs = [], opts = {}) {
  return {
    id,
    name,
    theme: 'interior',
    music: opts.music || 'town',
    bg: 'town',
    rows: opts.rows || [
      'wwwwwwwwwww',
      'wbbwwwwwwbw',
      '_________n_',
      '__jj_____n_',
      '__jj_______',
      '___________',
      'y_________y',
      '_____m_____',
    ],
    mat: opts.mat || { x: 5, y: 7 },
    npcs,
    signs: opts.signs || [],
    items: opts.items || [],
  };
}

export function lab(id, name) {
  return {
    id,
    name,
    theme: 'interior',
    music: 'lab',
    bg: 'town',
    rows: [
      'wwwwwwwwwwwww',
      'wbbbwwwwwbbbw',
      '_____________',
      '__jjj___jjj__',
      '_____________',
      '_____________',
      'b___________b',
      'b___________b',
      '______m______',
    ],
    mat: { x: 6, y: 8 },
    npcs: [],
    signs: [],
  };
}
