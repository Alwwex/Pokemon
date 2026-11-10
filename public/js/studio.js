// Dílna tvorů: živý náhled 3D a 2D tvora, úprava popisu `art` a export kódu pro shared/species.js.
import { THREE } from './gfx3d/core.js';
import { buildFromArt, animateCreature, HAT_BUILDERS, parseGLB, prepareCustomModel, instantiateCustom, renderCustomSprite, modelParts, playCreatureAction } from './gfx3d/mon3d.js';
import { drawArt } from './gfx/monart.js';
import { SPECIES, SPECIES_LIST } from '/shared/species.js';
import { ITEMS } from '/shared/items.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);

// Slovník vzhledu (hodnoty, které umí 2D i 3D kreslení) s českými popisky.
const OPTS = {
  b: { label: 'Tělo', none: false, v: { quad: 'čtyřnožec', biped: 'dvounožec', bird: 'pták', larva: 'housenka', blob: 'kulička', bug: 'brouk', jelly: 'medúza', golem: 'golem', fish: 'ryba', ghost: 'duch', shroom: 'houba', wisp: 'plamínek', crab: 'krab' } },
  ear: { label: 'Uši', v: { pointy: 'špičaté', round: 'kulaté', leaf: 'lístky', long: 'dlouhé', fin: 'ploutvičky', tuft: 'chomáčky', bat: 'netopýří' } },
  horn: { label: 'Rohy / hlava', v: { curved: 'zahnuté rohy', nub: 'růžky', antlers: 'parohy', crest: 'hřebínek', antennae: 'tykadla', crown: 'korunka', bud: 'poupě', drill: 'vrták' } },
  tail: { label: 'Ocas', v: { flame: 'plamínek', fluffy: 'chlupatý', thin: 'tenký', leaf: 'lístek', fan: 'vějíř per', paddle: 'pádlo', fin: 'ploutev', pom: 'bambulka', ring: 'kroužkovaný', club: 'palice', devil: 'čertovský' } },
  wing: { label: 'Křídla', v: { feather: 'pernatá', bat: 'netopýří', insect: 'hmyzí', butterfly: 'motýlí', tiny: 'malinká' } },
  back: { label: 'Záda', v: { flames: 'plameny', spikes: 'trny', quills: 'bodliny', mane: 'hříva', leaves: 'listí', moss: 'mech', crystals: 'krystaly', fins: 'ploutve', plates: 'pancíř' } },
  eye: { label: 'Oči', none: false, v: { cute: 'roztomilé', big: 'velké', fierce: 'zamračené', bead: 'korálky', sleepy: 'ospalé', glow: 'zářící' } },
  mouth: { label: 'Pusa', none: false, v: { smile: 'úsměv', grin: 'úšklebek', fang: 'tesáček', teeth: 'zoubky', open: 'otevřená', frown: 'zamračená', beak: 'zobák', none: 'bez pusy' } },
  mark: { label: 'Znak', v: { cheeks: 'tvářičky', spots: 'puntíky', stripes: 'pruhy', bolt: 'blesk', star: 'hvězda', moon: 'měsíc', third: 'třetí oko', cracks: 'praskliny', scales: 'šupiny', belly: 'bříško' } },
};
const EXTRAS = {
  whiskers: 'vousky', nose: 'čumáček', claws: 'drápky', gloves: 'rukavice', scarf: 'šála', bandana: 'čelenka', cape: 'plášť', robe: 'róba',
  beard: 'vousy', pipe: 'dýmka', flower: 'kytička', leaf_head: 'lístek na hlavě', cap: 'kšiltovka', hat_top: 'cylindr', hat_wizard: 'kouzelnický klobouk',
  hat_gnome: 'skřítkovská čepice', headscarf: 'šátek', halo: 'svatozář', snowcap: 'sněhová čepice', glow: 'záře', aura: 'aura', sparks: 'jiskry',
  snowflakes: 'vločky', wisps: 'světýlka', drip: 'kapky', sickle: 'srp',
};
const ORDER = ['b', 'c', 's', 'ear', 'horn', 'tail', 'wing', 'back', 'eye', 'eyeC', 'mouth', 'mark', 'x'];

