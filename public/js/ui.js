// Uživatelské rozhraní: dialogy, nabídky a panely.
import { input } from './input.js';
import { audio } from './audio.js';
import { monSprite, monIconURL } from './gfx/monart.js';
import { SPECIES, SPECIES_LIST, STARTERS, PREVO } from '/shared/species.js';
import { MOVES, moveDesc } from '/shared/moves.js';
import { ITEMS, BAG_TABS } from '/shared/items.js';
import { TYPES } from '/shared/types.js';
import { ABILITIES } from '/shared/abilities.js';
import { NATURES, STAT_NAMES, STATS, expProgress } from '/shared/formulas.js';

const root = document.getElementById('ui');
const stack = [];
let textSpeed = 22;
try { textSpeed = Number(localStorage.getItem('monsterra_textspeed')) || 22; } catch { /* ignore */ }

export const UI = {
  isOpen: () => stack.length > 0,
  top: () => stack[stack.length - 1],
  push(l) {
    stack.push(l);
    root.appendChild(l.el);
    document.body.classList.add('ui-open');
  },
  remove(l) {
    const i = stack.indexOf(l);
    if (i >= 0) stack.splice(i, 1);
    l.el.remove();
    if (!stack.length) document.body.classList.remove('ui-open');
  },
  closeAll() { while (stack.length) { const l = stack[stack.length - 1]; if (l.onForceClose) l.onForceClose(); this.remove(l); } },
  get textSpeed() { return textSpeed; },
  set textSpeed(v) { textSpeed = v; try { localStorage.setItem('monsterra_textspeed', String(v)); } catch { /* ignore */ } },
};

input.onPress((act, repeat, src) => {
  const t = UI.top();
  if (!t) return false;
  if (t.onKey) t.onKey(act, repeat, src);
  return true;
});

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function typeBadge(t) {
  return h('span', { class: 'type', style: `background:${TYPES[t] ? TYPES[t].color : '#888'}` }, TYPES[t] ? TYPES[t].name : '???');
}

const STATUS_SHORT = { brn: 'POP', par: 'OCH', psn: 'JED', tox: 'JED', slp: 'SPÍ', frz: 'MRZ' };
export function statusBadge(st, hp) {
  if (hp === 0) return h('span', { class: 'st fnt' }, 'OMD');
  if (!st) return null;
  return h('span', { class: 'st ' + st }, STATUS_SHORT[st] || st);
}

export function hpBar(hp, mhp) {
  const f = mhp ? Math.max(0, Math.min(1, hp / mhp)) : 0;
  const bar = h('div', { class: 'hp' + (f < 0.2 ? ' low' : f < 0.5 ? ' mid' : '') }, h('i', { style: `width:${f * 100}%` }));
  return bar;
}

export function monLabel(m) {
  return m.nick || (SPECIES[m.s] ? SPECIES[m.s].n : '???');
}

