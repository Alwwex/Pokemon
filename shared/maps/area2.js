// Oblast 2: Cesta 3, Šedá jeskyně, Jiskrov, Cesta 4 (Temný hvozd), Hájov
import { center, house } from './interiors.js';

const GRUNT = {
  intro: 'Tým Soumrak tě varuje! Nepleť se nám do cesty, trenére!',
  lose: 'Grr… Vůdce Vladan se to dozví!',
  after: 'Náš vůdce chystá v hradě ve Strašíně něco velkého. Uvidíš!',
};

const cesta3 = {
  id: 'cesta3',
  name: 'Cesta 3',
  theme: 'route',
  music: 'route',
  bg: 'grass',
  rows: [
    '######################',
    '######################',
    '##########d###########',
    'TT#.......::......#TTT',
    'TT.,,,,...::...,,,,.TT',
    'TT.,,,,...::...,,,,.TT',
    'TT.,,,,...::...,,,,.TT',
    'TT........::........TT',
    'TTTT~~~~~~==~~~~~~TTTT',
    'TTTT~~~~~~==~~~~~~TTTT',
    'TT.....ss.::.ss.....TT',
    'TT..,,,,..::..,,,,..TT',
    'TT..,,,,..::..,,,,..TT',
    'TT..,,,,..::..,,,,..TT',
    'TT........::........TT',
    'TT.ooo....::....tt..TT',
    'TT........::........TT',
    'TT^^^^^^..::..^^^^^^TT',
    'TT........::........TT',
    'TT,,,,,...::...,,,,,TT',
    'TT,,,,,...::...,,,,,TT',
    'TT........::........TT',
    'TT.**.....::.....**.TT',
    'TT........::........TT',
    'TT,,,.....::.....,,,TT',
    'TT,,,.....::.....,,,TT',
    'TT........::........TT',
    'TTTTTT....::....TTTTTT',
    'TTTTTTTTTT::TTTTTTTTTT',
    'TTTTTTTTTT::TTTTTTTTTT',
  ],
  edges: { down: { to: 'rybnikov', off: 4 } },
  buildings: [{ style: 'cave', x: 9, y: 1, w: 3, h: 2, door: 1, to: 'seda_jeskyne' }],
  signs: [{ x: 9, y: 26, text: 'Cesta 3   ↑ Šedá jeskyně a Jiskrov   ↓ Rybníkov' }],
  npcs: [
    {
      id: 'c3_t1', x: 3, y: 14, dir: 'right', look: 'fisher',
      trainer: { cls: 'Rybář', name: 'Lojza', sight: 8, reward: 300, team: [['kaprik', 11], ['racik', 12]],
        intro: 'Ryby nekoušou, tak si dám souboj!', lose: 'To byl úlovek… pro tebe.', after: 'V téhle řece žijí Ráčci. Hledej je pod kameny.' },
    },
    {
      id: 'c3_t2', x: 17, y: 21, dir: 'left', look: 'lass',
      trainer: { cls: 'Dívka', name: 'Bára', sight: 7, reward: 260, team: [['bobrik', 12], ['usanek', 12]],
        intro: 'Bobřík mi postavil hrázku! Chceš ji vidět? Nejdřív souboj!', lose: 'Bobříčku, nebreč…', after: 'Bobři jsou nejlepší stavitelé na světě.' },
    },
    {
      id: 'c3_t3', x: 13, y: 4, dir: 'down', look: 'hiker',
      trainer: { cls: 'Turista', name: 'Vilém', sight: 3, reward: 330, team: [['oblazek', 12], ['oblazek', 12], ['hrabacek', 13]],
        intro: 'Míříš do Šedé jeskyně? Nejdřív musíš projít mnou!', lose: 'Jsi připravený na jeskyni.', after: 'V jeskyni je tma a spousta Netopýrků. Vezmi si lektvary.' },
    },
    { id: 'c3_guide', x: 8, y: 7, dir: 'down', look: 'elder', say: ['Šedá jeskyně je jediná cesta do Jiskrova.', 'Prý v ní spí obr z hlíny – Hliňák. Probudí se jen před opravdovým trenérem.'] },
  ],
  items: [
    { id: 'c3_i1', x: 2, y: 10, item: 'super_orb', qty: 2 },
    { id: 'c3_i2', x: 19, y: 18, item: 'super_lektvar', qty: 1 },
    { id: 'c3_i3', x: 4, y: 26, item: 'odpuzovac', qty: 2 },
  ],
  enc: {
    rate: 0.1,
    list: [
      { s: 'pulec', min: 9, max: 12, w: 18 },
      { s: 'kaprik', min: 9, max: 12, w: 16 },
      { s: 'racik', min: 10, max: 12, w: 14 },
      { s: 'bobrik', min: 10, max: 12, w: 14 },
      { s: 'svitivka', min: 10, max: 12, w: 10 },
      { s: 'jeziskra', min: 10, max: 13, w: 10 },
      { s: 'sipak', min: 11, max: 13, w: 10 },
      { s: 'mlocik', min: 10, max: 12, w: 8 },
    ],
  },
};

