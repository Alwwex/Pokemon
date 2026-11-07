// Útoky. Všechny názvy jsou původní.
//
// c: 'P' fyzický, 'S' speciální, 'X' stavový
// p: síla, a: přesnost (0 = nikdy nemine), pp, pri: priorita
// f: příznaky – 'c' kontakt, 'b' kousnutí, 'p' úder pěstí, 's' zvukový
// st: [stav, šance %] – brn popálení, par ochromení, psn otrava, tox těžká otrava, slp spánek, frz zmrznutí
// cf: šance na zmatení cíle, fl: šance na ucuknutí
// fs: změny statů cíle (fsc = šance), ss: změny statů útočníka (ssc = šance)
// dr: podíl vysátí, rc: zpětný ráz (podíl způsobeného poškození), hl: léčení (podíl max HP)
// cr: bonus ke kritickému zásahu, mh: [min, max] počet zásahů, fx: pevné poškození ('level' nebo číslo)
// pr: ochrana, rest: spánek obnovy, wx: počasí, sc: clona ('reflect' | 'screen')
// seed: pijavé semínko, x2s: dvojnásobná síla proti cíli se stavem, scf: útočníka zmate
// ko: útočník po útoku omdlí, brk: rozbije clony, pdef: speciální útok proti obraně

const M = (n, t, c, p, a, pp, extra = {}) => ({ n, t, c, p, a, pp, pri: 0, ...extra });

