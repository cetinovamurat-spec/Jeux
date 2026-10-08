'use strict';
// 🎲 Événements aléatoires entre les épreuves (Contrôle qualité, Pause café, Fin de mois…)
// Le contenu est dans content/evenements.js ; ce fichier sait appliquer chaque type d'effet.

const U = require('./util');
const C = require('./content');

// cible : 'tous' | 'leader' | 'dernier' | 'derniers:3' | 'premiers:2' | 'hasard' | 'hasard:2' | 'moitie-basse' | 'moitie-haute'
function selectPlayers(game, spec = 'hasard') {
  const ranking = game.ranking();
  if (!ranking.length) return [];
  const [kind, nStr] = String(spec).split(':');
  const n = Number(nStr) || 1;
  switch (kind) {
    case 'tous': return ranking;
    case 'leader': return ranking.filter((p) => p.score === ranking[0].score).slice(0, 1);
    case 'dernier': return [ranking[ranking.length - 1]];
    case 'derniers': return ranking.slice(-Math.min(n, Math.max(1, ranking.length - 1)));
    case 'premiers': return ranking.slice(0, Math.min(n, Math.max(1, ranking.length - 1)));
    case 'moitie-basse': return U.sample(ranking.slice(Math.floor(ranking.length / 2)), n);
    case 'moitie-haute': return U.sample(ranking.slice(0, Math.ceil(ranking.length / 2)), n);
    case 'hasard':
    default: return U.sample(ranking.filter((p) => p.connected).length ? ranking.filter((p) => p.connected) : ranking, n);
  }
}

function names(list) {
  return list.map((p) => p.name).join(', ');
}

function pickEvent(game) {
  const pool = game.content.evenements.filter((e) => !game.usedEvents.has(e.id) && (e.min || 2) <= game.activePlayers().length);
  const list = pool.length ? pool : game.content.evenements;
  const e = U.pick(list);
  game.usedEvents.add(e.id);
  return e;
}

function start(game, forced) {
  const def = forced || pickEvent(game);
  const ev = { def, stage: 'done', lines: [], targets: [], deltas: {} };
  game.event = ev;
  apply(game, ev);
  return ev;
}

function addDelta(ev, p, d) {
  ev.deltas[p.id] = (ev.deltas[p.id] || 0) + d;
}

function apply(game, ev) {
  const e = ev.def.effet;
  const g = game;
  const targets = selectPlayers(g, e.cible);
  ev.targets = targets.map((p) => p.id);
  const text = (t) => U.fillTemplate(t, [names(targets)], names(targets));
  ev.texte = text(ev.def.texte);
  switch (e.type) {
    case 'multiplicateur':
      g.pendingMods.global.mult = (g.pendingMods.global.mult || 1) * e.valeur;
      ev.lines.push(`Tous les points de la prochaine épreuve seront multipliés par ${e.valeur}.`);
      break;
    case 'points':
      for (const p of targets) addDelta(ev, p, g.award(p, e.valeur, { raw: true, reason: ev.def.titre }));
      break;
    case 'pourcentage':
      for (const p of targets) {
        const d = Math.round((p.score * e.valeur) / 100 / 5) * 5;
        addDelta(ev, p, g.award(p, d, { raw: true, reason: ev.def.titre }));
      }
      break;
    case 'transfert': {
      const from = selectPlayers(g, e.de);
      let to = selectPlayers(g, e.vers).filter((p) => !from.includes(p));
      if (!to.length && String(e.vers).startsWith('hasard')) to = U.sample(g.activePlayers().filter((p) => !from.includes(p)), 1);
      if (!from.length || !to.length) { ev.lines.push('Transfert annulé : l’expert-comptable n’a pas trouvé le RIB.'); break; }
      for (const f of from) addDelta(ev, f, g.award(f, -e.valeur, { raw: true, reason: ev.def.titre }));
      const share = Math.round((e.valeur * from.length) / to.length);
      for (const t of to) addDelta(ev, t, g.award(t, share, { raw: true, reason: ev.def.titre }));
      ev.targets = [...from, ...to].map((p) => p.id);
      ev.texte = U.fillTemplate(ev.def.texte, [names(from), names(to)], names(from));
      break;
    }
    case 'mod':
      for (const p of targets) {
        const m = g.pendingMods.players[p.id] = g.pendingMods.players[p.id] || {};
        if (e.mod === 'mult') m.mult = (m.mult || 1) * e.valeur;
        else m[e.mod] = true;
      }
      break;
    case 'echange-voisins': {
      const r = g.ranking();
      if (r.length < 2) break;
      const i = U.randInt(0, r.length - 2);
      const a = r[i]; const b = r[i + 1];
      const diff = a.score - b.score;
      addDelta(ev, a, g.award(a, -diff, { raw: true, reason: ev.def.titre }));
      addDelta(ev, b, g.award(b, diff, { raw: true, reason: ev.def.titre }));
      ev.targets = [a.id, b.id];
      ev.texte = U.fillTemplate(ev.def.texte, [a.name, b.name], a.name);
      break;
    }
    case 'arrondi':
      for (const p of g.activePlayers()) {
        const rounded = Math.round(p.score / e.pas) * e.pas;
        if (rounded !== p.score) addDelta(ev, p, g.award(p, rounded - p.score, { raw: true, reason: ev.def.titre }));
      }
      ev.targets = [];
      break;
    case 'roulette':
      for (const p of targets) addDelta(ev, p, g.award(p, U.pick(e.valeurs), { raw: true, reason: ev.def.titre }));
      break;
    case 'don':
      ev.stage = 'interactive';
      ev.interactive = { kind: 'don', chooser: targets[0] && targets[0].id, amount: e.valeur };
      g.setTimer(25);
      break;
    case 'defi':
    case 'tous-defi': {
      const [q] = C.fresh('event-defi', g.content.quiz, 1, (x) => (x.d || 2) <= 3 && !x.type);
      const order = U.shuffle(q.choix.map((_, i) => i));
      ev.stage = 'interactive';
      ev.interactive = {
        kind: 'defi',
        players: e.type === 'tous-defi' ? g.activePlayers().map((p) => p.id) : ev.targets,
        q: q.q,
        options: order.map((i) => q.choix[i]),
        answer: order.indexOf(0),
        gain: e.gain,
        perte: e.perte || 0,
        answers: {},
        info: q.info,
      };
      g.setTimer(20);
      break;
    }
    default:
      break;
  }
}

