// Bojový engine. Server je autoritativní – klient jen přehrává události.
//
// Textové události obsahují značky jmen \u0001<strana>\u0002<jméno>\u0003,
// které si klient převede podle své perspektivy („divoký“, „nepřátelský“ …).
import { MOVES } from '../shared/moves.js';
import { SPECIES } from '../shared/species.js';
import { ITEMS } from '../shared/items.js';
import { effectiveness } from '../shared/types.js';
import { calcStats, stageMult, accStageMult, monName, expForLevel } from '../shared/formulas.js';
import { gainExp, gainEvs, learnMove, maxHp, publicView, ownView } from './monsters.js';
import { randInt, chance, pick, weightedPick, clamp } from './util.js';

const STAT_INFO = {
  atk: ['Útok', 'm'], def: ['Obrana', 'f'], spa: ['Sp. útok', 'm'], spd: ['Sp. obrana', 'f'],
  spe: ['Rychlost', 'f'], acc: ['Přesnost', 'f'], eva: ['Úhyb', 'm'],
};

const STATUS_TXT = {
  brn: ' je popálený!',
  par: ' je ochromený! Možná se nebude moci hýbat!',
  psn: ' je otrávený!',
  tox: ' je těžce otrávený!',
  slp: ' usnul!',
  frz: ' zmrzl!',
};

const WEATHER_START = { rain: 'Začalo pršet!', sun: 'Slunce začalo nemilosrdně pražit!', sand: 'Zvedla se písečná bouře!', hail: 'Začalo padat krupobití!' };
const WEATHER_END = { rain: 'Přestalo pršet.', sun: 'Slunce přestalo pražit.', sand: 'Písečná bouře utichla.', hail: 'Krupobití ustalo.' };
const ENTRY_WEATHER = { privolani_deste: 'rain', sucho: 'sun', snezeni: 'hail', pisecny_proud: 'sand' };
const LOW_HP_BOOST = { zar: 'fire', priboj: 'water', bujnost: 'plant', roj: 'bug' };

function newVol() {
  return {
    st: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
    crit: 0, conf: 0, flinch: false, protect: false, protN: 0, seed: false, tox: 1, flash: false, fainted: false,
  };
}

const hasFlag = (mv, f) => !!(mv.f && mv.f.includes(f));
const targetsFoe = (mv) => mv.c !== 'X' || !!(mv.st || mv.cf || mv.fs || mv.seed);

export class Battle {
  constructor(opts) {
    this.id = opts.id;
    this.kind = opts.kind; // 'wild' | 'trainer' | 'pvp'
    this.env = opts.env || 'grass';
    this.night = !!opts.night;
    this.expShare = opts.expShare !== false;
    this.sides = opts.sides.map((s, i) => ({
      idx: i,
      kind: s.kind, // 'player' | 'ai'
      ai: s.ai || 'wild', // 'wild' | 'trainer' | 'smart'
      name: s.name || '',
      playerId: s.playerId || null,
      party: s.party,
      active: Math.max(0, s.party.findIndex((m) => m.hp > 0)),
      vol: newVol(),
      screens: { reflect: 0, screen: 0 },
      action: null,
      need: null,
      items: s.items ? { ...s.items } : {},
      participants: new Set(),
      runs: 0,
    }));
    this.turn = 0;
    this.weather = null;
    this.weatherTurns = 0;
    this.queue = [];
    this.over = false;
    this.result = null;
    this.caught = null;
    this.pendingLearn = [];
    this.leveled = new Set();
  }

  // ---------- pomocné ----------
  mon(si) { const s = this.sides[si]; return s.party[s.active]; }
  N(si) { return `\u0001${si}\u0002${monName(this.mon(si))}\u0003`; }
  push(e) { this.queue.push(e); }
  txt(t) { this.queue.push({ e: 'txt', t }); }
  flush() { const q = this.queue; this.queue = []; return q; }
  types(si) { return SPECIES[this.mon(si).s].ty; }
  aliveCount(si) { return this.sides[si].party.filter((m) => m.hp > 0).length; }
  view(si) { return publicView(this.mon(si)); }

  end(winner, reason) {
    if (this.over) return;
    this.over = true;
    this.result = { winner, reason };
    for (const s of this.sides) { s.need = null; s.action = null; }
  }

  forfeit(si, reason = 'forfeit') {
    if (this.over) return;
    this.txt(`${this.sides[si].name} opustil souboj.`);
    this.end(1 - si, reason);
  }

  // ---------- průběh ----------
  start() {
    for (const s of this.sides) s.participants = new Set([this.mon(s.idx).uid]);
    this.push({ e: 'send', side: 1, mon: this.view(1) });
    this.push({ e: 'send', side: 0, mon: this.view(0) });
    for (const si of this.speedOrder([0, 1])) this.onEntry(si);
    this.setNeeds();
  }

  setNeeds() {
    if (this.over) { for (const s of this.sides) s.need = null; return; }
    let anySwitch = false;
    for (const s of this.sides) {
      s.action = null;
      s.need = null;
      if (this.mon(s.idx).hp <= 0) {
        if (s.kind === 'ai') this.aiReplace(s.idx);
        else { s.need = 'switch'; anySwitch = true; }
      }
    }
    if (!anySwitch) for (const s of this.sides) s.need = s.kind === 'player' ? 'action' : null;
  }

  requestFor(si) {
    const s = this.sides[si];
    if (!s.need) return null;
    return {
      need: s.need,
      active: s.active,
      party: s.party.map(ownView),
      canRun: this.kind !== 'trainer',
      canItem: this.kind !== 'pvp',
      canCatch: this.kind === 'wild',
      turn: this.turn,
    };
  }

