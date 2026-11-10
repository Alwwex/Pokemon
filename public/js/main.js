// Hlavní řízení klienta: přihlášení, zprávy ze serveru, scény a menu.
import { net } from './net.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { World } from './world.js';
import { Renderer2D } from './render2d.js';
import { openRegionMap } from './regionmap.js';
import { BattleScene } from './battle.js';
import {
  UI, h, dialog, ask, toast, makeMenu, openPanel, pickMon, showSummary, openBag, openDex, openShop, openPC, openTrade,
  starterPick, learnPrompt, evolveScene, monLabel,
} from './ui.js';
import { MAPS } from '/shared/maps/index.js';
import { charSheet } from './gfx/chars.js';
import { monSprite } from './gfx/monart.js';
import { SKINS, HAIR_COLORS, SHIRT_COLORS, PANTS_COLORS } from '/shared/looks.js';
import { SPECIES, SPECIES_LIST } from '/shared/species.js';
import { ITEMS } from '/shared/items.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BADGES = ['', 'Mlýnský kámen', 'Kapka', 'Jiskra', 'Lísteček', 'Lucerna', 'Vločka'];
const BADGE_COLORS = ['', '#a8742a', '#3a7ad8', '#f2c42c', '#4aa84a', '#8a4ad8', '#7ad0f0'];

const canvas = $('game');
const canvas3d = $('game3d');
const app = {
  me: null,
  scene: 'login',
  queue: [],
  processing: false,
  kicked: false,
  reconnecting: false,
  creds: null,
  send: (m) => net.send(m),
  ctx() {
    const me = app.me || { flags: {}, badges: [], trainers: {}, items: {} };
    return { flags: me.flags, badges: me.badges.length, trainers: me.trainers, items: me.items };
  },
  busy: () => app.processing || app.queue.length > 0 || battle.active,
};
app.me = null;
const world = new World({ ...app, me: () => app.me, ctx: () => app.ctx(), send: app.send, busy: () => app.busy() });

// ---------- grafika: 3D (výchozí) nebo klasické 2D ----------
const GFX_KEY = 'monsterra_gfx';
const GFX_NAMES = { '3d': '3D', '3d-low': '3D (rychlé, bez stínů)', '2d': '2D pixel' };
let gfxMode = (() => { try { return localStorage.getItem(GFX_KEY) || '3d'; } catch { return '3d'; } })();
let world3dMod = null;
async function setGfx(mode) {
  let r = null;
  if (mode !== '2d') {
    try {
      if (!world3dMod) world3dMod = await import('./world3d.js');
      if (!world3dMod.webglAvailable()) throw new Error('WebGL není k dispozici');
      if (world.renderer) world.renderer.dispose();
      world.renderer = null;
      r = new world3dMod.Renderer3D(canvas3d, canvas, { quality: mode === '3d-low' ? 'low' : undefined });
      canvas3d.classList.remove('hidden');
    } catch (e) {
      console.warn('3D grafiku se nepodařilo spustit, používám 2D.', e);
      mode = '2d';
    }
  }
  if (!r) {
    if (world.renderer) world.renderer.dispose();
    r = new Renderer2D(canvas);
    canvas3d.classList.add('hidden');
  }
  gfxMode = mode;
  try { localStorage.setItem(GFX_KEY, mode); } catch { /* */ }
  world.setRenderer(r);
}
app.gfxReady = setGfx(gfxMode);
// vlastní 3D modely tvorů (public/models/*.glb) – načíst předem kvůli ikonám v menu a Atlasu
import('./gfx3d/mon3d.js').then((m) => m.preloadCustomModels()).catch(() => { /* bez 3D */ });
app.renderer3d = () => (world.renderer && world.renderer.renderer ? world.renderer : null);
const uiCtx = { me: () => app.me, send: app.send, onShopResult: null, onPC: null };
app.uiCtx = uiCtx;
const battle = new BattleScene(canvas, app);
let tradeUI = null;
let recvSeq = 0;
app.meSeq = 0;