export const MOVES = {
  // ---------- NORMÁL ----------
  uder:            M('Úder', 'normal', 'P', 40, 100, 35, { f: 'c' }),
  skrabnuti:       M('Škrábnutí', 'normal', 'P', 40, 100, 35, { f: 'c' }),
  rychly_vypad:    M('Rychlý výpad', 'normal', 'P', 40, 100, 30, { f: 'c', pri: 1 }),
  zuriva_salva:    M('Zuřivá salva', 'normal', 'P', 18, 80, 15, { f: 'c', mh: [2, 5] }),
  sevreni:         M('Sevření', 'normal', 'P', 55, 100, 30, { f: 'c' }),
  bodnuti_rohem:   M('Bodnutí rohem', 'normal', 'P', 65, 100, 25, { f: 'c' }),
  naraz_hlavou:    M('Náraz hlavou', 'normal', 'P', 70, 100, 15, { f: 'c', fl: 30 }),
  drtive_telo:     M('Drtivé tělo', 'normal', 'P', 85, 100, 15, { f: 'c', st: ['par', 30] }),
  mohutny_naraz:   M('Mohutný náraz', 'normal', 'P', 120, 100, 15, { f: 'c', rc: 0.33 }),
  vybuch:          M('Výbuch', 'normal', 'P', 200, 100, 5, { ko: true }),
  hvezdicky:       M('Hvězdičky', 'normal', 'S', 60, 0, 20),
  hlasity_vykrik:  M('Hlasitý výkřik', 'normal', 'S', 90, 100, 10, { f: 's' }),
  nicivy_paprsek:  M('Ničivý paprsek', 'normal', 'S', 140, 90, 5, { ss: { spa: -2 } }),
  rev:             M('Řev', 'normal', 'X', 0, 100, 40, { f: 's', fs: { atk: -1 } }),
  zly_pohled:      M('Zlý pohled', 'normal', 'X', 0, 100, 30, { fs: { def: -1 } }),
  ukolebavka:      M('Ukolébavka', 'normal', 'X', 0, 55, 15, { f: 's', st: ['slp', 100] }),
  zotaveni:        M('Zotavení', 'normal', 'X', 0, 0, 10, { hl: 0.5 }),
  ochrana:         M('Ochrana', 'normal', 'X', 0, 0, 10, { pri: 4, pr: true }),
  spanek_obnovy:   M('Spánek obnovy', 'mind', 'X', 0, 0, 10, { rest: true }),
  soustredeni:     M('Soustředění', 'normal', 'X', 0, 0, 30, { ss: { crit: 2 } }),
  tvrdnuti:        M('Ztvrdnutí', 'normal', 'X', 0, 0, 30, { ss: { def: 1 } }),
  tanec_cepeli:    M('Tanec čepelí', 'normal', 'X', 0, 0, 20, { ss: { atk: 2 } }),
  zdvojeni:        M('Zdvojení', 'normal', 'X', 0, 0, 15, { ss: { eva: 1 } }),

  // ---------- OHEŇ ----------
  zhava_jiskra:    M('Žhavá jiskra', 'fire', 'S', 40, 100, 25, { st: ['brn', 10] }),
  plamenne_kolo:   M('Plamenné kolo', 'fire', 'P', 60, 100, 25, { f: 'c', st: ['brn', 10] }),
  plamenny_tesak:  M('Plamenný tesák', 'fire', 'P', 65, 95, 15, { f: 'cb', st: ['brn', 10], fl: 10 }),
  zhava_pest:      M('Žhavá pěst', 'fire', 'P', 75, 100, 15, { f: 'cp', st: ['brn', 10] }),
  plamenny_proud:  M('Plamenný proud', 'fire', 'S', 90, 100, 15, { st: ['brn', 10] }),
  zhava_vlna:      M('Žhavá vlna', 'fire', 'S', 95, 90, 10, { st: ['brn', 10] }),
  pekelny_plamen:  M('Pekelný plamen', 'fire', 'S', 110, 85, 5, { st: ['brn', 10] }),
  plamenny_najezd: M('Plamenný nájezd', 'fire', 'P', 120, 100, 15, { f: 'c', rc: 0.33, st: ['brn', 10] }),
  prehrati:        M('Přehřátí', 'fire', 'S', 130, 90, 5, { ss: { spa: -2 } }),
  kridla_plamenu:  M('Křídla plamenů', 'fire', 'P', 100, 95, 5, { st: ['brn', 30] }),
  bludny_plamen:   M('Bludný plamen', 'fire', 'X', 0, 85, 15, { st: ['brn', 100] }),
  vyhen:           M('Výheň', 'fire', 'X', 0, 0, 5, { wx: 'sun' }),

  // ---------- VODA ----------
  vodni_tryska:    M('Vodní tryska', 'water', 'S', 40, 100, 25),
  vodni_sipka:     M('Vodní šipka', 'water', 'P', 40, 100, 20, { f: 'c', pri: 1 }),
  vodni_puls:      M('Vodní puls', 'water', 'S', 60, 100, 20, { cf: 20 }),
  bublinkova_salva:M('Bublinková salva', 'water', 'S', 65, 100, 20, { fs: { spe: -1 }, fsc: 10 }),
  kaskada:         M('Kaskáda', 'water', 'P', 80, 100, 15, { f: 'c', fl: 20 }),
  varici_voda:     M('Vařící voda', 'water', 'S', 80, 100, 15, { st: ['brn', 30] }),
  prilivova_vlna:  M('Přílivová vlna', 'water', 'S', 90, 100, 15),
  prilivovy_ocas:  M('Přílivový ocas', 'water', 'P', 90, 90, 10, { f: 'c' }),
  klepetove_kladivo:M('Klepetové kladivo', 'water', 'P', 100, 90, 10, { f: 'c', cr: 1 }),
  tlakove_delo:    M('Tlakové dělo', 'water', 'S', 110, 80, 5),
  privolani_deste: M('Přivolání deště', 'water', 'X', 0, 0, 5, { wx: 'rain' }),
  ulita:           M('Zalezení do ulity', 'water', 'X', 0, 0, 40, { ss: { def: 1 } }),

  // ---------- ROSTLINA ----------
  slahoun:         M('Šlahoun', 'plant', 'P', 45, 100, 25, { f: 'c' }),
  miza:            M('Míza', 'plant', 'S', 40, 100, 20, { dr: 0.5 }),
  rezavy_list:     M('Řezavý list', 'plant', 'P', 55, 95, 25, { cr: 1 }),
  semenna_palba:   M('Semenná palba', 'plant', 'P', 25, 100, 30, { mh: [2, 5] }),
  vysavaci_koreny: M('Vysávací kořeny', 'plant', 'S', 75, 100, 10, { dr: 0.5 }),
  sila_prirody:    M('Síla přírody', 'plant', 'S', 90, 100, 10, { fs: { spd: -1 }, fsc: 10 }),
  smaragdova_cepel:M('Smaragdová čepel', 'plant', 'P', 90, 100, 15, { f: 'c', cr: 1 }),
  slunecni_zare:   M('Sluneční záře', 'plant', 'S', 120, 85, 5),
  okvetni_tanec:   M('Okvětní tanec', 'plant', 'S', 120, 100, 10, { scf: true }),
  drevene_kladivo: M('Dřevěné kladivo', 'plant', 'P', 120, 100, 15, { f: 'c', rc: 0.33 }),
  pijave_seminko:  M('Pijavé semínko', 'plant', 'X', 0, 90, 10, { seed: true }),
  uspavaci_pyl:    M('Uspávací pyl', 'plant', 'X', 0, 75, 15, { st: ['slp', 100] }),
  ochromujici_pyl: M('Ochromující pyl', 'plant', 'X', 0, 75, 30, { st: ['par', 100] }),
  jedovaty_pyl:    M('Jedovatý pyl', 'toxic', 'X', 0, 75, 35, { st: ['psn', 100] }),
  rust:            M('Růst', 'plant', 'X', 0, 0, 20, { ss: { atk: 1, spa: 1 } }),

  // ---------- ELEKTŘINA ----------
  vyboj:           M('Výboj', 'electric', 'S', 40, 100, 30, { st: ['par', 10] }),
  jiskrovy_najezd: M('Jiskrový nájezd', 'electric', 'P', 65, 100, 20, { f: 'c', st: ['par', 30] }),
  elektricky_tesak:M('Elektrický tesák', 'electric', 'P', 65, 95, 15, { f: 'cb', st: ['par', 10], fl: 10 }),
  nabijeci_paprsek:M('Nabíjecí paprsek', 'electric', 'S', 50, 90, 10, { ss: { spa: 1 }, ssc: 70 }),
  elektricka_pest: M('Elektrická pěst', 'electric', 'P', 75, 100, 15, { f: 'cp', st: ['par', 10] }),
  bleskova_strela: M('Blesková střela', 'electric', 'S', 90, 100, 15, { st: ['par', 10] }),
  divoky_naboj:    M('Divoký náboj', 'electric', 'P', 90, 100, 15, { f: 'c', rc: 0.25 }),
  hromobiti:       M('Hromobití', 'electric', 'S', 110, 70, 10, { st: ['par', 30] }),
  elektricka_vlna: M('Elektrická vlna', 'electric', 'X', 0, 90, 20, { st: ['par', 100] }),

  // ---------- LED ----------
  snehovy_poprasek:M('Sněhový poprašek', 'ice', 'S', 40, 100, 25, { st: ['frz', 10] }),
  ledova_trist:    M('Ledová tříšť', 'ice', 'P', 40, 100, 30, { pri: 1 }),
  mrazivy_tesak:   M('Mrazivý tesák', 'ice', 'P', 65, 95, 15, { f: 'cb', st: ['frz', 10], fl: 10 }),
  mrazivy_dech:    M('Mrazivý dech', 'ice', 'S', 60, 90, 10, { cr: 3 }),
  polarni_zare:    M('Polární záře', 'ice', 'S', 65, 100, 20, { fs: { atk: -1 }, fsc: 10 }),
  ledova_pest:     M('Ledová pěst', 'ice', 'P', 75, 100, 15, { f: 'cp', st: ['frz', 10] }),
  rampouchovy_pad: M('Rampouchový pád', 'ice', 'P', 85, 90, 10, { fl: 30 }),
  mrazivy_paprsek: M('Mrazivý paprsek', 'ice', 'S', 90, 100, 10, { st: ['frz', 10] }),
  vanice:          M('Vánice', 'ice', 'S', 110, 70, 5, { st: ['frz', 10] }),
  krupobiti:       M('Krupobití', 'ice', 'X', 0, 0, 10, { wx: 'hail' }),

  // ---------- BOJ ----------
  seknuti_dlani:   M('Seknutí dlaní', 'brawl', 'P', 50, 100, 25, { f: 'c', cr: 1 }),
  bleskovy_direkt: M('Bleskový direkt', 'brawl', 'P', 40, 100, 30, { f: 'cp', pri: 1 }),
  podmeteni:       M('Podmetení', 'brawl', 'P', 65, 100, 20, { f: 'c', fs: { spe: -1 } }),
  rozrazec:        M('Rozrážeč', 'brawl', 'P', 75, 100, 15, { f: 'c', brk: true }),
  vysavaci_pest:   M('Vysávací pěst', 'brawl', 'P', 75, 100, 10, { f: 'cp', dr: 0.5 }),
  aurova_koule:    M('Aurová koule', 'brawl', 'S', 80, 0, 20),
  skokovy_kop:     M('Skokový kop', 'brawl', 'P', 100, 90, 10, { f: 'c' }),
  tvrdy_souboj:    M('Tvrdý souboj', 'brawl', 'P', 120, 100, 5, { f: 'c', ss: { def: -1, spd: -1 } }),
  soustredeny_vybuch:M('Soustředěný výbuch', 'brawl', 'S', 120, 70, 5, { fs: { spd: -1 }, fsc: 10 }),
  posilovani:      M('Posilování', 'brawl', 'X', 0, 0, 20, { ss: { atk: 1, def: 1 } }),

  // ---------- JED ----------
  jedovy_osten:    M('Jedový osten', 'toxic', 'P', 15, 100, 35, { st: ['psn', 30] }),
  kyselina:        M('Kyselina', 'toxic', 'S', 40, 100, 30, { fs: { spd: -1 }, fsc: 10 }),
  jedovy_tesak:    M('Jedový tesák', 'toxic', 'P', 50, 100, 15, { f: 'cb', st: ['tox', 50] }),
  jedove_bodnuti:  M('Jedové bodnutí', 'toxic', 'P', 80, 100, 20, { f: 'c', st: ['psn', 30] }),
  kalova_bomba:    M('Kalová bomba', 'toxic', 'S', 90, 100, 10, { st: ['psn', 30] }),
  kalova_vlna:     M('Kalová vlna', 'toxic', 'S', 95, 100, 10, { st: ['psn', 10] }),
  hnilobny_vystrel:M('Hnilobný výstřel', 'toxic', 'P', 120, 80, 5, { st: ['psn', 30] }),
  toxin:           M('Toxin', 'toxic', 'X', 0, 90, 10, { st: ['tox', 100] }),
  kyselinovy_stit: M('Kyselinový štít', 'toxic', 'X', 0, 0, 20, { ss: { def: 2 } }),

  // ---------- ZEMĚ ----------
  bahenni_placnuti:M('Bahenní plácnutí', 'earth', 'S', 20, 100, 10, { fs: { acc: -1 } }),
  dupot:           M('Dupot', 'earth', 'P', 60, 100, 20, { fs: { spe: -1 } }),
  kosteny_kyj:     M('Kostěný kyj', 'earth', 'P', 65, 85, 20, { fl: 10 }),
  bahenni_bomba:   M('Bahenní bomba', 'earth', 'S', 65, 85, 10, { fs: { acc: -1 }, fsc: 30 }),
  podkop:          M('Podkop', 'earth', 'P', 80, 100, 10, { f: 'c' }),
  sila_zeme:       M('Síla země', 'earth', 'S', 90, 100, 10, { fs: { spd: -1 }, fsc: 10 }),
  hlinena_pest:    M('Hliněná pěst', 'earth', 'P', 90, 100, 10, { f: 'cp', fl: 20 }),
  mocny_dupot:     M('Mocný dupot', 'earth', 'P', 95, 95, 10, { f: 'c' }),
  otres_zeme:      M('Otřes země', 'earth', 'P', 100, 100, 10),
  horsky_hnev:     M('Horský hněv', 'earth', 'P', 110, 90, 5, { fl: 20 }),
  pisek_do_oci:    M('Písek do očí', 'earth', 'X', 0, 100, 15, { fs: { acc: -1 } }),
  pisecna_boure:   M('Písečná bouře', 'stone', 'X', 0, 0, 10, { wx: 'sand' }),

  // ---------- VZDUCH ----------
  poryv:           M('Poryv', 'air', 'S', 40, 100, 35),
  klovnuti:        M('Klovnutí', 'air', 'P', 35, 100, 35, { f: 'c' }),
  uder_kridlem:    M('Úder křídlem', 'air', 'P', 60, 100, 35, { f: 'c' }),
  stremhlavy_utok: M('Střemhlavý útok', 'air', 'P', 60, 0, 20, { f: 'c' }),
  vzdusne_ostri:   M('Vzdušné ostří', 'air', 'S', 75, 95, 15, { fl: 30 }),
  vrtaci_zobak:    M('Vrtací zobák', 'air', 'P', 80, 100, 20, { f: 'c' }),
  uragan:          M('Uragán', 'air', 'S', 110, 70, 10, { cf: 30 }),
  odvazny_let:     M('Odvážný let', 'air', 'P', 120, 100, 15, { f: 'c', rc: 0.33 }),
  hradovani:       M('Hřadování', 'air', 'X', 0, 0, 10, { hl: 0.5 }),
  perickovy_tanec: M('Peříčkový tanec', 'air', 'X', 0, 100, 15, { fs: { atk: -2 } }),

  // ---------- PSYCHIKA ----------
  zmateni:         M('Zmatení', 'mind', 'S', 50, 100, 25, { cf: 10 }),
  psychopaprsek:   M('Psychopaprsek', 'mind', 'S', 65, 100, 20, { cf: 10 }),
  psycho_cepel:    M('Psycho-čepel', 'mind', 'P', 70, 100, 20, { cr: 1 }),
  psychosok:       M('Psychošok', 'mind', 'S', 80, 100, 10, { pdef: true }),
  zenova_hlavicka: M('Zenová hlavička', 'mind', 'P', 80, 90, 15, { f: 'c', fl: 20 }),
  sila_mysli:      M('Síla mysli', 'mind', 'S', 90, 100, 10, { fs: { spd: -1 }, fsc: 10 }),
  hypnoza:         M('Hypnóza', 'mind', 'X', 0, 60, 20, { st: ['slp', 100] }),
  meditace:        M('Meditace', 'mind', 'X', 0, 0, 20, { ss: { spa: 1, spd: 1 } }),
  mrstnost:        M('Mrštnost', 'mind', 'X', 0, 0, 30, { ss: { spe: 2 } }),
  odrazna_stena:   M('Odrazná stěna', 'mind', 'X', 0, 0, 20, { sc: 'reflect' }),
  svetelna_clona:  M('Světelná clona', 'mind', 'X', 0, 0, 30, { sc: 'screen' }),

  // ---------- HMYZ ----------
  jehlova_palba:   M('Jehlová palba', 'bug', 'P', 25, 95, 20, { mh: [2, 5] }),
  bzukot:          M('Bzukot', 'bug', 'S', 50, 100, 20, { fs: { spa: -1 } }),
  hmyzi_kousnuti:  M('Hmyzí kousnutí', 'bug', 'P', 60, 100, 20, { f: 'c' }),
  svetelny_signal: M('Světelný signál', 'bug', 'S', 75, 100, 15, { cf: 10 }),
  krizove_nuzky:   M('Křížové nůžky', 'bug', 'P', 80, 100, 15, { f: 'c' }),
  bzuciva_vlna:    M('Bzučivá vlna', 'bug', 'S', 90, 100, 10, { f: 's', fs: { spd: -1 }, fsc: 10 }),
  obri_kusadla:    M('Obří kusadla', 'bug', 'P', 120, 85, 10, { f: 'c' }),
  lepkave_vlakno:  M('Lepkavé vlákno', 'bug', 'X', 0, 95, 40, { fs: { spe: -2 } }),
  trepotavy_tanec: M('Třepotavý tanec', 'bug', 'X', 0, 0, 20, { ss: { spa: 1, spd: 1, spe: 1 } }),

  // ---------- KÁMEN ----------
  hod_kamenem:     M('Hod kamenem', 'stone', 'P', 50, 90, 15),
  kamenny_valec:   M('Kamenný válec', 'stone', 'P', 60, 90, 20, { f: 'c' }),
  kamenna_hrobka:  M('Kamenná hrobka', 'stone', 'P', 60, 95, 15, { fs: { spe: -1 } }),
  pradavna_sila:   M('Pradávná síla', 'stone', 'S', 60, 100, 5, { ss: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, ssc: 10 }),
  lavina_kameni:   M('Lavina kamení', 'stone', 'P', 75, 90, 10, { fl: 30 }),
  zarivy_drahokam: M('Zářivý drahokam', 'stone', 'S', 80, 100, 20),
  ostra_skala:     M('Ostrá skála', 'stone', 'P', 100, 80, 5, { cr: 1 }),
  kamenna_hlava:   M('Kamenná hlava', 'stone', 'P', 150, 80, 5, { f: 'c', rc: 0.5 }),
  lesteni:         M('Leštění', 'stone', 'X', 0, 0, 20, { ss: { spe: 2 } }),

  // ---------- PŘÍZRAK ----------
  oliznuti:        M('Olíznutí', 'spirit', 'P', 30, 100, 30, { f: 'c', st: ['par', 30] }),
  vylekani:        M('Vylekání', 'spirit', 'P', 30, 100, 15, { f: 'c', fl: 30 }),
  plizici_stin:    M('Plížící stín', 'spirit', 'P', 40, 100, 30, { f: 'c', pri: 1 }),
  nocni_prizrak:   M('Noční přízrak', 'spirit', 'S', 1, 100, 15, { fx: 'level' }),
  zlovestny_vitr:  M('Zlověstný vítr', 'spirit', 'S', 60, 100, 5, { ss: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, ssc: 10 }),
  kletba:          M('Kletba', 'spirit', 'S', 65, 100, 10, { x2s: true }),
  prizracny_drap:  M('Přízračný dráp', 'spirit', 'P', 70, 100, 15, { f: 'c', cr: 1 }),
  prizracna_koule: M('Přízračná koule', 'spirit', 'S', 80, 100, 15, { fs: { spd: -1 }, fsc: 20 }),
  kvilivy_vichr:   M('Kvílivý vichr', 'spirit', 'S', 100, 100, 5, { f: 's', fs: { spd: -1 }, fsc: 30 }),
  matouci_svetlo:  M('Matoucí světlo', 'spirit', 'X', 0, 100, 10, { cf: 100 }),

  // ---------- DRAK ----------
  smrst:           M('Smršť', 'dragon', 'S', 40, 100, 20, { fl: 20 }),
  draci_dech:      M('Dračí dech', 'dragon', 'S', 60, 100, 20, { st: ['par', 30] }),
  draci_drap:      M('Dračí dráp', 'dragon', 'P', 80, 100, 15, { f: 'c' }),
  draci_puls:      M('Dračí puls', 'dragon', 'S', 85, 100, 10),
  draci_besneni:   M('Dračí běsnění', 'dragon', 'P', 120, 100, 10, { f: 'c', scf: true }),
  draci_meteor:    M('Dračí meteor', 'dragon', 'S', 130, 90, 5, { ss: { spa: -2 } }),
  draci_tanec:     M('Dračí tanec', 'dragon', 'X', 0, 0, 20, { ss: { atk: 1, spe: 1 } }),

  // ---------- TEMNOTA ----------
  kousnuti:        M('Kousnutí', 'shadow', 'P', 60, 100, 25, { f: 'cb', fl: 30 }),
  lstivy_utok:     M('Lstivý útok', 'shadow', 'P', 60, 0, 20, { f: 'c' }),
  vrceni:          M('Vrčení', 'shadow', 'S', 55, 95, 15, { f: 's', fs: { spa: -1 } }),
  zakerny_uder:    M('Zákeřný úder', 'shadow', 'P', 70, 100, 5, { f: 'c', pri: 1 }),
  nocni_seknuti:   M('Noční seknutí', 'shadow', 'P', 70, 100, 15, { f: 'c', cr: 1 }),
  drtive_kousnuti: M('Drtivé kousnutí', 'shadow', 'P', 80, 100, 15, { f: 'cb', fs: { def: -1 }, fsc: 20 }),
  temny_puls:      M('Temný puls', 'shadow', 'S', 80, 100, 15, { fl: 20 }),
  zly_umysl:       M('Zlý úmysl', 'shadow', 'X', 0, 0, 20, { ss: { spa: 2 } }),

  // ---------- KOV ----------
  ocelovy_direkt:  M('Ocelový direkt', 'metal', 'P', 40, 100, 30, { f: 'cp', pri: 1 }),
  kovovy_drap:     M('Kovový dráp', 'metal', 'P', 50, 95, 35, { f: 'c', ss: { atk: 1 }, ssc: 10 }),
  ocelove_kridlo:  M('Ocelové křídlo', 'metal', 'P', 70, 90, 25, { f: 'c', ss: { def: 1 }, ssc: 10 }),
  zelezna_hlava:   M('Železná hlava', 'metal', 'P', 80, 100, 15, { f: 'c', fl: 30 }),
  zablekove_delo:  M('Zábleskové dělo', 'metal', 'S', 80, 100, 10, { fs: { spd: -1 }, fsc: 10 }),
  meteorova_pest:  M('Meteorová pěst', 'metal', 'P', 90, 90, 10, { f: 'cp', ss: { atk: 1 }, ssc: 20 }),
  zelezna_obrana:  M('Železná obrana', 'metal', 'X', 0, 0, 15, { ss: { def: 2 } }),
  kovovy_skripot:  M('Kovový skřípot', 'metal', 'X', 0, 85, 40, { f: 's', fs: { spd: -2 } }),

  // ---------- VÍLA ----------
  vili_vanek:      M('Vílí vánek', 'fae', 'S', 40, 100, 30),
  vysavajici_polibek:M('Vysávající polibek', 'fae', 'S', 50, 100, 10, { f: 'c', dr: 0.75 }),
  oslnivy_trpyt:   M('Oslnivý třpyt', 'fae', 'S', 80, 100, 10),
  hruba_hra:       M('Hrubá hra', 'fae', 'P', 90, 90, 10, { f: 'c', fs: { atk: -1 }, fsc: 10 }),
  mesicni_vybuch:  M('Měsíční výbuch', 'fae', 'S', 95, 100, 15, { fs: { spa: -1 }, fsc: 30 }),
  okouzleni:       M('Okouzlení', 'fae', 'X', 0, 100, 20, { fs: { atk: -2 } }),
  sladky_polibek:  M('Sladký polibek', 'fae', 'X', 0, 75, 10, { cf: 100 }),
  mesicni_svit:    M('Měsíční svit', 'fae', 'X', 0, 0, 5, { hl: 0.5 }),

  // ---------- ZVLÁŠTNÍ ----------
  zoufaly_utok:    M('Zoufalý útok', null, 'P', 50, 0, 1, { f: 'c', struggle: true }),
};

