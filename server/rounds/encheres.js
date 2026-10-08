'use strict';
// 💰 ÉPREUVE 10 — Les Enchères (épreuve finale)
// Chaque joueur reçoit des Audit Coins 🪙 (plus on est mal classé, plus on en reçoit).
// Enchères secrètes sur des lots : droit de réponse, multiplicateur, indice, vol, blocage, mystère…
// Le plus offrant remporte le lot. Égalité -> avantage au joueur le moins bien classé (comeback !).

const BaseRound = require('./base');
const C = require('../content');
const U = require('../util');

const LOT_TYPES = {
  question: { emoji: '🎤', label: 'Droit de réponse' },
  multiplicateur: { emoji: '✖️', label: 'Multiplicateur ×2' },
  indice: { emoji: '🔎', label: 'Indice' },
  vol: { emoji: '🦹', label: 'Vol de points' },
  blocage: { emoji: '⛔', label: 'Blocage' },
  doubler: { emoji: '♻️', label: 'Doubler une épreuve' },
  mystere: { emoji: '📦', label: 'Lot mystère' },
};

const MYSTERES = [
  { label: '+300 pts : le client a enfin envoyé TOUTES les pièces !', pts: 300 },
  { label: '+200 pts : prime exceptionnelle de l\'associé.', pts: 200 },
  { label: '+150 pts : la balance tombe du premier coup.', pts: 150 },
  { label: '−100 pts : c\'était un carton de factures non lettrées.', pts: -100 },
  { label: '+0 pt : un mug « World\'s Best Auditor ». Valeur sentimentale uniquement.', pts: 0 },
  { label: 'Chaque adversaire te verse 25 pts : tu as gagné la cagnotte du pot de départ !', each: 25 },
  { label: '+250 pts : tu as trouvé l\'écart de 14 € !', pts: 250 },
];

class EncheresRound extends BaseRound {
  start() {
    const g = this.game;
    const ranking = g.ranking();
    const n = ranking.length;
    this.coins = {};
    this.startCoins = {};
    ranking.forEach((p, i) => {
      const bonus = n > 1 ? Math.round((800 * i) / (n - 1) / 50) * 50 : 0;
      this.coins[p.id] = 1000 + bonus;
      this.startCoins[p.id] = 1000 + bonus;
    });
    this.buildLots();
    this.idx = -1;
    this.multipliers = {};
    this.blocked = null;
    this.hintFor = null;
    this.history = [];
    this.nextLot();
  }

  buildLots() {
    const pool = this.game.content.encheres;
    const total = this.count(6, 4);
    const nSpecial = Math.floor(total / 3);
    const questions = C.fresh('ench:q', pool, total - nSpecial, (l) => l.type === 'question');
    const specials = C.fresh('ench:s', pool, nSpecial, (l) => l.type !== 'question');
    const lots = [];
    let qi = 0; let si = 0;
    for (let i = 0; i < total; i++) {
      const wantSpecial = i % 2 === 1 && si < specials.length && i < total - 1;
      if (wantSpecial) lots.push(specials[si++]);
      else if (qi < questions.length) lots.push(questions[qi++]);
      else if (si < specials.length) lots.push(specials[si++]);
    }
    // le dernier lot doit être une question : c'est le grand final
    const last = lots[lots.length - 1];
    if (last && last.type !== 'question') {
      const j = lots.map((l) => l.type).lastIndexOf('question');
      if (j >= 0) [lots[j], lots[lots.length - 1]] = [lots[lots.length - 1], lots[j]];
    }
    this.lots = lots.map((l, i) => {
      const lot = { ...l, final: i === lots.length - 1 && l.type === 'question' };
      if (l.question) {
        const order = U.shuffle(l.question.choix.map((_, k) => k));
        lot.q = { q: l.question.q, options: order.map((k) => l.question.choix[k]), answer: order.indexOf(0), cat: l.question.cat, d: l.question.d || 2, info: l.question.info };
      }
      return lot;
    });
  }

  get lot() { return this.lots[this.idx]; }