// Stav hráče přichází v různých zprávách; starší snímek nesmí přepsat novější.
function applyMe(m) {
  if (!m || !m.me) return;
  if ((m._seq || 0) >= app.meSeq) {
    app.me = m.me;
    app.meSeq = m._seq || app.meSeq;
    refreshHud();
  }
}

// ---------- hlavní smyčka ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(60, now - last);
  last = now;
  if (app.scene === 'world') {
    if (battle.active) { battle.update(now); battle.draw(now); }
    else { world.update(dt, now); world.draw(now); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- fronta blokujících zpráv ----------
function enqueue(m) {
  app.queue.push(m);
  pump();
}

async function pump() {
  if (app.processing) return;
  app.processing = true;
  try {
    while (app.queue.length) {
      const m = app.queue.shift();
      try { await handleBlocking(m); } catch (e) { console.error('Chyba zpracování', m.t, e); }
    }
  } finally {
    app.processing = false;
  }
}

function faceNpc(npc, dir) {
  const st = world.npcState.get(npc);
  if (st && dir) st.dir = dir;
}

async function runStep(st) {
  switch (st.k) {
    case 'dialog':
      if (st.npc) faceNpc(st.npc, st.face);
      await dialog(st.lines, { name: st.name });
      break;
    case 'exclaim': {
      const s = world.npcState.get(st.npc);
      if (s) s.exclaim = performance.now() + 900;
      audio.sfx('exclaim');
      await sleep(950);
      break;
    }
    case 'starter': {
      const s = await starterPick();
      app.send({ t: 'starter', s });
      break;
    }
    case 'heal': {
      audio.jingle('heal');
      await sleep(1700);
      break;
    }
    case 'hide': {
      const s = world.npcState.get(st.npc);
      if (s) s.hidden = true;
      break;
    }
    default:
  }
}

async function handleBlocking(m) {
  switch (m.t) {
    case 'map': await changeMap(m); break;
    case 'dialog':
      if (m.npc) faceNpc(m.npc, m.face);
      await dialog(m.lines, { name: m.name });
      break;
    case 'seq':
      for (const st of m.steps) await runStep(st);
      break;
    case 'battle_start':
      for (const st of m.pre || []) await runStep(st);
      UI.closeAll();
      input.clear();
      await battle.start(m);
      break;
    case 'battle_ev': if (battle.active) await battle.onEvents(m); break;
    case 'battle_err': if (battle.active) battle.onError(m); break;
    case 'battle_end':
      if (battle.active) await battle.end(m);
      applyMe(m);
      if (world.map) audio.music(world.map.music);
      refreshHud();
      break;
    case 'learn': {
      const idx = await learnPrompt(m.mon, m.move);
      app.send({ t: 'learn', idx });
      break;
    }
    case 'evolve': {
      const ok = await evolveScene(m.from, m.to, m.name, m.shiny);
      app.send({ t: 'evolve', ok });
      if (world.map) audio.music(world.map.music);
      break;
    }
    case 'shop': await openShop(uiCtx, m.items, m.name); uiCtx.onShopResult = null; break;
    case 'pc': await openPC(uiCtx, m); uiCtx.onPC = null; break;
    case 'trade_done': {
      if (tradeUI) { tradeUI.close(); tradeUI = null; }
      applyMe(m);
      audio.jingle('caught');
      await dialog([`Výměna proběhla! Poslal jsi ${monLabel(m.gave)}…`, `…a dostal jsi ${monLabel(m.got)}! Postarej se o něj dobře.`]);
      break;
    }
    case 'challenge': {
      const c = await ask(`${m.from.name} (${m.from.badges} odz.) tě vyzývá k souboji! Přijmeš?`, ['Přijmout', 'Odmítnout']);
      app.send({ t: 'challenge_reply', id: m.from.id, ok: c === 0 });
      break;
    }
    case 'trade_req': {
      const c = await ask(`${m.from.name} ti nabízí výměnu tvorů. Přijmeš?`, ['Přijmout', 'Odmítnout']);
      app.send({ t: 'trade_reply', id: m.from.id, ok: c === 0 });
      break;
    }
    case 'who': if (m.forMap) { if (app.onWhoMap) app.onWhoMap(m.list); } else await showPlayers(m.list); break;
    default:
  }
}

net.on((m) => {
  if (m.me) m._seq = ++recvSeq;
  switch (m.t) {
    case 'auth_ok': onAuth(m); break;
    case 'auth_err': onAuthErr(m); break;
    case 'kicked': app.kicked = true; showLogin(m.msg); break;
    case 'me': applyMe(m); break;
    case 'pos': if (m.map === world.map?.id) world.snapTo(m.x, m.y, m.dir); break;
    case 'p_add': if (world.map) world.addPlayer(m.p); break;
    case 'p_del': world.others.delete(m.id); break;
    case 'p_move': world.movePlayer(m.id, m.x, m.y, m.dir, m.run, m.jump); break;
    case 'p_face': { const o = world.others.get(m.id); if (o) o.dir = m.dir; break; }
    case 'p_state': { const o = world.others.get(m.id); if (o) o.battle = m.battle; break; }
    case 'chat': onChat(m); break;
    case 'online': $('online-n').textContent = m.n; break;
    case 'notice': toast(m.msg); break;
    case 'shop_res': applyMe(m); if (uiCtx.onShopResult) uiCtx.onShopResult(m); break;
    case 'pc': if (uiCtx.onPC) uiCtx.onPC(m); else enqueue(m); break;
    case 'trade':
      if (!tradeUI) tradeUI = openTrade(uiCtx);
      tradeUI.update(m);
      break;
    case 'trade_end':
      if (tradeUI) { tradeUI.close(); tradeUI = null; }
      toast(m.msg || 'Výměna byla zrušena.');
      break;
    case 'pong': break;
    default: enqueue(m);
  }
});

net.onClose(() => {
  if (app.kicked || app.scene === 'login') return;
  reconnect();
});

async function reconnect() {
  if (app.reconnecting) return;
  app.reconnecting = true;
  $('loading').classList.remove('hidden');
  $('loading-msg').textContent = 'Spojení se serverem bylo přerušeno. Znovu se připojuji…';
  for (let i = 0; i < 60; i++) {
    await sleep(Math.min(5000, 1000 + i * 500));
    try {
      await net.connect();
      const saved = loadCreds();
      if (saved) { net.send({ t: 'resume', name: saved.name, token: saved.token }); app.reconnecting = false; return; }
      break;
    } catch { /* další pokus */ }
  }
  app.reconnecting = false;
  showLogin('Nepodařilo se znovu připojit. Přihlas se prosím.');
}

// ---------- přihlášení ----------
function loadCreds() {
  try { return JSON.parse(localStorage.getItem('monsterra_login') || 'null'); } catch { return null; }
}
function saveCreds(c) {
  try { if (c) localStorage.setItem('monsterra_login', JSON.stringify(c)); else localStorage.removeItem('monsterra_login'); } catch { /* ignore */ }
}

function onAuth(m) {
  app.me = m.me;
  app.meSeq = m._seq || 0;
  app.kicked = false;
  saveCreds({ name: m.me.name, token: m.token });
  $('login').classList.add('hidden');
  $('loading').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('chat').classList.remove('hidden');
  $('online-n').textContent = m.online || 1;
  app.queue = [];
  UI.closeAll();
  if (battle.active) battle.destroy();
  app.scene = 'world';
  world.setMap(m.map, m.x, m.y, m.dir, m.players);
  audio.music(world.map.music);
  showBanner(world.map.name);
  refreshHud();
  if (!m.me.flags.intro) setTimeout(() => toast('Promluv si s mámou (stiskni Z nebo A, když stojíš u ní).', 5000), 800);
}

function onAuthErr(m) {
  $('loading').classList.add('hidden');
  if (m.silent) { saveCreds(null); showLogin(); return; }
  $('login-err').textContent = m.msg;
}

function showLogin(msg) {
  app.scene = 'login';
  UI.closeAll();
  if (battle.active) battle.destroy();
  $('login').classList.remove('hidden');
  $('loading').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('chat').classList.add('hidden');
  $('login-err').textContent = msg || '';
  audio.music('title');
}

async function ensureConnected() {
  if (net.connected) return;
  $('loading').classList.remove('hidden');
  $('loading-msg').textContent = 'Připojuji se k serveru…';
  try { await net.connect(); } finally { $('loading').classList.add('hidden'); }
}

const look = { skin: 1, hair: HAIR_COLORS[1], hs: 0, shirt: SHIRT_COLORS[0], pants: PANTS_COLORS[0], hat: SHIRT_COLORS[0] };

function buildLookEditor() {
  const opts = $('look-opts');
  const prev = $('look-preview');
  const draw = () => {
    const g = prev.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, prev.width, prev.height);
    const sheet = charSheet({ ...look });
    const f = Math.floor(performance.now() / 300) % 3;
    g.drawImage(sheet, (f === 1 ? 1 : f === 2 ? 2 : 0) * 16, 0, 16, 20, 8, 0, 80, 100);
  };
  const row = (label, values, key, render) => {
    opts.appendChild(h('span', {}, label));
    const box = h('div', { class: 'swatches' });
    values.forEach((v, i) => {
      const val = key === 'skin' || key === 'hs' ? i : v;
      const b = h('button', { type: 'button', class: 'sw' + (render ? ' txt' : '') + (look[key] === val ? ' sel' : ''), style: render ? '' : `background:${key === 'skin' ? SKINS[i] : v || '#fff'}` }, render ? render(v) : '');
      b.onclick = () => { look[key] = val; box.querySelectorAll('.sw').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); audio.sfx('cursor'); draw(); };
      box.appendChild(b);
    });
    opts.appendChild(box);
  };
  row('Pleť', SKINS, 'skin');
  row('Vlasy', HAIR_COLORS, 'hair');
  row('Účes', ['Krátký', 'Ježek', 'Dlouhý', 'Culík', 'Holá'], 'hs', (v) => v);
  row('Triko', SHIRT_COLORS, 'shirt');
  row('Kalhoty', PANTS_COLORS, 'pants');
  row('Čepice', [null, ...SHIRT_COLORS.slice(0, 7)], 'hat', (v) => (v ? '' : 'bez'));
  // barvy čepice (první volba „bez“)
  const hatBox = opts.lastChild;
  [...hatBox.children].forEach((b, i) => { if (i > 0) { b.classList.remove('txt'); b.style.background = SHIRT_COLORS[i - 1]; } });
  setInterval(draw, 300);
  draw();
}

