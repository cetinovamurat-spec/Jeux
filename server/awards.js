'use strict';
// 🏆 Fin de partie : podium, trophées individuels, statistiques, résumé humoristique.

const U = require('./util');

function avg(arr) {
  return arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function fmtNum(n) {
  if (n === undefined || n === null || !Number.isFinite(n)) return '?';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} milliard${abs >= 2e9 ? 's' : ''}`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} million${abs >= 2e6 ? 's' : ''}`;
  return Math.round(n).toLocaleString('fr-FR');
}

function compute(game) {
  const T = game.content.textes;
  const ranking = game.ranking();
  const P = (id) => game.getPlayer(id);
  const accuracy = (p) => (p.stats.answered ? Math.round((100 * (p.stats.correct || 0)) / p.stats.answered) : null);

  const playerStats = ranking.map((p, i) => ({
    id: p.id,
    rank: game.rankOf(p.id, ranking),
    score: p.score,
    roundWins: p.stats.roundWins || 0,
    podiums: p.stats.roundPodiums || 0,
    accuracy: accuracy(p),
    betrayals: p.stats.betrayals || 0,
    bestStreak: p.stats.bestStreak || 0,
    fooled: p.stats.fooled || 0,
    titles: p.titles,
    pointsByRound: p.pointsByRound,
    rankHistory: p.stats.rankHistory || [],
    scoreHistory: p.stats.scoreHistory || [],
    reaction: avg(p.stats.reactionTimes),
    quote: i === 0 ? U.pick(T.citationsChampion) : null,
  }));

  // ── Trophées ──
  const trophies = [];
  const add = (emoji, title, p, detail) => { if (p) trophies.push({ emoji, title, id: p.id, detail }); };
  const best = (fn, filter = () => true) => {
    let top = null; let topV = -Infinity;
    for (const p of ranking) {
      if (!filter(p)) continue;
      const v = fn(p);
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      if (v > topV) { topV = v; top = p; }
    }
    return top ? { p: top, v: topV } : null;
  };

  const brain = best((p) => accuracy(p), (p) => (p.stats.answered || 0) >= 5);
  if (brain) add('🧠', 'Cerveau du cabinet', brain.p, `${brain.v} % de bonnes réponses`);

  const bluffer = best((p) => p.stats.bluffPoints || 0);
  if (bluffer && bluffer.v > 0) add('🎭', 'Roi du bluff', bluffer.p, `${U.fmt(bluffer.v)} pts gagnés en mentant éhontément`);

  const coffee = best((p) => { const a = avg(p.stats.reactionTimes); return a ? -a : null; }, (p) => (p.stats.reactionTimes || []).length >= 2);
  if (coffee) add('☕', 'Machine à café', coffee.p, `${Math.round(-coffee.v)} ms de temps de réaction moyen`);

  const worstEst = best((p) => Math.max(...(p.stats.estimates || []).map((e) => e.err), -Infinity), (p) => (p.stats.estimates || []).length);
  if (worstEst && worstEst.v > 0.3) {
    const e = worstEst.p.stats.estimates.reduce((a, b) => (b.err > a.err ? b : a));
    add('💀', 'Pire estimation', worstEst.p, `${fmtNum(e.value)} au lieu de ${fmtNum(e.answer)}${e.unit ? ' ' + e.unit : ''} (×${fmtNum(Math.round(10 ** e.err))} d'écart)`);
  }

  const detective = best((p) => p.stats.detections || 0);
  if (detective && detective.v > 0) add('🕵️', 'Détecteur de mensonges', detective.p, `${detective.v} mensonges démasqués`);

  const traitor = best((p) => p.stats.betrayals || 0);
  if (traitor && traitor.v > 0) add('🗡️', 'Le Traître', traitor.p, `${traitor.v} collègues trahis, volés ou bernés`);

  const streak = best((p) => p.stats.bestStreak || 0);
  if (streak && streak.v >= 3) add('🔥', 'En feu', streak.p, `${streak.v} bonnes réponses d'affilée`);

  const climber = best((p) => p.stats.bestClimb || 0);
  if (climber && climber.v >= 2) add('📈', 'Remontada', climber.p, `+${climber.v} places en une seule épreuve`);

  const orator = best((p) => p.stats.wordsGiven || 0);
  if (orator && orator.v > 0) add('🗣️', 'Orateur d\'élite', orator.p, `${orator.v} mots fait deviner`);

  const card = best((p) => (p.stats.redCards || 0) + (p.stats.falseStarts || 0));
  if (card && card.v > 0) add('🟥', 'Collectionneur de cartons', card.p, `${card.v} carton(s) rouge(s) / faux départ(s)`);

  const auction = best((p) => p.stats.auctionWins || 0);
  if (auction && auction.v > 0) add('🔨', 'Commissaire-priseur', auction.p, `${auction.v} enchère(s) remportée(s) avec la bonne réponse`);

  const mvp = best((p) => p.stats.roundWins || 0);
  if (mvp && mvp.v > 0) add('⭐', 'Joueur du match', mvp.p, `${mvp.v} épreuve(s) remportée(s)`);

  const boulet = best((p) => p.stats.boulets || 0);
  if (boulet && boulet.v >= 2) add('🐌', 'Stagiaire d\'honneur', boulet.p, `${boulet.v} fois « boulet de la manche » (avec panache)`);

  // ── Meilleure équipe (une épreuve) & meilleur duo (sur la soirée) ──
  let bestTeam = null;
  for (const r of game.teamRecords) if (!bestTeam || r.avg > bestTeam.avg) bestTeam = r;
  if (bestTeam) bestTeam = { ...bestTeam, avg: Math.round(bestTeam.avg) };

  const duo = {};
  for (const r of game.teamRecords) {
    for (let i = 0; i < r.members.length; i++) {
      for (let j = i + 1; j < r.members.length; j++) {
        const key = [r.members[i], r.members[j]].sort().join('|');
        duo[key] = duo[key] || { sum: 0, n: 0 };
        duo[key].sum += r.avg; duo[key].n++;
      }
    }
  }
  let bestDuo = null;
  for (const [key, d] of Object.entries(duo)) {
    const score = d.sum / d.n + d.n * 5;
    if (!bestDuo || score > bestDuo.score) bestDuo = { ids: key.split('|'), avg: Math.round(d.sum / d.n), n: d.n, score };
  }

  // ── Résumé humoristique ──
  const summary = [];
  const champ = ranking[0];
  if (champ) {
    summary.push(U.fillTemplate(U.pick(T.resume.champion), [champ.name]) + ` (${U.fmt(champ.score)} pts).`);
  }
  if (ranking.length >= 3) {
    const last = ranking[ranking.length - 1];
    summary.push(U.fillTemplate(U.pick(T.resume.dernier), [last.name]));
  }
  if (worstEst && worstEst.v > 0.3) {
    const e = worstEst.p.stats.estimates.reduce((a, b) => (b.err > a.err ? b : a));
    summary.push(`${worstEst.p.name} restera dans les annales pour avoir répondu ${fmtNum(e.value)} à « ${e.q} » (réponse : ${fmtNum(e.answer)}). Le seuil de signification a été pulvérisé.`);
  }
  if (traitor && traitor.v > 0) summary.push(U.fillTemplate(U.pick(T.resume.traitre), [traitor.p.name]) + ` (${traitor.v} trahisons).`);
  if (climber && climber.v >= 2) summary.push(`${climber.p.name} a signé une remontada de +${climber.v} places en une seule épreuve. Le PSG-Barça n'a qu'à bien se tenir.`);
  if (bestDuo && bestDuo.n >= 2) {
    const a = P(bestDuo.ids[0]); const b = P(bestDuo.ids[1]);
    if (a && b) summary.push(`Duo de la soirée : ${a.name} & ${b.name}, ${bestDuo.n} épreuves ensemble. On recommande de les staffer sur la même mission (ou surtout pas).`);
  }
  const titled = ranking.filter((p) => p.titles.length);
  if (titled.length) {
    const p = U.pick(titled);
    summary.push(`Mention spéciale à ${p.name}, élu(e) par ses pairs : « ${U.pick(p.titles)} ».`);
  }
  summary.push(U.pick(T.resume.conclusion));

  return {
    ranking: playerStats,
    trophies,
    bestTeam,
    bestDuo,
    summary,
    rounds: game.history.map((h) => ({ roundId: h.roundId, name: h.name, emoji: h.emoji, best: h.best })),
    year: new Date().getFullYear(),
  };
}

module.exports = { compute };
