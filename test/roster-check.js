'use strict';
// Vérifie la reconnaissance des pseudos et la justesse des questions « Trombinoscope ».
const assert = require('assert');
const R = require('../server/roster');
const team = require('../content/team');

const M = team.membres;
const who = (pseudo) => { const m = R.matchProfile(M, pseudo); return m ? R.fullName(m) : null; };
const errors = [];
const expect = (pseudo, expected) => { const got = who(pseudo); if (got !== expected) errors.push(`« ${pseudo} » → ${got} (attendu : ${expected})`); };

// Reconnaissance
expect('Murat', 'Murat Cetinova');
expect('murat cetinova', 'Murat Cetinova');
expect('Hélène', 'Hélène Kermorgant');
expect('helene', 'Hélène Kermorgant');
expect('Emma', null); // homonymes : ambigu
expect('Emma B.', 'Emma Biannic');
expect('Emma B', 'Emma Biannic');
expect('Emma M', 'Emma Marchand');
expect('Emma Marchand', 'Emma Marchand');
expect('Djega', 'Djega Leila Vagba');
expect('Leila', 'Djega Leila Vagba');
expect('Djega Leila', 'Djega Leila Vagba');
expect('Lauryn', 'Lauryn-Carla Betjol');
expect('Lauryn-Carla', 'Lauryn-Carla Betjol');
expect('Manuel', 'Manuel Felipe Olivera Hidal');
expect('Felipe', 'Manuel Felipe Olivera Hidal');
expect('Alphonse', 'Alphonse Mouende Mou');
expect('Thomas', null);
expect('', null);
assert.deepStrictEqual(R.homonymes(M), ['Emma']);

// Questions générées : 300 tirages, la bonne réponse doit être juste et les choix uniques
for (let i = 0; i < 300; i++) {
  for (const q of R.trombiQuestions(M, 2)) {
    const ok = q.choix[0];
    if (new Set(q.choix).size !== q.choix.length) errors.push(`Choix en double : ${q.q} ${q.choix}`);
    if (q.choix.length < 4) errors.push(`Moins de 4 choix : ${q.q}`);
    if (q.choix.some((c) => /…/.test(c))) errors.push(`Nom tronqué dans les choix : ${q.q}`);
    const byName = Object.fromEntries(M.map((m) => [R.fullName(m), m]));
    if (/nom de famille de (.+) \?/.test(q.q)) {
      const prenom = q.q.match(/nom de famille de (.+) \?/)[1];
      const m = M.find((x) => x.prenom === prenom);
      if (!m || m.nom !== ok) errors.push(`Mauvaise réponse : ${q.q} → ${ok}`);
    } else if (/fait partie des (.+) \?/.test(q.q)) {
      const g = R.GRADES.find((x) => q.q.includes(x.label.toLowerCase()));
      if (!byName[ok] || byName[ok].grade !== g.key) errors.push(`Mauvaise réponse : ${q.q} → ${ok}`);
      q.choix.slice(1).forEach((c) => { if (byName[c] && byName[c].grade === g.key) errors.push(`Deux bonnes réponses : ${q.q}`); });
    } else if (/intrus/.test(q.q)) {
      const g = R.GRADES.find((x) => q.q.includes(x.label.toLowerCase()));
      if (!byName[ok] || byName[ok].grade === g.key) errors.push(`Mauvais intrus : ${q.q} → ${ok}`);
      q.choix.slice(1).forEach((c) => { if (!byName[c] || byName[c].grade !== g.key) errors.push(`Intrus multiple : ${q.q}`); });
    } else if (/initiales « (.+) »/.test(q.q)) {
      const init = q.q.match(/initiales « (.+) »/)[1];
      if (!byName[ok] || R.initiales(byName[ok]) !== init) errors.push(`Mauvaises initiales : ${q.q} → ${ok}`);
      q.choix.slice(1).forEach((c) => { if (byName[c] && R.initiales(byName[c]) === init) errors.push(`Initiales ambiguës : ${q.q}`); });
    } else if (/catégorie du trombinoscope figure (.+) \?/.test(q.q)) {
      const full = q.q.match(/figure (.+) \?/)[1];
      const g = R.grade(byName[full] && byName[full].grade);
      if (!g || g.label !== ok) errors.push(`Mauvais grade : ${q.q} → ${ok}`);
    } else errors.push(`Type de question inconnu : ${q.q}`);
  }
}

// Cartes collègues
const cards = R.colleagueWords(M);
assert.strictEqual(cards.length, M.length);
cards.forEach((c) => { if (!c.interdits.length || !c.alts.length) errors.push(`Carte incomplète : ${c.mot}`); });

if (errors.length) {
  console.error('❌ Trombinoscope :\n - ' + [...new Set(errors)].slice(0, 30).join('\n - '));
  process.exit(1);
}
console.log(`✅ Trombinoscope : ${M.length} membres, reconnaissance des pseudos et questions générées OK`);
