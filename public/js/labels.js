// Jmenovky a bubliny chatu nad hlavami (kreslí se v rozlišení obrazovky).
export function drawNameTag(g, x, y, name, color, fs) {
  g.font = `700 ${fs}px "Pixelify Sans", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, fs / 4);
  g.strokeStyle = 'rgba(20,16,30,0.9)';
  g.strokeText(name, x, y);
  g.fillStyle = color;
  g.fillText(name, x, y);
}

export function drawBubble(g, x, y, text, fs) {
  g.font = `400 ${fs}px "Pixelify Sans", sans-serif`;
  const maxW = fs * 16;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  const lh = fs * 1.15;
  const w = Math.min(maxW, Math.max(...shown.map((l) => g.measureText(l).width))) + fs;
  const h = shown.length * lh + fs * 0.5;
  const bx = x - w / 2;
  const by = y - h;
  g.fillStyle = 'rgba(251,247,238,0.96)';
  g.strokeStyle = '#2b2742';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(bx, by, w, h, 8);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(x - 5, by + h);
  g.lineTo(x, by + h + 7);
  g.lineTo(x + 5, by + h);
  g.fill();
  g.fillStyle = '#1d1a2c';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  shown.forEach((l, i) => g.fillText(l, x, by + fs * 0.25 + i * lh));
  g.textBaseline = 'bottom';
}

export function playerLabel(o) {
  return { text: (o.battle ? '⚔ ' : '') + (o.champ ? '♛ ' : '') + o.name, color: o.champ ? '#ffd84a' : '#ffffff' };
}
