'use strict';
// Non-régression des constats de revue : homonymes, équité des orateurs, jury du Menteur.
const Game = require('../server/game');
const MotRound = require('../server/rounds/mot');
const MenteurRound = require('../server/rounds/menteur');
const { meta } = require('../server/rounds');

const errors = [];
const NAMES = ['Murat', 'Hélène', 'Jean', 'Ranjing', 'Nicolas', 'Daniel', 'Thibault', 'Laura', 'Djega Leila', 'Emma B.', 'Karine', 'Lucy',
  'Valentin', 'Romane', 'Alphonse', 'Martin', 'Lucas', 'Emma Marchand', 'Lauryn-Carla', 'Anna', 'Titouan', 'Manuel Felipe', 'Rachel', 'Louise'];

function newGame(n, length = 'normal') {
  const g = new Game('TEST');
  g.broadcast = () => {};
  NAMES.slice(0, n).forEach((name) => g.join(name, ''));
  g.settings.length = length;
  return g;
}

// 1. « Emma » seul est refusé (homonymes), « Emma B. » accepté et reconnu
{
  const g = new Game('HOMO');
  const r = g.join('Emma', '');
  if (!r.error) errors.push('« Emma » seul aurait dû être refusé');
  const ok = g.join('Emma B.', '');
  if (!ok.player || !ok.player.profile || ok.player.profile.nom !== 'Biannic') errors.push('« Emma B. » non reconnu');
}

// 2. Deviner un mot : avec des déconnectés, chaque équipe a le même nombre de tours (et au moins un)
for (let trial = 0; trial < 300; trial++) {
  const g = newGame(24);
  g.start({ rounds: ['mot'], teams: true, events: false });
  const off = g.activePlayers().sort(() => Math.random() - 0.5).slice(0, 1 + (trial % 3));
  off.forEach((p) => { p.connected = false; });
  const r = new MotRound(g, meta('mot'));
  r.start();
  const perTeam = g.teams.map((t) => r.order.filter((id) => t.members.includes(id)).length);
  const withConnected = g.teams.filter((t) => t.members.some((id) => g.getPlayer(id).connected));
  if (r.order.some((id) => !g.getPlayer(id).connected)) errors.push('Orateur déconnecté retenu');
  const counts = perTeam.filter((_, i) => withConnected.includes(g.teams[i]));
  if (new Set(counts).size > 1 || counts.includes(0)) { errors.push(`Tours inégaux entre équipes : ${perTeam.join('/')}`); break; }
}

// 3. Menteur : au-delà de 10 joueurs, jury ; les accusés sont des joueurs connectés
for (let trial = 0; trial < 100; trial++) {
  const g = newGame(24);
  g.start({ rounds: ['menteur'], teams: false, events: false });
  g.activePlayers().slice(0, 5).forEach((p) => { p.connected = false; });
  const r = new MenteurRound(g, meta('menteur'));
  r.start();
  if (r.order.length !== 10 || !r.withJury) { errors.push(`Jury mal formé (${r.order.length} accusés)`); break; }
  if (r.order.some((id) => !g.getPlayer(id).connected)) { errors.push('Accusé déconnecté'); break; }
}

if (errors.length) {
  console.error('❌ Équité :\n - ' + [...new Set(errors)].join('\n - '));
  process.exit(1);
}
console.log('✅ Équité : homonymes refusés, tours d’orateur équitables, jury du Menteur correct');
process.exit(0);
