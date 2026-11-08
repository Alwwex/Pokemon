// Oblast 1: Lísková, Cesta 1, Mlýnov, Cesta 2, Rybníkov
import { center, house, lab } from './interiors.js';

const liskova = {
  id: 'liskova',
  name: 'Lísková',
  theme: 'town',
  music: 'town',
  bg: 'grass',
  rows: [
    'TTTTTTTTTTT::TTTTTTTTTTT',
    'TTTTTTTTTTT::TTTTTTTTTTT',
    'TT.........::.........TT',
    'TT.*.......::.......*.TT',
    'TT.........::.........TT',
    'TT.........::.........TT',
    'TT.........::.........TT',
    'TT.........::.........TT',
    'TT...::::::::::::::...TT',
    'TT.*.......::.......*.TT',
    'TT.........::.........TT',
    'TT.........::.........TT',
    'TT.~~~~....::.........TT',
    'TT.~~~~~...::.........TT',
    'TT.~~~~~...::.........TT',
    'TT..~~~....::::::::...TT',
    'TT.*.......::.........TT',
    'TT..ff.............ff.TT',
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  edges: {
    up: { to: 'cesta1', off: -2, need: { flag: 'starter', msg: 'Hej, počkej! Bez vlastního tvora je vysoká tráva nebezpečná. Zastav se v laboratoři u profesorky Javorové!' } },
  },
  buildings: [
    { style: 'home', x: 3, y: 4, w: 5, h: 4, door: 2, roof: '#d0503a', to: 'liskova_domov' },
    { style: 'house', x: 15, y: 4, w: 5, h: 4, door: 2, roof: '#4a7ad0', to: 'liskova_dum' },
    { style: 'lab', x: 14, y: 11, w: 7, h: 4, door: 3, roof: '#8a8a9a', to: 'liskova_lab' },
  ],
  signs: [
    { x: 10, y: 3, text: 'Lísková – vesnice, kde voní lískové oříšky.' },
    { x: 13, y: 13, text: 'Laboratoř profesorky Javorové – výzkum tvorů regionu Velhora.' },
  ],
  npcs: [
    { id: 'lis_kid', x: 8, y: 11, dir: 'down', look: 'kid', turn: true, say: ['Dneska je venku krásně!', 'Prý když půjdeš do vysoké trávy, můžou na tebe vyskočit divocí tvorové.'] },
    { id: 'lis_elder', x: 20, y: 10, dir: 'left', look: 'elder', say: ['Za mlada jsem viděl nad horami letět Ohniváka.', 'Celý v plamenech, krásný jako východ slunce… Od té doby ho nikdo nespatřil.'] },
    { id: 'lis_fisher', x: 8, y: 14, dir: 'left', look: 'fisher', say: ['V tomhle rybníčku se prý občas ukáže Kapřík.', 'Do Rybníkova je to odsud kousek – tam je rybníků jak hub po dešti!'] },
  ],
  items: [{ id: 'lis_i1', x: 21, y: 16, item: 'lektvar', qty: 1 }],
};

const liskova_domov = house('liskova_domov', 'Tvůj domov', [
  { id: 'mom', x: 4, y: 3, dir: 'left', look: 'mom', name: 'Máma', script: 'mom' },
], { music: 'home' });

const liskova_dum = house('liskova_dum', 'Lísková – dům Novákových', [
  { id: 'lis_dum_girl', x: 6, y: 4, dir: 'down', look: 'girl', turn: true, say: ['Moje sestřenice Hana vede stadion v Rybníkově.', 'Je moc silná… ve vodě jí nikdo nestačí!'] },
  { id: 'lis_dum_granny', x: 2, y: 5, dir: 'right', look: 'granny', say: ['Ty jdeš za profesorkou? Ta už od rána pobíhá po laboratoři.', 'Asi pro tebe chystá nějaké překvapení!'] },
]);

const liskova_lab = lab('liskova_lab', 'Laboratoř profesorky Javorové');
liskova_lab.npcs.push(
  { id: 'prof', x: 6, y: 2, dir: 'down', look: 'prof', name: 'Profesorka Javorová', script: 'prof' },
  { id: 'lab_aide', x: 2, y: 5, dir: 'right', look: 'scientist', say: ['Profesorka zkoumá, jak se tvorové vyvíjejí.', 'Když tvor dosáhne určité úrovně, může se proměnit v silnější podobu!'] },
  {
    id: 'lab_rival', x: 8, y: 4, dir: 'left', look: 'rival', name: 'Ondra', cond: { nflag: 'rival1' },
    say: ['Ondra: Čau, {name}! Taky si jdeš pro tvora? Profesorka říkala, že si můžu vybrat hned po tobě!'],
    trainer: { rival: 1, cls: 'Rival', name: 'Ondra', sight: 0,
      intro: 'Počkej, {name}! Já si taky vybral tvora. Pojď, vyzkoušíme je!',
      lose: 'Cože? Prohrál jsem? No jo, teprve začínáme…',
      after: 'Uvidíme se na cestě!' },
  },
  { id: 'lab_aide2', x: 10, y: 5, dir: 'left', look: 'scientist', say: ['Každý tvor má svůj typ. Voda hasí oheň, oheň spaluje rostliny a rostliny pijí vodu.', 'Když to budeš mít v hlavě, vyhraješ spoustu soubojů!'] },
);

const cesta1 = {
  id: 'cesta1',
  name: 'Cesta 1',
  theme: 'route',
  music: 'route',
  bg: 'grass',
  rows: [
    'TTTTTTTTT::TTTTTTTTT',
    'TTTTTTTTT::TTTTTTTTT',
    'TT.......::.....,,TT',
    'TT.,,,,..::....,,,TT',
    'TT.,,,,..::....,,,TT',
    'TT.,,,,..::.......TT',
    'TT.......::...ooo.TT',
    'TT^^^^^^.::.^^^^^^TT',
    'TT.......::.......TT',
    'TT..,,,,,::,,,,...TT',
    'TT..,,,,,::,,,,...TT',
    'TT..,,,,,::,,,,...TT',
    'TT.......::.......TT',
    'TTTTT....::....TTTTT',
    'TTTTT....::....TTTTT',
    'TT,,,....::.......TT',
    'TT,,,,...::..**...TT',
    'TT,,,,...::..**...TT',
    'TT.......::.......TT',
    'TT.ttt...::...tt..TT',
    'TT.......::.......TT',
    'TT^^^^^^^::^^^^^^^TT',
    'TT.......::.......TT',
    'TT.,,,,,.::.,,,,,.TT',
    'TT.,,,,,.::.,,,,,.TT',
    'TT.......::.......TT',
    'TT..~~~..::.......TT',
    'TT.~~~~~.::...,,,.TT',
    'TT..~~~..::...,,,.TT',
    'TT.......::.......TT',
    'TTTT.....::.....TTTT',
    'TTTT.....::.....TTTT',
    'TTTTT,,,.::.,,,TTTTT',
    'TTTTT,,,.::.,,,TTTTT',
    'TTTTTTTTT::TTTTTTTTT',
    'TTTTTTTTT::TTTTTTTTT',
  ],
  edges: {
    down: { to: 'liskova', off: 2 },
    up: { to: 'mlynov', off: 4 },
  },
  signs: [{ x: 8, y: 33, text: 'Cesta 1   ↑ Mlýnov   ↓ Lísková' }],
  npcs: [
    {
      id: 'c1_t1', x: 13, y: 5, dir: 'left', look: 'youngster',
      trainer: { cls: 'Mladík', name: 'Kuba', sight: 4, reward: 60, team: [['hlodik', 4]],
        intro: 'Hej, ty! Taky máš tvora? Tak se ukaž!', lose: 'Cože? To nebylo fér!', after: 'Musím víc trénovat ve vysoké trávě.' },
    },
    {
      id: 'c1_t2', x: 6, y: 18, dir: 'right', look: 'lass',
      trainer: { cls: 'Dívka', name: 'Ema', sight: 4, reward: 100, team: [['pipak', 4], ['usanek', 4]],
        intro: 'Mí tvorové jsou ti nejroztomilejší v celé Velhoře!', lose: 'Ach jo… ale roztomilí jsou pořád!', after: 'Ušánek slyší, jak roste tráva. Věděl jsi to?' },
    },
    {
      id: 'c1_t3', x: 14, y: 25, dir: 'down', look: 'bugcatcher',
      trainer: { cls: 'Lovec hmyzu', name: 'Vašek', sight: 3, reward: 90, team: [['housik', 3], ['housik', 4], ['kuklik', 5]],
        intro: 'Mám plnou síťku hmyzáků! Chceš je vidět v akci?', lose: 'Moji broučci!', after: 'Housík se brzy promění v kuklu a pak v nádherného motýla!' },
    },
  ],
  items: [
    { id: 'c1_i1', x: 2, y: 8, item: 'orb', qty: 3 },
    { id: 'c1_i2', x: 17, y: 29, item: 'lektvar', qty: 1 },
  ],
  enc: {
    rate: 0.1,
    list: [
      { s: 'hlodik', min: 2, max: 4, w: 30 },
      { s: 'pipak', min: 2, max: 4, w: 30 },
      { s: 'housik', min: 2, max: 3, w: 20 },
      { s: 'veveruska', min: 3, max: 4, w: 15 },
      { s: 'usanek', min: 3, max: 4, w: 5 },
    ],
  },
};

const mlynov = {
  id: 'mlynov',
  name: 'Mlýnov',
  theme: 'town',
  music: 'town',
  bg: 'grass',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT........................TT',
    'TT.::::::::::::::::::::::.TT',
    'TT...........::...........TT',
    'TT.*.........::.........*.TT',
    'TT...ff......::......ff...TT',
    'TT...........::...........TT',
    'TT...........::...........TT',
    'TT...........::...........TT',
    'TT...........::...........TT',
    'TT...........::...........TT',
    'TT...:::::::::::::::::::::::',
    'TT...........::.........::::',
    'TT.*.........::..........*TT',
    'TT...~~~.....::...........TT',
    'TT..~~~~~....::.....***...TT',
    'TT...~~~.....::.....***...TT',
    'TTTTTTTTTTTTT::TTTTTTTTTTTTT',
    'TTTTTTTTTTTTT::TTTTTTTTTTTTT',
  ],
  edges: {
    down: { to: 'cesta1', off: -4 },
    right: { to: 'cesta2', off: -9, need: { badges: 1, msg: 'Strážný: Cesta na východ je jen pro trenéry s odznakem. Nejdřív poraz Bořka ve zdejším stadionu!' } },
  },
  buildings: [
    { style: 'gym', x: 4, y: 2, w: 8, h: 5, door: 4, roof: '#8a6a4a', to: 'mlynov_stadion', badge: 1 },
    { style: 'center', x: 16, y: 3, w: 6, h: 4, door: 3, to: 'mlynov_centrum' },
    { style: 'house', x: 4, y: 12, w: 5, h: 4, door: 2, roof: '#5aa04a', to: 'mlynov_dum' },
    { style: 'mill', x: 18, y: 11, w: 5, h: 5, door: 2, roof: '#a8742a', to: 'mlynov_mlyn' },
  ],
  signs: [
    { x: 12, y: 6, text: 'Stadion Mlýnov – vedoucí: Bořek. „Pevný jako mlýnský kámen!“' },
    { x: 15, y: 9, text: 'Mlýnov – město, kde se mele mouka i odvaha.' },
  ],
  npcs: [
    { id: 'mly_worker', x: 10, y: 9, dir: 'down', look: 'worker', say: ['Mlýnské kolo se tu točí už tři sta let.', 'Stadion vede Bořek – je tvrdý jako skála! Vodní a rostlinní tvorové na něj platí nejlíp.'] },
    { id: 'mly_girl', x: 23, y: 8, dir: 'left', look: 'girl', turn: true, say: ['V Centru tvorů ti sestra Alenka zadarmo vyléčí tvory.', 'A taky tam můžeš nakupovat a ukládat tvory do počítače!'] },
    { id: 'mly_kid', x: 15, y: 19, dir: 'up', look: 'kid', say: ['Viděl jsi někdy Oblázka? Vypadá jako obyčejný kámen, ale kouše!'] },
    { id: 'mly_guard', x: 25, y: 15, dir: 'down', look: 'guard', cond: { nbadges: 1 }, say: ['Na východ pouštím jen trenéry s odznakem.', 'Bořek ve stadionu ti ho dá, když ho porazíš.'] },
  ],
  items: [{ id: 'mly_i1', x: 25, y: 20, item: 'lektvar', qty: 2 }],
};