function setupLogin() {
  for (const t of document.querySelectorAll('.tab')) {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $('form-login').classList.toggle('hidden', t.dataset.tab !== 'login');
      $('form-register').classList.toggle('hidden', t.dataset.tab !== 'register');
      $('login-err').textContent = '';
    };
  }
  $('form-login').onsubmit = async (e) => {
    e.preventDefault();
    audio.init();
    const f = new FormData(e.target);
    $('login-err').textContent = '';
    try {
      await ensureConnected();
      net.send({ t: 'login', name: f.get('name'), pass: f.get('pass') });
      $('loading').classList.remove('hidden');
      $('loading-msg').textContent = 'Přihlašuji…';
    } catch (err) { $('login-err').textContent = err.message; }
  };
  $('form-register').onsubmit = async (e) => {
    e.preventDefault();
    audio.init();
    const f = new FormData(e.target);
    $('login-err').textContent = '';
    try {
      await ensureConnected();
      net.send({ t: 'register', name: f.get('name'), pass: f.get('pass'), look: { ...look } });
      $('loading').classList.remove('hidden');
      $('loading-msg').textContent = 'Vytvářím trenéra…';
    } catch (err) { $('login-err').textContent = err.message; }
  };
  buildLookEditor();
  // animované pozadí s tvory
  const lc = $('login-canvas');
  const sprites = SPECIES_LIST.filter((k) => !SPECIES[k].legend).sort(() => Math.random() - 0.5).slice(0, 7);
  const drawBg = (now) => {
    if (app.scene !== 'login') return requestAnimationFrame(drawBg);
    const W = (lc.width = window.innerWidth);
    const H = (lc.height = window.innerHeight);
    const g = lc.getContext('2d');
    sprites.forEach((s, i) => {
      const size = Math.min(160, W / 6);
      const x = ((i + 0.5) / sprites.length) * W - size / 2;
      const y = H * 0.6 - size * 0.9 + Math.sin(now / 500 + i) * 6 + (i % 2) * H * 0.12;
      g.drawImage(monSprite(s, Math.round(size)), x, y);
    });
    requestAnimationFrame(drawBg);
  };
  requestAnimationFrame(drawBg);
}

