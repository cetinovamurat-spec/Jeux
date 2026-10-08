'use strict';
// Petites fonctions utilitaires partagées par le moteur de jeu.

const crypto = require('crypto');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) {
  return shuffle(arr).slice(0, Math.max(0, n));
}

function token(len = 24) {
  return crypto.randomBytes(len).toString('base64url');
}

function id() {
  return crypto.randomBytes(6).toString('hex');
}

// Supprime accents, ponctuation, casse : "Circularisation !" -> "circularisation"
function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Comparaison tolérante pour « Deviner un mot » et les réponses tapées.
function fuzzyMatch(guess, answers) {
  const g = normalize(guess).replace(/\s+/g, '');
  if (!g) return false;
  return answers.some((ans) => {
    const a = normalize(ans).replace(/\s+/g, '');
    if (!a) return false;
    if (g === a) return true;
    // pluriels / s final
    if (g.replace(/s$/, '') === a.replace(/s$/, '')) return true;
    const tolerance = a.length >= 10 ? 2 : a.length >= 6 ? 1 : 0;
    return levenshtein(g, a) <= tolerance;
  });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Formatage « 1 240 »
function fmt(n) {
  return Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ');
}

// Remplace {joueur}, {joueur2}, {joueur3}... par des prénoms de joueurs, {cible} par la cible.
function fillTemplate(text, names, cible) {
  if (!text) return text;
  return String(text)
    .replace(/\{joueur(\d?)\}/g, (_, n) => {
      const idx = n ? Number(n) - 1 : 0;
      return names[idx % Math.max(1, names.length)] || 'quelqu’un';
    })
    .replace(/\{cible\}/g, cible || names[0] || 'quelqu’un');
}

// « 1 500 000 », « 1,5 », « 12 % », « 3.2M » -> nombre
function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v || '').trim().toLowerCase().replace(/\s|\u202f|\u00a0/g, '').replace(/€|%/g, '');
  let mult = 1;
  const suffix = s.match(/(k|m|md|mds|milliards?|millions?|mille)$/);
  if (suffix) {
    const sfx = suffix[1];
    s = s.slice(0, -sfx.length);
    if (sfx === 'k' || sfx === 'mille') mult = 1e3;
    else if (sfx === 'm' || sfx.startsWith('million')) mult = 1e6;
    else mult = 1e9;
  }
  s = s.replace(',', '.');
  if (!/^-?\d*\.?\d+(e\d+)?$/.test(s)) return NaN;
  return Number(s) * mult;
}

module.exports = {
  randInt, pick, shuffle, sample, token, id, normalize, levenshtein,
  fuzzyMatch, clamp, fmt, fillTemplate, parseNumber,
};