const mlynov_centrum = center('mlynov_centrum', 'Mlýnov', [
  { id: 'mly_c_npc', x: 2, y: 6, dir: 'right', look: 'youngster', say: ['Tvory si můžeš uložit do počítače vlevo.', 'V týmu jich uneseš nejvýš šest.'] },
]);

const mlynov_dum = house('mlynov_dum', 'Mlýnov – dům', [
  { id: 'mly_dum_m', x: 4, y: 4, dir: 'left', look: 'elder', say: ['Říká se, že v Šedé jeskyni za Rybníkovem spí obr z hlíny.', 'Kdo ho probudí, ten se musí mít na pozoru…'] },
  { id: 'mly_dum_k', x: 7, y: 5, dir: 'left', look: 'kid', turn: true, say: ['Až vyrostu, budu mít Drakobouře!'] },
]);

const mlynov_mlyn = house('mlynov_mlyn', 'Mlýnov – mlýn', [
  { id: 'mly_miller', x: 5, y: 3, dir: 'down', look: 'worker', name: 'Mlynář', give: { item: 'super_lektvar', qty: 2 },
    say: ['Vítej ve mlýně! Mouka z našeho mlýna dělá ty nejlepší koláče.', 'Na, vezmi si tohle na cestu. Tvoji tvorové to ocení!'],
    after: ['Jak chutnají koláče? Co? Lektvary se nejí!'] },
]);

