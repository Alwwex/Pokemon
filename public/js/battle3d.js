// 3D aréna souboje: prostředí podle místa (louka, les, jeskyně, sníh, stadion…), plošinky,
// 3D tvorové a filmová kamera. Logiku souboje a 2D efekty (částice, orb, text) dál řídí
// BattleScene (battle.js) – tahle třída jen převádí její stav na 3D scénu.
import { THREE, GEO, toon, glowTexture, toonGradient, outlineMat } from './gfx3d/core.js';
import { Batch } from './gfx3d/batch.js';
import { buildCreature, animateCreature, playCreatureAction } from './gfx3d/mon3d.js';
import { shade } from './gfx/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const POS = [V(-1.8, 0.09, 1.05), V(1.65, 0.09, -1.9)];
const PLAT = new THREE.CylinderGeometry(1, 1, 1, 40);

const ENV = {
  grass: { sky: ['#6cbcf4', '#d8f0ff'], ground: '#8ad060', plat: '#5f9e44', top: '#9ade74', props: 'meadow', tree: '#3a9a48' },
  town: { sky: ['#7cc6f6', '#e4f4ff'], ground: '#d8c898', plat: '#a89060', top: '#e8d8a8', props: 'town', tree: '#46a84e' },
  water: { sky: ['#6ab8f0', '#d4eeff'], ground: '#4a94dc', plat: '#cdb880', top: '#e8d49a', props: 'water', tree: '#46a84e' },
  forest: { sky: ['#2e6a3e', '#86b878'], ground: '#5e9a48', plat: '#3e7a34', top: '#6eaa52', props: 'forest', tree: '#22703a' },
  swamp: { sky: ['#5a7a68', '#b4c8a8'], ground: '#6a8050', plat: '#4a6034', top: '#7a9058', props: 'swamp', tree: '#3c5e3c' },
  cave: { sky: ['#140f0c', '#3a3028'], ground: '#6a5a4a', plat: '#4a3e34', top: '#7e6c5e', props: 'cave', tree: '#3a3028' },
  snow: { sky: ['#9ac8f0', '#eef8ff'], ground: '#f0f6ff', plat: '#b8cce4', top: '#ffffff', props: 'snow', tree: '#2c6a4c' },
  mountain: { sky: ['#7ab0e0', '#e0eef8'], ground: '#b0a890', plat: '#7e7462', top: '#c8c0a8', props: 'mountain', tree: '#2c6a4c' },
  gym: { sky: ['#2a2440', '#5a5070'], ground: '#c8c0b0', plat: '#8a8274', top: '#e0d8c8', props: 'gym', tree: '#4a4460' },
  castle: { sky: ['#1a1428', '#4a3a5a'], ground: '#6a6a78', plat: '#4a4a58', top: '#8a8a98', props: 'castle', tree: '#3a3048' },
};