export function toast(msg, ms = 2600) {
  const t = h('div', { class: 'toast' }, msg);
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------- nabídka ----------
export function makeMenu(items, opts = {}) {
  const cols = opts.cols || 1;
  const el = h('div', { class: 'menu' + (cols > 1 ? ' grid' : '') + (opts.className ? ' ' + opts.className : '') });
  let idx = Math.min(opts.start || 0, Math.max(0, items.length - 1));
  const btns = items.map((it, i) => {
    const b = h('button', { class: 'mi' + (it.disabled ? ' dis' : ''), type: 'button' });
    if (it.node) b.append(it.node); else b.append(it.label);
    if (it.right != null) b.append(h('span', { class: 'r' }, it.right));
    b.addEventListener('mouseenter', () => { if (opts.hover !== false) set(i); });
    b.addEventListener('click', (e) => { e.stopPropagation(); set(i); choose(); });
    el.appendChild(b);
    return b;
  });
  function set(i) {
    if (i < 0 || i >= items.length) return;
    if (i !== idx) audio.sfx('cursor');
    idx = i;
    btns.forEach((b, k) => b.classList.toggle('sel', k === idx));
    if (btns[idx] && btns[idx].scrollIntoView) btns[idx].scrollIntoView({ block: 'nearest' });
    if (opts.onFocus) opts.onFocus(items[idx], idx);
  }
  function choose() {
    const it = items[idx];
    if (!it) return;
    if (it.disabled) { audio.sfx('deny'); return; }
    audio.sfx('select');
    if (opts.onSelect) opts.onSelect(it, idx);
  }
  function key(act) {
    if (act === 'up') set(Math.max(0, idx - cols));
    else if (act === 'down') set(Math.min(items.length - 1, idx + cols));
    else if (act === 'left' && cols > 1) set(Math.max(0, idx - 1));
    else if (act === 'right' && cols > 1) set(Math.min(items.length - 1, idx + 1));
    else if (act === 'a') choose();
    else if (act === 'b') { audio.sfx('back'); if (opts.onCancel) opts.onCancel(); }
  }
  set(idx);
  btns.forEach((b, k) => b.classList.toggle('sel', k === idx));
  return { el, key, set, get idx() { return idx; } };
}

// Panel jako vrstva UI.
export function openPanel(el, onKey, opts = {}) {
  const wrap = h('div', { class: 'layer' });
  if (opts.backdrop !== false) wrap.appendChild(h('div', { class: 'backdrop', onclick: () => onKey && onKey('b') }));
  wrap.appendChild(el);
  const layer = { el: wrap, onKey, onForceClose: opts.onForceClose };
  layer.close = () => UI.remove(layer);
  UI.push(layer);
  return layer;
}

// ---------- dialogy ----------
export function dialog(lines, opts = {}) {
  if (typeof lines === 'string') lines = [lines];
  return new Promise((resolve) => {
    const name = opts.name ? h('div', { class: 'name' }, opts.name) : null;
    const text = h('div', { class: 'text' });
    const arrow = h('div', { class: 'arrow' }, '▼');
    const el = h('div', { class: 'panel dialog' }, name, text, arrow);
    let i = 0;
    let pos = 0;
    let timer = null;
    let done = false;
    const layer = { el, onKey: null };
    const show = () => {
      const line = lines[i] || '';
      pos = 0;
      arrow.style.visibility = 'hidden';
      clearInterval(timer);
      text.textContent = '';
      timer = setInterval(() => {
        pos += 1;
        text.textContent = line.slice(0, pos);
        if (pos % 3 === 0) audio.sfx('cursor');
        if (pos >= line.length) { clearInterval(timer); timer = null; arrow.style.visibility = 'visible'; if (opts.auto) setTimeout(advance, opts.auto); }
      }, textSpeed);
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      UI.remove(layer);
      resolve();
    };
    const advance = () => {
      if (done) return;
      if (timer) { clearInterval(timer); timer = null; text.textContent = lines[i]; arrow.style.visibility = 'visible'; return; }
      i++;
      if (i >= lines.length) finish();
      else show();
    };
    layer.onKey = (act) => { if (act === 'a' || act === 'b') advance(); };
    layer.onForceClose = () => { done = true; clearInterval(timer); resolve(); };
    el.addEventListener('click', advance);
    UI.push(layer);
    show();
  });
}

export function ask(question, choices = ['Ano', 'Ne'], opts = {}) {
  return new Promise((resolve) => {
    const text = h('div', { class: 'text' }, question);
    const dlg = h('div', { class: 'panel dialog' }, opts.name ? h('div', { class: 'name' }, opts.name) : null, text);
    const box = h('div', { class: 'panel choice' });
    const wrap = h('div', {}, dlg, box);
    let layer;
    const menu = makeMenu(choices.map((c) => ({ label: c })), {
      onSelect: (_, i) => { layer.close(); resolve(i); },
      onCancel: () => { layer.close(); resolve(opts.cancel ?? choices.length - 1); },
    });
    box.appendChild(menu.el);
    layer = openPanel(wrap, (act) => menu.key(act), { backdrop: false, onForceClose: () => resolve(-1) });
  });
}

// ---------- tým ----------
function monCard(m, i, sel) {
  const sp = SPECIES[m.s];
  return h('button', { class: 'mon-card' + (sel ? ' sel' : '') + (m.hp === 0 ? ' fainted' : ''), type: 'button', 'data-i': i },
    h('img', { src: monIconURL(m.s, 64, { shiny: m.shiny }), alt: '' }),
    h('div', { class: 'info' },
      h('div', {}, h('span', { class: 'nm' + (m.shiny ? ' shiny' : '') }, monLabel(m), m.shiny ? ' ★' : ''), statusBadge(m.status, m.hp)),
      h('div', { class: 'lv' }, `Úr. ${m.lvl} · `, ...sp.ty.map(typeBadge)),
      hpBar(m.hp, m.mhp),
      h('div', { class: 'hpnum' }, `${m.hp}/${m.mhp} HP`)));
}

// Výběr tvora z týmu. Vrací index nebo -1.
export function pickMon(party, opts = {}) {
  return new Promise((resolve) => {
    let idx = opts.start || 0;
    const grid = h('div', { class: 'party-grid' });
    const title = h('h2', {}, opts.title || 'Vyber tvora');
    const panel = h('div', { class: 'panel center-panel' }, title, opts.subtitle ? h('p', { class: 'muted' }, opts.subtitle) : null, grid,
      h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'spacer' }), h('button', { class: 'btn', onclick: () => cancel() }, 'Zpět')));
    let layer;
    const render = () => {
      grid.innerHTML = '';
      party.forEach((m, i) => {
        const c = monCard(m, i, i === idx);
        if (opts.disabled && opts.disabled(m, i)) c.style.opacity = 0.55;
        c.onclick = () => { idx = i; pick(); };
        c.onmouseenter = () => { if (idx !== i) { idx = i; render(); } };
        grid.appendChild(c);
      });
    };
    const pick = () => {
      const m = party[idx];
      if (!m) return;
      if (opts.disabled && opts.disabled(m, idx)) { audio.sfx('deny'); const r = opts.disabled(m, idx); if (typeof r === 'string') toast(r); return; }
      audio.sfx('select');
      layer.close();
      resolve(idx);
    };
    const cancel = () => {
      if (opts.noCancel) { audio.sfx('deny'); return; }
      audio.sfx('back');
      layer.close();
      resolve(-1);
    };
    render();
    layer = openPanel(panel, (act) => {
      const cols = window.innerWidth > 720 ? 2 : 1;
      if (act === 'up') idx = Math.max(0, idx - cols);
      else if (act === 'down') idx = Math.min(party.length - 1, idx + cols);
      else if (act === 'left') idx = Math.max(0, idx - 1);
      else if (act === 'right') idx = Math.min(party.length - 1, idx + 1);
      else if (act === 'a') return pick();
      else if (act === 'b') return cancel();
      else return;
      audio.sfx('cursor');
      render();
    }, { onForceClose: () => resolve(-1) });
  });
}

