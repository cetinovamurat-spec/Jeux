'use strict';
// 🕵️ ÉPREUVE 3 — Trouver le menteur
// Chaque joueur reçoit une affirmation publique + un rôle secret.
// Plaidoiries à l'oral (Teams/Discord), puis chacun vote « Vérité » ou « Mensonge » pour chaque collègue.

const BaseRound = require('./base');
const C = require('../content');
const U = require('../util');

const ROLES = {
  innocent: {
    emoji: '😇', name: 'Innocent', lying: false,
    mission: 'Dis la VÉRITÉ : réponds honnêtement (oui ou non, c\'est ton vécu) et défends ta version. +15 pts par collègue qui te croit.',
  },
  menteur: {
    emoji: '😈', name: 'Menteur', lying: true,
    mission: 'MENS : affirme l\'inverse de la réalité avec une histoire bien ficelée. +30 pts par collègue qui te croit.',
  },
  double: {
    emoji: '🤡', name: 'Double menteur', lying: false,
    mission: 'Dis la VÉRITÉ… mais aie l\'air de mentir : hésite, transpire, contredis-toi. +30 pts par collègue qui t\'accuse de mentir.',
  },
  manipulateur: {
    emoji: '🧠', name: 'Manipulateur', lying: true,
    mission: 'MENS sur ton affirmation (+30 pts par collègue berné) ET fais accuser ta cible, qui dit la vérité : +60 pts si la majorité l\'accuse.',
  },
};

class MenteurRound extends BaseRound {
  start() {
    // les joueurs connectés d'abord : une place d'accusé ne doit pas revenir à un téléphone en veille
    const all = [...U.shuffle(this.connected), ...U.shuffle(this.players.filter((p) => !p.connected))];
    // Grand groupe : seuls quelques « accusés » plaident, tout le monde vote (le jury)
    const cap = this.length < 0.8 ? 8 : this.length > 1.2 ? 14 : 10;
    const players = all.slice(0, cap);
    this.withJury = all.length > players.length;
    const n = players.length;
    this.order = players.map((p) => p.id);
    const statements = C.fresh('menteur', this.game.content.menteur, n);
    let liars = U.clamp(Math.round(n * U.pick([0.4, 0.5, 0.5, 0.6])), 1, Math.max(1, n - 1));
    const roles = {};
    const shuffled = U.shuffle(players);
    shuffled.forEach((p, i) => { roles[p.id] = i < liars ? 'menteur' : 'innocent'; });
    const truthful = shuffled.filter((p) => roles[p.id] === 'innocent');
    if (n >= 4 && truthful.length >= 2) roles[truthful[0].id] = 'double';
    this.cards = {};
    if (n >= 5) {
      const liar = shuffled.find((p) => roles[p.id] === 'menteur');
      if (liar) roles[liar.id] = 'manipulateur';
    }
    players.forEach((p, i) => {
      const s = statements[i % statements.length];
      const others = U.shuffle(all.filter((x) => x.id !== p.id).map((x) => x.name));
      this.cards[p.id] = { statement: U.fillTemplate(s.texte, others), role: roles[p.id] };
    });
    for (const p of players) {
      if (roles[p.id] === 'manipulateur') {
        const targets = players.filter((x) => !ROLES[roles[x.id]].lying);
        if (targets.length) this.cards[p.id].target = U.pick(targets).id;
      }
    }
    this.votes = {};
    this.stage = 'brief';
    this.pleadIdx = -1;
    this.revealIdx = -1;
    this.pleadTime = n > 8 ? 25 : 35;
    this.game.setTimer(25);
  }

  get pleader() {
    return this.order[this.pleadIdx];
  }

  next() {
    if (this.stage === 'brief') return this.startPlead(0);
    if (this.stage === 'plead') {
      if (this.pleadIdx + 1 < this.order.length) return this.startPlead(this.pleadIdx + 1);
      return this.startVote();
    }
    if (this.stage === 'vote') return this.startReveal();
    if (this.stage === 'reveal') {
      if (this.revealIdx + 1 < this.order.length) {
        this.revealIdx++;
        if (this.game.settings.autoNext) this.game.setTimer(8);
        return;
      }
      this.done = true;
    }
  }

  onTimeout() {
    if (this.stage === 'reveal' && !this.game.settings.autoNext) return;
    this.next();
  }

  startPlead(i) {
    this.stage = 'plead';
    this.pleadIdx = i;
    // on saute les joueurs partis
    while (this.pleadIdx < this.order.length && !this.game.getPlayer(this.order[this.pleadIdx])) this.pleadIdx++;
    if (this.pleadIdx >= this.order.length) return this.startVote();
    this.game.setTimer(this.pleadTime);
  }

  startVote() {
    this.stage = 'vote';
    this.game.setTimer(40);
    if (this.everyoneVoted()) this.startReveal();
  }

  everyoneVoted() {
    const ids = this.order.filter((id) => this.game.getPlayer(id));
    return this.connected.every((p) => ids.every((t) => t === p.id || (this.votes[p.id] && this.votes[p.id][t])));
  }