  choose(si, action) {
    const s = this.sides[si];
    if (this.over || !s || s.need !== 'action' || !action) return { ok: false };
    const m = this.mon(si);
    switch (action.type) {
      case 'move': {
        if (!m.moves.some((x) => x.pp > 0)) { action = { type: 'move', idx: -1 }; break; }
        const slot = m.moves[action.idx];
        if (!slot) return { ok: false };
        if (slot.pp <= 0) return { ok: false, msg: 'Tento útok už nemá žádné PP!' };
        action = { type: 'move', idx: action.idx };
        break;
      }
      case 'switch': {
        const t = s.party[action.idx];
        if (!t || t.hp <= 0) return { ok: false, msg: 'Tento tvor nemůže bojovat!' };
        if (action.idx === s.active) return { ok: false, msg: 'Tento tvor už bojuje!' };
        action = { type: 'switch', idx: action.idx };
        break;
      }
      case 'item': {
        if (this.kind === 'pvp') return { ok: false, msg: 'V souboji hráčů nelze používat předměty.' };
        const it = ITEMS[action.item];
        if (!it || it.cat === 'key' || it.cat === 'tm' || it.noBattle) return { ok: false, msg: 'Tento předmět teď nelze použít.' };
        if (it.cat === 'orb') {
          if (this.kind !== 'wild') return { ok: false, msg: 'Cizího tvora nelze chytit!' };
          action = { type: 'item', item: action.item };
          break;
        }
        const target = s.party[action.target];
        if (!target) return { ok: false };
        const err = itemUseError(it, target);
        if (err) return { ok: false, msg: err };
        action = { type: 'item', item: action.item, target: action.target };
        break;
      }
      case 'run':
        if (this.kind === 'trainer') return { ok: false, msg: 'Ze souboje s trenérem nelze utéct!' };
        action = { type: 'run' };
        break;
      default:
        return { ok: false };
    }
    s.action = action;
    s.need = null;
    if (!this.sides.some((x) => x.need === 'action')) this.resolveTurn();
    return { ok: true };
  }

  chooseSwitch(si, idx) {
    const s = this.sides[si];
    if (this.over || !s || s.need !== 'switch') return { ok: false };
    const m = s.party[idx];
    if (!m || m.hp <= 0 || idx === s.active) return { ok: false, msg: 'Tento tvor nemůže bojovat!' };
    s.need = null;
    this.switchIn(si, idx, true);
    if (!this.sides.some((x) => x.need === 'switch')) this.setNeeds();
    return { ok: true };
  }

  resolveTurn() {
    this.turn++;
    for (const s of this.sides) {
      if (s.kind === 'ai') s.action = this.aiChoose(s.idx);
      s.vol.flinch = false;
      s.vol.protect = false;
    }
    // 1) útěk / vzdání
    for (const s of this.sides) {
      if (s.action && s.action.type === 'run' && this.doRun(s.idx)) { this.setNeeds(); return; }
    }
    const order = this.speedOrder([0, 1]);
    // 2) výměny
    for (const si of order) {
      const a = this.sides[si].action;
      if (a && a.type === 'switch') this.switchIn(si, a.idx, false);
    }
    // 3) předměty
    for (const si of order) {
      const a = this.sides[si].action;
      if (a && a.type === 'item') {
        this.useItem(si, a);
        if (this.over) { this.setNeeds(); return; }
      }
    }
    // 4) útoky
    const movers = [0, 1].filter((si) => this.sides[si].action && this.sides[si].action.type === 'move');
    const tie = Math.random() < 0.5 ? 1 : -1;
    movers.sort((a, b) => (this.movePriority(b) - this.movePriority(a)) || (this.speedOf(b) - this.speedOf(a)) || tie);
    for (const si of movers) {
      if (this.over) break;
      if (this.mon(si).hp <= 0) continue;
      this.doMove(si, this.sides[si].action.idx);
      this.checkFaints();
    }
    // 5) konec kola
    if (!this.over) this.endOfTurn();
    this.setNeeds();
  }

  doRun(si) {
    const s = this.sides[si];
    if (this.kind === 'pvp') {
      this.txt(`${s.name} se vzdal!`);
      this.end(1 - si, 'forfeit');
      return true;
    }
    s.runs++;
    let ok = this.mon(si).ability === 'utek';
    if (!ok) {
      const a = this.speedOf(si);
      const b = Math.max(1, this.speedOf(1 - si));
      ok = a >= b || randInt(0, 255) < Math.floor((a * 128) / b) + 30 * s.runs;
    }
    if (ok) {
      this.txt('Utekl jsi bez úhony!');
      this.end(null, 'run');
      return true;
    }
    this.txt('Nepodařilo se utéct!');
    return false;
  }

  switchIn(si, idx, forced) {
    const s = this.sides[si];
    const old = this.mon(si);
    if (!forced && old.hp > 0) {
      if (old.ability === 'prirozene_leceni' && old.status) { old.status = null; old.slp = 0; }
      this.push({ e: 'recall', side: si });
    }
    s.active = idx;
    s.vol = newVol();
    const m = this.mon(si);
    this.push({ e: 'send', side: si, mon: this.view(si) });
    s.participants.add(m.uid);
    const o = this.sides[1 - si];
    const om = this.mon(1 - si);
    o.participants = new Set(om.hp > 0 ? [om.uid] : []);
    this.onEntry(si);
  }

  onEntry(si) {
    const m = this.mon(si);
    if (m.hp <= 0) return;
    if (m.ability === 'zastraseni' && this.mon(1 - si).hp > 0) {
      this.txt(`${this.N(si)} zastrašuje soupeře!`);
      this.changeStat(1 - si, 'atk', -1, si);
    }
    const wx = ENTRY_WEATHER[m.ability];
    if (wx && this.weather !== wx) this.setWeather(wx);
  }