// ---------- shrnutí tvora ----------
export function moveInfo(id) {
  const m = MOVES[id];
  const cat = { P: 'Fyzický', S: 'Speciální', X: 'Stavový' }[m.c];
  return h('div', {},
    h('div', { class: 'row' }, m.t ? typeBadge(m.t) : null, h('b', {}, m.n), h('span', { class: 'muted small' }, cat)),
    h('div', { class: 'small' }, `Síla: ${m.c === 'X' ? '—' : m.fx ? 'úr.' : m.p} · Přesnost: ${m.a ? m.a + ' %' : '—'} · PP: ${m.pp}`),
    h('div', { class: 'small muted' }, moveDesc(id)));
}

export function showSummary(m) {
  return new Promise((resolve) => {
    const sp = SPECIES[m.s];
    let tab = 0;
    const content = h('div');
    const tabs = ['Informace', 'Staty', 'Útoky'];
    const tabRow = h('div', { class: 'tabs-row' });
    const art = h('div', { class: 'art' }, monSprite(m.s, 220, { shiny: m.shiny }));
    const panel = h('div', { class: 'panel center-panel' },
      h('button', { class: 'close-x', onclick: () => close() }, '×'),
      h('h2', {}, monLabel(m), m.shiny ? h('span', { class: 'shiny' }, ' ★') : null, h('span', { class: 'muted small' }, `  č. ${String(sp.no).padStart(3, '0')} ${sp.n}`)),
      h('div', { class: 'summary' }, art, h('div', {}, tabRow, content)));
    const render = () => {
      tabRow.innerHTML = '';
      tabs.forEach((t, i) => tabRow.appendChild(h('button', { class: 'tabbtn' + (i === tab ? ' sel' : ''), onclick: () => { tab = i; render(); } }, t)));
      content.innerHTML = '';
      if (tab === 0) {
        const nat = NATURES[m.nature];
        const ep = expProgress(m);
        content.append(
          h('div', { class: 'row' }, 'Typ: ', ...sp.ty.map(typeBadge)),
          h('p', {}, `Úroveň ${m.lvl}  ·  `, hpBar(m.hp, m.mhp), `${m.hp}/${m.mhp} HP `, statusBadge(m.status, m.hp)),
          h('p', {}, h('b', {}, 'Schopnost: '), ABILITIES[m.ability] ? `${ABILITIES[m.ability].n} – ${ABILITIES[m.ability].d}` : m.ability),
          h('p', {}, h('b', {}, 'Povaha: '), nat ? nat.n : m.nature, nat && nat.up ? h('span', { class: 'small muted' }, ` (+${STAT_NAMES[nat.up]}, −${STAT_NAMES[nat.down]})`) : null),
          h('p', {}, h('b', {}, 'Zkušenosti: '), `${ep.cur} / ${ep.need}`, h('div', { class: 'hp' }, h('i', { style: `width:${ep.frac * 100}%;background:#4ab8f0` }))),
          h('p', { class: 'small' }, h('b', {}, 'Trenér: '), m.ot || '—', '  ·  ', h('b', {}, 'Potkán: '), m.met || '—'),
          h('p', { class: 'small muted' }, sp.d));
      } else if (tab === 1) {
        const tbl = h('table', { class: 'stats-table' });
        const nat = NATURES[m.nature] || {};
        for (const st of STATS) {
          const v = m.stats[st];
          const cls = nat.up === st ? 'up' : nat.down === st ? 'down' : '';
          tbl.appendChild(h('tr', {},
            h('td', { class: cls }, STAT_NAMES[st]),
            h('td', { style: 'width:50px;text-align:right' }, h('b', {}, v)),
            h('td', { style: 'width:55%' }, h('div', { class: 'stat-bar' }, h('i', { style: `width:${Math.min(100, (sp.bs[STATS.indexOf(st)] / 160) * 100)}%` }))),
            h('td', { class: 'small muted' }, `IV ${m.iv[st]}`)));
        }
        content.append(tbl, h('p', { class: 'small muted' }, `Základní součet statů: ${sp.bs.reduce((a, b) => a + b, 0)}. Pruh ukazuje základní hodnotu druhu.`));
      } else {
        const list = h('div', { class: 'moves-list' });
        for (const mv of m.moves) {
          const md = MOVES[mv.id];
          list.appendChild(h('div', { class: 'move-row' }, md.t ? typeBadge(md.t) : null, h('div', {}, h('b', {}, md.n), h('div', { class: 'small muted' }, moveDesc(mv.id))), h('span', { class: 'pp' }, `PP ${mv.pp}/${mv.mpp}`)));
        }
        content.append(list);
      }
    };
    let layer;
    const close = () => { audio.sfx('back'); layer.close(); resolve(); };
    render();
    layer = openPanel(panel, (act) => {
      if (act === 'b' || act === 'a') close();
      else if (act === 'left') { tab = (tab + 2) % 3; render(); }
      else if (act === 'right') { tab = (tab + 1) % 3; render(); }
    }, { onForceClose: resolve });
  });
}

