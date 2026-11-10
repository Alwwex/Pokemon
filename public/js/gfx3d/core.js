// Společné 3D pomůcky: kreslený (toon) materiál, obrysy, sdílené geometrie.
import * as THREE from 'three';

export { THREE };

let gradientTex = null;
export function toonGradient() {
  if (gradientTex) return gradientTex;
  const data = new Uint8Array([95, 175, 255]);
  gradientTex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradientTex.minFilter = THREE.NearestFilter;
  gradientTex.magFilter = THREE.NearestFilter;
  gradientTex.generateMipmaps = false;
  gradientTex.needsUpdate = true;
  return gradientTex;
}

// Jemnější kreslené stínování pro modely s texturou (tvrdé stupně by na nich udělaly tmavé fleky).
let softTex = null;
export function softToonGradient() {
  if (softTex) return softTex;
  const data = new Uint8Array([150, 205, 238, 255]);
  softTex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  softTex.minFilter = THREE.NearestFilter;
  softTex.magFilter = THREE.NearestFilter;
  softTex.generateMipmaps = false;
  softTex.needsUpdate = true;
  return softTex;
}

const matCache = new Map();
// Toon materiál s mezipamětí podle barvy a voleb.
export function toon(color, o = {}) {
  const key = `${color}|${o.opacity ?? 1}|${o.emissive || ''}|${o.side || 0}|${o.basic ? 1 : 0}|${o.metal ? 1 : 0}`;
  let m = matCache.get(key);
  if (m) return m;
  if (o.basic) m = new THREE.MeshBasicMaterial({ color });
  else if (o.metal) m = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0x888888 });
  else m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
  if (o.emissive && !o.basic) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 0.6; }
  if (o.opacity != null && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.side) m.side = o.side;
  matCache.set(key, m);
  return m;
}

// „Průhled“: objekty mezi kamerou a hráčem se rastrově zprůhlední, aby hráče nezakrývaly.
export const XRAY = {
  p: { value: new THREE.Vector3(0, -999, 0) },
  c: { value: new THREE.Vector3(0, 10, 10) },
  r: { value: 0.95 },
};

function xrayVertex(src) {
  return 'varying vec3 vXrayW;\n' + src.replace('#include <project_vertex>', `#include <project_vertex>
  vec4 xrW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  xrW = instanceMatrix * xrW;
  #endif
  vXrayW = (modelMatrix * xrW).xyz;`);
}

function xrayFragment(src) {
  return 'uniform vec3 uXrayP;\nuniform vec3 uXrayC;\nuniform float uXrayR;\nvarying vec3 vXrayW;\n' + src.replace('void main() {', `void main() {
  {
    vec3 xcp = uXrayP - uXrayC;
    float xL = length(xcp);
    vec3 xdv = xcp / xL;
    vec3 xcf = vXrayW - uXrayC;
    float xt = dot(xcf, xdv);
    if (xt > 0.0 && xt < xL - 0.9) {
      float xd = length(xcf - xdv * xt);
      float xk = 1.0 - smoothstep(uXrayR * 0.5, uXrayR, xd);
      vec2 xq = mod(floor(gl_FragCoord.xy), 2.0);
      float xb = xq.x * 2.0 + xq.y;
      float xth = xb < 0.5 ? 0.12 : xb > 2.5 ? 0.4 : xb < 1.5 ? 0.7 : 2.0;
      if (xk > xth) discard;
    }
  }`);
}

function addXray(sh) {
  sh.uniforms.uXrayP = XRAY.p;
  sh.uniforms.uXrayC = XRAY.c;
  sh.uniforms.uXrayR = XRAY.r;
  sh.vertexShader = xrayVertex(sh.vertexShader);
  sh.fragmentShader = xrayFragment(sh.fragmentShader);
}

// Toon materiál pro svět (stěny, stromy, budovy) – s průhledem.
const worldCache = new Map();
export function worldToon(color, o = {}) {
  const key = `${color}|${o.emissive || ''}|${o.side || 0}|${o.opacity ?? 1}|${o.vertexColors ? 1 : 0}`;
  let m = worldCache.get(key);
  if (m) return m;
  m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), vertexColors: !!o.vertexColors });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 0.6; }
  if (o.opacity != null && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.side) m.side = o.side;
  m.onBeforeCompile = addXray;
  m.customProgramCacheKey = () => 'xray';
  worldCache.set(key, m);
  return m;
}

// Vlastní (nesdílená) instance světového materiálu – např. okna, která v noci svítí.
export function worldToonUnique(color, o = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 0.6; }
  if (!o.noXray) { m.onBeforeCompile = addXray; m.customProgramCacheKey = () => 'xray'; }
  return m;
}

export function patchXray(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); addXray(sh); };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.customProgramCacheKey = () => key + '|xray';
  return m;
}

// Obrysový materiál: zadní strany vysunuté podél normál v prostoru kamery.
const outlineCache = new Map();
export function outlineMat(color = '#1c1424', thickness = 0.02, xray = false) {
  const key = `${color}|${thickness}|${xray ? 1 : 0}`;
  if (xray && outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.userData.outline = { value: thickness };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.outlineW = m.userData.outline;
    sh.vertexShader = 'uniform float outlineW;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vec3 olObjN = normal;\n#ifdef USE_INSTANCING\n  olObjN = mat3(instanceMatrix) * olObjN;\n#endif\n  vec3 olN = normalize(normalMatrix * olObjN);\n  mvPosition.xyz += olN * outlineW;\n  gl_Position = projectionMatrix * mvPosition;',
    );
    if (xray) addXray(sh);
  };
  m.customProgramCacheKey = () => (xray ? 'outline-xray' : 'outline');
  if (xray) outlineCache.set(key, m);
  return m;
}

// Přidá ke všem meshům ve skupině obrys (sdílí geometrii, takže je levný na paměť).
export function addOutlines(root, thickness, color) {
  const mat = outlineMat(color, thickness);
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) meshes.push(o); });
  for (const m of meshes) {
    const ol = new THREE.Mesh(m.geometry, mat);
    ol.userData.isOutline = true;
    ol.castShadow = false;
    ol.raycast = () => {};
    m.add(ol);
  }
  return mat;
}

export const GEO = {
  sphere: new THREE.SphereGeometry(1, 22, 16),
  sphereLo: new THREE.SphereGeometry(1, 12, 8),
  hemi: new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cylHex: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  disc: new THREE.CircleGeometry(1, 20),
};

// Měkká kulatá textura pro částice a záři.
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

let starTex = null;
export function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.translate(32, 32);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 9 : 30;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fill();
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !Object.values(GEO).includes(o.geometry) && !o.userData.sharedGeo) o.geometry.dispose();
  });
}
