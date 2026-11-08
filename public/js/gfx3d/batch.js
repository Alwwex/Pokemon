// Slučování statické geometrie: stovky dílků mapy (stěny, ploty, nábytek…) se spojí
// do pár meshů podle materiálu, takže se svět vykreslí jen několika voláními.
import { THREE, GEO, toon, outlineMat } from './core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function prep(geo, matrix) {
  const g = geo.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const a = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = a; }
  }
  return g;
}

export class Batch {
  constructor(outlineColor = '#1c1424', outlineWidth = 0.025, opts = {}) {
    this.byMat = new Map();
    this.outline = [];
    this.outlineColor = outlineColor;
    this.outlineWidth = outlineWidth;
    this.matFn = opts.mat || toon;
    this.xray = !!opts.xray;
  }

  add(geo, mat, matrix, outline = true) {
    const g = prep(geo, matrix);
    if (!this.byMat.has(mat)) this.byMat.set(mat, []);
    this.byMat.get(mat).push(g);
    if (outline) this.outline.push(g);
    return g;
  }

  // Pomocník: geometrie + barva + poloha/otočení/měřítko.
  put(geo, color, x, y, z, sx, sy, sz, ry = 0, o = {}) {
    _e.set(o.rx || 0, ry, o.rz || 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    return this.add(geo, typeof color === 'string' ? this.matFn(color, o) : color, _m, o.outline !== false);
  }

  box(color, x, y, z, w, h, d, ry = 0, o) { return this.put(GEO.box, color, x, y, z, w, h, d, ry, o); }
  // válec stojící na zemi (y = spodní podstava)
  cyl(color, x, y, z, r, h, o = {}) { return this.put(o.hex ? GEO.cylHex : GEO.cyl, color, x, y + h / 2, z, r, h, o.rz2 || r, o.ry || 0, o); }
  cone(color, x, y, z, r, h, o = {}) { return this.put(GEO.cone, color, x, y + h / 2, z, r, h, r, o.ry || 0, o); }
  sphere(color, x, y, z, rx, ry = rx, rz = rx, o = {}) { return this.put(o.lo ? GEO.sphereLo : GEO.sphere, color, x, y, z, rx, ry, rz, o.ry || 0, o); }

  build(parent, opts = {}) {
    const out = [];
    for (const [mat, geos] of this.byMat) {
      const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
      m.castShadow = opts.castShadow !== false;
      m.receiveShadow = opts.receiveShadow !== false;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      parent.add(m);
      out.push(m);
    }
    if (this.outline.length) {
      const ol = new THREE.Mesh(mergeGeometries(this.outline, false), outlineMat(this.outlineColor, this.outlineWidth, this.xray));
      ol.matrixAutoUpdate = false;
      ol.updateMatrix();
      ol.userData.isOutline = true;
      parent.add(ol);
      out.push(ol);
    }
    for (const geos of this.byMat.values()) for (const g of geos) g.dispose();
    this.byMat.clear();
    this.outline = [];
    return out;
  }
}

// Instancované objekty (stromy, keře, tráva): jedna geometrie, mnoho kopií.
export class Instancer {
  constructor(geo, mat, outline = null) {
    this.geo = geo;
    this.mat = mat;
    this.outline = outline;
    this.items = [];
  }

  push(x, y, z, sx, sy, sz, ry = 0, color = null) {
    _e.set(0, ry, 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    this.items.push({ m: new THREE.Matrix4().compose(_p, _q, _s), c: color });
  }

  build(parent, opts = {}) {
    if (!this.items.length) return null;
    const n = this.items.length;
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, n);
    const col = new THREE.Color();
    this.items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      if (it.c) mesh.setColorAt(i, col.set(it.c));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = !!opts.receiveShadow;
    mesh.frustumCulled = false;
    parent.add(mesh);
    if (this.outline) {
      const ol = new THREE.InstancedMesh(this.geo, this.outline, n);
      this.items.forEach((it, i) => ol.setMatrixAt(i, it.m));
      ol.frustumCulled = false;
      ol.userData.isOutline = true;
      parent.add(ol);
    }
    return mesh;
  }
}

// Geometrie složená z více dílů (např. strom = kmen + koruna) pro instancování.
export function compose(parts) {
  const geos = parts.map(([geo, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0]) => {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    return prep(geo, _m);
  });
  const g = mergeGeometries(geos, false);
  for (const x of geos) x.dispose();
  return g;
}

// Barevné vrcholy: složená geometrie, kde každý díl má vlastní barvu (pro instancování s jedním materiálem).
export function composeColored(parts) {
  const geos = parts.map(([geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0]) => {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    const g = prep(geo, _m);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const g = mergeGeometries(geos, false);
  for (const x of geos) x.dispose();
  return g;
}
