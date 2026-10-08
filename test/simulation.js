'use strict';
// 🤖 Simulation complète d'une soirée : un MC + 6 bots jouent les 10 épreuves via Socket.IO.
// Vérifie : lobby, synchro, toutes les épreuves, événements, reconnexion, classement final.
// Usage : node test/simulation.js [nbBots]

process.env.PORT = process.env.PORT || String(30000 + Math.floor(Math.random() * 20000));
process.env.HISTORY_FILE = require('path').join(require('os').tmpdir(), `olympiades-test-${Date.now()}.json`);

const errors = [];
const origError = console.error;
console.error = (...args) => { errors.push(args.map(String).join(' ')); origError(...args); };
console.log = ((log) => (...args) => { if (!String(args[0]).startsWith('[')) log(...args); })(console.log);

const { server, games } = require('../server');
const { io } = require('socket.io-client');

const URL = `http://localhost:${process.env.PORT}`;
const N = Number(process.argv[2]) || 6;
const NAMES = ['Murat', 'Thomas', 'Sarah', 'Julien', 'Inès', 'Karim', 'Léa', 'Hugo', 'Chloé', 'Yanis', 'Emma', 'Lucas', 'Nora', 'Adam', 'Jade', 'Rayan'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seen = { phases: new Set(), rounds: new Set(), kinds: new Set(), stages: new Set(), events: 0 };
const bots = [];

function connect() {
  return io(URL, { transports: ['websocket'], forceNew: true });
}

function makeBot(name) {
  const bot = { name, state: null, token: null, id: null, sock: null };
  const attach = (sock) => {
    bot.sock = sock;
    sock.on('joined', (d) => { if (d.token) bot.token = d.token; bot.id = d.id; });
    sock.on('state', (s) => { bot.state = s; setTimeout(() => act(bot), 10 + Math.random() * 40); });
    sock.on('fail', (m) => errors.push(`fail pour ${name}: ${m}`));
  };
  bot.join = (code) => {
    const sock = connect();
    attach(sock);
    sock.emit('player:join', { code, name, avatar: pick(['🦊', '🐼', '🦁', '🐸']), token: bot.token });
  };
  return bot;
}

function send(bot, msg) {
  bot.sock.emit('player:action', msg);
}

function describerWord() {
  for (const b of bots) if (b.state && b.state.play && b.state.play.word) return b.state.play.word.mot;
  return null;
}

function act(bot) {
  const s = bot.state;
  if (!s) return;
  if (s.phase === 'event' && s.event && s.event.interactive && s.event.stage === 'interactive') {
    const it = s.event.interactive;
    if (it.kind === 'defi' && it.players.includes(bot.id) && it.myAnswer === undefined) send(bot, { type: 'answer', value: Math.floor(Math.random() * it.options.length) });
    if (it.kind === 'don' && it.chooser === bot.id) send(bot, { type: 'give', target: pick(s.players.filter((p) => p.id !== bot.id)).id });
    return;
  }
  if (s.phase !== 'play' || !s.play) return;
  const p = s.play;
  seen.kinds.add(p.kind);
  seen.stages.add(`${p.kind}:${p.stage}`);
  const me = p.me || {};
  switch (p.kind) {
    case 'questions': {
      if (p.stage !== 'ask' || me.answered) return;
      const it = p.item;
      let value;
      if (it.type === 'mcq' || it.type === 'predict') {
        const opts = it.options.map((_, i) => i).filter((i) => i !== me.disabled);
        value = pick(opts);
      } else if (it.type === 'vote') value = pick(it.options);
      else if (it.type === 'number') value = String(Math.round(Math.random() * 500));
      else if (it.type === 'estimate') value = String(Math.round(10 ** (Math.random() * 9)));
      else if (it.type === 'order') value = it.items.map((x) => x.id).sort(() => Math.random() - 0.5);
      send(bot, { type: 'answer', value, risk: Math.random() < 0.2 });
      return;
    }
    case 'menteur': {
      if (p.stage !== 'plead' && p.stage !== 'vote') return;
      const limit = p.stage === 'plead' ? p.pleadIdx : p.order.length - 1;
      p.order.slice(0, limit + 1).forEach((t) => {
        if (t !== bot.id && !(me.votes && me.votes[t])) send(bot, { type: 'vote', target: t, value: pick(['truth', 'lie']) });
      });
      return;
    }
    case 'reaction': {
      if (p.stage !== 'go' || me.answer) return;
      const g = p.game;
      let value;
      if (g.type === 'memory') value = Math.random() < 0.7 ? g.sequence : [0, 0, 0];
      else if (g.type === 'type') value = Math.random() < 0.8 ? g.word : 'raté';
      else if (g.grid && !g.options) value = Math.floor(Math.random() * g.grid.length);
      else if (g.options) value = pick(g.options);
      send(bot, { type: 'react', value, ms: 200 + Math.random() * 800, early: g.type === 'signal' && Math.random() < 0.1 });
      return;
    }
    case 'mot': {
      if (me.isDescriber && p.stage === 'ready') return send(bot, { type: 'start' });
      if (p.stage !== 'play') return;
      if (me.isDescriber) { if (Math.random() < 0.05) send(bot, { type: 'pass' }); return; }
      const w = describerWord();
      if (Math.random() < 0.15) send(bot, { type: 'claim' });
      setTimeout(() => send(bot, { type: 'guess', text: w && Math.random() < 0.35 ? w : pick(['banque', 'audit', 'excel', 'café']) }), 100 + Math.random() * 400);
      return;
    }
    case 'bluff': {
      if (!me.card) return;
      if ((p.stage === 'discuss' || p.stage === 'act') && me.card.target && !me.target) {
        send(bot, { type: 'target', target: pick(s.players.filter((x) => x.id !== bot.id)).id });
      }
      if (me.card.id === 'doubleur' && p.stage === 'act' && Math.random() < 0.5 && !me.double) send(bot, { type: 'double', on: true });
      if (p.stage === 'act' && me.answer === undefined) send(bot, { type: 'answer', value: Math.floor(Math.random() * p.q.options.length) });
      if (p.stage === 'act' && me.answer !== undefined && !me.locked) send(bot, { type: 'lock' });
      return;
    }
    case 'encheres': {
      if (p.stage === 'bid' && me.bid === undefined && !me.blocked) send(bot, { type: 'bid', amount: pick([0, 100, 200, 500, 1000, 5000]) });
      if (p.stage === 'answer' && me.answer === undefined && p.question) send(bot, { type: 'answer', value: Math.floor(Math.random() * p.question.options.length) });
      if (p.stage === 'choose' && me.isWinner && p.choices && p.choices.length) send(bot, { type: 'choose', value: pick(p.choices).value });
      return;
    }
    default:
  }
}

async function main() {
  await new Promise((r) => server.listening ? r() : server.on('listening', r));
  const host = connect();
  let hostState = null;
  host.on('state', (s) => { hostState = s; seen.phases.add(s.phase); if (s.round) seen.rounds.add(s.round.id); });
  host.on('fail', (m) => errors.push('host fail: ' + m));
  const { code, hostToken } = await new Promise((r) => host.emit('host:create', {}, r));
  host.emit('host:join', { code, hostToken });
  console.log(`🎲 Partie ${code} — ${N} bots`);

  // Écran TV
  const tv = connect();
  let tvState = null;
  tv.on('state', (s) => { tvState = s; });
  tv.emit('screen:join', { code });

  for (let i = 0; i < N; i++) {
    const b = makeBot(NAMES[i]);
    bots.push(b);
    b.join(code);
    await sleep(30);
  }
  // pseudo déjà pris
  const dup = connect();
  const dupFail = new Promise((r) => dup.on('fail', r));
  dup.emit('player:join', { code, name: 'murat' });
  const dupMsg = await Promise.race([dupFail, sleep(1000).then(() => null)]);
  if (!dupMsg) errors.push('Le pseudo en double aurait dû être refusé');
  dup.close();

  await sleep(300);
  if (!hostState || hostState.players.length !== N) errors.push(`Lobby: ${hostState && hostState.players.length} joueurs au lieu de ${N}`);
  const profiled = hostState.players.find((p) => p.name === 'Murat');
  if (!profiled || !profiled.profile) errors.push('Profil team.js non reconnu pour Murat');

  host.emit('host:action', { type: 'start', settings: { length: 'court', events: true, teams: true } });

  const started = Date.now();
  let reconnected = false;
  let lastPhase = null;
  let lastKey = '';
  let stuck = 0;
  while (Date.now() - started < 240000) {
    await sleep(220);
    const s = hostState;
    if (!s) continue;
    if (s.phase === 'final') break;
    if (s.phase === 'event') seen.events += s.phase !== lastPhase ? 1 : 0;
    lastPhase = s.phase;

    // Reconnexion d'un joueur au milieu de la partie
    if (!reconnected && s.roundIndex === 3 && s.phase === 'play') {
      reconnected = true;
      const b = bots[1];
      const oldId = b.id;
      b.sock.close();
      await sleep(300);
      const offline = hostState.players.find((p) => p.id === oldId);
      if (!offline || offline.connected) errors.push('Déconnexion non détectée');
      b.join(code);
      await sleep(400);
      if (b.id !== oldId) errors.push('Reconnexion : identité perdue');
      const back = hostState.players.find((p) => p.id === oldId);
      if (!back || !back.connected) errors.push('Reconnexion non prise en compte');
      console.log('  🔌 Reconnexion testée : OK');
    }

    // Le MC avance quand tout le monde a répondu (ou régulièrement)
    const key = JSON.stringify([s.phase, s.roundIndex, s.play && s.play.stage, s.play && (s.play.index ?? s.play.turn ?? s.play.manche ?? s.play.pleadIdx ?? s.play.revealIdx)]);
    stuck = key === lastKey ? stuck + 1 : 0;
    lastKey = key;
    if (s.phase === 'play' && s.play && s.play.kind === 'mot' && s.play.stage === 'play' && stuck < 6) continue;
    if (s.phase === 'play' && s.play && s.play.kind === 'mot' && s.play.stage === 'play' && Math.random() < 0.3) host.emit('host:action', { type: 'carton' });
    if (s.phase === 'roundEnd' && Math.random() < 0.1) host.emit('host:action', { type: 'adjust', pid: s.players[0].id, delta: -10, reason: 'test' });
    host.emit('host:action', { type: 'next' });
  }

  await sleep(500);
  const s = hostState;
  console.log(`  Phases vues    : ${[...seen.phases].join(', ')}`);
  console.log(`  Épreuves vues  : ${[...seen.rounds].join(', ')}`);
  console.log(`  Étapes vues    : ${seen.stages.size} (${[...seen.kinds].join(', ')})`);
  console.log(`  Événements     : ${seen.events}`);
  if (!s || s.phase !== 'final') errors.push(`Partie non terminée (phase ${s && s.phase}, épreuve ${s && s.roundIndex})`);
  else {
    const f = s.final;
    console.log('  🏆 Classement final :');
    f.ranking.slice(0, 3).forEach((r) => {
      const p = s.players.find((x) => x.id === r.id);
      console.log(`     ${r.rank}. ${p.name} — ${r.score} pts (${r.roundWins} victoire(s), ${r.accuracy ?? '–'} %)`);
    });
    console.log(`  Trophées : ${f.trophies.map((t) => t.emoji + ' ' + t.title).join(' · ')}`);
    console.log(`  Résumé : ${f.summary[0]}`);
    if (seen.rounds.size !== 10) errors.push(`Seulement ${seen.rounds.size} épreuves jouées`);
    if (!tvState || tvState.phase !== 'final') errors.push('Écran TV non synchronisé');
    const totals = s.players.map((p) => p.score);
    if (totals.some((x) => !Number.isFinite(x))) errors.push('Score non numérique');
  }
  if (games.size !== 1) errors.push('Nombre de parties inattendu');

  // Revanche
  host.emit('host:action', { type: 'rematch' });
  await sleep(300);
  if (hostState.phase !== 'lobby' || hostState.players.some((p) => p.score !== 0)) errors.push('Revanche : remise à zéro incorrecte');

  [host, tv, ...bots.map((b) => b.sock)].forEach((x) => x.close());
  server.close();
  if (errors.length) {
    origError(`\n❌ ${errors.length} problème(s) :\n - ${errors.slice(0, 20).join('\n - ')}`);
    process.exit(1);
  }
  console.info(`\n✅ Simulation OK en ${Math.round((Date.now() - started) / 1000)} s`);
  process.exit(0);
}

main().catch((e) => { origError(e); process.exit(1); });