  setWeather(w) {
    this.weather = w;
    this.weatherTurns = 5;
    this.push({ e: 'wx', wx: w });
    this.txt(WEATHER_START[w]);
  }

  speedOf(si) {
    const m = this.mon(si);
    if (!m || m.hp <= 0) return 0;
    let s = calcStats(m).spe * stageMult(this.sides[si].vol.st.spe);
    if (m.status === 'par') s *= 0.5;
    if (m.ability === 'plavec' && this.weather === 'rain') s *= 2;
    if (m.ability === 'chlorofyl' && this.weather === 'sun') s *= 2;
    return s;
  }

  speedOrder(list) {
    const tie = Math.random() < 0.5 ? 1 : -1;
    return [...list].sort((a, b) => (this.speedOf(b) - this.speedOf(a)) || tie);
  }

  movePriority(si) {
    const a = this.sides[si].action;
    const m = this.mon(si);
    if (!a || a.idx < 0 || !m.moves[a.idx]) return 0;
    const mv = MOVES[m.moves[a.idx].id];
    let p = mv.pri || 0;
    if (mv.c === 'X' && m.ability === 'sibal') p += 1;
    return p;
  }

  // ---------- útok ----------
  doMove(si, idx) {
    const s = this.sides[si];
    const m = this.mon(si);
    const ti = 1 - si;
    const slot = idx >= 0 ? m.moves[idx] : null;
    const moveId = slot ? slot.id : 'zoufaly_utok';
    const mv = MOVES[moveId];

    if (m.status === 'slp') {
      m.slp--;
      if (m.slp > 0) { this.txt(`${this.N(si)} tvrdě spí.`); return; }
      m.status = null; m.slp = 0;
      this.push({ e: 'st', side: si, st: null });
      this.txt(`${this.N(si)} se probudil!`);
    }
    if (m.status === 'frz') {
      if (chance(20) || (mv.t === 'fire' && mv.c !== 'X')) {
        m.status = null;
        this.push({ e: 'st', side: si, st: null });
        this.txt(`${this.N(si)} roztál!`);
      } else { this.txt(`${this.N(si)} je zmrzlý na kost!`); return; }
    }
    if (s.vol.flinch) { this.txt(`${this.N(si)} ucukl a nemohl zaútočit!`); return; }
    if (s.vol.conf > 0) {
      s.vol.conf--;
      if (s.vol.conf === 0) this.txt(`${this.N(si)} už není zmatený!`);
      else {
        this.txt(`${this.N(si)} je zmatený!`);
        if (chance(33)) {
          this.txt('Ve zmatení zranil sám sebe!');
          this.applyDamage(si, this.confusionDamage(si), { eff: 1 });
          return;
        }
      }
    }
    if (m.status === 'par' && chance(25)) { this.txt(`${this.N(si)} je ochromený a nemůže se hýbat!`); return; }

    if (slot) slot.pp = Math.max(0, slot.pp - 1);
    if (!slot) this.txt(`${this.N(si)} už nemá žádné PP!`);
    this.txt(`${this.N(si)} použil ${mv.n}!`);
    this.push({ e: 'use', side: si, mv: moveId });

    if (targetsFoe(mv)) {
      const target = this.mon(ti);
      if (target.hp <= 0) { this.txt('Ale nebyl tu žádný cíl…'); return this.afterMove(si, mv); }
      if (this.sides[ti].vol.protect) { this.txt(`${this.N(ti)} se ochránil!`); return this.afterMove(si, mv); }
      if (!this.accuracyCheck(si, ti, mv)) {
        this.push({ e: 'miss', side: si });
        this.txt(`${this.N(si)} minul!`);
        return this.afterMove(si, mv);
      }
    }
    if (mv.c === 'X') this.statusMove(si, ti, mv);
    else this.damagingMove(si, ti, mv);
    this.afterMove(si, mv);
  }

  afterMove(si, mv) {
    const m = this.mon(si);
    const v = this.sides[si].vol;
    if (!mv.pr) v.protN = 0;
    if (mv.ko && m.hp > 0) {
      m.hp = 0;
      this.push({ e: 'hp', side: si, hp: 0, mhp: maxHp(m) });
    }
    if (mv.scf && m.hp > 0 && v.conf === 0) {
      v.conf = randInt(2, 4);
      this.txt(`${this.N(si)} je vyčerpáním zmatený!`);
    }
  }

  accuracyCheck(si, ti, mv) {
    if (!mv.a) return true;
    if (mv === MOVES.hromobiti && this.weather === 'rain') return true;
    if (mv === MOVES.uragan && this.weather === 'rain') return true;
    if (mv === MOVES.vanice && this.weather === 'hail') return true;
    const stage = clamp(this.sides[si].vol.st.acc - this.sides[ti].vol.st.eva, -6, 6);
    let acc = mv.a * accStageMult(stage);
    if (this.mon(si).ability === 'bystre_oko') acc *= 1.3;
    return Math.random() * 100 < acc;
  }

