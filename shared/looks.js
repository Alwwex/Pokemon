// Vzhled postav (hráči i NPC). Klient z toho kreslí pixelové postavičky.
// skin: index barvy kůže, hair: barva vlasů, hs: účes (0 krátké, 1 ježek, 2 dlouhé, 3 culík, 4 holá hlava),
// shirt / pants: barvy oblečení, hat: barva čepice (nebo null), x: doplňky
export const SKINS = ['#ffe0c4', '#f6c9a0', '#d9a273', '#a86f48', '#6e4630'];
export const HAIR_COLORS = ['#2a1e16', '#5a3a22', '#a8642a', '#e8c06a', '#d84a2a', '#3a3a48', '#e8e8f0', '#4a7ad8', '#d86aa8', '#4aa86a'];
export const SHIRT_COLORS = ['#e8443a', '#3a7ad8', '#4aa84a', '#f2c42c', '#8a4ad8', '#f08a2a', '#2ab0b0', '#e86aa8', '#3a3a48', '#f4f4f4'];
export const PANTS_COLORS = ['#3a4a7a', '#2a2a32', '#7a5a3a', '#4a6a3a', '#8a8a96', '#7a2a3a'];

export const LOOKS = {
  mom:       { skin: 1, hair: '#7a4a2a', hs: 2, shirt: '#e8789a', pants: '#5a5a8a' },
  prof:      { skin: 0, hair: '#c8c8d0', hs: 3, shirt: '#f4f4f4', pants: '#4a4a6a', x: ['coat', 'glasses'] },
  nurse:     { skin: 0, hair: '#ff9ac0', hs: 3, shirt: '#f8f8f8', pants: '#ff8aa8', hat: '#ffffff' },
  clerk:     { skin: 2, hair: '#3a2a1a', hs: 0, shirt: '#3a7ad8', pants: '#3a3a4a', x: ['apron'] },
  rival:     { skin: 1, hair: '#d84a2a', hs: 1, shirt: '#2a2a32', pants: '#3a4a7a', x: ['scarf'] },
  kid:       { skin: 1, hair: '#5a3a22', hs: 0, shirt: '#f2c42c', pants: '#3a4a7a' },
  girl:      { skin: 0, hair: '#e8c06a', hs: 3, shirt: '#e86aa8', pants: '#3a4a7a' },
  youngster: { skin: 1, hair: '#2a1e16', hs: 0, shirt: '#3a7ad8', pants: '#7a5a3a', hat: '#e8443a' },
  lass:      { skin: 0, hair: '#a8642a', hs: 2, shirt: '#f08a2a', pants: '#e8443a' },
  bugcatcher:{ skin: 2, hair: '#2a1e16', hs: 0, shirt: '#4aa84a', pants: '#7a5a3a', hat: '#f2c42c' },
  hiker:     { skin: 2, hair: '#5a3a22', hs: 4, shirt: '#a8642a', pants: '#4a6a3a', hat: '#7a5a3a', x: ['beard', 'pack'] },
  fisher:    { skin: 1, hair: '#3a3a48', hs: 0, shirt: '#2ab0b0', pants: '#3a4a7a', hat: '#f2c42c' },
  swimmer:   { skin: 2, hair: '#e8c06a', hs: 2, shirt: '#3a7ad8', pants: '#3a7ad8' },
  scientist: { skin: 0, hair: '#3a3a48', hs: 0, shirt: '#f4f4f4', pants: '#3a3a48', x: ['coat', 'glasses'] },
  karate:    { skin: 2, hair: '#2a1e16', hs: 1, shirt: '#f4f4f4', pants: '#f4f4f4', x: ['belt'] },
  medium:    { skin: 0, hair: '#3a3a48', hs: 2, shirt: '#6a4a9a', pants: '#3a2a4a', x: ['robe'] },
  gardener:  { skin: 1, hair: '#a8642a', hs: 3, shirt: '#4aa84a', pants: '#7a5a3a', hat: '#e8c06a', x: ['apron'] },
  skier:     { skin: 0, hair: '#e8c06a', hs: 0, shirt: '#e8443a', pants: '#3a3a48', hat: '#3a7ad8', x: ['scarf'] },
  dragon:    { skin: 2, hair: '#3a3a48', hs: 1, shirt: '#3a5eb0', pants: '#2a2a32', x: ['cape'] },
  grunt:     { skin: 1, hair: '#3a3a48', hs: 0, shirt: '#3a2a4a', pants: '#2a2a32', hat: '#5a3a7a', x: ['emblem'] },
  boss:      { skin: 1, hair: '#e8e8f0', hs: 1, shirt: '#2a1a3a', pants: '#2a2a32', x: ['cape', 'emblem'] },
  elder:     { skin: 1, hair: '#e8e8f0', hs: 4, shirt: '#7a5a3a', pants: '#4a4a5a', x: ['beard'] },
  granny:    { skin: 0, hair: '#e8e8f0', hs: 3, shirt: '#8a4ad8', pants: '#5a5a8a', x: ['apron'] },
  sailor:    { skin: 2, hair: '#2a1e16', hs: 0, shirt: '#f4f4f4', pants: '#3a4a7a', hat: '#f4f4f4' },
  worker:    { skin: 2, hair: '#5a3a22', hs: 0, shirt: '#f08a2a', pants: '#3a4a7a', hat: '#f2c42c' },
  guard:     { skin: 1, hair: '#2a1e16', hs: 0, shirt: '#3a4a7a', pants: '#2a2a32', hat: '#3a4a7a' },
  // vedoucí stadionů
  borek:     { skin: 2, hair: '#5a3a22', hs: 1, shirt: '#a8742a', pants: '#5a4a3a', x: ['beard', 'belt'] },
  hana:      { skin: 0, hair: '#4a7ad8', hs: 2, shirt: '#2ab0b0', pants: '#f4f4f4' },
  viktor:    { skin: 1, hair: '#f2c42c', hs: 1, shirt: '#3a3a48', pants: '#3a3a48', x: ['coat', 'glasses'] },
  libuse:    { skin: 0, hair: '#4aa86a', hs: 2, shirt: '#4aa84a', pants: '#e8c06a', x: ['crown'] },
  dorota:    { skin: 0, hair: '#e8e8f0', hs: 2, shirt: '#3a2a4a', pants: '#2a2a32', x: ['robe'] },
  radek:     { skin: 1, hair: '#e8e8f0', hs: 1, shirt: '#4a9ad8', pants: '#3a3a48', x: ['scarf'] },
  champion:  { skin: 1, hair: '#2a1e16', hs: 2, shirt: '#8a2a3a', pants: '#2a2a32', x: ['cape', 'crown'] },
};

export const DEFAULT_LOOK = { skin: 1, hair: HAIR_COLORS[1], hs: 0, shirt: SHIRT_COLORS[0], pants: PANTS_COLORS[0], hat: SHIRT_COLORS[0] };

export function lookOf(l) {
  if (!l) return DEFAULT_LOOK;
  if (typeof l === 'string') return LOOKS[l] || DEFAULT_LOOK;
  return l;
}

// Ověření vzhledu poslaného klientem.
export function sanitizeLook(l) {
  const out = { ...DEFAULT_LOOK };
  if (!l || typeof l !== 'object') return out;
  const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  if (Number.isInteger(l.skin) && l.skin >= 0 && l.skin < SKINS.length) out.skin = l.skin;
  if (isHex(l.hair)) out.hair = l.hair;
  if (Number.isInteger(l.hs) && l.hs >= 0 && l.hs <= 4) out.hs = l.hs;
  if (isHex(l.shirt)) out.shirt = l.shirt;
  if (isHex(l.pants)) out.pants = l.pants;
  out.hat = isHex(l.hat) ? l.hat : null;
  return out;
}
