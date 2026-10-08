'use strict';
// 📚 Historique des parties et Hall of Fame (fichier data/history.json).
// Sur un hébergement gratuit, le disque peut être éphémère : l'historique est alors remis à zéro
// au redémarrage, sans conséquence sur le jeu.

const fs = require('fs');
const path = require('path');
const U = require('./util');

const FILE = process.env.HISTORY_FILE || path.join(__dirname, '..', 'data', 'history.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { games: [], players: {} };
  }
}

function write(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function record(game) {
  const data = read();
  const ranking = game.ranking();
  if (!ranking.length) return;
  data.games.unshift({
    code: game.code,
    date: new Date().toISOString(),
    players: ranking.map((p) => ({ name: p.name, avatar: p.avatar, score: p.score, rank: game.rankOf(p.id, ranking) })),
    trophies: (game.final && game.final.trophies || []).map((t) => ({ emoji: t.emoji, title: t.title, name: (game.getPlayer(t.id) || {}).name })),
  });
  data.games = data.games.slice(0, 50);
  for (const p of ranking) {
    const key = U.normalize(p.name);
    const rec = data.players[key] || { name: p.name, avatar: p.avatar, games: 0, wins: 0, podiums: 0, best: 0, total: 0 };
    rec.name = p.name;
    rec.avatar = p.avatar;
    rec.games++;
    const rank = game.rankOf(p.id, ranking);
    if (rank === 1) rec.wins++;
    if (rank <= 3) rec.podiums++;
    rec.best = Math.max(rec.best, p.score);
    rec.total += p.score;
    data.players[key] = rec;
  }
  write(data);
}

function hallOfFame() {
  const data = read();
  const players = Object.values(data.players)
    .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.best - a.best)
    .slice(0, 10);
  return { players, games: data.games.slice(0, 5) };
}

module.exports = { record, hallOfFame };