  damagingMove(si, ti, mv) {
    const atk = this.mon(si);
    const def = this.mon(ti);
    const dab = def.ability;
    if (mv.t === 'earth' && dab === 'levitace') { this.txt(`${this.N(ti)} se vznáší a útok ho minul!`); return; }
    if (mv.t === 'water' && dab === 'pohlceni_vody') { this.absorbHeal(ti, 'pohltil vodu'); return; }
    if (mv.t === 'electric' && dab === 'bleskosvod') {
      this.txt(`${this.N(ti)} pohltil elektřinu!`);
      this.changeStat(ti, 'spa', 1, ti);
      return;
    }
    if (mv.t === 'fire' && dab === 'zapal') {
      this.sides[ti].vol.flash = true;
      this.txt(`${this.N(ti)} pohltil oheň a jeho plameny zesílily!`);
      return;
    }
    if (mv.brk) {
      const sc = this.sides[ti].screens;
      if (sc.reflect || sc.screen) { sc.reflect = 0; sc.screen = 0; this.txt('Clony soupeře byly rozbity!'); }
    }
    const eff = mv.t ? effectiveness(mv.t, this.types(ti)) : 1;
    if (eff === 0) { this.txt('Nemá to žádný účinek…'); return; }

    let hits = 1;
    if (mv.mh) {
      const r = Math.random();
      hits = Math.min(mv.mh[1], r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5);
    }
    let total = 0;
    let n = 0;
    for (let h = 0; h < hits; h++) {
      if (def.hp <= 0 || atk.hp <= 0) break;
      const { dmg, crit } = this.calcDamage(si, ti, mv, eff);
      let d = dmg;
      const mh = maxHp(def);
      const sturdy = dab === 'pevnost' && def.hp === mh && d >= def.hp;
      if (sturdy) d = def.hp - 1;
      this.applyDamage(ti, d, { eff, crit });
      if (crit) this.txt('Kritický zásah!');
      if (sturdy) this.txt(`${this.N(ti)} vydržel díky Pevnosti!`);
      total += d;
      n++;
    }
    if (n === 0) return;
    if (hits > 1) this.txt(`Zasaženo ${n}×!`);
    if (eff > 1) this.txt('Je to super účinné!');
    else if (eff < 1) this.txt('Není to moc účinné…');

    if (hasFlag(mv, 'c') && atk.hp > 0) this.contactEffects(si, ti);
    if (mv.t === 'fire' && def.status === 'frz' && def.hp > 0) {
      def.status = null;
      this.push({ e: 'st', side: ti, st: null });
      this.txt(`${this.N(ti)} roztál!`);
    }
    if (mv.dr && total > 0 && atk.hp > 0 && atk.hp < maxHp(atk)) {
      this.heal(si, Math.max(1, Math.floor(total * mv.dr)));
      this.txt(`${this.N(si)} vysál soupeři energii!`);
    }
    if (mv.rc && total > 0 && atk.hp > 0 && atk.ability !== 'tvrda_hlava') {
      this.applyDamage(si, Math.max(1, Math.floor(total * mv.rc)), { quiet: true });
      this.txt(`${this.N(si)} utrpěl zpětný ráz!`);
    }
    if (mv.struggle && atk.hp > 0) {
      this.applyDamage(si, Math.max(1, Math.floor(maxHp(atk) / 4)), { quiet: true });
      this.txt(`${this.N(si)} utrpěl zpětný ráz!`);
    }
    if (def.hp > 0) this.secondary(si, ti, mv);
    if (atk.hp > 0 && mv.ss && (!mv.ssc || chance(mv.ssc))) {
      for (const [k, v] of Object.entries(mv.ss)) this.changeStat(si, k, v, si);
    }
  }

  secondary(si, ti, mv) {
    if (mv.st && chance(mv.st[1])) this.inflict(ti, mv.st[0], true, mv);
    if (mv.cf && chance(mv.cf)) this.confuse(ti, true);
    if (mv.fl && chance(mv.fl)) this.sides[ti].vol.flinch = true;
    if (mv.fs && (!mv.fsc || chance(mv.fsc))) {
      for (const [k, v] of Object.entries(mv.fs)) this.changeStat(ti, k, v, si);
    }
  }

  statusMove(si, ti, mv) {
    const m = this.mon(si);
    const s = this.sides[si];
    const fail = () => this.txt('Ale nepodařilo se to!');
    if (mv.pr) {
      if (Math.random() < 1 / Math.pow(3, s.vol.protN)) {
        s.vol.protect = true;
        s.vol.protN++;
        this.txt(`${this.N(si)} se chrání!`);
      } else { s.vol.protN = 0; fail(); }
      return;
    }
    if (mv.rest) {
      const mh = maxHp(m);
      if (m.hp >= mh || m.ability === 'nespavost') return fail();
      m.status = 'slp';
      m.slp = 3;
      this.heal(si, mh);
      this.push({ e: 'st', side: si, st: 'slp' });
      this.txt(`${this.N(si)} usnul a nabral síly!`);
      return;
    }
    if (mv.hl) {
      const mh = maxHp(m);
      if (m.hp >= mh) { this.txt(`${this.N(si)} má plné HP!`); return; }
      this.heal(si, Math.floor(mh * mv.hl));
      this.txt(`${this.N(si)} si obnovil HP!`);
      return;
    }
    if (mv.wx) {
      if (this.weather === mv.wx) return fail();
      this.setWeather(mv.wx);
      return;
    }
    if (mv.sc) {
      if (s.screens[mv.sc] > 0) return fail();
      s.screens[mv.sc] = 5;
      this.txt(mv.sc === 'reflect' ? 'Odrazná stěna chrání před fyzickými útoky!' : 'Světelná clona chrání před speciálními útoky!');
      return;
    }
    if (mv.seed) {
      const tv = this.sides[ti].vol;
      if (tv.seed) return fail();
      if (this.types(ti).includes('plant')) { this.txt('Nemá to žádný účinek…'); return; }
      tv.seed = true;
      this.txt(`${this.N(ti)} byl osázen semínkem!`);
      return;
    }
    if (mv.st) this.inflict(ti, mv.st[0], false, mv);
    if (mv.cf) this.confuse(ti, false);
    if (mv.fs) for (const [k, v] of Object.entries(mv.fs)) this.changeStat(ti, k, v, si);
    if (mv.ss) for (const [k, v] of Object.entries(mv.ss)) this.changeStat(si, k, v, si);
  }

