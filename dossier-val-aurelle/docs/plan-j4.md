# Dossier Val d'Aurelle — Plan J4 (mécanique d'audit)

> **Statut** : brouillon de travail (15/10/2026), à confronter à une revue critique avant le développement. Les choix ci-dessous sont des défauts « les plus simples » au sens du §0 du cahier des charges ; ils seront reportés dans `CLAUDE.md` et `docs/points-a-verifier.md` à la livraison de J4.
>
> Références : cahier des charges §4.6, §4.7, §5, §9, §10.1 à §10.6, §11, §12 ; plan J0 §7 et §10.

## 1. Périmètre

Le §12 du cahier des charges fixe J4 : **seuils, risques, programme, procédures, temps et budget, demandes de documents, confirmations, feuilles de travail, constats**, plus les outils du §10.4 qui n'existent pas encore : **échantillonnage** et **recalculs**.

Hors J4 :

- J5 : entretiens, confrontation, revue des travaux de l'équipe (T1 à T4), événements éthiques, messagerie, effets des jauges.
- J6 : négociation, opinion, rapports, scoring.

J4 prépare toutefois les points d'accroche de J5 et J6 : les travaux délégués produisent une feuille de travail « à revoir », et les constats portent déjà leur appariement à la clé.

## 2. Décisions proposées (défauts)

| # | Sujet | Défaut proposé | Alternative écartée |
|---|---|---|---|
| J4-1 | Début de partie | 03/11/2025, début de « Prise de connaissance et planification » (calendrier de `params/game.json`). Le mode concepteur peut sauter à n'importe quelle date. | Commencer au final (J3) : perd les phases 1 à 6 du §10.1. |
| J4-2 | Avancement du temps | Explicite : « Jour ouvré suivant » et « Aller au début de la phase suivante ». Les événements datés se déclenchent pendant le saut : réponses aux demandes, envoi automatique des confirmations le 06/01/2026, réponses des tiers, courriers postérieurs. Les procédures consomment des heures, pas de jours. | Horloge pilotée par les heures consommées (capacité journalière par membre) : plus réaliste mais lourde, et opaque pour le joueur. |
| J4-3 | Données comptables disponibles selon la date | Avant l'intérim : comptes certifiés 2024 et dossier permanent. À l'intérim : extraction au 31/10/2025 (balance et FEC des écritures validées au plus tard le 31/10/2025). À partir du 20/02/2026 : projet de comptes, balance et FEC définitifs (écrans de J3). Le projet d'annexe et le rapport de gestion arrivent à leur date. | Tout disponible dès le début : incohérent avec le calendrier et rend l'intérim inutile. |
| J4-4 | Budget | Heures par membre (`hoursByDifficulty`), consommées au coût de la procédure selon le profil. Dépassement global toléré jusqu'à 10 % ; au-delà, blocage des nouvelles procédures tant que le joueur n'a pas demandé un arbitrage à l'associée (J5 en donnera le contenu ; en J4, l'arbitrage est accordé avec perte de confiance si aucun risque documenté ne le justifie). | Budget unique sans profils. |
| J4-5 | Procédures | Bibliothèque d'environ 60 procédures dans `params/procedures.json`. Chaque procédure porte : cycle, intitulé, objectif, assertions, heures par profil, phases autorisées, prérequis (données disponibles, documents obtenus), sorties (vues ou outils déverrouillés, demandes de documents déclenchées, feuille de travail produite). Exécuter consomme les heures du membre affecté et produit une feuille de travail. | Procédures sans effet mécanique (simple case à cocher) : la bibliothèque n'aurait aucun intérêt de jeu. |
| J4-6 | Demandes de documents | Catalogue fermé dans `params/requests.json` : chaque demande a un libellé générique, un interlocuteur et une catégorie. Le catalogue contient les demandes qui débloquent un document du scénario (`availability.onRequest`) et environ autant de demandes « de routine » (réponse standard ou document déjà remis), pour ne rien révéler. Délai de réponse par interlocuteur (`responseDelaysBusinessDays`) ; relance possible après le délai. | Saisie libre de la demande : appariement au texte impossible sans texte libre (§10.6). |
| J4-7 | Confirmations | Préparées pendant l'intérim : choix des tiers dans la liste (banques, Banque des Territoires, notaire, avocate, Département, gestionnaires de foyers, ESH sœur, GIE, plus des tiers sans enjeu) et des informations demandées. Envoi automatique le 06/01/2026. Les réponses arrivent à leur date ; un tiers sans enjeu ne répond pas, ce qui appelle une procédure alternative. Une demande préparée après l'intérim part le jour même, avec la date de réponse décalée d'autant. | Envoi manuel au moment choisi : contredit le §4.6. |
| J4-8 | Échantillonnage | Moteur pur (`src/engine/sampling.ts`) sur des populations dérivées du monde présenté : factures fournisseurs, acquisitions d'immobilisations, comptes locataires, écritures du FEC, emprunts. Méthodes aléatoire, systématique, par strates et par unités monétaires ; graine affichée et modifiable ; taille calculée à partir du seuil de signification, du niveau de confiance et du risque. L'échantillon est enregistré dans la feuille de travail. | Échantillon tiré par le moteur sans paramètres visibles. |
| J4-9 | Recalculs | Outils guidés sur les sous-ledgers présentés : amortissements par composant, ICNE par prêt, dépréciation des créances selon la méthode de l'annexe, PGE selon le PPE, prorata temporis. Chacun compare le recalcul au montant comptabilisé et affiche l'écart, que le joueur peut reprendre dans un constat. | Recalcul « magique » d'un compte entier : révèle les anomalies sans travail. |
| J4-10 | Feuilles de travail | Une feuille maîtresse par cycle : N, N-1, variation, références des travaux (procédures, documents, requêtes FEC, échantillons, recalculs), conclusion choisie dans une liste avec commentaire. | — |
| J4-11 | Constats | Formulaire structuré du §10.6, sans texte libre pour l'appariement : cycle, objets choisis dans des listes, natures, classification, impacts proposés, écriture de correction proposée (comptes et montants), pièces liées, statut (question, constat, clos). Un commentaire libre reste possible, mais il n'est pas lu par le moteur. | — |
| J4-12 | Appariement | Une partie d'anomalie est candidate si le cycle est le même, si au moins un objet est commun et si au moins une nature est commune. Le crédit est complet si l'impact sur le résultat proposé est dans la tolérance de la partie (`tolerance`, sinon ± 3 %, ± 10 % pour A08), partiel sinon. Un constat qui ne correspond à rien est un faux positif, sauf au statut « question ». Un constat qui correspond à une fausse piste (signature de F1 à F7) est « signalé à tort ». | Appariement par mots-clés. |
| J4-13 | Tableau des anomalies | Construit à partir des constats au statut « constat » : impacts proposés sur le résultat, les capitaux propres, la CAF et le ratio d'autofinancement net ; cumul comparé au seuil de signification, au seuil de planification et au seuil des anomalies manifestement insignifiantes. Les impacts « de référence » de la clé ne sont montrés qu'en mode concepteur. | — |
| J4-14 | Sauvegarde | `schemaVersion` 2, avec une migration depuis la version 1 (J3) qui ajoute les nouvelles sections vides. | Repartir de zéro. |