const seda_jeskyne = {
  id: 'seda_jeskyne',
  name: 'Šedá jeskyně',
  theme: 'cave',
  music: 'cave',
  bg: 'cave',
  rows: [
    'CCCCCCCCCCCCCCCcCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCcccCCCCCCCCCCCCC',
    'CCQcccQCCCCCCcccccCCCCCCCCCCCC',
    'CCcccccCCCCCCcccccCCCcccccccCC',
    'CCcccccccccccccccccccccocccCCC',
    'CCCcccCCCCccccccccccccccccccCC',
    'CCCCcCCCCCccccCCCCCCcccccCCcCC',
    'CCCCcCCCCcccccCCCCCCccccccccCC',
    'CCCCccccccccCCCCCCCCcccCCCccCC',
    'CCCCCCCCcccCCCCCCCCCcccCCCccCC',
    'CCcccccccccCCCCCCCCCcccccccccC',
    'CCcCCCCCCccCCCCCCCCCccCCCCCccC',
    'CCcCQQCCCccccccccccccccCCCCccC',
    'CCcCccCCCcccccoccccccccCCCCccC',
    'CCcccccCCcccccccccccccccccccCC',
    'CCCCCCcCCCCCCCcccCCCCCCCCCCCCC',
    'CCCCCCcccccCCCcccCCCcccccccCCC',
    'CCCCCCCCCCcccccccccccCCCCcCCCC',
    'CCCcccccCCCCCCcccCCCCCCCCcCCCC',
    'CCCccQccccccccccccccccccccccCC',
    'CCCccccccoccccccccccccoccccQCC',
    'CCCccccccccccccccccccccccccCCC',
    'CCCCCcccoccccccccccccocccCCCCC',
    'CCCCCCCcccccccccccccccccCCCCCC',
    'CCCCCCCCCCCCCcccccCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCcCCCCCCCCCCCCCC',
  ],
  mat: { x: 15, y: 25 },
  warps: [{ x: 15, y: 0, dir: 'up', to: 'jiskrov', tx: 5, ty: 3, face: 'down' }],
  npcs: [
    { id: 'cave_t1', x: 9, y: 11, dir: 'down', look: 'grunt', trainer: { cls: 'Člen Soumraku', name: 'Tonda', sight: 3, reward: 420, team: [['netopyrek', 13], ['mlocik', 14]], ...GRUNT } },
    { id: 'cave_t2', x: 21, y: 11, dir: 'down', look: 'grunt', trainer: { cls: 'Členka Soumraku', name: 'Jitka', sight: 3, reward: 420, team: [['vlcik', 14], ['netopyrek', 13]], ...GRUNT } },
    {
      id: 'cave_t3', x: 12, y: 19, dir: 'right', look: 'hiker',
      trainer: { cls: 'Turista', name: 'Radim', sight: 4, reward: 380, team: [['hrabacek', 13], ['oblazek', 14]],
        intro: 'V jeskyni se nejlíp trénuje. Žádné slunce, jen kámen!', lose: 'Ach, moje kolena…', after: 'Výš v jeskyni se třpytí krystaly. Hezký pohled!' },
    },
  ],
  items: [
    { id: 'cave_i1', x: 3, y: 18, item: 'super_lektvar', qty: 1 },
    { id: 'cave_i2', x: 27, y: 10, item: 'odpuzovac', qty: 2 },
    { id: 'cave_i3', x: 2, y: 14, item: 'super_orb', qty: 2 },
    { id: 'cave_i4', x: 24, y: 16, item: 'td19', qty: 1 },
  ],
  legends: [
    { id: 'leg_hlinak', x: 4, y: 3, s: 'hlinak', lvl: 30, cond: { badges: 3 }, cry: 'Hliněný obr otevřel oči. Na čele mu zazářil tajemný znak!' },
  ],
  enc: {
    rate: 0.08,
    everywhere: true,
    list: [
      { s: 'oblazek', min: 10, max: 14, w: 28 },
      { s: 'hrabacek', min: 10, max: 14, w: 22 },
      { s: 'netopyrek', min: 10, max: 14, w: 28 },
      { s: 'plisek', min: 11, max: 14, w: 12 },
      { s: 'stinek', min: 11, max: 13, w: 6 },
      { s: 'krystalek', min: 13, max: 15, w: 4 },
    ],
  },
};

