// Typy tvorů a tabulka účinnosti (útočník -> obránce).
// Sdíleno serverem i klientem.

export const TYPES = {
  normal:   { name: 'Normál',    color: '#a8a77a' },
  fire:     { name: 'Oheň',      color: '#ee8130' },
  water:    { name: 'Voda',      color: '#6390f0' },
  plant:    { name: 'Rostlina',  color: '#5fbd3c' },
  electric: { name: 'Elektřina', color: '#f2c62c' },
  ice:      { name: 'Led',       color: '#7fd8d6' },
  brawl:    { name: 'Boj',       color: '#c22e28' },
  toxic:    { name: 'Jed',       color: '#a33ea1' },
  earth:    { name: 'Země',      color: '#d9b45a' },
  air:      { name: 'Vzduch',    color: '#9a8cf0' },
  mind:     { name: 'Psychika',  color: '#f95587' },
  bug:      { name: 'Hmyz',      color: '#a6b91a' },
  stone:    { name: 'Kámen',     color: '#b6a136' },
  spirit:   { name: 'Přízrak',   color: '#735797' },
  dragon:   { name: 'Drak',      color: '#6f35fc' },
  shadow:   { name: 'Temnota',   color: '#5a4a44' },
  metal:    { name: 'Kov',       color: '#9fa6bd' },
  fae:      { name: 'Víla',      color: '#e89ad8' },
};

export const TYPE_KEYS = Object.keys(TYPES);

// Pouze odchylky od 1×.
const CHART = {
  normal:   { stone: .5, metal: .5, spirit: 0 },
  fire:     { plant: 2, ice: 2, bug: 2, metal: 2, fire: .5, water: .5, stone: .5, dragon: .5 },
  water:    { fire: 2, earth: 2, stone: 2, water: .5, plant: .5, dragon: .5 },
  plant:    { water: 2, earth: 2, stone: 2, fire: .5, plant: .5, toxic: .5, air: .5, bug: .5, dragon: .5, metal: .5 },
  electric: { water: 2, air: 2, electric: .5, plant: .5, dragon: .5, earth: 0 },
  ice:      { plant: 2, earth: 2, air: 2, dragon: 2, fire: .5, water: .5, ice: .5, metal: .5 },
  brawl:    { normal: 2, ice: 2, stone: 2, shadow: 2, metal: 2, toxic: .5, air: .5, mind: .5, bug: .5, fae: .5, spirit: 0 },
  toxic:    { plant: 2, fae: 2, toxic: .5, earth: .5, stone: .5, spirit: .5, metal: 0 },
  earth:    { fire: 2, electric: 2, toxic: 2, stone: 2, metal: 2, plant: .5, bug: .5, air: 0 },
  air:      { plant: 2, brawl: 2, bug: 2, electric: .5, stone: .5, metal: .5 },
  mind:     { brawl: 2, toxic: 2, mind: .5, metal: .5, shadow: 0 },
  bug:      { plant: 2, mind: 2, shadow: 2, fire: .5, brawl: .5, toxic: .5, air: .5, spirit: .5, metal: .5, fae: .5 },
  stone:    { fire: 2, ice: 2, air: 2, bug: 2, brawl: .5, earth: .5, metal: .5 },
  spirit:   { mind: 2, spirit: 2, shadow: .5, normal: 0 },
  dragon:   { dragon: 2, metal: .5, fae: 0 },
  shadow:   { mind: 2, spirit: 2, brawl: .5, shadow: .5, fae: .5 },
  metal:    { ice: 2, stone: 2, fae: 2, fire: .5, water: .5, electric: .5, metal: .5 },
  fae:      { brawl: 2, dragon: 2, shadow: 2, fire: .5, toxic: .5, metal: .5 },
};

export function typeEffect(atkType, defType) {
  if (!atkType || !CHART[atkType]) return 1;
  const v = CHART[atkType][defType];
  return v === undefined ? 1 : v;
}

export function effectiveness(atkType, defTypes) {
  let m = 1;
  for (const t of defTypes) m *= typeEffect(atkType, t);
  return m;
}

export function typeName(t) {
  return TYPES[t] ? TYPES[t].name : t;
}

export function typeColor(t) {
  return TYPES[t] ? TYPES[t].color : '#888';
}