const mlynov_stadion = {
  id: 'mlynov_stadion',
  name: 'Stadion Mlýnov',
  theme: 'gym',
  music: 'gym',
  bg: 'gym',
  rows: [
    'wwwwwwwwwww',
    'wwwwwwwwwww',
    'zgggggggggz',
    'ggggggggggg',
    'ooooggooooo',
    'ggggggggggg',
    'ggggggggggg',
    'ooooooogggo',
    'ggggggggggg',
    'ggggggggggg',
    'zgggggggggz',
    'ggggggggggg',
    'ggggggggggg',
    'gggggmggggg',
  ],
  mat: { x: 5, y: 13 },
  npcs: [
    { id: 'g1_guide', x: 3, y: 12, dir: 'right', look: 'guard', say: ['Ahoj, vyzyvateli! Bořek používá kamenné tvory.', 'Vodní a rostlinné útoky na ně platí nejlíp, oheň a vzduch moc ne!'] },
    {
      id: 'g1_t1', x: 2, y: 8, dir: 'right', look: 'hiker',
      trainer: { cls: 'Turista', name: 'Jarda', sight: 5, reward: 250, team: [['oblazek', 9], ['hrabacek', 9]],
        intro: 'Kameny jsou můj život! Ukaž, co v tobě je!', lose: 'Rozdrolil jsem se jako pískovec…', after: 'Bořek je ještě tvrdší oříšek.' },
    },
    {
      id: 'g1_t2', x: 8, y: 5, dir: 'left', look: 'hiker',
      trainer: { cls: 'Turista', name: 'Pepa', sight: 4, reward: 260, team: [['plisek', 10]],
        intro: 'K Bořkovi se dostaneš jen přese mě!', lose: 'Tak jo, tak jo… projdi.', after: 'Hodně štěstí. Budeš ho potřebovat.' },
    },
    {
      id: 'g1_leader', x: 5, y: 2, dir: 'down', look: 'borek', name: 'Bořek',
      trainer: { cls: 'Vedoucí stadionu', name: 'Bořek', sight: 0, reward: 1300, ai: 'smart', items: { super_lektvar: 1 }, badge: 1, tm: 'td01',
        team: [['oblazek', 11], ['plisek', 11], ['balvanik', 13]],
        intro: 'Vítej ve stadionu Mlýnov! Jsem Bořek a moji tvorové jsou pevní jako mlýnské kameny. Zkus s nimi pohnout!',
        lose: 'Ha! Rozdrtil jsi mě jako mlýn obilí! Zasloužíš si Odznak Mlýnský kámen!',
        after: 'S tímhle odznakem tě pustí dál na východ. Pokračuj po Cestě 2 do Rybníkova!' },
    },
  ],
};

