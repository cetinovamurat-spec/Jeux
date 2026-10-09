// 🎲 ÉVÉNEMENTS ALÉATOIRES (entre les épreuves)
// Format : { id, emoji, titre, texte, flavor, effet: {...}, min (nb de joueurs minimum) }
// {cible} = joueur(s) visé(s). Pour les transferts : {joueur} = donneur(s), {joueur2} = receveur(s).
//
// Types d'effets :
//  multiplicateur  { valeur }                     points de la prochaine épreuve ×valeur
//  points          { cible, valeur }              gain/perte immédiat
//  pourcentage     { cible, valeur }              ±% du score
//  transfert       { de, vers, valeur }           points pris à « de » et répartis sur « vers »
//  mod             { cible, mod, valeur? }        pour la prochaine épreuve :
//                    mod = 'noSpeed' (pas de bonus de rapidité), 'blind' (une réponse indisponible),
//                          'noLoss' (aucune perte), 'mult' (gains ×valeur)
//  don             { cible, valeur }              la cible choisit un collègue qui reçoit les points
//  defi            { cible, gain, perte }         la cible répond à une question bonus
//  tous-defi       { gain }                       tout le monde répond à une question bonus
//  echange-voisins {}                             deux joueurs voisins au classement échangent leurs scores
//  arrondi         { pas }                        tous les scores arrondis
//  roulette        { cible, valeurs: [...] }      gain aléatoire parmi les valeurs
// cible : 'tous' | 'leader' | 'dernier' | 'derniers:3' | 'premiers:2' | 'hasard' | 'hasard:2' | 'moitie-basse' | 'moitie-haute'
//         | 'grade:alternants,assistants-juniors' (grades du trombinoscope, voir content/team.js)

