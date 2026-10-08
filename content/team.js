// 👥 L'ÉQUIPE — LE FICHIER À PERSONNALISER EN PREMIER
// ─────────────────────────────────────────────────────────────────────────────
// Le jeu se personnalise de deux façons :
//
//  1. AUTOMATIQUEMENT : toutes les questions « Qui est le plus susceptible… », « Miroir »,
//     et les textes contenant {joueur} utilisent les vrais pseudos des joueurs connectés.
//     Aucune configuration nécessaire.
//
//  2. ICI : quand un joueur rejoint avec un pseudo égal à « prenom » (ou à un « alias »),
//     il récupère son avatar, son titre et sa phrase d'intro, affichés dans le lobby.
//     ✏️ Complétez/ajoutez vos collègues : surnoms, rôle, phrase d'entrée façon speaker de stade.
//
//  3. VOS PRIVATE JOKES : ajoutez vos propres questions dans « questionsPerso » en bas
//     de ce fichier. Elles sont automatiquement mélangées aux autres.
//
// Règle d'or : taquin, absurde, jamais blessant. Rien sur le physique, la vie privée,
// la santé, les salaires ou les vrais conflits.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  cabinet: {
    nom: 'Le Cabinet',
    evenement: 'Audit Games',
  },

  membres: [
    {
      prenom: 'Murat',
      alias: ['mumu', 'le mc'],
      emoji: '🎤',
      titre: 'Maître de Cérémonie & Président du Comité d’Organisation',
      role: 'Organisateur',
      intro: 'L’homme qui a monté ces Olympiades au lieu de remplir sa feuille de temps.',
    },
    // ✏️ Exemples à adapter (les prénoms viennent de ta demande, les titres sont à réécrire) :
    {
      prenom: 'Thomas',
      alias: [],
      emoji: '🧮',
      titre: 'Le Lettreur Masqué',
      role: 'À compléter',
      intro: 'Il paraît qu’il lettre plus vite que son ombre. Le jury attend des preuves.',
    },
    {
      prenom: 'Sarah',
      alias: [],
      emoji: '🕵️',
      titre: 'La Détectrice d’Écarts',
      role: 'À compléter',
      intro: 'Un écart de 14 € dans une balance de 20 M€ ? Elle l’a déjà trouvé.',
    },
    {
      prenom: 'Julien',
      alias: [],
      emoji: '⚽',
      titre: 'Le Stratège du Vestiaire',
      role: 'À compléter',
      intro: 'Annonce toujours un plan de jeu. Ne le suit jamais.',
    },
    // Modèle à copier :
    // { prenom: 'Prénom', alias: ['surnom'], emoji: '🦊', titre: 'Titre honorifique', role: 'Senior', intro: 'Phrase d’entrée.' },
  ],

  // 🎯 Vos questions maison (même format que les fichiers du dossier content/)
  // Exemples commentés : décommentez et adaptez.
  questionsPerso: {
    quiz: [
      // { q: 'Quel client nous a déjà envoyé son FEC… en PDF ?', choix: ['Bonne réponse', 'Faux 1', 'Faux 2', 'Faux 3'], d: 2, cat: 'Private joke' },
    ],
    votes: [
      // { type: 'vote', q: 'Qui a déjà ... ?', titre: 'Titre décerné à l’élu' },
    ],
    miroirs: [
      // { type: 'miroir', q: 'Que fait {cible} quand ... ?', choix: ['A', 'B', 'C', 'D'] },
    ],
    estimations: [
      // { q: 'Combien de ... ?', reponse: 1234, unite: '', cat: 'Cabinet', info: '' },
    ],
    mots: [
      // { mot: 'Nom de notre client mythique', interdits: ['...', '...'], cat: 'Cabinet' },
    ],
    menteur: [
      // { texte: 'J’ai déjà ...' },
    ],
  },
};