const jiskrov = {
  id: 'jiskrov',
  name: 'Jiskrov',
  theme: 'town',
  music: 'town2',
  bg: 'town',
  rows: [
    '############TTTTTTTTTTTTTTTTTT',
    '############TT..............TT',
    '#####d######................TT',
    'TT...:......................TT',
    'TT...:......................TT',
    'TT...:......................TT',
    'TT...:......................TT',
    'TT...:::::::::::::::::::::::::',
    'TT...:::::::::::::::::::::::::',
    'TT..........::..............TT',
    'TT..........::..............TT',
    'TT..........::..............TT',
    'TT..........::..............TT',
    'TT..........::..............TT',
    'TT...::::::::::::::::::::...TT',
    'TT..........::..............TT',
    'TT..........::..............TT',
    'TT..........::..............TT',
    'TT..........::..............TT',
    'TT.l........::........l.....TT',
    'TT..........................TT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  edges: {
    right: { to: 'cesta4', off: 1, need: { badges: 3, msg: 'Strážný: Temný hvozd je nebezpečný. Pustím tě tam až s Odznakem Jiskra od Viktora!' } },
  },
  buildings: [
    { style: 'cave', x: 4, y: 1, w: 3, h: 2, door: 1, open: true },
    { style: 'gym', x: 15, y: 1, w: 8, h: 5, door: 4, roof: '#e8b830', to: 'jiskrov_stadion', badge: 3 },
    { style: 'house', x: 23, y: 2, w: 5, h: 4, door: 2, roof: '#f2c42c', to: 'jiskrov_elektrarna' },
    { style: 'center', x: 4, y: 9, w: 6, h: 4, door: 3, to: 'jiskrov_centrum' },
    { style: 'house', x: 16, y: 9, w: 5, h: 4, door: 2, roof: '#4a4a5a', to: 'jiskrov_dum' },
    { style: 'house', x: 22, y: 15, w: 5, h: 4, door: 2, roof: '#e86a3a', to: 'jiskrov_dum2' },
  ],
  warps: [{ x: 5, y: 2, to: 'seda_jeskyne', tx: 15, ty: 1, face: 'down' }],
  signs: [
    { x: 14, y: 6, text: 'Stadion Jiskrov – vedoucí: Viktor. „Napětí, které se nedá vydržet!“' },
    { x: 11, y: 9, text: 'Jiskrov – město, které nikdy nespí. Elektrárna na kopci napájí celou Velhoru.' },
  ],
  npcs: [
    { id: 'jis_worker', x: 24, y: 7, dir: 'down', look: 'worker', say: ['Elektrárna jede na plný výkon!', 'Ježiskry se kolem ní rády zdržují – nabíjejí si bodliny.'] },
    { id: 'jis_sci', x: 9, y: 16, dir: 'right', look: 'scientist', say: ['Viktor ve stadionu je vynálezce. Jeho tvorové jsou rychlí jako blesk.', 'Zemní tvorové se ale elektřiny vůbec nebojí!'] },
    { id: 'jis_kid', x: 20, y: 20, dir: 'left', look: 'kid', turn: true, say: ['Až budu velký, postavím robota z Plíšků!'] },
    { id: 'jis_guard', x: 27, y: 6, dir: 'down', look: 'guard', cond: { nbadges: 3 }, say: ['Na východ do Temného hvozdu pouštím jen trenéry s Odznakem Jiskra.'] },
    {
      id: 'jis_rival', x: 10, y: 6, dir: 'down', look: 'rival', name: 'Ondra', cond: { nflag: 'rival3' },
      trainer: { rival: 3, cls: 'Rival', name: 'Ondra', sight: 2, flagOnWin: 'rival3',
        intro: '{name}! Prošel jsi Šedou jeskyní? Já taky – a chytil jsem spoustu nových tvorů! Tentokrát vyhraju já!',
        lose: 'Zase jsi mě porazil… Jak to děláš?! Fajn, uvidíme se v horách.',
        after: 'Až budeš mít všech šest odznaků, potkáme se na cestě ke Koruně!' },
    },
  ],
  items: [{ id: 'jis_i1', x: 26, y: 20, item: 'super_lektvar', qty: 1 }],
};