module.exports = [
  { id: 'controle-qualite', emoji: '🚨', titre: 'CONTRÔLE QUALITÉ', texte: '{cible} est tiré(e) au sort pour une revue qualité surprise. Une question, maintenant : +100 si juste, −50 sinon.', effet: { type: 'defi', cible: 'hasard', gain: 100, perte: 50 } },
  { id: 'pause-cafe', emoji: '☕', titre: 'PAUSE CAFÉ', texte: 'Les 3 derniers du classement filent à la machine et reviennent requinqués : +60 pts.', effet: { type: 'points', cible: 'derniers:3', valeur: 60 }, min: 4 },
  { id: 'fin-de-mois', emoji: '💀', titre: 'FIN DE MOIS', texte: 'Tous les points de la prochaine épreuve sont multipliés par 2.', flavor: 'Le client a envoyé toutes ses pièces le 30 à 23h.', effet: { type: 'multiplicateur', valeur: 2 } },
  { id: 'client-appelle', emoji: '📞', titre: 'LE CLIENT APPELLE', texte: '{cible} décroche pour « une petite question rapide » de 45 minutes : pas de bonus de rapidité à la prochaine épreuve.', effet: { type: 'mod', cible: 'hasard', mod: 'noSpeed' } },
  { id: 'pieces-manquantes', emoji: '🧾', titre: 'PIÈCES MANQUANTES', texte: '{cible} n’a pas reçu toutes les pièces : à chaque question de la prochaine épreuve, une réponse sera indisponible sur son écran.', effet: { type: 'mod', cible: 'hasard', mod: 'blind' } },
  { id: 'associe-bienveillant', emoji: '🏆', titre: 'ASSOCIÉ BIENVEILLANT', texte: '{cible} reçoit une enveloppe de 100 pts… à offrir au collègue de son choix.', effet: { type: 'don', cible: 'hasard', valeur: 100 } },
  { id: 'arrondi', emoji: '🧮', titre: 'ARRONDI COMPTABLE', texte: 'Le comité arrondit tous les scores à la cinquantaine la plus proche. C’est immatériel, voyons.', effet: { type: 'arrondi', pas: 50 } },
  { id: 'mercato', emoji: '🔄', titre: 'MERCATO D’HIVER', texte: '{joueur} et {joueur2}, voisins au classement, échangent leurs scores. Transfert sec, sans clause libératoire.', effet: { type: 'echange-voisins' } },
  { id: 'redressement', emoji: '💸', titre: 'REDRESSEMENT FISCAL', texte: 'Le leader {joueur} est redressé : 100 pts reversés à {joueur2}.', effet: { type: 'transfert', de: 'leader', vers: 'dernier', valeur: 100 }, min: 3 },
  { id: 'croissants', emoji: '🥐', titre: 'LES CROISSANTS DU VENDREDI', texte: 'C’est au leader {joueur} de payer les croissants : 80 pts répartis entre tous les autres.', effet: { type: 'transfert', de: 'leader', vers: 'tous', valeur: 80 }, min: 3 },
  { id: 'pot-depart', emoji: '🎂', titre: 'POT DE DÉPART', texte: 'Discours ému, gobelets en plastique, chips : +30 pts pour tout le monde.', effet: { type: 'points', cible: 'tous', valeur: 30 } },
  { id: 'seuil', emoji: '🛡️', titre: 'SEUIL DE SIGNIFICATION', texte: 'Pendant la prochaine épreuve, toutes les pertes de points sont ignorées. En dessous du seuil, ça ne compte pas.', effet: { type: 'mod', cible: 'tous', mod: 'noLoss' } },
  { id: 'stagiaire', emoji: '👶', titre: 'STAGIAIRE PROTÉGÉ', texte: 'En queue de classement, {cible} bénéficie d’un coefficient ×1,5 sur ses gains de la prochaine épreuve.', effet: { type: 'mod', cible: 'dernier', mod: 'mult', valeur: 1.5 }, min: 3 },
  { id: 'prime', emoji: '📈', titre: 'PRIME DE FIN D’ANNÉE', texte: '{cible} touche une prime surprise de +80 pts (la DRH n’est pas au courant).', effet: { type: 'points', cible: 'moitie-basse:2', valeur: 80 }, min: 4 },
  { id: 'budget', emoji: '📉', titre: 'BUDGET EXPLOSÉ', texte: 'Le leader {cible} a explosé le budget d’heures de sa mission : −60 pts.', effet: { type: 'points', cible: 'leader', valeur: -60 } },
  { id: 'revue-associe', emoji: '🔍', titre: 'REVUE DE L’ASSOCIÉ', texte: 'Le leader {cible} est convoqué en revue : une question à +80 / −80.', effet: { type: 'defi', cible: 'leader', gain: 80, perte: 80 } },
  { id: 'inventaire', emoji: '📦', titre: 'INVENTAIRE PHYSIQUE', texte: 'Tout le monde s’y colle, comme un 31 décembre dans l’entrepôt : question bonus pour tous, +50 pts par bonne réponse.', effet: { type: 'tous-defi', gain: 50 } },
  { id: 'mail-vendredi', emoji: '📧', titre: 'MAIL DU VENDREDI 17H58', texte: '{cible} reçoit un mail « URGENT » du client à 17h58 un vendredi. −40 pts de moral.', effet: { type: 'points', cible: 'hasard', valeur: -40 } },
  { id: 'roulette', emoji: '🎰', titre: 'LA ROULETTE DE LA BALANCE ÂGÉE', texte: '{cible} : les créances tournent… et le hasard décide de vos points.', effet: { type: 'roulette', cible: 'hasard:3', valeurs: [-50, 0, 50, 100, 150] } },
  { id: 'rtt', emoji: '🏖️', titre: 'RTT SURPRISE', texte: '{cible} pose une RTT surprise et revient reposé(e) : +70 pts.', effet: { type: 'points', cible: 'hasard', valeur: 70 } },
  { id: 'imprimante', emoji: '🖨️', titre: 'IMPRIMANTE EN PANNE', texte: '{cible} : bourrage papier. Pas de bonus de rapidité à la prochaine épreuve.', effet: { type: 'mod', cible: 'hasard:2', mod: 'noSpeed' }, min: 3 },
  { id: 'cloture', emoji: '⚡', titre: 'NUIT DE CLÔTURE', texte: 'Tension maximale : coefficient ×1,5 sur tous les points de la prochaine épreuve.', effet: { type: 'multiplicateur', valeur: 1.5 } },
  { id: 'urssaf', emoji: '🧑‍⚖️', titre: 'CONTRÔLE URSSAF', texte: 'Les deux premiers, {cible}, subissent un contrôle : −5 % de leur score.', effet: { type: 'pourcentage', cible: 'premiers:2', valeur: -5 }, min: 4 },
  { id: 'panier-garni', emoji: '🎁', titre: 'LE PANIER GARNI DU CLIENT', texte: 'Le leader {cible} a reçu un panier garni… et doit l’offrir (+80 pts) au collègue de son choix. Déontologie oblige.', effet: { type: 'don', cible: 'leader', valeur: 80 } },
  { id: 'gel', emoji: '🧊', titre: 'GEL DES COMPTES', texte: 'Le leader {cible} est gelé : pas de bonus de rapidité à la prochaine épreuve.', effet: { type: 'mod', cible: 'leader', mod: 'noSpeed' } },
  { id: 'h2a', emoji: '💼', titre: 'CONTRÔLE DU RÉGULATEUR', texte: '{cible} sont contrôlés : question bonus, +70 si juste, −30 sinon.', effet: { type: 'defi', cible: 'hasard:2', gain: 70, perte: 30 }, min: 3 },
  { id: 'fusion', emoji: '🤝', titre: 'FUSION-ACQUISITION', texte: '{joueur} absorbe 50 pts de {joueur2}. Le goodwill sera justifié plus tard.', effet: { type: 'transfert', de: 'hasard', vers: 'hasard', valeur: 50 } },
  { id: 'double', emoji: '🎯', titre: 'QUITTE OU DOUBLE', texte: '{cible} verra tous ses gains doublés à la prochaine épreuve.', effet: { type: 'mod', cible: 'hasard', mod: 'mult', valeur: 2 } },
  { id: 'vpn', emoji: '🌐', titre: 'LE VPN TIENT BON', texte: 'Miracle : personne n’a été déconnecté. +20 pts pour tout le monde.', effet: { type: 'points', cible: 'tous', valeur: 20 } },
  { id: 'sauvetage', emoji: '🧯', titre: 'SAUVETAGE DE DOSSIER', texte: 'Le manager vole au secours de {cible} : +100 pts.', effet: { type: 'points', cible: 'dernier', valeur: 100 } },
  { id: 'reevaluation', emoji: '📊', titre: 'RÉÉVALUATION LIBRE', texte: 'Les deux derniers, {cible}, réévaluent leurs actifs : +10 % de score.', effet: { type: 'pourcentage', cible: 'derniers:2', valeur: 10 }, min: 4 },
  { id: 'formation', emoji: '📚', titre: 'FORMATION OBLIGATOIRE', texte: '{cible} ont oublié de déclarer leurs heures de formation continue : −25 pts chacun.', effet: { type: 'points', cible: 'hasard:2', valeur: -25 }, min: 3 },
  { id: 'coup-de-main', emoji: '🦸', titre: 'COUP DE MAIN DU MANAGER', texte: 'Les deux derniers, {cible}, sont couverts : aucune perte de points possible à la prochaine épreuve.', effet: { type: 'mod', cible: 'derniers:2', mod: 'noLoss' }, min: 4 },
  { id: 'pizza', emoji: '🍕', titre: 'SOIRÉE PIZZA DE CLÔTURE', texte: 'Il est 21h, les pizzas arrivent : +40 pts pour tout le monde.', effet: { type: 'points', cible: 'tous', valeur: 40 } },
  { id: 'bug-excel', emoji: '🐞', titre: 'BUG EXCEL', texte: 'La RECHERCHEV de {cible} renvoie #N/A depuis le début de la soirée : −30 pts.', effet: { type: 'points', cible: 'hasard', valeur: -30 } },
  { id: 'teambuilding', emoji: '🧗', titre: 'TEAM BUILDING', texte: 'Accrobranche obligatoire. Les deux premiers, {cible}, perdent 30 pts en sueur, réinjectés chez les derniers.', effet: { type: 'transfert', de: 'premiers:2', vers: 'derniers:2', valeur: 30 }, min: 4 },
  // ───── Événements par grade (s'appliquent seulement si des joueurs de ces grades sont présents) ─────
  { id: 'grade-pyramide-inversee', emoji: '🔺', titre: 'PYRAMIDE INVERSÉE', texte: 'Révolution dans l’organigramme : la base de la pyramide prend les commandes. Gains ×2 à la prochaine épreuve pour {cible}.', flavor: 'Quelqu’un a imprimé l’organigramme à l’envers. Personne n’ose le retourner.', effet: { type: 'mod', cible: 'grade:alternants,assistants-juniors', mod: 'mult', valeur: 2 } },
  { id: 'grade-croissants-managers', emoji: '🥐', titre: 'LES MANAGERS PAIENT LES CROISSANTS', texte: 'Coutume de fin de clôture : ce sont les managers qui régalent. 40 pts prélevés sur chaque manager et répartis entre assistants et alternants.', flavor: 'Note de frais en cours de validation… par un manager.', effet: { type: 'transfert', de: 'grade:managers', vers: 'grade:assistants-confirmes,assistants-juniors,alternants', valeur: 40 } },
  { id: 'grade-relecture-rapport', emoji: '🖋️', titre: 'RELECTURE DU RAPPORT', texte: 'Le rapport part en signature : relecture minutieuse obligatoire. Pas de bonus de rapidité à la prochaine épreuve pour {cible}.', flavor: 'Une virgule mal placée dans une opinion, et tout le rapport repart en revue.', effet: { type: 'mod', cible: 'grade:associes', mod: 'noSpeed' } },
  { id: 'grade-semaine-ecole', emoji: '🎓', titre: 'SEMAINE D’ÉCOLE', texte: 'Retour de semaine d’école, cours tout frais en tête : aucune perte possible à la prochaine épreuve pour {cible}.', flavor: 'Le partiel de droit des sociétés fait office d’assurance tous risques.', effet: { type: 'mod', cible: 'grade:alternants', mod: 'noLoss' } },
  { id: 'grade-planning-busy-season', emoji: '📅', titre: 'PLANNING DE BUSY SEASON', texte: 'Le planning de busy season vient de tomber : trois missions en parallèle pour {cible}. À la prochaine épreuve, une réponse sera indisponible à chaque question.', flavor: 'Staffing validé à 23 h 58, envoyé à 23 h 59.', effet: { type: 'mod', cible: 'grade:seniors', mod: 'blind' } },
  { id: 'grade-inventaire-physique', emoji: '🥶', titre: 'INVENTAIRE PHYSIQUE', texte: 'Retour d’inventaire physique à 6 h du matin dans un entrepôt frigorifique : prime de terrain de +60 pts pour {cible}.', flavor: 'Comptage validé, doigts dégelés, moral intact.', effet: { type: 'points', cible: 'grade:assistants-confirmes,assistants-juniors', valeur: 60 } },
  { id: 'grade-charges-structure', emoji: '🏢', titre: 'CHARGES DE STRUCTURE', texte: 'Les frais de structure sont imputés aux grades qui portent le cabinet : −5 % de score pour {cible}.', flavor: 'Clé de répartition validée en comité. Recours possible auprès… du comité.', effet: { type: 'pourcentage', cible: 'grade:associes,managers', valeur: -5 } },
  { id: 'grade-delegation-synthese', emoji: '📝', titre: 'DÉLÉGATION DE LA SYNTHÈSE', texte: 'Le manager délègue la note de synthèse : gains ×1,5 à la prochaine épreuve pour {cible}.', flavor: 'Confiance, autonomie… et un léger parfum de deadline.', effet: { type: 'mod', cible: 'grade:seniors,assistants-confirmes', mod: 'mult', valeur: 1.5 } },
];
