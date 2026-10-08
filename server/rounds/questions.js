'use strict';
// Moteur générique des épreuves « à questions » :
// QCM, Vrai/Faux, nombre exact, estimation, vote « Qui est le plus susceptible… »,
// « Miroir » (deviner ce qu'un collègue a répondu sur lui-même) et classement à ordonner.

const BaseRound = require('./base');
const U = require('../util');

const DEFAULT_TIME = { mcq: 20, number: 35, estimate: 30, vote: 20, predict: 25, order: 35 };
const DIFF_BASE = { 1: 50, 2: 70, 3: 90, 4: 120 };
const DIFF_LABEL = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile', 4: 'Extrême' };

// Transforme une entrée de contenu (format éditable en français) en question jouable.
function normalizeItem(raw) {
  const t = raw.type || 'qcm';
  const base = {
    q: raw.q,
    difficulty: raw.d || 2,
    cat: raw.cat || '',
    explain: raw.info || '',
    visual: raw.visuel || null,
    chart: raw.graphique || null,
    unit: raw.unite || '',
    time: raw.temps || null,
    raw,
  };
  switch (t) {
    case 'vf':
      return { ...base, type: 'mcq', options: ['Vrai', 'Faux'], answer: raw.vrai ? 0 : 1, keepOrder: true };
    case 'nombre':
      return { ...base, type: 'number', answer: raw.reponse, tol: raw.tol ?? 0 };
    case 'estimation':
      return { ...base, type: 'estimate', answer: raw.reponse };
    case 'ordre':
      return { ...base, type: 'order', items: raw.ordre.slice(), labels: raw.libelles || null };
    case 'vote':
      return { ...base, type: 'vote', title: raw.titre || raw.q };
    case 'miroir':
      return { ...base, type: 'predict', options: raw.choix.slice(), keepOrder: true };
    default: {
      const options = raw.choix.slice();
      const answer = raw.bonne !== undefined ? raw.bonne : 0;
      return { ...base, type: 'mcq', options, answer, keepOrder: !!raw.ordreFixe };
    }
  }
}

class QuestionRound extends BaseRound {
  constructor(game, meta) {
    super(game, meta);
    this.idx = -1;
    this.items = [];
    this.stage = 'intro';
    this.answers = {};
    this.disabled = {};
    this.reveal = null;
    this.objectiveCount = 0;
    this.perfect = {}; // pid -> nombre de bonnes réponses objectives
    this.estimateScale = 1;
    this.targetsUsed = new Set();
  }

  // À surcharger : renvoie une liste d'entrées de contenu brutes.
  buildItems() { return []; }

  start() {
    this.items = this.buildItems().map((raw) => (raw.type ? normalizeItem(raw) : normalizeItem(raw)));
    this.nextItem();
  }

  nextItem() {
    this.idx++;
    this.reveal = null;
    if (this.idx >= this.items.length) {
      this.finish();
      return;
    }
    let item = this.items[this.idx];
    item = this.prepare(item);
    if (!item) { // question impossible (pas assez de joueurs, etc.)
      this.nextItem();
      return;
    }
    this.items[this.idx] = item;
    this.item = item;
    this.answers = {};
    this.disabled = {};
    this.stage = 'ask';
    this.askStart = Date.now();
    // Pièces manquantes : une réponse indisponible pour certains joueurs
    if ((item.type === 'mcq' || item.type === 'predict') && item.options.length >= 3) {
      for (const p of this.players) {
        if (p.mods.blind) this.disabled[p.id] = U.randInt(0, item.options.length - 1);
      }
    }
    const time = item.time || (DEFAULT_TIME[item.type] + (item.difficulty >= 4 ? 5 : 0) + (item.chart ? 15 : 0));
    item.timeLimit = time;
    this.game.setTimer(time);
  }