const cesta2 = {
  id: 'cesta2',
  name: 'Cesta 2',
  theme: 'route',
  music: 'route',
  bg: 'grass',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTT....,,,,,,......T~~T...,,,,,,......TT',
    'TT.....,,,,,,.......~~....,,,,,,.......T',
    'TT..o..,,,,,,.......~~....,,,,,,...o...T',
    'TT..................~~.................T',
    'TT..ttt.............~~..........ttt....T',
    '::::::::::::::::::::==::::::::::::::::::',
    '::::::::::::::::::::==::::::::::::::::::',
    'TT..................~~.................T',
    'TT...,,,,,,,,.......~~.....,,,,,,,,....T',
    'TT...,,,,,,,,.......~~.....,,,,,,,,....T',
    'TT...,,,,,,,,..*....~~..*..,,,,,,,,....T',
    'TTT.................~~................TT',
    'TTTTTTTTTTTTTTTTTTTT~~TTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  edges: {
    left: { to: 'mlynov', off: 9 },
    right: { to: 'rybnikov', off: 3 },
  },
  signs: [{ x: 2, y: 6, text: 'Cesta 2   ← Mlýnov   → Rybníkov' }],
  npcs: [
    {
      id: 'c2_t1', x: 9, y: 5, dir: 'down', look: 'youngster',
      trainer: { cls: 'Mladík', name: 'Petr', sight: 4, reward: 140, team: [['hlodik', 7], ['pipak', 7]],
        intro: 'Moji tvorové jsou nejrychlejší na celé Cestě 2!', lose: 'Rychlost není všechno…', after: 'Příště budu rychlejší!' },
    },
    {
      id: 'c2_t2', x: 16, y: 9, dir: 'up', look: 'karate',
      trainer: { cls: 'Karatista', name: 'Honza', sight: 3, reward: 270, team: [['brucik', 9]],
        intro: 'Hijá! Můj Bručík boxuje se stromy!', lose: 'Uff… dobrý úder.', after: 'Bručík potřebuje víc medu.' },
    },
    {
      id: 'c2_t3', x: 30, y: 6, dir: 'down', look: 'lass',
      trainer: { cls: 'Dívka', name: 'Klára', sight: 3, reward: 160, team: [['usanek', 8], ['vcelka', 8]],
        intro: 'Moje Včelka umí bzučet písničky! Chceš slyšet?', lose: 'Bzzz… prohrála jsem.', after: 'Včelky mají rády louky plné kvítí.' },
    },
    {
      id: 'c2_rival', x: 36, y: 6, dir: 'down', look: 'rival', name: 'Ondra', cond: { nflag: 'rival2' },
      trainer: { rival: 2, cls: 'Rival', name: 'Ondra', sight: 2, flagOnWin: 'rival2',
        intro: 'Á, {name}! Už máš odznak? Já taky! Pojď, změříme síly!',
        lose: 'Zase? Hm… jsi fakt dobrý. Ale příště tě porazím!',
        after: 'Uvidíme se v Rybníkově!' },
    },
  ],
  items: [
    { id: 'c2_i1', x: 3, y: 12, item: 'orb', qty: 2 },
    { id: 'c2_i2', x: 37, y: 3, item: 'lektvar', qty: 1 },
    { id: 'c2_i3', x: 25, y: 13, item: 'protijed', qty: 1 },
  ],
  enc: {
    rate: 0.1,
    list: [
      { s: 'hlodik', min: 4, max: 7, w: 18 },
      { s: 'pipak', min: 4, max: 7, w: 18 },
      { s: 'brucik', min: 5, max: 7, w: 14 },
      { s: 'mravik', min: 5, max: 7, w: 14 },
      { s: 'kuklik', min: 5, max: 7, w: 8 },
      { s: 'housik', min: 4, max: 6, w: 8 },
      { s: 'usanek', min: 5, max: 7, w: 10 },
      { s: 'svetluska', min: 6, max: 7, w: 10 },
    ],
  },
};