let key = new URLSearchParams(location.search).get('k') || 'jiskrik';
if (!SPECIES[key]) key = 'jiskrik';
let art = clone(SPECIES[key].art);

function clone(a) { return JSON.parse(JSON.stringify(a)); }

// ---------- 3D náhled ----------
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#87c8f0');
const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 100);
camera.position.set(1.6, 1.5, 3.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 9;
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7a5a, 1.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
sun.position.set(2, 5, 3);
sun.castShadow = true;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshToonMaterial({ color: '#8ad064' }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const holder = new THREE.Group();
scene.add(holder);
let mon = null;
// šipka na zemi: tudy je „předek“ tvora (+Z) – vlastní model otoč tak, aby koukal sem
const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), new THREE.MeshBasicMaterial({ color: '#e8443a' }));
arrow.rotation.set(Math.PI / 2, 0, 0);
arrow.position.set(0, 0.02, 1.38);
arrow.scale.set(1, 1, 0.15);
holder.add(arrow);

function resize() {
  const w = view.clientWidth;
  const h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function rebuild() {
  if (glb) { buildGlbPreview(); updateCode(); return; }
  if (mon) holder.remove(mon);
  mon = buildFromArt(art, { shiny: $('shiny').checked, hat: $('hat').value || null }, key);
  mon.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  holder.add(mon);
  const h = mon.userData.height || 1;
  controls.target.set(0, h * 0.5, 0);
  draw2D();
  updateCode();
}

function draw2D() {
  for (const [id, back] of [['front', false], ['back', true]]) {
    const c = $(id);
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.scale(c.width / 100, c.height / 100);
    drawArt(g, art, { back, shiny: $('shiny').checked, hat: $('hat').value || null });
  }
}

const t0 = performance.now();
function loop() {
  const t = (performance.now() - t0) / 1000;
  if (mon) animateCreature(mon, t, { moving: walkPreview });
  if ($('spin').checked) holder.rotation.y += 0.006;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------- formulář ----------
function sel(name, def) {
  const s = document.createElement('select');
  s.dataset.k = name;
  if (def.none !== false) s.append(new Option('— nic —', ''));
  for (const [v, l] of Object.entries(def.v)) s.append(new Option(l, v));
  return s;
}

function buildForm() {
  const form = $('form');
  form.innerHTML = '';
  for (const k of ['b', 'eye', 'mouth', 'ear', 'horn', 'tail', 'wing', 'back', 'mark']) {
    const lab = document.createElement('label');
    lab.textContent = OPTS[k].label;
    const s = sel(k, OPTS[k]);
    s.addEventListener('change', () => { if (s.value) art[k] = s.value; else delete art[k]; rebuild(); });
    lab.append(s);
    form.append(lab);
  }
  const colors = document.createElement('label');
  colors.textContent = 'Barvy (hlavní, světlá, doplňková, oči)';
  const crow = document.createElement('div');
  crow.className = 'row';
  for (let i = 0; i < 4; i++) {
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.dataset.ci = String(i);
    inp.addEventListener('input', () => {
      if (i < 3) { art.c[i] = inp.value; } else art.eyeC = inp.value;
      rebuild();
    });
    crow.append(inp);
  }
  colors.append(crow);
  form.append(colors);
  const size = document.createElement('label');
  size.textContent = 'Velikost';
  const r = document.createElement('input');
  r.type = 'range';
  r.min = '0.4';
  r.max = '1';
  r.step = '0.01';
  r.id = 'size';
  r.addEventListener('input', () => { art.s = Number(r.value); rebuild(); });
  size.append(r);
  form.append(size);
  const xl = $('xlist');
  xl.innerHTML = '';
  for (const [v, l] of Object.entries(EXTRAS)) {
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = v;
    cb.addEventListener('change', () => {
      const x = new Set(art.x || []);
      if (cb.checked) x.add(v); else x.delete(v);
      art.x = [...x];
      if (!art.x.length) delete art.x;
      rebuild();
    });
    lab.append(cb, ' ', l);
    xl.append(lab);
  }
}

function fillForm() {
  for (const s of document.querySelectorAll('#form select')) s.value = art[s.dataset.k] || '';
  const ins = document.querySelectorAll('#form input[type=color]');
  ins.forEach((inp, i) => { inp.value = i < 3 ? (art.c[i] || art.c[0]) : (art.eyeC || '#3a2a4a'); });
  $('size').value = String(art.s || 0.6);
  for (const cb of document.querySelectorAll('#xlist input')) cb.checked = (art.x || []).includes(cb.value);
}

function artCode(a) {
  const parts = [];
  for (const k of ORDER) {
    if (a[k] == null || (Array.isArray(a[k]) && !a[k].length)) continue;
    if (k === 'c') parts.push(`c: [${a.c.map((x) => `'${x}'`).join(', ')}]`);
    else if (k === 'x') parts.push(`x: [${a.x.map((x) => `'${x}'`).join(', ')}]`);
    else if (k === 's') parts.push(`s: ${Number(a.s).toFixed(2).replace(/0$/, '')}`);
    else parts.push(`${k}: '${a[k]}'`);
  }
  return `art: { ${parts.join(', ')} },`;
}

function updateCode() {
  $('code').value = `// shared/species.js → tvor '${key}' (${SPECIES[key].n}): nahraď řádek art: {…} tímto\n    ${artCode(art)}`;
}

function newSpeciesCode() {
  const sp = SPECIES[key];
  const no = Math.max(...Object.values(SPECIES).map((x) => x.no)) + 1;
  return `  // nový tvor – vlož do objektu SPECIES v shared/species.js (klíč = jméno bez diakritiky)
  novytvor: {
    no: ${no}, n: 'Nový tvor', ty: ['${sp.ty[0]}'], bs: [50, 50, 50, 50, 50, 50], ab: ['${sp.ab[0]}'], cr: 120, xp: 60, gr: 'mf',
    ls: [[1, 'uder'], [1, 'zly_pohled'], [8, 'rychly_vypad']],
    ${artCode(art)}
    d: 'Popis do Atlasu tvorů.',
  },`;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); $('copied').textContent = 'Zkopírováno ✓'; } catch {
    $('code').value = text;
    $('code').select();
    $('copied').textContent = 'Označeno – zkopíruj Ctrl+C';
  }
  setTimeout(() => { $('copied').textContent = ''; }, 2500);
}

