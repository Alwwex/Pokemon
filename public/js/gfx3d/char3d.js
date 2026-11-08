// 3D postavičky (hráči i NPC) ve stylu „chibi“ – velká hlava, malé tělo. Staví se z `look`
// (shared/looks.js): barva kůže, vlasy a účes, triko, kalhoty, čepice a doplňky.
import { THREE, GEO, toon } from './core.js';
import { Batch } from './batch.js';
import { SKINS, lookOf } from '/shared/looks.js';
import { shade } from '../gfx/util.js';

const DIR_ROT = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
export { DIR_ROT };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// Malý stavitel: díly se rovnou sypou do Batch (sloučí se podle materiálu).
class Part {
  constructor() { this.b = new Batch('#1c1424', 0.018); }
  put(geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o = {}) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.b.add(geo, toon(color, o), _m, o.outline !== false);
  }
  sph(c, x, y, z, rx, ry = rx, rz = rx, rot = [0, 0, 0], o) { this.put(GEO.sphere, c, x, y, z, rx, ry, rz, rot[0], rot[1], rot[2], o); }
  hemi(c, x, y, z, rx, ry = rx, rz = rx, rot = [0, 0, 0], o) { this.put(GEO.hemi, c, x, y, z, rx, ry, rz, rot[0], rot[1], rot[2], o); }
  cyl(c, x, y, z, r, h, rot = [0, 0, 0], o) { this.put(GEO.cyl, c, x, y, z, r, h, r, rot[0], rot[1], rot[2], o); }
  cone(c, x, y, z, r, h, rot = [0, 0, 0], o) { this.put(GEO.cone, c, x, y, z, r, h, r, rot[0], rot[1], rot[2], o); }
  box(c, x, y, z, w, h, d, rot = [0, 0, 0], o) { this.put(GEO.box, c, x, y, z, w, h, d, rot[0], rot[1], rot[2], o); }
  geo(g, c, x, y, z, s = [1, 1, 1], rot = [0, 0, 0], o) { this.put(g, c, x, y, z, s[0], s[1], s[2], rot[0], rot[1], rot[2], o); }
  done(name, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    this.b.build(g);
    return g;
  }
}

const RING = new THREE.TorusGeometry(1, 0.12, 6, 20);

