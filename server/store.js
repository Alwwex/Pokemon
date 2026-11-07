// Ukládání účtů a hráčů do JSON souborů (atomický zápis přes dočasný soubor).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.playersDir = path.join(dir, 'players');
    fs.mkdirSync(this.playersDir, { recursive: true });
    this.accountsFile = path.join(dir, 'accounts.json');
    this.accounts = {};
    if (fs.existsSync(this.accountsFile)) {
      try { this.accounts = JSON.parse(fs.readFileSync(this.accountsFile, 'utf8')); } catch (e) {
        console.error('Nelze načíst accounts.json:', e.message);
      }
    }
    this.writing = new Map();
  }

  static key(name) {
    return String(name).normalize('NFC').toLowerCase();
  }

  getAccount(name) {
    return this.accounts[Store.key(name)] || null;
  }

  async hashPassword(pass, salt) {
    const buf = await scrypt(String(pass), salt, 64);
    return buf.toString('hex');
  }

  async createAccount(name, pass) {
    const k = Store.key(name);
    if (this.accounts[k]) return null;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await this.hashPassword(pass, salt);
    if (this.accounts[k]) return null;
    const id = 'p' + crypto.randomBytes(8).toString('hex');
    this.accounts[k] = { id, name, salt, hash, created: Date.now() };
    await this.saveAccounts();
    return this.accounts[k];
  }

  async verifyPassword(acc, pass) {
    const hash = await this.hashPassword(pass, acc.salt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(acc.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async saveAccounts() {
    await this.atomicWrite(this.accountsFile, JSON.stringify(this.accounts));
  }

  playerFile(id) {
    if (!/^p[0-9a-f]{16}$/.test(id)) throw new Error('Neplatné id hráče');
    return path.join(this.playersDir, id + '.json');
  }

  loadPlayer(id) {
    const f = this.playerFile(id);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }

  async savePlayer(p) {
    await this.atomicWrite(this.playerFile(p.id), JSON.stringify(p));
  }

  savePlayerSync(p) {
    const f = this.playerFile(p.id);
    fs.writeFileSync(f + '.tmp', JSON.stringify(p));
    fs.renameSync(f + '.tmp', f);
  }

  // Zápisy do stejného souboru se řadí za sebe, aby se nepřepisovaly.
  async atomicWrite(file, data) {
    const prev = this.writing.get(file) || Promise.resolve();
    const next = prev.then(async () => {
      const tmp = `${file}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, data);
      await fsp.rename(tmp, file);
    }).catch((e) => console.error('Chyba zápisu', file, e.message));
    this.writing.set(file, next);
    await next;
    if (this.writing.get(file) === next) this.writing.delete(file);
  }

  static tokenHash(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  static newToken() {
    return crypto.randomBytes(24).toString('hex');
  }
}