function randomArt() {
  const pick = (o, chance = 1) => { const v = Object.keys(o.v); return Math.random() < chance ? v[Math.floor(Math.random() * v.length)] : undefined; };
  const hue = Math.random() * 360;
  const hsl = (h, s, l) => {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  };
  const a = {
    b: pick(OPTS.b), c: [hsl(hue, 0.6, 0.55), hsl((hue + 30) % 360, 0.5, 0.88), hsl((hue + 180) % 360, 0.75, 0.6)], s: Math.round((0.45 + Math.random() * 0.5) * 100) / 100,
    ear: pick(OPTS.ear, 0.6), horn: pick(OPTS.horn, 0.35), tail: pick(OPTS.tail, 0.6), wing: pick(OPTS.wing, 0.2), back: pick(OPTS.back, 0.35),
    eye: pick(OPTS.eye), mouth: pick(OPTS.mouth), mark: pick(OPTS.mark, 0.5),
  };
  const xs = Object.keys(EXTRAS).filter(() => Math.random() < 0.06);
  if (xs.length) a.x = xs;
  for (const k of Object.keys(a)) if (a[k] === undefined) delete a[k];
  return a;
}

// ---------- vlastní 3D model (.glb) ----------
let glb = null; // ArrayBuffer přetaženého souboru
let glbName = '';
let glbParts = [];
let glbAnims = [];
let walkPreview = false;
let glbBusy = false;
let glbAgain = false;
const gcfg = { rotateY: 0, scale: 1, lift: 0, toon: 'auto', outline: true, hide: [], idle: '', walk: '', attack: '' };