## 3. Boucle de jeu et horloge

1. Le joueur arrive le 03/11/2025 au bureau. Le premier message de l'associée renvoie à la planification.
2. **Planification** (03 au 14/11/2025) :
   - lecture du dossier permanent et des PV ;
   - revue analytique préliminaire sur les comptes 2024 ;
   - seuils ;
   - risques ;
   - programme de travail et affectations.
3. **Intérim** (17 au 20/11/2025) :
   - procédures de contrôle interne et revue de la migration (extraction au 31/10/2025) ;
   - préparation des confirmations.
4. Saut jusqu'au final, avec l'envoi automatique des confirmations le 06/01/2026.
5. **Final** (23/02 au 13/03/2026) :
   - procédures de substance, demandes de documents, échantillonnage, recalculs, pointage (J3) ;
   - constats et feuilles maîtresses.
6. **Synthèse** (J6).

**Règles de l'horloge.** Les jours ouvrés excluent les samedis, les dimanches et les jours fériés français 2025-2026, listés en paramètre et signalés « à vérifier ». Avancer le temps applique, dans l'ordre chronologique, les événements datés compris entre l'ancienne et la nouvelle date. Le journal de mission les enregistre.

**Contraintes de phase.** Chaque procédure indique les phases où elle peut être exécutée. Exemples : les tests de contrôles se font à l'intérim ; la circularisation se prépare à l'intérim ; les procédures sur les comptes définitifs se font au final. Une procédure hors phase est refusée avec une explication.

## 4. Modèle de données (`GameState` v2)

Champs ajoutés :

- `clock` : `{ date, phase }`.
- `materiality` :
  - choix du joueur : base (loyers, produits des activités, total du bilan, capitaux propres, résultat net), pourcentage, montant calculé, seuil de planification (%), seuil des anomalies manifestement insignifiantes (%), seuil spécifique facultatif (conventions réglementées) ;
  - justification écrite (obligatoire, longueur minimale) ;
  - date de validation.
- `risks` :
  - matrice cycle × assertion : niveau (faible, modéré, élevé) et justification ;
  - présomption de fraude sur les produits : réfutée ou retenue, par type de produit ;
  - contournement des contrôles par la direction : toujours retenu, non modifiable.
