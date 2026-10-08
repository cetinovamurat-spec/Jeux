// ⚽ ÉPREUVE 9 — QUIZ FOOTBALL
// QCM : { q, choix: [BONNE, fausse, fausse, fausse], d, cat, info, visuel }
// Vrai/Faux : { type: 'vf', q, vrai, d, cat, info }
// Estimation : { type: 'estimation', q, reponse, unite, cat, info }
// Classement : { type: 'ordre', q, ordre: [dans le BON ordre], cat, info }  (affiché mélangé)
// visuel : texte/emoji affiché en grand (parcours mystère, rébus…)
// Les questions « sur l'équipe » (votes, miroirs) sont dans perso.js.

module.exports = [
  // ───── Facile ─────
  { q: 'Quel pays a remporté la Coupe du monde 2018 ?', choix: ['France', 'Croatie', 'Belgique', 'Brésil'], d: 1, cat: 'Coupe du monde' },
  { q: 'Qui a remporté la Coupe du monde 2022 au Qatar ?', choix: ['Argentine', 'France', 'Croatie', 'Maroc'], d: 1, cat: 'Coupe du monde', info: '3-3 après prolongation, puis 4-2 aux tirs au but.' },
  { q: 'Quel était le score de la finale France–Brésil de 1998 ?', choix: ['3-0', '2-0', '3-1', '1-0'], d: 1, cat: 'Coupe du monde' },
  { q: 'Quel joueur a marqué deux buts de la tête en finale de la Coupe du monde 1998 ?', choix: ['Zinedine Zidane', 'Emmanuel Petit', 'Thierry Henry', 'Youri Djorkaeff'], d: 1, cat: 'Coupe du monde', info: 'Emmanuel Petit a inscrit le troisième but.' },
  { q: 'Quel club a remporté le plus de Ligues des champions ?', choix: ['Real Madrid', 'AC Milan', 'Bayern Munich', 'Liverpool'], d: 1, cat: 'Ligue des champions' },
  { q: 'Quel club français a remporté la Ligue des champions en 1993 ?', choix: ['Olympique de Marseille', 'Paris Saint-Germain', 'AS Monaco', 'Olympique lyonnais'], d: 1, cat: 'Ligue des champions', info: '1-0 contre l’AC Milan, but de Basile Boli.' },
  { q: 'Quel joueur détient le record de Ballons d’or ?', choix: ['Lionel Messi', 'Cristiano Ronaldo', 'Michel Platini', 'Johan Cruyff'], d: 1, cat: 'Ballon d’or', info: 'Huit trophées.' },
  { q: 'Quel club est surnommé « les Verts » ?', choix: ['AS Saint-Étienne', 'FC Nantes', 'Olympique de Marseille', 'RC Lens'], d: 1, cat: 'Ligue 1' },
  { q: 'Dans quel stade joue l’Olympique de Marseille ?', choix: ['Le Vélodrome', 'Le Parc des Princes', 'Le Groupama Stadium', 'Le stade Geoffroy-Guichard'], d: 1, cat: 'Ligue 1' },
  { q: 'Quels pays organisent la Coupe du monde 2026 ?', choix: ['États-Unis, Canada et Mexique', 'États-Unis seuls', 'Canada et États-Unis', 'Mexique et États-Unis'], d: 1, cat: 'Coupe du monde' },
  { q: 'Qui était le sélectionneur de l’équipe de France championne du monde en 2018 ?', choix: ['Didier Deschamps', 'Laurent Blanc', 'Raymond Domenech', 'Zinedine Zidane'], d: 1, cat: 'Équipe de France' },
  { q: 'Quel pays a remporté l’Euro 2016 ?', choix: ['Portugal', 'France', 'Allemagne', 'Pays de Galles'], d: 1, cat: 'Euro' },
  { q: 'Quel pays a remporté l’Euro 2024 ?', choix: ['Espagne', 'Angleterre', 'France', 'Allemagne'], d: 1, cat: 'Euro', info: '2-1 contre l’Angleterre en finale à Berlin.' },
  { q: 'Combien de buts Kylian Mbappé a-t-il marqués en finale de la Coupe du monde 2022 ?', choix: ['3', '2', '1', '4'], d: 1, cat: 'Coupe du monde', info: 'Un triplé en finale… et pourtant la défaite.' },
  { q: 'Quel club anglais est surnommé « les Gunners » ?', choix: ['Arsenal', 'Chelsea', 'Tottenham', 'West Ham'], d: 1, cat: 'Clubs' },
  { q: 'Quel joueur est surnommé « La Pulga » ?', choix: ['Lionel Messi', 'Neymar', 'Luis Suárez', 'Sergio Agüero'], d: 1, cat: 'Joueurs' },
  { q: 'Quelle sélection est devenue en 2022 la première équipe africaine demi-finaliste d’une Coupe du monde ?', choix: ['Maroc', 'Sénégal', 'Cameroun', 'Ghana'], d: 1, cat: 'Coupe du monde' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Cannes → Bordeaux → Juventus → Real Madrid', choix: ['Zinedine Zidane', 'Christophe Dugarry', 'Bixente Lizarazu', 'Youri Djorkaeff'], d: 1, cat: 'Parcours mystère' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Sporting CP → Manchester United → Real Madrid → Juventus → Manchester United → Al-Nassr', choix: ['Cristiano Ronaldo', 'Nani', 'Luís Figo', 'Ángel Di María'], d: 1, cat: 'Parcours mystère' },
  { q: 'Rébus : quel joueur se cache derrière ces emojis ?', visuel: '🐐 🇦🇷 🔟 🏆', choix: ['Lionel Messi', 'Diego Maradona', 'Juan Román Riquelme', 'Ángel Di María'], d: 1, cat: 'Rébus' },
  { type: 'vf', q: 'Le Paris Saint-Germain a remporté la Ligue des champions 2025.', vrai: true, d: 1, cat: 'Ligue des champions', info: '5-0 contre l’Inter Milan en finale, à Munich.' },
  { type: 'vf', q: 'Didier Deschamps a remporté la Coupe du monde comme joueur ET comme sélectionneur.', vrai: true, d: 1, cat: 'Équipe de France', info: 'Capitaine en 1998, sélectionneur en 2018.' },

  // ───── Moyen ─────
  { q: 'Contre quel club le PSG a-t-il remporté la finale de la Ligue des champions 2025 ?', choix: ['Inter Milan', 'Arsenal', 'FC Barcelone', 'Bayern Munich'], d: 2, cat: 'Ligue des champions', info: '5-0, le plus large écart de l’histoire en finale de C1.' },
  { q: 'Qui a marqué le but de la victoire de l’OM en finale de la Ligue des champions 1993 ?', choix: ['Basile Boli', 'Rudi Völler', 'Alen Bokšić', 'Didier Deschamps'], d: 2, cat: 'Ligue des champions' },
  { q: 'Combien de Coupes du monde le Brésil a-t-il remportées avant l’édition 2026 ?', choix: ['5', '4', '6', '3'], d: 2, cat: 'Coupe du monde' },
  { q: 'Qui a remporté le Ballon d’or 2025 ?', choix: ['Ousmane Dembélé', 'Lamine Yamal', 'Mohamed Salah', 'Kylian Mbappé'], d: 2, cat: 'Ballon d’or' },
  { q: 'Quel Français avait remporté le Ballon d’or juste avant Ousmane Dembélé ?', choix: ['Karim Benzema', 'Zinedine Zidane', 'Michel Platini', 'Jean-Pierre Papin'], d: 2, cat: 'Ballon d’or', info: 'Karim Benzema en 2022.' },
  { q: 'Combien de Ballons d’or Michel Platini a-t-il remportés ?', choix: ['3', '2', '1', '4'], d: 2, cat: 'Ballon d’or', info: 'Trois de suite : 1983, 1984, 1985.' },
  { q: 'Combien de titres de champion de France consécutifs l’OL a-t-il remportés entre 2002 et 2008 ?', choix: ['7', '5', '6', '8'], d: 2, cat: 'Ligue 1' },
  { q: 'Quel club français compte le plus de titres de champion de France ?', choix: ['Paris Saint-Germain', 'AS Saint-Étienne', 'Olympique de Marseille', 'Olympique lyonnais'], d: 2, cat: 'Ligue 1', info: 'Le PSG a dépassé les 10 titres des Verts en 2023.' },
  { q: 'Quel club est le plus titré en Coupe de France ?', choix: ['Paris Saint-Germain', 'Olympique de Marseille', 'AS Saint-Étienne', 'Lille OSC'], d: 2, cat: 'Coupe de France' },
  { q: 'Combien d’équipes participent à la Coupe du monde 2026 ?', choix: ['48', '32', '40', '64'], d: 2, cat: 'Coupe du monde' },
  { q: 'Qui a inscrit le but en or de la finale de l’Euro 2000 contre l’Italie ?', choix: ['David Trezeguet', 'Sylvain Wiltord', 'Thierry Henry', 'Robert Pirès'], d: 2, cat: 'Euro', info: 'Sylvain Wiltord avait égalisé à la dernière seconde du temps réglementaire.' },
  { q: 'Quel club a remporté la Ligue des champions 2005 après avoir été mené 3-0 à la mi-temps ?', choix: ['Liverpool', 'AC Milan', 'Chelsea', 'FC Porto'], d: 2, cat: 'Ligue des champions', info: 'Le « miracle d’Istanbul ».' },
  { q: 'Quel était le score du match retour Barça–PSG de la « remontada » en 2017 ?', choix: ['6-1', '5-1', '4-0', '6-2'], d: 2, cat: 'Ligue des champions' },
  { q: 'Quel club a remporté la toute première Coupe des clubs champions européens, en 1956 ?', choix: ['Real Madrid', 'Stade de Reims', 'Benfica', 'AC Milan'], d: 2, cat: 'Histoire', info: '4-3 contre le Stade de Reims, au Parc des Princes.' },
  { q: 'Quel club français a atteint la finale de la Ligue des champions 2004 ?', choix: ['AS Monaco', 'Olympique lyonnais', 'Olympique de Marseille', 'Girondins de Bordeaux'], d: 2, cat: 'Ligue des champions', info: 'Défaite 3-0 face au FC Porto de José Mourinho.' },
  { q: 'Quel joueur a été élu meilleur jeune joueur de l’Euro 2024 ?', choix: ['Lamine Yamal', 'Jude Bellingham', 'Jamal Musiala', 'Warren Zaïre-Emery'], d: 2, cat: 'Euro' },
  { q: 'Qui est le joueur le plus capé de l’histoire de l’équipe de France ?', choix: ['Hugo Lloris', 'Lilian Thuram', 'Antoine Griezmann', 'Olivier Giroud'], d: 2, cat: 'Équipe de France', info: '145 sélections.' },
  { q: 'Combien de remplacements par équipe sont autorisés pendant le temps réglementaire d’un match officiel ?', choix: ['5', '3', '4', '6'], d: 2, cat: 'Règles' },
  { q: 'Quel club est surnommé « la Vieille Dame » ?', choix: ['Juventus', 'AC Milan', 'Inter Milan', 'AS Rome'], d: 2, cat: 'Clubs' },
  { q: 'Quel club est surnommé « les Canaris » ?', choix: ['FC Nantes', 'FC Sochaux', 'RC Lens', 'Stade brestois'], d: 2, cat: 'Ligue 1' },
  { q: 'Quel club est surnommé « les Dogues » ?', choix: ['Lille OSC', 'Stade rennais', 'OGC Nice', 'FC Lorient'], d: 2, cat: 'Ligue 1' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Monaco → Juventus → Arsenal → FC Barcelone → New York Red Bulls', choix: ['Thierry Henry', 'David Trezeguet', 'Emmanuel Petit', 'Lilian Thuram'], d: 2, cat: 'Parcours mystère' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Le Mans → Guingamp → Marseille → Chelsea → Shanghai Shenhua → Galatasaray → Chelsea', choix: ['Didier Drogba', 'Florent Malouda', 'Nicolas Anelka', 'Mamadou Niang'], d: 2, cat: 'Parcours mystère' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Auxerre → Marseille → Montpellier → Nîmes → Leeds → Manchester United', choix: ['Éric Cantona', 'Jean-Pierre Papin', 'David Ginola', 'Laurent Blanc'], d: 2, cat: 'Parcours mystère' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Real Sociedad → Atlético de Madrid → FC Barcelone → Atlético de Madrid', choix: ['Antoine Griezmann', 'Ousmane Dembélé', 'Thomas Lemar', 'Clément Lenglet'], d: 2, cat: 'Parcours mystère' },
  { q: 'Rébus : quel joueur ?', visuel: '🇧🇷 👑 1958 · 1962 · 1970', choix: ['Pelé', 'Garrincha', 'Ronaldo', 'Zico'], d: 2, cat: 'Rébus', info: 'Le seul joueur triple champion du monde.' },
  { type: 'vf', q: 'Thierry Henry est le meilleur buteur de l’histoire d’Arsenal.', vrai: true, d: 2, cat: 'Joueurs', info: '228 buts toutes compétitions confondues.' },
  { type: 'vf', q: 'Un but marqué directement sur une rentrée de touche est valable.', vrai: false, d: 2, cat: 'Règles' },
  { type: 'vf', q: 'Le gardien peut prendre à la main une passe en retrait volontaire faite du pied par un coéquipier.', vrai: false, d: 2, cat: 'Règles' },
  { type: 'vf', q: 'La France a remporté l’Euro 1984 et l’Euro 2000.', vrai: true, d: 2, cat: 'Euro' },

  // ───── Difficile ─────
  { q: 'Combien de buts Just Fontaine a-t-il inscrits lors de la Coupe du monde 1958 (record sur une édition) ?', choix: ['13', '9', '11', '15'], d: 3, cat: 'Histoire' },
  { q: 'Qui est le meilleur buteur de l’histoire de la Ligue 1 ?', choix: ['Delio Onnis', 'Jean-Pierre Papin', 'Bernard Lacombe', 'Edinson Cavani'], d: 3, cat: 'Ligue 1', info: '299 buts en championnat.' },
  { q: 'Quel est le seul gardien à avoir remporté le Ballon d’or ?', choix: ['Lev Yachine', 'Gianluigi Buffon', 'Manuel Neuer', 'Dino Zoff'], d: 3, cat: 'Ballon d’or', info: 'En 1963. Surnommé « l’Araignée noire ».' },
  { q: 'Contre quel club le Real Madrid a-t-il gagné la première finale de C1 en 1956 ?', choix: ['Stade de Reims', 'Benfica', 'Fiorentina', 'Eintracht Francfort'], d: 3, cat: 'Histoire' },
  { q: 'Qui a marqué le but de la victoire du Portugal en finale de l’Euro 2016 ?', choix: ['Éder', 'Cristiano Ronaldo', 'Nani', 'Ricardo Quaresma'], d: 3, cat: 'Euro' },
  { q: 'Combien de joueurs minimum une équipe doit-elle avoir sur le terrain pour que le match continue ?', choix: ['7', '8', '6', '9'], d: 3, cat: 'Règles' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Nancy → Saint-Étienne → Juventus', choix: ['Michel Platini', 'Dominique Rocheteau', 'Alain Giresse', 'Jean Tigana'], d: 3, cat: 'Parcours mystère' },
  { q: 'Parcours mystère : qui est-ce ?', visuel: 'Monaco → Parme → Juventus → FC Barcelone', choix: ['Lilian Thuram', 'Marcel Desailly', 'Patrick Vieira', 'Emmanuel Petit'], d: 3, cat: 'Parcours mystère' },
  { q: 'Rébus : quel joueur ?', visuel: '🇳🇱 🍊 1974 · « football total » · 14', choix: ['Johan Cruyff', 'Marco van Basten', 'Ruud Gullit', 'Johan Neeskens'], d: 3, cat: 'Rébus' },

  // ───── Extrême ─────
  { q: 'Lors de quelle Coupe du monde les cartons jaunes et rouges ont-ils été utilisés pour la première fois ?', choix: ['1970', '1966', '1974', '1982'], d: 4, cat: 'Histoire', info: 'Une idée de l’arbitre anglais Ken Aston… inspirée par un feu tricolore.' },
  { q: 'Quel est le surnom de l’équipe nationale d’Italie ?', choix: ['La Squadra Azzurra', 'La Furia Roja', 'La Seleção', 'La Mannschaft'], d: 1, cat: 'Sélections' },

  // ───── Estimations ─────
  { type: 'estimation', q: 'Combien de buts Cristiano Ronaldo a-t-il marqués en Ligue des champions ?', reponse: 140, unite: 'buts', cat: 'Ligue des champions', info: '140 buts, record absolu de la compétition.' },
  { type: 'estimation', q: 'Combien de matchs de Premier League Arsenal a-t-il enchaînés sans défaite (record des « Invincibles ») ?', reponse: 49, unite: 'matchs', cat: 'Clubs' },
  { type: 'estimation', q: 'Combien a coûté le transfert de Neymar au PSG en 2017 ?', reponse: 222, unite: 'M€', cat: 'Mercato', info: '222 M€, record du monde.' },
  { type: 'estimation', q: 'Combien de spectateurs (officiellement) pour la finale de la Coupe du monde 1950 au Maracanã ?', reponse: 173850, unite: 'spectateurs', cat: 'Histoire', info: '173 850 officiellement, probablement plus de 200 000 en réalité.' },
  { type: 'estimation', q: 'Quelle est la capacité du Stade de France ?', reponse: 80000, unite: 'places', cat: 'Stades', info: 'Environ 80 000 places en configuration football.' },

  // ───── Classements ─────
  { type: 'ordre', q: 'Classez ces clubs par nombre de Ligues des champions remportées (du plus au moins titré)', ordre: ['Real Madrid', 'AC Milan', 'Ajax Amsterdam', 'Olympique de Marseille'], cat: 'Ligue des champions' },
  { type: 'ordre', q: 'Classez ces pays par nombre de Coupes du monde remportées avant 2026 (du plus au moins)', ordre: ['Brésil', 'Italie', 'Argentine', 'Uruguay'], cat: 'Coupe du monde', info: 'Brésil 5, Italie 4, Argentine 3, Uruguay 2.' },
  { type: 'ordre', q: 'Classez ces joueurs par nombre de Ballons d’or (du plus au moins)', ordre: ['Lionel Messi', 'Cristiano Ronaldo', 'Michel Platini', 'Zinedine Zidane'], cat: 'Ballon d’or', info: '8, 5, 3 et 1.' },
  { type: 'ordre', q: 'Remettez ces titres de l’équipe de France dans l’ordre chronologique', ordre: ['Euro 1984', 'Coupe du monde 1998', 'Euro 2000', 'Coupe du monde 2018'], cat: 'Équipe de France' },
];
