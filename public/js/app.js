// Point d'entrée : routage, connexion temps réel, rendu, minuteur, notifications.

import { h, storage, sfx, toggleMute, isMuted } from './lib.js';
import { homeView } from './home.js';
import { hostView, hostHeader, hostControls } from './host.js';
import { playerView, playerHeader, joinView } from './player.js';

const params = new URLSearchParams(location.search);
const path = location.pathname.replace(/\/+$/, '') || '/';
const route = path === '/host' ? 'host' : path === '/tv' ? 'tv' : path === '/play' ? 'play' : 'home';
const code = (params.get('code') || '').toUpperCase();
// Lien MC de secours : /host?code=ABCD&t=… -> on mémorise le jeton puis on nettoie l'URL
if (params.get('t') && code) {
  storage(`olymp-host-${code}`, params.get('t'));
  history.replaceState(null, '', `${location.pathname}?code=${code}`);
}

export const app = {
  route,
  code,
  state: null,
  receivedAt: 0,
  socket: null,
  joinError: null,
  joined: false,
  hostToken: code ? storage(`olymp-host-${code}`) : null,
  playerToken: code ? storage(`olymp-player-${code}`) : null,
  playerName: storage('olymp-name') || '',
  playerAvatar: storage('olymp-avatar') || '',
  local: {}, // état local d'interface (persiste entre deux rendus)
};

const root = document.getElementById('app');
document.body.classList.add(`route-${route}`);

// ───────────── Connexion ─────────────
function connect() {
  // eslint-disable-next-line no-undef
  const socket = io({ transports: ['websocket', 'polling'] });
  app.socket = socket;
  socket.on('connect', () => {
    banner(null);
    rejoin();
  });
  socket.on('disconnect', () => banner('📡 Connexion perdue… reconnexion en cours'));
  socket.on('joined', (d) => {
    app.joined = true;
    app.joinError = null;
    if (d.role === 'player' && d.token) {
      app.playerToken = d.token;
      storage(`olymp-player-${d.code}`, d.token);
      app.playerId = d.id;
    }
  });
  socket.on('state', (s) => {
    app.state = s;
    app.receivedAt = performance.now();
    render();
  });
  socket.on('fail', (msg) => {
    if (route === 'play' && !app.joined) {
      app.joinError = msg;
      if (/inconnu|introuvable/i.test(msg)) {
        storage(`olymp-player-${code}`, null);
        app.playerToken = null;
      }
      render();
    } else {
      toast(`⚠️ ${msg}`, 'error');
      if (route === 'host' && /refusé|introuvable/i.test(msg)) renderFatal(msg);
    }
  });
  socket.on('kicked', () => {
    storage(`olymp-player-${code}`, null);
    renderFatal('Le maître de cérémonie t’a retiré de la partie. Carton rouge ! 🟥');
  });
}

function rejoin() {
  const s = app.socket;
  if (route === 'host' && code) s.emit('host:join', { code, hostToken: app.hostToken });
  if (route === 'tv' && code) s.emit('screen:join', { code });
  if (route === 'play' && code && (app.playerToken || app.pendingJoin)) {
    s.emit('player:join', { code, name: app.playerName, avatar: app.playerAvatar, token: app.playerToken });
  }
}

export function joinGame(name, avatar) {
  app.playerName = name;
  app.playerAvatar = avatar;
  app.pendingJoin = true;
  storage('olymp-name', name);
  storage('olymp-avatar', avatar);
  app.socket.emit('player:join', { code, name, avatar, token: app.playerToken });
}

export function act(msg) {
  app.socket.emit('player:action', msg);
}

export function hostAct(msg) {
  app.socket.emit('host:action', msg);
}

// ───────────── Rendu ─────────────
let currentKey = null;
let currentView = null;
const main = h('main.stage');
const header = h('header.topbar');
const timerBar = h('div.timer', h('div.timer-fill'), h('div.timer-num'));
const footer = h('footer.controls');
const toasts = h('div.toasts');
const bannerEl = h('div.banner');

function frame() {
  root.replaceChildren(header, timerBar, main, footer, toasts, bannerEl);
}

function renderFatal(msg) {
  root.replaceChildren(h('div.fatal', h('div.fatal-card', h('div.big-emoji', '🗂️'), h('h2', msg), h('a.btn', { href: '/' }, 'Retour à l’accueil'))));
}

function preserveInputs(container) {
  const saved = {};
  container.querySelectorAll('input[data-keep], textarea[data-keep]').forEach((i) => { saved[i.dataset.keep] = { value: i.value, checked: i.checked }; });
  const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.keep : null;
  const sel = active && document.activeElement.selectionStart !== undefined ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  return () => {
    container.querySelectorAll('input[data-keep], textarea[data-keep]').forEach((i) => {
      const s = saved[i.dataset.keep];
      if (s) { i.value = s.value; if (i.type === 'checkbox') i.checked = s.checked; }
      if (active && i.dataset.keep === active) {
        i.focus();
        try { if (sel) i.setSelectionRange(sel[0], sel[1]); } catch { /* type number */ }
      }
    });
  };
}

