// Stavba 3D podoby mapy z dlaždic: malovaný terén, voda s vlnami, stromy, tráva, skály,
// budovy podle stylu, nábytek v interiérech. Statické díly se slučují (Batch), opakované
// se instancují (Instancer), takže i velká mapa je jen pár vykreslovacích volání.
import { THREE, GEO, worldToon, worldToonUnique, outlineMat, glowTexture, toonGradient } from './core.js';
import { Batch, Instancer, compose } from './batch.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { themeOf } from '../gfx/tiles.js';
import { shade, mix, hash2 } from '../gfx/util.js';
import { buildCreatureLite } from './mon3d.js';

export const OUTDOOR = new Set(['town', 'route', 'forest', 'swamp', 'snow', 'mountain']);
const S = 32; // pixelů textury na dlaždici
const OL = '#1c1424';

const SOLIDISH = new Set(['T', 'P', 't', 'o', 'f', '#', 'C', 'K', 'w', 'Q', 'G', 'z', 'l', '^']);

// ---------- pomocníci ----------
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Plátno v paměti (bez GPU): čtení pixelů pak nečeká na grafickou kartu.
function cpuCtx(c) { return c.getContext('2d', { willReadFrequently: true }); }

function rnd(x, y, s) { return hash2(x, y, s); }

function at(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
  return map.rows[y][x];
}

// Hladká maska: hodnota dlaždicové mřížky v bodě (u, v) v souřadnicích dlaždic,
// interpolovaná „smoothstep“ váhami → zakulacené rohy cest, písku a vody.
function gridOf(map, pred) {
  const gw = map.w;
  const gh = map.h;
  const g = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) g[y * gw + x] = pred(map.rows[y][x], x, y) ? 1 : 0;
  return { g, gw, gh };
}

function sampleGrid(G, u, v) {
  const x = u - 0.5;
  const y = v - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  let fx = x - x0;
  let fy = y - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const get = (xx, yy) => G.g[Math.max(0, Math.min(G.gh - 1, yy)) * G.gw + Math.max(0, Math.min(G.gw - 1, xx))];
  const a = get(x0, y0);
  const b = get(x0 + 1, y0);
  const c = get(x0, y0 + 1);
  const d = get(x0 + 1, y0 + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function patternData(kind, T, seed) {
  const c = patternCanvas(kind, T, seed);
  return c.getContext('2d').getImageData(0, 0, 64, 64).data;
}

// Vzorek (dlaždice textury 64×64) pro typ povrchu.
function patternCanvas(kind, T, seed = 1) {
  const c = canvas(64, 64);
  const g = cpuCtx(c);
  const R = (i) => rnd(i, seed, 77);
  const dots = (cols, n, rmin, rmax) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[i % cols.length];
      const x = R(i * 3) * 64;
      const y = R(i * 3 + 1) * 64;
      const r = rmin + R(i * 3 + 2) * (rmax - rmin);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  switch (kind) {
    case 'grass':
      g.fillStyle = T.grass;
      g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = i % 3 ? T.grass2 : T.grass3;
        g.lineWidth = 1.2;
        const x = R(i * 2) * 64;
        const y = R(i * 2 + 1) * 64;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (R(i + 300) - 0.5) * 3, y - 3 - R(i + 400) * 3);
        g.stroke();
      }
      break;
    case 'path':
      g.fillStyle = T.path;
      g.fillRect(0, 0, 64, 64);
      dots([T.path2, T.path3, T.path2], 34, 1, 2.6);
      break;
    case 'sand':
      g.fillStyle = T.sand;
      g.fillRect(0, 0, 64, 64);
      dots([T.sand2, shade(T.sand, 0.08)], 40, 0.6, 1.4);
      break;
    case 'snow':
      g.fillStyle = '#f4f8ff';
      g.fillRect(0, 0, 64, 64);
      dots(['#dfeaf7', '#ffffff'], 26, 1, 3);
      break;
    case 'dirt':
      g.fillStyle = '#a8865a';
      g.fillRect(0, 0, 64, 64);
      dots(['#8e6e46', '#bc9a6c'], 36, 0.8, 2.2);
      break;
    case 'cave': {
      const C = { floor: '#86766a', floor2: '#72645a', floor3: '#988a7c' };
      g.fillStyle = C.floor;
      g.fillRect(0, 0, 64, 64);
      dots([C.floor2, C.floor3], 30, 1.5, 5);
      break;
    }
    case 'ice':
      g.fillStyle = '#c4e6fa';
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const x = R(i) * 64; const y = R(i + 9) * 64; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y - 7); g.stroke(); }
      break;
    case 'floor': // dřevěná podlaha
      g.fillStyle = T.floor;
      g.fillRect(0, 0, 64, 64);
      for (let r = 0; r < 4; r++) {
        g.fillStyle = shade(T.floor, (r % 2 ? -0.04 : 0.03));
        g.fillRect(0, r * 16, 64, 15);
        g.fillStyle = T.floor2;
        g.fillRect(0, r * 16 + 15, 64, 1);
        g.fillRect(((r * 23) % 64), r * 16, 1, 15);
        g.fillRect(((r * 23 + 37) % 64), r * 16, 1, 15);
      }
      break;
    case 'stone':
      g.fillStyle = T.floor;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = T.floor2;
      for (let r = 0; r < 4; r++) {
        g.fillRect(0, r * 16 + 15, 64, 1);
        for (let k = 0; k < 3; k++) g.fillRect(((k * 24 + (r % 2) * 12) % 64), r * 16, 1, 15);
      }
      break;
    case 'gym':
      g.fillStyle = T.floor;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = T.floor3;
      g.fillRect(2, 2, 28, 28);
      g.fillRect(34, 34, 28, 28);
      g.fillStyle = T.floor2;
      g.fillRect(0, 31, 64, 2);
      g.fillRect(31, 0, 2, 64);
      break;
    case 'tile':
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#e8e4dc' : '#f8f6f0'; g.fillRect(x * 16, y * 16, 16, 16); }
      break;
    default:
      g.fillStyle = '#888';
      g.fillRect(0, 0, 64, 64);
  }
  return c;
}

