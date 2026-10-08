'use strict';
// Le moteur d'une partie : joueurs, phases, scores, équipes, événements, vues temps réel.

const U = require('./util');
const C = require('./content');
const { composeTeams } = require('./teams');
const { ROUNDS, ORDER, meta } = require('./rounds');
const Events = require('./events');
const Awards = require('./awards');
const History = require('./history');

const LENGTH = { court: 0.6, normal: 1, long: 1.5 };
const MAX_PLAYERS = 24;

class Game {
  constructor(code) {
    this.code = code;
    this.hostToken = U.token();
    this.players = [];
    this.phase = 'lobby';
    this.settings = {
      rounds: ORDER.slice(),
      length: 'normal',
      events: true,
      teams: true,
      autoNext: false,
    };
    this.roundIndex = -1;
    this.round = null;
    this.roundMeta = null;
    this.teams = null;
    this.teamMemory = {};
    this.pairCounts = {};
    this.timer = null;
    this.event = null;
    this.usedEvents = new Set();
    this.pendingMods = { global: {}, players: {} };
    this.roundMods = {};
    this.history = []; // résumé de chaque épreuve
    this.teamRecords = [];
    this.notifications = [];
    this.hostSockets = new Set();
    this.screenSockets = new Set();
    this.eventsSinceLast = 0;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.content = C.all();
    this.final = null;
    this._broadcastScheduled = false;
  }

  // ───────────────────────────── Joueurs ─────────────────────────────

