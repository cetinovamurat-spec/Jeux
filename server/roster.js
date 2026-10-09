'use strict';
// 👥 Le trombinoscope (content/team.js) au service du jeu :
//  • reconnaître un joueur à partir de son pseudo (prénom, prénom + initiale, nom complet, alias) ;
//  • générer des questions « Trombinoscope » (noms, grades, initiales) ;
//  • fabriquer des cartes « Fais deviner un collègue » pour l'épreuve Deviner un mot.

const U = require('./util');

// Ordre hiérarchique (du plus senior au plus junior) et libellés affichés
const GRADES = [
  { key: 'associes', label: 'Associés', court: 'associé' },
  { key: 'managers', label: 'Managers', court: 'manager' },
  { key: 'seniors', label: 'Séniors', court: 'sénior' },
  { key: 'assistants-confirmes', label: 'Assistants confirmés', court: 'assistant confirmé' },
  { key: 'assistants-juniors', label: 'Assistants juniors', court: 'assistant junior' },
  { key: 'alternants', label: 'Alternants', court: 'alternant' },
];
const GRADE_BY_KEY = Object.fromEntries(GRADES.map((g, i) => [g.key, { ...g, rang: i }]));

function grade(key) {
  return GRADE_BY_KEY[key] || null;
}

function fullName(m) {
  return `${m.prenom} ${m.nom || ''}`.trim();
}

// Le nom est-il connu en entier ? (un nom tronqué « … » n'est pas utilisé dans les questions)
function nomFiable(m) {
  return !!m.nom && !m.nom.includes('…') && !m.nomIncomplet;
}

function initiales(m) {
  const part = (s) => String(s || '').split(/[\s-]+/).filter(Boolean)[0] || '';
  return (part(m.prenom)[0] || '') + (part(m.nom)[0] || '');
}

/**
 * Retrouve la fiche d'un membre à partir d'un pseudo.
 * Accepte : « Prénom Nom », « Prénom N », « Prénom N. », « PrénomN », un alias,
 * ou le prénom seul s'il n'y a pas d'homonyme dans l'équipe.
 */