// ---------- výběr útoku k zapomenutí ----------
export function pickMoveToForget(mon, newMove) {
  return new Promise((resolve) => {
    const info = h('div', { class: 'item-desc' });
    const items = mon.moves.map((mv) => ({ label: MOVES[mv.id].n, right: `PP ${mv.pp}/${mv.mpp}`, id: mv.id }));
    items.push({ label: `✚ ${MOVES[newMove].n} (nový)`, id: newMove, isNew: true });
    let layer;
    const menu = makeMenu(items, {
      onFocus: (it) => { info.innerHTML = ''; info.append(moveInfo(it.id)); },
      onSelect: (it, i) => { layer.close(); resolve(it.isNew ? -1 : i); },
      onCancel: () => { layer.close(); resolve(-1); },
    });
    const panel = h('div', { class: 'panel center-panel', style: 'width:min(520px,calc(100vw - 20px))' },
      h('h2', {}, 'Který útok zapomenout?'), h('p', { class: 'muted small' }, `${monLabel(mon)} se chce naučit ${MOVES[newMove].n}.`), menu.el, info);
    layer = openPanel(panel, (act) => menu.key(act), { onForceClose: () => resolve(-1) });
  });
}

export async function learnPrompt(mon, moveId) {
  const name = monLabel(mon);
  const mv = MOVES[moveId].n;
  for (;;) {
    await dialog([`${name} se chce naučit útok ${mv}.`, `Ale ${name} už zná čtyři útoky.`]);
    const yes = await ask(`Má ${name} zapomenout některý útok a naučit se ${mv}?`);
    if (yes === 0) {
      const idx = await pickMoveToForget(mon, moveId);
      if (idx >= 0) return idx;
    }
    const sure = await ask(`Opravdu se ${name} nemá naučit ${mv}?`);
    if (sure === 0) return -1;
  }
}

// ---------- startéři ----------
export function starterPick() {
  return new Promise((resolve) => {
    let idx = 0;
    const cards = STARTERS.map((s, i) => {
      const sp = SPECIES[s];
      const c = h('button', { class: 'starter', type: 'button' },
        h('img', { src: monIconURL(s, 170), alt: sp.n }),
        h('div', {}, h('b', {}, sp.n)),
        h('div', {}, ...sp.ty.map(typeBadge)),
        h('div', { class: 'small muted' }, sp.d));
      c.onclick = () => { idx = i; render(); choose(); };
      c.onmouseenter = () => { idx = i; render(); };
      return c;
    });
    const panel = h('div', { class: 'panel center-panel' }, h('h2', {}, 'Vyber si svého prvního tvora'), h('div', { class: 'starters' }, cards));
    let layer;
    const render = () => cards.forEach((c, i) => c.classList.toggle('sel', i === idx));
    const choose = async () => {
      const sp = SPECIES[STARTERS[idx]];
      audio.cry(STARTERS[idx]);
      layer.hidden = true;
      layer.el.style.display = 'none';
      const ok = await ask(`Chceš si vybrat ${sp.n} (${sp.ty.map((t) => TYPES[t].name).join('/')})?`);
      layer.el.style.display = '';
      if (ok === 0) { layer.close(); resolve(STARTERS[idx]); }
    };
    render();
    layer = openPanel(panel, (act) => {
      if (act === 'left') { idx = (idx + 2) % 3; audio.sfx('cursor'); render(); }
      else if (act === 'right') { idx = (idx + 1) % 3; audio.sfx('cursor'); render(); }
      else if (act === 'a') choose();
    }, { onForceClose: () => resolve(STARTERS[0]) });
  });
}

