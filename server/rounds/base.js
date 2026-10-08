'use strict';
// Classe de base de toutes les épreuves.
// Une épreuve reçoit le jeu (game) et pilote ses propres étapes internes.
// Le jeu appelle : start(), next() (bouton « Suivant » du MC), onTimeout(),
// action(joueur, message), hostAction(message), view(joueur|null).
// Quand l'épreuve est terminée, elle passe this.done = true.

class BaseRound {
  constructor(game, meta) {
    this.game = game;
    this.meta = meta;
    this.done = false;
  }

  get players() {
    return this.game.activePlayers();
  }

  get connected() {
    return this.game.activePlayers().filter((p) => p.connected);
  }

  get length() {
    return this.game.lengthFactor();
  }

  count(base, min = 1) {
    return Math.max(min, Math.round(base * this.length));
  }

  start() {}
  next() { this.done = true; }
  onTimeout() {}
  action() { return false; }
  hostAction() { return false; }
  onPlayerJoin() {}
  onPlayerLeave() {}
  view() { return {}; }

  // Utilitaire : tout le monde (connecté) a-t-il répondu ?
  allAnswered(map, eligible) {
    const list = (eligible || this.connected);
    if (!list.length) return false;
    return list.every((p) => map[p.id] !== undefined);
  }
}

module.exports = BaseRound;
