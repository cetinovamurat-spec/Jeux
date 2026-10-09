// 👥 L'ÉQUIPE — LE TROMBINOSCOPE DU JEU
// ─────────────────────────────────────────────────────────────────────────────
// Rempli à partir du trombinoscope de l'équipe (grades : associés → alternants).
//
// À quoi ça sert :
//  • Reconnaissance des joueurs : un collègue qui rejoint avec « Prénom », « Prénom Nom »,
//    « Prénom N. » ou un alias récupère son avatar, son titre, son grade et son annonce d'entrée.
//    Homonymes (ex. deux « Emma ») : il faut ajouter l'initiale du nom (« Emma B. », « Emma M. »).
//  • Questions « Trombinoscope » générées automatiquement (noms, grades, initiales).
//  • Cartes « Fais deviner un collègue » dans l'épreuve Deviner un mot (désactivables ci-dessous).
//  • Équipes : le mercato évite de mettre les associés/managers ensemble et mélange les grades.
//  • Événements par grade (« pyramide inversée »…) et classement « Choc des générations » en finale.
//
// grade : 'associes' | 'managers' | 'seniors' | 'assistants-confirmes' | 'assistants-juniors' | 'alternants'
// nomIncomplet : true -> le nom n'est pas utilisé dans les questions (à compléter si besoin).
//
// ⚠️ Les titres et annonces portent sur le GRADE et le métier, jamais sur la personne :
// taquin, jamais blessant. Ajustez librement (vos surnoms, vos private jokes…).
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  cabinet: {
    nom: 'Le Cabinet',
    evenement: 'Audit Games',
  },

  // false = pas de cartes « Fais deviner un collègue » dans l'épreuve Deviner un mot
  cartesCollegues: true,

  membres: [
    // ───── ASSOCIÉS ─────
    { prenom: 'Hélène', nom: 'Kermorgant', grade: 'associes', alias: [], emoji: '🖋️', titre: 'La signature qui fait foi', intro: 'Mesdames et messieurs, levez-vous pour la signature qui fait foi : Hélène entre dans l’arène, et chaque rapport de certification retient son souffle !' },
    { prenom: 'Jean', nom: 'Rigon', grade: 'associes', alias: [], emoji: '📜', titre: 'Le sceau du rapport final', intro: 'Tribunes debout pour l’ultime point de revue : Jean fait son entrée, et aucune opinion ne quitte le cabinet sans ce sceau légendaire !' },

    // ───── MANAGERS ─────
    { prenom: 'Ranjing', nom: 'Wang', grade: 'managers', alias: [], emoji: '🧭', titre: 'La boussole des plannings de mission', intro: 'Place à la boussole des plannings : Ranjing entre sur le terrain, et soudain chaque mission trouve son cap, son budget et son calendrier !' },
    { prenom: 'Nicolas', nom: 'Limon', grade: 'managers', alias: [], emoji: '🎼', titre: 'Le métronome des clôtures', intro: 'Accueillez le métronome des clôtures : avec Nicolas à la baguette, les arrêtés des comptes tombent pile dans les temps, relances comprises !' },
    { prenom: 'Daniel', nom: 'Mouthe', grade: 'managers', alias: [], emoji: '🛫', titre: 'La tour de contrôle du staffing', intro: 'Attention, décollage imminent : Daniel entre en piste, la tour de contrôle qui fait atterrir chaque mission et chaque feuille de temps à l’heure !' },
    { prenom: 'Thibault', nom: 'Joliva', grade: 'managers', alias: [], emoji: '📡', titre: 'Le radar à écarts significatifs', intro: 'Silence dans le stade : Thibault arrive, et le moindre écart au-dessus du seuil de signification n’a plus aucune chance de passer inaperçu !' },

    // ───── SÉNIORS ─────
    { prenom: 'Laura', nom: 'Bonazzi', grade: 'seniors', alias: [], emoji: '📊', titre: 'La référence Excel du terrain', intro: 'Clavier en feu, tableaux croisés dynamiques en formation : voici Laura, la référence Excel qui transforme un grand livre brut en feuille maîtresse impeccable !' },
    { prenom: 'Djega Leila', nom: 'Vagba', grade: 'seniors', alias: ['Djega', 'Leila'], emoji: '🛡️', titre: 'Le bouclier des points de revue', intro: 'Sur la ligne de front des dossiers, Djega Leila entre en jeu : le bouclier qui répond aux points de revue plus vite que son ombre !' },
    { prenom: 'Murat', nom: 'Cetinova', grade: 'seniors', alias: ['MC'], emoji: '🎤', titre: 'Le maître de cérémonie des Olympiades', intro: 'Mesdames et messieurs, faites du bruit pour le maître de cérémonie : Murat, senior aux commandes, lance ces Olympiades avec la rigueur d’une revue analytique !' },

    // ───── ASSISTANTS CONFIRMÉS ─────
    { prenom: 'Emma', nom: 'Biannic', grade: 'assistants-confirmes', alias: [], emoji: '🧮', titre: 'L’as des rapprochements bancaires', intro: 'Entrée fracassante pour l’as des rapprochements bancaires : avec Emma sur le terrain, chaque relevé trouve son écriture et chaque suspens disparaît !' },
    { prenom: 'Karine', nom: 'Haddad', grade: 'assistants-confirmes', alias: [], emoji: '🚀', titre: 'La fusée des circularisations', intro: 'Compte à rebours lancé : Karine décolle avec une pile de circularisations, et les réponses des banques reviennent avant même la relance numéro deux !' },
    { prenom: 'Lucy', nom: 'Macias', grade: 'assistants-confirmes', alias: [], emoji: '🧰', titre: 'Le couteau suisse de la mission', intro: 'Stocks, immobilisations, fournisseurs, rien ne résiste : accueillez Lucy, le couteau suisse qui ouvre chaque cycle d’audit sans jamais perdre une lame !' },
    { prenom: 'Valentin', nom: 'Andre', grade: 'assistants-confirmes', alias: [], emoji: '💾', titre: 'La mémoire vive du dossier permanent', intro: 'Statuts, PV d’AG, contrats-cadres : Valentin entre dans l’arène, la mémoire vive du dossier permanent qui retrouve n’importe quelle pièce en trois clics !' },
    { prenom: 'Romane', nom: 'Bourrelier', grade: 'assistants-confirmes', alias: [], emoji: '⚙️', titre: 'La mécanique de précision des tests', intro: 'Chronomètre en main : Romane enchaîne les tests de procédures comme des tours de piste, échantillon après échantillon, sans jamais caler !' },
    { prenom: 'Alphonse', nom: 'Mouende Mou', nomIncomplet: true, grade: 'assistants-confirmes', alias: [], emoji: '🧱', titre: 'Le pilier des cycles de travail', intro: 'Le bilan est équilibré, la défense aussi : Alphonse entre en jeu, le pilier sur lequel repose chaque cycle quand la busy season fait trembler les murs !' },  // ✏️ nom tronqué sur la capture : à compléter

    // ───── ASSISTANTS JUNIORS ─────
    { prenom: 'Martin', nom: 'Jourdan', grade: 'assistants-juniors', alias: [], emoji: '⚽', titre: 'L’espoir du centre de formation', intro: 'Direction la pelouse pour l’espoir du centre de formation : Martin attaque chaque cycle de trésorerie avec l’énergie d’un match de coupe !' },
    { prenom: 'Lucas', nom: 'Ravelontsoa', grade: 'assistants-juniors', alias: [], emoji: '🖍️', titre: 'Le turbo des tickmarks', intro: 'Les surligneurs chauffent, les tickmarks aussi : Lucas entre sur le terrain et pointe les factures à une cadence digne d’une finale olympique !' },
    { prenom: 'Emma', nom: 'Marchand', grade: 'assistants-juniors', alias: [], emoji: '💎', titre: 'La pépite du pointage', intro: 'Place à la pépite du pointage : Emma débarque avec un échantillon, une règle et la ferme intention de cocher chaque ligne du grand livre !' },

    // ───── ALTERNANTS ─────
    { prenom: 'Lauryn-Carla', nom: 'Betjol', grade: 'alternants', alias: ['Lauryn', 'Lauryn Carla'], emoji: '🎓', titre: 'Le grand écart amphi-mission', intro: 'Un pied à l’école, un pied en mission, zéro répit : voici Lauryn-Carla, le grand écart permanent entre partiels et clôtures !' },
    { prenom: 'Anna', nom: 'Biondi-Bernard', grade: 'alternants', alias: [], emoji: '🃏', titre: 'Le joker venu de l’école', intro: 'Coup de théâtre sur le banc de touche : Anna entre comme joker, et la pile de justificatifs à classer fond comme neige au soleil !' },
    { prenom: 'Titouan', nom: 'Cadoret', grade: 'alternants', alias: [], emoji: '🌱', titre: 'La graine de commissaire aux comptes', intro: 'Le futur du métier pousse en direct : Titouan entre dans le stade, carnet en main, et absorbe les normes d’exercice professionnel comme une éponge !' },
    { prenom: 'Manuel Felipe', nom: 'Olivera Hidal', nomIncomplet: true, grade: 'alternants', alias: ['Manuel', 'Felipe'], emoji: '🎽', titre: 'Le sprint du calendrier d’alternance', intro: 'Lundi en cours, mardi en circularisation, mercredi en partiel : Manuel Felipe tient le rythme de l’alternance comme un marathon couru au sprint !' },  // ✏️ nom tronqué sur la capture : à compléter
    { prenom: 'Rachel', nom: 'Felicio', grade: 'alternants', alias: [], emoji: '⭐', titre: 'La recrue star du mercato', intro: 'Le mercato du cabinet a frappé fort : Rachel entre sur la pelouse, et le vestiaire de l’audit compte un atout de plus pour la busy season !' },
    { prenom: 'Louise', nom: 'Saiag', grade: 'alternants', alias: [], emoji: '📈', titre: 'La relève qui monte en puissance', intro: 'Échauffement terminé : Louise entre en piste, la relève qui fait grimper la courbe d’apprentissage plus vite qu’un chiffre d’affaires record !' },

    // Modèle à copier :
    // { prenom: 'Prénom', nom: 'Nom', grade: 'assistants-juniors', alias: ['surnom'], emoji: '🦊', titre: 'Titre honorifique', intro: 'Phrase d’entrée.' },
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
