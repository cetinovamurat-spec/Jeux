// 🎙️ Textes d'ambiance : noms d'équipes, punchlines, citations, résumé de fin.
// Tout est modifiable librement. Les {joueur} sont remplacés par des prénoms.

module.exports = {
  couleursEquipes: [
    { nom: 'ROUGE', hex: '#e34948', emoji: '🔴' },
    { nom: 'BLEUE', hex: '#2a78d6', emoji: '🔵' },
    { nom: 'VERTE', hex: '#1baf7a', emoji: '🟢' },
    { nom: 'JAUNE', hex: '#eda100', emoji: '🟡' },
    { nom: 'VIOLETTE', hex: '#7a5af0', emoji: '🟣' },
    { nom: 'ORANGE', hex: '#eb6834', emoji: '🟠' },
  ],

  nomsEquipes: [
    'FC Provisions', 'Real Amortissement', 'Olympique de Lettrage', 'Paris Saint-Bilan',
    'AS Clôture', 'Inter Liasse', 'Dynamo Balance Âgée', 'Sporting Cut-Off',
    'Athletic Rapprochement', 'Racing Club des Écarts', 'Borussia Dossier Permanent',
    'Juventus Justificatif', 'Ajax Annexe', 'Bayern Budget', 'Manchester Circularisation',
    'Girondins du Grand Livre', 'AC Seuil de Signification', 'Celtic Cash-Flow',
    'Benfica Bilan', 'Stade de la TVA', 'Atlético Compte d’Attente', 'Red Star Relance',
    'Olympique Lyonnais des Écritures', 'Galatasaray Goodwill', 'Spartak Stock',
    'Union Saint-Gilles des Feuilles de Temps', 'FC Points de Revue', 'Valence Valorisation',
  ],

  joueurDeLaManche: [
    'Une performance digne d’une balance qui tombe du premier coup.',
    'Même l’associé n’a trouvé aucun point de revue.',
    'Rapide, précis, lettré. Le rêve de tout manager.',
    'On parle déjà d’une promotion anticipée.',
    'Ballon d’or de la manche, catégorie « bilan certifié sans réserve ».',
    'Du jamais vu depuis la dernière clôture livrée en avance.',
    'Le genre de performance qu’on encadre dans le dossier permanent.',
    'Imprenable. Comme un client qui ne répond pas aux circularisations.',
    'Une masterclass. Les stagiaires prennent des notes.',
    'Propre comme un FEC sans écriture déséquilibrée.',
  ],

  bouletDeLaManche: [
    'L’important, c’est de participer (et de remplir sa feuille de temps).',
    'Une manche classée « immatérielle » par le comité.',
    'Le seuil de signification n’a pas été atteint. Dans le mauvais sens.',
    'On va dire que c’était une stratégie de long terme.',
    'Le client appelle : il veut récupérer ses points.',
    'Reporté en compte d’attente. On régularisera plus tard.',
    'Pas grave, la busy season forge le caractère.',
    'Même Excel aurait renvoyé #N/A.',
    'Une manche « en cours de justification ».',
    'Le comité recommande une formation continue de 120 heures.',
  ],

  citationsChampion: [
    'Une performance aussi propre qu’une feuille de travail sans anomalie.',
    'Bilan certifié sans réserve, sans observation, sans contestation possible.',
    'Comme une balance âgée sans aucune créance de plus de 90 jours : du jamais vu.',
    'Une victoire lettrée, rapprochée, justifiée. Rien à redire.',
    'Le genre de champion qui trouve l’écart de 14 € avant même d’ouvrir le fichier.',
    'Plus fiable qu’une confirmation bancaire reçue du premier coup.',
    'Une soirée bouclée plus vite qu’une clôture au 31 décembre. Respect.',
    'Seuil de signification : explosé. Concurrence : provisionnée à 100 %.',
    'Même la Haute Autorité de l’audit n’aurait rien trouvé à redire.',
    'Victoire validée en revue d’associé, sans un seul post-it.',
  ],

  resume: {
    champion: [
      '{joueur} remporte les Olympiades et repart avec le trophée, la gloire, et probablement plus de missions',
      'Au terme d’une soirée épique, {joueur} s’impose comme le patron incontesté du cabinet',
      '{joueur} décroche le titre suprême. Le dossier est clos, signé, archivé',
      'Personne n’a pu arrêter {joueur}, pas même les pièces manquantes',
    ],
    dernier: [
      '{joueur} ferme la marche avec dignité : quelqu’un devait bien tenir la lanterne rouge (et la machine à café).',
      '{joueur} termine dernier, mais rappelle à tous que l’audit est un sport d’endurance.',
      '{joueur} finit en bas du classement. Une stratégie de « sous-évaluation prudente », selon ses avocats.',
    ],
    traitre: [
      '{joueur} a trahi sans le moindre remords',
      'Méfiez-vous de {joueur} à la prochaine clôture : la confiance est rompue',
      '{joueur} a prouvé qu’un sourire en réunion ne garantit rien',
    ],
    conclusion: [
      'Rendez-vous à la prochaine édition. D’ici là : remplissez vos feuilles de temps.',
      'Fin de la soirée. Les points de revue seront traités lundi.',
      'Le comité d’organisation remercie tous les participants et rappelle que la clôture, elle, n’attend pas.',
      'Merci à tous. Aucune balance n’a été maltraitée pendant ces Olympiades.',
    ],
  },

  accroches: [
    'Pendant ce temps, la balance âgée attend toujours.',
    'Rappel : aucune pièce justificative ne sera demandée ce soir.',
    'Les feuilles de temps peuvent attendre demain. Promis.',
    'Le client n’a toujours pas renvoyé la circularisation. Mais ce soir, on s’en fiche.',
    'Ce soir, le seul écart qui compte, c’est l’écart au classement.',
    'Interdit de dire « je regarde ça » pendant les Olympiades.',
    'Tenue correcte exigée. Le bas de pyjama est toléré hors caméra.',
    'Le comité d’organisation décline toute responsabilité en cas de trahison.',
    'Toute ressemblance avec un client existant serait purement fortuite.',
    'Excel est fermé. Respirez.',
    'Le VAR sera assuré par le maître de cérémonie. Ses décisions sont définitives.',
    'Aucun budget d’heures n’a été alloué à cette soirée.',
  ],

  // Annonces façon speaker de stade quand un joueur sans profil (team.js) rejoint le lobby
  entrees: [
    '🎙️ Et voici {joueur}, qui arrive sans pièces justificatives mais avec beaucoup d’ambition !',
    '🎙️ {joueur} entre sur le terrain. Le public retient son souffle (et ses feuilles de temps).',
    '🎙️ Accueillez {joueur} ! Transfert surprise du mercato d’hiver.',
    '🎙️ {joueur} rejoint le vestiaire. Le seuil de signification vient de trembler.',
    '🎙️ Applaudissements pour {joueur}, qui a validé sa participation sans relance !',
    '🎙️ {joueur} est dans la place. Quelqu’un a vu passer une balance qui ne tombe pas ?',
    '🎙️ {joueur} débarque, café à la main. Le niveau du championnat vient de monter.',
  ],

  attente: [
    'Réponse envoyée. Comme une petite relance : maintenant, on attend.',
    'Validé. Ta réponse est partie en revue.',
    'Bien reçu. On ne touche plus à rien.',
    'Réponse transmise au comité. Croise les doigts.',
    'Écriture passée. Pas de contre-passation possible.',
  ],

  bravo: ['VALIDÉ', 'CERTIFIÉ', 'LETTRÉ', 'SANS RÉSERVE', 'JUSTIFIÉ'],
  rate: ['REFUSÉ', 'À JUSTIFIER', 'ÉCART', 'NON CONFORME', 'POINT DE REVUE'],
};