function rnd(i, s = 1) {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function skyTexture(c0, c1, night) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, night ? shade(c0, -0.6) : c0);
  grd.addColorStop(1, night ? shade(c1, -0.55) : c1);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class BattleView3D {
  constructor(r3, env, night) {
    this.r3 = r3;
    this.renderer = r3.renderer;
    this.envName = ENV[env] ? env : 'grass';
    this.night = night;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.mons = [null, null];
    this.monKey = ['', ''];
    this.focusRel = null;
    this.focusK = 0;
    this.tmpV = new THREE.Vector3();
    this.buildEnv();
  }

  buildEnv() {
    const E = ENV[this.envName];
    const scene = this.scene;
    const night = this.night;
    scene.background = skyTexture(E.sky[0], E.sky[1], night);
    const indoor = this.envName === 'gym' || this.envName === 'castle' || this.envName === 'cave';
    scene.fog = new THREE.Fog(night ? shade(E.sky[1], -0.55) : E.sky[1], 14, 34);
    const hemi = new THREE.HemisphereLight(night ? '#8a9ae8' : '#ffffff', shade(E.ground, -0.3), night ? 0.8 : indoor ? 1.2 : 1.6);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(night ? '#9aaaff' : '#fff2dc', night ? 0.9 : indoor ? 1.6 : 2.4);
    sun.position.set(-4, 9, 6);
    sun.castShadow = this.renderer.shadowMap.enabled;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    if (this.envName === 'cave') {
      const p = new THREE.PointLight('#ffc890', 30, 14, 1.5);
      p.position.set(0, 4, 2);
      scene.add(p);
    }
    // zem
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshToonMaterial({ color: E.ground, gradientMap: toonGradient() }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.disposables = [ground.geometry];
    const B = new Batch('#1c1424', 0.03);
    // plošinky pod tvory
    for (const p of POS) {
      B.put(PLAT, E.plat, p.x, -0.06, p.z, 1.25, 0.24, 1.25);
      B.put(PLAT, E.top, p.x, 0.065, p.z, 1.15, 0.04, 1.15, 0, { outline: false });
      B.put(PLAT, shade(E.top, -0.08), p.x, 0.07, p.z, 0.9, 0.04, 0.9, 0, { outline: false });
    }
    this.props(B, E);
    for (const m of B.build(scene)) this.disposables.push(m.geometry);
    // vzdálené kopce
    if (!indoor) {
      const hills = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const a = -2.4 + (i / 13) * 1.8 - Math.PI / 2;
        const r = 24 + rnd(i) * 6;
        const h = new THREE.Mesh(GEO.sphereLo, toon(shade(E.tree, 0.1 + rnd(i, 2) * 0.1)));
        h.position.set(Math.cos(a) * r, -1, Math.sin(a) * r);
        h.scale.set(5 + rnd(i, 3) * 4, 3 + rnd(i, 4) * 3, 5);
        hills.add(h);
      }
      scene.add(hills);
    }
    // částice prostředí
    if (this.envName === 'snow' || this.envName === 'mountain' || this.envName === 'cave' || night) {
      const n = this.envName === 'snow' ? 260 : 60;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 1; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const col = this.envName === 'snow' || this.envName === 'mountain' ? '#ffffff' : this.envName === 'cave' ? '#ffd8a0' : '#fff59a';
      this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), size: this.envName === 'snow' ? 0.12 : 0.1, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.motes.userData.fall = this.envName === 'snow' || this.envName === 'mountain';
      scene.add(this.motes);
      this.disposables.push(geo);
    }
  }

  props(B, E) {
    const tree = (x, z, s = 1, col = E.tree) => {
      B.put(GEO.cyl, '#7a4a2a', x, 0.45 * s, z, 0.16 * s, 0.9 * s, 0.16 * s);
      B.put(GEO.sphereLo, col, x, 1.35 * s, z, 0.8 * s, 0.75 * s, 0.8 * s, rnd(x, z) * 3);
      B.put(GEO.sphereLo, shade(col, 0.08), x + 0.3 * s, 1.75 * s, z - 0.1 * s, 0.5 * s, 0.45 * s, 0.5 * s);
    };
    const pine = (x, z, s = 1, snow = false) => {
      B.put(GEO.cyl, '#6a4a2a', x, 0.3 * s, z, 0.13 * s, 0.6 * s, 0.13 * s);
      for (let k = 0; k < 3; k++) {
        B.put(GEO.cone, E.tree, x, (0.9 + k * 0.5) * s, z, (0.8 - k * 0.2) * s, 0.9 * s, (0.8 - k * 0.2) * s);
        if (snow) B.put(GEO.cone, '#ffffff', x, (1.2 + k * 0.5) * s, z, (0.42 - k * 0.1) * s, 0.36 * s, (0.42 - k * 0.1) * s, 0, { outline: false });
      }
    };
    const rock = (x, z, s, col) => B.put(new THREE.IcosahedronGeometry(1, 0), col, x, s * 0.5, z, s * 1.2, s, s, rnd(x, z) * 6);
    const ring = (n, r0, r1, fn, a0 = -2.7, a1 = -0.45) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / (n - 1)) * (a1 - a0) + (rnd(i, 7) - 0.5) * 0.12;
        const r = r0 + rnd(i, 8) * (r1 - r0);
        fn(Math.cos(a) * r, Math.sin(a) * r - 1, i);
      }
    };
    switch (E.props) {
      case 'meadow':
        ring(16, 9, 13, (x, z, i) => tree(x, z, 1 + rnd(i, 9) * 0.5));
        for (let i = 0; i < 40; i++) {
          const x = (rnd(i, 11) - 0.5) * 14;
          const z = (rnd(i, 12) - 0.5) * 9 - 1;
          if (Math.hypot(x - POS[0].x, z - POS[0].z) < 1.5 || Math.hypot(x - POS[1].x, z - POS[1].z) < 1.5) continue;
          B.put(GEO.cone, '#5ab04a', x, 0.15, z, 0.08, 0.32, 0.08, 0, { outline: false });
          if (i % 4 === 0) B.put(GEO.sphereLo, ['#ff6a8a', '#ffd84a', '#ffffff'][i % 3], x + 0.1, 0.22, z, 0.07, 0.04, 0.07, 0, { outline: false });
        }
        break;
      case 'forest':
        ring(26, 6.5, 12, (x, z, i) => tree(x, z, 1.2 + rnd(i, 9) * 0.7, i % 2 ? E.tree : shade(E.tree, 0.12)));
        break;
      case 'swamp':
        ring(14, 7, 12, (x, z, i) => tree(x, z, 1.1 + rnd(i, 9) * 0.5, i % 2 ? E.tree : '#4e744a'));
        for (let i = 0; i < 6; i++) {
          const w = new THREE.CircleGeometry(1, 20);
          B.put(w, '#3e6e60', (rnd(i, 3) - 0.5) * 12, 0.02, -2 - rnd(i, 4) * 5, 1.2 + rnd(i, 5), 1, 0.8 + rnd(i, 6) * 0.6, 0, { rx: -Math.PI / 2, outline: false });
        }
        break;
      case 'town':
        for (let i = 0; i < 5; i++) {
          const x = -8 + i * 4;
          const z = -11 - rnd(i, 2) * 2;
          B.put(GEO.box, '#f2e6cc', x, 1.1, z, 3, 2.2, 2.4);
          B.put(GEO.cone, ['#d0503a', '#4a7ad0', '#4aa84a', '#c8a03a'][i % 4], x, 3.0, z, 2.3, 1.6, 2.3, Math.PI / 4);
        }
        ring(8, 10, 13, (x, z, i) => tree(x, z, 1 + rnd(i, 9) * 0.3), -2.9, -2.4);
        ring(8, 10, 13, (x, z, i) => tree(x, z, 1 + rnd(i, 9) * 0.3), -0.7, -0.2);
        break;
      case 'water': {
        const water = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshToonMaterial({ color: '#3a84d0', gradientMap: toonGradient() }));
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.01;
        this.scene.add(water);
        this.water = water;
        this.disposables.push(water.geometry);
        for (const p of POS) B.put(GEO.cyl, '#cdb880', p.x, -0.3, p.z, 1.5, 0.6, 1.5, 0, { outline: false });
        ring(10, 12, 16, (x, z) => rock(x, z, 0.8 + rnd(x, z) * 0.8, '#8a8a96'));
        break;
      }
      case 'cave':
        for (let i = 0; i < 22; i++) {
          const a = -Math.PI + (i / 21) * Math.PI;
          const r = 8 + rnd(i, 3) * 2;
          B.put(GEO.cone, i % 2 ? '#4c3e36' : '#5a4a40', Math.cos(a) * r, 2.5, Math.sin(a) * r - 1, 1.6, 6 + rnd(i, 4) * 3, 1.6);
        }
        for (let i = 0; i < 6; i++) {
          const x = (rnd(i, 9) - 0.5) * 12;
          const z = -4 - rnd(i, 10) * 4;
          const cm = toon('#9a6ae8', { emissive: '#9a6ae8', emissiveIntensity: 0.6 });
          for (let k = 0; k < 3; k++) B.put(GEO.cylHex, cm, x + k * 0.2, 0.4, z, 0.12, 0.8 + k * 0.3, 0.12, k, { rz: (k - 1) * 0.3 });
        }
        break;
      case 'snow':
        ring(16, 8, 13, (x, z, i) => pine(x, z, 1.1 + rnd(i, 9) * 0.6, true));
        break;
      case 'mountain':
        ring(10, 9, 13, (x, z, i) => rock(x, z, 0.8 + rnd(i, 3) * 1.2, '#8a8478'));
        for (let i = 0; i < 4; i++) B.put(GEO.cone, '#8a9098', -12 + i * 8, 4, -22, 6, 9 + rnd(i) * 4, 6);
        break;
      case 'gym':
        B.put(GEO.box, '#f4f0e6', 0, 0.012, -0.3, 7.2, 0.02, 0.08, 0, { outline: false });
        B.put(GEO.box, '#f4f0e6', 0, 0.012, -0.3, 0.08, 0.02, 7.0, Math.PI / 2 - 0.55, { outline: false });
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI + (i / 7) * Math.PI;
          B.put(GEO.cyl, '#e8e0d0', Math.cos(a) * 9, 3, Math.sin(a) * 9 - 1, 0.45, 6, 0.45);
        }
        B.put(GEO.box, '#5a5070', 0, 4, -11, 26, 8, 0.6, 0, { outline: false });
        break;
      case 'castle':
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI + (i / 7) * Math.PI;
          B.put(GEO.cyl, '#7a7a88', Math.cos(a) * 8, 3, Math.sin(a) * 8 - 1, 0.55, 6, 0.55);
          if (i % 2) B.put(GEO.box, '#5a3a7a', Math.cos(a) * 7.6, 3.4, Math.sin(a) * 7.6 - 1, 0.9, 2.2, 0.06, -a + Math.PI / 2, { outline: false });
        }
        B.put(GEO.box, '#3a3048', 0, 4, -11, 26, 8, 0.6, 0, { outline: false });
        break;
      default:
    }
  }

  // nastavení kamery pro velikost okna; uiH = výška ovládacího panelu dole (px)
  layout(W, H, uiH) {
    this.W = W;
    this.H = H;
    const usable = Math.max(100, H - uiH);
    this.usable = usable;
    this.portrait = H > W * 1.1;
    this.camera.aspect = W / usable;
    this.camera.fov = this.portrait ? 52 : 36;
    this.camera.setViewOffset(W, usable, 0, 0, W, H);
    this.camera.updateProjectionMatrix();
    this.basePos = this.portrait ? V(0.2, 3.4, 8.6) : V(-0.5, 2.5, 6.6);
    this.baseLook = this.portrait ? V(0.1, 0.6, -0.4) : V(0.4, 0.8, -0.6);
  }

  setMon(rel, mon) {
    const key = mon ? `${mon.s}|${mon.shiny ? 1 : 0}|${mon.hat || ''}` : '';
    if (this.monKey[rel] === key) return;
    if (this.mons[rel]) this.scene.remove(this.mons[rel].obj);
    this.mons[rel] = null;
    this.monKey[rel] = key;
    if (!mon) return;
    const obj = buildCreature(mon.s, { shiny: mon.shiny, hat: mon.hat });
    const g = new THREE.Group();
    g.add(obj);
    obj.rotation.y = rel === 0 ? Math.atan2(POS[1].x - POS[0].x, POS[1].z - POS[0].z) : Math.atan2(POS[0].x - POS[1].x + 3.5, POS[0].z - POS[1].z + 3);
    g.position.copy(POS[rel]);
    this.scene.add(g);
    const entry = { obj: g, mon: obj, mats: [], scale: 1, height: 1 };
    this.mons[rel] = entry;
    this.fitMon(entry, rel);
    // vlastní model (.glb) se načítá na pozadí – po načtení znovu změřit a posbírat materiály
    if (obj.userData.ready) obj.userData.ready.then(() => { if (this.mons[rel] === entry) this.fitMon(entry, rel); });
  }

  // velikost tvora v aréně + vlastní kopie materiálů (bílý záblesk, průhlednost) jen pro tuto instanci
  fitMon(entry, rel) {
    const obj = entry.mon;
    if (!entry.copies) entry.copies = new Map(); // původní materiál -> kopie
    if (!entry.recs) entry.recs = new Map(); // kopie -> záznam pro záblesk a průhlednost
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const out = list.map((m) => {
        if (!m || entry.recs.has(m)) return m;
        if (!entry.copies.has(m)) {
          const c = m.clone();
          // clone() nepřenáší úpravy shaderu (obrysy) – předáme je ručně
          c.onBeforeCompile = m.onBeforeCompile;
          c.customProgramCacheKey = m.customProgramCacheKey;
          entry.copies.set(m, c);
          const rec = { m: c, t0: c.transparent, o0: c.opacity ?? 1 };
          if (!o.userData.isOutline && c.emissive) Object.assign(rec, { e: c.emissive.clone(), ei: c.emissiveIntensity });
          entry.recs.set(c, rec);
        }
        return entry.copies.get(m);
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      o.castShadow = !o.userData.isOutline;
    });
    entry.mats = [...entry.recs.values()];
    const h = obj.userData.height || 1;
    const base = rel === 0 ? 1.2 : 1.3;
    entry.scale = base * Math.min(1.35, Math.max(0.75, 1.15 / Math.max(0.55, h)) ** 0.5);
    entry.height = h * entry.scale;
    obj.scale.setScalar(entry.scale);
  }

  focus(rel) {
    this.focusRel = rel;
    if (rel != null && this.mons[rel]) playCreatureAction(this.mons[rel].mon, 'attack');
  }

  // poloha bodu tvora na obrazovce (pro 2D efekty)
  screenOf(rel, frac = 0.45) {
    const m = this.mons[rel];
    const h = m ? m.height : 1.2;
    const p = POS[rel].clone();
    p.y = h * frac + 0.1;
    if (m) p.add(m.obj.position).sub(POS[rel]).setY(h * frac + 0.1 + m.obj.position.y);
    p.project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.W, y: (-p.y * 0.5 + 0.5) * this.H };
  }

  // velikost tvora na obrazovce v px (podle výšky modelu)
  screenSize(rel) {
    const a = this.screenOf(rel, 0);
    const b = this.screenOf(rel, 1);
    return Math.max(40, Math.abs(a.y - b.y) * 1.15);
  }

  pixelToWorld(rel) {
    // kolik světových jednotek odpovídá 1 px v hloubce tvora
    const d = this.camera.position.distanceTo(POS[rel]);
    const visH = 2 * d * Math.tan((this.camera.fov * Math.PI) / 360);
    return visH / this.usable;
  }

  render(now, bs) {
    const t = now / 1000;
    const cam = this.camera;
    // kamera: úvodní nájezd, jemné kývání, přiblížení k útočníkovi, otřesy
    const intro = bs.intro || 0;
    const target = this.basePos.clone();
    const look = this.baseLook.clone();
    target.x += Math.sin(t * 0.25) * 0.25;
    target.y += Math.sin(t * 0.33) * 0.08;
    const want = this.focusRel == null ? 0 : 1;
    this.focusK += (want - this.focusK) * 0.08;
    if (this.focusK > 0.001 && this.focusRel != null) {
      const fp = POS[this.focusRel];
      look.lerp(V(fp.x, 0.8, fp.z), 0.25 * this.focusK);
      target.lerp(V(fp.x * 0.4 + target.x * 0.6, target.y - 0.2, target.z - 0.9), 0.35 * this.focusK);
    }
    if (intro > 0) {
      target.add(V(intro * 3.5, intro * 2.5, intro * 4));
      look.add(V(intro * 1.5, 0, -intro * 1));
    }
    if (bs.shake && bs.shake.until > performance.now()) {
      const a = bs.shake.amp * 0.012;
      target.add(V((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0));
    }
    cam.position.copy(target);
    cam.lookAt(look);
    // tvorové podle stavu 2D „spritů“
    for (const rel of [0, 1]) {
      this.setMon(rel, bs.mons[rel]);
      const m = this.mons[rel];
      if (!m) continue;
      const sp = bs.spr[rel];
      m.obj.visible = !!sp.visible && sp.alpha > 0.3;
      const k = this.pixelToWorld(rel);
      const right = V(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = V(0, 1, 0).applyQuaternion(cam.quaternion);
      let dx = sp.dx || 0;
      if (sp.slide) dx += (rel === 1 ? -1 : 1) * this.W * 0.8 * sp.slide;
      const off = right.multiplyScalar(dx * k).add(up.multiplyScalar(-(sp.dy || 0) * k));
      m.obj.position.copy(POS[rel]).add(off);
      if (m.obj.position.y < POS[rel].y && !(sp.dy > 0)) m.obj.position.y = POS[rel].y;
      m.obj.scale.setScalar(Math.max(0.001, sp.scale));
      const white = sp.white || 0;
      const fade = sp.dy > 0 ? sp.alpha : 1;
      for (const x of m.mats) {
        if (x.e) {
          x.m.emissive.copy(x.e).lerp(new THREE.Color('#ffffff'), white);
          x.m.emissiveIntensity = x.ei + white * 1.4;
        }
        const tr = x.t0 || fade < 0.999;
        if (x.m.transparent !== tr) { x.m.transparent = tr; x.m.needsUpdate = true; }
        x.m.opacity = x.o0 * fade;
      }
      const slp = bs.mons[rel] && bs.mons[rel].status === 'slp';
      animateCreature(m.mon, slp ? t * 0.4 : t, { calm: slp });
    }
    if (this.motes) {
      const a = this.motes.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - (this.motes.userData.fall ? 0.02 : -0.004);
        if (y < 0) y += 7;
        if (y > 7) y -= 7;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    this.renderer.render(this.scene, cam);
  }

  dispose() {
    for (const g of this.disposables) if (g && g.dispose && !Object.values(GEO).includes(g)) g.dispose();
    if (this.scene.background && this.scene.background.dispose) this.scene.background.dispose();
  }
}

export { outlineMat };