// Technické disky (TD) – předměty, které naučí útok. Opakovaně použitelné.
export const TMS = {
  td01: 'kamenna_hrobka',
  td02: 'vodni_puls',
  td03: 'bleskova_strela',
  td04: 'vysavaci_koreny',
  td05: 'prizracna_koule',
  td06: 'mrazivy_paprsek',
  td07: 'ochrana',
  td08: 'spanek_obnovy',
  td09: 'odrazna_stena',
  td10: 'svetelna_clona',
  td11: 'plamenny_proud',
  td12: 'prilivova_vlna',
  td13: 'otres_zeme',
  td14: 'temny_puls',
  td15: 'sila_mysli',
  td16: 'kalova_bomba',
  td17: 'rozrazec',
  td18: 'vzdusne_ostri',
  td19: 'lavina_kameni',
  td20: 'drtive_telo',
  td21: 'tanec_cepeli',
  td22: 'nicivy_paprsek',
  td23: 'zelezna_hlava',
  td24: 'oslnivy_trpyt',
  td25: 'draci_puls',
  td26: 'bzuciva_vlna',
  td27: 'zly_umysl',
  td28: 'meditace',
};

// Útoky, které se může naučit každý tvor (kromě typových pravidel).
export const UNIVERSAL_TM = new Set(['ochrana', 'spanek_obnovy', 'drtive_telo', 'nicivy_paprsek', 'odrazna_stena', 'svetelna_clona']);

