'use strict';
// 🎭 ÉPREUVE 8 — Bluff
// Une question improbable, et chacun reçoit secrètement une carte (info ou pouvoir).
// Discussion libre à l'oral : alliances, mensonges, trahisons… puis vote et résolution des pouvoirs.

const BaseRound = require('./base');
const C = require('../content');
const U = require('../util');

const CARDS = {
  initie: { emoji: '🔑', name: 'Initié', desc: 'Tu connais la VRAIE réponse. Partage-la… ou pas.' },
  eliminateur: { emoji: '🃏', name: 'Éliminateur', desc: 'Tu sais qu\'une des réponses est FAUSSE.' },
  imposteur: { emoji: '🎭', name: 'Imposteur', desc: 'Tu as une réponse-leurre (fausse). +35 pts pour chaque joueur qui la choisit. Vends-la comme la vraie !' },
  espion: { emoji: '👀', name: 'Espion', desc: 'Pendant le vote, choisis un joueur : tu vois sa réponse en direct.', target: true },
  doubleur: { emoji: '✖️', name: 'Quitte ou double', desc: 'Active ton ×2 : bonne réponse = points doublés, mauvaise = −50 pts.' },
  voleur: { emoji: '💰', name: 'Voleur', desc: 'Choisis une cible : si TU as la bonne réponse, tu lui voles 60 pts.', target: true },
  saboteur: { emoji: '🚫', name: 'Saboteur', desc: 'Choisis une cible : sa réponse est annulée (0 pt). Gare aux boucliers…', target: true },
  bouclier: { emoji: '🛡️', name: 'Bouclier', desc: 'Immunisé contre les vols et sabotages. Ton agresseur perd 40 pts.' },
  pacte: { emoji: '🤝', name: 'Pacte secret', desc: 'Choisis un partenaire : si vous avez juste tous les deux, +40 pts chacun.', target: true },
};
const EXTRA_POOL = ['eliminateur', 'espion', 'doubleur', 'voleur', 'saboteur', 'bouclier', 'pacte'];

class BluffRound extends BaseRound {
  start() {
    this.total = this.count(3, 2);
    this.questions = C.fresh('bluff', this.game.content.bluff, this.total);
    this.total = this.questions.length;
    this.manche = -1;
    this.history = [];
    this.nextManche();
  }

  nextManche() {
    this.manche++;
    if (this.manche >= this.total) { this.done = true; return; }
    const raw = this.questions[this.manche];
    const order = U.shuffle(raw.choix.map((_, i) => i));
    this.q = {
      q: U.fillTemplate(raw.q, U.shuffle(this.players.map((p) => p.name))),
      options: order.map((i) => raw.choix[i]),
      answer: order.indexOf(0),
      info: raw.info || '',
    };
    this.dealCards();
    this.answers = {};
    this.targets = {};
    this.doubles = {};
    this.locked = {};
    this.log = [];
    this.results = null;
    this.stage = 'cards';
    this.game.setTimer(12);
  }

  dealCards() {
    const players = U.shuffle(this.players);
    const n = players.length;
    const deck = ['initie'];
    if (n >= 3) deck.push('imposteur');
    if (n >= 7) deck.push('initie');
    const extras = U.shuffle(EXTRA_POOL);
    let k = 0;
    while (deck.length < n) {
      deck.push(extras[k % extras.length]);
      k++;
    }
    const cards = U.shuffle(deck);
    this.cards = {};
    const wrong = this.q.options.map((_, i) => i).filter((i) => i !== this.q.answer);
    const decoy = U.pick(wrong);
    players.forEach((p, i) => {
      const c = cards[i];
      const card = { id: c };
      if (c === 'initie') card.know = this.q.answer;
      if (c === 'eliminateur') card.wrong = U.pick(wrong.filter((w) => w !== decoy).length ? wrong.filter((w) => w !== decoy) : wrong);
      if (c === 'imposteur') card.decoy = decoy;
      this.cards[p.id] = card;
    });
  }

  next() {
    if (this.stage === 'cards') return this.discuss();
    if (this.stage === 'discuss') return this.act();
    if (this.stage === 'act') return this.resolve();
    return this.nextManche();
  }

  onTimeout() {
    if (this.stage === 'reveal') { if (this.game.settings.autoNext) this.nextManche(); return; }
    this.next();
  }