  inflict(ti, st, secondary, mv) {
    const m = this.mon(ti);
    if (m.hp <= 0) return false;
    const fail = (msg) => { if (!secondary) this.txt(msg || 'Ale nepodařilo se to!'); return false; };
    if (m.status) return fail();
    const types = this.types(ti);
    const ab = m.ability;
    const immune = 'Nemá to žádný účinek…';
    if (st === 'brn' && types.includes('fire')) return fail(immune);
    if (st === 'par' && (types.includes('electric') || ab === 'pruznost')) return fail(immune);
    if ((st === 'psn' || st === 'tox') && (types.includes('toxic') || types.includes('metal') || ab === 'imunita')) return fail(immune);
    if (st === 'frz' && (types.includes('ice') || this.weather === 'sun')) return fail(immune);
    if (st === 'slp' && ab === 'nespavost') return fail(immune);
    if (!secondary && mv && mv.t === 'electric' && effectiveness('electric', types) === 0) return fail(immune);
    m.status = st;
    if (st === 'slp') m.slp = randInt(2, 4);
    if (st === 'tox') this.sides[ti].vol.tox = 1;
    this.push({ e: 'st', side: ti, st });
    this.txt(`${this.N(ti)}${STATUS_TXT[st]}`);
    return true;
  }

  confuse(ti, secondary) {
    const m = this.mon(ti);
    const v = this.sides[ti].vol;
    if (m.hp <= 0) return false;
    if (v.conf > 0) { if (!secondary) this.txt(`${this.N(ti)} už je zmatený!`); return false; }
    v.conf = randInt(2, 5);
    this.txt(`${this.N(ti)} je zmatený!`);
    return true;
  }

  changeStat(ti, stat, delta, src) {
    const m = this.mon(ti);
    if (m.hp <= 0) return false;
    const v = this.sides[ti].vol;
    if (stat === 'crit') {
      if (v.crit >= 2) { this.txt('Ale nepodařilo se to!'); return false; }
      v.crit = Math.min(3, v.crit + delta);
      this.txt(`${this.N(ti)} se soustředí!`);
      return true;
    }
    if (delta < 0 && src !== ti && m.ability === 'cista_mysl') {
      this.txt(`${this.N(ti)} má čistou mysl – staty mu nelze snížit!`);
      return false;
    }
    const cur = v.st[stat];
    const nxt = clamp(cur + delta, -6, 6);
    const [label, g] = STAT_INFO[stat];
    if (nxt === cur) {
      this.txt(`${this.N(ti)}: ${label} už ${delta > 0 ? 'výš' : 'níž'} nemůže!`);
      return false;
    }
    v.st[stat] = nxt;
    const verb = delta > 0 ? (g === 'f' ? 'stoupla' : 'stoupl') : (g === 'f' ? 'klesla' : 'klesl');
    this.push({ e: 'stat', side: ti, up: delta > 0 });
    this.txt(`${this.N(ti)}: ${label}${Math.abs(delta) >= 2 ? ' výrazně' : ''} ${verb}!`);
    return true;
  }

  calcDamage(si, ti, mv, eff, opts = {}) {
    const a = this.mon(si);
    const d = this.mon(ti);
    const av = this.sides[si].vol;
    const dv = this.sides[ti].vol;
    if (mv.fx === 'level') return { dmg: eff === 0 ? 0 : a.lvl, crit: false };
    if (typeof mv.fx === 'number') return { dmg: eff === 0 ? 0 : mv.fx, crit: false };
    const as = calcStats(a);
    const ds = calcStats(d);
    const phys = mv.c === 'P';
    let crit = false;
    if (!opts.noCrit && d.ability !== 'krunyr') {
      const stage = Math.min(3, (mv.cr || 0) + av.crit);
      crit = Math.random() < [1 / 24, 1 / 8, 1 / 2, 1][stage];
    }
    const defKey = phys || mv.pdef ? 'def' : 'spd';
    let aStage = phys ? av.st.atk : av.st.spa;
    let dStage = dv.st[defKey];
    if (crit) { aStage = Math.max(0, aStage); dStage = Math.min(0, dStage); }
    let A = (phys ? as.atk : as.spa) * stageMult(aStage);
    let D = ds[defKey] * stageMult(dStage);
    if (phys && a.ability === 'kuraz' && a.status) A *= 1.5;
    if (this.weather === 'sand' && defKey === 'spd' && this.types(ti).includes('stone')) D *= 1.5;

    let power = mv.p;
    if (mv.x2s && d.status) power *= 2;
    const ab = a.ability;
    if (LOW_HP_BOOST[ab] === mv.t && a.hp <= maxHp(a) / 3) power *= 1.5;
    if (ab === 'technik' && power <= 60) power *= 1.5;
    if (ab === 'silna_celist' && hasFlag(mv, 'b')) power *= 1.5;
    if (ab === 'zelezna_pest' && hasFlag(mv, 'p')) power *= 1.2;
    if (ab === 'zapal' && av.flash && mv.t === 'fire') power *= 1.5;

    let dmg = Math.floor(Math.floor((Math.floor((2 * a.lvl) / 5 + 2) * power * A) / Math.max(1, D)) / 50) + 2;
    let mod = 1;
    if (this.weather === 'rain') { if (mv.t === 'water') mod *= 1.5; if (mv.t === 'fire') mod *= 0.5; }
    if (this.weather === 'sun') { if (mv.t === 'fire') mod *= 1.5; if (mv.t === 'water') mod *= 0.5; }
    if (crit) mod *= 1.5;
    mod *= opts.noRandom ? 0.925 : (85 + randInt(0, 15)) / 100;
    if (mv.t && SPECIES[a.s].ty.includes(mv.t)) mod *= ab === 'prizpusobivost' ? 2 : 1.5;
    mod *= eff;
    if (phys && a.status === 'brn' && ab !== 'kuraz') mod *= 0.5;
    if (!crit) {
      const scr = this.sides[ti].screens;
      if ((phys && scr.reflect) || (!phys && scr.screen)) mod *= 0.5;
    }
    if (d.ability === 'tlusta_kuze' && (mv.t === 'fire' || mv.t === 'ice')) mod *= 0.5;
    if (d.ability === 'mnohosupina' && d.hp >= maxHp(d)) mod *= 0.5;
    dmg = Math.floor(dmg * mod);
    if (eff > 0) dmg = Math.max(1, dmg);
    return { dmg, crit };
  }