const jiskrov_centrum = center('jiskrov_centrum', 'Jiskrov', [
  { id: 'jis_c_hint', x: 2, y: 6, dir: 'right', look: 'elder', script: 'hint', name: 'Starý cestovatel' },
]);
jiskrov_centrum.shop = ['td07', 'td08', 'td09', 'td10', 'td20'];

const jiskrov_dum = house('jiskrov_dum', 'Jiskrov – dům', [
  { id: 'jis_d_m', x: 6, y: 4, dir: 'down', look: 'scientist', name: 'Inženýr', give: { item: 'super_orb', qty: 3 },
    say: ['Pracuju na lepších orbech. Tyhle se mi povedly – vyzkoušej je!'], after: ['Super orby mají vyšší šanci na chycení než obyčejné.'] },
]);

const jiskrov_dum2 = house('jiskrov_dum2', 'Jiskrov – dům', [
  { id: 'jis_d2_w', x: 4, y: 4, dir: 'left', look: 'granny', say: ['Víš, že někteří tvorové se vyvíjejí, když je vyměníš s jiným hráčem?', 'Balvaník, Strašidlík a Mystik prý takhle zesílí. Nebo musíš počkat až na úroveň 40.'] },
  { id: 'jis_d2_k', x: 8, y: 5, dir: 'up', look: 'girl', say: ['Ve hvozdu za městem bydlí Skřítci. Ukazují houbařům cestu k hříbkům!'] },
]);

