'use strict';
// 📝 ÉPREUVE 7 — Deviner un mot (façon Taboo)
// Un orateur décrit à l'oral sans utiliser les mots interdits. Ses coéquipiers tapent leurs propositions.
// Les adversaires peuvent aussi taper : s'ils trouvent avant, ils VOLENT les points.

const BaseRound = require('./base');
const C = require('../content');
const U = require('../util');
const Roster = require('../roster');

class MotRound extends BaseRound {
  start() {
    const g = this.game;
    this.teamMode = !!(g.teams && g.teams.length >= 2);
    // ordre des orateurs : on alterne les équipes
    let order;
    if (this.teamMode) {
      const lists = g.teams.map((t) => U.shuffle(t.members));
      order = [];
      const max = Math.max(...lists.map((l) => l.length));
      for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) order.push(l[i]);
    } else {
      order = U.shuffle(this.players.map((p) => p.id));
    }
    // Grand groupe : on limite le nombre d'orateurs (même nombre de tours par équipe)
    const cap = this.length < 0.8 ? 6 : this.length > 1.2 ? 16 : 10;
    if (order.length > cap) {
      const k = this.teamMode ? g.teams.length : 1;
      order = order.slice(0, Math.max(k, k * Math.floor(cap / k)));
    }
    this.order = order;
    this.usedColleagues = new Set();
    this.turnIdx = -1;
    this.turnTime = this.length < 0.8 ? 40 : this.length > 1.2 ? 60 : 45;
    this.log = [];
    this.nextTurn();
  }

  get describer() {
    return this.game.getPlayer(this.order[this.turnIdx]);
  }

  nextTurn() {
    this.turnIdx++;
    while (this.turnIdx < this.order.length && !(this.describer && this.describer.connected)) this.turnIdx++;
    if (this.turnIdx >= this.order.length) { this.done = true; return; }
    this.stage = 'ready';
    this.words = [];
    this.word = null;
    this.feed = [];
    this.claims = [];
    this.lastGuess = {};
    this.game.setTimer(20);
  }

  teamOf(pid) {
    if (!this.teamMode) return null;
    const t = this.game.teams.find((x) => x.members.includes(pid));
    return t ? t.id : null;
  }

  isTeammate(pid) {
    const d = this.describer;
    if (!d || pid === d.id) return false;
    if (!this.teamMode) return true;
    return this.teamOf(pid) === this.teamOf(d.id);
  }

  drawWord() {
    const w = (Math.random() < 0.25 && this.colleagueCard()) || C.fresh('mots', this.game.content.mots, 1)[0];
    this.word = { ...w, status: 'live' };
    this.feed = [];
  }

  // 👥 Carte « Fais deviner un collègue » (trombinoscope) : en priorité les joueurs présents
  colleagueCard() {
    const team = this.game.content.team || {};
    if (team.cartesCollegues === false) return null;
    const cards = Roster.colleagueWords(team.membres || []);
    if (!cards.length) return null;
    const d = this.describer;
    const self = new Set(d && d.profile ? [d.profile.key, d.profile.prenom] : []);
    const present = new Set(this.connected.filter((p) => p.profile && p !== d).flatMap((p) => [p.profile.key, p.profile.prenom]));
    const pool = cards.filter((c) => !this.usedColleagues.has(c.mot) && !self.has(c.mot));
    if (!pool.length) return null;
    const preferred = pool.filter((c) => present.has(c.mot));
    const card = U.pick(preferred.length ? preferred : pool);
    this.usedColleagues.add(card.mot);
    return card;
  }

  play() {
    this.stage = 'play';
    this.drawWord();
    this.game.setTimer(this.turnTime);
  }

  endTurn() {
    if (this.word && this.word.status === 'live') {
      this.word.status = 'timeout';
      this.words.push(this.word);
    }
    this.word = null;
    this.stage = 'turnEnd';
    this.log.push({ describer: this.order[this.turnIdx], words: this.words.slice() });
    this.game.setTimer(this.game.settings.autoNext ? 8 : 600);
  }

  next() {
    if (this.stage === 'ready') return this.play();
    if (this.stage === 'play') return this.endTurn();
    return this.nextTurn();
  }

  onTimeout() {
    if (this.stage === 'ready') this.play();
    else if (this.stage === 'play') this.endTurn();
    else if (this.game.settings.autoNext) this.nextTurn();
  }

  finishWord(status, extra = {}) {
    this.word.status = status;
    Object.assign(this.word, extra);
    this.words.push(this.word);
    this.drawWord();
  }

  action(player, msg) {
    const d = this.describer;
    if (!d) return false;
    if (msg.type === 'start' && this.stage === 'ready' && player.id === d.id) { this.play(); return true; }
    if (this.stage !== 'play' || !this.word) {
      if (msg.type === 'claim') return this.claim(player);
      return false;
    }
    if (msg.type === 'pass' && player.id === d.id) {
      this.game.award(d, -10, { reason: 'Mot passé' });
      this.finishWord('passed');
      return true;
    }
    if (msg.type === 'claim') return this.claim(player);
    if (msg.type === 'guess' && player.id !== d.id) {
      const now = Date.now();
      if (now - (this.lastGuess[player.id] || 0) < 350) return false;
      this.lastGuess[player.id] = now;
      const text = String(msg.text || '').slice(0, 40).trim();
      if (!text) return false;
      const ok = U.fuzzyMatch(text, [this.word.mot, ...(this.word.alts || [])]);
      if (!ok) {
        this.feed.push({ pid: player.id, text, ok: false });
        if (this.feed.length > 14) this.feed.shift();
        return true;
      }
      if (this.isTeammate(player.id)) {
        const a = this.game.award(player, 50, { reason: 'Mot trouvé' });
        const b = this.game.award(d, 50, { reason: 'Orateur' });
        player.stats.wordsFound = (player.stats.wordsFound || 0) + 1;
        d.stats.wordsGiven = (d.stats.wordsGiven || 0) + 1;
        this.finishWord('found', { by: player.id, points: a + b });
      } else {
        const a = this.game.award(player, 35, { reason: 'Vol de mot' });
        player.stats.steals = (player.stats.steals || 0) + 1;
        player.stats.betrayals = (player.stats.betrayals || 0) + 1;
        this.finishWord('stolen', { by: player.id, points: a });
        this.game.notify(`🦹 ${player.name} VOLE le mot « ${this.words[this.words.length - 1].mot} » !`);
      }
      return true;
    }
    return false;
  }

  claim(player) {
    if (this.claims.includes(player.id)) return false;
    this.claims.push(player.id);
    this.game.notify(`🚩 ${player.name} réclame un carton rouge ! (au MC de trancher)`, { host: true });
    return true;
  }

  hostAction(msg) {
    if (msg.type === 'carton') {
      const d = this.describer;
      if (!d) return false;
      this.game.award(d, -30, { reason: 'Carton rouge', raw: true });
      d.stats.redCards = (d.stats.redCards || 0) + 1;
      this.game.notify(`🟥 CARTON ROUGE pour ${d.name} ! Mot interdit prononcé. −30 pts`);
      if (this.stage === 'play' && this.word) this.finishWord('carton');
      this.claims = [];
      return true;
    }
    return false;
  }

  view(player, role) {
    const d = this.describer;
    const pub = {
      kind: 'mot',
      stage: this.stage,
      turn: this.turnIdx,
      totalTurns: this.order.length,
      describer: d ? d.id : null,
      describerTeam: d ? this.teamOf(d.id) : null,
      teamMode: this.teamMode,
      feed: this.feed,
      words: (this.words || []).map((w) => ({ mot: w.mot, interdits: w.interdits, status: w.status, by: w.by })),
      claims: this.claims,
      upcoming: this.order.slice(this.turnIdx + 1, this.turnIdx + 4),
    };
    const canSee = player ? player.id === (d && d.id) : false;
    if (canSee && this.word) pub.word = { mot: this.word.mot, interdits: this.word.interdits, cat: this.word.cat };
    if (this.word) pub.wordCat = this.word.cat;
    if (player) {
      pub.me = {
        isDescriber: d && player.id === d.id,
        isTeammate: this.isTeammate(player.id),
        claimed: this.claims.includes(player.id),
      };
    } else if (this.word && role === 'host') {
      // le MC peut jeter un œil (bouton « maintenir pour voir ») — jamais sur l'écran TV
      pub.hostWord = { mot: this.word.mot, interdits: this.word.interdits };
    }
    return pub;
  }
}

module.exports = MotRound;