  confusionDamage(si) {
    const a = this.mon(si);
    const st = calcStats(a);
    const v = this.sides[si].vol;
    const A = st.atk * stageMult(v.st.atk);
    const D = st.def * stageMult(v.st.def);
    const base = Math.floor(Math.floor((Math.floor((2 * a.lvl) / 5 + 2) * 40 * A) / Math.max(1, D)) / 50) + 2;
    return Math.max(1, Math.floor((base * (85 + randInt(0, 15))) / 100));
  }

  applyDamage(ti, dmg, info = {}) {
    const m = this.mon(ti);
    m.hp = Math.max(0, m.hp - Math.max(0, Math.floor(dmg)));
    const mhp = maxHp(m);
    if (info.quiet) this.push({ e: 'hp', side: ti, hp: m.hp, mhp });
    else this.push({ e: 'hit', side: ti, hp: m.hp, mhp, eff: info.eff ?? 1, crit: !!info.crit });
  }

  heal(si, amt) {
    const m = this.mon(si);
    const mhp = maxHp(m);
    m.hp = Math.min(mhp, m.hp + Math.max(0, Math.floor(amt)));
    this.push({ e: 'hp', side: si, hp: m.hp, mhp });
  }

  absorbHeal(ti, verb) {
    const m = this.mon(ti);
    const mh = maxHp(m);
    if (m.hp < mh) {
      this.heal(ti, Math.floor(mh / 4));
      this.txt(`${this.N(ti)} ${verb} a obnovil si HP!`);
    } else this.txt(`${this.N(ti)} ${verb}!`);
  }

  contactEffects(si, ti) {
    const d = this.mon(ti);
    const a = this.mon(si);
    const ab = d.ability;
    if (ab === 'staticky' && chance(30)) this.inflict(si, 'par', true);
    else if (ab === 'plamenne_telo' && chance(30)) this.inflict(si, 'brn', true);
    else if (ab === 'jedovy_trn' && chance(30)) this.inflict(si, 'psn', true);
    if (ab === 'hruba_kuze' && a.hp > 0) {
      this.applyDamage(si, Math.max(1, Math.floor(maxHp(a) / 8)), { quiet: true });
      this.txt(`${this.N(si)} se zranil o hrubou kůži!`);
    }
  }

  endOfTurn() {
    if (this.weather) {
      this.weatherTurns--;
      if (this.weatherTurns <= 0) {
        this.txt(WEATHER_END[this.weather]);
        this.weather = null;
        this.push({ e: 'wx', wx: null });
      } else if (this.weather === 'sand' || this.weather === 'hail') {
        for (const si of this.speedOrder([0, 1])) {
          const m = this.mon(si);
          if (m.hp <= 0) continue;
          const ty = this.types(si);
          const immune = this.weather === 'sand' ? ty.some((t) => t === 'stone' || t === 'earth' || t === 'metal') : ty.includes('ice');
          if (immune) continue;
          this.applyDamage(si, Math.max(1, Math.floor(maxHp(m) / 16)), { quiet: true });
          this.txt(`${this.N(si)} trpí ${this.weather === 'sand' ? 'v písečné bouři' : 'krupobitím'}!`);
        }
        this.checkFaints();
        if (this.over) return;
      }
    }
    for (const si of this.speedOrder([0, 1])) {
      const m = this.mon(si);
      const s = this.sides[si];
      if (m.hp <= 0) continue;
      const mh = maxHp(m);
      if (m.status === 'brn') {
        this.applyDamage(si, Math.max(1, Math.floor(mh / 16)), { quiet: true });
        this.txt(`${this.N(si)} trpí popáleninami!`);
      } else if (m.status === 'psn') {
        this.applyDamage(si, Math.max(1, Math.floor(mh / 8)), { quiet: true });
        this.txt(`${this.N(si)} trpí otravou!`);
      } else if (m.status === 'tox') {
        this.applyDamage(si, Math.max(1, Math.floor((mh * s.vol.tox) / 16)), { quiet: true });
        s.vol.tox = Math.min(15, s.vol.tox + 1);
        this.txt(`${this.N(si)} trpí těžkou otravou!`);
      }
      if (m.hp > 0 && s.vol.seed) {
        const drain = Math.min(m.hp, Math.max(1, Math.floor(mh / 8)));
        this.applyDamage(si, drain, { quiet: true });
        this.txt(`${this.N(si)} ztrácí síly kvůli semínku!`);
        if (this.mon(1 - si).hp > 0) this.heal(1 - si, drain);
      }
      if (m.hp > 0 && m.ability === 'regenerace' && m.hp < mh) {
        this.heal(si, Math.max(1, Math.floor(mh / 16)));
        this.txt(`${this.N(si)} se regeneruje.`);
      }
      if (m.hp > 0 && m.ability === 'vitr_v_zadech') this.changeStat(si, 'spe', 1, si);
    }
    for (const s of this.sides) {
      for (const k of ['reflect', 'screen']) {
        if (s.screens[k] > 0 && --s.screens[k] === 0) this.txt(k === 'reflect' ? 'Odrazná stěna zmizela.' : 'Světelná clona zmizela.');
      }
    }
    this.checkFaints();
  }

