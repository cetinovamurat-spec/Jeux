# Dossier Val d'Aurelle — Plan J4 (mécanique d'audit)

> **Statut** : plan révisé le 15/10/2026, après une revue critique sous trois angles (commissaire aux comptes et conformité au cahier des charges, conception de jeu, architecture du code). Les questions ouvertes ont été tranchées par l'option la plus simple compatible avec le cahier des charges (§0) ; elles sont listées au §2 et seront reportées dans `CLAUDE.md` et `docs/points-a-verifier.md` à la livraison.
>
> Références : cahier des charges §4.5 à §4.7, §5, §6, §7, §9, §10.1 à §10.6, §10.8 à §10.10, §11, §12 ; plan J0 §7 et §10.

## 1. Périmètre

J4 (§12) couvre :

- seuils, risques, programme de travail ;
- procédures, temps et budget ;
- demandes de documents et relances, confirmations ;
- échantillonnage et recalculs (§10.4) ;
- feuilles de travail et feuilles maîtresses ;
- constats, appariement à la clé et tableau des anomalies.

J4 pose aussi les points d'accroche des jalons suivants :

| Jalon | Ce qui est prévu |
|---|---|
| J5 | Revue des travaux délégués (T1 à T4), événements éthiques, effets des jauges, entretiens et confrontation. J4 enregistre déjà les **événements de jauge**, que J5 applique. |
| J6 | Négociation, opinion, notation. J4 renvoie un appariement **par axes** et trace les diligences obligatoires. |

## 2. Principes et décisions

### 2.1 Cinq principes

1. **Lire est gratuit ; obtenir ou produire un élément probant coûte du temps.**
   - Gratuit : consulter la GED, le FEC, la balance, les états et l'analyse.
   - Payant, en heures et en jours : demander une pièce, préparer une confirmation, tirer un échantillon, faire un recalcul, documenter une procédure.
2. **Rien ne révèle la clé hors mode concepteur.**
   - Les demandes sont paramétrées (type × objet) et les réponses génériques sont construites à partir des données.
   - Les outils s'ouvrent sur les hypothèses du client.
   - Les identifiants internes ne sont jamais montrés.
   - Aucun retour ne dit « c'est ici ».
3. **Le temps a un sens.**
   - Chaque membre a une capacité par jour ouvré sur site.
   - Les interlocuteurs ont des délais.
   - Les pièces sont datées : une pièce n'est jamais remise avant d'exister.
4. **Les impacts se calculent à partir des écritures (D3).** Le joueur propose une écriture ; le moteur en tire le résultat, les capitaux propres, la CAF, l'autofinancement net et le bilan, avec le code de la clé.
5. **Ce qui se dérive n'est pas stocké** : phase, arrivées des réponses, heures consommées, appariement, références des feuilles maîtresses. La sauvegarde ne garde que les décisions du joueur.

### 2.2 Décisions (défauts retenus, révisables)