const rybnikov = {
  id: 'rybnikov',
  name: 'Rybníkov',
  theme: 'town',
  music: 'town2',
  bg: 'water',
  rows: [
    'TTTTTTTTTTTTTT::TTTTTTTTTTTTTT',
    'TT............::............TT',
    'TT............::............TT',
    'TT............::............TT',
    'TT............::............TT',
    'TT............::............TT',
    'TT............::............TT',
    'TT..::::::::::::::::::::::..TT',
    'TT............::............TT',
    'TT.*..........::..........*.TT',
    '::::::::::::::::............TT',
    '::::::::::::::::............TT',
    'TT...........~~~~~~~~~~.....TT',
    'TT..........~~~~~~~~~~~~....TT',
    'TT.........~~~~~~~~~~~~~~...TT',
    'TT.........~~~~~~~~~~~~~~...TT',
    'TT.........~~~~~~~~~~~~~~...TT',
    'TT..........~~~~~~~~~~~~....TT',
    'TT...........~~~~~~~~~~.....TT',
    'TT..ss......................TT',
    'TT.sss...*.......*..........TT',
    'TT......................::..TT',
    'TTTTTTTTTTTTTTTTTTTTTTTT::TTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTT::TTTT',
  ],
  edges: {
    left: { to: 'cesta2', off: -3 },
    down: { to: 'cesta8', off: -20, need: { badges: 2, msg: 'Strážný: Na jihu je Pobřeží a přístav Solnice. Pustím tě tam až s Odznakem Kapka od Hany!' } },
    up: { to: 'cesta3', off: -4, need: { badges: 2, msg: 'Strážný: Cesta 3 vede k Šedé jeskyni. Pustím tě tam až se dvěma odznaky – nejdřív poraz Hanu ve stadionu!' } },
  },
  buildings: [
    { style: 'center', x: 3, y: 2, w: 6, h: 4, door: 3, to: 'rybnikov_centrum' },
    { style: 'gym', x: 18, y: 1, w: 8, h: 5, door: 4, roof: '#3a7ad0', to: 'rybnikov_stadion', badge: 2 },
    { style: 'house', x: 4, y: 14, w: 5, h: 4, door: 2, roof: '#2ab0b0', to: 'rybnikov_dum1' },
    { style: 'house', x: 23, y: 8, w: 5, h: 4, door: 2, roof: '#e8a03a', to: 'rybnikov_dum2' },
  ],
  signs: [
    { x: 13, y: 9, text: 'Rybníkov – město tisíce rybníků.' },
    { x: 17, y: 6, text: 'Stadion Rybníkov – vedoucí: Hana. „Klidná hladina, divoký proud.“' },
    { x: 23, y: 21, text: '↓ Cesta 8 – Pobřeží a přístav Solnice' },
  ],
  npcs: [
    { id: 'ryb_fisher', x: 10, y: 15, dir: 'right', look: 'fisher', say: ['Rybník Velký Kapr je nejstarší v celé Velhoře.', 'Kdysi tu žil obrovský Kaprál, který velel všem rybám!'] },
    { id: 'ryb_girl', x: 16, y: 20, dir: 'up', look: 'swimmer', turn: true, say: ['Hana ze stadionu je úžasná plavkyně!', 'Prý trénuje každé ráno v ledové vodě. Brr!'] },
    { id: 'ryb_elder', x: 27, y: 19, dir: 'left', look: 'elder', say: ['Na sever odtud vede Cesta 3 k Šedé jeskyni.', 'Ve tmě se tam prý třpytí živé krystaly…'] },
    { id: 'ryb_guard', x: 13, y: 2, dir: 'right', look: 'guard', cond: { nbadges: 2 }, say: ['Cestu na sever hlídám já.', 'Až budeš mít Odznak Kapka od Hany, pustím tě.'] },
  ],
  items: [
    { id: 'ryb_i1', x: 27, y: 2, item: 'orb', qty: 3 },
    { id: 'ryb_i2', x: 3, y: 21, item: 'lektvar', qty: 1 },
  ],
};

