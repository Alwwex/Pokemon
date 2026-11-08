// Spouštěcí bod serveru: statické soubory + WebSocket.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Store } from './store.js';
import { Game } from './game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SHARED = path.join(ROOT, 'shared');
const MODELS = path.join(PUBLIC, 'models');
// Knihovny z node_modules, které klient potřebuje (bez CDN).
const VENDOR = {
  '/vendor/three/': path.join(ROOT, 'node_modules', 'three', 'build'),
  '/vendor/three-addons/': path.join(ROOT, 'node_modules', 'three', 'examples', 'jsm'),
};
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const PROD = process.env.NODE_ENV === 'production';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

const cache = new Map();

function resolveFile(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  let base = PUBLIC;
  if (p.startsWith('/shared/')) { base = SHARED; p = p.slice('/shared'.length); }
  for (const [prefix, dir] of Object.entries(VENDOR)) {
    if (p.startsWith(prefix)) { base = dir; p = p.slice(prefix.length - 1); break; }
  }
  if (p === '/' || p === '') p = '/index.html';
  const full = path.resolve(base, '.' + path.posix.normalize(p));
  if (!full.startsWith(base + path.sep)) return null;
  if (path.basename(full).startsWith('.')) return null;
  return full;
}

function serve(req, res) {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (req.url === '/api/models') {
    // seznam vlastních 3D modelů tvorů (public/models/<druh>.glb)
    let list = [];
    try { list = fs.readdirSync(MODELS).filter((f) => /^[a-z0-9_]+\.glb$/.test(f)).map((f) => f.slice(0, -4)); } catch { /* složka nemusí existovat */ }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(list));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  const file = resolveFile(req.url);
  if (!file) { res.writeHead(400); return res.end('Bad request'); }
  let entry = PROD ? cache.get(file) : null;
  if (!entry) {
    let stat;
    try { stat = fs.statSync(file); } catch { stat = null; }
    if (!stat || !stat.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nenalezeno'); }
    const body = fs.readFileSync(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const compressible = /text|javascript|json|svg/.test(type);
    entry = { body, type, gz: compressible && body.length > 1024 ? zlib.gzipSync(body) : null, mtime: stat.mtimeMs };
    if (PROD) cache.set(file, entry);
  }
  const headers = {
    'Content-Type': entry.type,
    'Cache-Control': PROD ? 'public, max-age=300' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  const accept = String(req.headers['accept-encoding'] || '');
  if (entry.gz && accept.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    return res.end(req.method === 'HEAD' ? undefined : entry.gz);
  }
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : entry.body);
}

const store = new Store(DATA_DIR);
const game = new Game(store);
const server = http.createServer(serve);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024, perMessageDeflate: false });
game.attach(wss);

server.listen(PORT, HOST, () => {
  console.log(`Monsterra Online běží na http://localhost:${PORT}  (data: ${DATA_DIR})`);
});

function shutdown() {
  console.log('Ukládám hráče a vypínám server…');
  try { game.saveAllSync(); } catch (e) { console.error(e); }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