function cfgJson() {
  const out = {};
  if (gcfg.rotateY) out.rotateY = gcfg.rotateY;
  if (gcfg.scale !== 1) out.scale = gcfg.scale;
  if (gcfg.lift) out.lift = gcfg.lift;
  if (gcfg.toon !== 'auto') out.toon = gcfg.toon;
  if (!gcfg.outline) out.outline = false;
  if (gcfg.hide.length) out.hide = [...gcfg.hide];
  for (const k of ['idle', 'walk', 'attack']) if (gcfg[k]) out[k] = gcfg[k];
  return out;
}

async function buildGlbPreview() {
  if (glbBusy) { glbAgain = true; return; }
  glbBusy = true;
  try {
    const gltf = await parseGLB(glb.slice(0));
    const cfg = cfgJson();
    const tpl = prepareCustomModel(gltf, key, cfg);
    if (mon) holder.remove(mon);
    mon = instantiateCustom(tpl, { hat: $('hat').value || null });
    holder.add(mon);
    controls.target.set(0, Math.max(0.3, tpl.height * 0.5), 0);
    for (const [id, back] of [['front', false], ['back', true]]) {
      const c = $(id);
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      const img = renderCustomSprite(tpl, c.width, { back, hat: $('hat').value || null });
      if (img) g.drawImage(img, 0, 0);
    }
    const n = glbAnims.length;
    $('glbinfo').innerHTML = `Soubor <b>${escapeHtml(glbName)}</b> · ${glbParts.length} částí · ${n ? `${n} animací` : 'bez animací (tvor bude jen dýchat)'} · ve hře nahradí tvora <b>${escapeHtml(SPECIES[key].n)}</b>.`;
    $('g_cfg').value = `// public/models/${key}.json\n${JSON.stringify(cfg, null, 2)}`;
    for (const el of document.querySelectorAll('.gkey')) el.textContent = key;
  } catch (e) {
    $('glbinfo').textContent = 'Soubor se nepodařilo načíst: ' + e.message;
  } finally {
    glbBusy = false;
    if (glbAgain) { glbAgain = false; buildGlbPreview(); }
  }
}