  action(player, msg) {
    if (msg.type !== 'vote') return false;
    if (this.stage !== 'plead' && this.stage !== 'vote') return false;
    const target = msg.target;
    if (target === player.id || !this.cards[target]) return false;
    if (this.stage === 'plead' && this.order.indexOf(target) > this.pleadIdx) return false;
    if (msg.value !== 'truth' && msg.value !== 'lie') return false;
    this.votes[player.id] = this.votes[player.id] || {};
    this.votes[player.id][target] = msg.value;
    if (this.stage === 'vote' && this.everyoneVoted()) this.startReveal();
    return true;
  }

  onPlayerLeave() {
    if (this.stage === 'vote' && this.everyoneVoted()) this.startReveal();
  }

  startReveal() {
    this.stage = 'reveal';
    this.revealIdx = 0;
    this.game.clearTimer();
    const g = this.game;
    this.breakdown = {};
    const detective = {};
    for (const tid of this.order) {
      const tp = g.getPlayer(tid);
      if (!tp) continue;
      const card = this.cards[tid];
      const role = ROLES[card.role];
      const believed = [];
      const doubted = [];
      for (const [vid, votes] of Object.entries(this.votes)) {
        const v = votes[tid];
        if (!v) continue;
        if (v === 'truth') believed.push(vid); else doubted.push(vid);
        const correct = (v === 'lie') === role.lying;
        if (correct) detective[vid] = (detective[vid] || 0) + 1;
      }
      let pts = 0;
      if (card.role === 'innocent') pts = believed.length * 15;
      if (card.role === 'menteur' || card.role === 'manipulateur') pts = believed.length * 30;
      if (card.role === 'double') pts = doubted.length * 30;
      // Grand jury : les gains d'un accusé sont ramenés à l'échelle d'un jury de 7 votants
      const voters = believed.length + doubted.length;
      if (voters > 7) pts = Math.round((pts * 7) / voters);
      const fooled = role.lying ? believed.length : card.role === 'double' ? doubted.length : 0;
      tp.stats.fooled = (tp.stats.fooled || 0) + fooled;
      tp.stats.betrayals = (tp.stats.betrayals || 0) + fooled;
      let manipBonus = 0;
      if (card.role === 'manipulateur' && card.target) {
        let lie = 0; let truth = 0;
        for (const votes of Object.values(this.votes)) {
          if (votes[card.target] === 'lie') lie++;
          if (votes[card.target] === 'truth') truth++;
        }
        if (lie > truth) manipBonus = 60;
      }
      const awarded = pts + manipBonus ? g.award(tp, pts + manipBonus, { reason: 'Talent d\'acteur' }) : 0;
      if (fooled > 0) tp.stats.bluffPoints = (tp.stats.bluffPoints || 0) + awarded;
      this.breakdown[tid] = { role: card.role, believed, doubted, points: awarded, manipBonus, fooled };
    }
    this.detective = {};
    for (const [vid, n] of Object.entries(detective)) {
      const vp = g.getPlayer(vid);
      if (!vp) continue;
      this.detective[vid] = g.award(vp, n * 25, { reason: 'Flair de détective' });
      vp.stats.detections = (vp.stats.detections || 0) + n;
    }
    if (g.settings.autoNext) g.setTimer(8);
  }

  view(player) {
    const pub = {
      kind: 'menteur',
      stage: this.stage,
      order: this.order,
      statements: Object.fromEntries(this.order.map((id) => [id, this.cards[id].statement])),
      pleader: this.stage === 'plead' ? this.pleader : null,
      pleadIdx: this.pleadIdx,
      voted: Object.fromEntries(Object.entries(this.votes).map(([k, v]) => [k, Object.keys(v).length])),
      roleCounts: this.roleCounts(),
      withJury: this.withJury,
    };
    if (this.stage === 'reveal') {
      pub.revealIdx = this.revealIdx;
      pub.revealed = this.order.slice(0, this.revealIdx + 1).map((id) => ({
        id, ...this.breakdown[id], roleInfo: ROLES[this.cards[id].role],
        target: this.cards[id].target,
      })).filter((x) => x.role);
      pub.detective = this.detective;
    }
    if (player) {
      const card = this.cards[player.id];
      if (card) {
        const target = card.target ? this.game.getPlayer(card.target) : null;
        pub.me = {
          statement: card.statement,
          role: card.role,
          roleInfo: ROLES[card.role],
          target: target ? target.id : null,
          targetName: target ? target.name : null,
          votes: this.votes[player.id] || {},
        };
      } else {
        pub.me = { spectator: true, votes: this.votes[player.id] || {} };
      }
    }
    return pub;
  }

  roleCounts() {
    const counts = {};
    for (const c of Object.values(this.cards)) counts[c.role] = (counts[c.role] || 0) + 1;
    return Object.entries(counts).map(([role, n]) => ({ role, n, ...ROLES[role] }));
  }
}

module.exports = MenteurRound;
