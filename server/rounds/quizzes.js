'use strict';
// Épreuves 1, 2, 5, 6 et 9 : toutes reposent sur le moteur générique de questions.

const QuestionRound = require('./questions');
const C = require('../content');
const U = require('../util');
const Roster = require('../roster');

// Insère des éléments à des positions réparties dans la liste
function spread(main, extras) {
  const out = main.slice();
  extras.forEach((x, i) => {
    const pos = Math.round(((i + 1) * (out.length + 1)) / (extras.length + 1));
    out.splice(Math.min(pos, out.length), 0, x);
  });
  return out;
}

// 🧠 ÉPREUVE 1 — Quiz culture générale (+ questions « Qui est le plus susceptible… » et « Miroir »)
class QuizRound extends QuestionRound {
  buildItems() {
    const c = this.game.content;
    const n = this.count(8, 4);
    const social = [];
    if (this.players.length >= 3) social.push(...C.fresh('votes', c.votes, 1));
    if (this.players.length >= 2) social.push(...C.fresh('miroirs', c.miroirs, 1));
    // 👥 Question « Trombinoscope » générée à partir de content/team.js
    social.push(...Roster.trombiQuestions((c.team && c.team.membres) || [], 1));
    const mcq = C.byDifficulty('quiz', c.quiz, C.difficultyPattern(n - social.length));
    return spread(mcq, social);
  }
}

// 🔢 ÉPREUVE 2 — Estimation impossible
class EstimationRound extends QuestionRound {
  buildItems() {
    const c = this.game.content;
    const n = this.count(5, 3);
    const mirror = this.players.length >= 3 && c.miroirsChiffres.length ? C.fresh('miroirsChiffres', c.miroirsChiffres, 1) : [];
    const pro = C.fresh('estim:pro', c.estimations, Math.ceil((n - mirror.length) / 2), (e) => e.cat === 'Cabinet');
    const other = C.fresh('estim:gen', c.estimations, n - mirror.length - pro.length, (e) => e.cat !== 'Cabinet');
    const items = U.shuffle([...pro, ...other]).map((e) => ({ ...e, type: 'estimation' }));
    return spread(items, mirror);
  }
}

// 🧮 ÉPREUVE 5 — Calcul mental (et pièges comptables)
class CalculRound extends QuestionRound {
  buildItems() {
    const c = this.game.content;
    const n = this.count(7, 4);
    return C.byDifficulty('calcul', c.calcul, C.difficultyPattern(n));
  }
}

// 📊 ÉPREUVE 6 — Analyse de graphique
class GraphiqueRound extends QuestionRound {
  buildItems() {
    const c = this.game.content;
    const n = this.count(5, 3);
    return C.byDifficulty('graph', c.graphiques, C.difficultyPattern(n));
  }
}

// ⚽ ÉPREUVE 9 — Quiz football
class FootballRound extends QuestionRound {
  constructor(game, meta) {
    super(game, meta);
    this.estimateScale = 0.6;
  }

  buildItems() {
    const c = this.game.content;
    const n = this.count(8, 5);
    const est = C.fresh('foot:est', c.football, 1, (q) => q.type === 'estimation');
    const ord = C.fresh('foot:ord', c.football, 1, (q) => q.type === 'ordre');
    const social = [];
    if (this.players.length >= 3 && c.votesFoot.length) social.push(...C.fresh('votesFoot', c.votesFoot, 1));
    else if (c.miroirsFoot.length) social.push(...C.fresh('miroirsFoot', c.miroirsFoot, 1));
    const rest = n - est.length - ord.length - social.length;
    const core = C.byDifficulty('foot', c.football.filter((q) => !q.type || q.type === 'vf'), C.difficultyPattern(rest));
    const main = core.slice();
    if (est[0]) main.splice(Math.min(3, main.length), 0, est[0]);
    if (ord[0]) main.splice(Math.min(main.length - 1, 6), 0, ord[0]);
    return spread(main, social);
  }
}

module.exports = { QuizRound, EstimationRound, CalculRound, GraphiqueRound, FootballRound };