const rybnikov_centrum = center('rybnikov_centrum', 'Rybníkov', [
  { id: 'ryb_c_npc', x: 10, y: 6, dir: 'left', look: 'sailor', say: ['Víš, že můžeš vyzvat ostatní hráče k souboji?', 'Stačí k nim přijít a zmáčknout akci. Můžete si i vyměnit tvory!'] },
]);

const rybnikov_dum1 = house('rybnikov_dum1', 'Rybníkov – rybářská chalupa', [
  { id: 'ryb_d1_f', x: 4, y: 4, dir: 'left', look: 'fisher', name: 'Starý rybář', give: { item: 'sitovy_orb', qty: 3 },
    say: ['Ty taky rád chytáš? Já hlavně ryby, ale tvory taky!', 'Tady máš Síťové orby. Na vodní a hmyzí tvory jsou jako dělané.'],
    after: ['Trpělivost, mladý rybáři. To je celé tajemství.'] },
]);

const rybnikov_dum2 = house('rybnikov_dum2', 'Rybníkov – dům', [
  { id: 'ryb_d2_w', x: 6, y: 4, dir: 'down', look: 'granny', say: ['Můj vnuk šel na sever do Jiskrova. Pracuje tam v elektrárně.', 'Říká, že se tam rodí Ježiskry přímo v dráty!'] },
]);

