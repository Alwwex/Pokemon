// Procedurální 3D modely tvorů z popisu `art` (shared/species.js) + vlastní modely .glb.
//
// Každý tvor se staví z jednoduchých tvarů (koule, válce, kužele…) s kreslenými barvami a obrysem.
// Pokud ve složce public/models existuje soubor <druh>.glb, použije se místo procedurálního modelu.
import { THREE, toon, GEO, addOutlines, outlineMat, glowTexture, starTexture } from './core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES } from '/shared/species.js';
import { shade, mix, hueShift, hexToRgb } from '../gfx/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const BONE = '#f1e4c8';
const DARK = '#1c1424';
const RING = new THREE.TorusGeometry(1, 0.05, 6, 28);
const OCTA = new THREE.OctahedronGeometry(1, 0);
// plamen ve tvaru kapky (výška 1, základna v 0)
const FLAME = new THREE.LatheGeometry([
  new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0.06), new THREE.Vector2(0.45, 0.2), new THREE.Vector2(0.44, 0.38),
  new THREE.Vector2(0.3, 0.6), new THREE.Vector2(0.14, 0.82), new THREE.Vector2(0, 1),
], 14);

function shinyColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  if (Math.max(r, g, b) - Math.min(r, g, b) < 40) return mix(hex, '#f0c050', 0.5);
  return hueShift(hex, 155, 1.05);
}

export function creatureColors(spec, shiny) {
  let [main, sec, acc] = spec.c;
  acc = acc || main;
  if (shiny) { main = shinyColor(main); sec = shinyColor(sec); acc = shinyColor(acc); }
  return { main, sec, acc, line: mix(shade(main, -0.7), DARK, 0.55), dark: shade(main, -0.18) };
}

// ---------- stavebnice ----------
class Kit {
  constructor(c) {
    this.c = c;
    this.root = new THREE.Group();
  }
  mesh(geo, color, parent, pos, scale, rot, o) {
    const m = new THREE.Mesh(geo, toon(color, o));
    if (pos) m.position.copy(pos);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    if (o && o.noOutline) m.userData.noOutline = true;
    (parent || this.root).add(m);
    return m;
  }
  sph(color, parent, x, y, z, rx, ry = rx, rz = rx, rot, o) { return this.mesh(GEO.sphere, color, parent, V(x, y, z), [rx, ry, rz], rot, o); }
  hemi(color, parent, x, y, z, rx, ry = rx, rz = rx, rot, o) { return this.mesh(GEO.hemi, color, parent, V(x, y, z), [rx, ry, rz], rot, o); }
  box(color, parent, x, y, z, w, h, d, rot, o) { return this.mesh(GEO.box, color, parent, V(x, y, z), [w, h, d], rot, o); }
  cyl(color, parent, x, y, z, r, h, rot, o) { return this.mesh(GEO.cyl, color, parent, V(x, y, z), [r, h, r], rot, o); }
  cone(color, parent, x, y, z, r, h, rot, o) { return this.mesh(GEO.cone, color, parent, V(x, y, z), [r, h, r], rot, o); }
  // válec mezi dvěma body
  limb(color, parent, a, b, r, o) {
    const d = b.clone().sub(a);
    const len = d.length();
    const m = this.mesh(GEO.cyl, color, parent, a.clone().add(b).multiplyScalar(0.5), [r, len, r], null, o);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    return m;
  }
  // kužel s podstavou v bodě `base` mířící směrem `dir`
  spike(color, parent, base, dir, r, h, o) {
    const n = dir.clone().normalize();
    const m = this.mesh(GEO.cone, color, parent, base.clone().add(n.clone().multiplyScalar(h / 2)), [r, h, r], null, o);
    m.quaternion.setFromUnitVectors(UP, n);
    return m;
  }
  tube(color, parent, pts, r, o) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 20, r, 8, false);
    const m = new THREE.Mesh(geo, toon(color, o));
    m.castShadow = true;
    (parent || this.root).add(m);
    // zakulacené konce
    this.sph(color, parent, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[pts.length - 1].z, r);
    return m;
  }
  group(parent, x = 0, y = 0, z = 0, name) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (name) g.name = name;
    (parent || this.root).add(g);
    return g;
  }
}

// bod na přední ploše elipsoidu hlavy
function onHead(A, x, y, push = 0) {
  const h = A.head;
  const k = 1 - (x / h.rx) ** 2 - (y / h.ry) ** 2;
  const z = h.rz * Math.sqrt(Math.max(0.02, k));
  const p = V(x, y, z);
  const n = V(x / (h.rx * h.rx), y / (h.ry * h.ry), z / (h.rz * h.rz)).normalize();
  return { p: p.add(n.clone().multiplyScalar(push)), n };
}

function faceTo(m, n) {
  m.quaternion.setFromUnitVectors(V(0, 0, 1), n);
}