// ---------- mapa ----------
async function changeMap(m) {
  const prev = world.map;
  await fade(1, 160);
  world.setMap(m.map, m.x, m.y, m.dir, m.players);
  if (!prev || prev.music !== world.map.music) audio.music(world.map.music);
  if (!prev || prev.id !== world.map.id) showBanner(world.map.name);
  await fade(0, 200);
}

function fade(to, ms) {
  const from = world.fade;
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      world.fade = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step); else resolve();
    };
    step();
  });
}

let bannerTimer = null;
function showBanner(name) {
  const b = $('map-banner');
  b.textContent = name;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 2400);
}

function refreshHud() {
  $('btn-sound').classList.toggle('off', !audio.musicOn);
}

// ---------- interakce ve světě ----------
input.onPress((act, repeat, src) => {
  if (app.scene !== 'world' || UI.isOpen() || battle.active || app.busy()) return false;
  if (act === 'a' && !repeat) { interact(); return true; }
  if ((act === 'b' && src !== 'touch') || act === 'start') { openMainMenu(); return true; }
  if (act === 'chat') { openChat(); return true; }
  return false;
});

async function interact() {
  const p = world.player;
  if (p.moving || world.pending) return;
  const f = world.front();
  const other = world.playerAt(f.x, f.y);
  if (other) return playerMenu(other.id, other.name);
  app.send({ t: 'interact' });
}