// ---------- vývoj ----------
export function evolveScene(from, to, name, shiny) {
  return new Promise((resolve) => {
    const size = Math.min(360, Math.floor(window.innerWidth * 0.8));
    const cv = h('canvas', { width: size, height: size });
    const msg = h('div', { class: 'panel dialog' }, h('div', { class: 'text' }, `Co se to děje? ${name} se vyvíjí!`), h('div', { class: 'small muted' }, 'Stiskni B pro zastavení vývoje.'));
    const stage = h('div', { class: 'evo-stage' }, cv, msg);
    const g = cv.getContext('2d');
    const a = monSprite(from, size, { shiny });
    const b = monSprite(to, size, { shiny });
    const sa = monSprite(from, size, { silhouette: true });
    const sb = monSprite(to, size, { silhouette: true });
    let t0 = performance.now();
    let cancelled = false;
    let finished = false;
    let raf;
    audio.music('legend');
    audio.cry(from);
    const layer = { el: stage };
    const finish = async (ok) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      g.clearRect(0, 0, size, size);
      g.drawImage(ok ? b : a, 0, 0);
      const text = msg.querySelector('.text');
      msg.querySelector('.small').textContent = '';
      if (ok) { audio.jingle('evolve'); audio.cry(to); text.textContent = `Gratuluji! ${name} se vyvinul v tvora ${SPECIES[to].n}!`; }
      else text.textContent = `Hm? ${name} se přestal vyvíjet.`;
      await new Promise((r) => setTimeout(r, 2200));
      UI.remove(layer);
      resolve(ok);
    };
    const frame = (now) => {
      const t = (now - t0) / 1000;
      g.clearRect(0, 0, size, size);
      const speed = 1.5 + t * 1.6;
      const showB = Math.sin(t * speed * Math.PI) > 0;
      if (t < 0.8) g.drawImage(a, 0, 0);
      else g.drawImage(showB ? sb : sa, 0, 0);
      g.fillStyle = `rgba(255,255,255,${Math.min(0.6, t / 10)})`;
      for (let i = 0; i < 12; i++) {
        const ang = t * 2 + i * 0.52;
        g.beginPath();
        g.arc(size / 2 + Math.cos(ang) * size * 0.4, size / 2 + Math.sin(ang) * size * 0.4, 3, 0, Math.PI * 2);
        g.fill();
      }
      if (t > 6.5) return finish(!cancelled);
      raf = requestAnimationFrame(frame);
    };
    layer.onKey = (act) => { if (act === 'b' && !finished) { cancelled = true; finish(false); } };
    layer.onForceClose = () => { cancelAnimationFrame(raf); resolve(false); };
    UI.push(layer);
    raf = requestAnimationFrame(frame);
  });
}

// ---------- batoh ----------
export function itemTargetsMon(it) {
  return it.cat === 'heal' || it.cat === 'tm';
}

export function openBag(ctx, opts = {}) {
  return new Promise((resolve) => {
    const tabs = BAG_TABS.filter((t) => opts.mode !== 'battle' || ['heal', 'orb'].includes(t.id));
    let tab = 0;
    let menu = null;
    const listWrap = h('div', { class: 'item-list' });
    const desc = h('div', { class: 'item-desc' });
    const tabRow = h('div', { class: 'tabs-row' });
    const money = h('span', { class: 'money' });
    const panel = h('div', { class: 'panel center-panel', style: 'width:min(560px,calc(100vw - 20px))' },
      h('button', { class: 'close-x', onclick: () => close(null) }, '×'),
      h('div', { class: 'row' }, h('h2', {}, 'Batoh'), h('span', { class: 'spacer' }), money), tabRow, listWrap, desc);
    let layer;
    const close = (res) => { layer.close(); resolve(res); };
    const render = () => {
      const me = ctx.me();
      money.textContent = `${me.money} zl.`;
      tabRow.innerHTML = '';
      tabs.forEach((t, i) => tabRow.appendChild(h('button', { class: 'tabbtn' + (i === tab ? ' sel' : ''), onclick: () => { tab = i; render(); } }, t.n)));
      const cat = tabs[tab].id;
      const ids = Object.keys(me.bag).filter((id) => ITEMS[id] && ITEMS[id].cat === cat && me.bag[id] > 0);
      ids.sort((a, b) => ITEMS[a].n.localeCompare(ITEMS[b].n, 'cs'));
      const items = ids.map((id) => ({ label: ITEMS[id].n, right: cat === 'tm' || cat === 'key' ? '' : `×${me.bag[id]}`, id }));
      listWrap.innerHTML = '';
      desc.textContent = '';
      if (!items.length) { listWrap.appendChild(h('p', { class: 'muted' }, 'Tady nic není.')); menu = null; return; }
      menu = makeMenu(items, {
        onFocus: (it) => { desc.innerHTML = ''; desc.append(ITEMS[it.id].d || ''); if (ITEMS[it.id].move) desc.append(h('div', { style: 'margin-top:6px' }, moveInfo(ITEMS[it.id].move))); },
        onSelect: (it) => use(it.id),
        onCancel: () => close(null),
      });
      listWrap.appendChild(menu.el);
    };
    const use = async (id) => {
      const it = ITEMS[id];
      const me = ctx.me();
      if (opts.mode === 'battle') {
        if (it.cat === 'orb') {
          if (!opts.canCatch) { toast('Cizího tvora nelze chytit!'); return; }
          return close({ item: id });
        }
        if (it.noBattle) { toast('Tento předmět teď nelze použít.'); return; }
        const t = await pickMon(opts.party || me.party, { title: `Použít ${it.n} na…` });
        if (t >= 0) close({ item: id, target: t });
        return;
      }
      if (id === 'atlas') { await openDex(ctx); return; }
      if (it.cat === 'orb') { toast('Orby se hází v souboji s divokým tvorem.'); return; }
      if (it.repel) { ctx.send({ t: 'item', item: id }); return close(null); }
      if (!itemTargetsMon(it)) return;
      const i = await pickMon(me.party, { title: `Použít ${it.n} na…` });
      if (i < 0) return;
      const mon = me.party[i];
      if (it.cat === 'tm') {
        let replace = null;
        if (mon.moves.some((m) => m.id === it.move)) { toast(`${monLabel(mon)} už tento útok umí.`); return; }
        if (mon.moves.length >= 4) {
          replace = await pickMoveToForget(mon, it.move);
          if (replace < 0) return;
        }
        ctx.send({ t: 'item', item: id, target: mon.uid, replace });
      } else ctx.send({ t: 'item', item: id, target: mon.uid });
      close(null);
    };
    render();
    layer = openPanel(panel, (act) => {
      if (act === 'left') { tab = (tab + tabs.length - 1) % tabs.length; audio.sfx('cursor'); render(); }
      else if (act === 'right') { tab = (tab + 1) % tabs.length; audio.sfx('cursor'); render(); }
      else if (menu) menu.key(act);
      else if (act === 'b') close(null);
    }, { onForceClose: () => resolve(null) });
  });
}

