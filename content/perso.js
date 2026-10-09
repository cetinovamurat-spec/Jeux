// 👥 QUESTIONS « ÉQUIPE » — elles utilisent automatiquement les joueurs connectés.
//
// VOTE (« Qui est le plus susceptible… ») : { type: 'vote', q, titre }
//   → chacun vote pour un collègue ; ceux qui votent comme la majorité marquent.
//   → l'élu(e) reçoit le « titre » honorifique (affiché dans le bilan de fin).
//
// MIROIR : { type: 'miroir', q (avec {cible}), choix: [4 réponses] }
//   → {cible} répond pour lui/elle-même, les autres doivent deviner sa réponse.
//
// Ton : taquin, jamais blessant. Ajoutez vos private jokes dans team.js > questionsPerso.

module.exports = {
  votes: [
    { type: 'vote', q: 'Qui dans l’équipe est le plus susceptible de terminer une mission à 23h59 le dernier jour ?', titre: 'Deadline à 23h59' },
    { type: 'vote', q: 'Qui serait le plus dangereux comme associé dans une partie de bluff ?', titre: 'Joueur de poker redouté' },
    { type: 'vote', q: 'Quel membre de l’équipe serait capable de détecter une anomalie de 14 € dans une balance de 20 M€ ?', titre: 'Détecteur d’écarts de 14 €' },
    { type: 'vote', q: 'Qui a le plus de chances d’avoir 40 fichiers Excel ouverts en ce moment même ?', titre: 'Collectionneur d’onglets' },
    { type: 'vote', q: 'Qui survivrait le plus longtemps à un inventaire physique dans une chambre froide ?', titre: 'Inventoriste polaire' },
    { type: 'vote', q: 'Qui est le plus susceptible de répondre à un mail client un dimanche à 22h ?', titre: 'Toujours connecté(e)' },
    { type: 'vote', q: 'Qui serait le meilleur pour obtenir des pièces d’un client qui n’a encore rien envoyé ?', titre: 'Négociateur d’élite' },
    { type: 'vote', q: 'Qui est le plus susceptible d’arriver avec des croissants sans raison particulière ?', titre: 'Ministre des Viennoiseries' },
    { type: 'vote', q: 'Qui a le plus de chances de se perdre dans les locaux d’un nouveau client ?', titre: 'GPS en option' },
    { type: 'vote', q: 'Qui ferait le meilleur commentateur sportif d’une clôture annuelle ?', titre: 'Voix officielle de la clôture' },
    { type: 'vote', q: 'Qui est le plus susceptible de nommer un fichier « VF_def_FINAL_v7 » ?', titre: 'Maître du versioning' },
    { type: 'vote', q: 'Qui gagnerait un concours de vitesse de lettrage ?', titre: 'Lettreur le plus rapide de l’Ouest' },
    { type: 'vote', q: 'Qui ferait le meilleur espion infiltré chez un client ?', titre: 'Agent double' },
    { type: 'vote', q: 'Qui est le plus susceptible d’oublier de couper son micro en réunion ?', titre: 'Micro toujours ouvert' },
    { type: 'vote', q: 'Qui mérite le titre de « Roi ou Reine de la machine à café » ?', titre: 'Souverain(e) de la machine à café' },
    { type: 'vote', q: 'Qui a le plus de chances de transformer un « point rapide » en réunion de deux heures ?', titre: 'Spécialiste du point rapide' },
    { type: 'vote', q: 'Qui est le plus susceptible de trouver un bug dans ce jeu ?', titre: 'Auditeur du jeu' },
    { type: 'vote', q: 'Si le cabinet était une équipe de foot, qui en serait le capitaine ?', titre: 'Capitaine du cabinet' },
    { type: 'vote', q: 'Qui resterait le plus calme pendant un contrôle du régulateur ?', titre: 'Sang-froid certifié' },
    { type: 'vote', q: 'Qui est le plus susceptible d’organiser ses vacances dans un tableau croisé dynamique ?', titre: 'TCD de vacances' },
    { type: 'vote', q: 'Qui gagnerait un débat contre un dirigeant persuadé que « cette provision n’est pas nécessaire » ?', titre: 'Avocat de la prudence' },
    { type: 'vote', q: 'Qui enverrait le plus de « petites relances » en une seule journée ?', titre: 'Champion(ne) de la relance' },
    { type: 'vote', q: 'Qui serait le premier à trouver la machine à café chez un nouveau client ?', titre: 'Radar à café' },
    { type: 'vote', q: 'Qui est le plus susceptible de dire « c’est immatériel » avec un sourire désarmant ?', titre: 'Maître de l’immatériel' },
    { type: 'vote', q: 'À qui confieriez-vous le dossier le plus pourri de l’année ?', titre: 'Démineur officiel' },

    // ───── Spécial hiérarchie du cabinet ─────
    { type: 'vote', q: 'Qui est le plus susceptible de commenter une clôture comme un multiplex de Ligue 1 ?', titre: 'Voix du multiplex' },
    { type: 'vote', q: 'Qui oserait tutoyer l’associé signataire dès le premier jour de mission ?', titre: 'Audace de premier jour' },
    { type: 'vote', q: 'Qui est le plus susceptible de solder 40 points de revue avant la pause déjeuner ?', titre: 'Machine à solder les points de revue' },
    { type: 'vote', q: 'À qui confieriez-vous l’accueil de la prochaine promo d’alternants ?', titre: 'Guide de la nouvelle promo' },
    { type: 'vote', q: 'Qui serait le premier recours de l’équipe, tous grades confondus, pour débloquer une formule Excel à 23 h en pleine busy season ?', titre: 'Hotline Excel du cabinet' },
    { type: 'vote', q: 'Si le cabinet était une équipe de foot, qui composerait le onze de départ de la busy season ?', titre: 'Cerveau du staffing' },
    { type: 'vote', q: 'Qui garderait le plus de sérénité face à un « petit changement de planning » annoncé la veille d’un départ en mission ?', titre: 'Sérénité de haut niveau' },
    { type: 'vote', q: 'Qui saurait expliquer une circularisation à une nouvelle recrue en moins de deux minutes ?', titre: 'Pédagogie express' },
    { type: 'vote', q: 'Qui saurait assurer une réunion de clôture au pied levé si le planning déraille ?', titre: 'Relève assurée' },
    { type: 'vote', q: 'Qui est le plus susceptible de recevoir un « merci, tu m’as sauvé la clôture ! » ?', titre: 'Bouée de sauvetage de l’équipe' },
    { type: 'vote', q: 'Qui est le plus susceptible de remplir sa feuille de temps à la minute près… dès le vendredi soir ?', titre: 'Exemplarité horaire' },
    { type: 'vote', q: 'Qui obtiendrait en un seul coup de fil la réponse de circularisation d’une banque réputée injoignable ?', titre: 'Diplomatie bancaire' },
    { type: 'vote', q: 'Qui est le plus susceptible de briller devant la direction financière du client en réunion de synthèse ?', titre: 'Voix de la synthèse' },
    { type: 'vote', q: 'Qui grimpera le plus vite la pyramide… au classement de ces Olympiades ?', titre: 'Ascension express' },
  ],

  miroirs: [
    { type: 'miroir', q: 'Quelle est la probabilité que {cible} accepte une mission avec un client qui n’a encore fourni aucune pièce ?', choix: ['0 % — jamais de la vie', '25 % — sous conditions', '75 % — si on me le demande gentiment', '100 % — je dis toujours oui'] },
    { type: 'miroir', q: 'À quelle heure part, en général, le dernier mail de {cible} un soir de clôture ?', choix: ['Avant 19h', 'Entre 19h et 21h', 'Entre 21h et minuit', 'Après minuit'] },
    { type: 'miroir', q: 'Combien de fichiers Excel sont ouverts sur le PC de {cible} en pleine clôture ?', choix: ['Moins de 5', '5 à 15', '15 à 30', 'Plus de 30 (et ça rame)'] },
    { type: 'miroir', q: 'Face à un écart de 14 € dans une balance de 20 M€, {cible}…', choix: ['Cherche jusqu’à trouver, coûte que coûte', 'Cherche 10 minutes puis abandonne', 'Le classe en « immatériel » sans état d’âme', 'Délègue au stagiaire'] },
    { type: 'miroir', q: 'La boisson de survie de {cible} pendant la busy season ?', choix: ['Expresso serré', 'Café allongé', 'Thé (trahison !)', 'Boisson énergisante'] },
    { type: 'miroir', q: 'Si {cible} gagnait au loto demain matin…', choix: ['Je finis quand même ma mission (conscience pro)', 'Démission envoyée à 9h01', 'Je rachète le cabinet', 'J’achète un club de foot'] },
    { type: 'miroir', q: 'Le super-pouvoir rêvé de {cible} au bureau ?', choix: ['Lire dans les pensées des clients', 'Faire tomber une balance d’un regard', 'Ralentir le temps avant les deadlines', 'Ne plus jamais avoir de point de revue'] },
    { type: 'miroir', q: 'Quand on propose à {cible} « un petit point rapide ? », la réaction intérieure est…', choix: ['Panique totale', 'Sérénité absolue', 'Ouverture express de tous les fichiers', 'Soudaine coupure de connexion'] },
    { type: 'miroir', q: 'Combien de « petites relances » avant que {cible} décroche son téléphone ?', choix: ['Une seule', 'Deux', 'Trois à cinq', 'Je n’appelle jamais'] },
    { type: 'miroir', q: 'Le repas de {cible} un soir de clôture ?', choix: ['Pizza', 'Sushi', 'Sandwich triangle', 'Rien, j’oublie de manger'] },
    { type: 'miroir', q: 'Le lieu de travail idéal de {cible} ?', choix: ['Chez le client', 'Au cabinet', 'En télétravail', 'Dans un café au wifi douteux'] },
    { type: 'miroir', q: 'L’excuse préférée de {cible} pour un rendu en retard ?', choix: ['« Le client n’a pas envoyé les pièces »', '« Excel a planté »', '« J’attendais la validation »', '« Quel retard ? »'] },
    { type: 'miroir', q: 'Combien de temps {cible} tient-il/elle sans regarder ses mails pendant les vacances ?', choix: ['Moins d’une heure', 'Une journée', 'Une semaine', 'Toutes les vacances, sans exception'] },
    { type: 'miroir', q: 'La plus grande hantise professionnelle de {cible} ?', choix: ['Un écart inexpliqué', 'Un point de revue de l’associé', 'Un client injoignable', 'Une deadline avancée'] },
    { type: 'miroir', q: 'L’expression que {cible} prononce le plus au bureau ?', choix: ['« Du coup »', '« En vrai »', '« Je regarde ça »', '« On est bons »'] },
    { type: 'miroir', q: 'S’il ne devait rester qu’un logiciel dans la vie de {cible} ?', choix: ['Excel', 'Outlook', 'Teams', 'Word (vraiment ?)'] },
    { type: 'miroir', q: 'L’état du bureau de {cible} en ce moment ?', choix: ['Impeccable, tout est lettré', 'Quelques écritures en suspens', 'Un compte d’attente géant', 'Ne pas ouvrir : risque d’avalanche'] },
    { type: 'miroir', q: 'Le premier réflexe de {cible} quand une balance ne tombe pas ?', choix: ['Vérifier les à-nouveaux', 'Chercher un écart divisible par 9', 'Aller prendre un café', 'Appeler à l’aide'] },

    // ───── Spécial hiérarchie du cabinet ─────
    { type: 'miroir', q: 'Face à un point de revue reçu à 22 h, la réaction de {cible} ?', choix: ['Je traite tout, tout de suite', 'Je lis, je soupire, je dors', '« Bien noté », et j’attaque à 7 h', 'Je découvre ça le lendemain, en toute sérénité'] },
    { type: 'miroir', q: 'Pour {cible}, le moment le plus redouté d’une mission ?', choix: ['Le premier point d’avancement', 'La revue finale du dossier', 'La réunion de synthèse avec le client', 'Le remplissage de la feuille de temps'] },
    { type: 'miroir', q: 'Le premier réflexe de {cible} en recevant le planning de busy season ?', choix: ['Chercher mes week-ends (en vain)', 'Compter les missions en parallèle', 'Repérer les meilleures machines à café chez les clients', 'Ne pas l’ouvrir, par prudence'] },
    { type: 'miroir', q: 'Si {cible} pouvait changer de grade le temps d’une journée, ce serait…', choix: ['Côté associés : signer enfin un rapport', 'Côté managers : faire le staffing', 'Côté alternants : partir en semaine d’école en pleine clôture', 'Aucun changement, mon grade me va très bien'] },
    { type: 'miroir', q: 'Le message Teams qui déclenche l’alerte rouge chez {cible} ?', choix: ['« Tu as 5 minutes ? »', '« On peut s’appeler ? »', '« Petite question sur ton onglet »', '« Le client a renvoyé une nouvelle balance »'] },
    { type: 'miroir', q: 'Le conseil de {cible} à une nouvelle recrue pour son premier jour ?', choix: ['Nommer ses fichiers proprement', 'Repérer la machine à café avant tout', 'Toujours calculer le seuil avant de dire « non significatif »', 'Remplir sa feuille de temps chaque soir'] },
    { type: 'miroir', q: 'Pour {cible}, la meilleure stratégie face à 40 points de revue ?', choix: ['Tout traiter dans l’ordre, ligne par ligne', 'Commencer par les plus faciles, pour le moral', 'Proposer un point rapide pour en discuter', 'Répondre « fait » partout et croiser les doigts'] },
    { type: 'miroir', q: 'Le plus beau compliment professionnel pour {cible} ?', choix: ['« Dossier propre, rien à redire »', '« Merci, tu m’as sauvé la clôture »', '« Le client a adoré ta présentation »', '« Pas de point de revue cette fois »'] },
  ],

  // MIROIR CHIFFRÉ (épreuve Estimation) : { type: 'miroir-nombre', q (avec {cible}), unite }
  //   → {cible} donne SON vrai chiffre (vérification en direct encouragée !), les autres estiment.
  miroirsChiffres: [
    { type: 'miroir-nombre', q: 'Combien de mails non lus dans la boîte de réception de {cible}, là, maintenant ? (vérification en direct autorisée)', unite: 'mails' },
    { type: 'miroir-nombre', q: 'Combien de fichiers traînent sur le bureau de l’ordinateur de {cible} ?', unite: 'fichiers' },
    { type: 'miroir-nombre', q: 'Combien d’onglets sont ouverts dans le navigateur de {cible} en ce moment ?', unite: 'onglets' },
    { type: 'miroir-nombre', q: 'Combien de cafés par semaine pour {cible} (en période normale, hors busy season) ?', unite: 'cafés' },
    { type: 'miroir-nombre', q: 'Combien de réunions Teams cette semaine pour {cible} ?', unite: 'réunions' },
    { type: 'miroir-nombre', q: 'Combien de post-it sont collés autour de l’écran de {cible} ?', unite: 'post-it' },
    { type: 'miroir-nombre', q: 'Depuis combien d’années {cible} travaille dans l’audit, la compta ou la finance ?', unite: 'ans' },
    { type: 'miroir-nombre', q: 'Combien de matchs de foot {cible} a regardés le mois dernier ?', unite: 'matchs' },
    { type: 'miroir-nombre', q: 'Record personnel de {cible} : combien de versions « VF_def » d’un même fichier ?', unite: 'versions' },
    { type: 'miroir-nombre', q: 'Combien d’applications installées sur le téléphone de {cible} ?', unite: 'applis' },
    { type: 'miroir-nombre', q: 'Combien de fichiers Excel sont ouverts sur l’ordinateur de {cible} en ce moment ?', unite: 'fichiers' },
    { type: 'miroir-nombre', q: 'Combien de messages Teams non lus pour {cible} ?', unite: 'messages' },
    { type: 'miroir-nombre', q: 'Combien de clients différents pour {cible} cette année ?', unite: 'clients' },
  ],

  votesFoot: [
    { type: 'vote', q: 'Qui dans l’équipe ferait le pire arbitre vidéo (VAR) ?', titre: 'Arbitre VAR contesté' },
    { type: 'vote', q: 'Qui est le plus susceptible de crier devant une séance de tirs au but au point d’alerter les voisins ?', titre: 'Supporter décibel' },
    { type: 'vote', q: 'Qui ferait le meilleur sélectionneur de l’équipe de France ?', titre: 'Sélectionneur du cabinet' },
    { type: 'vote', q: 'Qui célébrerait un but par une glissade à genoux dans l’open space ?', titre: 'Célébration de légende' },
    { type: 'vote', q: 'Qui connaît le plus probablement la composition de France 98 par cœur ?', titre: 'Mémoire de 98' },
    { type: 'vote', q: 'Qui pourrait expliquer la règle du hors-jeu avec un tableau Excel ?', titre: 'Hors-jeu en TCD' },
  ],

  miroirsFoot: [
    { type: 'miroir', q: 'Où {cible} regarde-t-il/elle un grand match ?', choix: ['Au stade', 'Au bar avec les amis', 'Sur le canapé', 'En cachette sur le téléphone en réunion'] },
    { type: 'miroir', q: 'Si {cible} était footballeur, ce serait…', choix: ['Le numéro 10 génial', 'Le défenseur rugueux', 'Le gardien héroïque', 'Le remplaçant qui chauffe le banc avec classe'] },
    { type: 'miroir', q: 'Le pronostic de {cible} pour un France–Brésil en finale ?', choix: ['Victoire nette des Bleus', 'Victoire aux tirs au but', 'Match nul, puis on verra', 'Défaite, mais quel beau match'] },
  ],
};
