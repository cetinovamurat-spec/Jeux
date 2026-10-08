'use strict';
// ⚡ ÉPREUVE 4 — Réaction rapide : enchaînement de mini-jeux très courts (style Mario Party).
// Les temps de réaction sont mesurés côté joueur (indépendant de la latence réseau).

const BaseRound = require('./base');
const U = require('../util');

const PAIRS = [
  ['🟢', '🔴'], ['📁', '📂'], ['😀', '😃'], ['☕', '🍵'], ['⚽', '🏐'], ['📈', '📉'],
  ['🧾', '📄'], ['🐱', '🐈'], ['🔒', '🔓'], ['🕐', '🕑'], ['🌕', '🌖'], ['👍', '👎'],
  ['🟦', '🟪'], ['📊', '📋'], ['💶', '💷'], ['🏆', '🥇'], ['🍺', '🍻'], ['✏️', '🖊️'],
];
const MEMORY_SYMBOLS = ['📎', '🧾', '☕', '📊', '⚽', '🖇️'];
const TYPE_WORDS = [
  'AMORTISSEMENT', 'CIRCULARISATION', 'IMMOBILISATIONS', 'RAPPROCHEMENT', 'COMMISSARIAT',
  'PROVISIONNEMENT', 'CUT-OFF', 'LETTRAGE', 'SIGNIFICATION', 'JUSTIFICATIF', 'EXHAUSTIVITE',
  'BALANCE AGEE', 'LIASSE FISCALE', 'GOODWILL', 'TRESORERIE', 'DEPRECIATION', 'INVENTAIRE',
  'PENALTY', 'HORS-JEU', 'TIKI-TAKA', 'CROISSANT', 'CORDIALEMENT', 'RECHERCHEV', 'MACHINE A CAFE',
];
const COLORS = [
  { name: 'ROUGE', hex: '#e34948' }, { name: 'BLEU', hex: '#2a78d6' }, { name: 'VERT', hex: '#0ca30c' },
  { name: 'JAUNE', hex: '#eda100' }, { name: 'VIOLET', hex: '#7a5af0' }, { name: 'ORANGE', hex: '#eb6834' },
];
const TYPES = ['signal', 'intrus', 'memory', 'type', 'stroop', 'ecart', 'doublon', 'count', 'flash'];

function fmtEur(n) {
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
}