  nextLot() {
    this.idx++;
    if (this.idx >= this.lots.length) return this.finish();
    this.bids = {};
    this.winner = null;
    this.answers = {};
    this.outcome = null;
    this.choice = null;
    this.stage = 'present';
    this.blockedNow = this.blocked;
    this.blocked = null;
    this.hintNow = this.lot.type === 'question' ? this.hintFor : null;
    if (this.lot.type === 'question') this.hintFor = null;
    this.game.setTimer(8);
  }

  next() {
    switch (this.stage) {
      case 'present': return this.openBids();
      case 'bid': return this.closeBids();
      case 'bids': return this.afterBids();
      case 'answer': return this.resolveQuestion();
      case 'choose': return this.resolveChoice(true);
      case 'result': return this.nextLot();
      case 'final': this.done = true; return undefined;
      default: return undefined;
    }
  }

  onTimeout() {
    if (this.stage === 'bids' || this.stage === 'result' || this.stage === 'final') {
      if (this.game.settings.autoNext) this.next();
      return;
    }
    this.next();
  }

  openBids() {
    this.stage = 'bid';
    this.game.setTimer(20);
  }

  canBid(p) {
    return p.id !== this.blockedNow;
  }

  action(player, msg) {
    if (msg.type === 'bid' && this.stage === 'bid') {
      if (!this.canBid(player) || this.bids[player.id] !== undefined) return false;
      let amount = Math.floor(Number(msg.amount));
      if (!Number.isFinite(amount) || amount < 0) return false;
      amount = Math.min(amount, this.coins[player.id] || 0);
      this.bids[player.id] = amount;
      const eligible = this.connected.filter((p) => this.canBid(p));
      if (this.allAnswered(this.bids, eligible)) this.closeBids();
      return true;
    }
    if (msg.type === 'answer' && this.stage === 'answer') {
      if (this.answers[player.id] !== undefined) return false;
      const i = Number(msg.value);
      if (!Number.isInteger(i) || i < 0 || i >= this.lot.q.options.length) return false;
      this.answers[player.id] = i;
      if (this.allAnswered(this.answers)) this.resolveQuestion();
      return true;
    }
    if (msg.type === 'choose' && this.stage === 'choose' && this.winner === player.id) {
      this.choice = msg.value;
      this.resolveChoice(false);
      return true;
    }
    return false;
  }

  onPlayerLeave() {
    if (this.stage === 'bid') {
      const eligible = this.connected.filter((p) => this.canBid(p));
      if (this.allAnswered(this.bids, eligible)) this.closeBids();
    } else if (this.stage === 'answer' && this.allAnswered(this.answers)) this.resolveQuestion();
  }

  closeBids() {
    if (this.stage !== 'bid') return;
    this.stage = 'bids';
    const g = this.game;
    const rankIndex = Object.fromEntries(g.ranking().map((p, i) => [p.id, i]));
    const entries = Object.entries(this.bids).filter(([, v]) => v > 0);
    entries.sort((a, b) => b[1] - a[1] || rankIndex[b[0]] - rankIndex[a[0]] || Math.random() - 0.5);
    if (entries.length) {
      const [wid, amount] = entries[0];
      this.winner = wid;
      this.winBid = amount;
      this.tie = entries.length > 1 && entries[1][1] === amount;
      this.coins[wid] -= amount;
      const wp = g.getPlayer(wid);
      if (wp) wp.stats.auctionsWon = (wp.stats.auctionsWon || 0) + 1;
    } else {
      this.winner = null;
      this.winBid = 0;
    }
    g.setTimer(g.settings.autoNext ? 6 : 600);
  }