| # | Sujet | Décision |
|---|---|---|
| J4-1 | Début de partie | 03/11/2025 (prise de connaissance et planification). Le mode concepteur peut déplacer l'horloge, y compris en arrière : c'est possible parce que toutes les arrivées sont dérivées (§5). |
| J4-2 | Temps | Avancement explicite : « Jour ouvré suivant » et « Avancer jusqu'au prochain événement », avec la liste de ce qui est attendu. Les membres ont une capacité journalière (7 h par jour ouvré sur site). Une procédure occupe son exécutant ⌈heures / capacité⌉ jours et livre sa feuille de travail à la date de fin. |
| J4-3 | Données selon la date | Trois millésimes (§4) :<br>- comptes certifiés 2024, dès le début ;<br>- extraction au 31/10/2025, sur demande au chef comptable dès la planification ;<br>- balance et FEC définitifs le 06/02/2026 ; états et annexe le 20/02/2026.<br>Avant leur millésime, les écrans de J3 affichent « pas encore disponible – attendu le … ». |
| J4-4 | Budget | 340 h en niveau senior = senior + Léa + Hugo (`hoursByDifficulty`). Les heures de Sofia (auditrice SI) forment une enveloppe à part. Le budget global est contraignant ; les budgets par membre sont indicatifs. Au-delà de 10 % de dépassement, l'associée arbitre, et J4 enregistre l'événement. Le dépassement est « justifié » si les heures supplémentaires portent sur un cycle évalué à risque élevé avant l'exécution, ou sur un cycle ayant un constat ouvert au moins égal au seuil de planification. |
| J4-5 | Procédures | Bibliothèque d'environ 60 procédures (`params/procedures.json`, §7). Chacune a une sortie typée et un critère d'achèvement lié à un vrai travail. Le cabinet propose son programme 2024 (environ 380 h), que le joueur adapte. |
| J4-6 | Demandes | Demandes paramétrées : type × objet choisi dans une liste (§8). Une pièce du scénario répond à son objet. Les autres objets reçoivent une pièce générique construite à partir des données, jamais « rien ici ». Une pièce n'est remise qu'à partir de sa date. Chaque demande coûte un peu de temps au senior ; les demandes inutiles ou en double sont comptées pour J5. |
| J4-7 | Confirmations | Unité : le tiers. Les pièces groupées (gestionnaires de foyers, banques) sont scindées. La préparation se fait à l'intérim et ferme le 06/01/2026, date de l'envoi automatique (§4.6). Ensuite, seules les procédures alternatives restent possibles. Les tiers non-répondants le restent : Accueil Horizons ne répond pas. La relance est une action du joueur ; le texte figé « relance … sans effet » disparaît. |
| J4-8 | Échantillonnage | Populations définies comme des filtres sur les données présentées. Méthodes : éléments spécifiques, aléatoire, systématique, par strates, par unités monétaires. La taille dépend du seuil de planification, du risque et de l'efficacité des contrôles testés. La graine est figée au tirage ; un nouveau tirage coûte des heures et reste visible au débrief. |
| J4-9 | Recalculs | Chaque outil s'ouvre sur le fichier et les hypothèses du client. Il exige d'avoir obtenu la pièce source. L'écart n'apparaît que lorsque le joueur change une hypothèse en citant sa source. Un outil s'exécute dans une procédure et coûte des heures. |
| J4-10 | Feuilles de travail | La feuille d'une procédure est son exécution. La feuille maîtresse est un enregistrement par cycle (N, N-1, variation, références dérivées, conclusion). |
| J4-11 | Constats | Constat structuré, créé « en contexte » depuis tout objet (bloc d'une pièce, écriture du FEC, ligne de balance, case pointée « ≠ », exception d'échantillon, écart de recalcul, confirmation sans réponse). Il comporte :<br>- un traitement proposé ;<br>- une écriture proposée (les impacts sont dérivés) ;<br>- des pièces typées ;<br>- un statut, avec historique.<br>La capture rapide d'une « question » est possible dès le premier jour. |
| J4-12 | Appariement | Score de correspondance, puis affectation un à un. Ses éléments :<br>- objets discriminants (`keyObjects`) ;<br>- traitement ;<br>- cycles acceptés ;<br>- base de crédit par partie ;<br>- tolérance de max(± 5 % du §10.6 ; seuil des anomalies manifestement insignifiantes).<br>Résultat par axes (§13). |
| J4-13 | Fausses pistes | Elles ont une signature. Un constat « écarté » qui lie au moins une pièce de la fausse piste vaut « écartée avec preuves ». Un constat au statut « constat » au-dessus du seuil des insignifiantes vaut « signalée à tort ». Une vraie anomalie l'emporte toujours sur une fausse piste. |
| J4-14 | Fin de J4 | L'horloge court jusqu'à la signature (20/05/2026) pour les événements postérieurs, dont le courrier du mandataire du 15/03/2026 (A15). Après le 13/03, seul le senior est disponible. La synthèse, la négociation et le rapport viennent en J6. |
| J4-15 | Sauvegarde | `schemaVersion` 2. Une partie v1 (J3, au 23/02/2026) repart au 03/11/2025 ; les réglages, les marques de pointage et les requêtes enregistrées sont conservés et un message l'explique. Ajout de `scenarioHash` (verrou du scénario) et de `contentVersion`. Les références orphelines sont nettoyées au chargement. |
| J4-16 | Mémo réglementaire | Reporté à J5. Les mémos techniques du cabinet existent déjà dans la GED. |

## 3. Ce que fait le joueur, phase par phase

1. **Planification** (03 au 14/11/2025, senior seul sur site). Quatre messages de l'associée, adaptés à la phase, rythment la partie (planification, intérim, final, événements postérieurs). Une liste de méthode sur le bureau (« Seuils ☐ Risques ☐ Programme ☐ ») prescrit les étapes sans jamais orienter vers une anomalie. Le joueur :
   - lit le dossier permanent et les PV ;
   - demande l'extraction au 31/10 à Karim (1 jour) ;
   - fait la revue analytique préliminaire : 10 mois 2025 contre 10 mois 2024, tirés du FEC 2024 ;
   - fixe le seuil ;
   - évalue les risques ;
   - adapte le programme proposé et l'affecte.

   « Aller à l'intérim » exige un seuil, des risques et un programme validés ; sinon, un avertissement indique le coût en confiance de l'associée (événement de jauge).
2. **Intérim** (17 au 20/11/2025, équipe sur site). L'équipe exécute :
   - les prises de connaissance et les tests de contrôles ;
   - la revue de la migration, sur l'extraction ;
   - la préparation des confirmations ;
   - les premières demandes.

   Des contrôles efficaces réduisent les tailles d'échantillon du final ; des contrôles défaillants ou non testés les augmentent. En niveau assistant et senior, Antoine rappelle les confirmations en fin d'intérim si rien n'est préparé.
3. **Hors site** (21/11/2025 au 20/02/2026). Le joueur peut avancer d'événement en événement :
   - le 06/01, envoi automatique des confirmations ;
   - réponses des tiers et pièces postérieures à leur date ;
   - le 06/02, balance et FEC définitifs.
4. **Final** (23/02 au 13/03/2026, équipe sur site). Au programme :
   - révision obligatoire du seuil sur le projet de comptes (NEP 320) ;
   - procédures de substance, échantillons, recalculs, pointage (J3), demandes ;
   - procédures alternatives pour les tiers silencieux ;
   - constats, feuilles maîtresses.

   Avant de quitter le final, une fenêtre récapitule les points ouverts.