// ---------- tělesné typy ----------
const BODIES = {
  quad(k, c, m) {
    const hr = 0.32 - m * 0.06;
    const head = k.group(null, 0, 0.84 - m * 0.04, 0.36 + m * 0.06, 'head');
    const A = {
      head: { g: head, rx: hr * 1.05, ry: hr * 0.95, rz: hr }, eyeX: hr * 0.4, eyeY: hr * 0.12, mouthY: -hr * 0.42, earX: hr * 0.62, earY: hr * 0.72,
      top: V(0, hr * 0.92, 0), tail: { pos: V(0, 0.56, -0.5 - m * 0.06), dir: V(0, 0.75, -0.65) },
      body: { pos: V(0, 0.48, 0), rx: 0.42 + m * 0.06, ry: 0.3 + m * 0.02, rz: 0.52 + m * 0.1 },
      back: { a: V(0, 0.78, 0.15), b: V(0, 0.76, -0.4) }, neck: { pos: V(0, 0.72, 0.3), r: 0.24 },
      hands: [V(-0.24, 0.05, 0.34), V(0.24, 0.05, 0.34)], feet: [], wing: { x: 0.3, y: 0.7, z: -0.05 }, muzzle: true,
    };
    const b = A.body;
    k.sph(c.main, null, 0, b.pos.y, 0, b.rx, b.ry, b.rz);
    k.sph(c.sec, null, 0, 0.4, 0.14, b.rx * 0.7, b.ry * 0.7, b.rz * 0.7, null, { noOutline: true });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (b.rx * 0.58);
        const z = sz * (b.rz * 0.58);
        k.cyl(sz > 0 ? c.main : c.dark, null, x, 0.2, z, 0.085 + m * 0.02, 0.4);
        k.sph(c.sec, null, x, 0.04, z + 0.03, 0.1 + m * 0.02, 0.06, 0.12);
      }
    }
    k.sph(c.main, head, 0, 0, 0, A.head.rx, A.head.ry, A.head.rz);
    k.sph(c.sec, head, 0, -hr * 0.3, hr * 0.72, hr * 0.52, hr * 0.38, hr * 0.42);
    return A;
  },
  biped(k, c, m) {
    const hr = 0.31 - m * 0.05;
    const head = k.group(null, 0, 1.18 + m * 0.04, 0.03, 'head');
    const A = {
      head: { g: head, rx: hr * 1.05, ry: hr, rz: hr * 0.95 }, eyeX: hr * 0.4, eyeY: hr * 0.08, mouthY: -hr * 0.42, earX: hr * 0.66, earY: hr * 0.7,
      top: V(0, hr, 0), tail: { pos: V(0, 0.4, -0.26), dir: V(0.3, 0.5, -0.8) },
      body: { pos: V(0, 0.64, 0), rx: 0.33 + m * 0.06, ry: 0.4 + m * 0.05, rz: 0.29 + m * 0.03 },
      back: { a: V(0, 1.0, -0.12), b: V(0, 0.55, -0.3) }, neck: { pos: V(0, 0.98, 0.02), r: 0.22 },
      hands: [V(-0.42 - m * 0.05, 0.42, 0.06), V(0.42 + m * 0.05, 0.42, 0.06)], feet: [V(-0.15, 0.03, 0.14), V(0.15, 0.03, 0.14)], wing: { x: 0.22, y: 0.85, z: -0.2 },
    };
    const b = A.body;
    for (const sx of [-1, 1]) {
      k.cyl(c.dark, null, sx * 0.15, 0.17, 0, 0.1 + m * 0.02, 0.32);
      k.sph(c.sec, null, sx * 0.15, 0.04, 0.06, 0.12, 0.07, 0.17);
    }
    k.sph(c.main, null, 0, b.pos.y, 0, b.rx, b.ry, b.rz);
    k.sph(c.sec, null, 0, b.pos.y - 0.04, b.rz * 0.55, b.rx * 0.68, b.ry * 0.72, b.rz * 0.5, null, { noOutline: true });
    for (const sx of [-1, 1]) {
      const arm = k.group(null, sx * (b.rx * 0.95), 0.82, 0, sx < 0 ? 'armL' : 'armR');
      arm.rotation.z = sx * 0.45;
      k.cyl(c.main, arm, 0, -0.17, 0, 0.075 + m * 0.02, 0.34);
      k.sph(c.main, arm, 0, -0.36, 0.02, 0.09 + m * 0.02);
    }
    k.sph(c.main, head, 0, 0, 0, A.head.rx, A.head.ry, A.head.rz);
    return A;
  },
  bird(k, c, m) {
    const head = k.group(null, 0, 1.06 + m * 0.04, 0.06, 'head');
    const hr = 0.26;
    const A = {
      head: { g: head, rx: hr, ry: hr, rz: hr }, eyeX: hr * 0.42, eyeY: hr * 0.18, mouthY: -hr * 0.15, earX: hr * 0.6, earY: hr * 0.75,
      top: V(0, hr, 0), tail: { pos: V(0, 0.42, -0.36), dir: V(0, 0.2, -1) },
      body: { pos: V(0, 0.62, 0), rx: 0.35 + m * 0.04, ry: 0.42, rz: 0.37 }, back: { a: V(0, 0.95, -0.1), b: V(0, 0.6, -0.36) },
      neck: { pos: V(0, 0.9, 0.04), r: 0.22 }, hands: [], feet: [V(-0.12, 0.03, 0.12), V(0.12, 0.03, 0.12)], wing: { x: 0.33, y: 0.72, z: -0.02 }, beak: true,
    };
    const b = A.body;
    k.sph(c.main, null, 0, b.pos.y, 0, b.rx, b.ry, b.rz);
    k.sph(c.sec, null, 0, 0.56, 0.19, b.rx * 0.72, b.ry * 0.72, b.rz * 0.55, null, { noOutline: true });
    for (const sx of [-1, 1]) {
      k.cone('#f2a93a', null, sx * 0.12, 0.1, 0.1, 0.06, 0.2, [0, 0, Math.PI]);
      k.sph('#f2a93a', null, sx * 0.12, 0.02, 0.15, 0.08, 0.03, 0.1);
    }
    k.sph(c.main, head, 0, 0, 0, hr);
    return A;
  },
  fish(k, c, m, spec) {
    const head = k.group(null, 0, 0, 0, 'head');
    const A = {
      head: { g: head, rx: 0.27, ry: 0.32, rz: 0.56 }, eyes3d: [V(-0.21, 0.72, 0.36), V(0.21, 0.72, 0.36)], mouth3d: V(0, 0.56, 0.56),
      top: V(0, 0.95, 0.12), tail: null, body: { pos: V(0, 0.62, 0), rx: 0.27, ry: 0.32, rz: 0.56 },
      back: { a: V(0, 0.95, 0.1), b: V(0, 0.9, -0.25) }, neck: { pos: V(0, 0.62, 0.32), r: 0.3 }, hands: [], feet: [], float: 0.18, fish: true,
    };
    head.position.set(0, 0.62, 0);
    head.userData.fishHead = true;
    k.sph(c.main, null, 0, 0.62, 0, 0.27, 0.33, 0.56);
    k.sph(c.sec, null, 0, 0.5, 0.06, 0.22, 0.2, 0.45, null, { noOutline: true });
    const tail = k.group(null, 0, 0.62, -0.5, 'tail');
    const fin = k.cone(c.acc, tail, 0, 0, -0.16, 0.3, 0.36, [-Math.PI / 2, 0, 0]);
    fin.scale.x = 0.06;
    const dorsal = k.cone(c.acc, null, 0, 1.0, -0.06, 0.2, 0.24, [0.25, 0, 0]);
    dorsal.scale.x = 0.06;
    for (const sx of [-1, 1]) k.sph(c.acc, null, sx * 0.27, 0.5, 0.12, 0.03, 0.08, 0.14, [0, 0, sx * 0.4]);
    if (spec.mark === 'scales') for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.sph(shade(c.main, -0.12), null, sx * 0.24, 0.62 + (i % 2) * 0.08, 0.2 - i * 0.15, 0.03, 0.06, 0.06, null, { noOutline: true });
    return A;
  },
  larva(k, c, m, spec) {
    const head = k.group(null, 0, 0.52, 0.22, 'head');
    const A = {
      head: { g: head, rx: 0.3, ry: 0.29, rz: 0.28 }, eyeX: 0.11, eyeY: 0.06, mouthY: -0.12, earX: 0.17, earY: 0.2,
      top: V(0, 0.28, 0), tail: null, body: { pos: V(0, 0.25, -0.3), rx: 0.22, ry: 0.22, rz: 0.4 },
      back: { a: V(0, 0.45, -0.1), b: V(0, 0.35, -0.55) }, neck: { pos: V(0, 0.35, 0.12), r: 0.2 }, hands: [], feet: [],
    };
    const segs = [[0, 0.17, -0.62, 0.17], [0, 0.21, -0.38, 0.21], [0, 0.25, -0.1, 0.24]];
    for (const [x, y, z, r] of segs) {
      k.sph(c.main, null, x, y, z, r);
      if (spec.mark === 'spots') k.sph(c.acc, null, x, y + r * 0.82, z, r * 0.3, r * 0.15, r * 0.3, null, { noOutline: true });
      for (const sx of [-1, 1]) k.sph(c.line, null, sx * r * 0.6, 0.03, z, 0.04, 0.04, 0.04, null, { noOutline: true });
    }
    k.sph(c.main, head, 0, 0, 0, 0.3, 0.29, 0.28);
    k.sph(c.sec, head, 0, -0.08, 0.15, 0.2, 0.15, 0.15, null, { noOutline: true });
    return A;
  },
  blob(k, c) {
    const head = k.group(null, 0, 0.48, 0, 'head');
    const A = {
      head: { g: head, rx: 0.55, ry: 0.45, rz: 0.5 }, eyeX: 0.17, eyeY: 0.06, mouthY: -0.1, earX: 0.3, earY: 0.32,
      top: V(0, 0.44, 0), tail: null, body: { pos: V(0, 0.42, 0), rx: 0.55, ry: 0.45, rz: 0.5 }, back: { a: V(0, 0.85, 0), b: V(0, 0.7, -0.35) },
      neck: { pos: V(0, 0.3, 0.1), r: 0.45 }, hands: [V(-0.5, 0.15, 0.1), V(0.5, 0.15, 0.1)], feet: [],
    };
    head.position.y = 0.42;
    k.sph(c.main, head, 0, 0, 0, 0.55, 0.45, 0.5);
    k.sph(c.sec, head, 0, -0.22, 0.2, 0.36, 0.18, 0.3, null, { noOutline: true });
    return A;
  },
  ghost(k, c) {
    const head = k.group(null, 0, 0.86, 0, 'head');
    const A = {
      head: { g: head, rx: 0.42, ry: 0.42, rz: 0.4 }, eyeX: 0.15, eyeY: 0.04, mouthY: -0.15, earX: 0.25, earY: 0.32,
      top: V(0, 0.42, 0), tail: null, body: { pos: V(0, 0.7, 0), rx: 0.44, ry: 0.5, rz: 0.42 }, back: { a: V(0, 1.2, 0), b: V(0, 0.9, -0.38) },
      neck: { pos: V(0, 0.6, 0.05), r: 0.4 }, hands: [V(-0.5, 0.65, 0.12), V(0.5, 0.65, 0.12)], feet: [], float: 0.16,
    };
    k.sph(c.main, head, 0, 0, 0, 0.42, 0.42, 0.4);
    const skirt = new THREE.CylinderGeometry(0.42, 0.47, 0.5, 20, 1, true);
    const pos = skirt.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0) {
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        pos.setY(i, pos.getY(i) + Math.sin(a * 5) * 0.06);
      }
    }
    skirt.computeVertexNormals();
    const sk = k.mesh(skirt, c.main, null, V(0, 0.61, 0), [1, 1, 1], null, { side: THREE.DoubleSide });
    sk.userData.sharedGeo = false;
    for (const sx of [-1, 1]) k.sph(c.main, null, sx * 0.48, 0.66, 0.08, 0.1, 0.16, 0.1, [0, 0, sx * 0.5]);
    k.sph(c.sec, null, 0, 0.62, 0.32, 0.22, 0.14, 0.1, null, { noOutline: true, opacity: 0.6 });
    return A;
  },
  bug(k, c, m, spec) {
    const head = k.group(null, 0, 0.8, 0.24, 'head');
    const A = {
      head: { g: head, rx: 0.25, ry: 0.25, rz: 0.24 }, eyeX: 0.1, eyeY: 0.04, mouthY: -0.1, earX: 0.13, earY: 0.22,
      top: V(0, 0.24, 0), tail: null, body: { pos: V(0, 0.5, -0.3), rx: 0.3, ry: 0.28, rz: 0.38 }, back: { a: V(0, 0.75, 0), b: V(0, 0.72, -0.4) },
      neck: { pos: V(0, 0.62, 0.12), r: 0.18 }, hands: [], feet: [], wing: { x: 0.12, y: 0.82, z: -0.12 },
    };
    k.sph(c.main, null, 0, 0.5, -0.32, 0.3, 0.28, 0.38);
    if (spec.mark === 'stripes') for (const z of [-0.18, -0.34, -0.5]) {
      const ring = k.mesh(new THREE.TorusGeometry(0.27 - Math.abs(z + 0.34) * 0.3, 0.04, 8, 20), c.acc, null, V(0, 0.5, z), [1, 1, 1], [0, 0, 0], { noOutline: true });
      ring.scale.set(1.1, 1.0, 1);
    }
    k.sph(c.dark, null, 0, 0.56, 0.04, 0.19, 0.19, 0.19);
    for (const sx of [-1, 1]) {
      for (const [dz, fz] of [[0.12, 0.3], [0.02, 0.02], [-0.08, -0.3]]) {
        const a = V(sx * 0.12, 0.52, dz);
        const kn = V(sx * 0.34, 0.42, fz * 0.9);
        const f = V(sx * 0.42, 0.02, fz);
        k.limb(c.line, null, a, kn, 0.022);
        k.limb(c.line, null, kn, f, 0.02);
      }
    }
    k.sph(c.main, head, 0, 0, 0, 0.25);
    return A;
  },
  golem(k, c) {
    const head = k.group(null, 0, 1.15, 0.04, 'head');
    const A = {
      head: { g: head, rx: 0.19, ry: 0.17, rz: 0.16 }, eyeX: 0.08, eyeY: 0.02, mouthY: -0.08, earX: 0.15, earY: 0.12, boxHead: true,
      top: V(0, 0.17, 0), tail: null, body: { pos: V(0, 0.66, 0), rx: 0.4, ry: 0.34, rz: 0.26 }, back: { a: V(0, 1.0, -0.1), b: V(0, 0.75, -0.26) },
      neck: { pos: V(0, 0.98, 0.04), r: 0.28 }, hands: [V(-0.55, 0.28, 0.08), V(0.55, 0.28, 0.08)], feet: [V(-0.18, 0.02, 0.15), V(0.18, 0.02, 0.15)],
    };
    for (const sx of [-1, 1]) k.box(c.dark, null, sx * 0.18, 0.16, 0, 0.24, 0.32, 0.26);
    k.box(c.main, null, 0, 0.66, 0, 0.8, 0.66, 0.5, [0, 0, 0]);
    k.box(c.sec, null, 0, 0.64, 0.25, 0.52, 0.42, 0.04, null, { noOutline: true });
    for (const sx of [-1, 1]) {
      const arm = k.group(null, sx * 0.5, 0.85, 0, sx < 0 ? 'armL' : 'armR');
      k.box(c.main, arm, sx * 0.04, -0.22, 0, 0.22, 0.5, 0.26, [0, 0, sx * 0.12]);
      k.sph(shade(c.main, 0.08), arm, sx * 0.06, -0.56, 0.06, 0.18);
    }
    k.box(c.main, head, 0, 0, 0, 0.38, 0.34, 0.32);
    return A;
  },
  jelly(k, c) {
    const head = k.group(null, 0, 0.66, 0, 'head');
    const A = {
      head: { g: head, rx: 0.48, ry: 0.5, rz: 0.48 }, eyeX: 0.17, eyeY: 0.14, mouthY: 0.0, earX: 0.3, earY: 0.36,
      top: V(0, 0.48, 0), tail: null, body: { pos: V(0, 0.75, 0), rx: 0.48, ry: 0.4, rz: 0.48 }, back: { a: V(0, 1.1, 0), b: V(0, 0.9, -0.4) },
      neck: { pos: V(0, 0.64, 0.05), r: 0.45 }, hands: [], feet: [], float: 0.22,
    };
    k.hemi(c.main, head, 0, 0, 0, 0.48, 0.5, 0.48, null, { opacity: 0.9 });
    k.mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 26), c.sec, head, V(0, 0.01, 0), [1, 1, 1], [Math.PI / 2, 0, 0]);
    k.sph('#ffffff', head, -0.16, 0.32, 0.18, 0.1, 0.06, 0.1, null, { opacity: 0.5, noOutline: true });
    const tent = k.group(null, 0, 0, 0, 'tentacles');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * 0.3;
      const z = Math.sin(a) * 0.3;
      k.tube(mix(c.main, c.sec, 0.3), tent, [V(x, 0.64, z), V(x * 1.1 + 0.04, 0.45, z * 1.1), V(x * 0.9 - 0.04, 0.26, z * 0.9), V(x, 0.08, z)], 0.035, { opacity: 0.9 });
    }
    return A;
  },
  shroom(k, c, m, spec) {
    const head = k.group(null, 0, 0.42, 0, 'head');
    const A = {
      head: { g: head, rx: 0.25, ry: 0.28, rz: 0.27 }, eyeX: 0.09, eyeY: 0.02, mouthY: -0.1, earX: 0.3, earY: 0.5,
      top: V(0, 0.68, 0), tail: null, body: { pos: V(0, 0.36, 0), rx: 0.25, ry: 0.3, rz: 0.25 }, back: { a: V(0, 0.9, 0), b: V(0, 0.75, -0.4) },
      neck: { pos: V(0, 0.55, 0.05), r: 0.26 }, hands: [V(-0.3, 0.36, 0.04), V(0.3, 0.36, 0.04)], feet: [V(-0.14, 0.04, 0.08), V(0.14, 0.04, 0.08)], cap: true,
    };
    for (const sx of [-1, 1]) {
      k.sph(shade(c.sec, -0.25), null, sx * 0.14, 0.05, 0.06, 0.12, 0.07, 0.14);
      k.sph(c.sec, null, sx * 0.3, 0.38, 0.04, 0.08, 0.13, 0.08, [0, 0, sx * 0.5]);
    }
    k.cyl(c.sec, null, 0, 0.36, 0, 0.25, 0.6);
    k.sph(c.sec, head, 0, 0, 0.02, 0.25, 0.28, 0.27, null, { noOutline: true });
    const capY = 0.62;
    k.hemi(c.main, null, 0, capY, 0, 0.64, 0.46, 0.64);
    k.sph(shade(c.sec, -0.1), null, 0, capY, 0, 0.6, 0.05, 0.6, null, { noOutline: true });
    if (spec.mark === 'spots') {
      for (const [a, el] of [[0.3, 0.9], [1.6, 0.75], [2.7, 0.95], [3.9, 0.8], [5.1, 0.95], [0, 0.3]]) {
        const x = Math.cos(a) * Math.cos(el) * 0.64;
        const z = Math.sin(a) * Math.cos(el) * 0.64;
        const y = capY + Math.sin(el) * 0.46;
        const s = k.sph(c.acc, null, x, y, z, 0.1, 0.03, 0.1, null, { noOutline: true });
        s.quaternion.setFromUnitVectors(UP, V(x / 0.64, (y - capY) / 0.46, z / 0.64).normalize());
      }
    }
    return A;
  },
  crab(k, c) {
    const head = k.group(null, 0, 0.36, 0, 'head');
    const A = {
      head: { g: head, rx: 0.5, ry: 0.24, rz: 0.38 }, eyes3d: [V(-0.13, 0.75, 0.29), V(0.13, 0.75, 0.29)], eyeFwd: true, mouth3d: V(0, 0.34, 0.39),
      top: V(0, 0.16, 0.26), tail: null, body: { pos: V(0, 0.36, 0), rx: 0.5, ry: 0.24, rz: 0.38 }, back: { a: V(0, 0.58, 0.05), b: V(0, 0.55, -0.3) },
      neck: { pos: V(0, 0.42, 0.25), r: 0.3 }, hands: [V(-0.6, 0.8, 0.45), V(0.6, 0.8, 0.45)], feet: [],
    };
    k.sph(c.main, head, 0, 0, 0, 0.5, 0.24, 0.38);
    k.sph(c.sec, head, 0, -0.07, 0.14, 0.36, 0.13, 0.28, null, { noOutline: true });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = 0.12 - i * 0.16;
        k.limb(c.dark, null, V(sx * 0.38, 0.32, z), V(sx * 0.62, 0.3, z * 1.2), 0.035);
        k.limb(c.dark, null, V(sx * 0.62, 0.3, z * 1.2), V(sx * 0.7, 0.02, z * 1.3), 0.03);
      }
      const arm = k.group(null, 0, 0, 0, sx < 0 ? 'armL' : 'armR');
      k.limb(c.main, arm, V(sx * 0.36, 0.42, 0.22), V(sx * 0.55, 0.62, 0.4), 0.06);
      k.sph(c.main, arm, sx * 0.6, 0.8, 0.45, 0.17, 0.2, 0.15);
      k.spike(c.main, arm, V(sx * 0.64, 0.95, 0.5), V(sx * 0.1, 1, 0.3), 0.07, 0.18);
      k.spike(c.main, arm, V(sx * 0.52, 0.94, 0.5), V(-sx * 0.1, 1, 0.3), 0.06, 0.14);
      k.limb(c.main, null, V(sx * 0.13, 0.5, 0.25), V(sx * 0.13, 0.7, 0.27), 0.03);
      k.sph('#ffffff', null, sx * 0.13, 0.75, 0.25, 0.075);
    }
    return A;
  },
  wisp(k, c) {
    const head = k.group(null, 0, 0.42, 0.05, 'head');
    const A = {
      head: { g: head, rx: 0.3, ry: 0.28, rz: 0.28 }, eyeX: 0.11, eyeY: 0.04, mouthY: -0.1, earX: 0.2, earY: 0.3,
      top: V(0, 0.75, 0), tail: null, body: { pos: V(0, 0.5, 0), rx: 0.36, ry: 0.5, rz: 0.34 }, back: { a: V(0, 1.0, 0), b: V(0, 0.8, -0.3) },
      neck: { pos: V(0, 0.35, 0.1), r: 0.3 }, hands: [], feet: [], float: 0.2,
    };
    const flame = new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.24, 0.05), new THREE.Vector2(0.36, 0.22), new THREE.Vector2(0.34, 0.45),
      new THREE.Vector2(0.22, 0.7), new THREE.Vector2(0.1, 0.92), new THREE.Vector2(0, 1.05),
    ], 20);
    const f = k.mesh(flame, c.main, null, V(0, 0.12, 0), [1, 1, 1], null, { emissive: c.main, emissiveIntensity: 0.55 });
    f.name = 'flame';
    k.mesh(flame, c.sec, null, V(0, 0.16, 0.06), [0.6, 0.7, 0.6], null, { emissive: c.sec, emissiveIntensity: 0.4, noOutline: true });
    k.sph(c.sec, head, 0, 0, 0.02, 0.26, 0.24, 0.24, null, { noOutline: true, emissive: c.sec, emissiveIntensity: 0.2 });
    return A;
  },
};