  afterBids() {
    const g = this.game;
    const t = this.lot.type;
    if (t === 'question') {
      this.stage = 'answer';
      g.setTimer(20);
      return;
    }
    if (!this.winner) {
      this.outcome = { text: 'Lot invendu. Le commissaire-priseur range son marteau, vexé.' };
      return this.toResult();
    }
    const wp = g.getPlayer(this.winner);
    if (t === 'multiplicateur') {
      this.multipliers[this.winner] = 2;
      this.outcome = { text: `${wp.name} active un ×2 sur son prochain gain en droit de réponse !` };
      return this.toResult();
    }
    if (t === 'indice') {
      this.hintFor = this.winner;
      this.outcome = { text: `${wp.name} verra la question du prochain lot AVANT d'enchérir. Délit d'initié autorisé.` };
      return this.toResult();
    }
    if (t === 'mystere') {
      const m = U.pick(MYSTERES);
      let delta = 0;
      if (m.each) {
        for (const p of this.players) {
          if (p.id === wp.id) continue;
          g.award(p, -m.each, { raw: true, reason: 'Cagnotte' });
          delta += m.each;
        }
        g.award(wp, delta, { raw: true, reason: 'Lot mystère' });
      } else {
        delta = g.award(wp, m.pts, { raw: true, reason: 'Lot mystère' });
      }
      this.outcome = { text: `📦 ${wp.name} ouvre le carton… ${m.label}`, delta: { [wp.id]: delta } };
      return this.toResult();
    }
    // vol / blocage / doubler : le gagnant doit choisir
    this.stage = 'choose';
    g.setTimer(20);
    return undefined;
  }

  choiceOptions() {
    const t = this.lot.type;
    const g = this.game;
    if (t === 'vol' || t === 'blocage') {
      return this.players.filter((p) => p.id !== this.winner).map((p) => ({ value: p.id, label: p.name, avatar: p.avatar, score: p.score }));
    }
    if (t === 'doubler') {
      const wp = g.getPlayer(this.winner);
      if (!wp) return [];
      return g.history
        .map((h) => ({ value: h.roundId, label: `${h.emoji} ${h.name}`, points: Math.min(400, Math.max(0, (wp.pointsByRound || {})[h.roundId] || 0)) }))
        .filter((o) => o.points > 0);
    }
    return [];
  }

  resolveChoice(timeout) {
    if (this.stage !== 'choose') return;
    const g = this.game;
    const opts = this.choiceOptions();
    let choice = opts.find((o) => o.value === this.choice);
    if (!choice) {
      if (!timeout && opts.length) return; // choix invalide : on attend
      choice = opts.length ? (this.lot.type === 'doubler' ? opts.sort((a, b) => b.points - a.points)[0] : U.pick(opts)) : null;
    }
    const wp = g.getPlayer(this.winner);
    const t = this.lot.type;
    if (!choice || !wp) {
      this.outcome = { text: 'Rien à faire ici… le lot part aux oubliettes.' };
    } else if (t === 'vol') {
      const tp = g.getPlayer(choice.value);
      const amount = Math.max(150, Math.round(tp.score * 0.08 / 10) * 10);
      g.award(tp, -amount, { raw: true, reason: 'Volé aux enchères' });
      g.award(wp, amount, { raw: true, reason: 'Vol aux enchères' });
      wp.stats.betrayals = (wp.stats.betrayals || 0) + 1;
      this.outcome = { text: `🦹 ${wp.name} vole ${amount} pts à ${tp.name} ! Aucun justificatif fourni.`, delta: { [wp.id]: amount, [tp.id]: -amount } };
    } else if (t === 'blocage') {
      const tp = g.getPlayer(choice.value);
      this.blocked = tp.id;
      wp.stats.betrayals = (wp.stats.betrayals || 0) + 1;
      this.outcome = { text: `⛔ ${tp.name} est bloqué : interdit d'enchérir au prochain lot. « Votre accès au dossier a été révoqué. »` };
    } else if (t === 'doubler') {
      const pts = g.award(wp, choice.points, { raw: true, reason: 'Épreuve doublée' });
      this.outcome = { text: `♻️ ${wp.name} double « ${choice.label} » : +${pts} pts !`, delta: { [wp.id]: pts } };
    }
    this.toResult();
  }