const jiskrov_elektrarna = house('jiskrov_elektrarna', 'Elektrárna Jiskrov', [
  { id: 'jis_el_sci', x: 5, y: 3, dir: 'down', look: 'scientist', name: 'Správce elektrárny', give: { item: 'bonbon', qty: 1 },
    say: ['Vítej v elektrárně! Pozor na kabely.', 'Tady máš Bonbon zkušeností. Tvor, který ho sní, hned povyroste o úroveň!'], after: ['Generátory pohání tisíce Ježisker. Dělají to rády, dostávají za to jablka.'] },
  { id: 'jis_el_w', x: 2, y: 5, dir: 'right', look: 'worker', say: ['Bzzzt! Promiň, to jsem nebyl já, to byl generátor.'] },
], { rows: ['wwwwwwwwwww', 'whhhwwwhhhw', '___________', '_p_______p_', '___________', '___________', 'y_________y', '_____m_____'] });

const jiskrov_stadion = {
  id: 'jiskrov_stadion',
  name: 'Stadion Jiskrov',
  theme: 'gym',
  music: 'gym',
  bg: 'gym',
  gymColor: '#e8d890',
  rows: [
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    'ggggggggggggg',
    'gGGGGGgGGGGGg',
    'ggggggggggggg',
    'GGGgGGGGGgGGG',
    'ggggggggggggg',
    'gGGGGGgGGGGGg',
    'ggggggggggggg',
    'GGgGGGGGGGgGG',
    'ggggggggggggg',
    'ggggggggggggg',
    'gygggggggggyg',
    'ggggggmgggggg',
  ],
  mat: { x: 6, y: 13 },
  npcs: [
    { id: 'g3_guide', x: 3, y: 12, dir: 'right', look: 'guard', say: ['Viktor používá elektrické tvory.', 'Zemní tvorové jsou proti elektřině imunní – to je tvá šance!'] },
    { id: 'g3_t1', x: 1, y: 8, dir: 'right', look: 'scientist', trainer: { cls: 'Vědec', name: 'Pavel', sight: 5, reward: 600, team: [['svetluska', 22], ['jeziskra', 22]], intro: 'Moje měření ukazují, že prohraješ!', lose: 'Chyba v měření!', after: 'Musím přepočítat své vzorce.' } },
    { id: 'g3_t2', x: 11, y: 6, dir: 'left', look: 'scientist', trainer: { cls: 'Vědkyně', name: 'Ivana', sight: 5, reward: 620, team: [['svitivka', 22], ['svetluska', 23]], intro: 'Elektřina je budoucnost!', lose: 'Zkrat!', after: 'Viktor je génius. Ale ty jsi taky dobrý.' } },
    { id: 'g3_t3', x: 6, y: 4, dir: 'down', look: 'worker', trainer: { cls: 'Elektrikář', name: 'Franta', sight: 1, reward: 640, team: [['jeziskra', 23], ['svitivka', 23]], intro: 'Jsi pod napětím? Já jo!', lose: 'Vyhodilo mi to pojistky.', after: 'Viktor čeká nahoře.' } },
    {
      id: 'g3_leader', x: 6, y: 2, dir: 'down', look: 'viktor', name: 'Viktor',
      trainer: { cls: 'Vedoucí stadionu', name: 'Viktor', sight: 0, reward: 2700, ai: 'smart', items: { super_lektvar: 2 }, badge: 3, tm: 'td03',
        team: [['svetluska', 24], ['jeziskra', 24], ['svitivka', 25], ['hromeduza', 27]],
        intro: 'Vítej! Jsem Viktor, vynálezce a vedoucí tohoto stadionu. Moji tvorové mají víc voltů než celá elektrárna. Připrav se na šok!',
        lose: 'Fascinující! Tvoje strategie mi vyhodila všechny pojistky. Zasloužíš si Odznak Jiskra!',
        after: 'Na východ vede Temný hvozd do Hájova. Hlídej si cestu, lidé se tam ztrácejí.' },
    },
  ],
};

