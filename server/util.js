import crypto from 'node:crypto';

export const rand = () => Math.random();
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const chance = (pct) => Math.random() * 100 < pct;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function weightedPick(items, weightFn = (x) => x.w) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

export function uid(prefix = '') {
  return prefix + crypto.randomBytes(8).toString('hex');
}

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}