// ---------- malovaný terén ----------
function paintGround(map, T, indoor) {
  const W = map.w * S;
  const H = map.h * S;
  const c = canvas(W, H);
  const g = cpuCtx(c);
  const theme = map.theme;
  const img = g.createImageData(W, H);
  const D = img.data;
  const baseKind = theme === 'cave' ? 'cave' : theme === 'castle' ? 'stone' : theme === 'gym' ? 'gym' : indoor ? 'floor' : 'grass';
  const base = patternData(baseKind, T, 1);
  for (let y = 0; y < H; y++) {
    const row = (y & 63) * 64;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const j = (row + (x & 63)) * 4;
      D[i] = base[j]; D[i + 1] = base[j + 1]; D[i + 2] = base[j + 2]; D[i + 3] = 255;
    }
  }
  const has = (chars) => map.rows.some((r) => [...chars].some((ch) => r.includes(ch)));
  const kinds = [['d', 'dirt'], [':', 'path'], ['s', 'sand'], ['x', 'snow'], ['i', 'ice']];
  if (theme !== 'cave') kinds.push(['cQ', 'cave']);
  if (!indoor && has('_')) kinds.push(['_', 'stone']);
  const blendLayer = (G, pat, soft, colorOverride) => {
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        // přeskoč dlaždice, kolem kterých nic není
        let any = false;
        for (let dy = -1; dy <= 1 && !any; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = tx + dx; const yy = ty + dy; if (xx >= 0 && yy >= 0 && xx < map.w && yy < map.h && G.g[yy * map.w + xx]) { any = true; break; } }
        if (!any) continue;
        for (let py = ty * S; py < ty * S + S; py++) {
          for (let px = tx * S; px < tx * S + S; px++) {
            const v = sampleGrid(G, (px + 0.5) / S, (py + 0.5) / S);
            const a = v <= 0.5 - soft ? 0 : v >= 0.5 + soft ? 1 : (v - (0.5 - soft)) / (2 * soft);
            if (a <= 0) continue;
            const i = (py * W + px) * 4;
            let r;
            let gg;
            let b;
            if (colorOverride) { [r, gg, b] = colorOverride; } else { const j = (((py & 63) * 64) + (px & 63)) * 4; r = pat[j]; gg = pat[j + 1]; b = pat[j + 2]; }
            D[i] += (r - D[i]) * a;
            D[i + 1] += (gg - D[i + 1]) * a;
            D[i + 2] += (b - D[i + 2]) * a;
          }
        }
      }
    }
  };
  for (const [chars, kind] of kinds) {
    if (!has(chars)) continue;
    blendLayer(gridOf(map, (ch) => chars.includes(ch)), patternData(kind, T, chars.charCodeAt(0)), kind === 'ice' ? 0.03 : 0.07);
  }
  // voda: průhledné díry + písčitý/bahnitý břeh
  if (has('~=')) {
    const isW = (ch) => ch === '~' || ch === '=';
    const near = gridOf(map, (ch, x, y) => {
      if (isW(ch)) return true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const r = map.rows[y + dy]; if (r && isW(r[x + dx])) return true; }
      return false;
    });
    const shoreCol = theme === 'swamp' ? [106, 90, 58] : theme === 'snow' ? [200, 216, 232] : hexRgb(T.sand2 || '#e0c88a');
    const WG = gridOf(map, isW);
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (!near.g[ty * map.w + tx]) continue;
        for (let py = ty * S; py < ty * S + S; py++) {
          for (let px = tx * S; px < tx * S + S; px++) {
            const u = (px + 0.5) / S;
            const v = (py + 0.5) / S;
            const i = (py * W + px) * 4;
            const w = sampleGrid(WG, u, v);
            if (w > 0.5) { D[i + 3] = 0; continue; }
            const sh = Math.min(1, Math.max(0, (w - 0.18) / 0.22)) * 0.9;
            if (sh > 0) {
              D[i] += (shoreCol[0] - D[i]) * sh;
              D[i + 1] += (shoreCol[1] - D[i + 1]) * sh;
              D[i + 2] += (shoreCol[2] - D[i + 2]) * sh;
            }
          }
        }
      }
    }
  }
  // tmavší podklad pod vysokou trávou a měkké stíny pod stromy (přímo v pixelech – rychlé)
  const tall = hexRgb(mix(T.tall2, T.grass2, 0.35));
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const ch = map.rows[ty][tx];
      if (ch === ',') {
        const cx = tx * S + S / 2;
        const cy = ty * S + S / 2;
        for (let py = Math.max(0, ty * S - 4); py < Math.min(H, ty * S + S + 4); py++) {
          for (let px = Math.max(0, tx * S - 4); px < Math.min(W, tx * S + S + 4); px++) {
            const dx = (px - cx) / (S * 0.62);
            const dy = (py - cy) / (S * 0.58);
            const d = dx * dx + dy * dy;
            if (d >= 1) continue;
            const a = 0.5 * Math.min(1, (1 - d) * 3);
            const i = (py * W + px) * 4;
            D[i] += (tall[0] - D[i]) * a;
            D[i + 1] += (tall[1] - D[i + 1]) * a;
            D[i + 2] += (tall[2] - D[i + 2]) * a;
          }
        }
      } else if ('TPto'.includes(ch) && !indoor) {
        const cx = tx * S + S / 2 + 3;
        const cy = ty * S + S / 2 + 4;
        const R = S * 0.75;
        for (let py = Math.max(0, Math.floor(cy - R)); py < Math.min(H, Math.ceil(cy + R)); py++) {
          for (let px = Math.max(0, Math.floor(cx - R)); px < Math.min(W, Math.ceil(cx + R)); px++) {
            const d = Math.hypot(px - cx, py - cy) / R;
            if (d >= 1) continue;
            const k = 1 - 0.3 * (1 - d);
            const i = (py * W + px) * 4;
            D[i] *= k; D[i + 1] *= k * 1.02; D[i + 2] *= k;
          }
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  // tvrdé hrany (interiéry)
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const ch = map.rows[y][x];
      const ox = x * S;
      const oy = y * S;
      if (ch === '-') {
        for (let k = 0; k < 4; k++) { g.fillStyle = (k + (k >> 1)) % 2 ? '#e2ddd2' : '#f8f6f0'; g.fillRect(ox + (k % 2) * 16, oy + (k >> 1) * 16, 16, 16); }
      } else if (ch === 'r') {
        g.fillStyle = '#c0484a';
        g.fillRect(ox, oy, S, S);
        g.fillStyle = '#e8c060';
        if (at(map, x, y - 1) !== 'r') g.fillRect(ox, oy + 3, S, 3);
        if (at(map, x, y + 1) !== 'r') g.fillRect(ox, oy + S - 6, S, 3);
        if (at(map, x - 1, y) !== 'r') g.fillRect(ox + 3, oy, 3, S);
        if (at(map, x + 1, y) !== 'r') g.fillRect(ox + S - 6, oy, 3, S);
      } else if (ch === 'm') {
        g.fillStyle = '#7a4a2e';
        g.fillRect(ox + 2, oy + 4, S - 4, S - 8);
        g.fillStyle = '#a8683a';
        for (let k = 0; k < 4; k++) g.fillRect(ox + 4, oy + 7 + k * 5, S - 8, 2);
      } else if (ch === 'g' && theme !== 'gym') {
        g.fillStyle = T.floor || '#d0c8b8';
        g.fillRect(ox, oy, S, S);
      } else if (ch === 'u') {
        g.fillStyle = '#a89a8a';
        g.fillRect(ox, oy, S, S);
        g.fillStyle = '#7a6c5e';
        for (let k = 0; k < 4; k++) g.fillRect(ox, oy + k * 8 + 6, S, 2);
      }
    }
  }
  return c;
}

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- voda ----------
function waterMesh(map, T, theme) {
  const mask = canvas(map.w * 4, map.h * 4);
  const mg = mask.getContext('2d');
  mg.fillStyle = '#000';
  mg.fillRect(0, 0, mask.width, mask.height);
  mg.filter = 'blur(2px)';
  mg.fillStyle = '#fff';
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (!'~='.includes(map.rows[y][x])) mg.fillRect(x * 4, y * 4, 4, 4);
  const tex = new THREE.CanvasTexture(mask);
  tex.colorSpace = THREE.NoColorSpace;
  const uni = { uTime: { value: 0 }, uShore: { value: tex }, uSize: { value: new THREE.Vector2(map.w, map.h) } };
  const deep = new THREE.Color(theme === 'swamp' ? '#3e6e60' : shade(T.water, -0.12));
  const mat = new THREE.MeshToonMaterial({ color: deep, gradientMap: toonGradient(), transparent: true, opacity: 0.92 });
  const hi = new THREE.Color(T.water2 || '#8fcaf6');
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.uniforms.uHi = { value: hi };
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wwp = modelMatrix * vec4(position, 1.0);
      transformed.z += sin(wwp.x * 1.3 + uTime * 1.4) * 0.025 + cos(wwp.z * 1.1 + uTime * 1.1) * 0.025;
      vWW = wwp.xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nuniform sampler2D uShore;\nuniform vec2 uSize;\nuniform vec3 uHi;\nvarying vec3 vWW;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 suv = vec2(vWW.x / uSize.x, 1.0 - vWW.z / uSize.y);
      float land = texture2D(uShore, suv).r;
      float w1 = sin(vWW.x * 2.1 + uTime * 1.2 + sin(vWW.z * 1.7 + uTime * 0.6) * 1.5);
      float w2 = sin(vWW.z * 2.6 - uTime * 1.0 + sin(vWW.x * 1.3) * 1.2);
      float crest = smoothstep(1.55, 1.85, w1 + w2);
      diffuseColor.rgb = mix(diffuseColor.rgb, uHi, crest * 0.65);
      float foam = smoothstep(0.36, 0.5, land + 0.05 * sin(uTime * 2.0 + vWW.x * 3.0 + vWW.z * 2.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), foam * 0.75);
      diffuseColor.rgb = mix(diffuseColor.rgb * 0.82, diffuseColor.rgb, smoothstep(0.0, 0.35, land));`);
  };
  mat.customProgramCacheKey = () => 'water';
  const geo = new THREE.PlaneGeometry(map.w + 2, map.h + 2, (map.w + 2) * 2, (map.h + 2) * 2);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(map.w / 2, -0.16, map.h / 2);
  m.receiveShadow = true;
  return { mesh: m, uni };
}

// ---------- vegetace ----------
const BLOB = (() => {
  const g = new THREE.IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
})();
const BLADE = new THREE.ConeGeometry(1, 1, 4);
const PINE_CONE = new THREE.ConeGeometry(1, 1, 8);
function makeTreeGeos() {
  return {
    trunk: compose([[new THREE.CylinderGeometry(1, 1.15, 1, 7), 0, 0.35, 0, 0.11, 0.7, 0.11]]),
    crown: compose([
      [BLOB, 0, 1.08, 0, 0.6, 0.55, 0.6],
      [BLOB, -0.28, 0.86, 0.12, 0.42, 0.38, 0.42],
      [BLOB, 0.3, 0.9, -0.06, 0.44, 0.4, 0.44],
      [BLOB, 0.04, 1.42, -0.04, 0.36, 0.32, 0.36],
    ]),
    snowcap: compose([[GEO.hemi, 0, 1.22, 0, 0.5, 0.36, 0.5], [GEO.hemi, 0.04, 1.6, -0.04, 0.28, 0.2, 0.28]]),
    pine: compose([
      [PINE_CONE, 0, 0.75, 0, 0.62, 0.8, 0.62],
      [PINE_CONE, 0, 1.18, 0, 0.5, 0.72, 0.5],
      [PINE_CONE, 0, 1.58, 0, 0.36, 0.62, 0.36],
    ]),
    pineSnow: compose([[PINE_CONE, 0, 1.75, 0, 0.24, 0.36, 0.24], [PINE_CONE, 0, 1.3, 0, 0.36, 0.3, 0.36]]),
    pineTrunk: compose([[new THREE.CylinderGeometry(1, 1, 1, 6), 0, 0.25, 0, 0.1, 0.5, 0.1]]),
    bush: compose([
      [BLOB, 0, 0.3, 0, 0.42, 0.34, 0.42],
      [BLOB, -0.22, 0.24, 0.1, 0.28, 0.24, 0.28],
      [BLOB, 0.24, 0.26, 0.04, 0.3, 0.26, 0.3],
    ]),
  };
}
let TREE_GEOS = null;
function markShared(o) { for (const g of Object.values(o)) g.userData.shared = true; return o; }

function grassTuft() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const r = i === 0 ? 0 : 0.16 + (i % 3) * 0.05;
    const h = 0.42 + ((i * 37) % 10) / 40;
    parts.push([BLADE, Math.cos(a) * r, h / 2, Math.sin(a) * r, 0.07, h, 0.035, Math.sin(a) * 0.25, a, -Math.cos(a) * 0.25]);
  }
  return compose(parts);
}

function grassMaterial(color, uni) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = 'uniform float uTime;\nuniform vec3 uPlayer;\nuniform vec4 uStep;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
      float hgt = max(0.0, position.y);
      float sw = sin(uTime * 1.7 + ip.x * 0.8 + ip.z * 0.6) * 0.07 + sin(uTime * 3.1 + ip.x * 2.0) * 0.02;
      transformed.x += sw * hgt * 2.0;
      vec2 dp = ip.xz - uPlayer.xz;
      float pd = length(dp);
      float push = (1.0 - smoothstep(0.25, 0.95, pd)) * 0.55;
      vec2 sd = ip.xz - uStep.xz;
      float sdd = length(sd);
      float age = uTime - uStep.w;
      push += (1.0 - smoothstep(0.0, 1.2, sdd)) * exp(-age * 4.0) * 0.6 * sin(age * 14.0);
      vec2 pdir = pd > 0.001 ? dp / pd : vec2(0.0, 1.0);
      vec3 lpush = inverse(mat3(instanceMatrix)) * vec3(pdir.x, 0.0, pdir.y);
      transformed.xz += lpush.xz * push * hgt * 1.6;
      transformed.y -= push * hgt * 0.5;`);
  };
  m.customProgramCacheKey = () => 'grass';
  return m;
}