const cesta4 = {
  id: 'cesta4',
  name: 'Temný hvozd',
  theme: 'forest',
  music: 'forest',
  bg: 'forest',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTT,,,,,TTTTTTTTT,,,,,,TTTTTTTTT,,,,,TTTTTT',
    'TTT,,,,,,,TTTTTTT,,,,,,,,TTTTTTT,,,,,,,TTTTT',
    'TTT,,,..,,TTTTTTT,,....,,TTTTTTT,,...,,TTTTT',
    'TTT,,....,TTTTTTT.........TTTTT.........TTTT',
    'TTTT.....TTTTTTTT..TTTTT..TTTTT..TTTTT..TTTT',
    'TTTT..TTTTTTTTTTT..TTTTT..TTTTT..TTTTT..TTTT',
    ':::::.TTTTTTTTTTT.....,,,..TTTT..TTTTT..TTTT',
    ':::::..............,,,,,,..TTTT.......::::::',
    'TTTTT..............,,,,,,..TTTT.......::::::',
    'TTTTTTTTTTT..TTTT..TTTTTT..TTTT..TTTTTTTTTTT',
    'TTTTTTTTTTT.....,,,,TTTT..TTTT..TTTTTTTTTTTT',
    'TTTTTTTTTTT.....,,,,TTTT........,,,,,,,TTTTT',
    'TTTTTT,,,,,.....,,,,TTTTTTTTTT..,,,,,,,TTTTT',
    'TTTTTT,,,,,TTTTTTTTTTTTTTTTTTT..,,,,,,,TTTTT',
    'TTTTTT,,,,,TTTTTTTTTTTTTTTTTTT.........TTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  edges: {
    left: { to: 'jiskrov', off: -1 },
    right: { to: 'hajov', off: 2 },
  },
  signs: [{ x: 6, y: 10, text: 'Temný hvozd – drž se cesty, ať nezabloudíš!' }],
  npcs: [
    { id: 'c4_t1', x: 8, y: 5, dir: 'down', look: 'bugcatcher', trainer: { cls: 'Lovec hmyzu', name: 'Ota', sight: 4, reward: 520, team: [['kuklik', 17], ['duhovnik', 19]], intro: 'Ve hvozdu je nejvíc hmyzu v celé Velhoře!', lose: 'Uletěli mi…', after: 'Duhovníci jsou nejkrásnější za soumraku.' } },
    { id: 'c4_t2', x: 18, y: 10, dir: 'right', look: 'grunt', trainer: { cls: 'Člen Soumraku', name: 'Lukáš', sight: 4, reward: 560, team: [['netopyrek', 18], ['mlocik', 19]], ...GRUNT } },
    { id: 'c4_t3', x: 33, y: 5, dir: 'down', look: 'gardener', trainer: { cls: 'Zahradnice', name: 'Věra', sight: 3, reward: 540, team: [['houbik', 19], ['skritek', 19], ['veveruska', 20]], intro: 'Pst! Hvozd má rád ticho. Ale souboj snese.', lose: 'Hvozd tě přijal.', after: 'Skřítci tě dovedou do Hájova, když budeš hodný.' } },
    { id: 'c4_t4', x: 32, y: 13, dir: 'left', look: 'grunt', trainer: { cls: 'Členka Soumraku', name: 'Šárka', sight: 4, reward: 580, team: [['vlcik', 20], ['houbik', 20]], ...GRUNT } },
  ],
  items: [
    { id: 'c4_i1', x: 6, y: 4, item: 'super_lektvar', qty: 1 },
    { id: 'c4_i2', x: 38, y: 7, item: 'td14', qty: 1 },
    { id: 'c4_i3', x: 7, y: 16, item: 'ultra_orb', qty: 1 },
    { id: 'c4_i4', x: 35, y: 16, item: 'eter', qty: 1 },
  ],
  enc: {
    rate: 0.1,
    list: [
      { s: 'kuklik', min: 16, max: 18, w: 8 },
      { s: 'duhovnik', min: 18, max: 20, w: 6 },
      { s: 'houbik', min: 16, max: 20, w: 18 },
      { s: 'skritek', min: 16, max: 20, w: 15 },
      { s: 'veveruska', min: 16, max: 19, w: 14 },
      { s: 'vlcik', min: 17, max: 20, w: 14 },
      { s: 'svetluska', min: 17, max: 20, w: 10 },
      { s: 'vcelka', min: 16, max: 19, w: 12 },
      { s: 'stinek', min: 17, max: 19, w: 3 },
    ],
  },
};

