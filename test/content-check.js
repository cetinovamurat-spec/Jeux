'use strict';
// Vérifie l'intégrité de toute la banque de contenu (format, doublons, quantités minimales).
const C = require('../server/content');
const { normalizeItem } = require('../server/rounds/questions');

const c = C.all();
const errors = [];
const warn = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

function checkQuestions(name, list, opts = {}) {
  const seen = new Set();
  list.forEach((q, i) => {
    const where = `${name}[${i}] « ${String(q.q || q.mot || q.texte).slice(0, 50)} »`;
    check(q.q, `${where} : question manquante`);
    const key = q.q + (q.visuel || '');
    if (seen.has(key)) warn.push(`${where} : doublon`);
    seen.add(key);
    const t = q.type || 'qcm';
    if (t === 'qcm') {
      check(Array.isArray(q.choix) && q.choix.length >= 2, `${where} : choix invalides`);
      check(new Set(q.choix).size === q.choix.length, `${where} : choix en double`);
      check(!q.d || [1, 2, 3, 4].includes(q.d), `${where} : difficulté invalide`);
    }
    if (t === 'vf') check(typeof q.vrai === 'boolean', `${where} : vrai/faux sans booléen`);
    if (t === 'nombre' || t === 'estimation') check(typeof q.reponse === 'number' && q.reponse > 0, `${where} : réponse numérique invalide`);
    if (t === 'ordre') check(Array.isArray(q.ordre) && q.ordre.length >= 3, `${where} : ordre invalide`);
    if (t === 'miroir') check(Array.isArray(q.choix) && q.choix.length >= 2, `${where} : miroir sans choix`);
    if (q.graphique) {
      const g = q.graphique;
      check(['barres', 'courbes'].includes(g.type), `${where} : type de graphique invalide`);
      g.series.forEach((s) => check(s.valeurs.length === g.labels.length, `${where} : série « ${s.nom} » de longueur différente des labels`));
      check(g.series.length <= 3, `${where} : trop de séries`);
    }
    try { normalizeItem(q); } catch (e) { errors.push(`${where} : ${e.message}`); }
  });
}

checkQuestions('quiz', c.quiz);
checkQuestions('estimations', c.estimations.map((e) => ({ ...e, type: 'estimation' })));
checkQuestions('calcul', c.calcul);
checkQuestions('graphiques', c.graphiques);
checkQuestions('football', c.football);
checkQuestions('bluff', c.bluff);
checkQuestions('votes', c.votes);
checkQuestions('miroirs', c.miroirs);
c.mots.forEach((m, i) => check(m.mot && Array.isArray(m.interdits) && m.interdits.length >= 3, `mots[${i}] invalide`));
c.menteur.forEach((m, i) => check(m.texte, `menteur[${i}] invalide`));
c.encheres.forEach((l, i) => {
  check(['question', 'multiplicateur', 'indice', 'vol', 'blocage', 'doubler', 'mystere'].includes(l.type), `encheres[${i}] type invalide`);
  if (l.type === 'question') check(l.question && l.question.choix && l.question.choix.length >= 2, `encheres[${i}] question invalide`);
});
const evIds = new Set();
c.evenements.forEach((e, i) => {
  check(e.id && !evIds.has(e.id), `evenements[${i}] id manquant ou en double`);
  evIds.add(e.id);
  check(e.effet && e.effet.type, `evenements[${i}] effet manquant`);
});

const minimums = {
  'quiz (culture G)': [c.quiz.length, 50],
  estimations: [c.estimations.length, 30],
  'situations de bluff': [c.bluff.length, 30],
  calcul: [c.calcul.length, 30],
  graphiques: [c.graphiques.length, 20],
  mots: [c.mots.length, 50],
  football: [c.football.length, 50],
  'scénarios d’enchères': [c.encheres.length, 20],
  événements: [c.evenements.length, 30],
  'affirmations menteur': [c.menteur.length, 30],
  'votes équipe': [c.votes.length + c.votesFoot.length, 20],
  'miroirs équipe': [c.miroirs.length + c.miroirsFoot.length, 15],
};
console.log('📚 Banque de contenu');
for (const [k, [n, min]] of Object.entries(minimums)) {
  console.log(`  ${n >= min ? '✅' : '❌'} ${k.padEnd(24)} ${String(n).padStart(4)} (min ${min})`);
  check(n >= min, `${k} : ${n} < ${min}`);
}
warn.forEach((w) => console.log('  ⚠️ ', w));
if (errors.length) {
  console.error('\n❌ Erreurs :\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log('\n✅ Contenu valide');