function matchProfile(membres, pseudo) {
  const n = U.normalize(pseudo);
  if (!n || !Array.isArray(membres)) return null;
  const compact = n.replace(/\s+/g, '');
  const candidates = [];
  for (const m of membres) {
    const prenom = U.normalize(m.prenom);
    const nom = U.normalize(m.nom || '').replace(/\s+/g, ' ');
    const init = nom ? nom[0] : '';
    const forms = new Set([
      `${prenom} ${nom}`.trim(),
      `${prenom}${nom}`.replace(/\s+/g, ''),
      init ? `${prenom} ${init}` : null,
      init ? `${prenom}${init}`.replace(/\s+/g, '') : null,
      ...(m.alias || []).map((a) => U.normalize(a)),
    ].filter(Boolean));
    if (forms.has(n) || forms.has(compact)) return m;
    if (prenom === n || prenom.replace(/\s+/g, '') === compact) candidates.push(m);
    // prénoms composés : « Djega » ou « Leila » pour « Djega Leila »
    else if (prenom.split(' ').length > 1 && prenom.split(' ').includes(n)) candidates.push(m);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

// Prénoms portés par plusieurs membres (ex. deux « Emma ») -> il faut une initiale
function homonymes(membres) {
  const count = {};
  for (const m of membres || []) {
    const k = U.normalize(m.prenom);
    count[k] = (count[k] || 0) + 1;
  }
  return (membres || []).filter((m) => count[U.normalize(m.prenom)] > 1).map((m) => m.prenom).filter((v, i, a) => a.indexOf(v) === i);
}

// ───────────── Questions « Trombinoscope » ─────────────
function trombiQuestions(membres, n = 1) {
  const team = (membres || []).filter((m) => grade(m.grade));
  if (team.length < 6) return [];
  const out = [];
  const gens = U.shuffle([genNom, genGrade, genInitiales, genIntrus, genGradeDe]);
  let i = 0;
  while (out.length < n && i < gens.length * 3) {
    const q = gens[i % gens.length](team);
    if (q && !out.some((x) => x.q === q.q)) out.push(q);
    i++;
  }
  return out;
}

function genNom(team) {
  const prenoms = {};
  team.forEach((m) => { prenoms[U.normalize(m.prenom)] = (prenoms[U.normalize(m.prenom)] || 0) + 1; });
  const pool = team.filter((m) => nomFiable(m) && prenoms[U.normalize(m.prenom)] === 1);
  if (pool.length < 4) return null;
  const m = U.pick(pool);
  const wrong = U.sample(pool.filter((x) => x !== m && U.normalize(x.nom) !== U.normalize(m.nom)).map((x) => x.nom), 3);
  if (wrong.length < 3) return null;
  return { q: `Trombinoscope : quel est le nom de famille de ${m.prenom} ?`, choix: [m.nom, ...wrong], d: 2, cat: 'Trombinoscope', info: `${fullName(m)} — ${grade(m.grade).court}.` };
}

function genGrade(team) {
  const g = U.pick(GRADES.filter((x) => team.some((m) => m.grade === x.key) && team.some((m) => m.grade !== x.key)));
  if (!g) return null;
  const inside = team.filter((m) => m.grade === g.key);
  const outside = team.filter((m) => m.grade !== g.key);
  if (!inside.length || outside.length < 3) return null;
  const m = U.pick(inside);
  return {
    q: `Trombinoscope : lequel de ces collègues fait partie des ${g.label.toLowerCase()} ?`,
    choix: [fullName(m), ...U.sample(outside, 3).map(fullName)],
    d: 1, cat: 'Trombinoscope',
    info: `${g.label} : ${inside.map((x) => x.prenom).join(', ')}.`,
  };
}

function genIntrus(team) {
  const g = U.pick(GRADES.filter((x) => team.filter((m) => m.grade === x.key).length >= 3));
  if (!g) return null;
  const inside = U.sample(team.filter((m) => m.grade === g.key), 3);
  const intrus = U.pick(team.filter((m) => m.grade !== g.key));
  if (!intrus) return null;
  return {
    q: `Trombinoscope : un intrus s’est glissé parmi les ${g.label.toLowerCase()}. Lequel ?`,
    choix: [fullName(intrus), ...inside.map(fullName)],
    d: 2, cat: 'Trombinoscope',
    info: `${fullName(intrus)} fait partie des ${grade(intrus.grade).label.toLowerCase()}.`,
  };
}

function genGradeDe(team) {
  const m = U.pick(team);
  const g = grade(m.grade);
  const autres = U.sample(GRADES.filter((x) => x.key !== m.grade), 3).map((x) => x.label);
  return { q: `Trombinoscope : dans quelle catégorie du trombinoscope figure ${fullName(m)} ?`, choix: [g.label, ...autres], d: 1, cat: 'Trombinoscope' };
}

function genInitiales(team) {
  const byInit = {};
  team.filter(nomFiable).forEach((m) => { const k = initiales(m); (byInit[k] = byInit[k] || []).push(m); });
  const uniques = Object.entries(byInit).filter(([, l]) => l.length === 1).map(([k, l]) => ({ k, m: l[0] }));
  if (uniques.length < 4) return null;
  const { k, m } = U.pick(uniques);
  const wrong = U.sample(team.filter((x) => x !== m && initiales(x) !== k), 3).map(fullName);
  return { q: `Trombinoscope : à qui appartiennent les initiales « ${k} » ?`, choix: [fullName(m), ...wrong], d: 2, cat: 'Trombinoscope' };
}

// ───────────── Cartes « Fais deviner un collègue » ─────────────
function colleagueWords(membres) {
  return (membres || []).filter((m) => grade(m.grade)).map((m) => {
    const g = grade(m.grade);
    const forbidden = [m.prenom, nomFiable(m) ? m.nom : null, g.court, initiales(m)].filter(Boolean);
    const alts = [m.prenom, nomFiable(m) ? m.nom : null, ...(m.alias || [])].filter(Boolean);
    return { mot: nomFiable(m) ? fullName(m) : m.prenom, interdits: forbidden, cat: 'Collègue (reste bienveillant 😇)', alts, collegue: true };
  });
}

module.exports = { GRADES, grade, matchProfile, homonymes, trombiQuestions, colleagueWords, fullName, initiales };