// ---------- tvář ----------
function eyes(k, c, spec, A) {
  const type = spec.eye || 'cute';
  const pts = [];
  if (A.eyes3d) for (const p of A.eyes3d) pts.push({ p, n: (A.eyeFwd ? V(Math.sign(p.x) * 0.25, 0.1, 1) : V(Math.sign(p.x) * 0.85, 0.1, 0.5)).normalize(), parent: null });
  else for (const sx of [-1, 1]) { const s = onHead(A, sx * A.eyeX, A.eyeY, 0.0); pts.push({ p: s.p, n: s.n, parent: A.head.g, sx }); }
  const sz = A.boxHead ? 0.75 : 1;
  for (const e of pts) {
    const g = new THREE.Group();
    g.position.copy(e.p);
    faceTo(g, e.n);
    (e.parent || k.root).add(g);
    const sx = e.sx || Math.sign(e.p.x);
    switch (type) {
      case 'big':
        k.sph('#ffffff', g, 0, 0, 0, 0.085 * sz, 0.1 * sz, 0.04);
        k.sph(spec.eyeC || '#3a2a4a', g, 0, -0.01, 0.025, 0.062 * sz, 0.072 * sz, 0.03, null, { noOutline: true });
        k.sph(DARK, g, 0, -0.01, 0.04, 0.035 * sz, 0.042 * sz, 0.02, null, { noOutline: true });
        k.sph('#ffffff', g, -0.025, 0.035, 0.05, 0.022, 0.022, 0.012, null, { noOutline: true, basic: true });
        break;
      case 'fierce':
        k.sph(DARK, g, 0, -0.01, 0, 0.06 * sz, 0.07 * sz, 0.03, null, { noOutline: true });
        k.sph('#ffffff', g, -0.018, 0.02, 0.025, 0.017, 0.017, 0.01, null, { noOutline: true, basic: true });
        k.box(c.line, g, 0, 0.085, 0.02, 0.13, 0.03, 0.03, [0, 0, sx * 0.4], { noOutline: true });
        break;
      case 'sleepy':
        k.box(DARK, g, 0, 0, 0.01, 0.1, 0.018, 0.02, null, { noOutline: true });
        break;
      case 'glow': {
        k.sph(spec.eyeC || '#ffe85a', g, 0, 0, 0, 0.07 * sz, 0.085 * sz, 0.035, null, { basic: true });
        k.sph('#ffffff', g, -0.015, 0.02, 0.03, 0.025, 0.03, 0.01, null, { noOutline: true, basic: true });
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: spec.eyeC || '#ffe85a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.set(0.3, 0.3, 0.3);
        g.add(glow);
        break;
      }
      case 'bead':
        k.sph(DARK, g, 0, 0, 0, 0.045 * sz, 0.05 * sz, 0.03, null, { noOutline: true });
        k.sph('#ffffff', g, -0.012, 0.015, 0.025, 0.012, 0.012, 0.008, null, { noOutline: true, basic: true });
        break;
      default:
        k.sph(DARK, g, 0, 0, 0, 0.065 * sz, 0.085 * sz, 0.035, null, { noOutline: true });
        k.sph('#ffffff', g, -0.02, 0.03, 0.03, 0.024, 0.024, 0.012, null, { noOutline: true, basic: true });
        k.sph('#ffffff', g, 0.02, -0.032, 0.03, 0.012, 0.012, 0.008, null, { noOutline: true, basic: true });
    }
  }
}

