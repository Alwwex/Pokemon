// WebSocket spojení se serverem.
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Set();
    this.closeHandlers = new Set();
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      let opened = false;
      ws.onopen = () => { opened = true; this.connected = true; resolve(); };
      ws.onerror = () => { if (!opened) reject(new Error('Nelze se připojit k serveru.')); };
      ws.onclose = () => {
        this.connected = false;
        if (opened) for (const h of this.closeHandlers) h();
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        for (const h of this.handlers) h(m);
      };
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  on(fn) { this.handlers.add(fn); }
  onClose(fn) { this.closeHandlers.add(fn); }
  close() { if (this.ws) this.ws.close(); }
}

export const net = new Net();
