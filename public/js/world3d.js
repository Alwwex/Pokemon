// 3D renderer světa (three.js). Herní logika zůstává ve World (world.js); tady se jen kreslí:
// terén a budovy (gfx3d/map3d.js), postavy (gfx3d/char3d.js), tvorové (gfx3d/mon3d.js),
// den/noc, počasí, částice a jmenovky na průhledném 2D plátně nad scénou.
import { THREE, XRAY, glowTexture, starTexture, toon, disposeTree } from './gfx3d/core.js';
import { buildMap3D } from './gfx3d/map3d.js';
import { buildChar3D, animateChar, DIR_ROT } from './gfx3d/char3d.js';
import { buildCreature, buildCreatureLite, animateCreature, loadCustomModelList } from './gfx3d/mon3d.js';
import { npcVisible, itemVisible, legendVisible, passable } from '/shared/maps/index.js';
import { DIRS } from '/shared/tiles.js';
import { drawNameTag, drawBubble, playerLabel } from './labels.js';

const TS = 16;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const OUTDOOR = new Set(['town', 'route', 'forest', 'swamp', 'snow', 'mountain']);

const SKY = {
  town: '#9fd8f5', route: '#9fd8f5', forest: '#8fc8b0', swamp: '#9ab09a', snow: '#c8dcf0', mountain: '#b8d0e8',
  cave: '#0a0806', castle: '#141020', interior: '#0c0a14', gym: '#0c0a14',
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function timeOfDay() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 21 || h < 5) return 'night';
  if (h >= 18.5) return 'evening';
  if (h < 7) return 'dawn';
  return 'day';
}