5. **Après le final** (jusqu'au 20/05/2026, senior seul) : revue des événements postérieurs, lettre d'affirmation (préparation), mises à jour. La synthèse (17 et 19/03) et le rapport relèvent de J6.

## 4. Millésimes de données

`params/game.json` → `dataVintages` est la source unique des dates, et un test vérifie la cohérence avec `documents.json` → `calendar`.

| Millésime | Contenu | Disponible |
|---|---|---|
| `certified2024` | Comptes 2024 certifiés : monde propre, `key.cleanFigures`, colonne N-1 sans A22. Balance, FEC, états et annexe 2024. | Dès le début |
| `interim` | Extraction au 31/10/2025 : balance et FEC des écritures **validées** au plus tard le 31/10/2025, sans lettrage postérieur ; cumul au 31/10/2024 pour la comparaison ; auxiliaire locataires et journal d'interface. Pas d'états ni de ratios, car les écritures d'inventaire et les remboursements annuels manquent. | Sur demande au chef comptable, dès le 03/11 |
| `draft2025` | Balance et FEC définitifs | 06/02/2026 |
| `draft2025` | États, annexe, rapport de gestion | 20/02/2026 |

Mise en œuvre :

- **Façade.** `CaseData.at(vintage)` expose la même API que J3 (`balances`, `balanceRows`, `trialBalances`, `fec`, `fecIndex`, et `statements`, `annex`, `figures` quand ils existent), mise en cache par millésime. `useCase()` renvoie la façade du millésime en vigueur à la date ; les écrans de J3 ne changent pas.
- **Écrans bloqués.** États et pointage, ainsi qu'Analyse, sont bloqués au niveau de la route tant que le millésime manque (entrée de navigation grisée, « disponible le … »). La carte de mission et la palette sont filtrées.
- **FEC de l'intérim.** Il est un **préfixe** du FEC définitif (tri par date de validation) : numéros identiques et découpage sans copie par recherche dichotomique, à tester. Les liens `?ecriture=` et les requêtes enregistrées gèrent le cas « écriture absente de l'extraction ».

## 5. Horloge, capacité et événements

- **État stocké** : `clock: { date }` et `processedUntil`. La phase se déduit de `periodAt(calendar, date)` ; les intervalles entre périodes sont « hors site ».
- **Jours ouvrés du jeu** : `addWorkingDays(date, n, holidays)` dans `src/game/calendar.ts`, avec les jours fériés 2025-2026 dans `params/game.json` (« à vérifier »). `engine/dates.addBusinessDays`, utilisé par le générateur, **n'est pas modifié** : le verrou du scénario reste inchangé.
- **Arrivées dérivées** : réponses aux demandes, réponses de confirmation, pièces `afterDate`, livraisons des feuilles de travail. Ce sont des fonctions pures de l'état et de la date. Le journal affiché fusionne les actions stockées et ces arrivées.
- **Effets** (événements de jauge, arbitrage) : `advanceTo(state, date)` les applique une seule fois, dans l'ordre chronologique, jusqu'à `processedUntil`.
- **Capacité et ordonnancement** :
  - chaque membre a 7 h par jour ouvré sur site ;
  - présence : le senior à la planification, à l'intérim, au final et après le final ; Léa et Hugo à l'intérim et au final ; Sofia à l'intérim et au final, sur son enveloppe ;
  - une procédure lancée s'ajoute à la file de son exécutant ; `schedule()` (pure) calcule les dates de début et de fin ;
  - la capacité non utilisée d'un jour est perdue.
- **Prochain événement** : bouton dans la barre supérieure et liste de ce qui est attendu (réponses, feuilles, millésimes, échéances).

## 6. Planification

### 6.1 Seuils (NEP 320)

- **Base** au choix : loyers nets de RLS, produits des activités, total du bilan, capitaux propres, résultat net. Le montant de la base est **tiré par le moteur** du millésime disponible : comptes 2024, extraction annualisée, puis projet de comptes au final.
- **Pourcentage** : la plage jugée appropriée s'exprime en % de la base choisie (`params/planning.json`), selon le §4.7.
- **Seuils dérivés** :
  - seuil de planification, de 60 à 75 % ;
  - seuil des anomalies manifestement insignifiantes, de 3 à 5 % ;
  - seuil spécifique facultatif pour les conventions réglementées.
- **Justification** : facteurs à cocher, sans minimum de longueur.
  - Facteurs : changement de DAF, migration, constats de l'ANCOLS, part variable du DG, ratio d'autofinancement net proche du taux de référence, utilisateurs des comptes.
  - S'y ajoute un texte libre court.
  - Les facteurs proposés sont génériques ; le §4.2 interdit de lister les facteurs du cas tels quels, donc la liste reste celle des facteurs usuels d'un organisme HLM.
- **Révision obligatoire au final** sur le projet de comptes, avec l'historique des deux valeurs. J6 évalue le seuil final.
- **Usages** : le seuil de planification alimente les seuils par défaut de la revue analytique (PV-75) et la taille des échantillons.
- **Réaction de l'associée** : en niveau assistant et senior, elle réagit à un seuil hors plage.

### 6.2 Risques (NEP 315, 240, 250, 330)

- **Comptes significatifs par cycle** : montant comparé au seuil de planification, sur le millésime disponible.
- **Matrice** :
  - niveau par cycle (faible, modéré, élevé ou risque important), « modéré » par défaut ;
  - précision facultative par assertion ;
  - justification exigée seulement pour « élevé » et « risque important ».
- **Facteurs de risque** : le joueur les capture depuis les passages des pièces (« Marquer comme facteur de risque » sur un bloc, avec cycle et assertion). Cela réutilise les annotations de J3, et J6 les rapproche des blocs indices.
- **Présomption de fraude sur les produits**, par type de produit (`params/planning.json`) :
  - quittancement récurrent : réfutable ;
  - régularisation des charges, produits à recevoir, produits annexes et refacturations, ventes HLM (séparation des exercices), reprises de provisions : retenue.
  - La formulation de la NEP 240 reste à vérifier.
- **Contournement des contrôles par la direction** : toujours retenu. Il ajoute automatiquement au programme les réponses obligatoires : tests d'écritures, revue rétrospective des estimations (PGE et dépréciation 2024), opérations inhabituelles.
- **Lois et règlements** (NEP 250) : liste séparée (plafond de révision des loyers, charges récupérables, conventions réglementées, autofinancement net).
- **Révisions datées** : une révision est possible à tout moment ; la découverte d'un indice de fraude doit conduire à réévaluer.
- **Couverture** : vue risque → procédures, avec les risques non couverts. Le risque résiduel par cycle est calculé et masqué jusqu'au débrief.

### 6.3 Programme de travail (NEP 300, 330)

- **Point de départ** : Antoine propose le **programme 2024 du cabinet** (`params/procedures.json` → `firmProgramme2024`). Il est générique et réaliste, sans revue de la migration et avec une revue légère de la PGE, pour environ 380 h. Le joueur ajoute, retire et réaffecte.
- **Filtres de la bibliothèque** : par cycle, par risque couvert (« procédures couvrant vos risques élevés »), par phase.
- **Budget** : prévisionnel par membre et total, comparé au budget ; les transferts entre membres sont libres.

## 7. Procédures

### 7.1 Schéma de `params/procedures.json`

Chaque procédure porte :

- `id`, `cycle`, `title`, `objective`, `assertions[]`, `risksAddressed[]` ;
- `hours` par profil : `senior`, `assistant` (Léa), `intern` (Hugo), `itAuditor` (Sofia) ;
- `phases[]`, déduites des données requises : un test de contrôle peut se faire au final et couvrir l'exercice ;
- `requires` : millésime, pièces obtenues, procédure préalable ;
- `mandatory` : diligences du §10.8 (événements postérieurs, lettre d'affirmation, tests d'écritures, contrôle du comparatif) et maintien de la mission et indépendance ;
- `output` : sortie typée (§7.2) ;
- `completion` : critère d'achèvement (§7.3) ;
- `delegated` : contenu produit quand la procédure est confiée à Léa ou à Hugo. Il est tiré de la clé (pièces et indices mis en évidence, conclusion) et réservé à J5 pour les variantes fautives T1 à T4.

### 7.2 Sorties typées

| `output.kind` | Effet |
|---|---|
| `view` | Ouvre un outil de J3 (FEC, pointage, GED filtrée, analyse) avec un bandeau « Travail en cours : … ». Ce qui est produit est rattaché automatiquement à la feuille (requêtes, cases pointées, annotations). |
| `requests` | Envoie un lot de demandes paramétrées (§8). |
| `confirmations` | Ouvre la préparation des confirmations (§9). |
| `sample` | Crée un échantillon sur la population de la procédure (§10). |
| `recalc` | Ouvre l'outil de recalcul sur son périmètre (§11). |
| `memo` | Produit un document de travail du cabinet : lettre d'affirmation préparée, mise à jour des événements postérieurs, etc. |

### 7.3 Critères d'achèvement

Le critère d'achèvement rend la procédure vraie, et non une simple case cochée. Exemples :

- **Tests d'écritures** : requêtes enregistrées couvrant au moins les critères usuels (validation après la clôture, utilisateurs, montants ronds, couples rares, week-ends).
- **Pointage du comparatif** : au moins N % des cases N-1 pointées.
- **Revue des événements postérieurs** : exécutée après le 01/01/2026, puis mise à jour à la signature.

Une feuille sans conclusion ou sans référence est signalée par un contrôle de forme du manager, qui ne révèle rien.

### 7.4 Calibrage

Des tests vérifient le calibrage :

- la bibliothèque entière au profil le moins cher vaut environ 450 h ± 10 % (§4.6) ;
- le programme du cabinet vaut environ 380 h ;
- un programme de référence scripté couvre toutes les parties et toutes les diligences obligatoires en 340 h ou moins (niveau senior).

Environ 25 procédures « productives » portent l'essentiel de la détection ; les autres sont réalistes mais sans indice.

### 7.5 Procédures efficaces

`Debrief.procedures` (texte libre aujourd'hui) devient une liste d'identifiants de procédures. Un test vérifie que chaque partie a au moins une procédure efficace, exécutable dans une phase où ses indices sont disponibles.

## 8. Demandes et courrier

### 8.1 Catalogue paramétré

`params/requests.json` déclare des **familles** : type, interlocuteur, paramètre et constructeur de la réponse générique. Exemples :

- pièce justificative d'une écriture du FEC (bouton sur une écriture, une ligne du grand livre ou un élément d'échantillon) ;
- factures et bons de commande d'un programme ;
- quittancement d'un programme pour un mois ;
- ordres de service et avenants d'une opération ;
- PV de réception d'une opération ;
- dossier de marché d'un fournisseur ;
- correspondance du notaire sur une vente ;
- conventions avec un tiers ;
- registre des composants d'un programme ;
- relevés bancaires d'un mois ;
- extraction au 31/10 ;
- pièces de clôture (une par type).

### 8.2 Pièces du scénario

`Availability.onRequest.request` (libellé) devient `requestId` plus le paramètre. Les pièces du scénario répondent à leur couple (famille, objet) : PEU, ERA et CLF se retrouvent ainsi parmi leurs voisins. Le registre des composants est servi **par programme demandé**, et non comme un extrait présélectionné.

### 8.3 Réponses génériques

Les autres objets reçoivent une pièce construite par le même constructeur à partir des jeux de données (factures, quittancement, composants, conventions), sans indice. Une réponse ne signale donc jamais « rien ici ».

### 8.4 Dates

- Date de réponse = max(envoi + délai de l'interlocuteur, date de la pièce).
- Avant la date de la pièce, la réponse est « pas encore établi, disponible à partir du … ». La demande reste ouverte et elle est servie automatiquement à la date de la pièce plus le délai.
- Relance possible après l'échéance.
- `receivedOn` est dérivé : il sert au tampon « Reçu le » et au tri.

### 8.5 Coût et intégration

- Une demande coûte 0,25 h au senior.
- Les doublons et les demandes sans lien avec un risque, un cycle ou un constat sont comptés (événements pour J5).
- Les demandes et le courrier reçu entrent dans la **GED** : onglet « Demandes et confirmations », boîte « Courrier reçu » triée par date avec badges non lus. Il n'y a pas d'écran séparé.

## 9. Confirmations

- **Unité.** Le tiers.
- **Tiers proposés.** Ils sont tirés des données, avec des fonctions pures :
  - prêteurs (registre des emprunts) et banques ;
  - notaires des ventes de 2025-2026 ;
  - avocats payés en 2025 ;
  - financeurs avec subventions à recevoir ;
  - fournisseurs par volume (GIE, entreprise générale des Tilleuls F0022, Bâti-Rénov Est, etc.) ;
  - débiteurs (gestionnaires de foyers, avance à l'ESH sœur).
- **Réponses.** Les pièces groupées actuelles (`confirmations-gestionnaires`, `confirmations-banques`) sont scindées par tiers. Les tiers sans pièce de scénario reçoivent une réponse « sans écart » construite à partir des soldes. F0022 confirme sa créance de 210 k€ et sa contestation des pénalités, en cohérence avec la réponse de l'avocate.
- **Calendrier.** Préparation à l'intérim (coût en heures), clôturée le 06/01/2026 par l'envoi automatique. Les dates de réponse restent celles des pièces, calculées depuis le 06/01.
- **Non-réponse et relance.** Accueil Horizons ne répond pas : son statut « sans réponse » se lit dans le suivi, et la relance est une action du joueur. Le texte « relance du … sans effet » est retiré de la pièce.
- **Procédures alternatives.** Elles sont listées par tiers dans `procedures.json` : encaissements postérieurs sur les relevés de janvier et février 2026, conventions, tableaux d'amortissement, actes, courrier arrivé. Une non-réponse sans procédure alternative est une diligence manquante (J6).
- **Rapprochement.** Le joueur rapproche la réponse de la comptabilité (Banque des Territoires : 307,5 M€ contre 305,0 M€ → A18). C'est le support de T1 en J5.

## 10. Échantillonnage (`src/engine/sampling.ts`, pur)

- **Populations.** Ce sont des filtres sur le FEC et les jeux de données présentés, dans un ordre canonique :
  - travaux immobilisés sur patrimoine en service : débits 21x hors 2312 et 2313 et hors virements internes, où figure l'OD d'A06 ;
  - situations de construction (2313) : rapprochement marchés et situations par opération ;
  - charges d'entretien ;
  - factures 2026, pour la recherche de passifs non comptabilisés ;
  - quittancement par programme et par mois, sélectionné par l'auditeur et non par le client ;
  - créances locataires ;
  - emprunts.
- **Méthodes** : éléments spécifiques (sans extrapolation), aléatoire, systématique, par strates, par unités monétaires. Pour les unités monétaires : strate haute testée à 100 %, éléments négatifs exclus, projection.
- **Taille.** Fonction du seuil de planification (anomalie tolérable), d'un facteur de confiance tiré du risque évalué et de l'efficacité des contrôles testés, et de l'anomalie attendue (`params/sampling.json`, « à vérifier »). Pour les tests de contrôles : table des tailles par fréquence du contrôle. Les tailles restent petites (10 à 25 éléments pour les tests de détail usuels).
- **Exécution.** L'échantillon est une table d'éléments avec leurs attributs (date, libellé, tiers, bon de commande, programme, compte). Chaque élément a sa marque (réutilisation du pointage de J3, clés `sample:<id>:<item>`) et une demande « pièce justificative » (rendu générique à partir des `refs` des lignes et des jeux de données). Une exception crée un constat extrapolé.
- **Stockage.** Graine, paramètres **et** clés des éléments tirés (une centaine de chaînes courtes au plus). L'échantillon est figé ; une nouvelle graine crée un nouvel échantillon, qui coûte des heures et est tracé.
- **Tests.**
  - L'OD d'A06 est dans la population des travaux immobilisés.
  - L'échantillon de référence la retient dans au moins 90 % des graines.
  - La règle de T2 (acquisitions de plus de 500 k€) l'exclut.
  - A17 et A20 sont dans leurs populations.

## 11. Recalculs

Un outil prend trois entrées et s'exécute dans sa procédure, à son coût en heures :

1. **Le fichier client** : projection présentée sur une liste blanche de champs, accessible seulement si la pièce source a été obtenue. Pièces sources : `registre-composants` (par programme), `calcul-icne`, PPE de la DAF ou PPE officiel, calcul de la dépréciation des créances, notes de loyers.
2. **Les hypothèses**, celles du client par défaut. Le joueur les modifie en citant leur source (bloc d'une pièce, paramètre du mémo) :
   - date de mise en service et ventilation par composant ;
   - durée résiduelle jusqu'à la démolition ;
   - taux de la méthode de l'annexe ;
   - version du PPE ;
   - taux du Livret A ;
   - IRL et plafond de révision.
3. **Le montant comptabilisé**, à la même maille que la comptabilisation (prêt, programme × compte, compte 491x).

Les outils prévus :

- amortissements par composant ;
- ICNE par prêt ;
- dépréciation des créances ;
- PGE contre PPE ;
- révision des loyers contre le plafond (A17, T4) ;
- prorata temporis.

Règles :

- **Garde-fou** : les outils ne lisent jamais les champs qui trahissent la clé (`inOfficialPlan`, `writeOff.reason`, `serviceYear`, version de la DAF hors pièce obtenue).
- **Stockage** : outil, périmètre, hypothèses avec leur source, résumé (calculé, comptabilisé, écart). Jamais les lignes de détail.
- **Tests** :
  - avec les hypothèses du client, l'écart est nul ;
  - avec les hypothèses du monde propre, l'outil reproduit le montant de correction de la clé (A01, A02, A04, A05, A07.a et A07.b, A08, A15, A17) ;
  - sur un périmètre sans anomalie, il reproduit le monde propre.

## 12. Feuilles maîtresses

`params/cycles.json` associe à chaque cycle des préfixes de comptes et des lignes d'états. La feuille maîtresse d'un cycle comporte :

- N, N-1 et la variation, au millésime en vigueur ;
- des références dérivées (exécutions, échantillons, recalculs, constats, requêtes, pièces liées du cycle) et des épingles facultatives ;
- une ligne « variation expliquée » avec ses pièces, qui permet d'écarter F1, F3 et F5 ;
- une conclusion choisie dans une liste, avec un commentaire.

Une conclusion « satisfaisant » sur un cycle où une partie significative a été manquée alors que sa procédure efficace a été exécutée est un point de revue qualité pour J6.

## 13. Constats, appariement, tableau des anomalies

### 13.1 Constat

**Champs** :

- `cycle` (proposé selon le contexte) ;
- `objects[]` (3 au maximum) ;
- `natures[]` (2 au maximum) ;
- `classification` : factuelle, de jugement ou extrapolée ;
- `treatments[]` : ajustement, reclassement, annexe, rapport de gestion, rapport spécial, irrégularité ou communication à la gouvernance, faiblesse de contrôle interne ;
- `proposedEntry` : lignes compte, débit, crédit, équilibrées, sur les comptes du plan ;
- `evidence[]` typées : `{ kind: 'doc', docId, block? } | { kind: 'fec', year, num } | { kind: 'sample' | 'recalc' | 'query' | 'execution' | 'confirmation', id }`. Jamais l'identifiant interne d'une écriture.
- `status` : question, constat, écarté, clos ; avec son historique daté ;
- `escalatedToPartnerOn` ;
- `comment` libre, que le moteur ne lit pas.

**Objets** :

- Nouveau genre d'objet `disclosureItem`, en liste fermée dans les paramètres :
  - annexe : engagements de retraite, tableau des provisions, passifs éventuels, engagements hors bilan, parties liées ;
  - rapport de gestion : délais de paiement, vacance, autofinancement net.
- Le catalogue d'objets proposé au joueur est construit **sans importer les anomalies** (aucune fuite par la composition des listes).

**Impacts.** Ils sont dérivés par `impactOfLines(presentedFigures, lines)`, à côté d'`impactBetween` dans `anomalies/presented.ts` : résultat, capitaux propres, CAF, autofinancement net, rubriques du bilan.

### 13.2 Appariement (`src/game/matching.ts`)

**Ajouts à `AnomalyPart`** :

- `cycles` acceptés : le principal plus des alternatifs. Exemples : A09 en immobilisations ; A07 et A21 en provisions ; A11 en loyers ; A12 en dettes ou en immobilisations ; A15 en transverse ; A16 en provisions ; A13 en provisions ; A22 en dettes.
- `keyObjects` discriminants : au moins un est requis quand des parties sœurs partagent leurs objets (A12.i à A12.iii, A14.i à A14.iii, A10.a et A10.b, A16.a et A16.b, A01 et A16 sur les Tilleuls, A11 et A15).
- `creditBasis`, dérivée du traitement et des impacts de la clé :
  - `result` : ajustement ;
  - `equity` : A09 ;
  - `reclassified` : somme des débits de l'écriture de correction (A01 pour le reclassement, A07.c, A18, A16.a pour la dette) ;
  - `disclosure` : crédit sur la signature, le traitement, le `disclosureFix` attendu et les preuves.
- Tolérances en % de l'impact calculé, jamais en euros littéraux. La plage d'A07.a est réécrite en proportion.

**Score** : cycle accepté, objets communs (objets et pièces liées, comptes par préfixe), traitement compatible, natures (qualité, pas condition).

**Affectation** : un à un, par score décroissant, les égalités étant départagées par l'ordre canonique. Un constat peut couvrir plusieurs parties d'une même anomalie si son montant correspond à leur somme (A10 en un seul constat). Les doublons sont neutres.

**Tolérance** : max(± 5 %, seuil de référence des anomalies insignifiantes) ; montants signés (A08 est négatif).

**Résultat** :

```
{ partId | falseLeadId | null, detected, quantified, treatmentOk, classificationOk, evidenceOk }
```

J6 pondère la détection (35 %) et le jugement et la quantification (15 %) séparément.

**Extrapolé** (A08 sur un échantillon de prêts) : la détection est créditée ; la quantification est acceptée dans une plage élargie, ou sur un recalcul étendu à la population.

**Fausses pistes** : `signature` ajoutée en TypeScript dans `false-leads.ts` (helpers `prog`, `acct`, `doc`, `tp`), avec des objets discriminants : F2 → réclamation et avis de dégrèvement de TFPB ; F7 → note de migration et rapprochement de la reprise des soldes ; F6 → rapprochement bancaire ; F4 → Bâti-Rénov Est et dossier de marché. Un test vérifie les collisions entre anomalies et fausses pistes.

**Fin du final** : les questions encore ouvertes deviennent des « points en suspens », pénalisés en J6.

**Garde-fou** : `game/matching` et `case.key` ne sont importés que par les fichiers du mode concepteur et par les règles de J6 ; un test le vérifie.

### 13.3 Tableau des anomalies

Il est construit à partir des constats au statut « constat ». Il applique **toutes** leurs écritures **en une fois**, car le ratio d'autofinancement net n'est pas additif. Il présente :

- surévaluations et sous-évaluations séparées ;
- anomalies sous le seuil des insignifiantes, listées mais non cumulées ;
- anomalies individuellement significatives, signalées ;
- cumul comparé aux trois seuils ;
- ratio d'autofinancement net corrigé (exercice et moyenne triennale) comparé aux taux de `regulatory.json` ;
- une colonne `correctionStatus`, vide, remplie en J6.

Les impacts de référence de la clé ne s'affichent qu'en mode concepteur.

## 14. Difficulté et aides (§10.9)

`params/game.json` → `difficulty`, par niveau :

- `responseDelayFactor` ;
- rappels (confirmations, liste de fin de phase) ;
- `aidCost` ;
- clémence de la relation client (appliquée en J5).

Aide « Demander conseil à Antoine » : elle désigne un cycle à risque évalué dont les procédures efficaces n'ont pas encore été exécutées, formulée en termes de méthode et jamais d'anomalie.

| Niveau | Coût de l'aide |
|---|---|
| Assistant | Gratuite |
| Senior | Coûte de la confiance de l'associée (événement) |
| Manager | Indisponible |

## 15. Modèle de données (`GameState` v2) et persistance

**Organisation.**

- Un module par section dans `src/game/`, propriétaire de ses types, de ses actions pures et de son sous-schéma Zod : `planning`, `program`, `requests`, `confirmations`, `samples`, `recalcs`, `findings`, `worksheets`, `gauges`.
- `persistence.ts` compose ces sous-schémas.
- `state.ts` ne garde que la composition et les sections de J3.

**Sections stockées.**

- `clock { date }`, `processedUntil` ;
- `materiality` : choix, justification, historique ;
- `risks` : table creuse « cycle[:assertion] » → { niveau, justification, date } ; facteurs capturés (références de blocs) ; présomption de fraude par type de produit ; liste des lois et règlements ;
- `program` : procédures planifiées et affectées ;
- `executions` : feuille de la procédure, avec préparateur, dates, références, conclusion, et champs de revue pour J5 (`reviewedBy`, `reviewedOn`, `reviewStatus`, `returnComment`) ;
- `requests` et `confirmations` : décisions et dates d'envoi et de relance ; les arrivées sont dérivées ;
- `samples` : graine, paramètres, clés tirées ;
- `recalcs` : hypothèses, sources, résumé ;
- `masterSheets` : `Record<Cycle, …>` ;
- `findings` ;
- `gaugeEvents` : `{ on, gauge, reason, ref }` ; appliqués en J5, journalisés dès J4 ;
- `arbitrations`.

**Journal** structuré : `{ on, kind, ref?, data? }`, pour la chronologie de J6.

**Versions et migration.**

- `scenarioHash` est importé statiquement de `scenario.lock.json` ; `contentVersion` est une constante. En cas d'écart : avertissement et nettoyage des références orphelines, dont la liste est affichée.
- Migration v1 → v2 : §2.2, J4-15.

**À supprimer ou réécrire en J4a** : les brouillons de types du plan J0 (`src/game/types.ts`, `src/scenario/types.ts`), qui contredisent le code réel.

**Réactivité.**

- Des sélecteurs étroits remplacent l'abonnement de la coquille à tout l'état.
- Les brouillons de formulaire vivent dans des stores d'écran et ne sont validés que par une action explicite (pas d'action par frappe).

## 16. Paramètres et intégrité

**Nouveaux fichiers de paramètres :**

- `procedures.json` ;
- `requests.json` ;
- `planning.json` : bases, plages, facteurs, types de produits, lois et règlements, matrice de référence pour J6 ;
- `sampling.json` ;
- `cycles.json` ;
- `disclosure-items.json` ;
- `game.json` étendu : millésimes, jours fériés, présence sur site, capacité, difficulté.

Chaque fichier a son schéma Zod dans un fichier à part (`src/scenario/schema-j4.ts`), avec des énumérations dérivées du code.

**Test d'intégrité Vitest** (les pièces n'existent qu'après la génération) :

- chaque pièce `onRequest` a un `requestId` existant, le bon interlocuteur, et une date plus délai au plus tard le 13/03/2026 ;
- chaque demande du scénario débloque au moins une pièce ;
- chaque procédure ne référence que des pièces, demandes, outils et indices existants ;
- chaque partie a au moins une procédure efficace ;
- chaque objet de signature est dans le catalogue d'objets du joueur ;
- les calendriers sont cohérents.

**Évaluateur `src/game/conditions.ts`** (pur, réutilisé en J5) : il évalue des conditions sur l'état (pièces obtenues, procédures exécutées, dates).

## 17. Écrans

| Écran | Route | Contenu |
|---|---|---|
| Bureau | `/` | Date, phase, prochain événement, liste de méthode, messages de l'associée par phase, budget par membre et capacité, points ouverts |
| Planification | `/planification` | Onglets Seuils, Risques, Programme (bibliothèque, programme du cabinet, affectation, prévisionnel contre budget, couverture des risques) |
| Travaux | `/travaux` | Exécutions : lancer, suivre, feuille, références, conclusion. Feuilles maîtresses par cycle. Les outils (échantillon, recalcul) s'ouvrent ici, depuis une procédure. |
| GED | `/ged` | En plus : onglet « Demandes et confirmations », boîte « Courrier reçu » |
| Constats | `/constats` | Liste, formulaire, tableau des anomalies. Les constats se créent aussi en contexte depuis la GED, le FEC, le grand livre, la balance, les états, les échantillons, les recalculs et les confirmations. |
| Barre supérieure | — | Budget réel, jauges (valeurs dérivées des événements en J5), bouton « Prochain événement » |

## 18. Tests (en plus des tests d'intégrité du §16)

**Horloge** :

- jours ouvrés du jeu ;
- capacité et ordonnancement ;
- arrivées dérivées, idempotence ;
- recul de l'horloge en mode concepteur ;
- effets appliqués une seule fois.

**Millésimes** :

- le FEC de l'intérim est un préfixe du FEC définitif, avec des numéros identiques ;
- la balance de l'intérim est cohérente avec le FEC filtré ;
- aucun lettrage n'est postérieur à la date d'extraction ;
- écrans bloqués avant leur millésime.

**Le reste** :

- demandes : dates, « pas encore établi », réponses génériques sans indice, coût, doublons ;
- confirmations : scission par tiers, non-réponse, relance, procédures alternatives ;
- échantillonnage : déterminisme, tailles, strates, unités monétaires, couverture d'A06, A17 et A20, exclusion par T2 ;
- recalculs : §11 ;
- appariement :
  - fixture de constats « d'expert » écrite à partir du §5 (au moins deux formulations par partie, variante minimale, constat A10 combiné), indépendante des signatures ;
  - matrice de collisions entre parties sœurs et avec les fausses pistes ;
  - cas négatifs (constat fourre-tout, mauvais tiers, mauvais programme) ;
  - parties sans impact sur le résultat ;
- tableau des anomalies : application en une fois, CAF et ratio corrigés ;
- calibrage des heures (§7.4) ;
- persistance : migration v1 → v2, nettoyage des orphelins ;
- garde-fous : rien n'est révélé hors mode concepteur ; aucun import de `matching` ni de `case.key` hors fichiers autorisés.

Les tests d'intégration sur le dossier généré sont regroupés dans peu de fichiers ; les règles pures utilisent des fixtures légères.

## 19. Découpage et parallélisation

1. **J4a — socle**, en séquence. Le moteur d'appariement (D) démarre en parallèle, sur des fixtures.
   - Millésimes, façade `CaseData.at` et blocage des écrans de J3.
   - Horloge (calendrier du jeu, capacité, arrivées dérivées, `advanceTo`).
   - `GameState` v2 : toutes les sections vides, un module par section, migration, `scenarioHash`.
   - Nouveaux fichiers de paramètres avec leurs schémas.
   - `availabilityContext(state, case, date)` dans `src/game`.
   - Toutes les routes avec un écran provisoire ; bureau et barre supérieure vivants.
2. **J4b — planification et travaux.** Agent B, propriétaire de `game/planning`, `game/program`, `game/worksheets`, `params/procedures.json`, `planning.json` et `cycles.json`, et des écrans Planification et Travaux.
3. **J4c — preuves.** Agent C, propriétaire de `game/requests`, `game/confirmations`, `engine/sampling`, `game/samples`, `game/recalcs`, `params/requests.json` et `sampling.json`, des constructeurs de réponses génériques et de la scission des confirmations dans `src/scenario/documents` (seul à modifier ce dossier), des onglets de la GED et des outils.
4. **J4d — constats.** Agent D, propriétaire de `game/findings` et `game/matching`, `impactOfLines`, des ajouts à `anomalies/types.ts` et `modules/` (cycles, `keyObjects`, `creditBasis`, tolérances), des signatures des fausses pistes, de `disclosure-items.json`, de l'écran Constats et des actions « créer un constat en contexte ».
5. **Intégration** : programme de référence scripté (340 h), revue adversariale, documentation, commit J4.

## 20. Reporté

- J5 : mémo réglementaire, variantes fautives T1 à T4 et revue, effets des jauges, messagerie complète.
- J6 : lettre d'affirmation complète.
- J7 : tutoriel détaillé.

**Annexe à produire en J4a** : observabilité de chaque anomalie par phase (planification, intérim, final, après le final) et par millésime, avec un test qui vérifie que chaque partie reste détectable dans sa fenêtre.