const hajov = {
  id: 'hajov',
  name: 'Hájov',
  theme: 'forest',
  music: 'town',
  bg: 'forest',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT....:::::::::::::::::...TT',
    'TT...........::...........TT',
    'TT...........::...........TT',
    '::::::::::::::::..........TT',
    '::::::::::::::::..........TT',
    'TT...........::...........TT',
    'TT..TTT......::...........TT',
    'TT.TTTTT.....::...........TT',
    'TT..TTT......::...........TT',
    'TT...*.......::..........*TT',
    'TT..*.*......::...........TT',
    'TT...........::...........TT',
    'TT...........::...........TT',
    'TTTTTTTTTTTTT::TTTTTTTTTTTTT',
    'TTTTTTTTTTTTT::TTTTTTTTTTTTT',
  ],
  edges: {
    left: { to: 'cesta4', off: -2 },
    down: { to: 'cesta5', off: 0, need: { badges: 4, msg: 'Strážný: Na jihu jsou Blata. Bez Odznaku Lísteček od Libuše tě tam nepustím.' } },
  },
  buildings: [
    { style: 'center', x: 3, y: 2, w: 6, h: 4, door: 3, to: 'hajov_centrum' },
    { style: 'gym', x: 10, y: 2, w: 8, h: 5, door: 4, roof: '#4aa84a', to: 'hajov_stadion', badge: 4 },
    { style: 'house', x: 20, y: 2, w: 5, h: 4, door: 2, roof: '#8a5a3a', to: 'hajov_dum' },
    { style: 'house', x: 18, y: 14, w: 5, h: 4, door: 2, roof: '#a85a8a', to: 'hajov_dum2' },
  ],
  signs: [
    { x: 9, y: 7, text: 'Stadion Hájov – vedoucí: Libuše. „Kořeny pevné jako hora.“' },
    { x: 16, y: 10, text: 'Hájov – vesnice uprostřed Temného hvozdu.' },
  ],
  npcs: [
    { id: 'haj_gard', x: 6, y: 17, dir: 'up', look: 'gardener', say: ['Libuše ze stadionu se o hvozd stará jako o vlastní zahradu.', 'Oheň a hmyz jsou ale na její rostlinky pěkně zlí!'] },
    { id: 'haj_elder', x: 23, y: 10, dir: 'left', look: 'elder', say: ['Na jih vedou Blata, kde v noci svítí bludičky.', 'A za nimi Strašín se starým hradem… Říká se, že v něm kvílí duch větru.'] },
    { id: 'haj_girl', x: 16, y: 19, dir: 'up', look: 'girl', turn: true, say: ['Dneska jsem viděla Veverušku, jak zakopává oříšek! Roztomilé!'] },
    { id: 'haj_guard', x: 11, y: 20, dir: 'right', look: 'guard', cond: { nbadges: 4 }, say: ['Do Blat smí jen trenéři se čtyřmi odznaky.'] },
  ],
  items: [{ id: 'haj_i1', x: 25, y: 19, item: 'super_lektvar', qty: 2 }],
};

const hajov_centrum = center('hajov_centrum', 'Hájov', [
  { id: 'haj_c_hint', x: 10, y: 6, dir: 'left', look: 'elder', script: 'hint', name: 'Starý cestovatel' },
]);
hajov_centrum.shop = ['rychly_orb', 'td21'];

