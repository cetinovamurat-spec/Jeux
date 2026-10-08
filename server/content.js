'use strict';
// Chargement du contenu (dossier /content) + tirage « frais » :
// on évite de reposer les mêmes questions d'une partie à l'autre tant que le serveur tourne.

const path = require('path');
const U = require('./util');

const DIR = path.join(__dirname, '..', 'content');
const used = {};

function load(name) {
  const file = path.join(DIR, name);
  delete require.cache[require.resolve(file)];
  return require(file);
}

// Rechargé à chaque partie : on peut modifier le contenu sans redémarrer le serveur.
function all() {
  const team = load('team.js');
  const perso = load('perso.js');
  const extra = team.questionsPerso || {};
  return {
    team,
    textes: load('textes.js'),
    quiz: [...load('quiz.js'), ...(extra.quiz || [])],
    estimations: [...load('estimations.js'), ...(extra.estimations || [])],
    menteur: [...load('menteur.js'), ...(extra.menteur || [])],
    calcul: [...load('calcul.js'), ...(extra.calcul || [])],
    graphiques: load('graphiques.js'),
    mots: [...load('mots.js'), ...(extra.mots || [])],
    bluff: [...load('bluff.js'), ...(extra.bluff || [])],
    football: [...load('football.js'), ...(extra.football || [])],
    encheres: load('encheres.js'),
    evenements: load('evenements.js'),
    votes: [...perso.votes, ...(extra.votes || [])],
    miroirs: [...perso.miroirs, ...(extra.miroirs || [])],
    votesFoot: perso.votesFoot || [],
    miroirsChiffres: [...(perso.miroirsChiffres || []), ...(extra.miroirsChiffres || [])],
    miroirsFoot: perso.miroirsFoot || [],
  };
}

// Tire n éléments en privilégiant ceux qui n'ont pas encore servi.
function fresh(key, pool, n, filter) {
  const list = filter ? pool.filter(filter) : pool;
  if (!list.length || n <= 0) return [];
  used[key] = used[key] || new Set();
  const seen = used[key];
  const keyOf = (x) => (x.q || x.mot || x.texte || x.titre || x.nom || JSON.stringify(x).slice(0, 80)) + (x.visuel || '');
  let candidates = list.filter((x) => !seen.has(keyOf(x)));
  if (candidates.length < n) {
    // Tout a été joué : on recommence le cycle
    list.forEach((x) => seen.delete(keyOf(x)));
    candidates = list.slice();
  }
  const out = U.sample(candidates, n);
  out.forEach((x) => seen.add(keyOf(x)));
  return out;
}

// Mélange de difficultés : pattern = [1,2,2,3,3,4] -> pioche par difficulté (avec repli).
function byDifficulty(key, pool, pattern) {
  const out = [];
  const taken = new Set();
  for (const d of pattern) {
    let [x] = fresh(`${key}:d${d}`, pool, 1, (q) => (q.d || 2) === d && !taken.has(q));
    if (!x) [x] = fresh(`${key}:any`, pool, 1, (q) => !taken.has(q));
    if (x) { out.push(x); taken.add(x); }
  }
  return out;
}

function difficultyPattern(n) {
  // crescendo : facile -> extrême
  const base = [1, 2, 2, 3, 3, 4, 2, 3, 4, 1, 3, 4];
  return base.slice(0, n).sort((a, b) => a - b);
}

module.exports = { all, fresh, byDifficulty, difficultyPattern };