async function playerMenu(id, name) {
  const c = await ask(`Trenér ${name}`, ['Vyzvat k souboji', 'Nabídnout výměnu', 'Zpět']);
  if (c === 0) app.send({ t: 'challenge', id });
  else if (c === 1) app.send({ t: 'trade_req', id });
}

// ---------- hlavní menu ----------
function openMainMenu() {
  if (!app.me || UI.isOpen()) return;
  audio.sfx('select');
  const me = app.me;
  const items = [
    { label: 'Tým', act: 'party', disabled: !me.party.length },
    { label: 'Atlas', act: 'dex', disabled: !me.bag.atlas },
    { label: 'Batoh', act: 'bag' },
    { label: 'Mapa regionu', act: 'map' },
    { label: 'Karta trenéra', act: 'card' },
    { label: 'Hráči online', act: 'players' },
    { label: 'Nastavení', act: 'settings' },
    { label: 'Zavřít', act: 'close' },
  ];
  const panel = h('div', { class: 'panel side-menu' });
  let layer;
  const menu = makeMenu(items, {
    onSelect: async (it) => {
      if (it.act === 'close') { layer.close(); return; }
      layer.el.style.display = 'none';
      if (it.act === 'party') await partyMenu();
      else if (it.act === 'dex') await openDex(uiCtx);
      else if (it.act === 'bag') await openBag(uiCtx, { mode: 'world' });
      else if (it.act === 'card') await trainerCard();
      else if (it.act === 'map') await openRegionMap(app, world.map ? world.map.id : null);
      else if (it.act === 'players') { layer.close(); app.send({ t: 'who' }); return; }
      else if (it.act === 'settings') { const out = await settings(); if (out === 'logout') { layer.close(); return; } }
      layer.el.style.display = '';
    },
    onCancel: () => layer.close(),
  });
  panel.appendChild(menu.el);
  layer = openPanel(panel, (act) => menu.key(act), { backdrop: false });
}