  prepare(item) {
    const names = U.shuffle(this.players.map((p) => p.name));
    const it = { ...item };
    if (it.type === 'predict') {
      const pool = this.connected.filter((p) => !this.targetsUsed.has(p.id));
      const candidates = pool.length ? pool : this.connected;
      if (candidates.length < 2 && this.connected.length < 2) return null;
      const target = U.pick(candidates);
      this.targetsUsed.add(target.id);
      it.target = target.id;
      it.q = U.fillTemplate(it.q, names.filter((n) => n !== target.name), target.name);
    } else {
      it.q = U.fillTemplate(it.q, names);
      if (it.explain) it.explain = U.fillTemplate(it.explain, names);
    }
    if (it.type === 'vote') {
      if (this.players.length < 3) return null;
      it.options = this.players.map((p) => p.id);
    }
    if (it.type === 'mcq' && !it.keepOrder) {
      const order = U.shuffle(it.options.map((_, i) => i));
      it.options = order.map((i) => U.fillTemplate(item.options[i], names));
      it.answer = order.indexOf(item.answer);
    } else if (it.options && it.type !== 'vote') {
      it.options = it.options.map((o) => U.fillTemplate(o, names));
    }
    if (it.type === 'order') {
      it.display = U.shuffle(it.items.map((_, i) => i));
      // éviter de présenter la bonne réponse directement
      if (it.display.every((v, i) => v === i)) it.display.reverse();
    }
    return it;
  }

  eligibleAnswerers() {
    return this.connected;
  }

  action(player, msg) {
    if (msg.type !== 'answer' || this.stage !== 'ask') return false;
    if (this.answers[player.id] !== undefined) return false;
    const it = this.item;
    const value = this.validate(it, player, msg.value);
    if (value === undefined) return false;
    this.answers[player.id] = { value, t: Date.now() - this.askStart, risk: !!msg.risk };
    if (this.allAnswered(this.answers, this.eligibleAnswerers())) this.doReveal();
    return true;
  }

  validate(it, player, v) {
    switch (it.type) {
      case 'mcq':
      case 'predict': {
        const i = Number(v);
        if (!Number.isInteger(i) || i < 0 || i >= it.options.length) return undefined;
        if (this.disabled[player.id] === i) return undefined;
        return i;
      }
      case 'vote':
        return it.options.includes(v) ? v : undefined;
      case 'number':
      case 'estimate': {
        const n = U.parseNumber(v);
        if (!Number.isFinite(n)) return undefined;
        if (it.type === 'estimate' && n < 0) return undefined;
        return n;
      }
      case 'order': {
        if (!Array.isArray(v) || v.length !== it.items.length) return undefined;
        const set = new Set(v.map(Number));
        if (set.size !== it.items.length || [...set].some((x) => !(x >= 0 && x < it.items.length))) return undefined;
        return v.map(Number);
      }
      default:
        return undefined;
    }
  }

  onPlayerLeave() {
    if (this.stage === 'ask' && this.allAnswered(this.answers, this.eligibleAnswerers())) this.doReveal();
  }

  onTimeout() {
    if (this.stage === 'ask') this.doReveal();
    else if (this.stage === 'reveal' && this.game.settings.autoNext) this.nextItem();
  }

  next() {
    if (this.stage === 'ask') this.doReveal();
    else this.nextItem();
  }

  speedBonus(t) {
    const total = (this.item.timeLimit || 20) * 1000;
    return Math.round(30 * U.clamp(1 - t / total, 0, 1));
  }

  // Bonne réponse objective -> gestion des séries 🔥
  streak(p, ok) {
    if (ok) {
      p.streak = (p.streak || 0) + 1;
      p.stats.bestStreak = Math.max(p.stats.bestStreak || 0, p.streak);
      if (p.streak >= 3) return Math.min(40, 10 * (p.streak - 2));
      return 0;
    }
    p.streak = 0;
    return 0;
  }

