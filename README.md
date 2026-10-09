# 🏆 Les Olympiades du Cabinet — *Audit Games 2026*

Un party game multijoueur en temps réel, pensé pour une soirée entre collègues d'un cabinet d'audit,
**à distance** (Teams / Discord / Zoom) ou dans la même pièce.

10 épreuves, des équipes recomposées à chaque manche, du bluff, des rôles secrets, des enchères,
des événements surprises… et un seul champion.

> **Le principe :** le MC (maître de cérémonie) ouvre la partie et partage son écran.
> Chaque collègue ouvre le lien sur son téléphone ou son ordinateur, choisit un pseudo et joue.
> Aucune installation côté joueur : **un lien → un pseudo → on joue.**

---

## ⚡ Mettre le jeu en ligne en 3 clics (recommandé)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/cetinovamurat-spec/Jeux)

1. Clique sur le bouton ci-dessus → connecte-toi à Render avec ton compte GitHub (gratuit, pas de carte bancaire pour l'offre Free).
2. Valide le service proposé (`olympiades-du-cabinet`, plan **Free**) → **Apply / Deploy**.
3. Après 2–3 minutes, Render te donne une adresse du type `https://olympiades-du-cabinet.onrender.com` : c'est le lien du jeu.

> ℹ️ Netlify ne convient pas pour ce jeu : il héberge des sites statiques, alors que les Olympiades ont besoin
> d'un serveur temps réel (WebSocket) allumé pendant toute la partie. Render, Railway ou Fly.io le permettent.

---

## 🚀 Lancer une partie en 2 minutes

```bash
npm install
npm start
# → http://localhost:3000
```

1. Le MC ouvre `http://localhost:3000` → **« Créer une partie »**.
2. Le code de la partie (ex. `GLJF`), le lien et un QR code s'affichent.
3. Les joueurs ouvrent `http://<adresse>/GLJF` (ou scannent le QR code), choisissent pseudo + avatar.
4. Le MC règle la soirée (épreuves, durée, équipes, événements) puis clique **« 🚀 Lancer les Olympiades »**.
5. Le MC fait avancer le jeu avec **« Suivant »** (ou `Espace` / `→`). `P` = pause.

### Jouer à distance
Pour que les collègues hors du réseau local puissent rejoindre, il faut une adresse publique :

- **Le plus simple : déployer gratuitement** (voir ci-dessous, ~5 minutes, une seule fois).
- **Dépannage express depuis ton PC :** `npx cloudflared tunnel --url http://localhost:3000`
  (ou `ngrok http 3000`) puis partage l'URL obtenue.

### Conseils pour la soirée (Teams / Discord / Zoom)
- Dans le lobby du MC, ouvre **« 📺 Écran TV »** dans un nouvel onglet et **partage cet onglet** :
  c'est l'écran public, sans boutons de contrôle (et sans le mot secret de « Deviner un mot »).
  Garde l'onglet MC pour piloter.
- Le MC peut aussi jouer : bouton **« 🎮 Jouer aussi »** (ouvre un écran joueur) + case **« Auto »**
  pour que le jeu enchaîne seul les révélations.
- Micros ouverts conseillés : les épreuves *Menteur*, *Deviner un mot* et *Bluff* se jouent à l'oral.
- Partage de l'audio de l'onglet = bruitages (sifflet, tampons, fanfare) pour tout le monde.
- 🔑 Dans les réglages du lobby, un **lien MC de secours** permet de reprendre l'animation depuis un autre appareil.

---

## 🎮 Les 10 épreuves

| # | Épreuve | Principe | Équipes |
|---|---------|----------|---------|
| 1 | 🧠 **Quiz Culture G** | QCM du facile à l'extrême, bonus de rapidité, séries 🔥, questions « Qui est le plus susceptible… » et « Miroir » | bonus d'équipe |
| 2 | 🔢 **Estimation impossible** | Le plus proche (en ordre de grandeur) gagne ; 🎯 bonus < 10 %, 💀 malus pire estimation, 🎲 pari ×2 ; + un « Miroir chiffré » (estimer le vrai chiffre d'un collègue) | bonus d'équipe |
| 3 | 🕵️ **Trouver le menteur** | Affirmation publique + rôle secret (Innocent, Menteur, Double menteur, Manipulateur), plaidoiries à l'oral, votes | bonus d'équipe |
| 4 | ⚡ **Réaction rapide** | Mini-jeux éclair : réflexe au feu vert, intrus, mémoire, saisie, couleurs piège, écart de saisie, facture en double, inventaire, calcul flash | bonus d'équipe |
| 5 | 🧮 **Calcul mental** | TVA, marges, EBITDA, ratios, écritures absurdes et pièges vicieux | bonus d'équipe |
| 6 | 📊 **Analyse de graphique** | Trouver l'anomalie, la tendance, la bonne conclusion (du flagrant au très subtil) | bonus d'équipe |
| 7 | 📝 **Deviner un mot** | Façon Taboo : l'orateur fait deviner à son équipe… et les adversaires peuvent **voler** les mots | **cœur de l'épreuve** |
| 8 | 🎭 **Bluff** | Une question improbable + une carte secrète par joueur (Initié, Imposteur, Espion, Voleur, Saboteur, Bouclier, Pacte…) | — |
| 9 | ⚽ **Quiz football** | QCM, vrai/faux, parcours mystère, rébus, estimation, classement à ordonner, votes foot | bonus d'équipe |
| 10 | 💰 **Les Enchères** | Audit Coins inversement proportionnels au classement, enchères secrètes : droit de réponse, ×2, indice, vol, blocage, épreuve doublée, lot mystère | — |

### 🔀 Équipes tournantes
Avant chaque épreuve, un « mercato » recompose les équipes (2 à 4 équipes selon le nombre de joueurs) en :
1. évitant au maximum de remettre ensemble les mêmes binômes ;
2. équilibrant les scores ;
3. gardant une part de hasard pour que la mécanique ne soit pas lisible.

Chaque équipe reçoit une couleur et un nom de club (*FC Provisions*, *Real Amortissement*, *Paris Saint-Bilan*…).
L'équipe avec la meilleure moyenne sur l'épreuve gagne un bonus. En fin de partie : **meilleure équipe** de la soirée et **duo infernal**.

### 📈 Un score qui reste ouvert jusqu'au bout
- **Coefficients** croissants : ×1 (épreuves 1-3), ×1,25 (4-6), ×1,5 (7-9).
- **🚀 Prime d'outsider** : le tiers du bas du classement gagne +20 % sur ses gains.
- **Séries** 🔥, **sans faute** 💯, bonus d'équipe, malus (faux départs, cartons rouges, pire estimation).
- **Enchères finales** : les derniers reçoivent jusqu'à 800 coins de plus et gagnent les égalités → comeback possible.
- **30+ événements aléatoires** entre les épreuves : 🚨 Contrôle qualité, ☕ Pause café, 💀 Fin de mois (×2), 📞 Le client appelle,
  🧾 Pièces manquantes, 🏆 Associé bienveillant, 🧮 Arrondi comptable, 🔄 Mercato d'hiver, 💸 Redressement fiscal, 🥐 Les croissants du vendredi…

### 🏆 La cérémonie finale
Podium animé, carte du champion (points, épreuves gagnées, réussite, collègues trahis, citation),
trophées (🧠 Cerveau du cabinet, 🎭 Roi du bluff, ☕ Machine à café, 💀 Pire estimation, 🕵️ Détecteur de mensonges,
🗡️ Le Traître, 🔥 En feu, 📈 Remontada, 🗣️ Orateur, 🟥 Collectionneur de cartons, 🔨 Commissaire-priseur, ⭐ Joueur du match, 🐌 Stagiaire d'honneur),
titres honorifiques votés par les collègues, **résumé humoristique** de la soirée et bouton **Revanche**.
L'historique alimente un **Hall of Fame** sur la page d'accueil.

---

## ✏️ Personnaliser (le plus important)

Tout le contenu est dans **`content/`**, en fichiers JS commentés, modifiables sans toucher au code
(rechargés à chaque nouvelle partie, pas besoin de redémarrer) :

| Fichier | Contenu |
|---------|---------|
| **`content/team.js`** | ⭐ **À remplir en premier** : collègues (prénom, surnoms, titre, phrase d'entrée) + **vos private jokes** (`questionsPerso`) |
| `content/perso.js` | Questions « Qui est le plus susceptible… », « Miroir » et « Miroir chiffré » (utilisent automatiquement les joueurs connectés) |
| `content/quiz.js` | 71 questions de culture G (4 niveaux) |
| `content/estimations.js` | 35 estimations (dont la moitié « Cabinet ») |
| `content/menteur.js` | 41 affirmations pour « Trouver le menteur » (certaines citent un autre joueur présent) |
| `content/calcul.js` | 37 calculs et pièges comptables |
| `content/graphiques.js` | 21 graphiques avec anomalies |
| `content/mots.js` | 64 mots à faire deviner + mots interdits |
| `content/bluff.js` | 32 questions de bluff |
| `content/football.js` | 72 questions foot (QCM, vrai/faux, parcours, rébus, estimations, classements) |
| `content/encheres.js` | 29 lots d'enchères |
| `content/evenements.js` | 36 événements aléatoires |
| `content/textes.js` | Noms d'équipes, punchlines, citations, résumé de fin, annonces d'entrée |

Formats (rappelés en tête de chaque fichier) :
```js
// QCM : la PREMIÈRE réponse est la bonne (l'ordre est mélangé à l'affichage)
{ q: 'Que signifie « FEC » ?', choix: ['Fichier des Écritures Comptables', 'Faux 1', 'Faux 2', 'Faux 3'], d: 1, cat: 'Audit', info: 'Anecdote affichée à la révélation' }
// {joueur} est remplacé par un prénom de joueur connecté, {cible} par la cible d'une question Miroir
{ type: 'vote', q: 'Qui dans l’équipe est le plus susceptible de … ?', titre: 'Titre décerné à l’élu' }
```

Vérifier le contenu après modification : `npm test` (contrôle de format + simulation complète d'une partie).

> Règle d'or : taquin, absurde, compétitif, jamais blessant. Rien sur le physique, la vie privée, la santé ou les salaires.

---

## ☁️ Déployer gratuitement (une fois pour toutes)

L'application est un unique serveur Node.js (Express + Socket.IO), sans base de données : elle tourne partout.

### Render (recommandé, gratuit)
1. Pousser ce dépôt sur GitHub.
2. Sur [render.com](https://render.com) : **New → Blueprint** → choisir le dépôt (le fichier `render.yaml` est fourni).
3. URL obtenue du type `https://olympiades-du-cabinet.onrender.com` → les joueurs vont sur `…onrender.com/CODE`.

> L'offre gratuite « s'endort » après 15 min d'inactivité : ouvre l'URL 1 minute avant la soirée pour la réveiller.

### Autres options
- **Railway / Fly.io / Koyeb** : déploiement direct du dépôt (commande `npm start`, port via `PORT`).
- **Docker** : `docker build -t olympiades . && docker run -p 3000:3000 olympiades`.

---

## 🧱 Architecture

```
server.js                 Serveur HTTP + Socket.IO, routes, boucle des minuteurs
server/game.js            Machine à états d'une partie : lobby → intro → épreuve → classement → événement → … → finale
server/teams.js           Recomposition des équipes (anti-répétition des binômes + équilibre des scores)
server/events.js          Moteur des événements aléatoires
server/awards.js          Trophées, statistiques, résumé humoristique
server/history.js         Historique + Hall of Fame (data/history.json)
server/rounds/*.js        Les 10 épreuves (moteur générique de questions + épreuves spécifiques)
content/*.js              Tout le contenu éditable
public/                   Front sans build : HTML + CSS + modules JS (accueil, écran MC/TV, écran joueur)
test/simulation.js        Bots qui jouent une partie complète (10 épreuves, reconnexion, revanche)
test/content-check.js     Validation de la banque de contenu
test/screens.js           Captures d'écran de chaque phase (Playwright, optionnel)
```

- **Serveur autoritaire** : scores, rôles secrets, réponses et minuteurs vivent côté serveur ; chaque écran reçoit
  uniquement ce qu'il a le droit de voir (le rôle secret d'un joueur n'est envoyé qu'à lui).
- **Reconnexion** : chaque joueur reçoit un jeton stocké dans son navigateur ; il retrouve sa place (score, rôle,
  réponses) en rechargeant la page ou en revenant avec le même pseudo depuis un autre appareil.
- **Déconnexions** : le jeu n'attend jamais un joueur déconnecté ; un joueur arrivé en cours de route démarre au score du dernier.
- **Temps de réaction** mesurés côté joueur (indépendants de la latence réseau).

Testé par simulation automatique de 3 à 12 joueurs (limite fixée à 24 ; idéal entre 4 et 12).

---

## 🧪 Tests

```bash
npm test                         # contenu + simulation d'une soirée complète par des bots
node test/simulation.js 12       # simulation avec 12 joueurs
node test/screens.js ./captures  # captures d'écran de toutes les phases (nécessite Playwright)
```
