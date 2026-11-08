// Oblast 4: Pobřeží – Cesta 8 z Rybníkova na jih k přístavnímu městu Solnice s majákem.
import { center, house } from './interiors.js';

const cesta8 = {
  id: 'cesta8',
  name: 'Cesta 8 – Pobřeží',
  theme: 'route',
  music: 'route',
  bg: 'water',
  rows: [
    'TTTT::TTTTTTTTTTTTTTTTT~~~',
    'TTTT::TTTTTTTTTTTTTTTss~~~',
    'TT..::.......,,,,,..sss~~~',
    'TT..::.......,,,,,..sss~~~',
    'TT..::..t....,,,,,...ss~~~',
    'TT..::...........o...ss~~~',
    'TT..:::::::........sss~~~~',
    'TT..,,,,..::.......sss~~~~',
    'TT..,,,,..::....*...ss~~~~',
    'TT..,,,,..::.......sss~~~~',
    'TT........::......ssss~~~~',
    'TT^^^^^^..::^^^^^^ssss~~~~',
    'TT........::......sss~~~~~',
    'TT.ooo....::......sss~~~~~',
    'TT........::...,,,,ss~~~~~',
    'TT..***...::...,,,,ss~~~~~',
    'TT........::...,,,,ss~~~~~',
    'TTTT......::.......sss~~~~',
    'TTTT......::.......sss~~~~',
    'TT........::......ssss~~~~',
    'TT..,,,,..::::::::sss=====',
    'TT..,,,,..::......sss~~~~~',
    'TT..,,,,..::......sss~~~~~',
    'TT........::.......ss~~~~~',
    'TT..t.....::........ss~~~~',
    'TT........::..,,,,..ss~~~~',
    'TT.ooo....::..,,,,..ss~~~~',
    'TT........::..,,,,..sss~~~',
    'TT^^^^^^^^::^^^^^^^^sss~~~',
    'TT........::.........ss~~~',
    'TT..,,,,,.::.........ss~~~',
    'TT..,,,,,.::....*....ss~~~',
    'TT..,,,,,.::.........ss~~~',
    'TT........::..t.....sss~~~',
    'TTTT......::........sss~~~',
    'TTTT......::.......ssss~~~',
    'TTTTTT....::......sssss~~~',
    'TTTTTTTTTT::TTTTTTsssss~~~',
    'TTTTTTTTTT::TTTTTTTsss~~~~',
    'TTTTTTTTTT::TTTTTTTTTT~~~~',
  ],
  edges: {
    up: { to: 'rybnikov', off: 20 },
    down: { to: 'solnice', off: 0 },
  },
  signs: [
    { x: 3, y: 3, text: 'Cesta 8 – Pobřeží   ↑ Rybníkov   ↓ Solnice' },
    { x: 17, y: 19, text: 'Molo Racek. Pozor, prkna kloužou!' },
  ],
  npcs: [
    {
      id: 'c8_t1', x: 8, y: 10, dir: 'right', look: 'swimmer',
      trainer: { cls: 'Plavec', name: 'Jakub', sight: 4, reward: 520, team: [['cvachtik', 18], ['svitivka', 18]],
        intro: 'Moře je dnes teplé jak kafe! Dáme souboj, než skočím do vln?', lose: 'Šplouch… to byla vlna!', after: 'Solnice je hned na jihu. Mají tam maják!' },
    },
    {
      id: 'c8_t2', x: 13, y: 16, dir: 'up', look: 'lass',
      trainer: { cls: 'Ptáčnice', name: 'Vilma', sight: 4, reward: 500, team: [['pipak', 18], ['sipak', 20]],
        intro: 'Moji ptáci létají nad mořem každé ráno. Chytíš je?', lose: 'Odletěla mi výhra…', after: 'Šípák umí letět proti větru.' },
    },
    {
      id: 'c8_t3', x: 24, y: 20, dir: 'left', look: 'sailor',
      trainer: { cls: 'Námořník', name: 'Bohouš', sight: 3, reward: 640, team: [['racik', 19], ['bobrik', 20]],
        intro: 'Ahoj, suchozemče! Na mém molu platí moje pravidla!', lose: 'Ztroskotal jsem…', after: 'Za mořem prý leží ostrov, kam nikdo nedoplul.' },
    },
    {
      id: 'c8_t4', x: 6, y: 29, dir: 'down', look: 'fisher',
      trainer: { cls: 'Rybářka', name: 'Eliška', sight: 4, reward: 560, team: [['kaprik', 18], ['pulec', 19], ['racik', 19]],
        intro: 'Psst! Plašíš mi ryby! Za to mi dlužíš souboj.', lose: 'Tohle se mi ještě nestalo…', after: 'Ráno nejlíp berou Kapříci.' },
    },
    { id: 'c8_kid', x: 19, y: 26, dir: 'left', look: 'kid', turn: true, say: ['Stavím hrad z písku!', 'Ráček mi ho pořád bourá klepety…'] },
  ],
  items: [
    { id: 'c8_i1', x: 21, y: 2, item: 'super_lektvar', qty: 1 },
    { id: 'c8_i2', x: 2, y: 14, item: 'super_orb', qty: 2 },
    { id: 'c8_i3', x: 22, y: 37, item: 'eter', qty: 1 },
    { id: 'c8_i4', x: 7, y: 35, item: 'cepice_slamak', qty: 1 },
  ],
  enc: {
    rate: 0.1,
    list: [
      { s: 'racik', min: 15, max: 18, w: 20 },
      { s: 'pipak', min: 15, max: 18, w: 16 },
      { s: 'cvachtik', min: 15, max: 17, w: 8 },
      { s: 'pulec', min: 15, max: 18, w: 14 },
      { s: 'kvakal', min: 17, max: 19, w: 8 },
      { s: 'bobrik', min: 15, max: 18, w: 14 },
      { s: 'svitivka', min: 16, max: 18, w: 12 },
      { s: 'sipak', min: 18, max: 19, w: 5 },
      { s: 'hastrmanek', min: 16, max: 18, w: 3 },
    ],
  },
};