function mouth(k, c, spec, A) {
  const t = spec.mouth || 'smile';
  let p;
  let n;
  let parent = A.head.g;
  if (A.mouth3d) { p = A.mouth3d; n = V(0, 0, 1); parent = k.root; } else { const s = onHead(A, 0, A.mouthY, 0.005); p = s.p; n = s.n; }
  const g = new THREE.Group();
  g.position.copy(p);
  faceTo(g, n);
  parent.add(g);
  if (t === 'beak') {
    k.cone('#f4b23c', g, 0, 0.012, 0.07, 0.07, 0.17, [Math.PI / 2, 0, 0]);
    k.cone(shade('#f4b23c', -0.15), g, 0, -0.028, 0.05, 0.05, 0.11, [Math.PI / 2 + 0.25, 0, 0], { noOutline: true });
    return;
  }
  const arc = (r, up) => {
    const m = k.mesh(new THREE.TorusGeometry(r, 0.013, 6, 14, Math.PI), c.line, g, V(0, 0, 0), [1, 1, 1], [0, 0, up ? 0 : Math.PI], { noOutline: true });
    return m;
  };
  switch (t) {
    case 'smile': arc(0.045, false); break;
    case 'fang':
      arc(0.05, false);
      for (const sx of [-1, 1]) k.cone('#ffffff', g, sx * 0.025, -0.06, 0.005, 0.014, 0.04, [Math.PI, 0, 0], { noOutline: true });
      break;
    case 'grin': {
      const m = k.mesh(new THREE.CircleGeometry(0.07, 16, Math.PI, Math.PI), '#ffffff', g, V(0, 0.01, 0.004), [1, 0.9, 1], null, { side: THREE.DoubleSide, noOutline: true });
      m.userData.sharedGeo = false;
      arc(0.07, false);
      break;
    }
    case 'frown': arc(0.04, true).position.y = -0.05; break;
    case 'teeth':
      arc(0.035, false);
      for (const sx of [-1, 1]) k.box('#ffffff', g, sx * 0.016, -0.05, 0.004, 0.028, 0.04, 0.012, null, { noOutline: true });
      break;
    case 'open':
      k.sph('#5a1a2a', g, 0, -0.02, 0, 0.045, 0.04, 0.015, null, { noOutline: true });
      k.sph('#ff8a9a', g, 0, -0.04, 0.01, 0.028, 0.015, 0.01, null, { noOutline: true });
      break;
    default:
  }
}

// ---------- uši, rohy ----------
function ears(k, c, spec, A) {
  const t = spec.ear;
  if (!t || A.fish) return;
  const H = A.head.g;
  for (const sx of [-1, 1]) {
    const x = sx * A.earX;
    const y = A.earY;
    switch (t) {
      case 'pointy':
        k.cone(c.main, H, x, y + 0.08, -0.02, 0.1, 0.24, [0, 0, -sx * 0.35]);
        k.cone(mix(c.sec, c.acc, 0.3), H, x - sx * 0.006, y + 0.07, 0.04, 0.055, 0.15, [0, 0, -sx * 0.35], { noOutline: true });
        break;
      case 'round':
        k.sph(c.main, H, x * 1.05, y + 0.02, -0.03, 0.11, 0.11, 0.05);
        k.sph(c.sec, H, x * 1.05, y + 0.02, 0.0, 0.065, 0.065, 0.03, null, { noOutline: true });
        break;
      case 'long':
        k.sph(c.main, H, x * 0.8, y + 0.24, -0.03, 0.075, 0.27, 0.05, [0, 0, -sx * 0.15]);
        k.sph(c.acc, H, x * 0.8, y + 0.24, 0.0, 0.04, 0.19, 0.03, [0, 0, -sx * 0.15], { noOutline: true });
        break;
      case 'floppy':
        k.sph(shade(c.main, -0.06), H, x * 1.25, y - 0.1, 0, 0.07, 0.2, 0.06, [0, 0, sx * 0.5]);
        break;
      case 'tuft':
        k.cone(shade(c.main, -0.05), H, x, y + 0.06, 0, 0.07, 0.17, [0, 0, -sx * 0.3]);
        break;
      case 'fin': {
        const f = k.cone(c.acc, H, x * 1.3, y - 0.05, 0, 0.12, 0.26, [0, 0, -sx * 1.1]);
        f.scale.z = 0.035;
        break;
      }
      case 'leaf':
        k.sph(c.acc, H, x * 1.15, y + 0.08, 0, 0.06, 0.17, 0.035, [0, 0, -sx * 0.7]);
        break;
      case 'bat':
        k.cone(c.main, H, x * 1.1, y + 0.12, -0.02, 0.13, 0.34, [0, 0, -sx * 0.3]);
        k.cone(c.acc, H, x * 1.1 - sx * 0.01, y + 0.1, 0.05, 0.075, 0.22, [0, 0, -sx * 0.3], { noOutline: true });
        break;
      default:
    }
  }
}

function horns(k, c, spec, A) {
  const t = spec.horn;
  if (!t) return;
  const H = A.fish ? k.root : A.head.g;
  const top = A.top;
  switch (t) {
    case 'nub':
      for (const sx of [-1, 1]) k.cone(BONE, H, top.x + sx * 0.1, top.y + 0.02, top.z, 0.05, 0.13, [0, 0, -sx * 0.25]);
      break;
    case 'curved':
      for (const sx of [-1, 1]) {
        const p = [V(sx * 0.1, top.y - 0.06, 0), V(sx * 0.22, top.y + 0.1, -0.04), V(sx * 0.34, top.y + 0.08, -0.12), V(sx * 0.38, top.y - 0.04, -0.14)];
        k.tube(BONE, H, p, 0.035);
      }
      break;
    case 'antlers': {
      const col = '#8a5a3a';
      for (const sx of [-1, 1]) {
        const a = V(sx * 0.1, top.y - 0.04, 0);
        const b = V(sx * 0.2, top.y + 0.2, -0.05);
        const cc = V(sx * 0.32, top.y + 0.36, -0.08);
        k.limb(col, H, a, b, 0.03);
        k.limb(col, H, b, cc, 0.026);
        k.limb(col, H, b, V(sx * 0.36, top.y + 0.18, 0), 0.022);
        k.limb(col, H, cc, V(sx * 0.3, top.y + 0.52, -0.06), 0.02);
        if ((spec.x || []).includes('flower')) {
          for (const fp of [V(sx * 0.36, top.y + 0.2, 0.02), V(sx * 0.3, top.y + 0.53, -0.05)]) {
            k.sph(c.acc, H, fp.x, fp.y, fp.z, 0.05, 0.05, 0.05, null, { noOutline: true });
            k.sph('#ffe86a', H, fp.x, fp.y, fp.z + 0.03, 0.02, 0.02, 0.02, null, { noOutline: true });
          }
        }
      }
      break;
    }
    case 'unicorn':
      k.cone(BONE, H, 0, top.y + 0.08, 0.06, 0.06, 0.24, [0.3, 0, 0]);
      break;
    case 'crest':
      for (const [dx, h, rz] of [[-0.06, 0.16, 0.4], [0, 0.22, 0], [0.06, 0.16, -0.4]]) k.sph(c.acc, H, dx, top.y + h * 0.4, -0.02, 0.04, h * 0.55, 0.06, [-0.3, 0, rz]);
      break;
    case 'antennae':
      for (const sx of [-1, 1]) {
        const a = V(sx * 0.07, top.y - 0.02, 0.02);
        const b = V(sx * 0.16, top.y + 0.2, 0.06);
        const cc = V(sx * 0.26, top.y + 0.3, 0.02);
        k.limb(shade(c.main, -0.35), H, a, b, 0.016);
        k.limb(shade(c.main, -0.35), H, b, cc, 0.014);
        k.sph(c.acc, H, cc.x, cc.y, cc.z, 0.05);
      }
      break;
    case 'crown': {
      const g = k.group(H, top.x, top.y - 0.02, top.z);
      k.mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.09, 16, 1, true), '#f4c63a', g, V(0, 0.04, 0), [1, 1, 1], null, { side: THREE.DoubleSide, metal: true });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.cone('#f4c63a', g, Math.cos(a) * 0.155, 0.12, Math.sin(a) * 0.155, 0.035, 0.09, null, { metal: true });
      }
      k.sph('#e84a6a', g, 0, 0.04, 0.17, 0.035, 0.035, 0.02, null, { noOutline: true });
      break;
    }
    case 'bud':
      k.sph('#f58ab0', H, 0, top.y + 0.1, 0.04, 0.07, 0.12, 0.07);
      k.sph('#4aa84a', H, 0.08, top.y + 0.02, 0.04, 0.09, 0.03, 0.05, [0, 0, -0.5]);
      break;
    case 'drill': {
      const d = k.spike('#b8c0cc', A.head.g, V(0, -0.02, A.head.rz * 0.8), V(0, 0.4, 1), 0.08, 0.32, { metal: true });
      d.name = 'drill';
      break;
    }
    default:
  }
}