  checkFaints() {
    for (const si of [0, 1]) {
      const s = this.sides[si];
      const m = this.mon(si);
      if (m.hp <= 0 && !s.vol.fainted) {
        s.vol.fainted = true;
        m.hp = 0;
        m.status = null;
        m.slp = 0;
        this.push({ e: 'faint', side: si });
        this.txt(`${this.N(si)} omdlel!`);
        this.awardExp(si);
      }
    }
    const dead = [0, 1].filter((si) => this.aliveCount(si) === 0);
    if (dead.length && !this.over) this.end(dead.length === 2 ? null : 1 - dead[0], 'faint');
  }

  awardExp(fsi) {
    const ws = this.sides[1 - fsi];
    if (this.kind === 'pvp' || ws.kind !== 'player') return;
    const foe = this.mon(fsi);
    const sp = SPECIES[foe.s];
    const base = Math.max(1, Math.floor(((sp.xp * foe.lvl) / 7) * (this.kind === 'trainer' ? 1.5 : 1)));
    for (const m of ws.party) {
      if (m.hp <= 0 || m.lvl >= 100) continue;
      const part = ws.participants.has(m.uid);
      const amt = part ? base : this.expShare ? Math.floor(base / 2) : 0;
      if (amt <= 0) continue;
      if (part) gainEvs(m, foe.s);
      this.giveExp(ws, m, amt);
    }
  }

  giveExp(side, m, amt) {
    const isActive = side.party[side.active] === m;
    const before = expFrac(m);
    this.txt(`${monName(m)} získal ${amt} zk. bodů!`);
    const res = gainExp(m, amt);
    this.push({ e: 'exp', uid: m.uid, active: isActive, from: before, to: expFrac(m), ups: res.levels.length });
    for (const L of res.levels) {
      this.leveled.add(m.uid);
      this.push({ e: 'lvl', uid: m.uid, active: isActive, lvl: L.lvl, hp: L.hp, mhp: L.mhp });
      this.txt(`${monName(m)} postoupil na úroveň ${L.lvl}!`);
    }
    for (const mv of res.newMoves) {
      if (m.moves.length < 4) {
        learnMove(m, mv);
        this.txt(`${monName(m)} se naučil ${MOVES[mv].n}!`);
      } else this.pendingLearn.push({ uid: m.uid, move: mv });
    }
  }

  // ---------- předměty ----------
  useItem(si, a) {
    const s = this.sides[si];
    const it = ITEMS[a.item];
    if (!it) return;
    if (it.cat === 'orb') { this.throwOrb(si, a.item); return; }
    if (s.kind === 'ai') this.txt(`${s.name} použil ${it.n}!`);
    else this.txt(`Použil jsi ${it.n}!`);
    const target = s.party[a.target ?? s.active];
    if (!target) return;
    const isActive = target === this.mon(si);
    const name = isActive ? this.N(si) : monName(target);
    const mh = maxHp(target);
    if (it.revive) {
      if (target.hp > 0) return;
      target.hp = Math.max(1, Math.floor(mh * it.revive));
      target.status = null;
      target.slp = 0;
      this.txt(`${name} se probral!`);
      return;
    }
    if (target.hp <= 0) return;
    if (it.heal) {
      const before = target.hp;
      target.hp = Math.min(mh, target.hp + it.heal);
      if (isActive) this.push({ e: 'hp', side: si, hp: target.hp, mhp: mh });
      this.txt(`${name} si obnovil ${target.hp - before} HP.`);
    }
    if (it.cure && target.status && (it.cure.includes('all') || it.cure.includes(target.status))) {
      target.status = null;
      target.slp = 0;
      if (isActive) this.push({ e: 'st', side: si, st: null });
      this.txt(`${name} je vyléčený!`);
    }
    if (it.pp) {
      for (const mv of target.moves) mv.pp = Math.min(MOVES[mv.id].pp, mv.pp + it.pp);
      this.txt(`${name} má obnovené PP.`);
    }
  }

  throwOrb(si, item) {
    const ti = 1 - si;
    const t = this.mon(ti);
    const it = ITEMS[item];
    const sp = SPECIES[t.s];
    this.txt(`Hodil jsi ${it.n}!`);
    let ball = it.ball || 1;
    if (it.quick) ball = this.turn <= 1 ? 5 : 1;
    if (it.dusk) ball = this.env === 'cave' || this.night ? 3 : 1;
    if (it.net) ball = sp.ty.includes('water') || sp.ty.includes('bug') ? 3.5 : 1;
    let shakes = 0;
    let ok = false;
    if (it.master) { ok = true; shakes = 3; } else {
      const mh = maxHp(t);
      const stMul = t.status === 'slp' || t.status === 'frz' ? 2.5 : t.status ? 1.5 : 1;
      const a = (((3 * mh - 2 * t.hp) * sp.cr * ball) / (3 * mh)) * stMul;
      if (a >= 255) { ok = true; shakes = 3; } else {
        const b = 65536 / Math.pow(255 / Math.max(1, a), 3 / 16);
        while (shakes < 4 && Math.random() * 65536 < b) shakes++;
        ok = shakes >= 4;
        shakes = Math.min(3, shakes);
      }
    }
    this.push({ e: 'ball', side: si, item, shakes, ok });
    if (ok) {
      this.txt(`Hurá! ${monName(t)} byl chycen!`);
      this.caught = t;
      this.caughtOrb = item;
      this.end(si, 'catch');
    } else {
      this.txt(['Ach ne! Tvor se osvobodil!', 'Ajaj! Už to vypadalo, že ho máš!', 'Sakra! Bylo to tak blízko!', 'Ach! Málem!'][shakes]);
    }
  }