let seenNotifs = null;

export function render() {
  const s = app.state;
  if (route === 'home') {
    root.replaceChildren(homeView());
    return;
  }
  if (route === 'play' && !app.joined) {
    root.replaceChildren(joinView());
    return;
  }
  if (!s) {
    root.replaceChildren(h('div.loading', h('div.spinner'), h('p', 'Connexion au cabinet…')));
    return;
  }
  if (!root.contains(main)) frame();

  // notifications
  if (!seenNotifs) seenNotifs = new Set((s.notifications || []).map((n) => n.id));
  for (const n of s.notifications || []) {
    if (!seenNotifs.has(n.id)) { seenNotifs.add(n.id); toast(n.text); }
  }

  document.body.dataset.phase = s.phase;
  const isPlayer = route === 'play';
  header.replaceChildren(isPlayer ? playerHeader(s) : hostHeader(s, route === 'host'));
  footer.replaceChildren(route === 'host' ? hostControls(s) : muteButton());

  const view = isPlayer ? playerView(s) : hostView(s, route === 'host');
  if (view.key !== currentKey) {
    currentKey = view.key;
    currentView = view;
    main.classList.remove('static');
    main.replaceChildren(view.build(true));
    main.scrollTop = 0;
  } else if (view.update) {
    currentView = view;
    view.update(s);
  } else {
    const restore = preserveInputs(main);
    main.classList.add('static');
    main.replaceChildren(view.build(false));
    restore();
  }
}

app.rerender = () => render();
// Petit accès de diagnostic (utilisé par les tests automatisés)
window.__state = () => {
  const st = app.state;
  if (!st) return null;
  const p = st.play || {};
  return { phase: st.phase, kind: p.kind, stage: p.stage, itype: p.item ? p.item.type : null, round: st.roundIndex };
};
window.__qrReady = () => { if (app.state && app.state.phase === 'lobby') render(); };

function muteButton() {
  return h('button.icon-btn.mute', { title: 'Son', onclick: (e) => { toggleMute(); e.currentTarget.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊');
}

export function toast(text, kind = '') {
  const t = h(`div.toast${kind ? '.toast-' + kind : ''}`, text);
  toasts.appendChild(t);
  setTimeout(() => t.classList.add('out'), 4800);
  setTimeout(() => t.remove(), 5400);
}

function banner(text) {
  bannerEl.textContent = text || '';
  bannerEl.classList.toggle('show', !!text);
}

// ───────────── Minuteur ─────────────
let lastTickSecond = null;
function tickTimer() {
  const s = app.state;
  const t = s && s.timer;
  if (!t) {
    timerBar.classList.remove('show');
  } else {
    const elapsed = t.paused ? 0 : performance.now() - app.receivedAt;
    const remaining = Math.max(0, t.remaining - elapsed);
    const ratio = t.duration ? remaining / t.duration : 0;
    timerBar.classList.add('show');
    timerBar.classList.toggle('urgent', remaining < 5000);
    timerBar.classList.toggle('paused', !!t.paused);
    timerBar.firstChild.style.transform = `scaleX(${ratio})`;
    const sec = Math.ceil(remaining / 1000);
    timerBar.lastChild.textContent = t.paused ? '⏸' : sec;
    if (sec !== lastTickSecond) {
      lastTickSecond = sec;
      if (sec <= 5 && sec > 0 && !t.paused && route !== 'play') sfx.tick();
    }
    document.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = t.paused ? '⏸' : sec; });
  }
  requestAnimationFrame(tickTimer);
}

// ───────────── Démarrage ─────────────
async function boot() {
  if (route === 'host' && !code) {
    connect();
    app.socket.emit('host:create', {}, ({ code: c, hostToken }) => {
      storage(`olymp-host-${c}`, hostToken);
      location.replace(`/host?code=${c}`);
    });
    root.replaceChildren(h('div.loading', h('div.spinner'), h('p', 'Ouverture du dossier…')));
    return;
  }
  if (route !== 'home') connect();
  render();
  requestAnimationFrame(tickTimer);
}

document.addEventListener('keydown', (e) => {
  if (route !== 'host' || !app.state) return;
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hostAct({ type: 'next' }); }
  if (e.key === 'p') hostAct({ type: 'pause' });
});

// Débloque l'audio au premier geste (politique des navigateurs)
document.addEventListener('pointerdown', () => sfx.click && null, { once: true });

boot();
