// Petite boîte à outils front : création d'éléments, formatage, sons, confettis, minuteur.

export function h(tag, attrs, ...children) {
  const [head, ...classes] = tag.split('.');
  const [name, id] = head.split('#');
  const el = document.createElement(name || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  // Le 2e argument n'est un objet d'attributs que s'il s'agit d'un objet « simple »
  if (attrs !== null && attrs !== undefined && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (prop.startsWith('--')) el.style.setProperty(prop, val);
          else el.style[prop] = val;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function fmt(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '–';
  return Math.round(Number(n)).toLocaleString('fr-FR');
}

export function fmtNum(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '–';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M`;
  if (abs >= 1e4) return Math.round(n).toLocaleString('fr-FR');
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

export function signed(n) {
  const v = Math.round(n || 0);
  return (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v));
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const OPTION_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#c98a00', '#7a5af0', '#e34948'];

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
}

// ───────────── Sons (synthétisés, aucun fichier) ─────────────
let audioCtx = null;
let muted = storage('olymp-muted') === '1';

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  storage('olymp-muted', muted ? '1' : '0');
  return muted;
}

function ctx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, start, dur, type = 'sine', vol = 0.15, slide) {
  const c = ctx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export const sfx = {
  good() { if (muted) return; tone(660, 0, 0.12, 'triangle'); tone(990, 0.1, 0.25, 'triangle'); },
  bad() { if (muted) return; tone(180, 0, 0.35, 'sawtooth', 0.08, 120); },
  tick() { if (muted) return; tone(1200, 0, 0.05, 'square', 0.04); },
  click() { if (muted) return; tone(500, 0, 0.05, 'triangle', 0.08); },
  whistle() { if (muted) return; tone(2200, 0, 0.18, 'sine', 0.12, 2600); tone(2200, 0.22, 0.4, 'sine', 0.12, 2700); },
  reveal() { if (muted) return; [0, 0.08, 0.16, 0.24, 0.32].forEach((t, i) => tone(300 + i * 80, t, 0.1, 'square', 0.04)); },
  fanfare() { if (muted) return; [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.7], [1047, 0.85]].forEach(([f, t]) => tone(f, t, 0.3, 'triangle', 0.12)); },
  siren() { if (muted) return; for (let i = 0; i < 3; i++) { tone(700, i * 0.5, 0.25, 'sawtooth', 0.05, 1100); tone(1100, i * 0.5 + 0.25, 0.25, 'sawtooth', 0.05, 700); } },
  stamp() { if (muted) return; tone(90, 0, 0.15, 'square', 0.15, 50); },
  coin() { if (muted) return; tone(988, 0, 0.08, 'square', 0.06); tone(1319, 0.08, 0.3, 'square', 0.06); },
};

// ───────────── Confettis ─────────────
let confettiCanvas = null;
let pieces = [];
let raf = null;

export function confetti(amount = 120, opts = {}) {
  if (!confettiCanvas) {
    confettiCanvas = h('canvas.confetti');
    document.body.appendChild(confettiCanvas);
  }
  const W = (confettiCanvas.width = window.innerWidth);
  const H = (confettiCanvas.height = window.innerHeight);
  const colors = opts.colors || ['#f5c542', '#e34948', '#2a78d6', '#1baf7a', '#ffffff', '#ffe066'];
  for (let i = 0; i < amount; i++) {
    pieces.push({
      x: opts.x !== undefined ? opts.x * W : Math.random() * W,
      y: opts.y !== undefined ? opts.y * H : -20 - Math.random() * H * 0.3,
      vx: (Math.random() - 0.5) * (opts.spread || 6),
      vy: opts.y !== undefined ? -Math.random() * 12 - 4 : Math.random() * 3 + 2,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 8,
      hgt: 8 + Math.random() * 10,
      c: pick(colors),
      life: 0,
    });
  }
  if (!raf) loop();
}

function loop() {
  const c = confettiCanvas.getContext('2d');
  c.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  pieces = pieces.filter((p) => p.y < confettiCanvas.height + 40 && p.life < 600);
  for (const p of pieces) {
    p.life++;
    p.vy += 0.12;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.r += p.vr;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.r);
    c.fillStyle = p.c;
    c.fillRect(-p.w / 2, -p.hgt / 2, p.w, p.hgt * Math.abs(Math.cos(p.r * 2)));
    c.restore();
  }
  if (pieces.length) raf = requestAnimationFrame(loop);
  else { raf = null; c.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

// ───────────── Animation de compteur ─────────────
export function countUp(el, from, to, dur = 1200) {
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ───────────── QR code (bibliothèque optionnelle chargée depuis cdnjs) ─────────────
export function qrSvg(text, size = 160) {
  if (!window.qrcode) return null;
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const cell = size / (n + 4);
    let path = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) path += `M${(c + 2) * cell},${(r + 2) * cell}h${cell}v${cell}h-${cell}z`;
      }
    }
    const wrap = document.createElement('div');
    wrap.className = 'qr';
    wrap.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QR code pour rejoindre"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#0b1626"/></svg>`;
    return wrap;
  } catch {
    return null;
  }
}