const STAT_LABEL = { atk: 'Útok', def: 'Obranu', spa: 'Sp. útok', spd: 'Sp. obranu', spe: 'Rychlost', acc: 'Přesnost', eva: 'Úhyb', crit: 'šanci na kritický zásah' };
const STATUS_LABEL = { brn: 'popálení', par: 'ochromení', psn: 'otrávení', tox: 'těžké otrávení', slp: 'uspání', frz: 'zmrazení' };
const WX_LABEL = { rain: 'déšť', sun: 'výheň', sand: 'písečnou bouři', hail: 'krupobití' };

function statChanges(obj, who) {
  return Object.entries(obj).map(([k, v]) => `${v > 0 ? 'Zvýší' : 'Sníží'} ${who} ${STAT_LABEL[k]}${Math.abs(v) > 1 ? ' výrazně' : ''}`).join('. ');
}

// Automaticky vytvořený popis útoku.
export function moveDesc(id) {
  const m = MOVES[id];
  if (!m) return '';
  const parts = [];
  if (m.pri > 0) parts.push('Útočí přednostně');
  if (m.a === 0 && m.c !== 'X') parts.push('Nikdy nemine');
  if (m.mh) parts.push(`Zasáhne ${m.mh[0]}–${m.mh[1]}×`);
  if (m.fx === 'level') parts.push('Způsobí poškození rovné úrovni útočníka');
  if (m.st) parts.push(m.st[1] >= 100 ? `Způsobí ${STATUS_LABEL[m.st[0]]}` : `${m.st[1]} % šance na ${STATUS_LABEL[m.st[0]]}`);
  if (m.cf) parts.push(m.cf >= 100 ? 'Zmate cíl' : `${m.cf} % šance cíl zmást`);
  if (m.fl) parts.push(`${m.fl} % šance, že cíl ucukne`);
  if (m.fs) parts.push((m.fsc && m.fsc < 100 ? `${m.fsc} % šance: ` : '') + statChanges(m.fs, 'cíli'));
  if (m.ss) parts.push((m.ssc && m.ssc < 100 ? `${m.ssc} % šance: ` : '') + statChanges(m.ss, 'útočníkovi'));
  if (m.dr) parts.push(`Vysaje ${Math.round(m.dr * 100)} % způsobeného poškození`);
  if (m.rc) parts.push('Útočník utrpí zpětný ráz');
  if (m.hl) parts.push('Vyléčí polovinu max. HP');
  if (m.cr) parts.push(m.cr >= 3 ? 'Vždy kritický zásah' : 'Vyšší šance na kritický zásah');
  if (m.pr) parts.push('Na jedno kolo ochrání před útoky');
  if (m.rest) parts.push('Plně vyléčí a uspí útočníka na 2 kola');
  if (m.wx) parts.push(`Na 5 kol přivolá ${WX_LABEL[m.wx]}`);
  if (m.sc === 'reflect') parts.push('Na 5 kol sníží fyzické poškození');
  if (m.sc === 'screen') parts.push('Na 5 kol sníží speciální poškození');
  if (m.seed) parts.push('Každé kolo vysává cíli HP');
  if (m.x2s) parts.push('Dvojnásobná síla proti cíli se stavem');
  if (m.scf) parts.push('Útočník se poté zmate');
  if (m.ko) parts.push('Útočník po útoku omdlí');
  if (m.brk) parts.push('Rozbije clony soupeře');
  if (m.pdef) parts.push('Počítá se proti fyzické obraně');
  if (!parts.length) parts.push(m.c === 'X' ? 'Stavový útok' : 'Běžný útok');
  return parts.join('. ') + '.';
}