const solnice = {
  id: 'solnice',
  name: 'Solnice',
  theme: 'town',
  music: 'town2',
  bg: 'water',
  rows: [
    'TTTTTTTTTT::TTTTTTTTTTTTTTTTTT',
    'TT........::..............ss~~',
    'TT........::..............ss~~',
    'TT........::..............ss~~',
    'TT........::..............ss~~',
    'TT........::..............ss~~',
    'TT..:::::::::::::::::::...ss~~',
    'TT..........::.........:..sss~',
    'TT..........::.........:..sss~',
    'TT.*........::.........:..sss~',
    'TT..........::.........:..sss~',
    'TT..........::.........:..sss~',
    'TT..::::::::::::::::::::..sss~',
    'TT..........::............sss~',
    'TT..........::.....*......ss~~',
    'TT..........::............ss~~',
    'TTss........::............ss~~',
    'Tssss.......::..........sss~~~',
    'sssssss.....::.........ssss~~~',
    'ssssssssss..::.......sssss~~~~',
    '~~ssssssssss::ssssssssss~~~~~~',
    '~~~~sssssss=====ssssss~~~~~~~~',
    '~~~~~~~~~~~=~~~~=~~~~~~~~~~~~~',
    '~~~~~~~~~~~=~~~~=~~~~~~~~~~~~~',
    '~~~~~~~~~~~=~~~~=~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  edges: {
    up: { to: 'cesta8', off: 0 },
  },
  buildings: [
    { style: 'center', x: 2, y: 1, w: 6, h: 4, door: 3, to: 'solnice_centrum' },
    { style: 'house', x: 14, y: 1, w: 5, h: 4, door: 2, roof: '#3a8ad8', to: 'solnice_dum' },
    { style: 'house', x: 3, y: 8, w: 5, h: 4, door: 2, roof: '#e86a4a', to: 'solnice_kloboucnictvi' },
    { style: 'tower', x: 24, y: 7, w: 4, h: 6, door: 2, roof: '#e83a3a', to: 'solnice_majak' },
  ],
  signs: [
    { x: 9, y: 5, text: 'Solnice – přístav, kde voní sůl a ryby.' },
    { x: 8, y: 13, text: 'Kloboučnictví U Veselé Mašle – čepice pro každého tvora!' },
    { x: 22, y: 13, text: 'Maják Solnice. Svítí námořníkům už sto let.' },
  ],
  npcs: [
    { id: 'sol_sailor', x: 15, y: 15, dir: 'down', look: 'sailor', turn: true, say: ['Ahoj! Jsem z lodi Velhorka.', 'Až opravíme stěžeň, poplujeme na daleké ostrovy.'] },
    { id: 'sol_granny', x: 18, y: 9, dir: 'left', look: 'granny', say: ['Můj nebožtík muž byl strážcem majáku.', 'Říkával, že v bouřce viděl na vlnách tančit Meluzínu…'] },
    { id: 'sol_swim', x: 7, y: 18, dir: 'right', look: 'swimmer', turn: true, say: ['Na molu se dobře chytají vodní tvorové.', 'A u majáku prý žije Hastrmánek!'] },
    {
      id: 'sol_t1', x: 11, y: 24, dir: 'up', look: 'sailor',
      trainer: { cls: 'Kapitán', name: 'Vlnovec', sight: 3, reward: 1100, team: [['klepetor', 23], ['hromeduza', 23]],
        intro: 'Hoj! Kdo se odváží až na konec mola, musí se se mnou utkat!', lose: 'Hrome a blesky! Jsi lepší námořník než já.', after: 'Moře tě naučí trpělivosti. A souboje taky.' },
    },
    {
      id: 'sol_t2', x: 16, y: 24, dir: 'up', look: 'fisher',
      trainer: { cls: 'Rybář', name: 'Pepa', sight: 3, reward: 900, team: [['kapral', 22], ['zabomag', 21]],
        intro: 'Na tomhle molu jsem chytil Kapráka velkého jako vrata!', lose: 'A je pryč… jako ten Kaprák.', after: 'Rybaření je hlavně o čekání.' },
    },
  ],
  items: [
    { id: 'sol_i1', x: 2, y: 19, item: 'ultra_orb', qty: 1 },
    { id: 'sol_i2', x: 27, y: 3, item: 'max_eter', qty: 1 },
  ],
};

