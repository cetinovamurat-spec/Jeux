'use strict';
// 📸 Captures d'écran de toutes les phases (MC + joueur mobile), avec des bots pour les autres joueurs.
// Usage : node test/screens.js [dossier_sortie]
// Nécessite Playwright (installé globalement ou en local).

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const OUT = process.argv[2] || path.join(__dirname, 'screens');
fs.mkdirSync(OUT, { recursive: true });
process.env.PORT = String(31000 + Math.floor(Math.random() * 9000));
process.env.HISTORY_FILE = path.join(require('os').tmpdir(), `olymp-screens-${Date.now()}.json`);

let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const { server } = require('../server');
const { io } = require('socket.io-client');

const URL = `http://localhost:${process.env.PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function bot(name, code) {
  const sock = io(URL, { transports: ['websocket'], forceNew: true });
  const b = { name, sock, state: null, id: null };
  sock.on('joined', (d) => { b.id = d.id; });
  sock.on('state', (s) => { b.state = s; setTimeout(() => botAct(b), 300 + Math.random() * 900); });
  sock.emit('player:join', { code, name, avatar: pick(['🦁', '🐸', '🐙', '🦄', '🐯']) });
  return b;
}

function send(b, msg) { b.sock.emit('player:action', msg); }

function botAct(b) {
  const s = b.state;
  if (!s) return;
  if (s.phase === 'event' && s.event && s.event.interactive && s.event.stage === 'interactive') {
    const it = s.event.interactive;
    if (it.kind === 'defi' && it.players.includes(b.id) && it.myAnswer === undefined) send(b, { type: 'answer', value: 0 });
    if (it.kind === 'don' && it.chooser === b.id) send(b, { type: 'give', target: pick(s.players.filter((p) => p.id !== b.id)).id });
    return;
  }
  if (s.phase !== 'play' || !s.play) return;
  const p = s.play; const me = p.me || {};
  if (p.kind === 'questions' && p.stage === 'ask' && !me.answered) {
    const it = p.item;
    let value;
    if (it.type === 'mcq' || it.type === 'predict') value = pick(it.options.map((_, i) => i).filter((i) => i !== me.disabled));
    else if (it.type === 'vote') value = pick(it.options);
    else if (it.type === 'number') value = '150';
    else if (it.type === 'estimate' || it.type === 'predictNumber') value = String(Math.round(10 ** (Math.random() * 3)));
    else if (it.type === 'order') value = it.items.map((x) => x.id);
    send(b, { type: 'answer', value });
  }
  if (p.kind === 'menteur' && (p.stage === 'plead' || p.stage === 'vote')) {
    const limit = p.stage === 'plead' ? p.pleadIdx : p.order.length - 1;
    p.order.slice(0, limit + 1).forEach((t) => { if (t !== b.id && !(me.votes || {})[t]) send(b, { type: 'vote', target: t, value: pick(['truth', 'lie']) }); });
  }
  if (p.kind === 'reaction' && p.stage === 'go' && !me.answer) {
    const g = p.game;
    const value = g.type === 'memory' ? g.sequence : g.type === 'type' ? g.word : g.options ? pick(g.options) : g.grid ? Math.floor(Math.random() * g.grid.length) : 'go';
    send(b, { type: 'react', value, ms: 300 + Math.random() * 700 });
  }
  if (p.kind === 'mot') {
    if (me.isDescriber && p.stage === 'ready') send(b, { type: 'start' });
    if (p.stage === 'play' && !me.isDescriber) send(b, { type: 'guess', text: pick(['banque', 'excel', 'bilan', 'café']) });
  }
  if (p.kind === 'bluff' && me.card) {
    if (me.card.target && !me.target && (p.stage === 'discuss' || p.stage === 'act')) send(b, { type: 'target', target: pick(s.players.filter((x) => x.id !== b.id)).id });
    if (p.stage === 'act' && me.answer === undefined) send(b, { type: 'answer', value: Math.floor(Math.random() * 4) });
    if (p.stage === 'act' && me.answer !== undefined && !me.locked) send(b, { type: 'lock' });
  }
  if (p.kind === 'encheres') {
    if (p.stage === 'bid' && me.bid === undefined && !me.blocked) send(b, { type: 'bid', amount: pick([0, 100, 200, 500]) });
    if (p.stage === 'answer' && me.answer === undefined) send(b, { type: 'answer', value: 0 });
    if (p.stage === 'choose' && me.isWinner && p.choices && p.choices.length) send(b, { type: 'choose', value: p.choices[0].value });
  }
}

async function main() {
  await new Promise((r) => (server.listening ? r() : server.on('listening', r)));
  const browser = await playwright.chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const hostCtx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  // Pas d'accès Internet garanti dans l'environnement de test : on coupe les polices externes
  await hostCtx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const host = await hostCtx.newPage();
  const errors = [];
  host.on('pageerror', (e) => errors.push('host: ' + e.message));
  host.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('host console: ' + m.text()); });
  await host.goto(`${URL}/`, { waitUntil: 'domcontentloaded' });
  await sleep(500);
  await host.screenshot({ path: path.join(OUT, '00-accueil.png') });
  await host.goto(`${URL}/host`, { waitUntil: 'commit' });
  await host.waitForURL(/code=/);
  const code = new globalThis.URL(host.url()).searchParams.get('code');

  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phoneCtx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const phone = await phoneCtx.newPage();
  phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
  phone.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('phone console: ' + m.text()); });
  await phone.goto(`${URL}/play?code=${code}`, { waitUntil: 'domcontentloaded' });
  await sleep(500);
  await phone.screenshot({ path: path.join(OUT, '01-joueur-rejoindre.png') });
  await phone.fill('input.input', 'Murat');
  await phone.click('button.btn-gold');
  const bots = ['Thomas', 'Sarah', 'Julien', 'Inès', 'Karim'].map((n) => bot(n, code));
  await sleep(1500);
  await host.screenshot({ path: path.join(OUT, '02-mc-lobby.png') });
  await phone.screenshot({ path: path.join(OUT, '03-joueur-lobby.png') });

  // Option : ne jouer que certaines épreuves (ONLY=graphique,football)
  if (process.env.ONLY) {
    const ORDER = ['quiz', 'estimation', 'menteur', 'reaction', 'calcul', 'graphique', 'mot', 'bluff', 'football', 'encheres'];
    const keep = process.env.ONLY.split(',');
    for (let i = ORDER.length - 1; i >= 0; i--) {
      if (!keep.includes(ORDER[i])) { await host.locator('.set-round').nth(i).click(); await sleep(250); }
    }
  }
  // Durée (LENGTH=court|normal|long, express par défaut)
  const LABELS = { court: '⚡ Express', normal: '⏱ Normale', long: '🌙 Longue' };
  await host.click(`text=${LABELS[process.env.LENGTH || 'court']}`);
  await sleep(300);
  await host.click('.start-btn');
  await sleep(1800);

  const shots = {};
  let n = 4;
  const snap = async (label) => {
    const k = label.replace(/[^a-z0-9]+/gi, '-');
    shots[k] = (shots[k] || 0) + 1;
    if (shots[k] > Number(process.env.MAXSHOTS || 2)) return;
    const prefix = String(n++).padStart(2, '0');
    await host.screenshot({ path: path.join(OUT, `${prefix}-mc-${k}.png`) });
    await phone.screenshot({ path: path.join(OUT, `${prefix}-joueur-${k}.png`) });
  };

  const start = Date.now();
  while (Date.now() - start < 9 * 60 * 1000) {
    const st = await host.evaluate(() => {
      const s = window.__state ? window.__state() : null;
      return s;
    });
    if (!st) { await sleep(300); continue; }
    if (st.phase === 'final') { await sleep(6000); await snap('finale'); await host.evaluate(() => window.scrollTo(0, 620)); await sleep(400); await host.screenshot({ path: path.join(OUT, '98-mc-finale-milieu.png') }); await host.evaluate(() => window.scrollTo(0, 1400)); await sleep(400); await host.screenshot({ path: path.join(OUT, '99-mc-finale-bas.png') }); break; }
    const label = `r${st.round}-${st.phase}-${st.kind || ''}-${st.stage || ''}${st.itype ? '-' + st.itype : ''}`;
    // Le joueur « navigateur » répond via l'interface
    await phoneAct(phone, st);
    await sleep(st.phase === 'roundEnd' ? 3500 : st.phase === 'event' ? 2500 : 1300);
    await snap(label);
    await host.keyboard.press('ArrowRight');
    await sleep(500);
  }
  console.log(errors.length ? `⚠️ Erreurs JS :\n${errors.join('\n')}` : '✅ Aucune erreur JS');
  await browser.close();
  bots.forEach((b) => b.sock.close());
  server.close();
  process.exit(errors.length ? 1 : 0);
}

async function phoneAct(phone, st) {
  try {
    if (st.phase !== 'play') {
      if (st.phase === 'event') {
        const btn = await phone.$('.p-opt, .p-choices .btn');
        if (btn) await btn.click();
      }
      return;
    }
    if (st.kind === 'questions' && st.stage === 'ask') {
      if (st.itype === 'number' || st.itype === 'estimate' || st.itype === 'predictNumber') { await phone.fill('.p-num', '1200'); await phone.click('.p-numwrap .btn-gold'); return; }
      if (st.itype === 'order') { for (let i = 0; i < 4; i++) { const b = await phone.$('.p-order-items .btn'); if (b) await b.click(); await phone.waitForTimeout(150); } return; }
      const b = await phone.$('.p-opt:not(.disabled), .p-vote-btn');
      if (b) await b.click();
    }
    if (st.kind === 'menteur' && (st.stage === 'plead' || st.stage === 'vote')) {
      const b = await phone.$$('.vote-btns .btn');
      if (b[0]) await b[0].click();
    }
    if (st.kind === 'reaction' && st.stage === 'go') {
      await phone.waitForTimeout(400);
      const b = await phone.$('.rx-grid.play button, .p-opt, .rx-signal');
      if (b) await b.click();
    }
    if (st.kind === 'bluff' && st.stage === 'act') {
      const b = await phone.$('.p-opt'); if (b) await b.click();
      await phone.waitForTimeout(200);
      const l = await phone.$('text=🔒 Verrouiller ma réponse'); if (l) await l.click();
    }
    if (st.kind === 'encheres' && st.stage === 'bid') { const b = await phone.$('.bid-buttons .btn-gold'); if (b) await b.click(); }
    if (st.kind === 'encheres' && st.stage === 'answer') { const b = await phone.$('.p-opt'); if (b) await b.click(); }
    if (st.kind === 'mot' && st.stage === 'ready') { const b = await phone.$('.btn-huge'); if (b) await b.click(); }
    if (st.kind === 'mot' && st.stage === 'play') { const f = await phone.$('.p-guess input'); if (f) { await f.fill('provision'); await f.press('Enter'); } }
  } catch (e) {
    // l'écran a pu changer entre-temps
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