  // ---------- umělá inteligence ----------
  aiChoose(si) {
    const s = this.sides[si];
    const m = this.mon(si);
    const usable = m.moves.map((mv, i) => ({ mv, i })).filter((x) => x.mv.pp > 0);
    if (!usable.length) return { type: 'move', idx: -1 };
    if (s.ai === 'wild') return { type: 'move', idx: pick(usable).i };
    if (s.ai === 'smart' && m.hp > 0 && m.hp < maxHp(m) * 0.25) {
      for (const k of ['max_lektvar', 'hyper_lektvar', 'super_lektvar', 'lektvar']) {
        if (s.items[k] > 0) { s.items[k]--; return { type: 'item', item: k, target: s.active }; }
      }
    }
    const scored = usable.map((x) => ({ ...x, sc: this.scoreMove(si, x.mv.id) }));
    if (s.ai === 'smart' && Math.random() < 0.85) {
      scored.sort((a, b) => b.sc - a.sc);
      return { type: 'move', idx: scored[0].i };
    }
    return { type: 'move', idx: weightedPick(scored, (x) => Math.pow(Math.max(1, x.sc), 1.5)).i };
  }

  scoreMove(si, id) {
    const mv = MOVES[id];
    const ti = 1 - si;
    const me = this.mon(si);
    const foe = this.mon(ti);
    const fv = this.sides[ti].vol;
    const mvl = this.sides[si].vol;
    const mh = maxHp(me);
    if (mv.c !== 'X') {
      let eff = mv.t ? effectiveness(mv.t, this.types(ti)) : 1;
      const fab = foe.ability;
      if ((mv.t === 'earth' && fab === 'levitace') || (mv.t === 'water' && fab === 'pohlceni_vody') ||
          (mv.t === 'electric' && fab === 'bleskosvod') || (mv.t === 'fire' && fab === 'zapal')) eff = 0;
      if (eff === 0) return 0;
      let { dmg } = this.calcDamage(si, ti, mv, eff, { noRandom: true, noCrit: true });
      if (mv.mh) dmg *= 3;
      const acc = mv.a ? mv.a / 100 : 1;
      let sc = Math.min(1, dmg / Math.max(1, foe.hp)) * 100 * acc;
      if (dmg >= foe.hp) sc += 40 + (mv.pri > 0 ? 30 : 0);
      if (mv.rc) sc *= 0.9;
      if (mv.ko) sc *= me.hp < mh * 0.3 ? 1 : 0.15;
      return sc;
    }
    if (mv.st) {
      if (foe.status) return 0;
      const fs = calcStats(foe);
      const base = { slp: 45, par: 35, tox: 35, brn: fs.atk > fs.spa ? 40 : 20, psn: 25, frz: 20 }[mv.st[0]] || 10;
      return base * (mv.a ? mv.a / 100 : 1);
    }
    if (mv.cf) return fv.conf > 0 ? 0 : 20;
    if (mv.seed) return fv.seed || this.types(ti).includes('plant') ? 0 : 30;
    if (mv.hl) return me.hp < mh * 0.5 ? 60 : 0;
    if (mv.rest) return me.hp < mh * 0.35 && !me.status ? 50 : 0;
    if (mv.pr) return 8;
    if (mv.wx) return this.weather === mv.wx ? 0 : 15;
    if (mv.sc) return this.sides[si].screens[mv.sc] ? 0 : 18;
    if (mv.ss) {
      const k = Object.keys(mv.ss)[0];
      const cur = k === 'crit' ? mvl.crit : mvl.st[k] || 0;
      return me.hp > mh * 0.6 && cur < 2 ? 28 : 3;
    }
    if (mv.fs) {
      const k = Object.keys(mv.fs)[0];
      return fv.st[k] > -2 ? 15 : 2;
    }
    return 5;
  }

  aiReplace(si) {
    const s = this.sides[si];
    const i = s.party.findIndex((m) => m.hp > 0);
    if (i >= 0) this.switchIn(si, i, true);
  }
}

function expFrac(m) {
  return Math.round(expProgressFrac(m) * 1000) / 1000;
}

function expProgressFrac(m) {
  if (m.lvl >= 100) return 1;
  const gr = SPECIES[m.s].gr;
  const cur = expForLevel(gr, m.lvl);
  const next = expForLevel(gr, m.lvl + 1);
  return Math.max(0, Math.min(1, (m.exp - cur) / (next - cur)));
}

// Kontrola, jestli má smysl použít léčivý předmět na daného tvora (sdíleno s mimobojovým použitím).
export function itemUseError(it, target) {
  if (!it || !target) return 'Nelze použít.';
  const mh = maxHp(target);
  if (it.revive) return target.hp > 0 ? 'Tento tvor neomdlel.' : null;
  if (target.hp <= 0) return 'Tento tvor omdlel.';
  if (it.heal && target.hp < mh) return null;
  if (it.cure && target.status && (it.cure.includes('all') || it.cure.includes(target.status))) return null;
  if (it.pp && target.moves.some((m) => m.pp < MOVES[m.id].pp)) return null;
  if (it.rare) return target.lvl >= 100 ? 'Tento tvor už má maximální úroveň.' : null;
  return 'Nebude to mít žádný účinek.';
}