  discuss() {
    this.stage = 'discuss';
    this.game.setTimer(this.length < 0.8 ? 50 : 75);
  }

  act() {
    this.stage = 'act';
    this.game.setTimer(30);
  }

  action(player, msg) {
    const card = this.cards[player.id];
    if (!card) return false;
    if (this.stage !== 'act' && this.stage !== 'discuss') return false;
    if (msg.type === 'target' && CARDS[card.id].target) {
      const t = this.game.getPlayer(msg.target);
      if (!t || t.id === player.id) return false;
      this.targets[player.id] = t.id;
      return true;
    }
    if (msg.type === 'double' && card.id === 'doubleur') {
      this.doubles[player.id] = !!msg.on;
      return true;
    }
    if (this.stage !== 'act') return false;
    if (msg.type === 'answer') {
      if (this.locked[player.id]) return false;
      const i = Number(msg.value);
      if (!Number.isInteger(i) || i < 0 || i >= this.q.options.length) return false;
      this.answers[player.id] = i;
      return true;
    }
    if (msg.type === 'lock') {
      if (this.answers[player.id] === undefined) return false;
      this.locked[player.id] = true;
      if (this.allAnswered(this.locked)) this.resolve();
      return true;
    }
    return false;
  }

  onPlayerLeave() {
    if (this.stage === 'act' && this.allAnswered(this.locked)) this.resolve();
  }

  resolve() {
    if (this.stage !== 'act') return;
    this.stage = 'reveal';
    this.game.clearTimer();
    const g = this.game;
    const name = (id) => (g.getPlayer(id) || { name: '?' }).name;
    const coef = g.roundCoef();
    const players = this.players;
    const correct = (id) => this.answers[id] === this.q.answer;
    const base = {};
    const cancelled = new Set();
    const has = (id, c) => this.cards[id] && this.cards[id].id === c;
    const delta = {};
    const add = (id, v) => { delta[id] = (delta[id] || 0) + v; };

    // 1. Sabotages
    for (const p of players) {
      if (!has(p.id, 'saboteur') || !this.targets[p.id]) continue;
      const t = this.targets[p.id];
      if (has(t, 'bouclier')) {
        this.log.push(`🛡️ ${name(p.id)} a voulu saboter ${name(t)}… qui avait un BOUCLIER ! ${name(p.id)} perd 40 pts.`);
        add(p.id, g.award(p, -40, { reason: 'Sabotage raté' }));
      } else {
        cancelled.add(t);
        this.log.push(`🚫 ${name(p.id)} sabote ${name(t)} : réponse annulée !`);
        p.stats.betrayals = (p.stats.betrayals || 0) + 1;
      }
    }
    // 2. Réponses (+ quitte ou double)
    for (const p of players) {
      const ans = this.answers[p.id];
      if (ans === undefined) continue;
      let pts = 0;
      if (correct(p.id) && !cancelled.has(p.id)) pts = 90;
      if (has(p.id, 'doubleur') && this.doubles[p.id]) {
        if (correct(p.id) && !cancelled.has(p.id)) { pts *= 2; this.log.push(`✖️ ${name(p.id)} double la mise et gagne gros !`); }
        else { pts = -50; this.log.push(`✖️ ${name(p.id)} a tenté le quitte ou double… et perd 50 pts.`); }
      }
      base[p.id] = pts;
      if (pts) add(p.id, g.award(p, pts, { reason: 'Bluff' }));
    }
    // 3. Imposteurs
    for (const p of players) {
      if (!has(p.id, 'imposteur')) continue;
      const decoy = this.cards[p.id].decoy;
      const fooled = players.filter((x) => x.id !== p.id && this.answers[x.id] === decoy);
      if (fooled.length) {
        // à grande échelle, on ramène le gain à l'équivalent d'une table de 8 joueurs
        const scale = Math.min(1, 7 / Math.max(1, players.length - 1));
        const pts = g.award(p, Math.round(fooled.length * 35 * scale), { reason: 'Imposteur' });
        add(p.id, pts);
        p.stats.bluffPoints = (p.stats.bluffPoints || 0) + pts;
        p.stats.betrayals = (p.stats.betrayals || 0) + fooled.length;
        this.log.push(`🎭 L'imposteur ${name(p.id)} a piégé ${fooled.map((x) => x.name).join(', ')} avec « ${this.q.options[decoy]} » (+${pts})`);
      } else {
        this.log.push(`🎭 L'imposteur ${name(p.id)} n'a convaincu personne. Bluff à retravailler.`);
      }
    }
    // 4. Vols
    for (const p of players) {
      if (!has(p.id, 'voleur') || !this.targets[p.id]) continue;
      const t = this.targets[p.id];
      const tp = g.getPlayer(t);
      if (!tp) continue;
      if (has(t, 'bouclier')) {
        add(p.id, g.award(p, -40, { reason: 'Vol raté' }));
        this.log.push(`🛡️ ${name(p.id)} a tenté de voler ${name(t)}… protégé par un BOUCLIER ! −40 pts pour le voleur.`);
      } else if (correct(p.id)) {
        const amount = Math.round(60 * coef);
        g.award(tp, -amount, { raw: true, reason: 'Volé' });
        g.award(p, amount, { raw: true, reason: 'Vol' });
        add(p.id, amount); add(t, -amount);
        p.stats.betrayals = (p.stats.betrayals || 0) + 1;
        p.stats.bluffPoints = (p.stats.bluffPoints || 0) + amount;
        this.log.push(`💰 ${name(p.id)} VOLE ${amount} pts à ${name(t)} !`);
      } else {
        this.log.push(`💰 ${name(p.id)} visait ${name(t)}, mais s'est trompé de réponse : vol annulé.`);
      }
    }
    // 5. Pactes
    for (const p of players) {
      if (!has(p.id, 'pacte') || !this.targets[p.id]) continue;
      const t = this.targets[p.id];
      const tp = g.getPlayer(t);
      if (!tp) continue;
      if (correct(p.id) && correct(t)) {
        add(p.id, g.award(p, 40, { reason: 'Pacte' }));
        add(t, g.award(tp, 40, { reason: 'Pacte' }));
        this.log.push(`🤝 Pacte secret honoré entre ${name(p.id)} et ${name(t)} : +40 chacun.`);
      } else {
        this.log.push(`🤝 ${name(p.id)} avait fait un pacte secret avec ${name(t)}… qui n'a pas assuré.`);
      }
    }
    for (const p of players) if (has(p.id, 'espion') && this.targets[p.id]) this.log.push(`👀 ${name(p.id)} espionnait ${name(this.targets[p.id])}.`);

    this.results = delta;
    this.history.push({ q: this.q.q, answer: this.q.options[this.q.answer] });
    if (g.settings.autoNext) g.setTimer(12);
  }

