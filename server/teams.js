'use strict';
// Recomposition automatique des équipes entre chaque épreuve.
// Objectifs (par ordre d'importance) :
//   1. éviter de remettre ensemble les mêmes binômes (on garde un compteur de paires) ;
//   2. équilibrer les équipes selon les scores ;
//   3. garder une part de hasard pour que la mécanique ne soit pas lisible.

const U = require('./util');
const TEXTES = require('../content/textes');

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function possibleTeamCounts(n) {
  const out = [];
  for (let k = 2; k <= 4; k++) {
    const size = n / k;
    if (size >= 2 && size <= 4.5) out.push(k);
  }
  if (!out.length) out.push(n >= 10 ? 4 : 2);
  return out;
}

function chooseTeamCount(n, previousCount) {
  const options = possibleTeamCounts(n);
  // On privilégie des équipes de 3, mais on varie d'une épreuve à l'autre.
  const weighted = [];
  options.forEach((k) => {
    const size = n / k;
    let w = 1 + (size >= 2.5 && size <= 3.5 ? 2 : 0);
    if (k === previousCount && options.length > 1) w *= 0.5;
    for (let i = 0; i < Math.round(w * 2); i++) weighted.push(k);
  });
  return U.pick(weighted);
}

function splitInto(players, k) {
  const teams = Array.from({ length: k }, () => []);
  U.shuffle(players).forEach((p, i) => teams[i % k].push(p));
  return teams;
}

function cost(teams, pairCounts, lastSignature) {
  let repeat = 0;
  const means = [];
  for (const t of teams) {
    let sum = 0;
    for (let i = 0; i < t.length; i++) {
      sum += t[i].score;
      for (let j = i + 1; j < t.length; j++) {
        const c = pairCounts[pairKey(t[i].id, t[j].id)] || 0;
        repeat += c * c;
      }
    }
    means.push(sum / t.length);
  }
  const avg = means.reduce((a, b) => a + b, 0) / means.length;
  const spread = Math.sqrt(means.reduce((a, m) => a + (m - avg) ** 2, 0) / means.length);
  const balance = spread / (Math.abs(avg) + 150);
  const sig = signature(teams);
  const samePenalty = sig === lastSignature ? 50 : 0;
  return repeat * 4 + balance * 10 + samePenalty;
}

function signature(teams) {
  return teams
    .map((t) => t.map((p) => p.id).sort().join(','))
    .sort()
    .join('/');
}

/**
 * @param {Array<{id:string,score:number}>} players joueurs actifs
 * @param {Object} pairCounts compteur des paires déjà formées (muté)
 * @param {Object} memory { lastCount, lastSignature }
 */
function composeTeams(players, pairCounts, memory = {}) {
  const n = players.length;
  if (n < 4) return null;
  const k = chooseTeamCount(n, memory.lastCount);
  const candidates = [];
  for (let i = 0; i < 600; i++) {
    const teams = splitInto(players, k);
    candidates.push({ teams, cost: cost(teams, pairCounts, memory.lastSignature) });
  }
  candidates.sort((a, b) => a.cost - b.cost);
  // un peu de hasard parmi les meilleures compositions
  const best = U.pick(candidates.slice(0, 4)).teams;

  for (const t of best) {
    for (let i = 0; i < t.length; i++) {
      for (let j = i + 1; j < t.length; j++) {
        const key = pairKey(t[i].id, t[j].id);
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  }
  memory.lastCount = k;
  memory.lastSignature = signature(best);

  const colors = U.sample(TEXTES.couleursEquipes, k);
  const names = U.sample(TEXTES.nomsEquipes, k);
  return best.map((members, i) => ({
    id: `t${i}`,
    color: colors[i].nom,
    hex: colors[i].hex,
    emoji: colors[i].emoji,
    name: names[i],
    members: members.map((p) => p.id),
  }));
}

module.exports = { composeTeams, pairKey };