// ---------- budovy ----------
const WALL = '#f2e6cc';
function gablePrism(depth, rise, len) {
  const sh = new THREE.Shape();
  sh.moveTo(-depth / 2, 0);
  sh.lineTo(depth / 2, 0);
  sh.lineTo(0, rise);
  sh.lineTo(-depth / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function windowAt(B, mats, x, y, z, w = 0.46, h = 0.46) {
  B.box('#ffffff', x, y, z, w + 0.1, h + 0.1, 0.06);
  B.box(mats.window, x, y, z + 0.035, w, h, 0.03, 0, { outline: false });
  B.box('#ffffff', x, y, z + 0.055, 0.04, h, 0.02, 0, { outline: false });
  B.box(shade('#ffffff', -0.15), x, y - h / 2 - 0.06, z + 0.05, w + 0.16, 0.05, 0.1);
}

function doorAt(B, x, z, color = '#7a4a2a', w = 0.62, h = 1.05) {
  B.box(shade(color, -0.35), x, h / 2, z - 0.01, w + 0.12, h + 0.08, 0.06);
  B.box(color, x, h / 2, z + 0.02, w, h, 0.05, 0, { outline: false });
  B.sphere('#f2c442', x + w * 0.32, h * 0.48, z + 0.06, 0.035, 0.035, 0.035, { outline: false });
}

function gableRoof(B, x0, z0, W, Dd, wallH, rise, color, over = 0.28) {
  const hd = Dd / 2 + over;
  const len = Math.hypot(hd, rise) + 0.04;
  const ang = Math.atan2(rise, hd);
  const cx = x0 + W / 2;
  const czm = z0 + Dd / 2;
  for (const s of [-1, 1]) {
    B.put(GEO.box, color, cx, wallH + rise / 2 - 0.02, czm + s * hd / 2, W + over * 2, 0.14, len, 0, { rx: s * ang });
    // pruhy tašek
    for (let k = 1; k < 4; k++) {
      const f = k / 4;
      B.put(GEO.box, shade(color, -0.14), cx, wallH + rise * (1 - f) + 0.05 - 0.02, czm + s * hd * f, W + over * 2 + 0.02, 0.03, 0.06, 0, { rx: s * ang, outline: false });
    }
  }
  B.put(GEO.box, shade(color, -0.25), cx, wallH + rise + 0.03, czm, W + over * 2 + 0.04, 0.1, 0.16, 0);
  B.add(gablePrism(Dd, rise, W), B.matFn(WALL), new THREE.Matrix4().makeTranslation(cx, wallH, czm), true);
}

function buildBuilding(B, b, ctx) {
  const x0 = b.x;
  const z0 = b.y;
  const W = b.w;
  const D = b.h;
  const front = z0 + D - 0.12;
  const back = z0 + 0.5;
  const Dd = front - back;
  const cz = (front + back) / 2;
  const cx = x0 + W / 2;
  const doorX = x0 + b.door + 0.5;
  const mats = ctx.mats;
  // podstavec
  const plinth = (col = '#b8a888') => B.box(col, cx, 0.06, cz, W - 0.1, 0.12, Dd + 0.1);
  switch (b.style) {
    case 'center': {
      const wallH = 1.7;
      plinth('#cfc6b8');
      B.box('#f8f4ee', cx, wallH / 2, cz, W - 0.2, wallH, Dd);
      B.box('#e25050', cx, wallH - 0.15, cz, W - 0.16, 0.3, Dd + 0.04);
      B.box('#e25050', cx, wallH + 0.12, cz, W + 0.1, 0.24, Dd + 0.4);
      B.box('#f4f0ea', cx, wallH + 0.3, cz - 0.1, W - 0.6, 0.2, Dd - 0.2);
      // znak: bílý kruh s červeným křížem
      B.put(GEO.cyl, '#ffffff', cx, wallH + 0.75, front + 0.05, 0.55, 0.12, 0.55, 0, { rx: Math.PI / 2 });
      B.box('#e25050', cx, wallH + 0.75, front + 0.12, 0.2, 0.7, 0.06, 0, { outline: false });
      B.box('#e25050', cx, wallH + 0.75, front + 0.12, 0.7, 0.2, 0.06, 0, { outline: false });
      for (let i = 0; i < W; i++) if (i !== b.door && Math.abs(i - b.door) > 0) windowAt(B, mats, x0 + i + 0.5, 0.95, front, 0.5, 0.5);
      // prosklené dveře
      B.box('#4a4a58', doorX, 0.6, front, 1.0, 1.2, 0.06);
      B.box(mats.window, doorX - 0.22, 0.58, front + 0.04, 0.4, 1.08, 0.03, 0, { outline: false });
      B.box(mats.window, doorX + 0.22, 0.58, front + 0.04, 0.4, 1.08, 0.03, 0, { outline: false });
      B.box('#e25050', doorX, 1.32, front + 0.12, 1.3, 0.12, 0.3);
      break;
    }
    case 'gym': {
      const wallH = 2.0;
      const col = b.roof || '#7a6a9a';
      plinth('#a89c8a');
      B.box('#d8d2c6', cx, wallH / 2, cz, W - 0.2, wallH, Dd);
      for (let k = 0; k < 3; k++) B.box('#bcb4a6', cx, 0.45 + k * 0.5, front + 0.005, W - 0.2, 0.04, 0.02, 0, { outline: false });
      gableRoof(B, x0 + 0.1, back, W - 0.2, Dd, wallH, 1.0, col, 0.3);
      // znak – kosočtverec
      B.put(GEO.box, '#f2c442', cx, wallH + 0.42, front + 0.25, 0.62, 0.62, 0.1, 0, { rz: Math.PI / 4 });
      B.put(GEO.box, shade(col, 0.2), cx, wallH + 0.42, front + 0.31, 0.34, 0.34, 0.06, 0, { rz: Math.PI / 4, outline: false });
      // vlajky
      for (const fx of [x0 + 0.35, x0 + W - 0.35]) {
        B.box('#5a5a68', fx, wallH + 0.9, front - 0.05, 0.06, 1.8, 0.06);
        B.box(shade(col, 0.1), fx + 0.25, wallH + 1.55, front - 0.05, 0.45, 0.3, 0.03);
      }
      B.box('#5a4a3a', doorX, 0.7, front, 1.5, 1.4, 0.08);
      B.box('#8a6a4a', doorX - 0.35, 0.66, front + 0.04, 0.66, 1.3, 0.04, 0, { outline: false });
      B.box('#7a5a3a', doorX + 0.35, 0.66, front + 0.04, 0.66, 1.3, 0.04, 0, { outline: false });
      for (let i = 1; i < W - 1; i++) if (Math.abs(i - b.door) > 1) windowAt(B, mats, x0 + i + 0.5, 1.25, front, 0.5, 0.6);
      break;
    }
    case 'lab': {
      const wallH = 1.6;
      plinth('#c8c8d4');
      B.box('#f6f6fa', cx, wallH / 2, cz, W - 0.2, wallH, Dd);
      B.box(b.roof || '#8a8a9a', cx, wallH + 0.1, cz, W + 0.1, 0.2, Dd + 0.3);
      B.box(shade(b.roof || '#8a8a9a', 0.15), cx, wallH + 0.25, cz - 0.2, W - 1.2, 0.12, Dd - 0.6);
      // satelit
      const sx = x0 + W - 1.1;
      B.box('#6a6a78', sx, wallH + 0.55, cz - 0.3, 0.07, 0.6, 0.07);
      B.put(GEO.hemi, '#e0e0ea', sx, wallH + 0.85, cz - 0.3, 0.4, 0.14, 0.4, 0, { rx: -0.6, side: THREE.DoubleSide });
      for (let i = 0; i < W; i++) if (i !== b.door) windowAt(B, mats, x0 + i + 0.5, 0.95, front, 0.5, 0.5);
      doorAt(B, doorX, front, '#4a6a9a');
      break;
    }
    case 'mill': {
      const r = Math.min(W, D) / 2 - 0.45;
      const mcz = cz - 0.1;
      B.put(GEO.cyl, '#a8946a', cx, 0.06, mcz, r * 1.25, 0.12, r * 1.25);
      B.put(GEO.cyl, '#d8c4a0', cx, 1.35, mcz, r, 2.7, r * 1.0, 0, {});
      B.put(new THREE.CylinderGeometry(r * 0.9, r * 1.1, 2.7, 8), '#d8c4a0', cx, 1.35, mcz, 1, 1, 1);
      B.put(GEO.cone, b.roof || '#a8742a', cx, 3.15, mcz, r * 1.25, 1.1, r * 1.25);
      for (let k = 0; k < 4; k++) B.put(GEO.cyl, '#c0aa84', cx, 0.5 + k * 0.6, mcz, r * 1.02, 0.04, r * 1.02, 0, { outline: false });
      doorAt(B, doorX, mcz + r * 0.98);
      windowAt(B, mats, cx, 2.0, mcz + r * 0.95, 0.36, 0.36);
      // lopatky (otáčejí se – zvlášť, ne ve sloučené dávce)
      const sails = new THREE.Group();
      sails.position.set(cx, 2.55, mcz + r + 0.22);
      const sb = new Batch(OL, 0.02, { mat: worldToon, xray: true });
      sb.put(GEO.cyl, '#5a3a1e', 0, 0, -0.1, 0.1, 0.3, 0.1, 0, { rx: Math.PI / 2 });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        sb.put(GEO.box, '#6a4a2a', ca * 0.85, sa * 0.85, 0, 1.7, 0.07, 0.05, 0, { rz: a });
        sb.put(GEO.box, '#f4ecd8', ca * 1.0 - sa * 0.16, sa * 1.0 + ca * 0.16, 0.02, 1.25, 0.3, 0.02, 0, { rz: a });
      }
      sb.build(sails);
      ctx.root.add(sails);
      ctx.anim.push((t) => { sails.rotation.z = -t * 0.7; });
      break;
    }
    case 'castle': {
      const wallH = 2.4;
      const stone = '#7e7e8c';
      B.box(stone, cx, wallH / 2, cz, W - 0.4, wallH, Dd);
      for (let i = 0; i < W - 0.4; i += 0.5) if (Math.round(i * 2) % 2 === 0) B.box(stone, x0 + 0.45 + i, wallH + 0.18, front - 0.15, 0.4, 0.36, 0.3);
      for (let r = 0; r < 5; r++) B.box('#5e5e6a', cx, 0.4 + r * 0.45, front + 0.005, W - 0.4, 0.03, 0.02, 0, { outline: false });
      for (const tx of [x0 + 0.6, x0 + W - 0.6]) {
        B.put(new THREE.CylinderGeometry(0.75, 0.82, 3.4, 12), '#6e6e7c', tx, 1.7, front - 0.5, 1, 1, 1);
        B.put(GEO.cone, b.roof || '#5a3a7a', tx, 3.4 + 0.65, front - 0.5, 0.95, 1.3, 0.95);
        windowAt(B, mats, tx, 2.4, front + 0.25, 0.26, 0.4);
      }
      // brána s obloukem
      B.box('#3a2a2a', doorX, 0.8, front + 0.02, 1.3, 1.6, 0.08);
      B.put(GEO.cyl, '#3a2a2a', doorX, 1.6, front + 0.02, 0.65, 0.08, 0.65, 0, { rx: Math.PI / 2 });
      B.box('#5a3a2a', doorX, 0.75, front + 0.06, 1.05, 1.5, 0.04, 0, { outline: false });
      for (let k = -1; k <= 1; k++) B.box('#3a2a1a', doorX + k * 0.3, 0.75, front + 0.09, 0.05, 1.5, 0.02, 0, { outline: false });
      // prapory
      for (const bx of [doorX - 1.3, doorX + 1.3]) {
        B.box(b.roof || '#5a3a7a', bx, 1.6, front + 0.04, 0.42, 0.9, 0.03);
        B.box('#f2c442', bx, 1.7, front + 0.07, 0.14, 0.14, 0.02, 0, { outline: false });
      }
      break;
    }
    case 'tower': {
      const r = W / 2 - 0.35;
      B.put(new THREE.CylinderGeometry(r * 0.92, r, 4.6, 12), '#7e7e8c', cx, 2.3, cz, 1, 1, 1);
      for (let k = 0; k < 7; k++) B.put(GEO.cyl, '#5e5e6a', cx, 0.6 + k * 0.6, cz, r * 1.0, 0.03, r * 1.0, 0, { outline: false });
      B.put(GEO.cone, b.roof || '#5a3a7a', cx, 4.6 + 0.8, cz, r * 1.3, 1.6, r * 1.3);
      windowAt(B, mats, cx, 3.2, cz + r * 0.95, 0.3, 0.5);
      doorAt(B, doorX, cz + r * 0.97, '#5a3a2a');
      break;
    }
    case 'cave': {
      const rock = ctx.theme === 'snow' || ctx.theme === 'mountain' ? '#8a8a96' : '#7a6a5a';
      for (let i = 0; i < 9; i++) {
        const fx = x0 + 0.3 + rnd(b.x + i, b.y, 3) * (W - 0.6);
        const fz = z0 + 0.2 + rnd(b.x, b.y + i, 4) * (D - 0.6);
        const s = 0.55 + rnd(i, b.x, 5) * 0.45;
        B.put(GEO.sphereLo, shade(rock, (rnd(i, 1, 6) - 0.5) * 0.2), fx, s * 0.5, fz, s, s * 0.85, s, rnd(i, 2, 7) * 3);
      }
      B.put(GEO.sphereLo, shade(rock, -0.1), cx, 0.9, z0 + 0.6, W * 0.5, 1.0, D * 0.45);
      B.put(GEO.hemi, '#120c08', doorX, 0.0, front - 0.05, 0.55, 0.9, 0.3, 0, { outline: false, rx: 0 });
      B.put(GEO.hemi, '#2a2018', doorX, 0.0, front - 0.1, 0.66, 1.0, 0.3);
      break;
    }
    default: { // home / house
      const wallH = 1.45;
      plinth('#c8b490');
      B.box(WALL, cx, wallH / 2, cz, W - 0.2, wallH, Dd);
      B.box('#d8c8a8', cx, 0.22, cz, W - 0.18, 0.06, Dd + 0.02, 0, { outline: false });
      for (const ex of [x0 + 0.12, x0 + W - 0.12]) B.box('#a8845a', ex, wallH / 2, front - 0.02, 0.1, wallH, 0.1);
      gableRoof(B, x0 + 0.1, back, W - 0.2, Dd, wallH, 1.05, b.roof || '#c85a3a');
      if (b.style === 'home') {
        B.box('#8a4a3a', x0 + W - 1.1, wallH + 0.95, back + Dd * 0.3, 0.32, 0.9, 0.32);
        B.box('#6a3a2a', x0 + W - 1.1, wallH + 1.42, back + Dd * 0.3, 0.4, 0.08, 0.4);
        ctx.smoke.push(new THREE.Vector3(x0 + W - 1.1, wallH + 1.5, back + Dd * 0.3));
      }
      for (let i = 0; i < W; i++) if (i !== b.door) windowAt(B, mats, x0 + i + 0.5, 0.86, front);
      doorAt(B, doorX, front);
      B.box('#a8845a', doorX, 1.3, front + 0.15, 0.9, 0.06, 0.32);
      // květináče u oken
      for (let i = 0; i < W; i++) {
        if (i === b.door) continue;
        B.box('#a85a3a', x0 + i + 0.5, 0.52, front + 0.12, 0.5, 0.1, 0.14, 0, { outline: false });
        for (let k = -1; k <= 1; k++) B.sphere(['#ff6a8a', '#ffd84a', '#ff9ad0'][(i + k + 3) % 3], x0 + i + 0.5 + k * 0.15, 0.6, front + 0.13, 0.06, 0.06, 0.06, { outline: false, lo: true });
      }
    }
  }
}

// ---------- hlavní funkce ----------
export function buildMap3D(map) {
  if (!TREE_GEOS) TREE_GEOS = markShared(makeTreeGeos());
  const T = themeOf(map);
  const theme = map.theme;
  const outdoor = OUTDOOR.has(theme);
  const indoor = theme === 'interior' || theme === 'gym' || theme === 'castle';
  const snowy = theme === 'snow';
  const root = new THREE.Group();
  root.name = 'map3d';
  const anim = [];
  const lamps = [];
  const glowSpots = [];
  const smoke = [];
  const mats = {
    window: worldToonUnique('#8ccaf0'),
    lamp: worldToonUnique('#fff2b0', { emissive: '#ffd860', emissiveIntensity: 0.15, noXray: true }),
  };
  const ctx = { root, anim, mats, theme, smoke };
  const B = new Batch(OL, 0.022, { mat: worldToon, xray: true });
  const timing = {};
  let tm = performance.now();
  const mark = (k) => { const n = performance.now(); timing[k] = Math.round(n - tm); tm = n; };

  // terén
  const groundCanvas = paintGround(map, T, indoor);
  mark('ground');
  const gtex = new THREE.CanvasTexture(groundCanvas);
  gtex.colorSpace = THREE.SRGBColorSpace;
  gtex.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.w, map.h), new THREE.MeshToonMaterial({ map: gtex, gradientMap: toonGradient(), alphaTest: 0.5, transparent: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(map.w / 2, 0, map.h / 2);
  ground.receiveShadow = true;
  root.add(ground);

  // okolí mapy (aby za okrajem nebyla prázdnota)
  if (outdoor) {
    const pad = 60;
    const ftex = new THREE.CanvasTexture(patternCanvas('grass', T));
    ftex.colorSpace = THREE.SRGBColorSpace;
    ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping;
        const fmat = new THREE.MeshToonMaterial({ map: ftex, gradientMap: toonGradient() });
    const strips = [
      [map.w / 2, -pad / 2, map.w + pad * 2, pad], [map.w / 2, map.h + pad / 2, map.w + pad * 2, pad],
      [-pad / 2, map.h / 2, pad, map.h], [map.w + pad / 2, map.h / 2, pad, map.h],
    ];
    for (const [fx, fz, fw, fh] of strips) {
      const geo = new THREE.PlaneGeometry(fw, fh);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (fx - fw / 2 + uv.getX(i) * fw) / 2, (-(fz + fh / 2) + uv.getY(i) * fh) / 2);
      const f = new THREE.Mesh(geo, fmat);
      f.rotation.x = -Math.PI / 2;
      f.position.set(fx, -0.005, fz);
      f.receiveShadow = true;
      root.add(f);
    }
  }

  // voda
  let water = null;
  if (map.rows.some((r) => r.includes('~') || r.includes('='))) {
    water = waterMesh(map, T, theme);
    root.add(water.mesh);
    if (outdoor) {
      // dno pod průhlednou vodou
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(map.w + 2, map.h + 2), new THREE.MeshBasicMaterial({ color: shade(T.water3 || '#3a84d0', -0.45) }));
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(map.w / 2, -0.5, map.h / 2);
      root.add(bed);
    }
  }

  // instancované objekty
  const treeCols = theme === 'swamp' ? ['#3c5e3c', '#4e744a', '#36563a'] : theme === 'forest' ? ['#22703a', '#2c7c40', '#348a44'] : snowy ? ['#2c6a4c', '#3e8460'] : [T.tree2, T.tree, shade(T.tree2, 0.08)];
  const trunkI = new Instancer(TREE_GEOS.trunk, worldToon(T.trunk || '#7a4a2a'), outlineMat(OL, 0.03, true));
  const crownI = new Instancer(TREE_GEOS.crown, worldToon('#ffffff'), outlineMat(OL, 0.03, true));
  const snowI = new Instancer(TREE_GEOS.snowcap, worldToon('#ffffff'), null);
  const pineI = new Instancer(TREE_GEOS.pine, worldToon('#ffffff'), outlineMat(OL, 0.03, true));
  const pineTrunkI = new Instancer(TREE_GEOS.pineTrunk, worldToon('#6a4a2a'), outlineMat(OL, 0.03, true));
  const pineSnowI = new Instancer(TREE_GEOS.pineSnow, worldToon('#ffffff'), null);
  const bushI = new Instancer(TREE_GEOS.bush, worldToon('#ffffff'), outlineMat(OL, 0.025, true));
  const grassUni = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3(-99, 0, -99) }, uStep: { value: new THREE.Vector4(-99, 0, -99, -99) } };
  const tuft = grassTuft();
  const tallI = new Instancer(tuft, grassMaterial('#ffffff', grassUni), null);
  const smallI = new Instancer(tuft, grassMaterial('#ffffff', grassUni), null);
  const flowerStemI = new Instancer(compose([[GEO.cyl, 0, 0.1, 0, 0.012, 0.2, 0.012]]), worldToon('#3a8a3a'), null);
  const flowerI = new Instancer(compose([[GEO.sphereLo, 0, 0.22, 0, 0.07, 0.04, 0.07], [GEO.sphereLo, 0, 0.245, 0, 0.03, 0.02, 0.03]]), worldToon('#ffffff'), null);

  const farTrunkI = new Instancer(TREE_GEOS.trunk, worldToon(T.trunk || '#7a4a2a'), null);
  const farCrownI = new Instancer(TREE_GEOS.crown, worldToon('#ffffff'), null);
  const farPineI = new Instancer(TREE_GEOS.pine, worldToon('#ffffff'), null);
  const farPineTrunkI = new Instancer(TREE_GEOS.pineTrunk, worldToon('#6a4a2a'), null);
  let far = false;
  const pineTheme = snowy || theme === 'mountain';
  const placeTree = (x, z, seedX, seedY, kind) => {
    const s = 0.88 + rnd(seedX, seedY, 11) * 0.3;
    const ry = rnd(seedX, seedY, 12) * Math.PI * 2;
    const ox = (rnd(seedX, seedY, 13) - 0.5) * 0.22;
    const oz = (rnd(seedX, seedY, 14) - 0.5) * 0.22;
    if (kind === 'P') {
      (far ? farPineTrunkI : pineTrunkI).push(x + ox, 0, z + oz, s, s, s, ry);
      (far ? farPineI : pineI).push(x + ox, 0, z + oz, s, s * (1 + rnd(seedX, seedY, 15) * 0.2), s, ry, pineTheme ? (rnd(seedX, seedY, 16) > 0.5 ? '#2c6a4c' : '#3e8460') : treeCols[Math.floor(rnd(seedX, seedY, 16) * treeCols.length)]);
      if (snowy) pineSnowI.push(x + ox, 0, z + oz, s, s, s, ry);
    } else {
      (far ? farTrunkI : trunkI).push(x + ox, 0, z + oz, s, s, s, ry);
      (far ? farCrownI : crownI).push(x + ox, 0, z + oz, s * 1.05, s, s * 1.05, ry, treeCols[Math.floor(rnd(seedX, seedY, 17) * treeCols.length)]);
      if (snowy) snowI.push(x + ox, 0, z + oz, s * 1.05, s, s * 1.05, ry);
    }
  };

  const flowerCols = ['#ff6a8a', '#ffd84a', '#ffffff', '#ff9ad0', '#8ac8ff', '#ff8a4a'];
  const cliffH = theme === 'cave' ? 1.5 : 1.0;
  const rockCol = theme === 'cave' ? '#66564a' : snowy ? '#a8b4c4' : T.cliff;
  const rockCol2 = theme === 'cave' ? '#4c3e36' : snowy ? '#94a2b6' : T.cliff2;
  const capCol = theme === 'cave' ? '#7e6c5e' : snowy ? '#ffffff' : T.grass;

  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const ch = map.rows[y][x];
      const X = x + 0.5;
      const Z = y + 0.5;
      const r1 = rnd(x, y, 1);
      switch (ch) {
        case 'T': placeTree(X, Z, x, y, pineTheme && r1 > 0.35 ? 'P' : 'T'); break;
        case 'P': placeTree(X, Z, x, y, 'P'); break;
        case 't': bushI.push(X, 0, Z, 0.95 + r1 * 0.2, 0.9 + r1 * 0.3, 0.95 + r1 * 0.2, r1 * 6, theme === 'swamp' ? '#4e744a' : snowy ? '#5ea07c' : shade(T.tree2, 0.05)); break;
        case ',': {
          const n = 3;
          for (let k = 0; k < n; k++) {
            const ox = (k === 0 ? -0.22 : k === 1 ? 0.2 : 0) + (rnd(x, y, 20 + k) - 0.5) * 0.15;
            const oz = (k === 2 ? 0.22 : -0.12) + (rnd(x, y, 30 + k) - 0.5) * 0.15;
            const s = 0.85 + rnd(x, y, 40 + k) * 0.35;
            tallI.push(X + ox, 0, Z + oz, s, s * 1.05, s, rnd(x, y, 50 + k) * 6, mix(T.tall, T.tall3, rnd(x, y, 60 + k) * 0.5));
          }
          break;
        }
        case '.':
          if (outdoor && !snowy && r1 > 0.72) smallI.push(X + (rnd(x, y, 2) - 0.5) * 0.6, 0, Z + (rnd(x, y, 3) - 0.5) * 0.6, 0.45, 0.4, 0.45, r1 * 6, mix(T.grass2, T.tall3, 0.4));
          break;
        case '*':
          for (let k = 0; k < 4; k++) {
            const fx = X + (rnd(x, y, 70 + k) - 0.5) * 0.7;
            const fz = Z + (rnd(x, y, 80 + k) - 0.5) * 0.7;
            flowerStemI.push(fx, 0, fz, 1, 1, 1);
            flowerI.push(fx, 0, fz, 1, 1, 1, 0, flowerCols[Math.floor(rnd(x, y, 90 + k) * flowerCols.length)]);
          }
          break;
        case '#': {
          if (at(map, x - 1, y) === '#') break;
          let n = 1;
          while (at(map, x + n, y) === '#') n++;
          const h = cliffH;
          const cxr = x + n / 2;
          B.box(rockCol, cxr, h / 2, Z, n, h, 1.0, 0, { outline: false });
          if (at(map, x, y + 1) !== '#') {
            B.box(rockCol2, cxr, h * 0.33, Z + 0.505, n, 0.05, 0.02, 0, { outline: false });
            B.box(rockCol2, cxr, h * 0.66, Z + 0.505, n, 0.04, 0.02, 0, { outline: false });
            for (let k = 0; k < n; k++) if (rnd(x + k, y, 8) > 0.6) B.put(GEO.sphereLo, rockCol2, x + k + 0.5, 0.12, Z + 0.52, 0.22, 0.16, 0.12, 0, { outline: false });
          }
          B.box(capCol, cxr, h + 0.04, Z, n + 0.02, 0.08, 1.02, 0, { outline: false });
          break;
        }
        case 'C': {
          const h = 1.6 + rnd(x, y, 5) * 0.5;
          B.box('#4c3e36', X, h / 2, Z, 1.0, h, 1.0, 0, { outline: false });
          B.put(GEO.sphereLo, '#66564a', X + (r1 - 0.5) * 0.3, h, Z, 0.55, 0.3 + r1 * 0.2, 0.55, r1 * 5);
          break;
        }
        case 'K': {
          const h = 2.2;
          B.box('#6a6a78', X, h / 2, Z, 1.0, h, 1.0, 0, { outline: false });
          B.box('#5a5a68', X, h * 0.5, Z + 0.505, 1.0, 0.04, 0.02, 0, { outline: false });
          if ((x + y) % 2 === 0) B.box('#74748a', X, h + 0.15, Z, 0.55, 0.3, 0.55);
          break;
        }
        case 'w': {
          const h = 2.1;
          const wallCol = T.wall || '#f0e4d0';
          B.box(wallCol, X, h / 2, Z, 1.0, h, 1.0, 0, { outline: false });
          if (at(map, x, y + 1) !== 'w') {
            B.box(T.wall3 || '#b89c7a', X, 0.08, Z + 0.5, 1.0, 0.16, 0.04, 0, { outline: false });
            if ((x % 4 === 2) && 'h'.indexOf(at(map, x, y + 1) || '') < 0 && at(map, x, y + 1) !== 'b') windowAt(B, mats, X, 1.25, Z + 0.5, 0.56, 0.5);
          }
          B.box(T.wall2 || '#d6c4a8', X, h + 0.04, Z, 1.0, 0.08, 1.0, 0, { outline: false });
          break;
        }
        case 'o': {
          const s = 0.34 + r1 * 0.12;
          B.put(new THREE.IcosahedronGeometry(1, 0), theme === 'cave' ? '#7a6a5e' : T.rock, X, s * 0.75, Z, s * 1.15, s, s * 1.05, r1 * 6);
          break;
        }
        case 'f': {
          const fc = theme === 'swamp' ? '#6a5a40' : '#f4ecdc';
          B.box(fc, X, 0.35, Z, 0.12, 0.7, 0.12);
          const L = at(map, x - 1, y) === 'f';
          const R = at(map, x + 1, y) === 'f';
          const U = at(map, x, y - 1) === 'f';
          const Dn = at(map, x, y + 1) === 'f';
          if (R) { B.box(fc, X + 0.5, 0.5, Z, 1.0, 0.07, 0.05); B.box(fc, X + 0.5, 0.28, Z, 1.0, 0.07, 0.05); }
          if (Dn) { B.box(fc, X, 0.5, Z + 0.5, 0.05, 0.07, 1.0); B.box(fc, X, 0.28, Z + 0.5, 0.05, 0.07, 1.0); }
          if (!L && !R && !U && !Dn) { B.box(fc, X, 0.5, Z, 0.8, 0.07, 0.05); B.box(fc, X, 0.28, Z, 0.8, 0.07, 0.05); }
          break;
        }
        case '^':
          B.box(T.cliff2, X, 0.11, Z + 0.25, 1.0, 0.22, 0.5);
          B.box(T.grass3 || T.grass, X, 0.23, Z + 0.17, 1.02, 0.05, 0.36);
          break;
        case '=': {
          const horiz = '~'.indexOf(at(map, x, y - 1) || '~') >= 0 && '~'.indexOf(at(map, x, y + 1) || '~') >= 0;
          B.box('#a8743a', X, 0.04, Z, 1.0, 0.1, 1.0);
          for (let k = 0; k < 4; k++) {
            if (horiz) B.box('#8a5a2a', X - 0.375 + k * 0.25, 0.1, Z, 0.02, 0.02, 1.0, 0, { outline: false });
            else B.box('#8a5a2a', X, 0.1, Z - 0.375 + k * 0.25, 1.0, 0.02, 0.02, 0, { outline: false });
          }
          if (horiz) for (const s of [-1, 1]) { B.box('#7a4a22', X, 0.38, Z + s * 0.46, 1.0, 0.06, 0.06); B.box('#7a4a22', X, 0.22, Z + s * 0.46, 0.06, 0.36, 0.06); }
          else for (const s of [-1, 1]) { B.box('#7a4a22', X + s * 0.46, 0.38, Z, 0.06, 0.06, 1.0); B.box('#7a4a22', X + s * 0.46, 0.22, Z, 0.06, 0.36, 0.06); }
          break;
        }
        case 'l': {
          B.box('#3a3a48', X, 0.06, Z, 0.26, 0.12, 0.26);
          B.box('#3a3a48', X, 0.75, Z, 0.08, 1.4, 0.08);
          B.box('#3a3a48', X, 1.5, Z, 0.32, 0.06, 0.32);
          B.box(mats.lamp, X, 1.65, Z, 0.24, 0.26, 0.24);
          B.cone('#3a3a48', X, 1.78, Z, 0.24, 0.16);
          lamps.push(new THREE.Vector3(X, 1.65, Z));
          break;
        }
        case 'G':
          B.box(theme === 'gym' ? '#c8c0b0' : '#a8a8b8', X, 0.08, Z, 0.8, 0.16, 0.8);
          B.cyl(theme === 'gym' ? '#e8e0d0' : '#c8c8d4', X, 0.16, Z, 0.28, 1.9);
          B.box(theme === 'gym' ? '#c8c0b0' : '#a8a8b8', X, 2.1, Z, 0.8, 0.16, 0.8);
          break;
        case 'z': {
          B.box('#9a9aa8', X, 0.2, Z, 0.8, 0.4, 0.8);
          B.box('#b8b8c4', X, 0.42, Z, 0.7, 0.06, 0.7, 0, { outline: false });
          ctx.statues = ctx.statues || [];
          ctx.statues.push({ x: X, z: Z, seed: x * 31 + y });
          break;
        }
        case 'Q': {
          const cc = rnd(x, y, 9) > 0.5 ? '#9a6ae8' : '#5ac8f0';
          const cm = worldToon(cc, { emissive: cc, emissiveIntensity: 0.55 });
          for (let k = 0; k < 4; k++) {
            const a = k * 1.7 + r1 * 3;
            const h = 0.4 + rnd(x, y, 100 + k) * 0.5;
            const px = X + Math.cos(a) * (k ? 0.2 : 0);
            const pz = Z + Math.sin(a) * (k ? 0.2 : 0);
            B.put(GEO.cylHex, cm, px, h / 2, pz, 0.1, h, 0.1, a, { rz: k ? Math.cos(a) * 0.35 : 0, rx: k ? Math.sin(a) * 0.35 : 0 });
          }
          glowSpots.push({ p: new THREE.Vector3(X, 0.5, Z), c: cc, s: 1.6 });
          break;
        }
        // nábytek
        case 'k':
          B.box('#c8a070', X, 0.42, Z, 1.0, 0.84, 0.8);
          B.box('#e8d0a8', X, 0.86, Z, 1.04, 0.06, 0.86, 0, { outline: false });
          B.box('#a8805a', X, 0.4, Z + 0.41, 1.0, 0.6, 0.02, 0, { outline: false });
          break;
        case 'b': {
          B.box('#8a5a3a', X, 0.95, Z - 0.15, 0.96, 1.9, 0.5);
          for (let r = 0; r < 4; r++) {
            B.box('#6a4024', X, 0.25 + r * 0.45, Z + 0.1, 0.9, 0.04, 0.02, 0, { outline: false });
            for (let k = 0; k < 5; k++) B.box(['#c84a4a', '#3a7ad8', '#4aa84a', '#f2c42c', '#8a4ad8'][(k + r + x) % 5], X - 0.34 + k * 0.17, 0.42 + r * 0.45, Z + 0.08, 0.12, 0.3, 0.06, 0, { outline: false });
          }
          break;
        }
        case 'j': {
          B.box('#b07a4a', X, 0.62, Z, 1.0, 0.08, 1.0, 0, { outline: false });
          B.box('#8a5a32', X, 0.3, Z, 0.18, 0.6, 0.18);
          if (at(map, x + 1, y) !== 'j' && at(map, x, y + 1) !== 'j') {
            B.cyl('#ffffff', X - 0.2, 0.66, Z - 0.1, 0.14, 0.03);
            B.cyl('#e8443a', X - 0.2, 0.69, Z - 0.1, 0.08, 0.04);
          }
          break;
        }
        case 'y':
          B.cyl('#b0603a', X, 0, Z, 0.2, 0.36);
          B.sphere('#3a8a3a', X, 0.62, Z, 0.32, 0.36, 0.32, { lo: true });
          B.sphere('#4aa84a', X + 0.1, 0.8, Z + 0.06, 0.18, 0.2, 0.18, { lo: true });
          break;
        case 'n': {
          const head = at(map, x, y - 1) !== 'n';
          B.box('#8a5a3a', X, 0.2, Z, 0.9, 0.4, 1.0);
          B.box('#f4f0e6', X, 0.44, Z, 0.84, 0.1, 0.98, 0, { outline: false });
          if (head) { B.box('#ffffff', X, 0.54, Z - 0.22, 0.6, 0.12, 0.34); B.box('#8a5a3a', X, 0.55, Z - 0.48, 0.9, 1.1 - 0.1, 0.06); } else B.box('#4a7ad8', X, 0.5, Z + 0.05, 0.86, 0.1, 0.9);
          break;
        }
        case 'p':
          B.box('#8a8a96', X, 0.35, Z, 0.8, 0.7, 0.6);
          B.box('#3a3a48', X, 0.98, Z - 0.05, 0.62, 0.5, 0.1);
          B.box(worldToon('#4ab0f0', { emissive: '#4ab0f0', emissiveIntensity: 0.7 }), X, 0.98, Z + 0.005, 0.52, 0.38, 0.02, 0, { outline: false });
          break;
        case 'h': {
          // léčebný stroj: když je pod ním zeď, „visí“ na její přední straně
          let mz = Z + 0.1;
          if (at(map, x, y + 1) === 'w') {
            B.box(T.wall || '#f0e4d0', X, 1.05, Z, 1.0, 2.1, 1.0, 0, { outline: false });
            mz = y + 2 + 0.22;
          }
          B.box('#e8e4ec', X, 0.62, mz, 1.0, 1.24, 0.42);
          B.box('#ff8aa8', X, 1.26, mz, 1.0, 0.06, 0.44, 0, { outline: false });
          B.box('#c8c4d4', X, 0.3, mz + 0.22, 0.9, 0.5, 0.02, 0, { outline: false });
          const om = worldToon('#ff9ac0', { emissive: '#ff6aa0', emissiveIntensity: 0.5 });
          for (let k = 0; k < 2; k++) B.put(GEO.sphere, om, X - 0.2 + k * 0.4, 1.38, mz, 0.12, 0.12, 0.12);
          glowSpots.push({ p: new THREE.Vector3(X, 1.45, mz + 0.1), c: '#ff9ac0', s: 1.1 });
          break;
        }
        case 'u':
          for (let k = 0; k < 3; k++) B.box('#a89a8a', X, 0.05 + k * 0.1, Z + 0.33 - k * 0.33, 1.0, 0.1 + k * 0.2, 0.34, 0, { outline: k === 2 });
          break;
        default:
      }
    }
  }

  // okrajové stromy za hranou mapy
  if (outdoor) {
    const ring = 5;
    far = true;
    for (let y = -ring; y < map.h + ring; y++) {
      for (let x = -ring; x < map.w + ring; x++) {
        if (x >= 0 && y >= 0 && x < map.w && y < map.h) continue;
        const cx = Math.max(0, Math.min(map.w - 1, x));
        const cy = Math.max(0, Math.min(map.h - 1, y));
        const edge = map.rows[cy][cx];
        if (edge !== 'T' && edge !== 'P') {
          if (edge === '#') { const h = cliffH; B.box(rockCol, x + 0.5, h / 2, y + 0.5, 1.0, h, 1.0, 0, { outline: false }); B.box(capCol, x + 0.5, h + 0.04, y + 0.5, 1.02, 0.08, 1.02, 0, { outline: false }); }
          continue;
        }
        const outD = Math.max(-x, -y, x - map.w + 1, y - map.h + 1);
        if (rnd(x, y, 21) < 0.06 + outD * 0.07) continue;
        placeTree(x + 0.5, y + 0.5, x, y, edge === 'P' || (pineTheme && rnd(x, y, 22) > 0.35) ? 'P' : 'T');
      }
    }
  }

  mark('tiles');
  // budovy a cedule
  for (const b of map.buildings) buildBuilding(B, b, ctx);
  for (const s of map.signs) {
    const X = s.x + 0.5;
    const Z = s.y + 0.5;
    B.box('#7a4a2a', X, 0.35, Z, 0.08, 0.7, 0.08);
    B.box('#6a4422', X, 0.72, Z + 0.02, 0.78, 0.44, 0.08);
    B.box('#c8985a', X, 0.72, Z + 0.07, 0.68, 0.34, 0.02, 0, { outline: false });
    B.box('#8a6a3a', X - 0.05, 0.76, Z + 0.085, 0.42, 0.03, 0.01, 0, { outline: false });
    B.box('#8a6a3a', X - 0.1, 0.68, Z + 0.085, 0.32, 0.03, 0.01, 0, { outline: false });
  }

  // interiér: boční stěny jako v domečku pro panenky
  if (indoor) {
    const wallCol = theme === 'castle' ? '#4a4a58' : T.wall || '#f0e4d0';
    for (const sx of [-0.25, map.w + 0.25]) B.box(shade(wallCol, -0.08), sx, 1.05, map.h / 2, 0.5, 2.1, map.h);
    B.box(shade(wallCol, -0.2), map.w / 2, -0.06, map.h / 2, map.w + 1, 0.1, map.h + 0.2, 0, { outline: false });
  }

  mark('buildings');
  B.build(root);
  mark('merge');
  for (const I of [trunkI, crownI, snowI, pineI, pineTrunkI, pineSnowI, bushI]) I.build(root, { castShadow: true });
  for (const I of [farTrunkI, farCrownI, farPineI, farPineTrunkI]) I.build(root, { castShadow: false });
  tallI.build(root, { castShadow: false });
  smallI.build(root, { castShadow: false });
  flowerStemI.build(root, { castShadow: false });
  flowerI.build(root, { castShadow: false });

  // sochy tvorů z kamene
  if (ctx.statues) {
    const pool = ['hlinak', 'krakonos', 'ohnivak', 'polednice', 'meluzina', 'listoroh', 'plamenlis', 'vlnovyd'];
    const stone = worldToon('#b4b4c0');
    for (const st of ctx.statues) {
      const key = pool[st.seed % pool.length];
      const o = buildCreatureLite(key);
      o.traverse((m) => { if (m.isMesh && !m.userData.isOutline) m.material = stone; if (m.isSprite) m.visible = false; });
      const h = o.userData.height || 1;
      o.scale.setScalar(Math.min(1.0, 1.05 / h));
      o.position.set(st.x, 0.45, st.z);
      root.add(o);
    }
  }

  mark('instances');
  return { root, water, grassUni, anim, lamps, glowSpots, smoke, mats, outdoor, indoor, timing };
}
