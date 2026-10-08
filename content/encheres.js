// 💰 ÉPREUVE 10 — LES ENCHÈRES
// Types de lots :
//  • question       : le plus offrant répond (juste = mise + 100 pts ; faux = −50 % de la mise).
//  • multiplicateur : ×2 sur le prochain gain en droit de réponse.
//  • indice         : voir la question du prochain lot AVANT d'enchérir.
//  • vol            : voler des points à un joueur au choix.
//  • blocage        : interdire à un joueur d'enchérir au lot suivant.
//  • doubler        : récupérer une 2e fois les points d'une épreuve passée (max 400).
//  • mystere        : contenu inconnu… (voir server/rounds/encheres.js)
// question : { q, choix: [BONNE, fausse, fausse, fausse], cat, d, info }

module.exports = [
  // ───── Droits de réponse ─────
  { type: 'question', titre: 'Le Lot de la Norme', texte: 'Une question de cabinet pure et dure.', question: { q: 'Que signifie « NEP » dans le jargon des commissaires aux comptes ?', choix: ['Norme d’Exercice Professionnel', 'Note d’Évaluation Préalable', 'Norme Européenne de Présentation', 'Nouvel Exercice Patrimonial'], cat: 'Cabinet', d: 2 } },
  { type: 'question', titre: 'Le Lot Mondial', texte: 'Retour aux origines du football.', question: { q: 'Quel pays a remporté la première Coupe du monde, en 1930 ?', choix: ['Uruguay', 'Argentine', 'Brésil', 'Italie'], cat: 'Football', d: 2 } },
  { type: 'question', titre: 'Le Lot des Steppes', texte: 'Géographie de haut vol.', question: { q: 'Quelle est la capitale de la Mongolie ?', choix: ['Oulan-Bator', 'Astana', 'Bichkek', 'Achgabat'], cat: 'Géographie', d: 3 } },
  { type: 'question', titre: 'Le Lot du Scandale', texte: 'Un grand classique des cours d’audit.', question: { q: 'Quel groupe agroalimentaire italien a été au cœur d’un énorme scandale comptable en 2003 ?', choix: ['Parmalat', 'Barilla', 'Ferrero', 'Lavazza'], cat: 'Cabinet', d: 3, info: 'Un compte bancaire fictif de près de 4 milliards d’euros…' } },
  { type: 'question', titre: 'Le Lot Calcul Mental', texte: 'Sans calculatrice. Sans Excel. Sans stagiaire.', question: { q: 'Combien font 17 × 23 ?', choix: ['391', '381', '401', '371'], cat: 'Calcul', d: 2 } },
  { type: 'question', titre: 'Le Lot Littéraire', texte: 'Pour les plumes du cabinet.', question: { q: 'Qui a écrit « L’Étranger » ?', choix: ['Albert Camus', 'Jean-Paul Sartre', 'André Malraux', 'Boris Vian'], cat: 'Littérature', d: 1 } },
  { type: 'question', titre: 'Le Lot IFRS', texte: 'Pour ceux qui ont lu les normes (personne).', question: { q: 'Quelle norme IFRS traite des contrats de location ?', choix: ['IFRS 16', 'IFRS 9', 'IFRS 15', 'IAS 38'], cat: 'Cabinet', d: 3 } },
  { type: 'question', titre: 'Le Lot 2018', texte: 'Souvenirs, souvenirs.', question: { q: 'Quel était le score de la finale France–Croatie en 2018 ?', choix: ['4-2', '3-1', '2-0', '4-1'], cat: 'Football', d: 1 } },
  { type: 'question', titre: 'Le Lot du Grand Livre', texte: 'Retour aux fondamentaux.', question: { q: 'Que représente le compte 101 du PCG ?', choix: ['Le capital', 'Les réserves', 'Le report à nouveau', 'Les emprunts'], cat: 'Cabinet', d: 2 } },
  { type: 'question', titre: 'Le Lot Cosmique', texte: 'Visez les étoiles.', question: { q: 'Quel est l’élément chimique le plus abondant dans l’univers ?', choix: ['L’hydrogène', 'L’hélium', 'L’oxygène', 'Le carbone'], cat: 'Sciences', d: 2 } },
  { type: 'question', titre: 'Le Lot de Francfort', texte: 'La politique monétaire, c’est sexy.', question: { q: 'Dans quelle ville se trouve le siège de la Banque centrale européenne ?', choix: ['Francfort', 'Bruxelles', 'Luxembourg', 'Strasbourg'], cat: 'Économie', d: 2 } },
  { type: 'question', titre: 'Le Lot du Désert', texte: 'Attention, question piège.', question: { q: 'Quel est le plus grand désert du monde ?', choix: ['L’Antarctique', 'Le Sahara', 'Le désert de Gobi', 'Le désert d’Arabie'], cat: 'Géographie', d: 3, info: 'Un désert se définit par ses précipitations, pas par sa chaleur.' } },
  { type: 'question', titre: 'Le Lot de Franklin', texte: 'Le temps, c’est de l’argent. Justement.', question: { q: 'À qui attribue-t-on la formule « Le temps, c’est de l’argent » ?', choix: ['Benjamin Franklin', 'Adam Smith', 'Karl Marx', 'Henry Ford'], cat: 'Histoire', d: 3 } },
  { type: 'question', titre: 'Le Lot Brasserie', texte: 'Pour les habitués des notes de frais.', question: { q: 'Quel taux de TVA s’applique à la restauration sur place en France ?', choix: ['10 %', '5,5 %', '20 %', '7 %'], cat: 'Cabinet', d: 2 } },
  { type: 'question', titre: 'Le Lot du Musée', texte: 'Culture générale, coefficient fort.', question: { q: 'Qui a peint « Guernica » ?', choix: ['Pablo Picasso', 'Salvador Dalí', 'Joan Miró', 'Francisco de Goya'], cat: 'Art', d: 1 } },
  { type: 'question', titre: 'Le Lot des Invincibles', texte: 'Football anglais, haut niveau.', question: { q: 'Quel entraîneur dirigeait Arsenal lors de la saison des « Invincibles » (2003-2004) ?', choix: ['Arsène Wenger', 'Alex Ferguson', 'José Mourinho', 'Rafael Benítez'], cat: 'Football', d: 2 } },
  { type: 'question', titre: 'Le Lot Enron', texte: 'Le sujet qui fâche dans tous les cabinets.', question: { q: 'Quelle loi américaine de 2002 a renforcé les contrôles comptables après les scandales Enron et WorldCom ?', choix: ['Sarbanes-Oxley', 'Dodd-Frank', 'Glass-Steagall', 'FATCA'], cat: 'Cabinet', d: 3 } },
  { type: 'question', titre: 'Le Lot de la Dernière Chance', texte: 'Facile… en théorie.', question: { q: 'Combien de jours compte une année bissextile ?', choix: ['366', '365', '364', '367'], cat: 'Culture', d: 1 } },

  // ───── Lots spéciaux ─────
  { type: 'multiplicateur', titre: 'Le Coefficient Busy Season', texte: 'Le gagnant double son prochain gain en droit de réponse.' },
  { type: 'multiplicateur', titre: 'La Prime d’Intéressement', texte: 'Tes prochains gains en droit de réponse comptent double.' },
  { type: 'indice', titre: 'Le Dossier de l’Année Dernière', texte: 'Le gagnant voit la question du prochain lot AVANT les enchères.' },
  { type: 'indice', titre: 'La Fuite de la Salle de Pause', texte: 'Quelqu’un a laissé traîner la prochaine question près de la machine à café…' },
  { type: 'vol', titre: 'Le Redressement Fiscal', texte: 'Le gagnant choisit un joueur et lui prélève des points (150 minimum).' },
  { type: 'vol', titre: 'Le Rachat Hostile', texte: 'OPA sur les points d’un adversaire de ton choix.' },
  { type: 'blocage', titre: 'L’Accès VPN Révoqué', texte: 'Le gagnant empêche un joueur d’enchérir au prochain lot.' },
  { type: 'blocage', titre: 'Le Mail en Copie Cachée', texte: 'Un joueur au choix ne recevra pas l’invitation au prochain lot.' },
  { type: 'doubler', titre: 'Le Report à Nouveau', texte: 'Le gagnant récupère une seconde fois les points d’une épreuve passée (400 max).' },
  { type: 'mystere', titre: 'Le Carton du Client', texte: 'Un carton scotché, livré sans bordereau. Personne ne sait ce qu’il contient.' },
  { type: 'mystere', titre: 'Les Chocolats de Noël du Client', texte: 'Il reste une boîte. Elle a l’air pleine. Elle a l’air.' },
];