// ---------- ocas, křídla, záda ----------
function tail(k, c, spec, A) {
  const t = spec.tail;
  if (!t || !A.tail) return;
  const g = k.group(null, A.tail.pos.x, A.tail.pos.y, A.tail.pos.z, 'tail');
  const d = A.tail.dir.clone().normalize();
  const P = (s, up = 0, side = 0) => V(d.x * s + side, d.y * s + up, d.z * s);
  switch (t) {
    case 'fluffy':
      k.sph(c.main, g, ...P(0.18).toArray(), 0.13);
      k.sph(c.main, g, ...P(0.38, 0.08).toArray(), 0.19);
      k.sph(c.sec, g, ...P(0.58, 0.2).toArray(), 0.15);
      break;
    case 'flame': {
      k.tube(c.main, g, [V(0, 0, 0), P(0.2, 0.04), P(0.34, 0.2)], 0.05);
      const tip = P(0.34, 0.14);
      const f = k.mesh(FLAME, c.acc, g, tip, [0.34, 0.42, 0.34], null, { emissive: c.acc, emissiveIntensity: 0.6 });
      f.name = 'flame';
      const f2 = k.mesh(FLAME, '#fff3b0', g, tip.clone().add(V(0, 0.02, 0.04)), [0.18, 0.26, 0.18], null, { emissive: '#fff3b0', emissiveIntensity: 0.7, noOutline: true });
      f2.name = 'flame';
      break;
    }
    case 'leaf':
      k.tube(c.main, g, [V(0, 0, 0), P(0.2, 0.05), P(0.32, 0.18)], 0.04);
      k.sph(c.acc, g, ...P(0.38, 0.34).toArray(), 0.08, 0.2, 0.04, [0.6, 0, 0]);
      break;
    case 'thin':
      k.tube(c.main, g, [V(0, 0, 0), P(0.25, -0.05), P(0.45, 0.05, 0.1), P(0.55, 0.25, 0.15)], 0.045);
      break;
    case 'devil': {
      k.tube(c.main, g, [V(0, 0, 0), P(0.25, -0.05), P(0.42, 0.1, 0.08), P(0.48, 0.3, 0.1)], 0.03);
      const tip = P(0.48, 0.34, 0.1);
      k.cone(c.main, g, tip.x, tip.y, tip.z, 0.07, 0.14);
      break;
    }
    case 'bolt':
      k.box(c.acc, g, ...P(0.12, 0.06).toArray(), 0.06, 0.24, 0.05, [0.4, 0, 0.6]);
      k.box(c.acc, g, ...P(0.24, 0.22).toArray(), 0.06, 0.24, 0.05, [0.4, 0, -0.6]);
      k.box(c.acc, g, ...P(0.34, 0.4).toArray(), 0.06, 0.24, 0.05, [0.4, 0, 0.6]);
      break;
    case 'paddle':
      k.sph(shade(c.acc, 0.05), g, ...P(0.24, -0.12).toArray(), 0.16, 0.05, 0.26, [0.2, 0, 0]);
      break;
    case 'club':
      k.tube(c.main, g, [V(0, 0, 0), P(0.22, 0.02), P(0.36, 0.12)], 0.045);
      k.sph(shade(c.sec, -0.1), g, ...P(0.4, 0.16).toArray(), 0.12);
      break;
    case 'ring': {
      const pts = [V(0, 0, 0), P(0.25, 0.05), P(0.42, 0.3, 0.05), P(0.38, 0.6, 0.1), P(0.22, 0.75, 0.08)];
      k.tube(c.main, g, pts, 0.06);
      const curve = new THREE.CatmullRomCurve3(pts);
      for (let i = 1; i < 6; i++) {
        const q = curve.getPoint(i / 6);
        k.sph(c.sec, g, q.x, q.y, q.z, 0.068, 0.068, 0.068, null, { noOutline: true });
      }
      break;
    }
    case 'pom':
      k.sph(c.sec, g, ...P(0.06, 0.02).toArray(), 0.12);
      break;
    case 'wisp':
      k.cone(c.main, g, ...P(0.2).toArray(), 0.1, 0.4, [-1.2, 0, 0], { opacity: 0.8 });
      break;
    case 'fan':
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.32;
        const col = i % 2 ? c.acc : shade(c.main, -0.08);
        const f = k.sph(col, g, Math.sin(a) * 0.2, 0.08 + Math.cos(a) * 0.06, -0.2, 0.07, 0.24, 0.03, [-1.1, 0, -a]);
        f.position.add(V(0, 0, 0));
      }
      break;
    case 'fin': {
      const f = k.cone(c.acc, g, ...P(0.2).toArray(), 0.22, 0.3, [-Math.PI / 2 + 0.3, 0, 0]);
      f.scale.x = 0.05;
      break;
    }
    default:
  }
}

function wings(k, c, spec, A) {
  const t = spec.wing;
  if (!t) return;
  const w = A.wing || { x: 0.3, y: A.body.pos.y + 0.15, z: -0.1 };
  for (const sx of [-1, 1]) {
    const g = k.group(null, sx * w.x, w.y, w.z, sx < 0 ? 'wingL' : 'wingR');
    switch (t) {
      case 'feather':
        k.sph(shade(c.main, -0.06), g, sx * 0.12, -0.04, -0.06, 0.06, 0.28, 0.34, [0.25, 0, sx * 0.5]);
        for (let i = 0; i < 3; i++) k.sph(c.acc, g, sx * (0.2 + i * 0.05), -0.2 - i * 0.02, -0.18 - i * 0.05, 0.04, 0.12, 0.06, [0.4, 0, sx * 0.6], { noOutline: true });
        break;
      case 'bat': {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.22, 0.3);
        shape.lineTo(0.62, 0.18);
        shape.quadraticCurveTo(0.5, 0.0, 0.56, -0.18);
        shape.quadraticCurveTo(0.38, -0.06, 0.32, -0.24);
        shape.quadraticCurveTo(0.18, -0.08, 0, -0.12);
        shape.lineTo(0, 0);
        const geo = new THREE.ShapeGeometry(shape);
        const wg = k.group(g);
        wg.rotation.y = sx * 0.45;
        wg.scale.x = sx;
        k.mesh(geo, shade(c.main, -0.12), wg, V(0, 0, 0), [1, 1, 1], null, { side: THREE.DoubleSide });
        k.limb(shade(c.main, -0.45), wg, V(0, 0, 0), V(0.22, 0.3, 0), 0.022);
        k.limb(shade(c.main, -0.45), wg, V(0.22, 0.3, 0), V(0.62, 0.18, 0), 0.016);
        break;
      }
      case 'insect':
        k.sph('#eaf6ff', g, sx * 0.22, 0.08, -0.08, 0.26, 0.12, 0.02, [0.3, sx * 0.3, sx * 0.35], { opacity: 0.55, noOutline: true });
        k.sph('#eaf6ff', g, sx * 0.18, -0.08, -0.12, 0.2, 0.09, 0.02, [0.3, sx * 0.3, -sx * 0.2], { opacity: 0.5, noOutline: true });
        break;
      case 'butterfly':
        k.sph(c.main, g, sx * 0.3, 0.14, -0.08, 0.32, 0.26, 0.02, [0, sx * 0.25, sx * 0.25], { side: THREE.DoubleSide });
        k.sph(shade(c.main, -0.08), g, sx * 0.24, -0.18, -0.08, 0.22, 0.17, 0.02, [0, sx * 0.25, -sx * 0.3], { side: THREE.DoubleSide });
        k.sph(c.acc, g, sx * 0.36, 0.16, -0.06, 0.09, 0.09, 0.025, [0, sx * 0.25, 0], { noOutline: true });
        k.sph(c.sec, g, sx * 0.24, -0.18, -0.06, 0.06, 0.06, 0.025, [0, sx * 0.25, 0], { noOutline: true });
        break;
      case 'tiny':
        k.sph(c.acc, g, sx * 0.12, 0.08, -0.06, 0.04, 0.12, 0.14, [0.3, 0, sx * 0.8]);
        break;
      default:
    }
  }
}