async function partyMenu() {
  let start = 0;
  for (;;) {
    const me = app.me;
    const i = await pickMon(me.party, { title: 'Tvůj tým', start });
    if (i < 0) return;
    start = i;
    const m = me.party[i];
    const opts = ['Shrnutí', 'Přesunout', 'Přezdívka'];
    if (m.hat) opts.push(`Sundat čepici (${ITEMS[m.hat] ? ITEMS[m.hat].n : 'čepice'})`);
    opts.push('Zpět');
    const c = await ask(`${monLabel(m)} (úr. ${m.lvl})`, opts);
    if (c === 3 && m.hat) { app.send({ t: 'unhat', uid: m.uid }); await sleep(200); continue; }
    if (c === 0) await showSummary(m);
    else if (c === 1) {
      const j = await pickMon(me.party, { title: `Kam přesunout ${monLabel(m)}?`, start: i });
      if (j >= 0 && j !== i) { app.send({ t: 'swap', a: i, b: j }); await sleep(150); }
    } else if (c === 2) {
      const nick = window.prompt(`Nová přezdívka pro ${monLabel(m)} (prázdné = původní jméno):`, m.nick || '');
      if (nick !== null) { app.send({ t: 'rename', uid: m.uid, nick }); await sleep(150); }
    }
  }
}

function trainerCard() {
  return new Promise((resolve) => {
    const me = app.me;
    const pt = me.playtime || 0;
    const badges = h('div', { class: 'row' });
    for (let i = 1; i <= 6; i++) {
      const has = me.badges.includes(i);
      badges.appendChild(h('div', { title: BADGES[i], style: `width:42px;height:42px;border-radius:50%;border:3px solid #2b2742;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;background:${has ? BADGE_COLORS[i] : '#d8d2e4'};opacity:${has ? 1 : 0.5}` }, has ? '★' : i));
    }
    const prev = h('canvas', { width: 64, height: 80, style: 'image-rendering:pixelated;width:96px;height:120px;background:#86d063;border:3px solid #2b2742;border-radius:10px' });
    const g = prev.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(charSheet(me.look), 0, 0, 16, 20, 0, 0, 64, 80);
    const panel = h('div', { class: 'panel center-panel', style: 'width:min(560px,calc(100vw - 20px))' },
      h('button', { class: 'close-x', onclick: () => close() }, '×'),
      h('h2', {}, 'Karta trenéra'),
      h('div', { class: 'row', style: 'align-items:flex-start' }, prev,
        h('div', {},
          h('div', {}, h('b', {}, me.name), me.flags.champion ? h('span', { class: 'shiny' }, '  ♛ Šampion') : ''),
          h('div', {}, 'Peníze: ', h('span', { class: 'money' }, `${me.money} zl.`)),
          h('div', {}, `Atlas: ${Object.keys(me.dex.seen).length} viděno · ${Object.keys(me.dex.caught).length} chyceno`),
          h('div', {}, `Herní čas: ${Math.floor(pt / 3600)} h ${Math.floor((pt % 3600) / 60)} min`),
          h('div', { class: 'small muted' }, `Souboje: ${me.stats.battles || 0} · výhry: ${me.stats.wins || 0} · chyceno: ${me.stats.caught || 0} · výhry nad hráči: ${me.stats.pvpWins || 0}`))),
      h('h3', {}, 'Odznaky'), badges);
    let layer;
    const close = () => { layer.close(); resolve(); };
    layer = openPanel(panel, (act) => { if (act === 'a' || act === 'b') close(); });
  });
}

async function settings() {
  for (;;) {
    const speeds = { 40: 'pomalý', 22: 'normální', 8: 'rychlý' };
    const c = await ask('Nastavení', [
      `Hudba: ${audio.musicOn ? 'zapnuto' : 'vypnuto'}`,
      `Zvuky: ${audio.sfxOn ? 'zapnuto' : 'vypnuto'}`,
      `Rychlost textu: ${speeds[UI.textSpeed] || 'normální'}`,
      `Grafika: ${GFX_NAMES[gfxMode] || gfxMode}`,
      'Odhlásit se',
      'Zpět',
    ], { cancel: 5 });
    if (c === 0) { audio.setMusic(!audio.musicOn); refreshHud(); }
    else if (c === 1) audio.setSfx(!audio.sfxOn);
    else if (c === 2) UI.textSpeed = UI.textSpeed === 22 ? 8 : UI.textSpeed === 8 ? 40 : 22;
    else if (c === 3) {
      const order = ['3d', '3d-low', '2d'];
      await setGfx(order[(order.indexOf(gfxMode) + 1) % order.length]);
      toast(`Grafika: ${GFX_NAMES[gfxMode]}`);
    } else if (c === 4) {
      const sure = await ask('Opravdu se odhlásit? Hra se ukládá automaticky.', ['Ne', 'Ano']);
      if (sure === 1) {
        saveCreds(null);
        app.kicked = true;
        net.close();
        showLogin('Byl jsi odhlášen. Hra je uložená.');
        return 'logout';
      }
    } else return;
  }
}