const solnice_centrum = center('solnice_centrum', 'Solnice', [
  { id: 'sol_c_npc', x: 2, y: 6, dir: 'right', look: 'sailor', say: ['V Kloboučnictví vedle prodávají čepice pro tvory.', 'Můj Ráček nosí kšiltovku. Vypadá jako pravý námořník!'] },
]);

const solnice_dum = house('solnice_dum', 'Solnice – dům námořníka', [
  { id: 'sol_d_m', x: 6, y: 4, dir: 'down', look: 'sailor', name: 'Starý námořník', give: { item: 'super_orb', qty: 5 },
    say: ['Tyhle orby jsem vylovil z moře. Asi je někdo ztratil při bouřce.', 'Vezmi si je, mně k ničemu nejsou.'],
    after: ['Sůl a vítr, chlapče. To je život.'] },
]);

const solnice_kloboucnictvi = house('solnice_kloboucnictvi', 'Kloboučnictví U Veselé Mašle', [
  { id: 'sol_k_owner', x: 5, y: 3, dir: 'down', look: 'hatter', script: 'hats', name: 'Mistrová Mašle' },
  { id: 'sol_k_gift', x: 2, y: 5, dir: 'right', look: 'girl', name: 'Učednice Ája', give: { item: 'cepice_masle', qty: 1 },
    say: ['Vítej v kloboučnictví! Tohle je moje první mašle – daruju ti ji.', 'Nasadíš ji tvorovi v Batohu, v záložce Čepice.'],
    after: ['Až budeš mít víc odznaků, Mistrová ti ukáže vzácnější kousky!'] },
]);

const solnice_majak = house('solnice_majak', 'Maják Solnice', [
  { id: 'sol_m_keeper', x: 5, y: 3, dir: 'down', look: 'elder', name: 'Strážce majáku', give: { item: 'td12', qty: 1 },
    say: ['Přišel jsi až sem nahoru? Odvážné!', 'Na památku si vezmi tenhle disk. Je v něm síla přílivu – útok Přílivová vlna.'],
    after: ['Za jasných nocí je odsud vidět až na Korunu.'] },
], {
  rows: [
    'wwwwwwwwwww',
    'wwwwwuwwwww',
    '___________',
    '___________',
    'y_________y',
    '___________',
    'b_________b',
    '_____m_____',
  ],
});

export default [cesta8, solnice, solnice_centrum, solnice_dum, solnice_kloboucnictvi, solnice_majak];