function back(k, c, spec, A) {
  const t = spec.back;
  if (!t) return;
  const a = A.back.a;
  const b = A.back.b;
  const along = (n, fn) => { for (let i = 0; i < n; i++) { const f = n === 1 ? 0.5 : i / (n - 1); fn(a.clone().lerp(b, f), f, i); } };
  switch (t) {
    case 'spikes':
      along(4, (p, f) => k.spike(c.acc, null, p, V(0, 1, -0.4 - f * 0.6), 0.07, 0.18));
      break;
    case 'quills':
      for (let i = 0; i < 14; i++) {
        const ang = -0.9 + (i % 7) * 0.3;
        const row = Math.floor(i / 7);
        const base = a.clone().lerp(b, 0.2 + row * 0.5);
        const dir = V(Math.sin(ang), Math.cos(ang) * 0.8 + 0.2, -0.7);
        k.spike(row ? c.main : c.acc, null, base.add(V(Math.sin(ang) * 0.15, 0, 0)), dir, 0.06, 0.32);
      }
      break;
    case 'mane':
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        const n = A.neck;
        k.sph(c.sec, null, n.pos.x + Math.cos(ang) * n.r, n.pos.y + Math.sin(ang) * n.r * 0.55, n.pos.z - 0.05 + Math.sin(ang) * 0.05, 0.11);
      }
      break;
    case 'flames':
      along(4, (p, f) => {
        const fl = k.mesh(FLAME, c.acc, null, V(p.x, p.y - 0.04, p.z), [0.26, 0.36 - f * 0.08, 0.26], [-(0.2 + f * 0.6), 0, 0], { emissive: c.acc, emissiveIntensity: 0.55 });
        fl.name = 'flame';
      });
      break;
    case 'leaves':
      along(4, (p, f, i) => k.sph(c.acc, null, p.x + (i % 2 ? 0.08 : -0.08), p.y + 0.08, p.z, 0.06, 0.18, 0.04, [-(0.4 + f * 0.6), 0, i % 2 ? -0.5 : 0.5]));
      break;
    case 'crystals':
      along(3, (p, f, i) => {
        const cr = k.mesh(GEO.cylHex, c.acc, null, V(p.x + (i - 1) * 0.12, p.y + 0.14, p.z), [0.07, 0.34 + (i % 2) * 0.12, 0.07], [-0.2, 0, (i - 1) * 0.35], { emissive: c.acc, emissiveIntensity: 0.4 });
        k.cone(c.acc, null, cr.position.x, cr.position.y + cr.scale.y * 0.5 + 0.05, cr.position.z, 0.07, 0.1, [-0.2, 0, (i - 1) * 0.35], { emissive: c.acc, emissiveIntensity: 0.4 });
      });
      break;
    case 'shell':
      k.hemi(c.sec, null, A.body.pos.x, A.body.pos.y + 0.02, A.body.pos.z, A.body.rx * 1.06, A.body.ry * 1.2, A.body.rz * 1.06);
      break;
    case 'fins':
      along(2, (p, f) => { const fin = k.cone(c.acc, null, p.x, p.y + 0.1, p.z, 0.14, 0.24, [-0.5, 0, 0]); fin.scale.x = 0.04; });
      break;
    case 'plates': {
      const B = A.body;
      const geo = new THREE.CylinderGeometry(1, 1, 0.09, 18, 1, true, Math.PI / 2, Math.PI);
      along(4, (p) => {
        const dz = (p.z - B.pos.z) / B.rz;
        const r = B.rx * Math.sqrt(Math.max(0.15, 1 - dz * dz)) * 1.06;
        k.mesh(geo, shade(c.sec, -0.15), null, V(B.pos.x, B.pos.y, p.z), [r, 1, r * (B.ry / B.rx)], [Math.PI / 2, 0, 0], { side: THREE.DoubleSide });
      });
      break;
    }
    case 'moss':
      for (const [dx, dy, dz, r] of [[-0.12, 0.05, 0, 0.11], [0.0, 0.1, -0.05, 0.12], [0.13, 0.04, 0.02, 0.1], [-0.05, 0.0, 0.1, 0.08]]) {
        k.sph('#5aa04a', A.boxHead || A.cap ? k.root : A.head.g, (A.boxHead ? 0 : A.top.x) + dx, (A.boxHead ? A.back.a.y : A.top.y) + dy, (A.boxHead ? A.back.a.z : A.top.z) + dz, r);
      }
      break;
    case 'snow':
      k.sph('#ffffff', A.head.g, A.top.x, A.top.y - 0.02, A.top.z, 0.2, 0.08, 0.2);
      break;
    default:
  }
}

function marks(k, c, spec, A) {
  const t = spec.mark;
  if (!t) return;
  const H = A.head.g;
  switch (t) {
    case 'cheeks':
      if (A.fish || A.eyes3d) return;
      for (const sx of [-1, 1]) {
        const s = onHead(A, sx * (A.eyeX + 0.08), A.eyeY - 0.1, 0.004);
        const m = k.sph('#ff6a7a', H, s.p.x, s.p.y, s.p.z, 0.05, 0.035, 0.012, null, { noOutline: true, opacity: 0.8 });
        faceTo(m, s.n);
      }
      break;
    case 'spots':
      if (spec.b === 'shroom' || spec.b === 'larva') return;
      for (const [u, v] of [[-0.5, 0.8], [0.4, 0.9], [0.1, 1.0], [-0.2, 0.6], [0.6, 0.5]]) {
        const b = A.body;
        const x = b.pos.x + u * b.rx * 0.8;
        const z = b.pos.z + (v - 0.75) * b.rz * 1.6;
        const y = b.pos.y + b.ry * Math.sqrt(Math.max(0.05, 1 - (u * 0.8) ** 2 - ((v - 0.75) * 1.6) ** 2));
        k.sph(spec.b === 'quad' && c.acc !== c.main ? c.acc : c.sec, null, x, y, z, 0.07, 0.025, 0.07, null, { noOutline: true });
      }
      break;
    case 'bolt': case 'star': case 'moon': {
      const s = onHead(A, 0, A.head.ry * 0.55, 0.006);
      const m = k.mesh(new THREE.CircleGeometry(0.06, t === 'star' ? 5 : t === 'moon' ? 3 : 4), c.acc, H, s.p, [1, t === 'bolt' ? 1.6 : 1, 1], null, { noOutline: true, side: THREE.DoubleSide });
      m.userData.sharedGeo = false;
      faceTo(m, s.n);
      break;
    }
    case 'stripes': {
      if (spec.b === 'bug') return;
      const B = A.body;
      const parent = spec.b === 'blob' ? A.head.g : k.root;
      const cy = spec.b === 'blob' ? 0 : B.pos.y;
      for (const f of [-0.45, 0.0, 0.45]) {
        const y = f * B.ry;
        const r = B.rx * Math.sqrt(Math.max(0.05, 1 - f * f)) * 1.01;
        k.mesh(RING, c.acc, parent, V(B.pos.x * 0, cy + y, spec.b === 'blob' ? 0 : B.pos.z), [r, r * (B.rz / B.rx), 1.2], [Math.PI / 2, 0, 0], { noOutline: true });
      }
      break;
    }
    case 'cracks': {
      const golem = spec.b === 'golem';
      const B = A.body;
      const parent = golem ? k.root : A.head.g;
      const segs = [[-0.1, 0.12, 0.6], [-0.04, 0.02, -0.5], [0.02, -0.08, 0.7], [0.14, 0.1, -0.8], [0.18, 0.0, 0.4]];
      for (const [x, y, rz] of segs) {
        let p;
        let n;
        if (golem) { p = V(x * 1.4, B.pos.y + y * 1.3, 0.252); n = V(0, 0, 1); } else { const s2 = onHead(A, x * A.head.rx * 1.6, y * A.head.ry * 1.8, 0.0); p = s2.p; n = s2.n; }
        const m = k.box(c.acc, parent, p.x, p.y, p.z, 0.11, 0.018, 0.012, null, { noOutline: true });
        faceTo(m, n);
        m.rotateZ(rz);
      }
      break;
    }
    case 'third': {
      const s = onHead(A, 0, A.head.ry * 0.5, 0.004);
      const m = k.sph(c.acc, H, s.p.x, s.p.y, s.p.z, 0.035, 0.055, 0.015, null, { noOutline: true });
      faceTo(m, s.n);
      const p2 = k.sph(DARK, H, s.p.x, s.p.y, s.p.z + 0.01, 0.014, 0.03, 0.01, null, { noOutline: true });
      faceTo(p2, s.n);
      break;
    }
    default:
  }
}