function buildChar(look) {
  const L = lookOf(look);
  const x = L.x || [];
  const skin = SKINS[L.skin] || SKINS[1];
  const hair = L.hair;
  const shirt = L.shirt;
  const pants = L.pants;
  const shoe = '#3a2e2e';
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // nohy (otočné v kyčli)
  for (const sx of [-1, 1]) {
    const leg = new Part();
    leg.cyl(pants, 0, -0.12, 0, 0.068, 0.24);
    leg.sph(shoe, 0, -0.25, 0.03, 0.08, 0.06, 0.11);
    body.add(leg.done(sx < 0 ? 'legL' : 'legR', sx * 0.085, 0.3, 0));
  }

  // trup
  const t = new Part();
  const long = x.includes('robe');
  t.sph(pants, 0, 0.33, 0, 0.165, 0.09, 0.13);
  t.cyl(shirt, 0, 0.47, 0, 0.16, 0.26);
  t.sph(shirt, 0, 0.6, 0, 0.16, 0.06, 0.13, [0, 0, 0], { outline: false });
  if (long) t.cone(shirt, 0, 0.3, 0, 0.26, 0.6, [0, 0, 0]);
  if (x.includes('coat')) {
    t.cyl('#f8f8f8', 0, 0.42, -0.01, 0.175, 0.38, [0, 0, 0]);
    t.box(shirt, 0, 0.47, 0.155, 0.12, 0.24, 0.03, [0, 0, 0], { outline: false });
  }
  if (x.includes('apron')) t.box('#f4f0e6', 0, 0.42, 0.15, 0.22, 0.3, 0.03, [0.06, 0, 0]);
  if (x.includes('belt')) t.cyl('#2a2a32', 0, 0.37, 0, 0.168, 0.04, [0, 0, 0], { outline: false });
  if (x.includes('emblem')) t.cyl('#e8c040', 0, 0.5, 0.16, 0.04, 0.02, [Math.PI / 2, 0, 0], { outline: false, basic: true });
  if (x.includes('pack')) {
    t.box('#7a5a3a', 0, 0.5, -0.2, 0.26, 0.3, 0.14);
    t.box('#a8742a', 0, 0.58, -0.28, 0.2, 0.1, 0.04, [0, 0, 0], { outline: false });
  }
  if (x.includes('cape')) {
    const capeCol = shade(shirt, -0.25);
    t.box(capeCol, 0, 0.36, -0.17, 0.36, 0.52, 0.03, [-0.12, 0, 0]);
    t.sph(capeCol, 0, 0.62, -0.08, 0.2, 0.05, 0.12);
  }
  if (x.includes('scarf')) {
    t.geo(RING, '#e8443a', 0, 0.62, 0, [0.15, 0.15, 0.3], [Math.PI / 2, 0, 0]);
    t.box('#e8443a', 0.08, 0.5, -0.14, 0.07, 0.2, 0.03, [0.2, 0, 0.2]);
  }
  body.add(t.done('torso'));

  // paže
  for (const sx of [-1, 1]) {
    const a = new Part();
    a.cyl(x.includes('coat') ? '#f8f8f8' : shirt, 0, -0.08, 0, 0.055, 0.16);
    a.cyl(skin, 0, -0.2, 0, 0.045, 0.1, [0, 0, 0], { outline: false });
    a.sph(skin, 0, -0.26, 0, 0.055);
    const arm = a.done(sx < 0 ? 'armL' : 'armR', sx * 0.2, 0.6, 0);
    arm.rotation.z = sx * 0.12;
    body.add(arm);
  }

  // hlava
  const h = new Part();
  const HY = 0;
  h.sph(skin, 0, HY, 0, 0.25, 0.235, 0.23);
  for (const sx of [-1, 1]) {
    h.sph('#2a1e24', sx * 0.085, HY - 0.01, 0.2, 0.034, 0.05, 0.03, [0, sx * 0.3, 0], { outline: false });
    h.sph('#ffffff', sx * 0.085 - 0.01, HY + 0.012, 0.226, 0.011, 0.014, 0.008, [0, 0, 0], { outline: false, basic: true });
    h.sph('#ff9a9a', sx * 0.15, HY - 0.07, 0.17, 0.035, 0.02, 0.012, [0, sx * 0.6, 0], { outline: false, opacity: 0.6 });
  }
  h.box(shade(skin, -0.35), 0, HY - 0.095, 0.218, 0.04, 0.012, 0.01, [0, 0, 0], { outline: false });
  // vlasy
  const hs = L.hs;
  if (hs !== 4) {
    h.hemi(hair, 0, HY + 0.02, -0.01, 0.268, 0.25, 0.25, [-0.35, 0, 0]);
    h.sph(hair, 0, HY + 0.13, 0.13, 0.2, 0.09, 0.1, [0.5, 0, 0]);
    for (const sx of [-1, 1]) h.sph(hair, sx * 0.21, HY - 0.02, 0.0, 0.07, 0.15, 0.14);
  } else {
    for (const sx of [-1, 1]) h.sph(hair, sx * 0.235, HY - 0.03, -0.05, 0.05, 0.08, 0.1);
  }
  if (hs === 1) {
    for (const [px, py, pz, rx, rz] of [[0, 0.22, 0.05, -0.2, 0], [-0.12, 0.2, 0.0, -0.3, 0.5], [0.12, 0.2, 0.0, -0.3, -0.5], [0, 0.18, -0.13, -1.0, 0], [-0.1, 0.14, -0.14, -1.1, 0.6], [0.1, 0.14, -0.14, -1.1, -0.6]]) {
      h.cone(hair, px, HY + py, pz, 0.07, 0.17, [rx, 0, rz]);
    }
  }
  if (hs === 2) h.sph(hair, 0, HY - 0.12, -0.12, 0.24, 0.26, 0.13);
  if (hs === 3) {
    h.sph(hair, 0, HY + 0.02, -0.26, 0.07);
    h.sph(hair, 0, HY - 0.12, -0.3, 0.075, 0.15, 0.075, [0.3, 0, 0]);
  }
  if (L.hat) {
    h.hemi(L.hat, 0, HY + 0.07, -0.01, 0.262, 0.2, 0.255, [-0.15, 0, 0]);
    h.cyl(shade(L.hat, -0.12), 0, HY + 0.1, 0.21, 0.16, 0.02, [0.18, 0, 0]);
  }
  if (x.includes('glasses')) {
    for (const sx of [-1, 1]) h.geo(RING, '#3a3a48', sx * 0.085, HY - 0.005, 0.225, [0.06, 0.06, 0.1], [0, 0, 0], { outline: false });
    h.box('#3a3a48', 0, HY, 0.228, 0.05, 0.012, 0.012, [0, 0, 0], { outline: false });
  }
  if (x.includes('beard')) h.sph(L.hair === '#e8e8f0' || hs === 4 ? '#e8e8f0' : hair, 0, HY - 0.16, 0.13, 0.16, 0.13, 0.1);
  if (x.includes('crown')) {
    h.cyl('#f4c63a', 0, HY + 0.25, 0, 0.13, 0.08, [0, 0, 0], { metal: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      h.cone('#f4c63a', Math.sin(a) * 0.125, HY + 0.32, Math.cos(a) * 0.125, 0.03, 0.07, [0, 0, 0], { metal: true });
    }
  }
  const head = h.done('head', 0, 0.86, 0);
  body.add(head);
  root.userData.height = 1.15;
  return root;
}

const templates = new Map();
export function buildChar3D(look) {
  const key = typeof look === 'string' ? look : JSON.stringify(look || {});
  let t = templates.get(key);
  if (!t) { t = buildChar(look); templates.set(key, t); }
  const c = t.clone(true);
  c.userData = { ...t.userData };
  return c;
}

// Animace chůze: walk = fáze kroku (0..1 během pohybu), moving = jde-li postava.
export function animateChar(obj, dir, moving, phase, now, lift = 0) {
  const ud = obj.userData;
  if (!ud.parts) {
    ud.parts = {};
    for (const n of ['body', 'legL', 'legR', 'armL', 'armR', 'head']) ud.parts[n] = obj.getObjectByName(n);
    ud.rot = DIR_ROT[dir] || 0;
  }
  const P = ud.parts;
  const target = DIR_ROT[dir] ?? 0;
  // plynulé otočení nejkratší cestou
  let d = target - ud.rot;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ud.rot += d * 0.35;
  if (Math.abs(d) < 0.01) ud.rot = target;
  obj.rotation.y = ud.rot;
  const sw = moving ? Math.sin(phase * Math.PI * 2) : 0;
  const k = moving ? 0.75 : 0;
  if (P.legL) P.legL.rotation.x = sw * 0.7 * k;
  if (P.legR) P.legR.rotation.x = -sw * 0.7 * k;
  if (P.armL) P.armL.rotation.x = -sw * 0.8 * k;
  if (P.armR) P.armR.rotation.x = sw * 0.8 * k;
  if (P.body) P.body.position.y = (moving ? Math.abs(Math.cos(phase * Math.PI * 2)) * 0.04 : Math.sin(now / 500) * 0.006) + lift;
  if (P.head) P.head.rotation.z = moving ? 0 : Math.sin(now / 900 + obj.id) * 0.03;
}