// ---------- atlas ----------
export function openDex(ctx) {
  return new Promise((resolve) => {
    const me = ctx.me();
    const seen = me.dex.seen;
    const caught = me.dex.caught;
    let idx = 0;
    const grid = h('div', { class: 'dex-grid' });
    const detail = h('div', { class: 'item-desc', style: 'min-height:120px' });
    const panel = h('div', { class: 'panel center-panel' },
      h('button', { class: 'close-x', onclick: () => close() }, '×'),
      h('h2', {}, 'Atlas tvorů ', h('span', { class: 'small muted' }, `Viděno ${Object.keys(seen).length} · Chyceno ${Object.keys(caught).length} / ${SPECIES_LIST.length}`)),
      grid, detail);
    const cells = SPECIES_LIST.map((k, i) => {
      const sp = SPECIES[k];
      const known = seen[k];
      const c = h('div', { class: 'dex-cell' },
        h('img', { src: monIconURL(k, 72, { silhouette: !known }), alt: '' }),
        h('div', { class: 'no' }, '№ ' + String(sp.no).padStart(3, '0') + (caught[k] ? ' ●' : '')),
        h('div', {}, known ? sp.n : '???'));
      c.onclick = () => { idx = i; render(); };
      grid.appendChild(c);
      return c;
    });
    const render = () => {
      cells.forEach((c, i) => c.classList.toggle('sel', i === idx));
      cells[idx].scrollIntoView({ block: 'nearest' });
      const k = SPECIES_LIST[idx];
      const sp = SPECIES[k];
      detail.innerHTML = '';
      if (!seen[k]) { detail.append('Tohoto tvora jsi ještě nepotkal.'); return; }
      const evo = (sp.evo || []).map((e) => (e.trade ? `výměnou → ${SPECIES[e.to].n}` : `úr. ${e.lvl} → ${SPECIES[e.to].n}`));
      detail.append(...[
        h('div', { class: 'row' }, h('b', {}, sp.n), ...sp.ty.map(typeBadge), caught[k] ? h('span', { class: 'small' }, '● chycen') : h('span', { class: 'small muted' }, 'jen viděn')),
        h('div', { class: 'small', style: 'margin-top:4px' }, caught[k] ? sp.d : 'Chyť ho, abys o něm zjistil víc.'),
        caught[k] && (evo.length || PREVO[k]) ? h('div', { class: 'small muted', style: 'margin-top:4px' }, PREVO[k] ? `Vyvíjí se z: ${SPECIES[PREVO[k]].n}. ` : '', evo.length ? `Vývoj: ${evo.join(', ')}` : '') : null,
      ].filter(Boolean));
    };
    let layer;
    const close = () => { layer.close(); resolve(); };
    render();
    layer = openPanel(panel, (act) => {
      const cols = Math.max(1, Math.floor(grid.clientWidth / 98));
      if (act === 'left') idx = Math.max(0, idx - 1);
      else if (act === 'right') idx = Math.min(cells.length - 1, idx + 1);
      else if (act === 'up') idx = Math.max(0, idx - cols);
      else if (act === 'down') idx = Math.min(cells.length - 1, idx + cols);
      else if (act === 'b') return close();
      else if (act === 'a') { if (seen[SPECIES_LIST[idx]]) audio.cry(SPECIES_LIST[idx]); return; }
      audio.sfx('cursor');
      render();
    }, { onForceClose: resolve });
  });
}