// ---------- doplňky z popisu tvora ----------
function extras(k, c, spec, A) {
  const x = spec.x || [];
  const H = A.head.g;
  const top = A.top;
  if (x.includes('whiskers') && !A.fish) {
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const s = onHead(A, sx * A.eyeX * 0.6, A.mouthY + 0.03 + i * 0.03, 0);
        k.limb(c.line, H, s.p, s.p.clone().add(V(sx * 0.18, -0.02 + i * 0.04, 0.02)), 0.006, { noOutline: true });
      }
    }
  }
  if (x.includes('whiskers') && A.fish) {
    for (const sx of [-1, 1]) {
      const m0 = A.mouth3d;
      k.tube(c.acc, null, [V(sx * 0.08, m0.y - 0.02, m0.z - 0.04), V(sx * 0.16, m0.y - 0.1, m0.z), V(sx * 0.2, m0.y - 0.22, m0.z - 0.04)], 0.015);
    }
  }
  const orbit = (n, make) => {
    const g = k.group(null, 0, 0, 0, 'orbit');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const o = make(i);
      o.position.set(Math.cos(a) * 0.75, 0.45 + (i % 3) * 0.28, Math.sin(a) * 0.75);
      g.add(o);
    }
  };
  if (x.includes('sparks')) {
    orbit(5, () => {
      const m = new THREE.Mesh(OCTA, toon(c.acc, { emissive: c.acc, emissiveIntensity: 0.9 }));
      m.scale.set(0.045, 0.1, 0.045);
      m.userData.noOutline = true;
      return m;
    });
  }
  if (x.includes('snowflakes') || x.includes('wisps')) {
    const snow = x.includes('snowflakes');
    orbit(snow ? 6 : 5, () => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: snow ? starTexture() : glowTexture(), color: snow ? '#ffffff' : c.sec, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(snow ? 0.13 : 0.2);
      return sp;
    });
  }
  if (x.includes('nose')) {
    const s = onHead(A, 0, A.mouthY + 0.07, 0.03);
    k.sph(c.acc === '#f4d23a' ? '#3a2a2a' : '#ff8aa8', H, s.p.x, s.p.y, s.p.z, 0.06, 0.05, 0.05);
  }
  if (x.includes('claws')) {
    for (const p of [...(A.hands || []), ...(A.feet || [])]) for (const dx of [-0.04, 0, 0.04]) k.cone('#f4f0e6', null, p.x + dx, p.y + 0.02, p.z + 0.08, 0.015, 0.06, [Math.PI / 2, 0, 0], { noOutline: true });
  }
  if (x.includes('gloves')) for (const p of A.hands || []) k.sph(c.acc, null, p.x, p.y, p.z, 0.13);
  if (x.includes('scarf')) {
    const n = A.neck;
    k.mesh(new THREE.TorusGeometry(n.r * 0.9, 0.06, 8, 18), c.acc, null, V(n.pos.x, n.pos.y, n.pos.z), [1, 1, 1], [Math.PI / 2, 0, 0]);
    k.box(shade(c.acc, -0.08), null, n.pos.x + 0.12, n.pos.y - 0.14, n.pos.z + n.r * 0.8, 0.09, 0.24, 0.04, [0, 0, 0.15]);
  }
  if (x.includes('bandana')) {
    k.mesh(new THREE.TorusGeometry(A.head.rx * 0.98, 0.04, 8, 20), c.acc, H, V(0, A.head.ry * 0.35, 0), [1, 1, A.head.rz / A.head.rx], [Math.PI / 2 - 0.15, 0, 0]);
    k.box(c.acc, H, 0.05, A.head.ry * 0.3, -A.head.rz, 0.05, 0.16, 0.03, [0.3, 0, 0.5]);
  }
  if (x.includes('robe')) {
    const b = A.body;
    k.cyl(c.acc, null, b.pos.x, b.pos.y - b.ry * 0.3, b.pos.z, b.rx * 1.08, b.ry * 1.3, null);
    k.mesh(new THREE.TorusGeometry(b.rx * 1.08, 0.025, 6, 20), '#f4d23a', null, V(b.pos.x, b.pos.y - b.ry * 0.95, b.pos.z), [1, 1, 1], [Math.PI / 2, 0, 0], { noOutline: true });
  }
  if (x.includes('beard')) {
    const s = onHead(A, 0, A.mouthY - 0.04, 0);
    k.sph(spec.b === 'golem' ? '#e8eef6' : mix(c.sec, '#ffffff', 0.4), H, s.p.x, s.p.y - 0.1, s.p.z - 0.04, A.head.rx * 0.55, 0.18, 0.1);
  }
  if (x.includes('cape')) {
    const n = A.neck;
    const geo = new THREE.CylinderGeometry(n.r * 1.05, n.r * 1.6, A.body.pos.y + 0.25, 16, 1, true, Math.PI * 0.62, Math.PI * 0.76);
    const m = k.mesh(geo, shade(c.acc, -0.2), null, V(n.pos.x, (n.pos.y) / 2 + 0.05, n.pos.z - 0.05), [1, 1, 1], null, { side: THREE.DoubleSide });
    m.userData.sharedGeo = false;
  }
  if (x.includes('hat_top')) hatTop(k, H, top, '#1e2a2a', '#c83a3a');
  if (x.includes('hat_wizard')) {
    k.cyl(c.acc, H, top.x, top.y + 0.01, top.z, A.head.rx * 1.15, 0.03);
    const cn = k.cone(c.acc, H, top.x, top.y + 0.22, top.z - 0.02, A.head.rx * 0.75, 0.42, [-0.25, 0, 0.15]);
    cn.name = 'hatTip';
    k.sph('#f4d23a', H, top.x - 0.05, top.y + 0.12, top.z + 0.12, 0.025, 0.025, 0.012, null, { noOutline: true });
  }
  if (x.includes('hat_gnome')) k.cone(c.acc, H, top.x, top.y + 0.2, top.z - 0.02, A.head.rx * 0.95, 0.5, [-0.2, 0, 0.12]);
  if (x.includes('cap')) {
    const p = A.fish ? V(0, 0.95, 0.15) : top;
    const parent = A.fish ? k.root : H;
    k.hemi(c.acc, parent, p.x, p.y - 0.03, p.z, 0.2, 0.12, 0.2);
    k.cyl(shade(c.acc, -0.3), parent, p.x, p.y - 0.03, p.z + 0.16, 0.12, 0.02);
    k.sph('#f4d23a', parent, p.x, p.y + 0.04, p.z + 0.19, 0.03, 0.03, 0.01, null, { noOutline: true });
  }
  if (x.includes('headscarf')) {
    k.hemi('#f4ead0', H, 0, A.head.ry * 0.05, -0.02, A.head.rx * 1.08, A.head.ry * 1.05, A.head.rz * 1.05);
  }
  if (x.includes('halo')) k.mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24), '#f4d23a', H, V(top.x, top.y + 0.16, top.z), [1, 1, 1], [Math.PI / 2, 0, 0], { emissive: '#f4d23a', emissiveIntensity: 0.6, noOutline: true });
  if (x.includes('flower') && spec.horn !== 'antlers') {
    k.sph(c.acc, H, top.x + 0.1, top.y, top.z + 0.05, 0.07, 0.04, 0.07);
    k.sph('#ffe86a', H, top.x + 0.1, top.y + 0.03, top.z + 0.05, 0.03);
  }
  if (x.includes('leaf_head')) k.sph(c.acc, H, top.x + 0.05, top.y + 0.1, top.z, 0.05, 0.16, 0.035, [0, 0, -0.5]);
  if (x.includes('snowcap')) k.hemi('#ffffff', H, top.x, top.y - 0.1, top.z, A.head.rx * 1.08, A.head.ry * 0.6, A.head.rz * 1.08);
  if (x.includes('pipe')) {
    const s = onHead(A, A.eyeX * 0.6, A.mouthY, 0.02);
    k.limb('#6a4a2a', H, s.p, s.p.clone().add(V(0.12, -0.03, 0.08)), 0.015);
    k.cyl('#6a4a2a', H, s.p.x + 0.14, s.p.y, s.p.z + 0.09, 0.03, 0.07);
  }
  if (x.includes('drip')) for (const [dx, dz] of [[-0.18, 0.1], [0.2, 0.05], [0.05, -0.1]]) k.sph('#7ac8ff', null, A.body.pos.x + dx, 0.06, A.body.pos.z + dz, 0.04, 0.06, 0.04, null, { opacity: 0.85 });
  if (x.includes('sickle')) {
    const g = k.group(null, 0.55, 0.5, 0.1, 'sickle');
    k.cyl('#8a5a3a', g, 0, 0, 0, 0.025, 0.7);
    k.mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI * 1.1), '#c8ced8', g, V(-0.2, 0.35, 0), [1, 1, 0.5], [0, 0, 0], { metal: true });
  }
}

function hatTop(k, H, top, color, band) {
  k.cyl(color, H, top.x, top.y + 0.01, top.z, 0.26, 0.03);
  k.cyl(color, H, top.x, top.y + 0.16, top.z, 0.16, 0.3);
  k.cyl(band, H, top.x, top.y + 0.06, top.z, 0.165, 0.05, null, { noOutline: true });
}

// ---------- kosmetické čepice (předměty hráčů) ----------
export const HAT_BUILDERS = {
  cepice_ksiltovka(k, H, top) {
    k.hemi('#e8443a', H, top.x, top.y - 0.04, top.z, 0.22, 0.14, 0.22);
    k.cyl('#e8443a', H, top.x, top.y - 0.04, top.z + 0.17, 0.13, 0.02, [0.15, 0, 0]);
    k.sph('#ffffff', H, top.x, top.y + 0.04, top.z + 0.2, 0.05, 0.03, 0.01, null, { noOutline: true });
  },
  cepice_cylindr(k, H, top) { hatTop(k, H, top, '#1e1e2a', '#8a4ad8'); },
  cepice_kouzelnicka(k, H, top) {
    k.cyl('#5a3ab0', H, top.x, top.y, top.z, 0.28, 0.03);
    k.cone('#5a3ab0', H, top.x, top.y + 0.24, top.z - 0.02, 0.18, 0.46, [-0.25, 0, 0.15]);
    for (const [x, y] of [[-0.06, 0.12], [0.05, 0.25]]) k.sph('#f4d23a', H, top.x + x, top.y + y, top.z + 0.1, 0.025, 0.025, 0.012, null, { noOutline: true, basic: true });
  },
  cepice_koruna(k, H, top) {
    const g = k.group(H, top.x, top.y - 0.03, top.z);
    k.mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.09, 16, 1, true), '#f4c63a', g, V(0, 0.04, 0), [1, 1, 1], null, { side: THREE.DoubleSide, metal: true });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.cone('#f4c63a', g, Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15, 0.035, 0.08, null, { metal: true }); }
    k.sph('#3a8ae8', g, 0, 0.04, 0.16, 0.03, 0.03, 0.02, null, { noOutline: true });
  },
  cepice_beranice(k, H, top) {
    k.cyl('#5a4030', H, top.x, top.y + 0.06, top.z, 0.22, 0.18);
    k.hemi('#5a4030', H, top.x, top.y + 0.14, top.z, 0.22, 0.08, 0.22);
    for (const sx of [-1, 1]) k.sph('#5a4030', H, top.x + sx * 0.24, top.y - 0.08, top.z, 0.07, 0.14, 0.09);
  },
  cepice_kucharska(k, H, top) {
    k.cyl('#ffffff', H, top.x, top.y + 0.06, top.z, 0.17, 0.12);
    k.sph('#ffffff', H, top.x, top.y + 0.2, top.z, 0.22, 0.14, 0.22);
  },
  cepice_party(k, H, top) {
    k.cone('#f058a8', H, top.x, top.y + 0.16, top.z, 0.12, 0.32, [0, 0, 0.1]);
    k.sph('#f4d23a', H, top.x + 0.03, top.y + 0.33, top.z, 0.045);
    k.mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16), '#4ab0f0', H, V(top.x + 0.01, top.y + 0.06, top.z), [1, 1, 1], [Math.PI / 2, 0, 0.1], { noOutline: true });
  },
  cepice_slamak(k, H, top) {
    k.cyl('#e8c86a', H, top.x, top.y, top.z, 0.34, 0.025);
    k.cyl('#e8c86a', H, top.x, top.y + 0.07, top.z, 0.16, 0.12);
    k.cyl('#c83a3a', H, top.x, top.y + 0.03, top.z, 0.165, 0.035, null, { noOutline: true });
  },
  cepice_masle(k, H, top) {
    for (const sx of [-1, 1]) k.sph('#f058a8', H, top.x + sx * 0.09, top.y + 0.02, top.z + 0.04, 0.09, 0.06, 0.04, [0, 0, sx * 0.4]);
    k.sph('#d03a88', H, top.x, top.y + 0.02, top.z + 0.05, 0.035);
  },
  cepice_venecek(k, H, top) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.sph(['#ff7aa8', '#ffe86a', '#ffffff', '#8ac8ff'][i % 4], H, top.x + Math.cos(a) * 0.17, top.y - 0.04, top.z + Math.sin(a) * 0.17, 0.045);
    }
  },
  cepice_helma(k, H, top) {
    k.hemi('#d83a2a', H, top.x, top.y - 0.08, top.z, 0.25, 0.2, 0.25);
    k.cyl('#d83a2a', H, top.x, top.y - 0.08, top.z - 0.08, 0.27, 0.02, [-0.15, 0, 0]);
    k.box('#f4d23a', H, top.x, top.y + 0.02, top.z + 0.2, 0.06, 0.08, 0.02, null, { noOutline: true });
  },
  cepice_kulich(k, H, top) {
    k.hemi('#3a8ae8', H, top.x, top.y - 0.07, top.z, 0.23, 0.2, 0.23);
    k.cyl('#ffffff', H, top.x, top.y - 0.07, top.z, 0.235, 0.05, null, { noOutline: true });
    k.sph('#ffffff', H, top.x, top.y + 0.15, top.z, 0.07);
  },
};