  doReveal() {
    if (this.stage !== 'ask') return;
    this.stage = 'reveal';
    this.game.clearTimer();
    const it = this.item;
    const results = {};
    const g = this.game;
    const players = this.players;
    const scoreObjective = (p, ok, base, t) => {
      p.stats.answered = (p.stats.answered || 0) + 1;
      if (ok) p.stats.correct = (p.stats.correct || 0) + 1;
      const s = this.streak(p, ok);
      if (!ok) return { points: 0, correct: false };
      this.perfect[p.id] = (this.perfect[p.id] || 0) + 1;
      const speed = this.speedBonus(t);
      const pts = g.award(p, base + s, { speed, reason: this.meta.short });
      return { points: pts, correct: true, streak: p.streak, streakBonus: s };
    };

    if (it.type === 'mcq' || it.type === 'number' || it.type === 'order') this.objectiveCount++;

    if (it.type === 'mcq') {
      const base = DIFF_BASE[it.difficulty] || 70;
      for (const p of players) {
        const a = this.answers[p.id];
        if (!a) { if (p.connected) this.streak(p, false); results[p.id] = { points: 0, correct: false, missing: true }; continue; }
        results[p.id] = { ...scoreObjective(p, a.value === it.answer, base, a.t), value: a.value };
      }
      this.reveal = { answer: it.answer, distribution: this.distribution(it.options.length) };
    } else if (it.type === 'number') {
      const base = DIFF_BASE[it.difficulty] || 70;
      for (const p of players) {
        const a = this.answers[p.id];
        if (!a) { if (p.connected) this.streak(p, false); results[p.id] = { points: 0, correct: false, missing: true }; continue; }
        const ok = Math.abs(a.value - it.answer) <= (it.tol || 0) + 1e-9;
        results[p.id] = { ...scoreObjective(p, ok, base, a.t), value: a.value };
      }
      this.reveal = {
        answer: it.answer,
        list: players.filter((p) => this.answers[p.id]).map((p) => ({ id: p.id, value: this.answers[p.id].value, ok: results[p.id].correct }))
          .sort((a, b) => Math.abs(a.value - it.answer) - Math.abs(b.value - it.answer)),
      };
    } else if (it.type === 'order') {
      const n = it.items.length;
      for (const p of players) {
        const a = this.answers[p.id];
        if (!a) { if (p.connected) this.streak(p, false); results[p.id] = { points: 0, correct: false, missing: true }; continue; }
        let good = 0;
        a.value.forEach((v, pos) => { if (v === pos) good++; });
        const perfect = good === n;
        p.stats.answered = (p.stats.answered || 0) + 1;
        if (perfect) p.stats.correct = (p.stats.correct || 0) + 1;
        const s = this.streak(p, perfect);
        if (perfect) this.perfect[p.id] = (this.perfect[p.id] || 0) + 1;
        const base = good * 15 + (perfect ? 50 : 0) + s;
        const pts = base ? g.award(p, base, { speed: perfect ? this.speedBonus(a.t) : 0, reason: this.meta.short }) : 0;
        results[p.id] = { points: pts, correct: perfect, partial: good, value: a.value };
      }
      this.reveal = { answer: it.items.map((_, i) => i) };
    } else if (it.type === 'estimate') {
      this.revealEstimate(results);
    } else if (it.type === 'vote') {
      const counts = {};
      for (const p of players) {
        const a = this.answers[p.id];
        if (a) counts[a.value] = (counts[a.value] || 0) + 1;
      }
      const max = Math.max(0, ...Object.values(counts));
      const elected = Object.keys(counts).filter((k) => counts[k] === max && max > 0);
      for (const p of players) {
        const a = this.answers[p.id];
        if (!a) { results[p.id] = { points: 0, missing: true }; continue; }
        const ok = elected.includes(a.value);
        const pts = ok ? g.award(p, 40, { reason: 'Consensus' }) : 0;
        results[p.id] = { points: pts, correct: ok, value: a.value };
      }
      for (const pid of elected) {
        const ep = g.getPlayer(pid);
        if (ep) ep.titles.push(it.title);
      }
      this.reveal = { counts, elected, voters: this.voters() };
    } else if (it.type === 'predict') {
      const ta = this.answers[it.target];
      const target = g.getPlayer(it.target);
      if (!ta) {
        this.reveal = { cancelled: true, distribution: this.distribution(it.options.length) };
        for (const p of players) results[p.id] = { points: 0 };
      } else {
        let good = 0;
        for (const p of players) {
          if (p.id === it.target) continue;
          const a = this.answers[p.id];
          if (!a) { results[p.id] = { points: 0, missing: true }; continue; }
          const ok = a.value === ta.value;
          if (ok) good++;
          const pts = ok ? g.award(p, 60, { speed: this.speedBonus(a.t), reason: 'Miroir' }) : 0;
          results[p.id] = { points: pts, correct: ok, value: a.value };
        }
        const tp = good ? g.award(target, Math.min(60, good * 12), { reason: 'Lisible comme un bilan' }) : 0;
        results[it.target] = { points: tp, isTarget: true, value: ta.value };
        this.reveal = { answer: ta.value, distribution: this.distribution(it.options.length, it.target) };
      }
    }
    this.reveal.results = results;
    this.reveal.explain = it.explain;
    if (g.settings.autoNext) g.setTimer(9);
  }