export class Renderer3D {
  constructor(canvas3d, overlay, opts = {}) {
    this.canvas = canvas3d;
    this.overlay = overlay;
    this.og = overlay.getContext('2d');
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.quality = opts.quality || (coarse ? 'low' : 'high');
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.5));
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 220);
    this.camTarget = V(0, 0, 0);
    this.camPos = V(0, 10, 10);
    this.pitch = 0.92;
    try { this.zoom = Number(localStorage.getItem('monsterra_zoom')) || 1; } catch { this.zoom = 1; }
    this.baseDist = 13;
    this.visible = { x0: -8, x1: 8, z0: -6, z1: 5 };

    // světla
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x6a7a5a, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.3);
    this.sun.castShadow = this.quality === 'high';
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.torch = new THREE.PointLight(0xffc880, 0, 9, 1.4);
    this.scene.add(this.torch);

    this.ents = new THREE.Group();
    this.scene.add(this.ents);
    this.fx = new THREE.Group();
    this.scene.add(this.fx);
    this.chars = new Map();
    this.followers = new Map();
    this.items = new Map();
    this.legends = new Map();
    this.particles = [];
    this.mapObj = null;
    this.lastT = performance.now();
    this.lastGrassStep = null;
    this.tod = null;
    this.todCheck = 0;

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.onWheel = (e) => {
      if (e.target !== this.overlay && e.target !== this.canvas) return;
      this.zoom = Math.max(0.6, Math.min(1.7, this.zoom * (e.deltaY > 0 ? 1.08 : 1 / 1.08)));
      try { localStorage.setItem('monsterra_zoom', String(this.zoom)); } catch { /* */ }
      this.updateProjection();
    };
    window.addEventListener('wheel', this.onWheel, { passive: true });
    this.resize();
    loadCustomModelList();
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('wheel', this.onWheel);
    this.clearMap();
    this.renderer.dispose();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.overlay.width = Math.floor(W * dpr);
    this.overlay.height = Math.floor(H * dpr);
    this.dpr = dpr;
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.updateProjection();
  }

  updateProjection() {
    const aspect = this.camera.aspect;
    // na výšku (mobil) víc oddálit, aby bylo vidět aspoň ~9 dlaždic do šířky
    const vfov = aspect < 1 ? 44 : 34;
    this.camera.fov = vfov;
    const needW = aspect < 1 ? 9.5 : 15;
    const fitDist = needW / (2 * Math.tan((vfov * Math.PI) / 360) * aspect);
    this.dist = Math.max(this.baseDist, fitDist) * this.zoom;
    this.camera.updateProjectionMatrix();
    // viditelný obdélník na zemi (pro hlídání okrajů mapy)
    const cam = this.camera;
    const off = V(0, Math.sin(this.pitch), Math.cos(this.pitch)).multiplyScalar(this.dist);
    cam.position.copy(off);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => {
      const v = V(x, y, 0.5).unproject(cam);
      const dir = v.sub(cam.position).normalize();
      const t = -cam.position.y / dir.y;
      return cam.position.clone().add(dir.multiplyScalar(t));
    });
    this.visible = {
      x0: Math.max(pts[0].x, pts[2].x) * 0.5 + Math.min(pts[0].x, pts[2].x) * 0.5,
      x1: Math.min(pts[1].x, pts[3].x) * 0.5 + Math.max(pts[1].x, pts[3].x) * 0.5,
      z0: Math.min(pts[2].z, pts[3].z),
      z1: Math.max(pts[0].z, pts[1].z),
    };
  }

  clearMap() {
    if (this.mapObj) {
      this.scene.remove(this.mapObj.root);
      this.mapObj.root.traverse((o) => {
        if (o.userData.keep) return;
        if (o.isMesh && o.geometry && !o.geometry.userData.shared) {
          // šablony tvorů (sochy) sdílí geometrii – ty nevyhazujeme
          let p = o;
          let keep = false;
          while (p) { if (p.userData.keep) { keep = true; break; } p = p.parent; }
          if (!keep) o.geometry.dispose();
        }
        if (o.material && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose();
      });
      if (this.mapObj.water) this.mapObj.water.uni.uShore.value.dispose();
    }
    this.mapObj = null;
    for (const m of [this.chars, this.followers, this.items, this.legends]) {
      for (const e of m.values()) this.ents.remove(e.obj);
      m.clear();
    }
    for (const p of this.particles) this.fx.remove(p.obj);
    this.particles = [];
    if (this.snow) { this.scene.remove(this.snow.points); this.snow = null; }
    if (this.flies) { this.scene.remove(this.flies.group); this.flies = null; }
  }

  setMap(map, world) {
    this.clearMap();
    this.map = map;
    const t0 = performance.now();
    this.mapObj = buildMap3D(map);
    this.mapObj.root.traverse((o) => { if (o.parent && o.parent.userData && o.parent.userData.keep) o.userData.keep = true; });
    this.scene.add(this.mapObj.root);
    this.buildTimeMs = performance.now() - t0;
    this.buildTiming = this.mapObj.timing;
    const theme = map.theme;
    const outdoor = OUTDOOR.has(theme);
    this.outdoor = outdoor;
    // svítící body (krystaly, léčebný stroj)
    for (const g of this.mapObj.glowSpots) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: g.c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.copy(g.p);
      sp.scale.setScalar(g.s);
      this.mapObj.root.add(sp);
    }
    this.lampGlows = this.mapObj.lamps.map((p) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd070', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.copy(p);
      sp.scale.setScalar(2.2);
      this.mapObj.root.add(sp);
      return sp;
    });
    if (theme === 'snow' || theme === 'mountain') this.makeSnow(theme === 'snow' ? 700 : 260);
    if (theme === 'forest' || theme === 'swamp' || outdoor) this.makeFireflies(theme === 'swamp' ? 26 : theme === 'forest' ? 18 : 12);
    this.tod = null;
    this.applyLighting(world);
    // kamera rovnou na hráče
    const p = world.player;
    this.camTarget.copy(this.clampTarget(V(p.px / TS + 0.5, 0, p.py / TS + 0.5)));
    this.snapCamera = true;
  }

  // ---------- osvětlení podle prostředí a denní doby ----------
  applyLighting() {
    const map = this.map;
    if (!map) return;
    const theme = map.theme;
    const outdoor = OUTDOOR.has(theme);
    const tod = outdoor ? timeOfDay() : 'day';
    this.tod = tod;
    let sky = new THREE.Color(SKY[theme] || '#9fd8f5');
    let hemiI = 1.55;
    let sunI = 2.3;
    let sunC = new THREE.Color('#fff4e0');
    let hemiSky = new THREE.Color('#ffffff');
    let hemiGround = new THREE.Color(theme === 'snow' ? '#a8b8d0' : '#6a7a5a');
    if (theme === 'swamp') { sunI = 1.6; sunC = new THREE.Color('#e8f0d0'); }
    if (theme === 'forest') { sunI = 2.0; }
    if (!outdoor) {
      hemiGround = new THREE.Color('#5a4a3a');
      if (theme === 'cave') { hemiI = 0.5; sunI = 0.35; hemiSky = new THREE.Color('#a89888'); }
      else if (theme === 'castle') { hemiI = 0.95; sunI = 0.9; hemiSky = new THREE.Color('#c8c0e8'); }
      else { hemiI = 1.5; sunI = 1.5; sunC = new THREE.Color('#fff0d8'); }
    }
    if (tod === 'evening') { sunC = new THREE.Color('#ffb070'); sunI *= 0.8; hemiSky = new THREE.Color('#ffd8b0'); sky.lerp(new THREE.Color('#f0a070'), 0.5); }
    if (tod === 'dawn') { sunC = new THREE.Color('#ffe2cc'); sky.lerp(new THREE.Color('#e8b0c0'), 0.25); }
    if (tod === 'night') { sunC = new THREE.Color('#8aa0ff'); sunI = 0.55; hemiI = 0.55; hemiSky = new THREE.Color('#7a8ad8'); sky = new THREE.Color('#141a3a'); }
    this.hemi.intensity = hemiI;
    this.hemi.color.copy(hemiSky);
    this.hemi.groundColor.copy(hemiGround);
    this.sun.intensity = sunI;
    this.sun.color.copy(sunC);
    this.scene.background = sky;
    if (outdoor) this.scene.fog = new THREE.Fog(sky, this.dist + 8, this.dist + 40);
    else this.scene.fog = null;
    if (theme === 'swamp') this.scene.fog = new THREE.Fog(new THREE.Color(tod === 'night' ? '#1a2a26' : '#9ab09a'), this.dist - 2, this.dist + 22);
    const night = tod === 'night' || tod === 'evening';
    const M = this.mapObj.mats;
    M.lamp.emissiveIntensity = night ? 1.2 : 0.15;
    M.window.emissive = new THREE.Color(night ? '#ffc860' : '#000000');
    M.window.emissiveIntensity = night ? 0.9 : 0;
    M.window.color.set(night ? '#ffe0a0' : '#8ccaf0');
    for (const g of this.lampGlows || []) g.material.opacity = night ? 0.6 : 0;
    this.torch.intensity = theme === 'cave' ? 14 : 0;
    this.nightFlies = night || theme === 'swamp' || (theme === 'forest');
  }

  // ---------- počasí a částice ----------
  makeSnow(n) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 34; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 30; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: glowTexture(), size: 0.16, transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.9 });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.snow = { points, n, speed: Array.from({ length: n }, () => 0.6 + Math.random() * 0.9) };
  }

  makeFireflies(n) {
    const group = new THREE.Group();
    const list = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: this.map.theme === 'swamp' ? '#b8ff9a' : '#fff59a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(0.32);
      const home = V(Math.random() * this.map.w, 0.5 + Math.random() * 1.2, Math.random() * this.map.h);
      sp.position.copy(home);
      group.add(sp);
      list.push({ sp, home, ph: Math.random() * 10 });
    }
    this.scene.add(group);
    this.flies = { group, list };
  }

  burstLeaves(x, z, color) {
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), toon(color, { side: THREE.DoubleSide }));
      m.position.set(x + (Math.random() - 0.5) * 0.4, 0.3, z + (Math.random() - 0.5) * 0.4);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.fx.add(m);
      this.particles.push({ obj: m, v: V((Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6), life: 0.7 + Math.random() * 0.3, spin: (Math.random() - 0.5) * 12 });
    }
  }

  puffSmoke(p) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#d8d8e0', transparent: true, opacity: 0.5, depthWrite: false }));
    sp.position.copy(p);
    sp.scale.setScalar(0.3);
    this.fx.add(sp);
    this.particles.push({ obj: sp, v: V(0.15 + Math.random() * 0.1, 0.55, 0), life: 2.2, grow: 0.35, fade: true });
  }

  // ---------- entity ----------
  ent(map, key, make) {
    let e = map.get(key);
    if (!e) {
      e = make();
      e.seen = true;
      map.set(key, e);
      this.ents.add(e.obj);
    }
    e.seen = true;
    return e;
  }

  sweep(map) {
    for (const [k, e] of map) {
      if (!e.seen) { this.ents.remove(e.obj); map.delete(k); } else e.seen = false;
    }
  }

  charEnt(key, look) {
    const lk = typeof look === 'string' ? look : JSON.stringify(look || {});
    const e = this.ent(this.chars, key, () => ({ obj: buildChar3D(look), look: lk }));
    if (e.look !== lk) {
      this.ents.remove(e.obj);
      e.obj = buildChar3D(look);
      e.look = lk;
      this.ents.add(e.obj);
    }
    return e;
  }

  followerEnt(key, lead, ownerPos, dir) {
    if (!lead || !lead.s) return null;
    const sig = `${lead.s}|${lead.shiny ? 1 : 0}|${lead.hat || ''}`;
    let e = this.followers.get(key);
    if (e && e.sig !== sig) { this.ents.remove(e.obj); this.followers.delete(key); e = null; }
    if (!e) {
      const obj = buildCreatureLite(lead.s, { shiny: lead.shiny, hat: lead.hat });
      const h = obj.userData.height || 1;
      const scale = Math.min(0.85, 0.72 / Math.max(0.5, h)) * (0.85 + Math.min(1, h) * 0.25);
      obj.scale.setScalar(scale);
      const back = DIRS[dir] || DIRS.down;
      const pos = ownerPos.clone().add(V(-back.dx * 0.9, 0, -back.dy * 0.9));
      obj.position.copy(pos);
      e = { obj, sig, pos, rot: 0, seen: true };
      this.followers.set(key, e);
      this.ents.add(obj);
    }
    e.seen = true;
    return e;
  }

  updateFollower(e, ownerPos, trail, ownerDir, dt, now) {
    const map = this.map;
    let target;
    if (trail && trail.length) target = V(trail[0].x + 0.5, 0, trail[0].y + 0.5);
    else {
      const d = DIRS[ownerDir] || DIRS.down;
      target = ownerPos.clone().add(V(-d.dx * 0.85, 0, -d.dy * 0.85));
    }
    const dist = e.pos.distanceTo(ownerPos);
    if (dist > 3.5) e.pos.copy(target);
    const before = e.pos.clone();
    e.pos.lerp(target, 1 - Math.exp(-dt * 7.5));
    const mv = e.pos.clone().sub(before);
    const moving = mv.lengthSq() > 1e-6;
    let face = Math.atan2(ownerPos.x - e.pos.x, ownerPos.z - e.pos.z);
    if (moving) face = Math.atan2(mv.x, mv.z);
    let d = face - e.rot;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    e.rot += d * Math.min(1, dt * 10);
    e.obj.rotation.y = e.rot;
    e.obj.position.copy(e.pos);
    const tile = map && map.rows[Math.floor(e.pos.z)] ? map.rows[Math.floor(e.pos.z)][Math.floor(e.pos.x)] : '.';
    e.obj.position.y = tile === '~' ? -0.12 : 0;
    const speed = mv.length() / Math.max(0.001, dt);
    e.walkPh = (e.walkPh || 0) + speed * dt * 2.2;
    animateCreature(e.obj, now / 1000, { hop: speed > 0.4 ? Math.abs(Math.sin(e.walkPh * Math.PI)) * 0.09 : 0, calm: true });
  }

  sync(world, now, dt) {
    const map = world.map;
    const ctx = world.app.ctx();
    const me = world.app.me();
    const p = world.player;
    const t = now / 1000;
    // hráč
    const myPos = V(p.px / TS + 0.5, 0, p.py / TS + 0.5);
    if (me) {
      const e = this.charEnt('me', me.look);
      e.obj.position.copy(myPos);
      const ph = p.moving ? ((p.t / p.dur) * 0.5 + (p.parity ? 0.5 : 0)) : 0;
      animateChar(e.obj, p.dir, p.moving, ph, now);
      e.obj.position.y = (p.lift || 0) / TS * 0.9;
      const lead = me.party && me.party[0];
      const f = lead ? this.followerEnt('me', { s: lead.s, shiny: lead.shiny, hat: lead.hat }, myPos, p.dir) : null;
      if (f) this.updateFollower(f, myPos, world.trail, p.dir, dt, now);
    }
    // ostatní hráči
    for (const [id, o] of world.others) {
      const e = this.charEnt('p:' + id, o.look);
      const pos = V(o.px / TS + 0.5, (o.lift || 0) / TS * 0.9, o.py / TS + 0.5);
      e.obj.position.copy(pos);
      const ph = o.moving ? ((o.t / o.dur) * 0.5 + (o.parity ? 0.5 : 0)) : 0;
      animateChar(e.obj, o.dir, o.moving, ph, now);
      e.obj.position.y = pos.y;
      e.labelPos = pos;
      e.other = o;
      const f = this.followerEnt('p:' + id, o.lead, V(pos.x, 0, pos.z), o.dir);
      if (f) this.updateFollower(f, V(pos.x, 0, pos.z), o.trail, o.dir, dt, now);
    }
    // NPC
    for (const n of map.npcs) {
      if (!npcVisible(n, ctx)) continue;
      const st = world.npcState.get(n.id);
      if (st && st.hidden) continue;
      const e = this.charEnt('n:' + n.id, n.look);
      e.obj.position.set(n.x + 0.5, 0, n.y + 0.5);
      animateChar(e.obj, st ? st.dir : n.dir, false, 0, now);
      e.npc = n;
      e.st = st;
    }
    this.sweep(this.chars);
    this.sweep(this.followers);
    // předměty na zemi
    for (const it of map.items) {
      if (!itemVisible(it, ctx)) continue;
      const e = this.ent(this.items, it.id, () => ({ obj: makeOrb(it.hidden) }));
      e.obj.position.set(it.x + 0.5, 0.22 + Math.sin(t * 2 + it.x) * 0.04, it.y + 0.5);
      e.obj.rotation.y = t * 0.8;
    }
    this.sweep(this.items);
    // legendární tvorové
    map.legends.forEach((lg, i) => {
      if (!legendVisible(lg, ctx)) return;
      const e = this.ent(this.legends, 'l' + i, () => {
        const obj = buildCreature(lg.s);
        const h = obj.userData.height || 1;
        obj.scale.setScalar(Math.min(1.6, 1.7 / Math.max(0.6, h)));
        const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff2c0', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
        aura.scale.setScalar(2.6);
        aura.position.y = 0.8;
        const g = new THREE.Group();
        g.add(obj);
        g.add(aura);
        g.userData.mon = obj;
        return { obj: g };
      });
      e.obj.position.set(lg.x + 0.5, 0, lg.y + 0.5);
      animateCreature(e.obj.userData.mon, t);
    });
    this.sweep(this.legends);
  }

  clampTarget(v) {
    const map = this.map;
    if (!map) return v;
    const vis = this.visible;
    const padX = this.outdoor ? 1.5 : 0.5;
    const padZ = this.outdoor ? 1.5 : 0.5;
    const minX = -vis.x0 - padX;
    const maxX = map.w - vis.x1 + padX;
    const minZ = -vis.z0 - padZ - 0.5;
    const maxZ = map.h - vis.z1 + padZ;
    v.x = minX > maxX ? map.w / 2 : Math.max(minX, Math.min(maxX, v.x));
    v.z = minZ > maxZ ? map.h / 2 + 0.3 : Math.max(minZ, Math.min(maxZ, v.z));
    return v;
  }

  draw(world, now) {
    if (!world.map) return;
    if (this.map !== world.map) this.setMap(world.map, world);
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    const t = now / 1000;
    const p = world.player;
    if (now > this.todCheck) {
      this.todCheck = now + 20000;
      const tod = OUTDOOR.has(this.map.theme) ? timeOfDay() : 'day';
      if (tod !== this.tod) this.applyLighting(world);
    }
    this.sync(world, now, dt);
    const pp = V(p.px / TS + 0.5, 0, p.py / TS + 0.5);

    // kamera
    const target = this.clampTarget(pp.clone());
    if (this.snapCamera) { this.camTarget.copy(target); this.snapCamera = false; } else this.camTarget.lerp(target, 1 - Math.exp(-dt * 7));
    const off = V(0, Math.sin(this.pitch), Math.cos(this.pitch)).multiplyScalar(this.dist);
    this.camera.position.copy(this.camTarget).add(off);
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 0.3, this.camTarget.z);
    XRAY.p.value.set(pp.x, 0.65, pp.z);
    XRAY.c.value.copy(this.camera.position);
    // slunce a stíny jdou s kamerou
    this.sun.position.set(this.camTarget.x - 7, 14, this.camTarget.z + 5);
    this.sun.target.position.copy(this.camTarget);
    this.torch.position.set(pp.x, 1.6, pp.z + 0.3);

    // animace mapy
    const M = this.mapObj;
    if (M.water) M.water.uni.uTime.value = t;
    M.grassUni.uTime.value = t;
    M.grassUni.uPlayer.value.set(pp.x, 0, pp.z);
    if (world.grassStep && world.grassStep !== this.lastGrassStep) {
      this.lastGrassStep = world.grassStep;
      M.grassUni.uStep.value.set(world.grassStep.x + 0.5, 0, world.grassStep.y + 0.5, t);
      this.burstLeaves(world.grassStep.x + 0.5, world.grassStep.y + 0.5, '#5ab04a');
    }
    for (const a of M.anim) a(t);
    if (M.smoke.length && Math.random() < dt * 2.2) this.puffSmoke(M.smoke[Math.floor(Math.random() * M.smoke.length)]);
    // částice
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      q.obj.position.addScaledVector(q.v, dt);
      if (!q.grow) { q.v.y -= 5 * dt; if (q.spin) { q.obj.rotation.x += q.spin * dt; q.obj.rotation.z += q.spin * dt * 0.7; } }
      else { q.obj.scale.addScalar(q.grow * dt); q.obj.material.opacity = Math.max(0, Math.min(0.5, q.life * 0.3)); }
      if (q.life <= 0 || q.obj.position.y < -0.2) { this.fx.remove(q.obj); if (q.obj.geometry && !q.obj.isSprite) q.obj.geometry.dispose(); this.particles.splice(i, 1); }
    }
    if (this.snow) {
      const a = this.snow.points.geometry.attributes.position;
      for (let i = 0; i < this.snow.n; i++) {
        let y = a.getY(i) - this.snow.speed[i] * dt;
        let x = a.getX(i) + Math.sin(t + i) * 0.3 * dt;
        if (y < 0) y += 12;
        a.setXY(i, x, y);
      }
      a.needsUpdate = true;
      this.snow.points.position.set(this.camTarget.x, 0, this.camTarget.z - 2);
    }
    if (this.flies) {
      for (const f of this.flies.list) {
        f.sp.position.set(f.home.x + Math.sin(t * 0.5 + f.ph) * 1.2, f.home.y + Math.sin(t * 1.3 + f.ph * 2) * 0.3, f.home.z + Math.cos(t * 0.4 + f.ph) * 1.2);
        f.sp.material.opacity = this.nightFlies ? 0.5 + Math.sin(t * 3 + f.ph) * 0.4 : 0;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(world, now);
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.overlay.width, y: (-p.y * 0.5 + 0.5) * this.overlay.height, z: p.z };
  }

  drawOverlay(world, now) {
    const g = this.og;
    const W = this.overlay.width;
    const H = this.overlay.height;
    g.clearRect(0, 0, W, H);
    const fs = Math.max(12, Math.round(13 * this.dpr));
    for (const [id, o] of world.others) {
      const e = this.chars.get('p:' + id);
      if (!e) continue;
      const s = this.project(e.obj.position.clone().add(V(0, 1.42, 0)));
      if (s.z > 1) continue;
      const l = playerLabel(o);
      drawNameTag(g, s.x, s.y, l.text, l.color, fs);
      if (o.bubble && o.bubble.until > now) drawBubble(g, s.x, s.y - fs - 4, o.bubble.text, fs);
    }
    const p = world.player;
    const me = this.chars.get('me');
    if (me && p.bubble && p.bubble.until > now) {
      const s = this.project(me.obj.position.clone().add(V(0, 1.4, 0)));
      drawBubble(g, s.x, s.y, p.bubble.text, fs);
    }
    for (const n of world.map.npcs) {
      const st = world.npcState.get(n.id);
      if (!st || st.exclaim <= now) continue;
      const s = this.project(V(n.x + 0.5, 1.55, n.y + 0.5));
      const k = this.dpr * 1.6;
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#2b2742';
      g.lineWidth = 2 * this.dpr;
      g.beginPath();
      g.roundRect(s.x - 7 * k, s.y - 22 * k, 14 * k, 20 * k, 4 * k);
      g.fill();
      g.stroke();
      g.fillStyle = '#e8443a';
      g.fillRect(s.x - 1.6 * k, s.y - 19 * k, 3.2 * k, 9 * k);
      g.fillRect(s.x - 1.6 * k, s.y - 8 * k, 3.2 * k, 3.2 * k);
    }
    if (world.fade > 0) { g.fillStyle = `rgba(0,0,0,${world.fade})`; g.fillRect(0, 0, W, H); }
  }
}

function makeOrb(hidden) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(hidden ? '#8a4ad8' : '#3a7ad8'));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#f4f4f8'));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 20), toon('#f2c442'));
  band.rotation.x = Math.PI / 2;
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), toon('#f2c442'));
  btn.position.z = 0.15;
  g.add(top, bot, band, btn);
  for (const m of [top, bot]) m.castShadow = true;
  const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  shine.scale.setScalar(0.18);
  shine.position.set(0.12, 0.16, 0.08);
  g.add(shine);
  return g;
}

export { DIR_ROT, passable, disposeTree };