function escapeHtml(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function openGlb(file) {
  if (!file) return;
  if (!/\.glb$/i.test(file.name)) { $('glbinfo').textContent = 'Potřebuji soubor .glb (glTF Binary).'; $('glbpanel').hidden = false; return; }
  glb = await file.arrayBuffer();
  glbName = file.name;
  Object.assign(gcfg, { rotateY: 0, scale: 1, lift: 0, toon: 'auto', outline: true, hide: [], idle: '', walk: '', attack: '' });
  try {
    const gltf = await parseGLB(glb.slice(0));
    glbParts = modelParts(gltf);
    glbAnims = (gltf.animations || []).map((a) => a.name || '(bez jména)');
  } catch (e) { glbParts = []; glbAnims = []; }
  fillGlbForm();
  $('glbpanel').hidden = false;
  rebuild();
}

function fillGlbForm() {
  $('g_rot').value = String(gcfg.rotateY);
  $('g_rot_v').textContent = `${gcfg.rotateY}°`;
  $('g_scale').value = String(gcfg.scale);
  $('g_scale_v').textContent = `${gcfg.scale}×`;
  $('g_lift').value = String(gcfg.lift);
  $('g_toon').value = String(gcfg.toon);
  $('g_outline').checked = gcfg.outline;
  const parts = $('g_parts');
  parts.innerHTML = '';
  for (const p of glbParts) {
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !gcfg.hide.includes(p.name);
    cb.addEventListener('change', () => {
      gcfg.hide = gcfg.hide.filter((x) => x !== p.name);
      if (!cb.checked) gcfg.hide.push(p.name);
      rebuild();
    });
    lab.append(cb, ' ', p.name || '(bez jména)', p.parent ? ` · ${p.parent}` : '');
    parts.append(lab);
  }
  const an = $('g_anims');
  an.innerHTML = '';
  if (glbAnims.length) {
    const row = document.createElement('div');
    row.className = 'grid';
    for (const [k, label] of [['idle', 'Animace v klidu'], ['walk', 'Animace chůze'], ['attack', 'Animace útoku']]) {
      const lab = document.createElement('label');
      lab.textContent = label;
      const s = document.createElement('select');
      s.append(new Option('automaticky (podle jména)', ''));
      for (const a of glbAnims) s.append(new Option(a, a));
      s.value = gcfg[k];
      s.addEventListener('change', () => { gcfg[k] = s.value; rebuild(); });
      lab.append(s);
      row.append(lab);
    }
    an.append(row);
    const btns = document.createElement('div');
    btns.className = 'row';
    const atk = document.createElement('button');
    atk.textContent = '▶ Zkusit útok';
    atk.addEventListener('click', () => { if (mon) playCreatureAction(mon, 'attack'); });
    const walk = document.createElement('button');
    walk.textContent = '🚶 Chůze zap/vyp';
    walk.addEventListener('click', () => { walkPreview = !walkPreview; });
    btns.append(atk, walk);
    an.append(btns);
  }
}

let glbTimer = 0;
const later = () => { clearTimeout(glbTimer); glbTimer = setTimeout(rebuild, 120); };
$('g_rot').addEventListener('input', () => { gcfg.rotateY = Number($('g_rot').value); $('g_rot_v').textContent = `${gcfg.rotateY}°`; later(); });
$('g_scale').addEventListener('input', () => { gcfg.scale = Number($('g_scale').value); $('g_scale_v').textContent = `${gcfg.scale}×`; later(); });
$('g_lift').addEventListener('input', () => { gcfg.lift = Number($('g_lift').value); later(); });
$('g_toon').addEventListener('change', () => { const v = $('g_toon').value; gcfg.toon = v === 'auto' ? 'auto' : v === 'true'; rebuild(); });
$('g_outline').addEventListener('change', () => { gcfg.outline = $('g_outline').checked; rebuild(); });
$('g_copy').addEventListener('click', async () => {
  const text = JSON.stringify(cfgJson(), null, 2);
  try { await navigator.clipboard.writeText(text); $('g_copied').textContent = 'Zkopírováno ✓'; } catch { $('g_cfg').select(); $('g_copied').textContent = 'Označeno – Ctrl+C'; }
  setTimeout(() => { $('g_copied').textContent = ''; }, 2500);
});
$('g_remove').addEventListener('click', () => { glb = null; walkPreview = false; $('glbpanel').hidden = true; $('glbfile').value = ''; rebuild(); });
$('glbfile').addEventListener('change', (e) => openGlb(e.target.files[0]));
for (const el of [$('drop'), view]) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add(el === view ? 'dragover' : 'over'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover', 'over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('dragover', 'over');
    openGlb(e.dataTransfer.files[0]);
  });
}

// ---------- start ----------
const spSel = $('species');
for (const k of SPECIES_LIST) spSel.append(new Option(`${String(SPECIES[k].no).padStart(3, '0')} ${SPECIES[k].n} (${k})`, k));
spSel.value = key;
spSel.addEventListener('change', () => { key = spSel.value; art = clone(SPECIES[key].art); fillForm(); rebuild(); history.replaceState(null, '', `?k=${key}`); });
const hatSel = $('hat');
hatSel.append(new Option('— bez čepice —', ''));
for (const id of Object.keys(HAT_BUILDERS)) hatSel.append(new Option(ITEMS[id] ? ITEMS[id].n : id, id));
hatSel.addEventListener('change', rebuild);
$('shiny').addEventListener('change', rebuild);
$('bg').addEventListener('change', () => { scene.background = new THREE.Color($('bg').value); });
$('random').addEventListener('click', () => { art = randomArt(); fillForm(); rebuild(); });
$('reset').addEventListener('click', () => { art = clone(SPECIES[key].art); fillForm(); rebuild(); });
$('copy').addEventListener('click', () => copy(artCode(art)));
$('copyNew').addEventListener('click', () => copy(newSpeciesCode()));
buildForm();
fillForm();
resize();
rebuild();
loop();
window.__studioReady = true;