// ---------- obchod ----------
export function openShop(ctx, list, name) {
  return new Promise((resolve) => {
    let mode = 0;
    let menu = null;
    const listWrap = h('div', { class: 'item-list' });
    const desc = h('div', { class: 'item-desc' });
    const money = h('span', { class: 'money' });
    const tabRow = h('div', { class: 'tabs-row' });
    const panel = h('div', { class: 'panel center-panel', style: 'width:min(560px,calc(100vw - 20px))' },
      h('button', { class: 'close-x', onclick: () => close() }, '×'),
      h('div', { class: 'row' }, h('h2', {}, name || 'Obchod'), h('span', { class: 'spacer' }), money), tabRow, listWrap, desc);
    let layer;
    let busy = false;
    const close = () => { ctx.send({ t: 'close' }); layer.close(); resolve(); };
    const render = () => {
      const me = ctx.me();
      money.textContent = `${me.money} zl.`;
      tabRow.innerHTML = '';
      ['Koupit', 'Prodat'].forEach((t, i) => tabRow.appendChild(h('button', { class: 'tabbtn' + (i === mode ? ' sel' : ''), onclick: () => { mode = i; render(); } }, t)));
      let items;
      if (mode === 0) items = list.map((x) => ({ label: ITEMS[x.id].n, right: `${x.price} zl.`, id: x.id, price: x.price }));
      else items = Object.keys(me.bag).filter((id) => ITEMS[id] && ITEMS[id].cat !== 'key' && ITEMS[id].price > 0 && me.bag[id] > 0).map((id) => ({ label: `${ITEMS[id].n} ×${me.bag[id]}`, right: `${Math.floor(ITEMS[id].price / 2)} zl.`, id, price: Math.floor(ITEMS[id].price / 2) }));
      listWrap.innerHTML = '';
      if (!items.length) { listWrap.appendChild(h('p', { class: 'muted' }, 'Nemáš nic na prodej.')); menu = null; return; }
      menu = makeMenu(items, {
        start: menu ? Math.min(menu.idx, items.length - 1) : 0,
        onFocus: (it) => { desc.innerHTML = ''; desc.append(ITEMS[it.id].d || ''); },
        onSelect: (it) => trade(it),
        onCancel: close,
      });
      listWrap.appendChild(menu.el);
    };
    const trade = async (it) => {
      if (busy) return;
      const me = ctx.me();
      const max = mode === 0 ? Math.min(99, Math.floor(me.money / it.price)) : me.bag[it.id] || 0;
      if (max <= 0) { audio.sfx('deny'); toast(mode === 0 ? 'Na to nemáš dost peněz.' : 'Nemáš co prodat.'); return; }
      const opts = [1, 5, 10, 25].filter((n) => n <= max);
      const choice = await ask(`${ITEMS[it.id].n} – kolik kusů? (${it.price} zl./ks)`, [...opts.map((n) => `${n}× (${n * it.price} zl.)`), 'Zrušit']);
      if (choice < 0 || choice >= opts.length) return;
      busy = true;
      ctx.send({ t: mode === 0 ? 'buy' : 'sell', item: it.id, qty: opts[choice] });
      ctx.onShopResult = (res) => {
        busy = false;
        if (res.ok) audio.sfx('buy'); else audio.sfx('deny');
        toast(res.msg);
        render();
      };
    };
    render();
    layer = openPanel(panel, (act) => {
      if (act === 'left' || act === 'right') { mode = 1 - mode; audio.sfx('cursor'); menu = null; render(); }
      else if (menu) menu.key(act);
      else if (act === 'b') close();
    }, { onForceClose: resolve });
  });
}

// ---------- počítač ----------
export function openPC(ctx, data) {
  return new Promise((resolve) => {
    let box = 0;
    let sel = { area: 'box', i: 0 };
    const title = h('h3', {});
    const grid = h('div', { class: 'box-grid' });
    const partyCol = h('div', { class: 'party-col' });
    const msg = h('div', { class: 'item-desc small' }, data.msg || '');
    const panel = h('div', { class: 'panel center-panel', style: 'width:min(860px,calc(100vw - 20px))' },
      h('button', { class: 'close-x', onclick: () => close() }, '×'),
      h('h2', {}, 'Úložiště tvorů'),
      h('div', { class: 'pc-wrap' },
        h('div', {}, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { box = (box + 7) % 8; sel = { area: 'box', i: 0 }; render(); } }, '◀'), title, h('button', { class: 'btn', onclick: () => { box = (box + 1) % 8; sel = { area: 'box', i: 0 }; render(); } }, '▶')), grid),
        h('div', {}, h('h3', {}, 'Tým'), partyCol)),
      msg);
    let layer;
    const close = () => { ctx.send({ t: 'close' }); layer.close(); resolve(); };
    const render = () => {
      title.textContent = `Box ${box + 1}  (${data.boxes[box].length}/30)`;
      grid.innerHTML = '';
      for (let i = 0; i < 30; i++) {
        const m = data.boxes[box][i];
        const slot = h('div', { class: 'box-slot' + (sel.area === 'box' && sel.i === i ? ' sel' : '') }, m ? h('img', { src: monIconURL(m.s, 56, { shiny: m.shiny }), title: `${monLabel(m)} úr. ${m.lvl}` }) : null);
        slot.onclick = () => { sel = { area: 'box', i }; render(); act(); };
        grid.appendChild(slot);
      }
      partyCol.innerHTML = '';
      data.party.forEach((m, i) => {
        const r = h('div', { class: 'party-slot' + (sel.area === 'party' && sel.i === i ? ' sel' : '') }, h('img', { src: monIconURL(m.s, 40, { shiny: m.shiny }) }), `${monLabel(m)} úr. ${m.lvl}`);
        r.onclick = () => { sel = { area: 'party', i }; render(); act(); };
        partyCol.appendChild(r);
      });
    };
    const act = async () => {
      if (sel.area === 'box') {
        const m = data.boxes[box][sel.i];
        if (!m) return;
        const c = await ask(`${monLabel(m)} (úr. ${m.lvl}) – co s ním?`, ['Vzít do týmu', 'Shrnutí', 'Přesunout do dalšího boxu', 'Vypustit', 'Zpět']);
        if (c === 0) ctx.send({ t: 'pc', op: 'withdraw', box, idx: sel.i });
        else if (c === 1) await showSummary(m);
        else if (c === 2) ctx.send({ t: 'pc', op: 'move', box, idx: sel.i, to: (box + 1) % 8 });
        else if (c === 3) {
          const sure = await ask(`Opravdu vypustit ${monLabel(m)}? Už se nevrátí!`, ['Ne', 'Ano, vypustit']);
          if (sure === 1) ctx.send({ t: 'pc', op: 'release', box, idx: sel.i });
        }
      } else {
        const m = data.party[sel.i];
        if (!m) return;
        const c = await ask(`${monLabel(m)} (úr. ${m.lvl}) – co s ním?`, [`Uložit do Boxu ${box + 1}`, 'Shrnutí', 'Zpět']);
        if (c === 0) ctx.send({ t: 'pc', op: 'deposit', box, idx: sel.i });
        else if (c === 1) await showSummary(m);
      }
    };
    ctx.onPC = (d) => { data = d; if (d.msg) msg.textContent = d.msg; if (sel.area === 'party' && sel.i >= d.party.length) sel.i = Math.max(0, d.party.length - 1); render(); };
    render();
    layer = openPanel(panel, (a) => {
      if (a === 'b') return close();
      if (a === 'a') return act();
      if (sel.area === 'box') {
        if (a === 'left') { if (sel.i % 6 === 0) { box = (box + 7) % 8; } else sel.i--; }
        else if (a === 'right') { if (sel.i % 6 === 5) { if (data.party.length) sel = { area: 'party', i: 0 }; } else sel.i++; }
        else if (a === 'up') sel.i = Math.max(0, sel.i - 6);
        else if (a === 'down') sel.i = Math.min(29, sel.i + 6);
      } else {
        if (a === 'left') sel = { area: 'box', i: 5 };
        else if (a === 'up') sel.i = Math.max(0, sel.i - 1);
        else if (a === 'down') sel.i = Math.min(data.party.length - 1, sel.i + 1);
      }
      audio.sfx('cursor');
      render();
    }, { onForceClose: () => { ctx.onPC = null; resolve(); } });
  });
}

