// Klávesnice a dotykové ovládání.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Enter: 'a', Space: 'a', KeyJ: 'a',
  KeyX: 'b', Escape: 'b', Backspace: 'b', KeyK: 'b',
  KeyM: 'start', Tab: 'start',
  KeyT: 'chat', Slash: 'chat',
};
const DIRS = ['up', 'down', 'left', 'right'];

class Input {
  constructor() {
    this.held = new Map(); // směr -> čas stisku
    this.listeners = new Set();
    this.run = false;
    this.touchRun = false;
    this.enabled = true;
    window.addEventListener('keydown', (e) => this.keydown(e));
    window.addEventListener('keyup', (e) => this.keyup(e));
    window.addEventListener('blur', () => { this.held.clear(); this.run = false; });
  }

  typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  keydown(e) {
    if (e.key === 'Shift') this.run = true;
    if (this.typing()) return;
    const act = KEYMAP[e.code];
    if (!act) return;
    if (act === 'start' && e.code === 'Tab') e.preventDefault();
    // klávesa, která otevírá chat, se nesmí propsat do textového pole
    if (act === 'chat') e.preventDefault();
    if (DIRS.includes(act)) {
      e.preventDefault();
      if (!this.held.has(act)) this.held.set(act, performance.now());
    }
    if (e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
    this.emit(act, e.repeat);
  }

  keyup(e) {
    if (e.key === 'Shift') this.run = false;
    const act = KEYMAP[e.code];
    if (act && DIRS.includes(act)) this.held.delete(act);
  }

  // Posluchač může vrátit true, čímž klávesu „spotřebuje“ (další už ji nedostanou).
  emit(act, repeat = false, src = 'key') {
    for (const l of [...this.listeners]) if (l(act, repeat, src) === true) break;
  }

  onPress(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  // Naposledy stisknutý držený směr.
  dir() {
    let best = null;
    let t = -1;
    for (const [d, time] of this.held) if (time > t) { t = time; best = d; }
    return best;
  }

  heldSince(d) { return this.held.get(d) ?? null; }

  isRunning() { return this.run || this.touchRun; }

  clear() { this.held.clear(); }

  setupTouch(root) {
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) return false;
    document.body.classList.add('touch');
    root.classList.remove('hidden');
    for (const b of root.querySelectorAll('[data-dir]')) {
      const d = b.dataset.dir;
      const on = (e) => { e.preventDefault(); b.classList.add('on'); if (!this.held.has(d)) this.held.set(d, performance.now()); this.emit(d, false, 'touch'); };
      const off = (e) => { e.preventDefault(); b.classList.remove('on'); this.held.delete(d); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
    }
    for (const b of root.querySelectorAll('[data-key]')) {
      const k = b.dataset.key;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.add('on');
        if (k === 'b') this.touchRun = true;
        this.emit(k, false, 'touch');
      });
      const up = () => { b.classList.remove('on'); if (k === 'b') this.touchRun = false; };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    }
    return true;
  }
}

export const input = new Input();