  revealEstimate(results) {
    const it = this.item;
    const g = this.game;
    const entries = this.players
      .filter((p) => this.answers[p.id])
      .map((p) => {
        const v = this.answers[p.id].value;
        const err = Math.abs(Math.log10(Math.max(v, 1e-9) / it.answer));
        return { p, value: v, err, risk: this.answers[p.id].risk };
      })
      .sort((a, b) => a.err - b.err);
    const n = entries.length;
    const scale = this.estimateScale;
    let rank = 0;
    entries.forEach((e, i) => {
      if (i > 0 && e.err > entries[i - 1].err + 1e-12) rank = i;
      e.rank = rank;
    });
    const list = [];
    entries.forEach((e) => {
      const p = e.p;
      let base = n === 1 ? 90 : Math.round(30 + 90 * (n - 1 - e.rank) / (n - 1));
      const tags = [];
      if (e.err < Math.log10(1.1)) { base += 40; tags.push('🎯 Dans le mille'); }
      else if (e.err < Math.log10(1.3)) { base += 15; tags.push('👌 Très proche'); }
      const worst = n >= 3 && e.rank === entries[n - 1].rank && e.rank > 0;
      if (worst) { base = -30; tags.push('💀 Pire estimation'); }
      if (e.risk) {
        const top = e.rank < Math.ceil(n / 3);
        if (top) { base = base * 2; tags.push('🎲 Pari ×2 gagné'); }
        else { base = Math.min(base, 0) - 50; tags.push('🎲 Pari perdu'); }
      }
      base = Math.round(base * scale);
      const pts = g.award(p, base, { reason: 'Estimation' });
      p.stats.estimates = p.stats.estimates || [];
      p.stats.estimates.push({ q: it.q, value: e.value, answer: it.answer, unit: it.unit, err: e.err });
      results[p.id] = { points: pts, value: e.value, err: e.err, rank: e.rank + 1, tags, risk: e.risk };
      list.push({ id: p.id, value: e.value, err: e.err, rank: e.rank + 1, points: pts, tags, ratio: e.value / it.answer });
    });
    for (const p of this.players) if (!results[p.id]) results[p.id] = { points: 0, missing: true };
    this.reveal = { answer: it.answer, list };
  }

  distribution(nOptions, exclude) {
    const d = Array.from({ length: nOptions }, () => []);
    for (const p of this.players) {
      if (p.id === exclude) continue;
      const a = this.answers[p.id];
      if (a && Number.isInteger(a.value) && d[a.value]) d[a.value].push(p.id);
    }
    return d;
  }

  voters() {
    const out = {};
    for (const p of this.players) if (this.answers[p.id]) out[p.id] = this.answers[p.id].value;
    return out;
  }

  finish() {
    // 💯 Sans faute : toutes les questions objectives justes
    if (this.objectiveCount >= 4) {
      for (const p of this.players) {
        if ((this.perfect[p.id] || 0) >= this.objectiveCount) {
          this.game.award(p, 80, { reason: '💯 Sans faute' });
          p.stats.perfects = (p.stats.perfects || 0) + 1;
          this.game.notify(`💯 SANS FAUTE pour ${p.name} ! Une feuille de travail sans le moindre point de revue.`);
        }
      }
    }
    this.done = true;
  }

  view(player) {
    const it = this.item;
    if (!it) return { kind: 'questions', stage: 'intro' };
    const pub = {
      kind: 'questions',
      stage: this.stage,
      index: this.idx,
      total: this.items.length,
      item: {
        type: it.type,
        q: it.q,
        options: it.type === 'vote' ? it.options : it.options,
        items: it.type === 'order' ? it.display.map((i) => ({ id: i, label: it.items[i] })) : undefined,
        difficulty: it.difficulty,
        difficultyLabel: DIFF_LABEL[it.difficulty],
        cat: it.cat,
        unit: it.unit,
        visual: it.visual,
        chart: it.chart ? { ...it.chart, anomalie: undefined, highlight: this.stage === 'reveal' ? (it.chart.anomalie || []) : undefined } : null,
        target: it.target,
        title: it.type === 'vote' ? it.title : undefined,
        allowRisk: it.type === 'estimate' && !it.noRisk,
        timeLimit: it.timeLimit,
      },
      answered: Object.keys(this.answers),
      reveal: this.stage === 'reveal' ? this.reveal : null,
    };
    if (it.type === 'order' && this.stage === 'reveal') {
      pub.reveal = { ...this.reveal, ordered: it.items };
    }
    if (player) {
      const a = this.answers[player.id];
      pub.me = {
        answered: !!a,
        value: a ? a.value : undefined,
        risk: a ? a.risk : false,
        disabled: this.disabled[player.id],
        isTarget: it.target === player.id,
        result: this.stage === 'reveal' && this.reveal ? this.reveal.results[player.id] : null,
      };
    }
    return pub;
  }
}

QuestionRound.normalizeItem = normalizeItem;
module.exports = QuestionRound;