function generate(type, level) {
  switch (type) {
    case 'signal':
      return { type, title: 'Réflexe pur', instruction: 'Attends le VERT… puis clique le plus vite possible !', delay: U.randInt(1800, 5200), time: 10 };
    case 'intrus': {
      const [a, b] = U.pick(PAIRS);
      const n = level > 1 ? 48 : 30;
      const odd = U.randInt(0, n - 1);
      const grid = Array.from({ length: n }, (_, i) => (i === odd ? b : a));
      return { type, title: 'Trouve l\'intrus', instruction: 'Clique sur l\'élément différent', grid, cols: level > 1 ? 8 : 6, answer: odd, time: 12 };
    }
    case 'memory': {
      const len = 4 + level;
      const sequence = Array.from({ length: len }, () => U.randInt(0, MEMORY_SYMBOLS.length - 1));
      return { type, title: 'Mémoire d\'auditeur', instruction: 'Mémorise la séquence, puis reproduis-la', symbols: MEMORY_SYMBOLS, sequence, showMs: 2600 + len * 350, answer: sequence, time: 20 };
    }
    case 'type': {
      const word = U.pick(TYPE_WORDS);
      return { type, title: 'Saisie express', instruction: 'Tape ce mot le plus vite possible', word, answer: word, time: 15 };
    }
    case 'stroop': {
      const word = U.pick(COLORS);
      let ink = U.pick(COLORS);
      while (ink.name === word.name) ink = U.pick(COLORS);
      const options = U.shuffle([ink, word, ...U.sample(COLORS.filter((c) => c !== ink && c !== word), 2)]).map((c) => c.name);
      return { type, title: 'Couleur piège', instruction: 'Clique sur la COULEUR de l\'encre (pas le mot !)', word: word.name, ink: ink.hex, options, answer: ink.name, time: 8 };
    }
    case 'ecart': {
      const amount = U.randInt(1000, 99999) + U.randInt(0, 99) / 100;
      const s = fmtEur(amount);
      // on permute deux chiffres -> l'erreur de saisie classique
      const digits = s.split('');
      const idxs = digits.map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
      let wrong = s;
      for (let tries = 0; tries < 20 && wrong === s; tries++) {
        const k = U.randInt(0, idxs.length - 2);
        const d2 = digits.slice();
        [d2[idxs[k]], d2[idxs[k + 1]]] = [d2[idxs[k + 1]], d2[idxs[k]]];
        wrong = d2.join('');
      }
      const n = 16;
      const odd = U.randInt(0, n - 1);
      const grid = Array.from({ length: n }, (_, i) => (i === odd ? wrong : s));
      return { type, title: 'L\'écart de saisie', instruction: 'Un montant a été mal saisi. Trouve-le !', grid, cols: 4, text: true, answer: odd, time: 15 };
    }
    case 'doublon': {
      const year = 2026;
      const set = new Set();
      while (set.size < 11) set.add(`FA-${year}-${String(U.randInt(100, 999)).padStart(4, '0')}`);
      const list = [...set];
      const dup = U.pick(list);
      const grid = U.shuffle([...list, dup]);
      const answer = grid.map((x, i) => (x === dup ? i : -1)).filter((i) => i >= 0);
      return { type, title: 'Facture en double', instruction: 'Une facture a été comptabilisée deux fois. Clique dessus !', grid, cols: 3, text: true, answer, time: 15 };
    }
    case 'count': {
      const [a, b] = U.pick([['☕', '🍵'], ['⚽', '🏀'], ['📁', '📂'], ['🧾', '📄'], ['🍪', '🥐']]);
      const n = 35;
      const count = U.randInt(6, 14);
      const grid = U.shuffle(Array.from({ length: n }, (_, i) => (i < count ? a : b)));
      const opts = U.shuffle([count, count + 1, count - 1, count + U.pick([2, -2, 3])]);
      return { type, title: 'Inventaire physique', instruction: `Combien de ${a} dans le stock ?`, grid, cols: 7, options: opts.map(String), answer: String(count), time: 12 };
    }
    case 'flash': {
      const ops = [
        () => { const x = U.randInt(12, 49); const y = U.randInt(3, 9); return [`${x} × ${y}`, x * y]; },
        () => { const x = U.randInt(120, 990); const y = U.randInt(110, 890); return [`${x} + ${y}`, x + y]; },
        () => { const x = U.pick([200, 400, 800, 1500, 2500, 12000]); const pct = U.pick([5, 10, 15, 20, 25]); return [`${pct} % de ${x.toLocaleString('fr-FR')}`, (x * pct) / 100]; },
        () => { const ht = U.pick([100, 250, 500, 1200, 50]); return [`${ht} € HT → TTC (TVA 20 %)`, ht * 1.2]; },
        () => { const x = U.randInt(500, 999); const y = U.randInt(101, 499); return [`${x} − ${y}`, x - y]; },
      ];
      const [label, ans] = U.pick(ops)();
      const wrongs = new Set();
      while (wrongs.size < 3) {
        const w = ans + U.pick([-10, -2, -1, 1, 2, 10, 20, -20, 9, -9]);
        if (w !== ans) wrongs.add(w);
      }
      const options = U.shuffle([ans, ...wrongs]).map((v) => String(Math.round(v * 100) / 100).replace('.', ','));
      return { type, title: 'Calcul flash', instruction: label + ' = ?', options, answer: String(Math.round(ans * 100) / 100).replace('.', ','), time: 10 };
    }
    default:
      return generate('signal', level);
  }
}

class ReactionRound extends BaseRound {
  start() {
    const n = this.count(7, 4);
    const types = U.shuffle(TYPES);
    // Toujours un réflexe pur en ouverture
    const seq = ['signal', ...types.filter((t) => t !== 'signal')].slice(0, n);
    while (seq.length < n) seq.push(U.pick(TYPES));
    this.games = seq.map((t, i) => generate(t, i >= n / 2 ? 2 : 1));
    this.idx = -1;
    this.nextGame();
  }