async function showPlayers(list) {
  const others = list.filter((p) => !app.me || p.id !== app.me.id);
  if (!others.length) { await dialog([`Online je jen ${list.length === 1 ? 'tvůj trenér' : list.length + ' hráčů'}. Pozvi kamarády!`]); return; }
  const c = await ask(`Hráči online (${list.length}):`, [...others.slice(0, 12).map((p) => `${p.champ ? '♛ ' : ''}${p.name} – ${p.map}${p.battle ? ' ⚔' : ''} (${p.badges} odz.)`), 'Zpět']);
  const p = others[c];
  if (p) await playerMenu(p.id, p.name);
}

// ---------- chat ----------
const chatLog = $('chat-log');
function addChatLine(node) {
  chatLog.appendChild(node);
  while (chatLog.children.length > 60) chatLog.firstChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
}

function onChat(m) {
  const line = h('div', { class: 'chat-line' }, h('b', {}, (m.champ ? '♛ ' : '') + m.name), m.map !== world.map?.id ? h('span', { class: 'where' }, ` [${m.mapName}]`) : '', ': ', m.text);
  addChatLine(line);
  const until = performance.now() + 5000;
  if (app.me && m.id === app.me.id) world.player.bubble = { text: m.text, until };
  else {
    const o = world.others.get(m.id);
    if (o) o.bubble = { text: m.text, until };
    audio.sfx('chat');
  }
}

function openChat() {
  $('chat').classList.add('open');
  const inp = $('chat-input');
  inp.focus();
}

function closeChat() {
  $('chat').classList.remove('open');
  $('chat-input').blur();
  input.clear();
}

$('chat-form').onsubmit = (e) => {
  e.preventDefault();
  const inp = $('chat-input');
  const text = inp.value.trim();
  if (text) app.send({ t: 'chat', text });
  inp.value = '';
  closeChat();
};
$('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeChat(); } e.stopPropagation(); });
$('chat-input').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('chat-input')) $('chat').classList.remove('open'); }, 100));

// ---------- HUD ----------
$('btn-menu').onclick = () => { if (app.scene === 'world' && !battle.active && !UI.isOpen() && !app.busy()) openMainMenu(); };
$('btn-online').onclick = () => { if (app.scene === 'world' && !battle.active && !UI.isOpen() && !app.busy()) app.send({ t: 'who' }); };
$('btn-sound').onclick = () => { audio.init(); audio.setMusic(!audio.musicOn); audio.setSfx(audio.musicOn); refreshHud(); };
$('t-chat') && ($('t-chat').onclick = () => { if (app.scene === 'world') openChat(); });

// ---------- start ----------
window.addEventListener('pointerdown', () => audio.init(), { once: true });
window.addEventListener('keydown', () => audio.init(), { once: true });
input.setupTouch($('touch'));
setupLogin();
setInterval(() => { if (net.connected) net.send({ t: 'ping' }); }, 25000);

(async () => {
  const saved = loadCreds();
  if (saved) {
    try {
      await ensureConnected();
      net.send({ t: 'resume', name: saved.name, token: saved.token });
      $('loading').classList.remove('hidden');
      $('loading-msg').textContent = 'Načítám tvého trenéra…';
      setTimeout(() => { if (app.scene === 'login') $('loading').classList.add('hidden'); }, 6000);
    } catch { showLogin('Server je nedostupný. Zkus to prosím za chvíli.'); }
  } else showLogin();
})();

// pro ladění v konzoli
window.__monsterra = { app, world, battle };