// ---------- sestavení ----------
const templates = new Map();
let customModels = new Set();
let gltfLoader = null;
const customCache = new Map();

export async function loadCustomModelList() {
  try {
    const r = await fetch('/api/models');
    if (r.ok) customModels = new Set(await r.json());
  } catch { /* bez vlastních modelů */ }
}

export function creatureScale(key) {
  const sp = SPECIES[key];
  return 0.62 + 0.45 * ((sp && sp.art.s) || 0.6);
}

function buildProcedural(key, opts) {
  const sp = SPECIES[key];
  const spec = sp.art;
  const c = creatureColors(spec, opts.shiny);
  const k = new Kit(c);
  const m = Math.max(0, Math.min(1, ((spec.s || 0.6) - 0.5) / 0.5));
  const body = BODIES[spec.b] || BODIES.blob;
  const A = body(k, c, m, spec);
  wings(k, c, spec, A);
  tail(k, c, spec, A);
  back(k, c, spec, A);
  ears(k, c, spec, A);
  horns(k, c, spec, A);
  marks(k, c, spec, A);
  eyes(k, c, spec, A);
  mouth(k, c, spec, A);
  extras(k, c, spec, A);
  if (opts.hat && HAT_BUILDERS[opts.hat] && !A.fish) HAT_BUILDERS[opts.hat](k, A.head.g, A.top.clone().add(V(0, 0.02, 0)));
  else if (opts.hat && HAT_BUILDERS[opts.hat]) HAT_BUILDERS[opts.hat](k, k.root, V(0, 0.98, 0.15));
  if ((spec.x || []).includes('glow') || (spec.x || []).includes('aura')) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: (spec.x || []).includes('aura') ? c.acc : c.main, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(2.2, 2.2, 1);
    glow.position.set(0, 0.6, -0.2);
    glow.name = 'glow';
    k.root.add(glow);
  }
  const inner = new THREE.Group();
  inner.name = 'inner';
  while (k.root.children.length) inner.add(k.root.children[0]);
  const sc = creatureScale(key);
  inner.scale.setScalar(sc);
  const root = new THREE.Group();
  root.add(inner);
  addOutlines(inner, 0.018, c.line);
  const bb = meshBounds(root);
  root.userData = {
    key, float: (A.float || 0) * sc, height: bb.max.y + (A.float || 0) * sc, radius: Math.max(bb.max.x, -bb.min.x, bb.max.z, -bb.min.z),
    fx: spec.x || [], wing: spec.wing, body: spec.b,
  };
  return root;
}

function normalizeCustom(scene, key) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const target = 1.2 * creatureScale(key);
  const s = target / Math.max(0.001, size.y);
  scene.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(scene);
  const center = box2.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= box2.min.y;
  scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
}

async function loadCustom(key) {
  if (customCache.has(key)) return customCache.get(key);
  const p = (async () => {
    if (!gltfLoader) {
      const mod = await import('three/addons/loaders/GLTFLoader.js');
      gltfLoader = new mod.GLTFLoader();
    }
    const gltf = await gltfLoader.loadAsync(`/models/${key}.glb`);
    normalizeCustom(gltf.scene, key);
    return gltf.scene;
  })();
  customCache.set(key, p);
  return p;
}

// Vrátí nový 3D model tvora (klon šablony). opts: { shiny, hat }
export function buildCreature(key, opts = {}) {
  if (!SPECIES[key]) key = 'hlodik';
  if (customModels.has(key)) {
    const holder = new THREE.Group();
    holder.userData = { key, float: 0, height: 1.2 * creatureScale(key), radius: 0.5 * creatureScale(key), fx: [], custom: true };
    const inner = new THREE.Group();
    inner.name = 'inner';
    holder.add(inner);
    loadCustom(key).then((scene) => { inner.add(scene.clone(true)); }).catch(() => {
      customModels.delete(key);
      const proc = buildCreature(key, opts);
      holder.remove(inner);
      holder.add(proc.children[0]);
      Object.assign(holder.userData, proc.userData, { custom: false });
    });
    return holder;
  }
  const tk = `${key}|${opts.shiny ? 1 : 0}|${opts.hat || ''}`;
  let t = templates.get(tk);
  if (!t) { t = buildProcedural(key, opts); templates.set(tk, t); }
  const clone = t.clone(true);
  clone.userData = { ...t.userData };
  return clone;
}

function meshBounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(tmp);
  });
  return box;
}

// Zjednodušený model (geometrie sloučené podle materiálu) pro tvory, kteří chodí za hráči:
// místo desítek vykreslovacích volání jich stačí pár.
const liteTemplates = new Map();
export function buildCreatureLite(key, opts = {}) {
  if (!SPECIES[key]) key = 'hlodik';
  if (customModels.has(key)) return buildCreature(key, opts);
  const tk = `${key}|${opts.shiny ? 1 : 0}|${opts.hat || ''}`;
  let t = liteTemplates.get(tk);
  if (!t) { t = mergeTemplate(buildCreature(key, opts)); liteTemplates.set(tk, t); }
  const clone = t.clone(true);
  clone.userData = { ...t.userData };
  return clone;
}

function flipWinding(geo) {
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) { const a = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = a; }
}

function mergeTemplate(full) {
  full.updateMatrixWorld(true);
  const byMat = new Map();
  const outlineGeos = [];
  const sprites = [];
  let olMat = null;
  full.traverse((o) => {
    if (o.isMesh && o.userData.isOutline) { olMat = olMat || o.material; return; }
    if (o.isMesh) {
      const geo = o.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
      geo.applyMatrix4(o.matrixWorld);
      if (o.matrixWorld.determinant() < 0) flipWinding(geo);
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(geo);
      if (!o.userData.noOutline) outlineGeos.push(geo);
    } else if (o.isSprite) sprites.push(o);
  });
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.name = 'inner';
  root.add(inner);
  for (const [mat, geos] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.castShadow = true;
    inner.add(m);
  }
  if (olMat && outlineGeos.length) {
    const ol = new THREE.Mesh(mergeGeometries(outlineGeos, false), olMat);
    ol.userData.isOutline = true;
    inner.add(ol);
  }
  for (const sp of sprites) {
    const c = sp.clone();
    sp.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    inner.add(c);
  }
  root.userData = { ...full.userData, lite: true };
  return root;
}

// Jemná „dechová“ animace v klidu + mávání křídly, vrtění ocasem, plápolání.
// opts.hop = výskok (např. při chůzi), opts.calm = klidnější dech.
export function animateCreature(obj, t, opts = {}) {
  const ud = obj.userData;
  if (!ud.parts) {
    ud.parts = {
      inner: obj.getObjectByName('inner'), tail: obj.getObjectByName('tail'), wingL: obj.getObjectByName('wingL'), wingR: obj.getObjectByName('wingR'),
      head: obj.getObjectByName('head'), orbit: obj.getObjectByName('orbit'), tentacles: obj.getObjectByName('tentacles'), flames: [], glows: [],
    };
    obj.traverse((o) => {
      if (o.name === 'flame') { o.userData.sy0 = o.scale.y; ud.parts.flames.push(o); }
      if (o.name === 'glow') ud.parts.glows.push(o);
    });
    ud.baseScale = ud.parts.inner ? ud.parts.inner.scale.x : 1;
    ud.phase = Math.random() * 10;
  }
  const P = ud.parts;
  const inner = P.inner;
  if (!inner) return;
  const tt = t + ud.phase;
  const base = ud.baseScale;
  const breathe = 1 + Math.sin(tt * 2.4) * (opts.calm ? 0.012 : 0.025);
  inner.scale.set(base * (2 - breathe) ** 0.5, base * breathe, base * (2 - breathe) ** 0.5);
  inner.position.y = (ud.float ? ud.float + Math.sin(tt * 2) * 0.06 * base : 0) + (opts.hop || 0);
  if (P.tail) P.tail.rotation.y = Math.sin(tt * 3.2) * 0.35;
  const fast = ud.wing === 'insect' || ud.wing === 'butterfly';
  const flap = fast ? Math.sin(tt * 14) * 0.5 : Math.sin(tt * 4) * 0.25 + (opts.flap || 0);
  if (P.wingL) P.wingL.rotation.z = -flap;
  if (P.wingR) P.wingR.rotation.z = flap;
  if (P.head && !P.head.userData.fishHead) P.head.rotation.z = Math.sin(tt * 1.3) * 0.05;
  if (P.orbit) P.orbit.rotation.y = tt * 0.9;
  if (P.tentacles) P.tentacles.rotation.y = Math.sin(tt * 1.5) * 0.15;
  for (const f of P.flames) f.scale.y = f.userData.sy0 * (1 + Math.sin(tt * 11 + f.id) * 0.14);
  for (const g of P.glows) g.material.opacity = 0.35 + Math.sin(tt * 3) * 0.1;
}