  view(player) {
    const showAll = this.stage === 'reveal';
    const deckCounts = {};
    Object.values(this.cards).forEach((c) => { deckCounts[c.id] = (deckCounts[c.id] || 0) + 1; });
    const pub = {
      kind: 'bluff',
      stage: this.stage,
      manche: this.manche,
      total: this.total,
      q: { q: this.q.q, options: this.q.options },
      deck: Object.entries(deckCounts).map(([id, n]) => ({ id, n, ...CARDS[id] })),
      locked: Object.keys(this.locked),
      answeredCount: Object.keys(this.answers).length,
    };
    if (showAll) {
      pub.answer = this.q.answer;
      pub.info = this.q.info;
      pub.answers = this.answers;
      pub.cards = Object.fromEntries(Object.entries(this.cards).map(([pid, c]) => [pid, { ...c, ...CARDS[c.id] }]));
      pub.targets = this.targets;
      pub.log = this.log;
      pub.results = this.results;
    }
    if (player) {
      const c = this.cards[player.id];
      if (c) {
        const me = { card: { ...c, ...CARDS[c.id] }, answer: this.answers[player.id], target: this.targets[player.id] || null, double: !!this.doubles[player.id], locked: !!this.locked[player.id] };
        if (c.id === 'espion' && this.targets[player.id] && this.stage === 'act') {
          const t = this.targets[player.id];
          me.peek = { target: t, answer: this.answers[t] };
        }
        if (showAll && this.results) me.delta = this.results[player.id] || 0;
        pub.me = me;
      } else {
        pub.me = { spectator: true };
      }
    }
    return pub;
  }
}

module.exports = BluffRound;