function action(game, player, msg) {
  const ev = game.event;
  if (!ev || ev.stage !== 'interactive') return false;
  const it = ev.interactive;
  if (it.kind === 'don' && msg.type === 'give' && player.id === it.chooser) {
    const to = game.getPlayer(msg.target);
    if (!to || to.id === player.id) return false;
    finishDon(game, ev, to);
    return true;
  }
  if (it.kind === 'defi' && msg.type === 'answer' && it.players.includes(player.id) && it.answers[player.id] === undefined) {
    const i = Number(msg.value);
    if (!Number.isInteger(i) || i < 0 || i >= it.options.length) return false;
    it.answers[player.id] = i;
    const waiting = it.players.filter((id) => { const p = game.getPlayer(id); return p && p.connected && it.answers[id] === undefined; });
    if (!waiting.length) finishDefi(game, ev);
    return true;
  }
  return false;
}

function finishDon(game, ev, to) {
  const it = ev.interactive;
  const giver = game.getPlayer(it.chooser);
  if (!to) {
    const candidates = game.activePlayers().filter((p) => p.id !== it.chooser);
    to = U.pick(candidates);
  }
  if (to) {
    addDelta(ev, to, game.award(to, it.amount, { raw: true, reason: ev.def.titre }));
    ev.lines.push(`${giver ? giver.name : 'L’associé'} offre ${it.amount} pts à ${to.name}. Quelle générosité (suspecte).`);
    it.recipient = to.id;
  }
  ev.stage = 'done';
  if (game.settings.autoNext) game.setTimer(8); else game.clearTimer();
}

function finishDefi(game, ev) {
  const it = ev.interactive;
  for (const id of it.players) {
    const p = game.getPlayer(id);
    if (!p) continue;
    const a = it.answers[id];
    if (a === it.answer) addDelta(ev, p, game.award(p, it.gain, { raw: true, reason: ev.def.titre }));
    else if (it.perte) addDelta(ev, p, game.award(p, -it.perte, { raw: true, reason: ev.def.titre }));
  }
  ev.stage = 'done';
  if (game.settings.autoNext) game.setTimer(8); else game.clearTimer();
}

// Fin du temps imparti ou « Suivant » du MC : on tranche.
function force(game) {
  const ev = game.event;
  if (!ev || ev.stage !== 'interactive') return;
  if (ev.interactive.kind === 'don') finishDon(game, ev, null);
  else finishDefi(game, ev);
}

function view(game, player) {
  const ev = game.event;
  if (!ev) return null;
  const out = {
    id: ev.def.id, emoji: ev.def.emoji, titre: ev.def.titre, texte: ev.texte, flavor: ev.def.flavor || '',
    stage: ev.stage, targets: ev.targets, deltas: ev.deltas, lines: ev.lines,
  };
  if (ev.interactive) {
    const it = ev.interactive;
    out.interactive = { kind: it.kind, chooser: it.chooser, amount: it.amount, players: it.players, q: it.q, options: it.options, gain: it.gain, perte: it.perte, recipient: it.recipient, answered: it.answers ? Object.keys(it.answers) : [] };
    if (ev.stage === 'done' && it.kind === 'defi') { out.interactive.answer = it.answer; out.interactive.answers = it.answers; out.interactive.info = it.info; }
    if (player && it.answers) out.interactive.myAnswer = it.answers[player.id];
  }
  return out;
}

module.exports = { start, action, force, view, selectPlayers };