const hajov_dum = house('hajov_dum', 'Hájov – hájovna', [
  { id: 'haj_d_m', x: 6, y: 4, dir: 'down', look: 'hiker', name: 'Hajný', give: { item: 'uplne_vyleceni', qty: 2 },
    say: ['Hvozd je plný jedovatých hub. Kdyby tě něco otrávilo, tohle pomůže.'], after: ['Hlavně nejez nic, co svítí!'] },
]);

const hajov_dum2 = house('hajov_dum2', 'Hájov – dům', [
  { id: 'haj_d2_w', x: 3, y: 5, dir: 'right', look: 'granny', say: ['Můj vnuk se přidal k Týmu Soumrak. Prý chtějí ovládnout vítr…', 'Kdyby ho někdo přivedl k rozumu!'] },
]);

const hajov_stadion = {
  id: 'hajov_stadion',
  name: 'Stadion Hájov',
  theme: 'gym',
  music: 'gym',
  bg: 'forest',
  gymColor: '#a8d890',
  rows: [
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    'ggggggggggggg',
    'gyyyyygyyyyyg',
    'ggggggggggggg',
    'yyygggggggyyy',
    'ggggyyyyygggg',
    'ggggggggggggg',
    'gyyyyggyyyyyg',
    'ggggggggggggg',
    'yygggyyygggyy',
    'ggggggggggggg',
    'ggggggggggggg',
    'ggggggmgggggg',
  ],
  mat: { x: 6, y: 13 },
  npcs: [
    { id: 'g4_guide', x: 3, y: 12, dir: 'right', look: 'guard', say: ['Libuše miluje rostlinné tvory.', 'Oheň, vzduch, led a hmyz jsou proti nim účinné!'] },
    { id: 'g4_t1', x: 2, y: 11, dir: 'right', look: 'gardener', trainer: { cls: 'Zahradnice', name: 'Marie', sight: 5, reward: 780, team: [['houbik', 27], ['veveruska', 27]], intro: 'Moje kytičky kousají!', lose: 'Uvadám…', after: 'Libuše má nejzelenější ruce v kraji.' } },
    { id: 'g4_t2', x: 10, y: 9, dir: 'left', look: 'gardener', trainer: { cls: 'Zahradník', name: 'Josef', sight: 5, reward: 800, team: [['skritek', 27], ['muchomor', 28]], intro: 'Pleveli se nevzdávám!', lose: 'Tak tohle jsem nezasel.', after: 'Hnojivo je základ.' } },
    { id: 'g4_t3', x: 6, y: 7, dir: 'down', look: 'bugcatcher', trainer: { cls: 'Lovec hmyzu', name: 'Kamil', sight: 1, reward: 760, team: [['vcelka', 27], ['duhovnik', 28]], intro: 'Hmyz a květiny patří k sobě!', lose: 'Bzz… konec.', after: 'Libuše je za mnou.' } },
    {
      id: 'g4_leader', x: 6, y: 2, dir: 'down', look: 'libuse', name: 'Libuše',
      trainer: { cls: 'Vedoucí stadionu', name: 'Libuše', sight: 0, reward: 3300, ai: 'smart', items: { super_lektvar: 2 }, badge: 4, tm: 'td04',
        team: [['houbik', 29], ['skritek', 29], ['veverak', 30], ['muchomor', 31], ['hajnik', 33]],
        intro: 'Vítej v mé zahradě. Jsem Libuše. Hvozd mi šeptá, že jsi silný… Ale kořeny mých tvorů sahají hluboko!',
        lose: 'Hvozd se ti uklonil. Tady máš Odznak Lísteček.',
        after: 'Na jihu leží Blata a za nimi Strašín. Tým Soumrak tam prý něco chystá. Buď opatrný.' },
    },
  ],
};

export default [
  cesta3, seda_jeskyne, jiskrov, jiskrov_centrum, jiskrov_dum, jiskrov_dum2, jiskrov_elektrarna, jiskrov_stadion,
  cesta4, hajov, hajov_centrum, hajov_dum, hajov_dum2, hajov_stadion,
];