  activePlayers() {
    return this.players.filter((p) => !p.kicked);
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id && !p.kicked) || null;
  }

  findProfile(name) {
    const n = U.normalize(name);
    const membres = (this.content.team && this.content.team.membres) || [];
    return membres.find((m) => U.normalize(m.prenom) === n || (m.alias || []).some((a) => U.normalize(a) === n)) || null;
  }

  join(name, avatar, tokenFromClient) {
    this.lastActivity = Date.now();
    if (tokenFromClient) {
      const existing = this.players.find((p) => p.token === tokenFromClient && !p.kicked);
      if (existing) return { player: existing, rejoined: true };
    }
    const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    if (!clean) return { error: 'Choisis un pseudo !' };
    const same = this.players.find((p) => !p.kicked && U.normalize(p.name) === U.normalize(clean));
    if (same) {
      // Reprise de place depuis un autre appareil si l'ancien est déconnecté
      if (!same.connected) return { player: same, rejoined: true };
      return { error: 'Ce pseudo est déjà pris (et connecté). Ajoute une initiale ?' };
    }
    if (this.activePlayers().length >= MAX_PLAYERS) return { error: 'La salle de réunion est pleine.' };
    const profile = this.findProfile(clean);
    const startScore = this.phase === 'lobby' ? 0 : Math.max(0, Math.min(...this.activePlayers().map((p) => p.score), Infinity) || 0);
    const p = {
      id: U.id(),
      token: U.token(),
      name: clean,
      avatar: String(avatar || (profile && profile.emoji) || '🦊').slice(0, 8),
      profile: profile ? { titre: profile.titre, role: profile.role, intro: profile.intro } : null,
      connected: true,
      sockets: new Set(),
      score: Number.isFinite(startScore) ? startScore : 0,
      roundGain: 0,
      pointsByRound: {},
      streak: 0,
      titles: [],
      badges: [],
      mods: {},
      outsider: false,
      late: this.phase !== 'lobby',
      stats: {},
      joinedAt: Date.now(),
    };
    this.players.push(p);
    if (this.round) this.round.onPlayerJoin(p);
    if (this.phase !== 'lobby') this.notify(`👋 ${p.name} rejoint la partie en cours (score de départ : ${U.fmt(p.score)}).`);
    else if (profile && profile.intro) this.notify(`🎙️ ${p.name}, ${profile.titre} ! ${profile.intro}`);
    else this.notify(U.fillTemplate(U.pick(this.content.textes.entrees || ['🎙️ {joueur} rejoint la partie !']), [p.name]));
    return { player: p, rejoined: false };
  }

  setConnected(p, connected) {
    const was = p.connected;
    p.connected = connected;
    if (was && !connected && this.round) {
      this.round.onPlayerLeave(p);
      this.checkRoundDone();
    }
  }

  kick(pid) {
    const p = this.getPlayer(pid);
    if (!p) return;
    p.kicked = true;
    p.connected = false;
    for (const s of p.sockets) {
      s.emit('kicked');
      s.disconnect(true);
    }
    if (this.round) { this.round.onPlayerLeave(p); this.checkRoundDone(); }
  }

  ranking() {
    return this.activePlayers().slice().sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  }

  rankOf(pid, list) {
    const r = list || this.ranking();
    const idx = r.findIndex((p) => p.id === pid);
    if (idx < 0) return null;
    let rank = idx;
    while (rank > 0 && r[rank - 1].score === r[idx].score) rank--;
    return rank + 1;
  }

  // ───────────────────────────── Scores ─────────────────────────────

  lengthFactor() {
    return LENGTH[this.settings.length] || 1;
  }

  roundCoef() {
    if (!this.roundMeta) return 1;
    if (this.roundMeta.id === 'encheres') return 1;
    const pos = this.roundIndex;
    const total = this.settings.rounds.length;
    const third = total / 3;
    if (pos < third) return 1;
    if (pos < 2 * third) return 1.25;
    return 1.5;
  }

  /**
   * Attribue des points en appliquant : coefficient d'épreuve, événements, prime d'outsider,
   * malus « le client appelle » (pas de bonus de rapidité), protections, etc.
   * raw = true : montant appliqué tel quel (vols, transferts, événements…).
   */
  award(p, base, opts = {}) {
    if (!p) return 0;
    let speed = opts.speed || 0;
    let total;
    if (opts.raw) {
      total = Math.round(base);
    } else {
      if (p.mods.noSpeed) speed = 0;
      total = base + speed;
      if (total > 0) {
        let m = this.roundCoef() * (this.roundMods.mult || 1) * (p.mods.mult || 1);
        if (p.outsider) m *= 1.2;
        total *= m;
      } else if (total < 0 && p.mods.noLoss) {
        total = 0;
      }
      total = Math.round(total);
    }
    p.score += total;
    p.roundGain += total;
    return total;
  }

  notify(text, opts = {}) {
    this.notifications.push({ id: U.id(), text, at: Date.now(), hostOnly: !!opts.host });
    if (this.notifications.length > 30) this.notifications.shift();
  }

  // ───────────────────────────── Minuteur ─────────────────────────────

  setTimer(sec) {
    this.timer = { end: Date.now() + sec * 1000, duration: sec * 1000, paused: false, remaining: sec * 1000 };
  }

  clearTimer() {
    this.timer = null;
  }

  togglePause() {
    if (!this.timer) return;
    if (this.timer.paused) {
      this.timer.end = Date.now() + this.timer.remaining;
      this.timer.paused = false;
    } else {
      this.timer.remaining = Math.max(0, this.timer.end - Date.now());
      this.timer.paused = true;
    }
  }

  timerView() {
    if (!this.timer) return null;
    const remaining = this.timer.paused ? this.timer.remaining : Math.max(0, this.timer.end - Date.now());
    // Les minuteurs « longs » (600 s) servent juste d'attente du MC : on ne les affiche pas.
    if (this.timer.duration >= 300000) return null;
    return { remaining, duration: this.timer.duration, paused: this.timer.paused };
  }

  tick(now) {
    if (!this.timer || this.timer.paused || now < this.timer.end) return;
    this.timer = null;
    try {
      if (this.phase === 'play' && this.round) {
        this.round.onTimeout();
        this.checkRoundDone();
      } else if (this.phase === 'event') {
        if (this.event && this.event.stage === 'interactive') Events.force(this);
        else if (this.settings.autoNext) this.enterRoundIntro();
      } else if (this.phase === 'roundIntro' && this.settings.autoNext) {
        this.startPlay();
      } else if (this.phase === 'roundEnd' && this.settings.autoNext) {
        this.afterRound();
      }
    } catch (err) {
      console.error(`[${this.code}] erreur minuteur`, err);
    }
    this.broadcast();
  }

  // ───────────────────────────── Déroulé ─────────────────────────────

  start(settings = {}) {
    if (this.phase !== 'lobby') return;
    if (this.activePlayers().length < 1) return;
    this.applySettings(settings);
    this.content = C.all();
    this.roundIndex = -1;
    this.enterRoundIntro();
  }

  applySettings(s) {
    if (Array.isArray(s.rounds)) {
      const rounds = s.rounds.filter((id) => ROUNDS[id]);
      if (rounds.length) this.settings.rounds = rounds;
    }
    if (LENGTH[s.length]) this.settings.length = s.length;
    if (typeof s.events === 'boolean') this.settings.events = s.events;
    if (typeof s.teams === 'boolean') this.settings.teams = s.teams;
    if (typeof s.autoNext === 'boolean') this.settings.autoNext = s.autoNext;
  }

  enterRoundIntro() {
    this.roundIndex++;
    const id = this.settings.rounds[this.roundIndex];
    this.roundMeta = { ...meta(id), index: this.roundIndex, coef: 0 };
    this.roundMeta.coef = this.roundCoef();
    this.round = null;
    this.event = null;
    const ranking = this.ranking();
    // Modificateurs issus des événements
    this.roundMods = { ...this.pendingMods.global };
    for (const p of this.activePlayers()) {
      p.mods = { ...(this.pendingMods.players[p.id] || {}) };
      p.roundGain = 0;
      p.prevScore = p.score;
      p.prevRank = this.rankOf(p.id, ranking);
      p.outsider = false;
    }
    this.pendingMods = { global: {}, players: {} };
    // 🚀 Prime d'outsider : le tiers du bas gagne +20 % sur ses gains (à partir de la 2e épreuve)
    if (this.roundIndex > 0 && ranking.length >= 4) {
      const cut = Math.floor(ranking.length / 3);
      ranking.slice(-cut).forEach((p) => { p.outsider = true; });
    }
    // 🔀 Mercato : nouvelles équipes à chaque épreuve
    this.teams = null;
    const active = this.activePlayers();
    if (this.settings.teams && active.length >= 4 && id !== 'encheres') {
      this.teams = composeTeams(active, this.pairCounts, this.teamMemory);
    }
    this.phase = 'roundIntro';
    if (this.settings.autoNext) this.setTimer(15); else this.clearTimer();
  }

  startPlay() {
    if (this.phase !== 'roundIntro') return;
    const def = ROUNDS[this.roundMeta.id];
    this.round = new def.Class(this, this.roundMeta);
    this.phase = 'play';
    this.clearTimer();
    this.round.start();
    this.checkRoundDone();
  }

  checkRoundDone() {
    if (this.phase === 'play' && this.round && this.round.done) this.endRound();
  }

  endRound() {
    const g = this;
    const id = this.roundMeta.id;
    this.clearTimer();
    const active = this.activePlayers();
    // Bonus d'équipe : la meilleure moyenne de l'épreuve
    let teamResult = null;
    if (this.teams) {
      const perf = this.teams.map((t) => {
        const members = t.members.map((m) => this.getPlayer(m)).filter(Boolean);
        const total = members.reduce((s, p) => s + p.roundGain, 0);
        return { team: t, members, total, avg: members.length ? total / members.length : 0 };
      });
      perf.sort((a, b) => b.avg - a.avg);
      const best = perf[0];
      if (best && best.members.length && (perf.length < 2 || best.avg > perf[1].avg)) {
        const bonus = 50;
        best.members.forEach((p) => g.award(p, bonus, {}));
        teamResult = { winner: best.team, avg: Math.round(best.avg), bonus: Math.round(bonus * this.roundCoef() * (this.roundMods.mult || 1)), perf: perf.map((x) => ({ id: x.team.id, name: x.team.name, color: x.team.color, hex: x.team.hex, emoji: x.team.emoji, avg: Math.round(x.avg), members: x.members.map((m) => m.id) })) };
      }
      perf.forEach((x) => this.teamRecords.push({ round: this.roundMeta.name, emoji: this.roundMeta.emoji, name: x.team.name, color: x.team.color, hex: x.team.hex, members: x.members.map((m) => m.id), avg: x.avg, total: x.total }));
      for (const p of active) {
        const t = this.teams.find((x) => x.members.includes(p.id));
        if (t) {
          p.stats.teams = p.stats.teams || [];
          p.stats.teams.push({ name: t.name, color: t.color, mates: t.members.filter((m) => m !== p.id), gain: p.roundGain, won: !!(teamResult && teamResult.winner.id === t.id) });
        }
      }
    }
    // Statistiques d'épreuve
    const byGain = active.slice().sort((a, b) => b.roundGain - a.roundGain);
    for (const p of active) {
      p.pointsByRound[id] = (p.pointsByRound[id] || 0) + p.roundGain;
    }
    const best = byGain[0];
    const worst = byGain[byGain.length - 1];
    if (best) best.stats.roundWins = (best.stats.roundWins || 0) + 1;
    byGain.slice(0, 3).forEach((p) => { p.stats.roundPodiums = (p.stats.roundPodiums || 0) + 1; });
    if (worst && byGain.length >= 3) worst.stats.boulets = (worst.stats.boulets || 0) + 1;
    const ranking = this.ranking();
    for (const p of active) {
      p.rank = this.rankOf(p.id, ranking);
      const climb = (p.prevRank || p.rank) - p.rank;
      p.stats.bestClimb = Math.max(p.stats.bestClimb || 0, climb);
      p.stats.rankHistory = p.stats.rankHistory || [];
      p.stats.rankHistory.push(p.rank);
      p.stats.scoreHistory = p.stats.scoreHistory || [];
      p.stats.scoreHistory.push(p.score);
    }
    const T = this.content.textes;
    this.history.push({
      roundId: id,
      name: this.roundMeta.name,
      emoji: this.roundMeta.emoji,
      best: best ? { id: best.id, gain: best.roundGain, quip: U.pick(T.joueurDeLaManche) } : null,
      worst: worst && byGain.length >= 3 ? { id: worst.id, gain: worst.roundGain, quip: U.pick(T.bouletDeLaManche) } : null,
      team: teamResult,
      gains: Object.fromEntries(active.map((p) => [p.id, p.roundGain])),
    });
    this.phase = 'roundEnd';
    this.round = null;
    if (this.settings.autoNext) this.setTimer(14); else this.clearTimer();
  }

  afterRound() {
    if (this.phase !== 'roundEnd') return;
    const isLast = this.roundIndex >= this.settings.rounds.length - 1;
    if (isLast) return this.enterFinal();
    this.eventsSinceLast++;
    const chance = this.eventsSinceLast >= 2 ? 1 : 0.5;
    if (this.settings.events && this.activePlayers().length >= 2 && Math.random() < chance) {
      this.eventsSinceLast = 0;
      return this.enterEvent();
    }
    return this.enterRoundIntro();
  }

  enterEvent(forced) {
    this.phase = 'event';
    this.clearTimer();
    Events.start(this, forced);
    if (!this.timer && this.settings.autoNext) this.setTimer(12);
  }

  enterFinal() {
    this.phase = 'final';
    this.clearTimer();
    this.round = null;
    this.teams = null;
    this.final = Awards.compute(this);
    try {
      History.record(this);
    } catch (err) {
      console.error('Historique non sauvegardé', err.message);
    }
  }

  next() {
    this.lastActivity = Date.now();
    switch (this.phase) {
      case 'lobby': return this.start();
      case 'roundIntro': return this.startPlay();
      case 'play':
        this.round.next();
        return this.checkRoundDone();
      case 'roundEnd': return this.afterRound();
      case 'event':
        if (this.event && this.event.stage === 'interactive') return Events.force(this);
        return this.enterRoundIntro();
      default: return undefined;
    }
  }

  // Le MC passe directement à la fin de l'épreuve en cours
  skipRound() {
    if (this.phase === 'play' && this.round) {
      if (this.round.constructor.name === 'EncheresRound' && this.round.stage !== 'final') {
        this.round.finish();
      }
      this.round.done = true;
      this.endRound();
    } else if (this.phase === 'roundIntro') {
      this.startPlay();
      if (this.round) { this.round.done = true; this.endRound(); }
    }
  }

  rematch() {
    for (const p of this.players) {
      p.score = 0; p.roundGain = 0; p.pointsByRound = {}; p.streak = 0; p.titles = []; p.badges = [];
      p.mods = {}; p.outsider = false; p.stats = {}; p.late = false; p.prevRank = null; p.prevScore = 0;
    }
    this.players = this.players.filter((p) => !p.kicked);
    Object.assign(this, {
      phase: 'lobby', roundIndex: -1, round: null, roundMeta: null, teams: null, teamMemory: {}, pairCounts: {},
      timer: null, event: null, usedEvents: new Set(), pendingMods: { global: {}, players: {} }, roundMods: {},
      history: [], teamRecords: [], final: null, eventsSinceLast: 0,
    });
    this.notify('🔁 Revanche ! Tous les compteurs sont remis à zéro.');
  }

  playerAction(p, msg) {
    this.lastActivity = Date.now();
    if (!msg || typeof msg !== 'object') return false;
    if (this.phase === 'play' && this.round) {
      const changed = this.round.action(p, msg);
      this.checkRoundDone();
      return changed;
    }
    if (this.phase === 'event') return Events.action(this, p, msg);
    if (this.phase === 'lobby' && msg.type === 'avatar') {
      p.avatar = String(msg.avatar || '').slice(0, 8) || p.avatar;
      return true;
    }
    return false;
  }

  hostAction(msg) {
    this.lastActivity = Date.now();
    switch (msg.type) {
      case 'start': this.start(msg.settings || {}); break;
      case 'settings': if (this.phase === 'lobby') this.applySettings(msg.settings || {}); break;
      case 'autoNext': this.settings.autoNext = !!msg.value; break;
      case 'next': this.next(); break;
      case 'skipRound': this.skipRound(); break;
      case 'pause': this.togglePause(); break;
      case 'kick': this.kick(msg.pid); break;
      case 'adjust': {
        const p = this.getPlayer(msg.pid);
        const d = Math.round(Number(msg.delta));
        if (p && Number.isFinite(d) && Math.abs(d) <= 1000) {
          this.award(p, d, { raw: true, reason: 'Décision du MC' });
          this.notify(`⚖️ Décision du MC : ${d > 0 ? '+' : ''}${d} pts pour ${p.name}${msg.reason ? ` (${String(msg.reason).slice(0, 60)})` : ''}`);
        }
        break;
      }
      case 'forceEvent':
        if (this.phase === 'roundEnd' && this.roundIndex < this.settings.rounds.length - 1) this.enterEvent();
        break;
      case 'end':
        if (this.phase !== 'lobby' && this.phase !== 'final') this.enterFinal();
        break;
      case 'rematch': if (this.phase === 'final') this.rematch(); break;
      default:
        if (this.phase === 'play' && this.round) {
          this.round.hostAction(msg);
          this.checkRoundDone();
        }
    }
  }

  // ───────────────────────────── Vues ─────────────────────────────

  publicPlayer(p, ranking) {
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      connected: p.connected,
      rank: this.rankOf(p.id, ranking),
      outsider: p.outsider,
      streak: p.streak,
      mods: Object.keys(p.mods || {}),
      profile: p.profile,
      late: p.late,
      titles: p.titles.slice(-3),
    };
  }

  leaderboard() {
    const ranking = this.ranking();
    // Après la 1re épreuve (tout le monde était à égalité), les « places perdues » n'ont pas de sens
    const prevScores = new Set(ranking.map((p) => p.prevScore ?? p.score));
    const flat = prevScores.size <= 1;
    return ranking.map((p) => ({
      id: p.id,
      score: p.score,
      prevScore: p.prevScore ?? p.score,
      gain: p.roundGain,
      rank: this.rankOf(p.id, ranking),
      prevRank: flat ? this.rankOf(p.id, ranking) : p.prevRank ?? this.rankOf(p.id, ranking),
    }));
  }

  view(role, player) {
    const ranking = this.ranking();
    const v = {
      code: this.code,
      role,
      phase: this.phase,
      serverNow: Date.now(),
      players: ranking.map((p) => this.publicPlayer(p, ranking)),
      roundIndex: this.roundIndex,
      rounds: this.settings.rounds.map((id) => { const m = meta(id); return { id, emoji: m.emoji, name: m.name }; }),
      round: this.roundMeta,
      roundMods: this.roundMods,
      teams: this.teams,
      timer: this.timerView(),
      notifications: this.notifications.filter((n) => role === 'host' || !n.hostOnly).slice(-6),
      settings: { length: this.settings.length, events: this.settings.events, teams: this.settings.teams, autoNext: this.settings.autoNext, rounds: this.settings.rounds },
    };
    if (this.phase === 'play' && this.round) v.play = this.round.view(role === 'player' ? player : null, role);
    if (this.phase === 'roundEnd' || this.phase === 'event' || this.phase === 'final') {
      v.leaderboard = this.leaderboard();
      v.lastRound = this.history[this.history.length - 1] || null;
    }
    if (this.phase === 'event') v.event = Events.view(this, player);
    if (this.phase === 'final') v.final = this.final;
    if (role === 'host') {
      v.allRounds = ORDER.map((id) => { const m = meta(id); return { id, emoji: m.emoji, name: m.name }; });
    }
    if (role === 'player' && player) {
      v.me = {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        score: player.score,
        rank: this.rankOf(player.id, ranking),
        teamId: this.teams ? (this.teams.find((t) => t.members.includes(player.id)) || {}).id || null : null,
        mods: player.mods,
        outsider: player.outsider,
        streak: player.streak,
        profile: player.profile,
        roundGain: player.roundGain,
      };
    }
    return v;
  }

  broadcast() {
    if (this._broadcastScheduled) return;
    this._broadcastScheduled = true;
    setImmediate(() => {
      this._broadcastScheduled = false;
      try {
        if (this.hostSockets.size) {
          const hv = this.view('host');
          for (const s of this.hostSockets) s.emit('state', hv);
        }
        if (this.screenSockets.size) {
          const sv = this.view('screen');
          for (const s of this.screenSockets) s.emit('state', sv);
        }
        for (const p of this.players) {
          if (!p.sockets.size || p.kicked) continue;
          const pv = this.view('player', p);
          for (const s of p.sockets) s.emit('state', pv);
        }
      } catch (err) {
        console.error(`[${this.code}] erreur de diffusion`, err);
      }
    });
  }
}

module.exports = Game;