  nextGame() {
    this.idx++;
    if (this.idx >= this.games.length) { this.done = true; return; }
    this.cur = this.games[this.idx];
    this.answers = {};
    this.results = null;
    this.stage = 'ready';
    this.game.setTimer(3);
  }

  next() {
    if (this.stage === 'ready') return this.go();
    if (this.stage === 'go') return this.reveal();
    return this.nextGame();
  }

  onTimeout() {
    if (this.stage === 'ready') this.go();
    else if (this.stage === 'go') this.reveal();
    else this.nextGame(); // les résultats défilent tout seuls : rythme party game
  }

  go() {
    this.stage = 'go';
    this.goAt = Date.now();
    this.game.setTimer(this.cur.time + (this.cur.type === 'signal' ? this.cur.delay / 1000 : 0) + (this.cur.showMs ? this.cur.showMs / 1000 : 0));
  }

  action(player, msg) {
    if (msg.type !== 'react' || this.stage !== 'go' || this.answers[player.id]) return false;
    const serverElapsed = Date.now() - this.goAt;
    let ms = Number(msg.ms);
    if (!Number.isFinite(ms) || ms < 0) ms = serverElapsed;
    ms = Math.min(ms, serverElapsed + 300);
    const c = this.cur;
    let ok = false;
    let early = false;
    if (c.type === 'signal') {
      early = !!msg.early || ms < 90;
      ok = !early;
    } else if (c.type === 'memory') {
      ok = Array.isArray(msg.value) && msg.value.length === c.answer.length && msg.value.every((v, i) => Number(v) === c.answer[i]);
    } else if (c.type === 'type') {
      ok = U.normalize(msg.value) === U.normalize(c.answer);
    } else if (c.type === 'doublon') {
      ok = c.answer.includes(Number(msg.value));
    } else if (c.type === 'intrus' || c.type === 'ecart') {
      ok = Number(msg.value) === c.answer;
    } else {
      ok = String(msg.value) === String(c.answer);
    }
    this.answers[player.id] = { ok, ms: Math.round(ms), early, value: msg.value };
    if (this.allAnswered(this.answers)) this.reveal();
    return true;
  }

  onPlayerLeave() {
    if (this.stage === 'go' && this.allAnswered(this.answers)) this.reveal();
  }

  reveal() {
    if (this.stage !== 'go') return;
    this.stage = 'reveal';
    const g = this.game;
    const correct = Object.entries(this.answers).filter(([, a]) => a.ok).sort((a, b) => a[1].ms - b[1].ms);
    const table = [80, 60, 45, 35];
    const results = {};
    correct.forEach(([pid, a], i) => {
      const p = g.getPlayer(pid);
      if (!p) return;
      const pts = g.award(p, table[i] ?? 25, { reason: 'Réflexes' });
      p.stats.reactionTimes = p.stats.reactionTimes || [];
      p.stats.reactionTimes.push(a.ms);
      results[pid] = { points: pts, ms: a.ms, rank: i + 1, ok: true };
    });
    for (const [pid, a] of Object.entries(this.answers)) {
      if (a.ok) continue;
      const p = g.getPlayer(pid);
      if (!p) continue;
      if (a.early) {
        const pts = g.award(p, -15, { reason: 'Faux départ' });
        p.stats.falseStarts = (p.stats.falseStarts || 0) + 1;
        results[pid] = { points: pts, early: true, ok: false };
      } else {
        results[pid] = { points: 0, ok: false, ms: a.ms };
      }
    }
    this.results = results;
    this.game.setTimer(5);
  }

  view(player) {
    const c = this.cur;
    if (!c) return { kind: 'reaction', stage: 'intro' };
    const pub = {
      kind: 'reaction',
      stage: this.stage,
      index: this.idx,
      total: this.games.length,
      game: { ...c, answer: undefined },
      answered: Object.keys(this.answers),
      results: this.results,
      solution: this.stage === 'reveal' ? c.answer : undefined,
    };
    if (player) pub.me = { answer: this.answers[player.id] || null, result: this.results ? this.results[player.id] : null };
    return pub;
  }
}

module.exports = ReactionRound;