const rybnikov_stadion = {
  id: 'rybnikov_stadion',
  name: 'Stadion Rybníkov',
  theme: 'gym',
  music: 'gym',
  bg: 'water',
  rows: [
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    '~~---------~~',
    '~~---------~~',
    '~~~~~~=~~~~~~',
    '-------------',
    '-------------',
    '~~~~=~~~~~~~~',
    '-------------',
    '-------------',
    '~~~~~~~~=~~~~',
    '-------------',
    '-y---------y-',
    '------m------',
  ],
  mat: { x: 6, y: 13 },
  npcs: [
    { id: 'g2_guide', x: 3, y: 12, dir: 'right', look: 'guard', say: ['Hana používá vodní tvory.', 'Rostlinné a elektrické útoky jim nedělají dobře!'] },
    {
      id: 'g2_t1', x: 10, y: 5, dir: 'left', look: 'swimmer',
      trainer: { cls: 'Plavkyně', name: 'Lucie', sight: 5, reward: 420, team: [['svitivka', 14], ['kaprik', 14]],
        intro: 'Šplouch! Skoč do vody, jestli si troufneš!', lose: 'Utopila jsem se… obrazně!', after: 'Hana je jako vodopád – nezastavitelná.' },
    },
    {
      id: 'g2_t2', x: 2, y: 8, dir: 'right', look: 'fisher',
      trainer: { cls: 'Rybář', name: 'Mirek', sight: 5, reward: 400, team: [['pulec', 13], ['racik', 14], ['bobrik', 14]],
        intro: 'Zabrala mi ryba! Teda vyzyvatel…', lose: 'Utekla mi… jako vždycky.', after: 'Ještě jednou nahodím.' },
    },
    {
      id: 'g2_leader', x: 6, y: 2, dir: 'down', look: 'hana', name: 'Hana',
      trainer: { cls: 'Vedoucí stadionu', name: 'Hana', sight: 0, reward: 1800, ai: 'smart', items: { super_lektvar: 2 }, badge: 2, tm: 'td02',
        team: [['kaprik', 16], ['svitivka', 16], ['kvakal', 18]],
        intro: 'Vítej v mém stadionu! Jsem Hana. Voda je klidná, dokud ji nerozvíříš. Připrav se na příliv!',
        lose: 'Smetl jsi mě jako jarní povodeň! Tady máš Odznak Kapka.',
        after: 'Na sever vede Cesta 3 přes Šedou jeskyni do Jiskrova. Hodně štěstí!' },
    },
  ],
};

export default [
  liskova, liskova_domov, liskova_dum, liskova_lab, cesta1,
  mlynov, mlynov_centrum, mlynov_dum, mlynov_mlyn, mlynov_stadion,
  cesta2, rybnikov, rybnikov_centrum, rybnikov_dum1, rybnikov_dum2, rybnikov_stadion,
];
