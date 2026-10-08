'use strict';
// Registre des 10 épreuves. L'ordre par défaut est celui de la soirée.
// Pour changer les règles affichées, modifiez « rules » ci-dessous.

const { QuizRound, EstimationRound, CalculRound, GraphiqueRound, FootballRound } = require('./quizzes');
const MenteurRound = require('./menteur');
const ReactionRound = require('./reaction');
const MotRound = require('./mot');
const BluffRound = require('./bluff');
const EncheresRound = require('./encheres');

const ROUNDS = {
  quiz: {
    Class: QuizRound, emoji: '🧠', name: 'Quiz Culture G', short: 'Quiz',
    tagline: 'Du très facile à l’extrême. Et quelques questions sur vous…',
    rules: [
      'QCM chronométrés : répondez sur votre écran.',
      'Plus la question est difficile, plus elle rapporte. Bonus de rapidité.',
      '🔥 3 bonnes réponses d’affilée = bonus de série.',
      'Questions « Qui est le plus susceptible… » : votez avec la majorité pour marquer.',
      'Questions « Miroir » : devinez ce qu’un collègue a répondu sur lui-même.',
    ],
  },
  estimation: {
    Class: EstimationRound, emoji: '🔢', name: 'Estimation Impossible', short: 'Estimation',
    tagline: 'Personne ne connaît la réponse. Le plus proche gagne quand même.',
    rules: [
      'Donnez un nombre. Le classement se fait par proximité (en ordre de grandeur).',
      '🎯 À moins de 10 % : gros bonus.',
      '💀 La pire estimation de la question prend un malus.',
      '🎲 Option « Pari ×2 » : dans le tiers de tête, points doublés ; sinon −50.',
      'Astuce : « 3,5M », « 12k » ou « 2 milliards » sont acceptés.',
    ],
  },
  menteur: {
    Class: MenteurRound, emoji: '🕵️', name: 'Trouver le Menteur', short: 'Menteur',
    tagline: 'Rôles secrets, plaidoiries et mauvaise foi assumée.',
    rules: [
      'Chacun reçoit une affirmation (publique) et un rôle secret.',
      '😇 Innocent : dit la vérité · 😈 Menteur : ment · 🤡 Double menteur : dit vrai mais doit paraître louche · 🧠 Manipulateur : ment et fait accuser un innocent.',
      'Chacun plaide à l’oral à tour de rôle (micro ouvert !).',
      'Votez « Vérité » ou « Mensonge » pour chaque collègue.',
      'Points pour chaque mensonge détecté… et pour chaque collègue berné.',
    ],
  },
  reaction: {
    Class: ReactionRound, emoji: '⚡', name: 'Réaction Rapide', short: 'Réaction',
    tagline: 'Mini-jeux éclair. Les réflexes d’un auditeur un 30 avril à 23h.',
    rules: [
      'Une série de mini-jeux de quelques secondes : réflexe, intrus, mémoire, saisie, couleurs, écarts…',
      'Le plus rapide avec la bonne réponse marque le plus.',
      '🟥 Cliquer avant le signal = faux départ = pénalité.',
    ],
  },
  calcul: {
    Class: CalculRound, emoji: '🧮', name: 'Calcul Mental', short: 'Calcul',
    tagline: 'TVA, marges, EBITDA… et quelques pièges bien vicieux.',
    rules: [
      'Calculs, ratios, logique comptable : QCM ou réponse chiffrée.',
      'Sans calculatrice. Sans Excel. Sans RECHERCHEV. Sur l’honneur.',
      'Bonus de rapidité. Certaines questions sont des pièges : lisez bien.',
    ],
  },
  graphique: {
    Class: GraphiqueRound, emoji: '📊', name: 'Analyse de Graphique', short: 'Graphique',
    tagline: 'Trouvez l’anomalie avant la revue de l’associé.',
    rules: [
      'Un graphique, une question : anomalie, tendance, année suspecte, meilleure conclusion…',
      'Certaines anomalies sautent aux yeux. D’autres beaucoup moins.',
      'L’équipe avec la meilleure moyenne empoche un bonus.',
    ],
  },
  mot: {
    Class: MotRound, emoji: '📝', name: 'Deviner un Mot', short: 'Mot',
    tagline: 'Faites deviner « Circularisation » sans dire « banque ». Bonne chance.',
    rules: [
      'À tour de rôle, un orateur fait deviner un maximum de mots à son équipe, à l’oral.',
      'Les mots interdits sont… interdits. Le MC peut sortir le 🟥 carton rouge.',
      'Ses coéquipiers tapent leurs propositions sur leur écran.',
      '🦹 Les adversaires peuvent aussi taper : s’ils trouvent avant, ils VOLENT les points.',
      'L’orateur peut passer un mot (−10).',
    ],
  },
  bluff: {
    Class: BluffRound, emoji: '🎭', name: 'Bluff', short: 'Bluff',
    tagline: 'Alliances temporaires. Trahisons définitives.',
    rules: [
      'Une question improbable. Chacun reçoit une carte secrète (info ou pouvoir).',
      '🔑 Initié, 🃏 Éliminateur, 🎭 Imposteur, 👀 Espion, ✖️ Quitte ou double, 💰 Voleur, 🚫 Saboteur, 🛡️ Bouclier, 🤝 Pacte.',
      'Discussion libre à l’oral : dites la vérité… ou pas.',
      'Puis chacun vote et utilise son pouvoir. Résolution spectaculaire.',
    ],
  },
  football: {
    Class: FootballRound, emoji: '⚽', name: 'Quiz Football', short: 'Football',
    tagline: 'Ligue 1, Ligue des Champions, Coupe du Monde… et vos pronostics.',
    rules: [
      'QCM, vrai/faux, parcours mystère, estimation, classement à remettre dans l’ordre.',
      'Bonus de rapidité et de série, comme au quiz.',
      'Une question sur l’équipe s’est glissée dans le vestiaire.',
    ],
  },
  encheres: {
    Class: EncheresRound, emoji: '💰', name: 'Les Enchères', short: 'Enchères',
    tagline: 'La dernière épreuve. Celle où tout peut basculer.',
    rules: [
      'Chacun reçoit des Audit Coins 🪙 : plus vous êtes mal classé, plus vous en recevez.',
      'Enchères secrètes : le plus offrant remporte le lot (égalité = avantage au moins bien classé).',
      '🎤 Droit de réponse : juste = mise + 100 pts, faux = −50 % de la mise.',
      'Autres lots : ✖️2, 🔎 indice, 🦹 vol, ⛔ blocage, ♻️ épreuve doublée, 📦 mystère.',
      'Les coins non dépensés sont convertis en points à 20 %.',
    ],
  },
};

const ORDER = ['quiz', 'estimation', 'menteur', 'reaction', 'calcul', 'graphique', 'mot', 'bluff', 'football', 'encheres'];

function meta(id) {
  const r = ROUNDS[id];
  if (!r) return null;
  const { Class, ...rest } = r;
  return { id, ...rest };
}

module.exports = { ROUNDS, ORDER, meta };