- `program` : procédures planifiées `{ procedureId, assignee, plannedHours }`.
- `executions` : procédures exécutées `{ id, procedureId, assignee, hours, date, worksheetId, status }`.
- `hours` : heures consommées par membre (dérivées des exécutions, recalculées et non stockées si possible).
- `requests` : `{ id, requestId, sentOn, dueOn, remindedOn?, answeredOn? }`.
- `confirmations` : `{ id, thirdPartyId, items, preparedOn, sentOn, dueOn, answeredOn?, noResponse? }`.
- `samples` : `{ id, population, method, seed, size, parameters, items }` (les éléments sont recalculables depuis la graine, seuls les paramètres sont stockés).
- `recalculations` : `{ id, tool, scope, result, date }`.
- `worksheets` : `{ id, cycle, kind: 'master' | 'procedure', references[], conclusion, comment, status }`.
- `findings` :
  - champs : `{ id, cycle, objects[], natures[], classification, impacts { result, equity, balanceSheet }, proposedEntry[], evidence[], status, comment, createdOn }` ;
  - appariement calculé (non stocké) : `{ partId | falseLeadId | null, credit: 'full' | 'partial' | 'none' }`.

Toutes les actions restent des fonctions pures (`src/game/`). L'appariement et les heures sont des sélecteurs dérivés.

## 5. Paramètres nouveaux

| Fichier | Contenu |
|---|---|
| `params/procedures.json` | Environ 60 procédures du §10.3, réparties par cycle : transverse, loyers et créances, immobilisations, provisions, dettes et trésorerie, achats et charges, capitaux propres et subventions, informations (annexe, rapport de gestion). |
| `params/requests.json` | Catalogue des demandes de documents (environ 60, dont les 34 du scénario). |
| `params/confirmations.json` | Tiers circularisables, informations demandées, tiers sans réponse. |
| `params/planning.json` | Bases de seuil proposées, plage acceptable, matrice de référence des risques (pour le débrief de J6), libellés des assertions. |
| `params/sampling.json` | Facteurs de confiance par niveau de risque, taille minimale et maximale. |
| `params/holidays.json` | Jours fériés 2025-2026 (à vérifier). |
| `params/false-leads.json` | Ou complément du modèle existant : signature d'appariement des fausses pistes F1 à F7. |

## 6. Écrans

| Écran | Route | Contenu |
|---|---|---|
| Planification | `/planification` | Onglets : seuils (calculateur et justification), risques (matrice, présomption de fraude), programme de travail (bibliothèque filtrable, affectation, heures prévues contre budget). |
| Procédures et feuilles de travail | `/travaux` | Procédures du programme, exécution (membre, heures), feuilles de travail, feuilles maîtresses par cycle. |
| Demandes et confirmations | `/demandes` | Catalogue des demandes, suivi (envoyée, due le, relancée, reçue), confirmations (préparation, suivi, rapprochement des réponses). |
| Outils | `/outils` | Échantillonnage et recalculs. |
| Constats | `/constats` | Liste et formulaire des constats, tableau des anomalies. |

Les autres changements d'interface :

- **Bureau** : agenda vivant (date, phase, prochains événements), boutons d'avancement du temps, budget consommé par membre.
- **Barre supérieure** : budget réel.
- **GED et données comptables** : filtrées selon la date (J4-3).

## 7. Tests

- Horloge : jours ouvrés, sauts de phase, événements déclenchés une seule fois et dans l'ordre.
- Données selon la date : la balance de l'extraction au 31/10/2025 est cohérente avec le FEC filtré.
- Procédures : prérequis, phases, coûts par profil, budget et dépassement.
- Demandes et confirmations : délais, relances, réponses, absence de réponse.
- Échantillonnage : déterminisme par graine, tailles, couverture des strates, sélection par unités monétaires.
- Recalculs : chaque outil retrouve exactement le montant du monde propre sur un périmètre sans anomalie, et l'écart attendu sur le périmètre d'une anomalie (sans le révéler à l'écran).
- Appariement :
  - pour chaque partie d'anomalie, un constat construit à partir de sa signature et de son impact obtient le crédit complet, et le crédit partiel hors tolérance ;
  - un constat sans correspondance est un faux positif ;
  - un constat sur une fausse piste est signalé à tort.
- Persistance : migration v1 → v2.
- Garde-fous : rien n'est révélé hors mode concepteur.

## 8. Découpage

1. **J4a — socle** : horloge, événements, données selon la date, état v2 et migration, budget.
2. **J4b — planification** : seuils, risques, bibliothèque de procédures, programme, exécution et feuilles de travail.
3. **J4c — demandes, confirmations, outils** : demandes, confirmations, échantillonnage, recalculs.
4. **J4d — constats** : constats, appariement, tableau des anomalies, feuilles maîtresses.
5. **Intégration, revue adversariale, documentation, commit J4.**