  resolveQuestion() {
    if (this.stage !== 'answer') return;
    const g = this.game;
    const lot = this.lot;
    const ok = (id) => this.answers[id] === lot.q.answer;
    const delta = {};
    let text;
    for (const p of this.players) {
      if (p.id === this.winner) continue;
      if (ok(p.id)) delta[p.id] = g.award(p, this.winner ? 30 : 60, { reason: 'Bonne réponse' });
    }
    if (this.winner) {
      const wp = g.getPlayer(this.winner);
      const mult = this.multipliers[this.winner] || 1;
      const finalMult = lot.final ? 1.5 : 1;
      if (ok(this.winner)) {
        const gain = Math.round((this.winBid + 100) * mult * finalMult);
        delta[wp.id] = g.award(wp, gain, { raw: true, reason: 'Enchère gagnée' });
        text = `✅ ${wp.name} avait misé ${this.winBid} 🪙… et a RAISON ! +${gain} pts${mult > 1 ? ' (×2 activé !)' : ''}`;
        wp.stats.auctionWins = (wp.stats.auctionWins || 0) + 1;
      } else {
        const loss = Math.round(this.winBid * 0.5 * finalMult);
        delta[wp.id] = g.award(wp, -loss, { raw: true, reason: 'Enchère perdue' });
        text = this.answers[wp.id] === undefined
          ? `⌛ ${wp.name} n'a pas répondu à temps… −${loss} pts. Le client attend toujours.`
          : `❌ ${wp.name} avait misé ${this.winBid} 🪙… et se TROMPE ! −${loss} pts`;
      }
      if (mult > 1) delete this.multipliers[this.winner];
    } else {
      text = 'Personne n\'a enchéri : tout le monde a répondu pour 60 pts.';
    }
    this.outcome = { text, delta, answer: lot.q.answer, answers: { ...this.answers }, info: lot.q.info };
    this.toResult();
  }

  toResult() {
    this.stage = 'result';
    this.history.push({ titre: this.lot.titre, winner: this.winner, bid: this.winBid, outcome: this.outcome.text });
    this.game.setTimer(this.game.settings.autoNext ? 9 : 600);
  }

  finish() {
    const g = this.game;
    this.conversion = {};
    for (const p of this.players) {
      const left = this.coins[p.id] || 0;
      const pts = Math.round(left * 0.2);
      if (pts > 0) this.conversion[p.id] = g.award(p, pts, { raw: true, reason: 'Conversion des Audit Coins' });
    }
    this.stage = 'final';
    this.idx = this.lots.length - 1;
    g.setTimer(g.settings.autoNext ? 8 : 600);
  }

  view(player) {
    const lot = this.lot;
    const g = this.game;
    const pub = {
      kind: 'encheres',
      stage: this.stage,
      index: this.idx,
      total: this.lots.length,
      lot: lot ? {
        type: lot.type, titre: lot.titre, texte: lot.texte, final: lot.final,
        ...LOT_TYPES[lot.type],
        cat: lot.q ? lot.q.cat : null,
        d: lot.q ? lot.q.d : null,
      } : null,
      coins: this.coins,
      startCoins: this.startCoins,
      blocked: this.blockedNow,
      bidCount: Object.keys(this.bids || {}).length,
      bidders: Object.keys(this.bids || {}),
      multipliers: this.multipliers,
    };
    if (lot && lot.q && (this.stage === 'answer' || this.stage === 'result')) pub.question = { q: lot.q.q, options: lot.q.options };
    if (['bids', 'answer', 'choose', 'result'].includes(this.stage)) {
      pub.bids = this.bids;
      pub.winner = this.winner;
      pub.winBid = this.winBid;
      pub.tie = this.tie;
    }
    if (this.stage === 'answer') pub.answered = Object.keys(this.answers);
    if (this.stage === 'choose') pub.choices = this.choiceOptions();
    if (this.stage === 'result') pub.outcome = this.outcome;
    if (this.stage === 'final') pub.conversion = this.conversion;
    if (player) {
      pub.me = {
        coins: this.coins[player.id] || 0,
        bid: this.bids ? this.bids[player.id] : undefined,
        blocked: this.blockedNow === player.id,
        isWinner: this.winner === player.id,
        answer: this.answers ? this.answers[player.id] : undefined,
        multiplier: this.multipliers[player.id] || 1,
        hasHint: !!(lot && lot.q && this.hintNow === player.id),
      };
      if (pub.me.hasHint && (this.stage === 'present' || this.stage === 'bid')) pub.me.hint = { q: lot.q.q, options: lot.q.options };
    }
    return pub;
  }
}

module.exports = EncheresRound;
