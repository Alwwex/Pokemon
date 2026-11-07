import { TMS, MOVES } from './moves.js';

// cat: heal (léčení), orb (chytání), tm (technické disky), misc, key (klíčové)
export const ITEMS = {
  lektvar:        { n: 'Lektvar', cat: 'heal', price: 200, heal: 20, d: 'Obnoví tvorovi 20 HP.' },
  super_lektvar:  { n: 'Super lektvar', cat: 'heal', price: 600, heal: 60, d: 'Obnoví tvorovi 60 HP.' },
  hyper_lektvar:  { n: 'Hyper lektvar', cat: 'heal', price: 1200, heal: 120, d: 'Obnoví tvorovi 120 HP.' },
  max_lektvar:    { n: 'Max lektvar', cat: 'heal', price: 2500, heal: 99999, d: 'Plně obnoví tvorovi HP.' },
  ozivovac:       { n: 'Oživovač', cat: 'heal', price: 1500, revive: 0.5, d: 'Oživí omdlelého tvora s polovinou HP.' },
  max_ozivovac:   { n: 'Max oživovač', cat: 'heal', price: 4000, revive: 1, d: 'Oživí omdlelého tvora s plným HP.' },
  protijed:       { n: 'Protijed', cat: 'heal', price: 100, cure: ['psn', 'tox'], d: 'Vyléčí otravu.' },
  mast:           { n: 'Mast na popáleniny', cat: 'heal', price: 250, cure: ['brn'], d: 'Vyléčí popáleniny.' },
  rozmrazovac:    { n: 'Rozmrazovač', cat: 'heal', price: 250, cure: ['frz'], d: 'Rozmrazí zmrzlého tvora.' },
  budicek:        { n: 'Budíček', cat: 'heal', price: 250, cure: ['slp'], d: 'Probudí spícího tvora.' },
  uvolnovac:      { n: 'Uvolňovač', cat: 'heal', price: 200, cure: ['par'], d: 'Vyléčí ochromení.' },
  uplne_vyleceni: { n: 'Úplné vyléčení', cat: 'heal', price: 600, cure: ['all'], d: 'Vyléčí jakýkoli stav.' },
  eter:           { n: 'Éter', cat: 'heal', price: 1200, pp: 10, d: 'Obnoví 10 PP všem útokům tvora.' },
  max_eter:       { n: 'Max éter', cat: 'heal', price: 3000, pp: 999, d: 'Plně obnoví PP všem útokům tvora.' },
  bonbon:         { n: 'Bonbon zkušeností', cat: 'heal', price: 4800, rare: true, noBattle: true, d: 'Zvýší tvorovi úroveň o 1.' },

  orb:            { n: 'Orb', cat: 'orb', price: 200, ball: 1, d: 'Základní orb na chytání divokých tvorů.' },
  super_orb:      { n: 'Super orb', cat: 'orb', price: 600, ball: 1.5, d: 'Lepší orb s vyšší šancí na chycení.' },
  ultra_orb:      { n: 'Ultra orb', cat: 'orb', price: 1200, ball: 2, d: 'Výborný orb s vysokou šancí na chycení.' },
  rychly_orb:     { n: 'Rychlý orb', cat: 'orb', price: 1000, ball: 1, quick: true, d: 'Velmi účinný, když je hozen v prvním kole.' },
  soumrakovy_orb: { n: 'Soumrakový orb', cat: 'orb', price: 1000, ball: 1, dusk: true, d: 'Velmi účinný v jeskyních a v noci.' },
  sitovy_orb:     { n: 'Síťový orb', cat: 'orb', price: 1000, ball: 1, net: true, d: 'Velmi účinný na vodní a hmyzí tvory.' },
  prizmaticky_orb:{ n: 'Prizmatický orb', cat: 'orb', price: 0, ball: 255, master: true, d: 'Legendární orb, který chytí každého tvora.' },

  odpuzovac:      { n: 'Odpuzovač', cat: 'misc', price: 350, repel: 100, noBattle: true, d: 'Na 100 kroků odežene slabé divoké tvory.' },
  super_odpuzovac:{ n: 'Super odpuzovač', cat: 'misc', price: 600, repel: 250, noBattle: true, d: 'Na 250 kroků odežene slabé divoké tvory.' },

  atlas:          { n: 'Atlas tvorů', cat: 'key', price: 0, d: 'Zaznamenává všechny tvory, které jsi viděl a chytil.' },
};

for (const [id, move] of Object.entries(TMS)) {
  const m = MOVES[move];
  ITEMS[id] = {
    n: `${id.toUpperCase().replace('TD', 'TD ')} ${m.n}`,
    cat: 'tm',
    price: 3000,
    move,
    d: `Technický disk. Naučí tvora útok ${m.n}. Lze použít opakovaně.`,
  };
}

export const BAG_TABS = [
  { id: 'heal', n: 'Léčení' },
  { id: 'orb', n: 'Orby' },
  { id: 'tm', n: 'Disky' },
  { id: 'misc', n: 'Ostatní' },
  { id: 'key', n: 'Klíčové' },
];

export function itemName(id) {
  return ITEMS[id] ? ITEMS[id].n : id;
}