// ---------- výměna ----------
export function openTrade(ctx) {
  let state = null;
  let layer = null;
  const mineBox = h('div', { class: 'offer' });
  const theirsBox = h('div', { class: 'offer' });
  const status = h('p', { class: 'muted' });
  const pickBtn = h('button', { class: 'btn', onclick: () => choose() }, 'Vybrat tvora');
  const readyBtn = h('button', { class: 'btn ok', onclick: () => ctx.send({ t: 'trade_ready', ok: !state.ready }) }, 'Potvrdit');
  const cancelBtn = h('button', { class: 'btn', onclick: () => ctx.send({ t: 'trade_cancel' }) }, 'Zrušit výměnu');
  const titleEl = h('h2', {}, 'Výměna');
  const panel = h('div', { class: 'panel center-panel' }, titleEl,
    h('div', { class: 'trade-wrap' }, h('div', {}, h('h3', {}, 'Nabízíš'), mineBox), h('div', {}, h('h3', {}, 'Dostaneš'), theirsBox)),
    status, h('div', { class: 'row' }, pickBtn, readyBtn, h('span', { class: 'spacer' }), cancelBtn));
  const choose = async () => {
    const i = await pickMon(state.party, { title: 'Který tvor půjde do výměny?' });
    if (i >= 0) ctx.send({ t: 'trade_offer', uid: state.party[i].uid });
  };
  const showMon = (box, m) => {
    box.innerHTML = '';
    if (!m) { box.append(h('p', { class: 'muted' }, 'Zatím nic')); return; }
    const sp = SPECIES[m.s];
    box.append(h('img', { src: monIconURL(m.s, 110, { shiny: m.shiny }) }), h('div', {}, h('b', {}, monLabel(m)), m.shiny ? ' ★' : '', ` úr. ${m.lvl}`), h('div', {}, ...sp.ty.map(typeBadge)),
      h('div', { class: 'small muted' }, `Trenér: ${m.ot || '?'}`),
      h('button', { class: 'btn', style: 'margin-top:6px', onclick: () => showSummary(m) }, 'Detail'));
  };
  return {
    update(s) {
      state = s;
      titleEl.textContent = `Výměna s hráčem ${s.other}`;
      showMon(mineBox, s.mine ? s.party.find((m) => m.uid === s.mine) : null);
      showMon(theirsBox, s.theirs);
      readyBtn.textContent = s.ready ? 'Zrušit potvrzení' : 'Potvrdit výměnu';
      readyBtn.disabled = !(s.mine && s.theirs);
      status.textContent = s.ready && s.theirReady ? 'Měníme…' : s.ready ? 'Čekáš na potvrzení druhého hráče…' : s.theirReady ? `${s.other} už potvrdil. Potvrď i ty!` : 'Oba vyberte tvora a potvrďte.';
      if (!layer) {
        layer = openPanel(panel, (act) => {
          if (act === 'b') ctx.send({ t: 'trade_cancel' });
          if (act === 'a') choose();
        }, { backdrop: true });
      }
    },
    close() { if (layer) { layer.close(); layer = null; } },
  };
}
