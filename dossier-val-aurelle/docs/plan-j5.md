# Dossier Val d'Aurelle — Plan J5 (personnages)

> **Statut** : plan révisé le 24/10/2026. Le projet du 22/10/2026 a été relu par un commissaire aux comptes, un concepteur de jeu et un architecte ; leurs constats ont été vérifiés sur le code de J4 et intégrés, ou écartés avec leur motif (§21). Les questions ouvertes sont tranchées (§2.2). Restent **à valider** par le propriétaire : J5-7 (Karim), J5-9 (travail délégué), J5-13 (règle de T2) et le contenu de E4 (§7.4). À la livraison, les décisions passent dans `CLAUDE.md`, les références dans `docs/points-a-verifier.md` (§12.3).
>
> Références : cahier des charges §1, §2, §4.1, §4.2, §4.5, §4.6, §5 à §9, §10.1, §10.2, §10.4, §10.5, §10.9, §10.10, §11, §12, §13.1 et annexe ; plan J4 §2, §5, §7.1, §8.5, §11, §13.1, §14, §15, §20 ; `docs/j4-observabilite.md`.

## 1. Périmètre

J5 (§12 : « dialogues, confrontation, équipe et revue de travaux, événements éthiques, messagerie ») couvre :

- les personnages : fiches, états (confiance, humeur, disponibilité), badges (§4.5) ;
- les entretiens et la confrontation (§10.5), dont les séances avec l'associée et le président du CA ;
- les confidences du chef comptable et les pièces conditionnelles (§8, §9) ;
- l'équipe : travail du membre, variantes T1 à T4, revue, consignes (§7) ;
- l'éthique et l'indépendance : E1 à E5 et deux événements sans enjeu (§8) ;
- les jauges, dont les événements enregistrés en J4, et les remontées à l'associée (§10.2) ;
- la messagerie (§11) ;
- le mémo réglementaire, reporté de J4 (J4-16, §10.4, annexe).

La livraison se fait en quatre étapes, chacune avec son commit et sa revue adversariale, puis une intégration (§19).

| Jalon | Ce que J5 prépare |
|---|---|
| J6 | J5 enregistre sans noter : concessions (sujet, personne, pièces, associée), choix éthiques et notes à l'associée, tours de revue et notes de revue du 16/03, instantanés des remontées, `governanceInformedOn`. J6 dérive `a11ConfrontedAlone` et `reviewOutcome` (`game/j6/`), note la supervision (8 %) et l'éthique (7 %), et réutilise le moteur de confrontation (§6) aux réunions des 17/03 et 19/03 (`clientStance`). |
| J7 | Messages avec clé `tutorial`, liens typés et ancres `data-tutorial` stables, filtre `levels`, condition `planning`. Portraits illustrés (badges en J5). Leviers notés pour J7 : `ironman`, compteur de rechargements. Le mode concepteur déclenche confidences et événements éthiques (§10.10). |

Hors périmètre : négociation, opinion, notation, débrief (J6) ; tutoriel, niveaux, sauvegardes (J7) ; entretiens en langage naturel (§13.1).

## 2. Principes et décisions

### 2.1 Six principes

1. **Un entretien est une demande orale qui corrobore.** Une question se pose à une personne sur une famille et un objet, comme une demande de pièce (plan J4 §8), et tout objet a une réponse. Une question neutre, ouverte d'emblée, reçoit le cadrage du client, jamais le fait décisif. Le fait décisif ne vient que d'une pièce posée (`reveals`) ou d'un objet que seul un travail réel rend choisissable (écriture consultée, pièce lue).
2. **Rien ne révèle la clé hors mode concepteur.** Les catalogues sont identiques avec ou sans anomalies. Les issues et les répliques des pièces pertinentes le sont aussi, sauf `concede`, `defer` et `reveal`. Chaque famille a un seul constructeur de réponse. Les règles de J5 n'importent ni `game/matching` ni `case.key` ; secrets et issues attendues sont dans des fichiers à part (§16).
3. **Une jauge bouge quand son titulaire apprend le fait.** Le client réagit à ce qu'il vit ; l'associée réagit à ce qu'on lui remonte. Avant la revue du dossier par l'associée (16/03), aucune variation visible ne dépend de la clé. Les notes de revue du 16/03 sont la seule exception, et elle est voulue (§8.4).
4. **Le temps reste une donnée** (plan J4 §2.1). L'état stocke des actions datées et numérotées (`seq`), avec leurs entrées figées à l'action : remontée, revue, lancement, programme validé. Messages, jauges, reprises et pièces conditionnelles en sont dérivés.
5. **Ce qui est dit est une déclaration orale à corroborer** (NEP 500). Chaque réponse produit un papier de travail : « Déclaration orale de …, compte rendu établi par l'auditeur – à corroborer », sans « Reçu le ». Il se lit, s'annote et se lie à un constat ; il ne se présente qu'à la personne entendue.
6. **Tout est scripté et déterministe** (§7, §13.1). « Insister fait parfois bouger un personnage » est une règle du catalogue (`requiresInsist`), pas un tirage.

### 2.2 Décisions

| # | Sujet | Décision |
|---|---|---|
| J5-1 | Livraison | Quatre étapes : J5a socle (état v3, registres, contrats, toutes les modifications de fichiers partagés) ; J5b entretiens, confrontation, Karim, éthique, jauges, messages ; J5c équipe ; J5d mémo. Chacune a son commit et sa revue adversariale. Après J5a, les lots ne partagent aucun fichier (§19). |
| J5-2 | Entretiens | Scriptés. Question = personne × famille × objet ; objets tirés des listes du formulaire des constats et de ce que le joueur a lu, consulté ou ouvert. Les entretiens corroborent et n'apportent jamais le fait décisif (§5.4). Un constructeur par famille ; le scénario ne fournit que des valeurs de champs ; un test compare la forme des réponses. |
| J5-3 | Séances | Sur site, un jour ouvré, une séance par personne et par jour, avec un espacement propre à chacune. 0,25 h du senior par action (question, pièce, insistance, mise en cause), quatre actions au plus. Fenêtres du calendrier : J5-24. |
| J5-4 | Questions reposées | Une fois par phase et par personne ; l'écran affiche « déjà posée le … ». La réponse est réévaluée à chaque date. Avant `from`, la réponse générique est servie complète et sans indice. Une réponse n'est partielle que par les règles de relation et d'humeur, les mêmes pour tous les sujets. |
| J5-5 | Comptes rendus | Papier de travail, catégorie « Entretiens » (`interviews`), mode `{ kind: 'interview' }`, source d'indice `interview`. Identifiant : base de l'objet encodée, version en dernier. Présentable seulement à la personne entendue. Un compte rendu du scénario porte l'indice d'une seule cible. |
| J5-6 | Confrontation | Sujet (famille × objet) et chaîne de personnes. Les pièces pertinentes sont dérivées des objets partagés pour **tout** sujet et reçoivent la position de la personne. Seules `concede`, `defer` et `reveal` ont des répliques propres. Les pièces se cumulent par sujet d'une séance à l'autre. Les tables suivent les `stance` des modules (`requiresInsist` pour A12.i et A12.iii). L'hostilité n'empêche jamais une concession sur l'ensemble complet. J5 enregistre ; J6 accepte les corrections. |
| J5-7 | Karim | Confiance de départ 20 ; confidences à partir de 60, en tête-à-tête, au final seulement. `oneToOne` ne compte que si Karim répond à une question de son domaine, avec un rendement décroissant par phase : +8, +5, +3, puis +2 au plus par semaine. +5 quand le joueur blanchit son travail par une pièce ; −5 par demande en double qui lui est adressée. `publicBlame` dépend de l'audience et de la famille, jamais d'un sujet d'anomalie. **À valider** (seuil, rendements, calendrier). |
| J5-8 | Source | Aucune promesse de confidentialité. Option attendue : « le remercier, lui expliquer que l'information sera traitée avec discrétion au sein de l'équipe, sans garantie de confidentialité ; fonder la démarche sur des éléments obtenus par ailleurs ; en référer à l'associée ». Option fautive tentante : « lui promettre que son nom ne sera jamais cité ». Présenter à la DAF ou au DG une pièce venue de Karim l'expose. Il n'est jamais qualifié de lanceur d'alerte. Tout l'arc relève du lot des entretiens ; la messagerie n'affiche que le choix. |
| J5-9 | Travail délégué | Le membre opère l'outil. L'échantillon est tiré par lui (taille et graine figées au lancement) et examiné par une règle de signalement sur les données, qui ne lit jamais d'indice et produit des faux positifs. Le recalcul se fait sur les hypothèses du client ; la note liste les sources obtenues et leurs valeurs, sans montant corrigé. Les points ne viennent que de `executionReach`. **À valider** : en J4, le joueur opérait l'outil. |
| J5-10 | Variantes T1 à T4 | Seulement si la procédure est confiée au membre scénarisé (`procedures.json → delegated.member`). Une consigne qui vise le défaut le réduit sans le supprimer (§8.2). |
| J5-11 | Revue | Accepter, ou renvoyer avec un motif (liste fermée) et un commentaire que le moteur ne lit pas. Un seul renvoi par feuille ; un second n'est possible que pour « documentation incomplète », fondé par `formCheck`. La reprise coûte au membre 50 % des heures de la procédure et s'ordonnance avec les exécutions ; elle ne déclenche jamais d'arbitrage. Coût visible d'un renvoi : les heures et la réponse du membre. |
| J5-12 | Erreurs de revue | Les renvois sans fondement et les feuilles fautives acceptées donnent des notes de revue de l'associée le 16/03 : −3 en confiance chacune (« erreurs de revue », CDC §10.2). Le senior peut refaire le travail pendant la synthèse. Rien de visible avant le 16/03 ne dépend de la clé. |
| J5-13 | T2 | Hugo retient les cinq plus grosses factures fournisseurs de la population de sa procédure (`capitalised-works`) et étend la conclusion aux dix éléments. Le seuil de 500 k€ du CDC ne retient rien sur cette population : son plus gros élément est le transfert des Peupliers (378 k€, écriture d'OD sans fournisseur). **À valider** (écart au CDC §7, PV-107). |
| J5-14 | T1 | Seul l'écart de capital restant dû (A18) est mal conclu ; le point sur les intérêts courus (A08) reste rapporté. La conclusion est datée de la réponse. |
| J5-15 | Consignes | Rares et liées aux personnages : un point de lancement par membre et par phase (intérim, final), pour 0,5 h. Il vaut pour les procédures de ce membre lancées ensuite dans la phase. |
| J5-16 | Éthique | Options formulées en actions concrètes de longueur comparable ; choix datés et stockés ; options par défaut sans changement d'état. Le +3 de l'associée tient à une note documentée attachée au message, pas à l'option cliquée. Deux événements sans enjeu (B1, B2) où remonter coûte 1. Les échéances figurent dans les attendus. Le caractère attendu n'est visible qu'en mode concepteur et en J6. |
| J5-17 | Jauges | Valeur = départ + effets du barème (`params/gauges.json`), triés par (date, `seq`, rang du fournisseur). Chaque effet est arrondi à l'entier une fois, puis borné entre 0 et 100 ; les jours sont arrondis au supérieur. L'agrégation est dans `game/gauge-values.ts` ; `gauges.ts` reste une feuille. Toute entrée est figée à l'action. |
| J5-18 | Relation client | Sous 30 : délais des demandes × 1,5 figés à l'envoi, réponses partielles, espacement des séances + 2 jours ouvrés. Elle remonte vers 50 après 10 jours ouvrés sans événement négatif, gagne +2 par concession obtenue sur l'ensemble complet et +1 par séance close sans action négative (deux par semaine au plus). Seuils et remontée dans `characters.json`. |
| J5-19 | Remontées | À temps : dans les 3 jours ouvrés de la création du constat ou de la liaison de sa 2e pièce. Il faut le statut « constat » avec une écriture proposée, ou le drapeau « suspicion de fraude / irrégularité » (une pièce suffit alors, et `weakEscalation` ne s'applique jamais). L'instantané de la remontée est figé (`Finding.escalation`). Surprise tardive sur max(\|résultat\|, \|capitaux propres\|, \|bilan\|) ≥ seuil de planification, ou drapeau. Une remontée des deux derniers jours du final est neutre. |
| J5-20 | Associée en séance | Elle vient si un constat remonté porte sur un sujet de la personne, avec une confiance ≥ 30, ou, sous 30, si ce constat a été remonté avec au moins deux pièces. Une séance ne compte que si elle s'exprime sur un sujet prêt (ensemble complet). Cinq au plus, hors sujets significatifs ou de fraude remontés et hors séances du président. |
| J5-21 | Président du CA | Séance avec l'associée à la planification (entretiens de la gouvernance, NEP 240). Une seconde au final si un constat de gouvernance ou suspect a été remonté : elle date `governanceInformedOn`, pour J6. |
| J5-22 | A11 | Une demande de pièce neutre n'est jamais une confrontation. J6 dérive `a11ConfrontedAlone` des actions stockées. La remontée d'un constat avec traitement de gouvernance ou drapeau déclenche une réponse générique de l'associée (réponses NEP 240, information du président). Concession consignée : « extourne obtenue ; le traitement de l'indice se poursuit ». |
| J5-23 | Pièces conditionnelles | Disponibles, et « Reçu le » daté, à max(date où la condition est remplie, date de la pièce) : c'est la correction du défaut latent de `game/documents.ts`. Nouvelles pièces : courriel de l'association (E4) et compte rendu de visite (B1). |
| J5-24 | Fenêtres | `characters.json → windows` : confrontations jusqu'à la fin du final, et jusqu'au 17/03 sur `subsequent-events` ; ensuite, seulement `subsequent-events`, `litigation` et `document` ; confidences au final seulement. |
| J5-25 | Messagerie | Boîte dérivée ; seules les marques de lecture sont stockées. Les messages de phase migrent aux dates de J4. Filtre `levels`, condition `planning`, liens typés avec ancres `data-tutorial`. Les pièces du scénario ne sont pas annoncées. |
| J5-26 | Données consultées | Section `consulted` : première ouverture d'un compte au grand livre et d'une écriture du FEC. `markConsulted` rend le même état si la clé est déjà notée. |
| J5-27 | Mémo | `src/scenario/memo/`, sans couche `content`. Les références précises du CDC portent la mention « référence à vérifier » (précédent de J4) ; le reste est formulé en termes généraux. Les mémos techniques du cabinet sont des références de l'auditeur, pas des pièces sur l'entité. |
| J5-28 | Interlocuteurs | Six personnes du client, dont le président. Les tiers passent par les confirmations et le courrier, la présidente de l'association par E4 ; l'équipe et l'encadrement par la messagerie, la revue et les séances avec l'associée. Badges paramétriques (initiales, couleur d'humeur) en J5, portraits illustrés en J7. |
| J5-29 | Sauvegarde | `schemaVersion` 3. `Execution.review` est remplacé par `reviewRounds`, et `MIGRATIONS[2]` abandonne les revues de J4 (le journal les garde). `LoadResult.restarted` n'est vrai que depuis v1. `CONTENT_VERSION` 2. |
| J5-30 | Observabilité | Mode « entretien » avec `earliestOn`. Sont exclus les pièces et comptes rendus soumis à une jauge ou à un choix : confidences, réponse de Karim sur la PAR, E4, visite. |

## 3. Ce que vit le joueur, phase par phase

1. **Planification** (03 au 14/11/2025, senior seul).
   - Mail de l'associée (accroche du tutoriel), puis mail d'Antoine sur le programme du cabinet.
   - Entretiens de prise de connaissance (§10.1) : DG (organisation, groupe, objectifs du conseil), DAF (clôture, équipe), Karim (extraction, migration), Isabelle Moreau (programmes), Julien Petit (recouvrement). Chaque réponse neutre donne un cadrage, pas un fait décisif.
   - Questions sur la fraude (NEP 240) ; le DG y évoque sa part variable, que précise le PV du CA sur sa rémunération (dossier permanent).
   - Séance avec le président du CA, en présence de l'associée.
   - Si le programme validé contient la revue complète de la PGE, E3 se déclenche.
2. **Intérim** (17 au 20/11/2025).
   - Un point de lancement par membre (consigne). Le DG propose une loge (E1, 18/11) ; Isabelle Moreau propose une visite des Glycines (B1).
   - Premières feuilles à revoir (T2, T4 possibles). Tête-à-tête avec Karim. Au niveau assistant, Léa signale des zones à creuser.
3. **Hors site** (21/11/2025 au 20/02/2026).
   - Pas d'entretien ; l'échéance de E1 (28/11) figure dans les attendus.
   - Léa conclut T1 à la réponse de la Banque des Territoires (26/01) ; la revue se fait à distance et la reprise attend le final. La DAF demande les tableaux de l'annexe (E2, 09/02).
4. **Final** (23/02 au 13/03/2026).
   - Nouveau point de lancement par membre. E3 se déclenche s'il n'a pas eu lieu. E4 le 24/02 ; déjeuner à la cantine (B2, 25/02).
   - Confrontations, avec l'associée si besoin. Karim se confie si sa confiance le permet, et le joueur choisit comment traiter la source.
   - Sur A11, demander les pièces sans annoncer la cible, documenter, remonter avec le drapeau de suspicion ; l'associée répond et rencontre le président.
   - Le DG évoque le mandat (E5) lors d'une séance sans l'associée, sinon Antoine rapporte la remarque le 06/03.
   - Revue de T3, reprises, remontées.
5. **Après le final** (à partir du 16/03/2026, senior seul).
   - Revue du dossier par l'associée : notes de revue et surprises tardives.
   - Questions `subsequent-events`, `litigation` et `document` ; confrontation sur les événements postérieurs jusqu'au 17/03 (courrier du mandataire du 15/03). La synthèse relève de J6.

## 4. Personnages et états

### 4.1 Distribution

| Id | Personne | Espacement | Sujets (chaînes de confrontation au §6.5) |
|---|---|---|---|
| `ceo` | Bertrand Vasseur, DG | 3 jours ouvrés | contexte, objectifs, groupe, conformité, fraude ; E1, E5 ; décideur d'A04, A05, A12.i, A17 |
| `cfo` | Nathalie Ferrand, DAF | 1 | méthodes, estimations, conformité, contentieux, événements postérieurs ; E2 ; A03, A06, A07.a, A10.b, A11, A12.iii, A14.ii, A15 ; F1, F2, F3, F5 |
| `chiefAccountant` | Karim Haddad | 0 (une par jour) | comptes, écritures, migration, ICNE, confidences ; A08, A18, A19, A21 ; F6, F7 |
| `assetDirector` | Isabelle Moreau | 2 | programmes, PPE, réceptions, fournisseurs ; B1 ; révèle A01, A02, A04, A05, A06 ; F4 |
| `rentManager` | Julien Petit | 1 | recouvrement, loyers, régularisation ; B2 ; révèle A07 ; renvoie A10.b, A17 |
| `chairman` | Gérard Lambert, président du CA | deux séances, avec l'associée | gouvernance, fraude, parties liées |
| `tenantAssociation` | Rachida Benamar | — | E4 |
| `partner`, `manager` | Claire Delmas, Antoine Roussel | — | messagerie, séances (J5-20), E3, remontées, notes de revue |
| `lea`, `hugo`, `sofia` | équipe | — | T1 à T4, consignes, migration |

- **Noms et fonctions** : `documents.json → people`, `game.json → team, firm`. `PersonId` = `Interlocutor` (`model.ts:39`) ∪ `'chairman'`.
- **Délais des demandes** : ceux de `responseDelaysBusinessDays`, inchangés.

### 4.2 Fiche (§4.5)

Les fiches sont du contenu TypeScript (`src/scenario/npc/sheets.ts`), pour que les répliques citent des montants du moteur. Les réglages sont dans `params/characters.json`.

```ts
interface CharacterSheet {
  id: PersonId;
  personality: string;                                          // §4.5
  knowledge: QuestionFamilyId[];                                // familles servies ; les autres sont redirigées
  sensitivity: { insist: number; offTopic: number; accusation: number };
  positions: Partial<Record<QuestionFamilyId, string>>;         // position argumentée par famille, sujets sans anomalie compris
  lines: { greeting: Record<Mood, string>; unavailable: string; offTopic: string; redirect: string; partial: string; holds: string; closing: string };
  badge: { initials: string };
}
interface CharacterSecret { person: PersonId; id: string; text: string; revealedBy: string } // scenario/npc/secrets.ts
```

- **Sensibilité.** Le DG supporte mal l'insistance (×1,5). Isabelle Moreau, « technique, franche », supporte mal la mise en cause (×1,5).
- **Secrets** (`secrets.ts`, mode concepteur et `game/j6/` seulement) : les deux courriels de la DAF ; le malaise de Karim sur la reprise de PGE et la PAR. L'objectif de résultat du DG n'est pas un secret : il figure au PV du CA sur sa rémunération.

### 4.3 États

- **Confiance.** Seul Karim a une jauge propre (§10.2). Les autres personnes partagent la relation client.
- **Humeur** (dérivée, `game/characters.ts → moodOf`), visible sur le badge.

  | Humeur | Règle |
  |---|---|
  | Cordiale | relation ≥ 50 |
  | Réservée | 30 ≤ relation < 50, ou insistance ou pièce hors sujet dans les 5 derniers jours ouvrés |
  | Tendue | relation < 30, ou mise en cause dans les 5 derniers jours ouvrés |
  | Hostile | mise en cause sans preuve dans les 10 derniers jours ouvrés ; pour la DAF, jusqu'à la fin de la mission si la source est exposée |

  Une personne hostile ne répond que partiellement et ne bouge pas à l'insistance ; elle concède quand même devant l'ensemble complet (« cède devant des preuves solides »). L'humeur de Karim suit sa jauge : épuisé sous 40, confiant à partir de 60.

- **Disponibilité** (`availabilityOf`). La personne est disponible si le senior est sur site, un jour ouvré, si l'espacement depuis sa dernière séance est respecté et si la fenêtre de la famille est ouverte (J5-24). L'espacement est multiplié par `responseDelayFactor`, allongé de 2 jours ouvrés sous 30 de relation, puis arrondi au jour supérieur. L'écran affiche la prochaine date possible.

### 4.4 Badges

`ui/components/Badge.tsx` affiche les initiales sur la couleur de l'humeur, avec un texte alternatif qui donne le nom, la fonction et l'humeur. Les portraits SVG illustrés relèvent de J7.

## 5. Entretiens

### 5.1 Séance

1. **Ouverture.** Le joueur ouvre une séance avec une personne disponible. Audience : « seul » par défaut, « en présence de la DAF » pour Karim, « avec l'associée » (§6.7). L'ouverture est gratuite.
2. **Actions.** Quatre au plus, à 0,25 h du senior chacune, imputées par `budget.ts` : question, pièce présentée, insistance, mise en cause (§6). L'historique s'affiche avec le badge (§10.5).
3. **Questions reposées** (J5-4). Une question se pose une fois par phase et par personne. Elle reste proposée dans les phases suivantes, avec la mention « déjà posée le … ».
4. **Audience « en présence de la DAF ».** La DAF répond dans la même séance aux questions `estimate` sur ses propres estimations, ce qui économise une séance avec elle ; en contrepartie, Karim s'expose au `publicBlame` (§7.1).
5. **Clôture.** Une séance close avec au moins une action et sans insistance, pièce hors sujet ni mise en cause vaut `calmSession` (§10.2).

### 5.2 Familles de questions (`src/scenario/npc/questions.ts`)

| Famille | Personne(s) | Objet | Proposée quand | Réponse générique (cadrage) |
|---|---|---|---|---|
| `entity-overview` | DG | — | dès le début | organisation, groupe, objectifs du conseil |
| `closing-organisation` | DAF | — | dès le début | planning de clôture, équipe, arrivée de la DAF, migration |
| `fraud-inquiry` | DG, DAF, Karim, président | — | dès le début | connaissance de fraudes, dispositif de contrôle ; DG : part variable assise sur le résultat (renvoi au PV du CA) ; Karim : chemin des confidences (§7.2) |
| `compliance` | DG, DAF | — | dès le début | suivi des recommandations de l'ANCOLS (2022), contrôles et inspections, contentieux locatifs (dossier permanent ; NEP 250) |
| `migration` | Karim | — | dès le début | bascule des 27-28/09/2025, reprise des soldes rapprochée et signée, interfaces |
| `account` | Karim | compte | compte ouvert au grand livre (`consulted`) ou objet d'un constat | nature, mouvements, rapprochement (millésime disponible) |
| `entry` | Karim | écriture | écriture ouverte dans le FEC (`consulted`) | utilisateur, dates de saisie et de validation, pièce |
| `programme` | Moreau | programme | dès le début | logements, financement, libellés des opérations de l'année ; ni date de réception ni décision |
| `replacements` | Moreau | programme | constat ouvert sur ce programme | « aucun autre remplacement significatif » |
| `maintenance-plan` | Moreau | — | PPE officiel ou tableau des provisions lu | plan pluriannuel, budget voté |
| `supplier` | Moreau | fournisseur | dès le début | procédure d'attribution (données des marchés) |
| `estimate` | DAF (ICNE : Karim) | PGE, dépréciation, ICNE, régularisation, retraite, produits à recevoir | pièce de calcul correspondante lue | méthode de la direction |
| `recovery` | Petit | — ou débiteur | balance âgée lue | organisation, prestataire, procédures ; aucun taux |
| `rent-revision` | Petit | — | PV du CA d'octobre 2024 ou quittancement lu | application de la délibération au 01/01/2025 |
| `related-parties` | DG, DAF, président | — | convention de soutien ou registre des conventions lu | conventions de groupe |
| `litigation` | DAF | — | registre des contentieux lu | contentieux du registre |
| `subsequent-events` | DAF, DG | — ou tiers | à partir du 01/01/2026 | « rien qui modifie les comptes » |
| `document` | émetteur interne | pièce lue | pièce lue (`readOn`) | contexte d'établissement |
| `finding` | toute personne | constat ouvert | constat ouvert | renvoi vers la famille de son objet |
| `wellbeing` | Karim | — | dès le début | charge de travail, migration |

- **Déblocage.** Les questions se débloquent selon les documents lus, les données consultées et les constats ouverts (§10.5), par l'évaluateur de conditions étendu (§16). Un objet du scénario n'est jamais proposé plus tôt qu'un objet générique de même nature.
- **Questions verrouillées.** Elles ne s'affichent pas : leur seule existence renseignerait.
- **Hors domaine.** Une famille hors du domaine de la personne reçoit une redirection (« voyez avec … »), sans coût.

### 5.3 Résolution d'une réponse

`answerOf(question, date, ctx)` est pure. Le texte se réévalue à chaque date et se recalcule à partir de la date de la séance ; seule la variante est stockée.

1. **Contenu.** Champs du scénario si leur date `from` est atteinte ; sinon champs génériques, servis complets et sans indice. Si la famille est hors du domaine : redirection.
2. **Variante** (règles uniformes) : `partial` si la relation est sous 30, si la personne est hostile, ou pour Karim dans deux cas. En présence de la DAF, il répond partiellement sur `entry`, `account` et `fraud-inquiry`. Sur une écriture saisie par un supérieur (utilisateurs de la DAF et du DG, `scenario.json → users`), il répond partiellement tant que sa confiance est sous `karim.confideAt`. Une réponse partielle ne garde que la phrase de position, sans fait ni indice.
3. **Constructeurs.** `ANSWER_BUILDERS` (`scenario/npc/answers.ts`) donne un gabarit par famille. `genericFields` les remplit à partir des données, au millésime de la date ; `scenarioFields(c: DocContext)` ne fournit que des valeurs. Le test de forme compare gabarit, nombre de phrases et nature des champs entre les réponses du scénario et les réponses génériques.

**Faits datés.** Le PPE officiel n'est évoqué qu'à partir du 15/11/2025. La réponse évasive sur les événements postérieurs commence au jugement du 24/02/2026. Une écriture n'existe qu'avec le millésime qui la contient.

### 5.4 Réponses du scénario

Aucune réponse n'apporte de fait absent de la clé. Les positions reprennent les `stance` des modules (`anomalies/modules/*.ts`). Les questions neutres ouvertes d'emblée (`entity-overview`, `closing-organisation`, `fraud-inquiry`, `compliance`, `migration`, `programme`, `supplier`, `wellbeing`) ne servent que des champs génériques.

| Partie | Personne | Accès | Réponse complète | Indice |
|---|---|---|---|---|
| A01 | Moreau | `reveals` : `pv-reception-tilleuls` posé | Réception le 30/06/2025, locataires en juillet, inauguration en septembre | A01 |
| A02 | Moreau | `replacements` sur un programme objet d'un constat | Aux Érables : « la PAC a remplacé la chaufferie de 2008, déposée ». Ailleurs : « aucun autre remplacement significatif », démarche enregistrée pour J6 (réflexe NEP 450). Le mémo et le débrief rappellent qu'il faut la corroborer : plan de travaux et factures de remplacement rapprochés des sorties du registre | A02 (Érables) |
| A04 | Moreau | `reveals` : `pv-ca-2025-06` ou `avenant-anru-glycines` posé ; la question neutre `programme` ne donne que « projet NPNRU en cours » | Relogements engagés depuis septembre ; démolition prévue au 4e trimestre 2027 | A04 (§5) |
| A05 | Moreau | `reveals` : `ppe-daf` posé | « Ces travaux n'ont jamais été décalés : ils sont au PPE et au budget voté » | A05 (§5) |
| A05 | DAF | `estimate` PGE | « J'ai retenu mon fichier de calcul, à jour de mes arbitrages » | position |
| A06 | Moreau | `reveals` : `factures-peupliers` ou `bons-commande-peupliers` posé ; la question neutre `programme` ne donne que « travaux d'amélioration 2025 » | « C'était notre programme d'entretien 2025 : peinture, robinetterie, toiture » | A06 |
| A07.a | Petit ; DAF | Petit : `document` sur `stats-recouvrement` lu. DAF : `estimate` dépréciation | Petit : recouvrement des ex-locataires d'environ 4 % par an, premier rapport du prestataire décevant (valeurs des jeux de données). DAF : « nouveau prestataire, taux ramené à 85 % » | A07 (Petit) |
| A07.b | Petit | `reveals` : `decisions-surendettement` posé | Locataires restés dans les lieux, créances maintenues à 50 % | A07 |
| A08 | Karim | `estimate` ICNE (`calcul-icne` lu) | « Taux unique de 3 % par simplification » | A08 |
| A10 | DAF ; Petit | `estimate` régularisation ; `rent-revision` | Syndic : « erreur de paramétrage » ; gardiens : « affectés à 100 % » | positions |
| A11 | Karim | `entry` de la PAR consultée | « Mme Ferrand l'a saisie elle-même ; la pièce devait suivre. » Réponse partielle sous `confideAt` ou en présence de la DAF (§5.3) | A11 (hors observabilité) |
| A12 | DG ; DAF | `related-parties` | DG : « opération de groupe ». DAF, après la convention posée et une insistance : « nous n'en avons pas retrouvé trace » | A12 (iii) |
| A15 | DAF | `subsequent-events` (général ou tiers), à partir du 24/02/2026 | « Rien qui modifie les comptes ; ils ont toujours fini par payer » | A15 (« réponse évasive ») |
| A16 | DAF | `litigation` | Énumère le registre, sans l'assignation | non : le registre est l'indice |
| A17 | Petit ; DG | `rent-revision` | Petit : « nous avons appliqué la délibération ». DG : « régulariser sur 2026 sans écriture » | non : la note de la gestion locative est l'indice |
| A18 | Karim | `account` 471 ou `entry` du 15/12 consultés | Versement de la Banque des Territoires, contrat non reçu, mis en attente. L'écriture ronde est légitime ; seule son imputation est erronée (§5) | A18 |
| A19 | Karim | `entry` du lot doublé consulté, ou `reveals` : `journal-interface-octobre` posé | « Ce lot a été rejoué à la bascule ; pas de rapprochement depuis » | A19 seul (F7 relève de `migration`) |
| A20, A21 | DAF ; Karim | `estimate` ; `document` | « Facture du GIE arrivée en janvier » ; « faute de frappe » | positions |

### 5.5 Contexte et fausses pistes

- **Contexte du §4.2**, distillé dans les réponses génériques : arrivée de la DAF, migration, soutien demandé par le groupe, recommandations de l'ANCOLS (`compliance`), vote de +3,50 %, NPNRU. L'objectif de résultat n'apparaît que dans `fraud-inquiry` du DG, au PV du CA sur sa rémunération et dans le courriel conditionnel.
- **F1, F2, F3, F5.** La DAF explique et renvoie aux pièces qui écartent la piste (`false-leads.ts → evidence`).
- **F6, F7.** Karim répond sur le compte 512 consulté (chèques dénoués en janvier) et sur `migration` (reprise rapprochée et signée). Sofia confirme F7 dans sa feuille.
- **F4.** La question neutre `supplier` décrit l'attribution à partir des données des marchés, pour tout fournisseur. Pour Bâti-Rénov Est s'ajoute la valeur « aucun lien de parenté », à corroborer par `attestation-absence-lien`.
- Un compte rendu n'entre jamais dans `FalseLead.evidence` (collisions de `matching.test.ts:424-466`).

### 5.6 Comptes rendus

- **Identifiant.** `interviewNoteId(q, on)` = `entretien-<personne>-<famille>-<objet>~<date>`. L'objet est réduit à sa base (`baseDocumentId` pour la famille `document`) et encodé sans `:` ni `~`. `parseQuestionKey` coupe aux deux premiers `:` (`chiefAccountant:entry:2025:OD000189`). Un test fait l'aller-retour.
- **Forme.** `DocumentModel.workingPaper: true` : la GED affiche « Établi le » et la mention « Déclaration orale de …, compte rendu établi par l'auditeur – à corroborer ».
- **Construction.** La version du scénario vient de `scenario/npc/interview-docs.ts`, appelé par `buildDocuments`, avec un indice d'une seule cible. La version générique est construite à la volée par le même constructeur et mise en cache comme les réponses de J4 : elles sont construites par `scenario/documents/replies.ts` (`genericReplies`) et `documents/index.ts` (`requestReply`), et mises en cache par `ui/screens/ged/replies.ts`.
- **Orphelins.** `knownDocuments` (`ui/app/orphans.ts`) accepte les identifiants dérivables de `s.interviews` ; sinon `cleanLoadedSave` les supprimerait à chaque chargement (test dans `tests/ui/orphans.test.ts`).

## 6. Confrontation (§10.5)

### 6.1 Pièces présentables

Le joueur présente une `Evidence` de `findings.ts` avec le sélecteur du formulaire des constats :

- un document (`baseDocumentId`, réponses scindées comprises) ;
- une écriture du FEC ;
- un recalcul dont l'écart est non nul et les hypothèses sourcées ;
- un échantillon avec exception ;
- un compte rendu d'entretien. Il n'a de valeur qu'auprès de la personne entendue ; à une autre personne, il est hors sujet, et s'il vient de Karim et qu'on le montre à la DAF ou au DG, il l'expose (§7.3).

Les objets d'une pièce (`pieceSubjects`) sont :

- pour un document, `DocumentModel.subjects`, posés par J5a : clé de demande, plus des étiquettes `prog:`, `tp:`, `acct:` et `theme:` ajoutées au catalogue ;
- pour une écriture, ses comptes, son programme et ses tiers ;
- pour un recalcul, son outil et son périmètre ;
- pour un échantillon, les comptes de sa population.

### 6.2 Sujet, chaîne et pertinence

```ts
type TopicKey = string;                         // 'family' | 'family:object' : le sujet, commun à la chaîne
interface Yield { by: PersonId; all: PieceRef[]; requiresPartner?: true; requiresInsist?: true; line: string; concession: string }
interface ConfrontationEntry {                  // scenario/npc/confrontations.ts → confrontationTable(c: DocContext)
  topic: TopicKey;
  yields?: Yield[];                             // §5 : « cède sur… »
  reveals?: { on: PieceRef[]; by: PersonId; line: string }[];
}
```

- **Pertinence.** Une pièce est pertinente si ses objets croisent ceux du sujet (`topicSubjects`, `questions.ts` : objet et thèmes de la famille). La règle vaut pour tout sujet ; la table n'ajoute que `yields` et `reveals`.
- **Chaîne.** Elle est fixée par famille, identique avec ou sans anomalies (`QUESTION_FAMILIES[f].chain`) : `account`, `entry`, `migration` : Karim → DAF ; `estimate` : DAF → DG (ICNE : Karim → DAF) ; `programme`, `replacements`, `maintenance-plan` : Moreau → DAF → DG ; `supplier` : Moreau → DAF ; `recovery`, `rent-revision` : Petit → DAF → DG ; `related-parties`, `litigation`, `subsequent-events`, `compliance` : DAF → DG ; `document` : émetteur → DAF → DG.
- **Cumul.** Les pièces se cumulent par sujet, toutes séances et personnes de la chaîne confondues.
- **Table.** Elle est construite avec les documents (`DocumentSet.npc`, charge utile du worker). Les numéros du FEC y sont calculés sur le monde présenté, comme au catalogue. À l'exécution, aucune règle ne lit la clé.

### 6.3 Issues

| Issue | Condition | Effet |
|---|---|---|
| Position | pièce pertinente, ensemble incomplet, ou associée ou insistance requises et absentes | position de la personne (gabarit de la famille, nuance argumentée, sujets sans anomalie et fausses pistes compris) ; sans coût |
| Renvoi (`defer`) | ensemble complet, posé à une autre personne de la chaîne que `by` | « c'est un arbitrage de {décideur}, voyez avec lui » ; progrès consigné, sujet prêt |
| Concède | ensemble complet, posé à `by`, avec l'associée et l'insistance si elles sont requises | réplique, compte rendu, concession pour J6 ; relation +2 (`concessionObtained`) |
| Révèle | pièce de `reveals.on` posée à `by` | fait nouveau, compte rendu avec indice |
| Hors sujet | pièce non pertinente, ou compte rendu d'une autre personne | `offTopicEvidence`, humeur réservée |
| Déjà acquis | sujet concédé | rappel |

Un test compare, sur tous les sujets débloqués, les classes d'issue et les répliques avec et sans anomalies : seules `concede`, `defer` et `reveal` diffèrent.

### 6.4 Insister, mettre en cause

- **Insister.** Une fois par sujet et par séance, au coût `insist` × sensibilité ; pour Karim, la perte porte sur sa jauge (−5). Le personnage ne bouge que si un `Yield` porte `requiresInsist`, que le reste de son ensemble est posé et qu'il n'est pas hostile. Sinon, il répond par la réplique générique `holds`.
- **Mettre en cause.** L'action est proposée sur tout sujet et coûte toujours `accusation` (ton agressif). Elle est « sans preuve » si le sujet n'est pas concédé : `unfoundedAccusation` s'ajoute, doublé sur `supplier` et `related-parties`, où la mise en cause vise l'intégrité d'une personne (F4 : « dégrade fortement »). La personne devient hostile pour 10 jours ouvrés.

### 6.5 Positions par partie (CDC §5, `stance` des modules)

| Partie | Sujet | Décideur (chaîne) | `all` | Associée, insistance |
|---|---|---|---|---|
| A03 | `programme:CLF` | DAF (article 1583, PV-14) | `promesses-clos-fleuri`, `levee-condition-clos-fleuri` | — |
| A04 | `programme:GLB` | DG ; Moreau révèle | `pv-ca-2025-06`, `avenant-anru-glycines`, `deliberation-relogement` | — |
| A05 | `estimate:pge` | DG ; la DAF renvoie | `ppe-officiel`, `budget-2026`, `pv-ca-2025-12` | associée |
| A06 | `programme:PEU` | DAF ; Moreau révèle | `factures-peupliers` | — |
| A07.a | `estimate:impairment` | DAF ; Petit révèle | `stats-recouvrement`, `rapport-prestataire-recouvrement`, `annexe-2025` | — |
| A10.b | `estimate:regularisation` | DAF ; Petit renvoie | `fiches-poste-gardiens`, `reference-charges-gardiens` | — |
| A11 | `entry:<PAR>` | DAF | `conventions-gestionnaires-foyers`, `confirmations-gestionnaires`, `journal-ecritures-inventaire` | associée |
| A12.i | `related-parties` | DG | `convention-soutien-csh` | associée et insistance |
| A12.iii | `related-parties` | DAF | `convention-soutien-csh` | insistance (demande de la déclaration) |
| A14.ii | `document:rapport-gestion-2025` | DAF | `rapport-gestion-2024`, `rapport-vacance` | — |
| A15 | `subsequent-events` | DAF (jusqu'au 17/03) | `courrier-mandataire` | — |
| A17 | `rent-revision` | DG ; Petit renvoie | `pv-ca-2024-10`, `reference-irl`, `quittances-echantillon` | — |

- **Fiches de référence.** J5a remplace `memo-charges-recuperables` et `memo-irl` par des fiches de référence neutres dans les `requiredEvidence` d'A10.b et d'A17 (`modules/revenue.ts`) : on montre au client le texte et la publication, pas la doctrine du cabinet (§7.4, PV-115).
- **Parties `accepts`.** Chacune a une entrée avec une pièce décisive choisie parmi ses indices ; le décideur est le `character` de la `stance`. A09 révèle « ce courrier ne m'est jamais parvenu » (`courrier-caducite-charmes`).
- **Recoupement** (§18). `by` = `character`, mêmes pièces, `requiresPartner` identique. Toute pièce d'un `Yield` est pertinente pour son sujet.
- **Portée.** La concession est un fait d'entretien. Le constat, la correction et l'opinion restent au joueur et à J6.

### 6.6 Indice de fraude (A11, §5 « bonne conduite »)

- **Demander sans annoncer.** La demande de pièce de J4 (justificatif de l'écriture, au chef comptable) n'est pas une action de séance. La note de calcul garde sa date (27/02/2026).
- **Confronter seul.** J5 n'en tire aucun effet visible. J6 dérive `a11ConfrontedAlone` des actions stockées : pièce contradictoire posée, ou mise en cause, devant la DAF, sans l'associée, avant toute remontée.
- **Remonter.** Le drapeau « suspicion de fraude / irrégularité » est proposé sur tout constat (§10.3). Remonter un constat qui porte le drapeau ou le traitement `governance` déclenche une réponse de l'associée, identique pour tous. Elle annonce les réponses de la NEP 240 : extension des tests d'écritures aux écritures manuelles de la direction passées après la clôture, revue des estimations à la recherche d'un biais, réappréciation de la fiabilité des déclarations de la direction. Elle ajoute qu'elle informera le président du CA (§6.7).
- **Confronter avec l'associée.** L'ensemble complet posé, la DAF concède. Concession consignée : « extourne obtenue ; le traitement de l'indice se poursuit ».
- **Révélation au procureur.** Elle est instruite par l'associée : le jeu n'en tire aucune conclusion juridique (PV-02).

### 6.7 Associée et président en séance

- **Venue.** L'associée accepte une séance avec une personne si un constat remonté porte sur un sujet de cette personne (pertinence du §6.2) et si sa confiance est ≥ 30. Sous 30, elle vient encore pour les constats remontés avec au moins deux pièces (instantané) ; elle demande alors un point (message).
- **Décompte.** Une séance compte si l'associée s'exprime sur un sujet prêt (concession ou renvoi qui la requiert). Cinq au plus (`partnerMeetings.max`). Sont hors plafond les sujets dont la remontée est significative (magnitude ≥ seuil) ou porte le drapeau, et les séances du président. Au-delà du plafond : « voyez d'abord avec Antoine ».
- **`weakPartnerMeeting`** (−3). Séance avec l'associée close sans aucune pièce pertinente pour un constat remonté. La règle ne lit que les objets.
- **Président.**
  - À la planification : une séance avec l'associée, sur `fraud-inquiry`, `related-parties` et `entity-overview` (entretiens de la gouvernance, NEP 240).
  - Au final : une séance après la remontée d'un constat de gouvernance ou suspect ; elle date `governanceInformedOn`.
  - Ces séances sont hors plafond.

## 7. Confidences de Karim et pièces conditionnelles

### 7.1 Jauge de Karim (§10.2 : « tête-à-tête, respect, absence de mise en cause publique »)

| Fait | Effet |
|---|---|
| Tête-à-tête où Karim répond à au moins une question de son domaine (`account`, `entry`, `migration`, `estimate` ICNE, `wellbeing`, `fraud-inquiry`) | +8, +5 et +3 pour les trois premiers de la phase, puis +2 au plus par semaine (`oneToOne`) |
| Constat sur un objet de son domaine (compte, écriture, migration) passé « écarté » ou « clos » avec au moins une pièce liée | +5, une fois par constat (`karimCleared`) |
| Demande en double qui lui est adressée | −5 (`karimDuplicate`) |
| Insistance auprès de Karim | −5 |
| Séance « en présence de la DAF » : pièce, insistance ou mise en cause sur `account`, `entry`, `migration` ou `estimate` ICNE | −15 (`publicBlame`) |
| Confidences reçues, option attendue ou promesse | +10 (`sourceProtected`) |
| Source exposée | −40 (`sourceExposed`) ; DAF hostile jusqu'à la fin ; relation −5 |

En partant de 20, trois tête-à-tête à la planification (+16) et trois à l'intérim (+16) mènent à 52 ; le premier du final (+8) atteint 60. Cela fait environ sept séances utiles, soit 2 à 3 h du senior.

### 7.2 Confidences

- **Question.** `fraud-inquiry` posée à Karim : « Y a-t-il des écritures de clôture qui vous ont mis mal à l'aise ? ».
- **Réponse partielle**, constante tant que les conditions ne sont pas réunies (confiance ≥ 60, tête-à-tête, final) : « La clôture a été très dure avec la migration… ».
- **Réponse complète.** Karim décrit la pression sur l'objectif. Son compte rendu ne porte aucun indice et reste hors observabilité. `interviews.karim.confidedOn` remplit la condition `chiefAccountantConfides`, qui débloque les deux courriels de la DAF (A05, A11).

### 7.3 Traitement de la source (§8, bonus)

Le choix est stocké dans `interviews.karim.response`. La note à l'associée suit la règle du §9.

| Option (libellé ; détail) | Effets visibles | Pour J6 |
|---|---|---|
| « Le remercier sans rien lui promettre » ; détail : la formulation attendue de J5-8 | Karim +10 | attendu |
| « Lui promettre que son nom ne sera jamais cité » ; puis en référer à l'associée | Karim +10 | fautif (promesse intenable : dossier, gouvernance, révélation) |
| « Interroger la DAF sur ce qu'il vous a confié » ; en citant ses propos | source exposée | fautif (et conduite A11) |
| « Garder ses propos pour vous » ; sans rien documenter | aucun | fautif |

- **Exposition.** Elle survient aussi si une pièce venue de Karim (courriels de la DAF, ses comptes rendus) est présentée à la DAF ou au DG.
- **Vocabulaire.** Aucun régime de lanceur d'alerte n'est cité (PV-104).

### 7.4 Pièces conditionnelles et nouvelles pièces

- **Contexte.** `AvailabilityContext.conditions` devient `ReadonlyMap<ConditionId, IsoDate>`. Il est construit par `conditionsMet(s)` (`game/conditions-met.ts`) à partir de `interviews` et de `ethics`. `useAvailability` (`ui/app/hooks.ts`) ajoute ces sections à son `Pick` et à son `useMemo`. `isAvailable` et `receivedOn` (`game/documents.ts:71, 97`) appliquent max(`metOn`, `doc.date`).
- **Conditions.** `chiefAccountantConfides` (§7.2) ; `tenantAssociationContact` (option « écouter » de E4) ; `siteVisit` (B1 accepté, date de la visite).
- **Nouvelles pièces** (catalogue, J5a) :
  - `courriel-association-locataires-2026` (`catalog/correspondence.ts`, 24/02/2026, `people.tenantAssociation`), présenté comme des allégations à corroborer. Il ne contient que des faits de la clé :
    - au conseil de concertation, la direction a annoncé une régularisation 2025 calculée « selon les mêmes principes que le projet 2024 » contesté (syndic, totalité des gardiens : A10, cohérent avec PV-29) ;
    - les locataires ont constaté une hausse de 3,50 % au 01/01/2025 (A17, taux tiré de `regulatory.json`).

    La date du conseil vient de `documents.json → E4.concertationDate`. **À valider** (PV-110).
  - `compte-rendu-visite-glycines` (papier de travail, condition `siteVisit`) : bâtiment B en cours de vidage, logements neutralisés. Il porte un indice A04 et corrobore sans établir le fait.
  - `extrait-pv-ca-remuneration-dg` (dossier permanent, initial, sans indice) : part variable du DG assise sur le résultat, objectif `ceoBonusResultTargetEuros` (PV-112).
  - `reference-irl` et `reference-charges-gardiens` (dossier permanent, initiaux, sans indice) : valeurs de `regulatory.json` (IRL, `recoverableShares`), mention « référence à vérifier » (PV-06, PV-18, PV-115).
- **Libellés.** `CONDITION_LABELS` gagne `siteVisit`, `AVAILABILITY_SHORT` « Entretien », `CATEGORY_LABELS` « Entretiens », `CLUE_SOURCE_LABELS` « Entretien » (`ged/labels.ts`) ; `AVAILABILITY_LABEL` est mis à jour (`desk/DesignerCard.tsx:14`).
- **Observabilité.** Les pièces conditionnelles restent hors calcul : elles renforcent les preuves sans être nécessaires.

## 8. Équipe : travaux délégués, revue, encadrement (§7)

### 8.1 Travail du membre (J5-9)

`memberWork(e, def, view, ctx)` (`game/review.ts`) est pur. L'interface le calcule à la date de livraison et le met en cache par (vue de `CaseData`, exécution) dans une `WeakMap` (`ui/screens/team/memberWork.ts`). Il entre dans `CompletionContext.memberWork`, dans `derivedRefs` et dans `formCheck` : le critère `sample` ou `recalc` est rempli par le travail du membre, et sa référence (`{ kind: 'sample' | 'recalc', id: 'member:<exécution>' }`) compte.

- **Entrées figées.**
  - Au lancement, `Execution.member = { size, seed }`. La taille vient de `plannedSize`, calculée par l'interface : population au millésime du lancement, risque et confiance dans le contrôle à cette date. La graine est l'identifiant de la procédure.
  - La population se lit à `dataViewAt(livraison)`, les sources à `availabilityContext(s, params, livraison)`.
- **Échantillon.**
  - Tirage par unités monétaires, ou sélection de la variante.
  - Règle de signalement `review.json → memberFlags[population]`. Elle ne lit que les champs de `PopulationItem` (libellé, tiers, compte, montant, date, pièce) ou les données des outils du joueur (`rentExcess`), jamais `clues` ni un champ caché des jeux de données. Elle s'applique à tous les éléments, propres compris.
  - Le membre signale les éléments à apprécier et les pièces à obtenir, sans rien chiffrer ; le joueur demande la pièce et apprécie.
  - Exemple, `capitalised-works` : « écriture sans facture fournisseur » et « libellé contenant entretien, réparation ou peinture ». Sur dix éléments, elles en signalent deux : le transfert des Peupliers, et la facture des portes palières des Peupliers (82 k€, libellé « programme d'entretien »), qui est un remplacement de composant légitime, donc un faux positif. Le mot « remplacement » est écarté : il signalerait huit factures sur dix.
- **Recalcul.** `runRecalc` sur les hypothèses du client, sur chaque périmètre accessible (`toolAccess`). Pour chaque hypothèse, la note donne la valeur du client à côté de celles des sources disponibles à la livraison que nomme `review.json → recalcSources[outil]`. Ces valeurs sont lues par des accesseurs nommés, sur les mêmes données que les documents. Aucun montant corrigé n'est calculé.
- **Points.** Ce sont les documents de `executionReach` qui portent un indice d'une partie de `effectiveFor`, nommés au niveau de la pièce (règle de J4, inchangée).
- **Feuille.** `delegatedWorksheet` (`program.ts`) intègre ce travail, la note du membre et la conclusion proposée. Le joueur peut toujours tirer son propre échantillon ou refaire le recalcul.

### 8.2 Variantes T1 à T4

`variantOf(e, def, briefings)` vaut `faulty`, `mitigated` (consigne qui vise le défaut) ou `correct`. Les notes sont des gabarits de `review.json` ; les montants sont tirés du moteur et des pièces.

| Var. | Procédure, membre | Travail fautif et note | Avec la consigne qui vise le défaut | Reprise sur le motif juste |
|---|---|---|---|---|
| T1 | `lender-confirmations`, Léa | « Capital restant dû confirmé {confirmed} contre {booked} en comptabilité, écart de {gap} : décalage de calendrier, RAS » ; conclusion « satisfaisant » (`unexplainedDifference`) | écart signalé « à analyser », sans explication ni compte | écart rapproché du versement du {date}, absent de l'état de la dette, porté au compte {account} ; conclusion « anomalies » |
| T2 | `additions-test`, Hugo | les cinq plus grosses factures fournisseurs (J5-13) : « aucune exception ; conclusion étendue aux travaux immobilisés » (`nonRepresentativeSample`) | toutes les factures fournisseurs (neuf éléments), écritures d'OD toujours omises, conclusion encore étendue | les dix éléments examinés (la population entière, puisque la taille plancher est 10) et la règle de signalement appliquée (ci-dessous) |
| T3 | `impairment-recalc`, Léa | hypothèses du client : « fichier de dépréciation recalculé : concordant », aucune source (`clientDataNotChallenged`) | liste des pièces à obtenir, sans valeurs | valeurs des sources disponibles (méthode de l'annexe, statistiques de recouvrement, rapport du prestataire) à côté des hypothèses du client ; à défaut, pièces à obtenir |
| T4 | `rent-increase`, Hugo | « Quittances concordantes avec les états de quittancement : aucune exception » (`objectiveNotCovered`) | taux appliqué rapproché de la délibération (3,50 % contre 3,50 %) : aucune exception | taux appliqué comparé à la hausse autorisée (`rentExcess`, IRL de `regulatory.json`) : éléments en dépassement |

- **A06 après la reprise de T2.** La population contient l'OD des Peupliers (pièce `MES-OP-PEU-A2025`, 378 k€), signalée par la règle « sans facture fournisseur ».
  - Son justificatif (`entry-voucher:2025:<n°>`, générique, sans indice) liste les trois factures et leurs bons de commande, grâce aux références `inv:` de la ligne 2135.
  - L'indice A06 est porté par `factures-peupliers` et `bons-commande-peupliers` (`programme-invoices:PEU`).
  - Sans reprise, un échantillon correct du joueur couvre lui aussi toute la population.
- **Feuille fautive acceptée.** Elle ne retire aucune pièce : A06, A07, A17 et A18 restent détectables par le travail du joueur (test, §18).

### 8.3 Revue

- **Conditions.** `acceptWorksheet` et `returnWorksheet` (`game/review.ts`) exigent une feuille livrée et sans attente (`pending === null`), préparée par un membre autre que le senior. Un renvoi exige un motif et un commentaire. Chaque décision coûte 0,25 h au senior et ajoute un tour à `reviewRounds` ; le statut est dérivé : à revoir, acceptée, en reprise, reprise livrée.
- **Motifs** (`review.json → returnMotives`), sans « autre motif » :
  - écart non expliqué ou explication non corroborée ;
  - sélection non représentative ou conclusion étendue au-delà des éléments testés ;
  - données ou hypothèses de l'entité non corroborées ;
  - travail qui ne répond pas à l'objectif ou à l'assertion ;
  - documentation incomplète, fondée si `formCheck` signale un manque ; la reprise complète alors les références.
- **Un renvoi par feuille.** Un second renvoi n'est possible que pour « documentation incomplète » fondée. Au-delà, le senior reprend lui-même la feuille.
- **Reprise.**
  - Heures : `reworkShare` × heures de la procédure, figées dans le tour.
  - Ordonnancement : une seule liste de tâches (exécutions et reprises) triée par (`earliest`, `seq`), commune à `scheduleExecutions` et `previewLaunch`. Une tâche nouvelle ne déplace jamais une tâche plus ancienne (test). Aucune reprise ne déclenche d'arbitrage.
  - Refus : si le membre ne peut pas finir avant de quitter le site, le renvoi est refusé (« Léa n'est plus sur le dossier : reprenez vous-même la feuille »).
  - Résultat : la reprise ne change la feuille que si le motif vise le défaut réel (variante, ou `formCheck`) ; sinon le membre répond « rien à modifier sur ce point ».

| Travail | Décision | Visible avant le 16/03 | Revue du dossier, 16/03 | Pour J6 (`reviewOutcome`) |
|---|---|---|---|---|
| fautif | renvoi, motif juste | heures ; feuille corrigée | — | revue juste |
| fautif | renvoi, autre motif | heures ; « rien à modifier » | note de revue, associée −3 | revue erronée |
| fautif | acceptation | aucun | note de revue, associée −3 | feuille fautive acceptée |
| correct | acceptation | aucun | — | revue juste |
| correct | renvoi sans fondement | heures ; « rien à modifier » | note de revue, associée −3 | renvoi sans motif |

### 8.4 Notes de revue du 16/03

Le 16/03 (`completion.from`), l'associée revoit le dossier. Son message liste les feuilles en cause dans des termes génériques (« insuffisances non relevées en revue », « renvoi sans fondement »), et chacune coûte −3 (`reviewError`). Le fournisseur `reviewNotes(s, params)` lit les tours et la variante, en O(nombre d'exécutions). Pendant la synthèse, le senior peut refaire lui-même le travail ; c'est utile pour J6, mais la confiance n'est pas rendue.

### 8.5 Consignes et aide

- **Consignes** (J5-15). `review.json → briefings` propose quatre points : rapprocher chaque réponse de la comptabilité ; échantillon représentatif, sans extrapoler ; corroborer les hypothèses de l'entité ; tester la règle visée, pas seulement la concordance. Le joueur en choisit un par membre et par phase, pour 0,5 h (`ProgramState.briefings`). L'offre est la même pour tous ; seules les fiches disent que Léa est littérale et qu'Hugo prend des raccourcis. Une consigne qui vise le défaut le réduit (§8.2) ; sinon, elle n'a pas d'effet visible. Hugo, avec T2 et T4 dans la même phase, n'en reçoit qu'une : il faut anticiper.
- **Aide de Léa** (niveau assistant, `teamHints`). Au début de l'intérim et du final, Léa envoie un message « zones à creuser ». Il désigne les cycles selon la règle du conseil d'Antoine (`aid.ts`), les facteurs de risque marqués sans constat ouvert et les feuilles livrées non revues. Il ne lit que les données du joueur.
- **Messages de l'équipe.** Livraisons, reprises, heures disponibles de Sofia.

## 9. Éthique et indépendance (§8)

`params/ethics.json` décrit chaque événement : déclencheur, expéditeur, message, options (`id`, libellé, détail, effets), échéance. L'option par défaut ne change jamais l'état. `params/ethics-outcomes.json` (`expected`, `acceptable`, `fault`) n'est lu que par le mode concepteur et par `game/j6/`.

**Note à l'associée** (J5-16). Depuis tout message éthique, et après les confidences de Karim, le joueur peut rédiger une note documentée attachée au message (texte libre, jamais lu, `ethics.notes`). Le jour ouvré suivant, elle vaut associée +3 (`ethicsReported`) pour E1, E3, E4, E5 et Karim, 0 pour E2, et −1 pour B1 et B2 (`needlessReport` : « ne me dérangez pas pour ça »).

| Év. | Déclencheur, échéance | Options | Effets visibles en J5 | Pour J6 |
|---|---|---|---|---|
| E1 — loge pour un match de rugby (DG) | message du 18/11/2025 ; match le 29/11 ; échéance le 28/11 | décliner poliment en invoquant les règles de la profession / accepter les deux places en remerciant le DG / accepter une seule place pour ne pas froisser le DG | accepter : relation +3 (`courtesyAccepted`) ; sans réponse : neutre | accepter = faute lourde ; une place = faute |
| E2 — « préparer les tableaux de l'annexe » (DAF) | message du 09/02/2026 ; échéance le 20/02 | refuser et proposer de commenter le projet établi par l'entité / préparer les tableaux demandés / refuser sans autre explication | préparer : 6 h du senior, relation +3, projet d'annexe inchangé (PV-111) ; refus sec : relation −2 | préparer = autorévision |
| E3 — PGE en « revue légère » (Antoine) | premier jour ouvré après la **première** validation du programme si `pge-review` y figurait (drapeau `pgeReview` au journal), sinon au lancement de `pge-review` ; échéance à 5 jours ouvrés | contester avec le risque du cycle et porter le sujet à l'associée / accepter la revue légère proposée / maintenir la revue complète sans en parler | accepter : `pge-review` remplacée par `pge-light` si elle n'est pas lancée ; contester : dépassement du cycle des provisions justifié (`overrunJustified`) ; défaut = maintenir, programme inchangé | contester = attendu (NEP 330, PV-08 ; environ +9,5 h de senior) |
| E4 — contact direct de la présidente de l'association | message du 24/02/2026 ; échéance le 06/03 | l'écouter sans rien divulguer et noter ses propos / l'écouter et lui faire part de vos constats / décliner et la renvoyer vers la direction | écouter : la pièce du §7.4 arrive | attendu = écouter, ne rien divulguer, informer l'associée (note), corroborer avant usage ; partager = atteinte au secret professionnel (PV-99) ; décliner = information perdue |
| E5 — mandat et rapport « sans histoires » (DG) | première séance avec le DG au final **sans** l'associée ; à défaut, le 06/03, Antoine rapporte la remarque après un appel du DG ; échéance le 13/03 | recadrer poliment, documenter, remonter à l'associée / ne rien faire / lui laisser entendre que le rapport sera sans difficulté | laisser entendre : relation +3 | intimidation (PV-100) ; laisser entendre = faute |
| B1 — visite des Glycines (Moreau) | message du 18/11/2025 ; échéance le 20/11 | accepter la visite le jour ouvré suivant (2 h du senior) / décliner faute de temps | accepter : compte rendu de visite (§7.4) | sans enjeu |
| B2 — déjeuner à la cantine du personnel (Petit) | message du 25/02/2026 ; échéance le jour même | accepter le déjeuner / décliner poliment | aucun | sans enjeu |
| Bonus — Karim se confie | §7.2 | §7.3 | §7.3 | traitement de la source |

Les échéances figurent dans `upcomingEvents` (sorte `deadline`) dès réception du message. Les déclarations d'indépendance restent dans la procédure `engagement-acceptance` (J4).

## 10. Jauges (§10.2)

### 10.1 Calcul

`gaugeValues(s, params, date)` (`game/gauge-values.ts`) part de `game.json → gauges` :

1. **Événements.** Ceux que J4 stocke (`state.gauges.events`) et ceux des fournisseurs du registre `GAUGE_PROVIDERS` : `interviewGaugeEvents` (Karim compris), `ethicsGaugeEvents`, `reviewGaugeEvents`, `escalationGaugeEvents`.
2. **Ordre.** Tri par (`on`, `seq`, rang du fournisseur). Toute action stockée porte `seq` (compteur de `nextId`) ; les événements de J4 aussi (`GaugeEvent.seq`, numérotés à la migration). Les règles « trois au plus » (`timelyEscalation`, `unrelatedRequest`) s'évaluent dans cet ordre.
3. **Effet.** Delta × multiplicateurs (sensibilité ; `clientRelationLossFactor` sur les pertes de relation), arrondi une fois à l'entier (moitié loin de zéro), puis borné entre 0 et 100.
4. **Remontée** de la relation entre deux événements (J5-18), calculée par différence de jours ouvrés, sans balayage jour par jour.

`gauges.ts` reste une feuille : types, schéma, `recordGaugeEvent`. Le seuil `relationLow` est calculé par l'appelant et passé à `sendRequest` et à `ask`. `advanceTo` n'applique rien ; `clock.processedUntil` est gardé, sans usage. Les lectures de `initial` (`GaugesCard.tsx → gaugeValue`, `Shell.tsx`) sont remplacées.

### 10.2 Barème (`params/gauges.json → effects`)

| Code | Jauge | Effet | Source, date |
|---|---|---|---|
| `duplicateRequest` | relation | −2 | `requests.ts` (J4), envoi |
| `unrelatedRequest` | relation | −1 au-delà de trois par phase | `requests.ts` (J4), envoi |
| `interimWithoutPlanning`, `unjustifiedOverrun`, `aidUsed` | associée | −10, −8, −3 | J4 |
| `insist` | relation (Karim : sa jauge, −5) | −3 × sensibilité | séance |
| `offTopicEvidence` | relation | −2 × sensibilité | séance |
| `accusation` | relation | −5 × sensibilité | séance |
| `unfoundedAccusation` | relation | −10 ; −20 sur `supplier` et `related-parties` | séance |
| `concessionObtained` | relation | +2 | séance |
| `calmSession` | relation | +1, deux par semaine au plus | clôture de séance |
| `relationRecovery` | relation | +1 par jour ouvré vers 50, après 10 jours ouvrés sans événement négatif (sans effet au-dessus de 50) | dérivé |
| `weakPartnerMeeting` | associée | −3 | séance |
| `oneToOne`, `karimCleared`, `karimDuplicate`, `publicBlame`, `sourceProtected`, `sourceExposed` | Karim (`sourceExposed` : relation −5 en plus) | §7.1 | entretiens, demandes, constats |
| `courtesyAccepted` | relation | +3 (E1, E2 et E5 sur l'option fautive) | choix |
| `bluntRefusal` | relation | −2 (refus sec de E2) | choix |
| `ethicsReported` | associée | +3 (E1, E3, E4, E5, Karim) | note, jour ouvré suivant |
| `needlessReport` | associée | −1 (B1, B2) | note, jour ouvré suivant |
| `timelyEscalation` | associée | +4, trois au plus | remontée |
| `weakEscalation` | associée | −2 | remontée |
| `lateSurprise` | associée | −6 par constat | 16/03 |
| `reviewError` | associée | −3 par note de revue | 16/03 |

### 10.3 Remontées et surprises tardives (J5-19)

- **Saisies du joueur.** Le drapeau `Finding.suspicion` est proposé sur tout constat. `Finding.piecesOn` date la liaison de la 1re et de la 2e pièce. Chaque entrée d'historique note `magnitude` et `suspicion`. La magnitude vaut max(\|résultat\|, \|capitaux propres\|, \|plus forte variation d'une ligne du bilan\|) de l'écriture proposée : le formulaire la calcule par `impactOfLines` et la passe à `createFinding`, `updateFinding` et `escalateFinding`.
- **Instantané.** `escalateFinding` fige `Finding.escalation = { on, seq, evidence, magnitude, status, hasEntry, suspicion }` ; `escalatedToPartnerOn` est gardé.
- **`timelyEscalation`.** Deux conditions :
  - statut « constat » avec écriture proposée et au moins deux pièces, ou drapeau et au moins une pièce ;
  - remontée dans les 3 jours ouvrés de la création, ou de la date où le minimum de pièces a été atteint.

  Une remontée des deux derniers jours ouvrés du final est neutre.
- **`weakEscalation`.** Remontée sans aucune pièce et sans drapeau.
- **`lateSurprise`.** Constat dont la dernière entrée d'historique au plus tard le 13/03 est au statut « constat », avec une magnitude au moins égale au seuil de planification en vigueur à cette date ou le drapeau, et qui n'a pas été remonté au plus tard le 13/03. L'effet est daté du 16/03. Rétrograder ou supprimer le constat ensuite ne l'efface pas. Les constats qui ne remplissent ces conditions qu'après le final relèvent de J6.
- **Réponses de l'associée.** Accusé de réception générique, sans jugement de fond ; pour le drapeau ou le traitement `governance`, la réponse du §6.6.

### 10.4 Seuils

| Jauge | Seuil | Effet |
|---|---|---|
| Relation client | < 30 | Délais × 1,5 figés à l'envoi (`RequestItem.lowRelation`, lu par `delayDays`, cumulé avec `responseDelayFactor`) ; réponses partielles ; espacement + 2 jours ouvrés ; message de la DAF (« mes équipes croulent sous les demandes ») |
| Confiance de l'associée | < 30 | Elle ne vient plus en séance que pour les constats remontés avec au moins deux pièces ; elle demande un point |
| Confiance de Karim | ≥ 60 (`characters.json → karim.confideAt`) | Confidences possibles au final |

### 10.5 Retour visible sans révéler la clé

- **Carte « Jauges » du bureau.** Valeur, seuil bas et cinq dernières variations, avec un libellé générique (« Demande en double », « Mise en cause sans preuve », « Remontée documentée pendant les travaux »).
- **Franchissements.** Les messages de franchissement à la baisse sont datés par les événements qui les causent.
- **Karim.** Sa jauge est visible ; son seuil ne l'est qu'au niveau assistant (`showKarimThreshold`).

## 11. Messagerie (§11)

### 11.1 Modèle

`inbox(s, ctx)` (`game/messages.ts`) réunit :

- les messages du catalogue dont la condition est remplie à la date et dont `levels` contient le niveau ;
- les messages des fournisseurs du registre `MESSAGE_PROVIDERS` : événements éthiques et confidences ; réponses aux remontées (§10.3) ; alertes de budget d'Antoine à 80 % et 100 % ; rappels de J4 (`partnerReaction`, confirmations) ; franchissements de seuil ; livraisons, reprises, notes de revue du 16/03, aide de Léa.

Un message a la forme `{ id, on, seq?, from, subject, body[], links: { to, focus?, tutorial? }[], ethics?, tutorial?, levels? }`. Son corps est un gabarit (`{date:…}`, `{person:…}`, `{firm}`, `{period:interim.to}`, `{vintage:cutoff}`) : aucun montant n'est saisi. Seule `messages.read` est stockée ; reculer l'horloge masque les messages postérieurs.

### 11.2 Catalogue (`params/messages.json`)

| Id | Date ou déclencheur | De | Objet |
|---|---|---|---|
| `partner-planning` | `startDate` (03/11/2025) | associée | Prise en charge du dossier (`tutorial: 'welcome'`) |
| `manager-programme` | 03/11/2025 | manager | Programme 2024 du cabinet, budget |
| `partner-interim` | `interim.from` (17/11/2025) | associée | Intérim |
| `sofia-availability` | 17/11/2025 | Sofia | Ses heures à l'intérim et au final |
| `ethics-e1`, `ethics-b1` | 18/11/2025 | DG ; Moreau | E1 ; B1 |
| `manager-confirmations` | 20/11/2025, si rien n'est préparé ; `levels` assistant et senior | manager | Rappel des confirmations (J4) |
| `partner-offsite` | `interim.to` (20/11/2025) | associée | Hors site |
| `ethics-e2` | 09/02/2026 | DAF | E2 |
| `partner-final` | `final.from` (23/02/2026) | associée | Final |
| `ethics-e3` | §9 | manager | E3 |
| `ethics-e4`, `ethics-b2` | 24/02/2026 ; 25/02/2026 | présidente de l'association ; Petit | E4 ; B2 |
| `ethics-e5` | 06/03/2026, à défaut de séance | manager | Remarque du DG rapportée (E5) |
| `partner-after-final` | `final.to` (13/03/2026) | associée | Après le final |

- **Messages de phase.** Ils reprennent le texte, les dates et les liens de `usePhaseMessage` (`DeskScreen.tsx`) ; un test vérifie l'identité.
- **Courrier.** Le courrier postérieur (presse du 03/03, mandataire du 15/03) n'est pas annoncé : il arrive dans « Courrier reçu », comme en J4.

### 11.3 Arrêts, tutoriel, bureau

- **Arrêts.** `nextEventDate` (`advance.ts`) s'arrête aux nouveaux messages (sorte `'message'`, non listée, car un mail du DG n'est pas connu d'avance) et aux échéances éthiques (listées). Les arrêts se calculent à partir des dates des événements dérivés. Les reprises apparaissent comme des livraisons.
- **Tutoriel.** Liens typés et ancres `data-tutorial` stables sur les écrans nouveaux ; condition `planning` (seuils, risques, programme validés) pour J7.
- **Bureau.** La carte « Messages » (dernier non lu) remplace `PartnerMessage`.

## 12. Mémo réglementaire (§10.4, annexe ; étape J5d)

### 12.1 Forme

- **Écran.** `/memo` : recherche plein texte (pliage de `game/text.ts`), sections repliables, liens vers les mémos techniques de la GED.
- **Contenu.** `src/scenario/memo/memo.json`, schéma `memo/schema.ts`, sections → entrées `{ id, title, text[], refs[], params[], seeAlso[], keywords[] }`. Le mémo n'est importé que par `ui` ; les couches restent inchangées.
  - `refs` renvoie à `references.json`. Une référence `cdc` s'affiche précise, avec la mention « référence à vérifier » (précédent de J4) ; une référence `general` est formulée en termes généraux.
  - `params` insère des valeurs de `regulatory.json`. Le résolveur `memo/resolve.ts` gère les tableaux : sur un tableau, il retient l'élément dont le champ clé (`id`, `quarter`, `from`) vaut le segment (`{regulatory:irl.values.2024-T2.annualChangePct}`). Un test résout chaque gabarit.
- **Statut des mémos techniques.** Les mémos du cabinet sont des références de l'auditeur (le critère), pas des pièces probantes sur l'entité ; en confrontation, on présente les fiches de référence (§6.5). Une entrée liée à un paramètre peut servir de source d'hypothèse (`param:<nom>`, plan J4 §11).

### 12.2 Contenu (amorce de l'annexe, complétée)

| Section | Entrées | PV |
|---|---|---|
| Normes d'exercice professionnel | Une par NEP de l'annexe : numéro et objet, sans paragraphe ; NEP 230 (qui a fait le travail, qui l'a revu) et NEP 300 (direction, supervision et revue) en termes généraux | PV-08, PV-101 |
| Fraude | Comptabilisation des produits : « risque à considérer » tant que PV-01 n'est pas validé. Réponses à un indice qui implique la direction : tests d'écritures étendus, biais des estimations, fiabilité des déclarations. Alerte de l'associée | PV-01 |
| Trois canaux distincts | Signalement des irrégularités à la prochaine assemblée ; communication avec l'organe d'administration (NEP 260) ; révélation des faits délictueux au procureur de la République, instruite par l'associée | PV-02 |
| Déontologie et indépendance | Cadeaux et avantages (E1) ; services interdits, autorévision (E2) ; intimidation et sauvegardes, avec l'associée informée qui décide d'en saisir la gouvernance (E5) ; secret professionnel (E4) | PV-15, PV-99, PV-100 |
| Supervision | Direction, supervision et revue des travaux (T1 à T4), notes de revue | PV-101 |
| Code de commerce | Conventions réglementées d'un organisme HLM sous forme de SA, en termes généraux tant que PV-03 n'est pas tranché ; délais de paiement (L. 441-14, D. 441-6) | PV-03, PV-05 |
| CCH | Autofinancement net ; avances intra-groupe (L. 423-15) ; révision des loyers selon l'IRL du 2e trimestre et dérogations ; groupe sous 12 000 logements ; RLS | PV-10, PV-04, PV-11, PV-13, PV-102 |
| Charges récupérables | Décret n° 82-955 modifié ; quotes-parts des gardiens (`recoverableShares`) | PV-06 |
| Cadre comptable | PCG (ANC n° 2014-03) ; ANC n° 2015-04 et « instruction comptable applicable aux exercices 2025 » ; ANC n° 2025-05, applicable au 01/01/2026, à ne pas mélanger | PV-103, PV-21 |
| Données de marché | Livret A, IRL des 2es trimestres 2024 et 2025, plafonnement à 3,5 % et sa période | PV-17, PV-18 |
| Décence énergétique | Logements G non décents pour les baux conclus ou renouvelés depuis le 01/01/2025 | PV-12 |
| Méthode | Rapprochement des confirmations (T1) ; représentativité et extrapolation (T2) ; corroboration des estimations (T3) ; événements postérieurs et déclarations de la direction (A15) ; déclarations orales à corroborer (NEP 500) ; extension de la revue des remplacements (A02, NEP 450) | PV-08, PV-09, PV-114 |

### 12.3 Références à inscrire dans `docs/points-a-verifier.md`

Aucun texte du jeu ne cite une référence précise absente de ce tableau ou de `references.json`. Une référence précise du CDC s'affiche avec la mention « référence à vérifier » ; les autres restent générales. J5a écrit la section J (PV-99 à PV-118) ; J5d tient sa propre section, « Mémo réglementaire », qui reprend le statut de chaque référence du mémo.

| ID | Sujet | Dans le jeu |
|---|---|---|
| PV-01 (étendu) | Présomption sur les produits ; réponses de la NEP 240 à un indice impliquant la direction ; information du président par l'associée | « risque à considérer » ; termes généraux |
| PV-02 (étendu) | Trois canaux distincts ; révélation instruite par l'associée (L. 823-12) | référence du CDC, « à vérifier » |
| PV-03 | Conventions réglementées d'un organisme HLM | termes généraux jusqu'à validation |
| PV-06, PV-18 (étendus) | Fiches de référence (gardiens, IRL) | valeurs des paramètres, « à vérifier » |
| PV-08 (étendu) | NEP 230, 250, 300, 330 (E3), 450 (A02), 500, 505 (T1), 530 (T2), 540 (T3), 560 et 580 (A15) | numéro et objet, sans paragraphe |
| PV-14, PV-04, PV-11 | Répliques des A03, A12, A17 ; note de T4 | arguments, « à vérifier » |
| PV-15 (restreint) | Cadeaux, services interdits, autorévision, intimidation (E1, E2, E5) | « règles déontologiques de la profession », sans article |
| PV-21 | Libellé « instruction comptable applicable aux exercices 2025 » | libellé corrigé |
| PV-99 | Secret professionnel du commissaire aux comptes (E4) | sans article |
| PV-100 | Intimidation et sauvegardes ; renouvellement du mandat voté par l'assemblée sur proposition du conseil (E5) | termes généraux |
| PV-101 | Supervision et revue : NEP 230 et 300 en termes généraux ; notes de revue du 16/03 | numéros sans paragraphe |
| PV-102 | RLS | sans article |
| PV-103 | PCG, règlement ANC n° 2014-03 | numéro du CDC, intitulé à confirmer |
| PV-104 | Source interne (Karim) : aucune promesse de confidentialité, aucun régime de lanceur d'alerte | termes généraux |
| PV-105 | Barème, seuils, humeurs, remontée de la relation, arrondis (J5-17, J5-18) | choix de conception |
| PV-106 | Karim : seuil, rendements par phase, calendrier (J5-7) | choix de conception, à valider |
| PV-107 | T2 adaptée à la population de la procédure (J5-13) | écart au CDC, à valider |
| PV-108 | Coûts (0,25 h par action, revue, consignes, reprises) et fenêtres du calendrier (J5-3, J5-24) | choix de conception |
| PV-109 | Travail délégué : règles de signalement, sources des recalculs (J5-9) | choix de conception, à valider |
| PV-110 | Contenu de E4 : conseil de concertation, hausse de 3,50 % | faits narratifs, à valider |
| PV-111 | E2 accepté sans changement des documents | simplification |
| PV-112 | PV du CA sur la rémunération du DG (part variable, objectif de résultat) | faits narratifs |
| PV-113 | Famille `compliance` : suivi des recommandations de l'ANCOLS (2022), contrôles (NEP 250) | contenu du dossier permanent |
| PV-114 | Comptes rendus d'entretien : papiers de travail, déclarations orales à corroborer (NEP 500) | termes généraux |
| PV-115 | Fiches de référence à la place des mémos du cabinet dans les confrontations (A10.b, A17) | modification des `stance` |
| PV-116 | Événements sans enjeu B1, B2 ; compte rendu de visite | choix de conception |
| PV-117 | Remontées : délai de 3 jours ouvrés, fin de final neutre, drapeau, magnitude, surprise tardive (J5-19) | choix de conception |
| PV-118 | Séances du président avec l'associée (J5-21) | choix de conception |

## 13. Leviers de difficulté (§10.9)

`game.json → difficulty[niveau]` (`difficultyLevel`, `schema.ts:393`) gagne `clientRelationLossFactor`, `teamHints` et `showKarimThreshold`.

| Levier | Assistant | Senior | Manager |
|---|---|---|---|
| `clientRelationLossFactor` (relation indulgente) | 0,5 | 1 | 1 |
| `teamHints` (Léa signale des zones à creuser, §8.5) | oui | non | non |
| `showKarimThreshold` | oui | non | non |
| `aid` (J4) | gratuite | payante (confiance de l'associée) | indisponible |
| `responseDelayFactor` (J4), étendu à l'espacement des séances | 1 | 1 | 1,5 |
| `reminders` (J4) | oui | oui | non |

La note de synthèse écrite du niveau manager relève de J6. Toutes les anomalies restent actives (V1). Leviers notés pour J7 : `ironman`, compteur de rechargements hors des emplacements.

## 14. Modèle de données (`GameState` v3) et persistance

Chaque nouvelle section a son module dans `src/game/`, propriétaire de ses types, de ses actions pures et de son sous-schéma Zod.

```ts
// game/interviews.ts — QuestionKey = 'person:family[:object]' (parseQuestionKey : deux premiers ':')
type InterviewAction =
  | { kind: 'ask'; seq: number; question: QuestionKey; variant: 'full' | 'partial' | 'redirect' }
  | { kind: 'present'; seq: number; topic: TopicKey; evidence: Evidence; outcome: 'position' | 'defer' | 'concede' | 'reveal' | 'offTopic' | 'already'; exposes?: true }
  | { kind: 'insist'; seq: number; topic: TopicKey; outcome: 'moved' | 'holds' }
  | { kind: 'accuse'; seq: number; topic: TopicKey; founded: boolean };
interface Session { id: string; seq: number; person: PersonId; on: IsoDate; audience: 'alone' | 'withCfo' | 'withPartner'; actions: InterviewAction[]; closed: boolean }
interface InterviewsState { sessions: Session[]; karim?: { confidedOn: IsoDate; seq: number; response?: { on: IsoDate; seq: number; option: string }; note?: { on: IsoDate; seq: number; text: string } } }

type ConsultedState = Record<string, IsoDate>;                 // game/consulted.ts : 'acct:4687', 'fec:2025:OD000189'

type EthicsEventId = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'B1' | 'B2';
interface EthicsState {                                        // game/ethics.ts
  choices: Partial<Record<EthicsEventId, { on: IsoDate; seq: number; option: string }>>;
  notes: Partial<Record<EthicsEventId, { on: IsoDate; seq: number; text: string }>>;
}
interface MessagesState { read: Record<string, IsoDate> }      // game/messages.ts
```

- **Types de J4 modifiés.**
  - `Execution.review` (`program.ts:54`, schéma `:86`) est remplacé par `reviewRounds: Round[]`, avec `Round = { on, seq, decision: 'accepted' | 'returned', motive?, comment, reworkHours? }`. S'y ajoutent `Execution.seq` et `Execution.member?: { size, seed }`.
  - `ProgramState.briefings: { member, phase, point, on, seq }[]`.
  - `Finding` gagne `suspicion`, `piecesOn?`, `escalation?` ; `FindingHistoryEntry` gagne `magnitude?` et `suspicion?`.
  - `RequestItem` gagne `lowRelation?: true` et `seq?` ; `GaugeEvent` gagne `seq?`.
  - L'entrée de journal `program/validated` porte `pgeReview`.
- **Documents.** `DocumentModel.workingPaper?`, `subjects?` ; mode `{ kind: 'interview'; person; question }` ; source `interview` ; catégorie `interviews` ; condition `siteVisit` ; `DocumentSet.npc` (tables du §6.2 et champs du §5.3).
- **Dérivé, non stocké.** Humeurs, disponibilités, boîte de réception, événements en attente, jauges, pièces conditionnelles, travail du membre, ordonnancement des reprises, statuts de revue, notes de revue, `a11ConfrontedAlone`, `governanceInformedOn`, `reviewOutcome`.
- **Migration** (`SCHEMA_VERSION = 3`). `MIGRATIONS[2]` :
  - ajoute `interviews`, `consulted`, `ethics` et `messages` (valeurs neuves) ;
  - remplace `review` par `reviewRounds: []` : les revues de J4 n'avaient pas d'effet, et le journal les garde ;
  - ajoute `briefings: []` et `suspicion: false` ;
  - fige un instantané `escalation` (magnitude 0) pour les constats déjà remontés ;
  - numérote `seq` sur les événements de jauge dans leur ordre.

  `MIGRATIONS[1]` rend un état v3 neuf, donc la chaîne 1 → 3 reste valide. `LoadResult.restarted` n'est vrai que depuis v1, et `store.ts:30` le lit à la place de `migratedFrom`.
- **Contenu.** `CONTENT_VERSION = 2` (comptes rendus, nouvelles pièces, `subjects`).
- **Orphelins.** `cleanOrphans` retire les actions de séance sur une question ou une pièce inconnue, les marques de lecture de messages inconnus et les choix d'options disparues ; `knownDocuments` accepte les comptes rendus (§5.6).

## 15. Paramètres et schémas

| Fichier | Contenu | Schéma |
|---|---|---|
| `params/characters.json` | `interview` (`actionHours` 0,25, `maxActions` 4) ; par personne : espacement, sensibilité, badge. `lowRelation` (`threshold` 30, `delayFactor` 1,5, `gapExtraDays` 2) ; `recovery` (`target` 50, `afterDays` 10, `perDay` 1, `concession` 2, `calmSession` 1, `calmPerWeek` 2) ; `mood`. `karim` (`confideAt` 60, `periods` [`final`], `oneToOne` [8, 5, 3], `weekly` 2). `partnerMeetings` (`max` 5, `minTrust` 30, `minEvidenceBelow` 2) ; `windows` (§4.3, `subsequentUntil` 2026-03-17) ; séances du président | `schemas/characters.ts` |
| `params/gauges.json` | `effects` (code → jauge, delta, libellé) ; `repeat.unrelatedRequest.freePerPhase` 3 ; `escalation` (`minEvidence` 2, `minEvidenceSuspicion` 1, `timelyDays` 3, `maxCounted` 3, `neutralLastDays` 2) | `schemas/gauges.ts` (énumération des codes partagée) |
| `params/review.json` | `reviewHours` 0,25, `briefingHours` 0,5, `briefingsPerPhase` 1, `reworkShare` 0,5 ; `returnMotives` ; `briefings` (`reduces`) ; `variants` T1 à T4 (défaut, gabarits, sélection de T2 : population, factures fournisseurs, `maxItems` 5) ; `memberFlags` ; `recalcSources` | `schemas/review.ts` |
| `params/ethics.json`, `params/ethics-outcomes.json` | E1 à E5, B1, B2 : déclencheur, expéditeur, options (libellé, détail, effets), échéance, heures (6 pour E2, 2 pour B1) ; issues attendues à part | `schemas/ethics.ts` |
| `params/messages.json` | Catalogue du §11.2 (`levels`, liens typés) | `schemas/messages.ts` |
| `params/game.json`, `documents.json`, `references.json`, `sampling.json` | Champs de difficulté ; `E4.concertationDate`, faits de B1 et de la rémunération du DG ; identifiants nouveaux (NEP 230, 250, 300, 330, 500, 530 ; déontologie, secret, intimidation, supervision, RLS, PCG) ; `delegatedAcquisitionsThresholdEuros` retiré | `schema.ts`, `schemas/sampling.ts` |
| `src/scenario/memo/memo.json` | Mémo (§12) | `memo/schema.ts` |

**Intégrité** (Vitest). Chaque question, confrontation, message, option, règle et motif ne référence que des pièces, personnes, familles, codes, conditions, populations et procédures existants, et chaque gabarit se résout. Le garde-fou « aucun montant saisi » (`tests/guards.test.ts`) s'étend aux nouveaux JSON, à `scenario/npc/` et à `scenario/memo/`.

## 16. Règles pures (`src/game`) et contenu (`src/scenario`)

| Fichier | Rôle et fonctions | Étape |
|---|---|---|
| `scenario/npc/sheets.ts`, `secrets.ts`, `questions.ts`, `answers.ts`, `confrontations.ts`, `interview-docs.ts` | `CHARACTERS`, secrets ; `QUESTION_FAMILIES` (chaînes, thèmes), `questionObjects`, `topicSubjects` ; `ANSWER_BUILDERS`, `genericFields`, `scenarioFields` ; `confrontationTable` ; `interviewDocuments(c: DocContext)` | J5b (bouchons J5a) |
| `schemas/conditions.ts`, `game/conditions.ts` | Schéma déplacé de `schemas/procedures.ts` (réexporté) ; sortes nouvelles `read`, `consulted` (préfixe), `finding`, `escalated`, `gauge`, `asked`, `ethics`, `confided`, `planning` ; état `planned` pour `procedure` ; accesseurs facultatifs du contexte ; `evaluate` reste exhaustif | J5a |
| `game/characters.ts` | `moodOf`, `availabilityOf`, `nextAvailable` | J5b |
| `game/interviews.ts` | `availableQuestions`, `openSession`, `ask`, `present`, `insist`, `accuse`, `closeSession`, `respondToConfidence`, `noteConfidence`, `concessions` (J6), `interviewGaugeEvents`, `hoursCharged` | J5b |
| `game/ethics.ts`, `game/escalations.ts` | `ethicsEvents` (en attente, échéances), `answerEthics`, `noteToPartner`, `ethicsGaugeEvents`, `hoursCharged` ; `escalationGaugeEvents`, réponses de l'associée | J5b |
| `game/messages.ts`, `game/gauge-values.ts` | `inbox`, `unreadCount`, `markMessageRead`, `messageStops`, `MESSAGE_PROVIDERS` ; `gaugeValues`, `gaugeHistory`, `relationLow`, `GAUGE_PROVIDERS` | registres J5a, corps J5b |
| `game/review.ts`, `game/j6/review-outcome.ts` | `variantOf`, `memberWork`, `memberFlags`, `acceptWorksheet`, `returnWorksheet`, `briefMember`, `reviewNotes`, `reviewGaugeEvents`, `teamMessages`, `leaHints`, `hoursCharged` ; `reviewOutcome` | J5c (bouchons J5a) |
| `game/program.ts`, `findings.ts`, `requests.ts`, `documents.ts`, `conditions-met.ts`, `consulted.ts`, `budget.ts`, `advance.ts`, `gauges.ts` | Liste unique des tâches, `reviewRounds`, `member`, `briefings`, `memberWork` dans le contexte, `overrunJustified` (E3), drapeau `pgeReview` ; drapeau, instantané et historique ; `seq` et `lowRelation` ; `Map` des conditions ; `conditionsMet` ; `markConsulted` ; `hoursUsed(s: GameState)` ; arrêts et échéances ; `seq` | J5a |

- **Garde-fou des imports** (`tests/game/matching.test.ts`). `secrets.ts`, `ethics-outcomes.json` et `game/j6/` ne sont importés que par les fichiers de `MATCHING_ALLOWED` et par `ui/screens/control/` (liste étendue, comme `KEY_ALLOWED`). `game/review.ts` lit les variantes : c'est une règle du joueur (le travail du membre).
- **Coût.** Un fournisseur de jauges, de messages ou d'heures coûte au plus le nombre d'actions stockées. Il n'appelle jamais `memberWork`, `populationItems`, `runRecalc` ni un constructeur de documents (garde statique). Les dérivations sont mémoïsées sur les références des sections. `markConsulted` rend le même objet si la clé est déjà notée. Les barres et le bureau lisent des sélecteurs étroits (`useHoursUsed`, `useGaugeValues`, `useUnreadCount`).

## 17. Écrans et routes

| Écran | Route | Contenu |
|---|---|---|
| Entretiens | `/entretiens`, `/entretiens/:personne` | Personnes : badge, humeur, disponibilité ou prochaine date, jauge de Karim. Séance : audience, historique, questions par famille (« déjà posée le … »), sélecteur d'objet, « Présenter une pièce », « Insister », « Mettre en cause », « Clore ». Liens vers les comptes rendus |
| Revue de l'équipe | `/equipe` | Feuilles à revoir, en reprise, acceptées. Travail du membre (note, éléments signalés, recalcul, points), conclusion proposée, « Accepter », « Renvoyer » (motif, commentaire), tours. Consignes par membre et par phase, heures, aide de Léa |
| Messagerie | `/messagerie`, `/messagerie/:id` | Boîte avec non lus, lecture, liens d'action, choix éthiques, échéance, « Note à l'associée » |
| Mémo | `/memo` | Recherche, sections, statut des références |
| Bureau | `/` | Cartes du registre : « Messages », « Feuilles à revoir » ; jauges dérivées et dernières variations |
| Barre supérieure | — | Jauges dérivées (`Shell.tsx`), badge des messages |
| Travaux | `/travaux` | « Travail préparé par … » enrichi (`ExecutionPanel.tsx`) ; la revue renvoie vers `/equipe` |
| Constats | `/constats` | Case « suspicion de fraude / irrégularité » ; instantané à la remontée |
| GED | `/ged` | Catégorie « Entretiens », mode « Entretien », « Établi le » des papiers de travail, nouvelles pièces |
| Grand livre, FEC | `/grand-livre`, `/fec` | `markConsulted` à la première ouverture |
| Mode concepteur | `/controle` | Onglets du registre : « Personnages » (fiches, secrets, confrontations), « Équipe » (variante, `reviewOutcome`), « Éthique » (issues attendues), « Jauges » (tous les événements). Actions : faire se confier Karim, déclencher E1 à E5, B1, B2. Le déblocage couvre les pièces conditionnelles (§10.10) |

- **Palette** (Ctrl+K, registre `ui/app/palette-sources.ts`) : personnes, messages, entrées du mémo.
- **Accessibilité.** Contrastes AA et clavier. Historique de séance en `aria-live="polite"`, choix en groupes radio étiquetés, badges avec texte alternatif.
- **Vérification visuelle.** `scripts/ui-check.mjs` sur les quatre écrans nouveaux, en thème clair et sombre, à 1280 et 1024 px.

## 18. Tests

**Règles pures** (fixtures légères) :

- **Entretiens.** Déblocage, présence sur site, fenêtres, plafond d'actions, heures par action, espacement arrondi, question reposée une fois par phase, réévaluation à la date, `from` (générique complet avant), variante selon la relation et l'humeur, issue figée, redirection, aller-retour de `parseQuestionKey` et de `interviewNoteId`.
- **Confrontation.** Pertinence par objets sur des sujets sans entrée ; cumul entre séances ; renvoi puis concession ; associée et insistance requises ; hostilité qui n'empêche pas la concession ; hors sujet ; compte rendu d'une autre personne ; mise en cause doublée sur `supplier`.
- **Karim.** Rendements par phase ; séance sans question de son domaine ; `publicBlame` par famille ; confidences refusées sous 60, en présence de la DAF ou hors du final, puis acceptées ; date de la condition ; quatre options ; exposition par une pièce venue de lui.
- **Pièces conditionnelles.** Une condition remplie avant la date de la pièce ne la montre qu'à sa date ; « Reçu le » vaut le max ; E4, visite ; mode concepteur.
- **Équipe.**
  - Variante seulement pour le membre scénarisé ; consigne qui réduit le défaut ; travail correct hors T1 à T4.
  - T2 : cinq factures, OD des Peupliers exclue ; la reprise couvre dix éléments et la règle la signale parmi d'autres.
  - T1 : écart calculé à partir de la réponse et de la comptabilité. T3 : sources listées. T4 : `rentExcess`.
  - Un renvoi, second renvoi seulement pour une documentation fondée ; reprise refusée après le final.
  - Notes de revue datées du 16/03 ; aucune variation visible avant.
- **Éthique.** Déclencheurs (E3 sur la première validation, figé), échéances listées, défauts sans changement d'état, note à l'associée (+3, 0, −1), E5 seulement sans l'associée, `overrunJustified`.
- **Jauges.** Tri (date, `seq`, rang) ; bornes (98 + 3 − 5) ; arrondis ; « trois premiers » ; facteur assistant ; remontée vers 50 ; délai figé sous 30 ; remontées, fin de final neutre, surprises tardives.
- **Figeage.** Agir après coup ne change pas l'historique : délier, rétrograder ou supprimer un constat après sa remontée ou après le 13/03 ; retirer `pge-review` après la validation ; changer la date ou le seuil après un lancement délégué.
- **Messagerie.** Boîte dérivée, `levels`, lecture, recul d'horloge, arrêts non listés, échéances listées, messages de phase identiques à `usePhaseMessage`.
- **Mémo.** Schéma, `refs` existants, résolveur sur les tableaux, aucune référence précise hors du §12.3.
- **Persistance.** Migrations 2 → 3 (revues abandonnées, `seq`, instantanés) et 1 → 3 ; `restarted` ; nettoyage des orphelins, comptes rendus conservés.

**Tests de J4 à mettre à jour.** `tests/game/program.test.ts:343-350` (revue), `:355` et `:404-411` (le recalcul de Léa existe désormais) ; `tests/params/procedures.test.ts:232` (littéral d'`Execution`) et `earliest` (`:250`) ; `tests/game/documents.test.ts:38, 92-93` (`Set` → `Map`) ; `tests/anomalies/observability.test.ts` (`obtainable`, `:43`) ; test de T2 de `tests/game/samples.test.ts` ; `scripts/review-pack.ts:216` ; tests d'état, d'avance, de demandes et de constats (`seq`, `lowRelation`, historique).

**Déterminisme et coût.**

- Une partie scriptée (séances, confrontations, revues, choix éthiques) jouée deux fois donne des états et des sorties identiques.
- Ni `Math.random`, ni `Date.now`, ni `new Date(` dans `game/`, `scenario/npc/` et `scenario/memo/` (`planning.ts:166` réécrit).
- Test de temps sur la partie de référence : `gaugeValues`, `inbox` et `hoursUsed` restent sous un plafond fixé.

**Aucune fuite hors mode concepteur.**

- Catalogues identiques, anomalies actives ou inactives : familles, objets, déblocages, chaînes, motifs, consignes, messages, options, règles de signalement.
- Classes d'issue et répliques des pièces pertinentes identiques, sur tous les sujets débloqués, sauf `concede`, `defer`, `reveal`.
- Test de forme : réponses du scénario contre réponses génériques ; notes correctes contre notes fautives des membres.
- Les règles de signalement ne lisent jamais `clues` (garde-fou).
- Aucun texte visible ne contient d'identifiant d'anomalie, de partie ou de fausse piste, de texte d'indice ni d'identifiant interne d'écriture.
- Pour une même partie scriptée jusqu'au 15/03, l'historique des jauges est identique avec ou sans anomalies.
- Garde-fou des imports du §16.

**Observabilité** (`tests/anomalies/observability.test.ts`, annexe régénérée en `docs/j5-observabilite.md`).

- Mode « entretien » : `earliestOn` = max(`from`, première date de l'objet ou des pièces de `reveals`, premier jour du senior sur site). Exclus : confidences, réponse de Karim sur la PAR, E4, visite. Toute réponse est partielle sous 30 de relation.
- Chaque partie reste observable dans sa fenêtre dans les cas suivants :
  - relation au plus bas : toute pièce sur demande arrive au plus tard le 13/03/2026 avec × 1,5 (× 2,25 au niveau manager), sinon le facteur est plafonné ;
  - chaque question posée dès sa première date de déblocage, puis reposée : chaque indice d'entretien du §5 reste atteignable ;
  - T1 à T4 acceptés ; E4 refusé ; B1 décliné ; Karim qui ne se confie jamais.
- Aucune partie ne dépend d'un compte rendu seul : au moins deux indices indépendants hors entretien demeurent (§3.4).

**Recoupements.**

- Chaque `stance` à `requiredEvidence` a un `Yield` avec `by` = `character`, les mêmes pièces, `requiresPartner` identique et `requiresInsist` pour A12.i et A12.iii. Chaque pièce d'un `Yield` ou d'un `reveals` est pertinente pour son sujet.
- Chaque indice d'entretien du CDC (A04, A05, A15) existe dans un compte rendu ; chaque compte rendu du scénario porte une seule cible.

**Calibrage.** Le programme de référence scripté de J4 tient en 340 h ou moins, une fois augmenté d'une quinzaine de séances (environ 40 actions, 10 h), des revues, de quatre consignes et d'une reprise.

## 19. Découpage et livraison

Chaque étape se termine par `npm test` vert, `npm run build`, une revue adversariale et un commit. Après J5a, J5b, J5c et J5d ne partagent aucun fichier : ils peuvent être menés en parallèle.

1. **J5a — socle.** J5a écrit les signatures définitives (bouchons quand le corps relève d'un lot) et fait **toutes** les modifications de fichiers partagés.
   - **État et persistance** : `game/state.ts` (sections v3, `seq` partout, `CONTENT_VERSION`), `persistence.ts` (`MIGRATIONS[2]`, `restarted`), `ui/app/store.ts`, `ui/app/orphans.ts` (+ test), `game/consulted.ts` et ses appels.
   - **Contrats** : `PersonId`, `QuestionKey` (+ `parseQuestionKey`, `interviewNoteId`), `TopicKey`, `EthicsEventId`, `ConditionId`, codes de jauge, `GaugeEventProvider`, `MessageProvider`, `HoursProvider`.
   - **Registres, écrits une fois** : `game/gauge-values.ts` (complet sur les événements de J4) ; `game/messages.ts` ; `hoursUsed(s: GameState)` branché sur les `hoursCharged` bouchons de `interviews.ts`, `ethics.ts` et `review.ts` ; arrêts et échéances d'`advance.ts` ; `ui/app/palette-sources.ts`, `ui/screens/control/tabs.ts`, `ui/screens/desk/cards.ts` ; routes et écrans provisoires.
   - **Fichiers partagés de l'interface** : `useHoursUsed` remplace les `Pick` de `Shell.tsx`, `desk/TeamCard.tsx:73` et `work/WorkScreen.tsx:170` ; `useAvailability` ; `CommandPalette.tsx`, `ControlScreen.tsx` et `DeskScreen.tsx` lisent les registres, et `PartnerMessage` part tel quel dans `ui/screens/messages/MessagesCard.tsx` ; `GaugesCard.tsx` ; formulaire des constats ; contexte de complétude (`ui/screens/work/hooks.ts`, `memberWork` bouchon) ; lecture de `reviewRounds` dans `ExecutionPanel.tsx` et `MasterSheets.tsx`.
   - **Règles partagées** : `program.ts`, `findings.ts`, `requests.ts` (le `lowRelation` passé par l'appelant), `documents.ts`, `conditions-met.ts`, `schemas/conditions.ts`, `game/conditions.ts`, `gauges.ts` (§16).
   - **Documents** : `model.ts` ; catalogue (`subjects`, nouvelles pièces : E4, visite, PV de rémunération, fiches de référence) ; `modules/revenue.ts` (preuves d'A10.b et A17) ; `documents/index.ts` (bouchons `interviewDocuments`, `confrontationTable`, `DocumentSet.npc`) ; `documents.json`, `references.json`, `schema.ts`, `sampling.json`.
   - **Paramètres** : `characters.json`, `gauges.json`, `review.json`, `ethics.json`, `ethics-outcomes.json`, `messages.json`, validés par leurs schémas, avec toutes leurs clés.
   - **Switchs et `Record` exhaustifs** : `ged/labels.ts` (`CATEGORY_LABELS`, `AVAILABILITY_SHORT`, `CLUE_SOURCE_LABELS`, `CONDITION_LABELS`), `desk/DesignerCard.tsx`, `observability.test.ts`, `procedures.test.ts`, `documents.test.ts`, `scripts/review-pack.ts`.
   - **Garde-fous** : `tests/guards.test.ts`, `tests/game/matching.test.ts`, garde statique des fournisseurs.
   - **Documentation** : section J de `docs/points-a-verifier.md`.
2. **J5b — entretiens, confrontation, Karim, éthique, jauges, messages.** Propriétaire de `src/scenario/npc/` ; du contenu de `characters.json`, `ethics.json`, `ethics-outcomes.json` et `messages.json` ; de `game/characters.ts`, `game/interviews.ts` (tout l'arc de Karim), `game/ethics.ts`, `game/escalations.ts` et du corps de `game/messages.ts` ; de `ui/screens/interviews/`, `ui/screens/messages/`, `ui/components/Badge.tsx` ; des onglets « Personnages », « Éthique » et « Jauges » et des sources de palette « Personnes » et « Messages ».
3. **J5c — équipe.** Propriétaire de `game/review.ts`, `game/j6/review-outcome.ts`, de la sélection de T2 dans `samples.ts`, du contenu de `review.json`, de `ui/screens/team/` (dont `memberWork.ts`), de la section de revue d'`ExecutionPanel.tsx`, de la carte « Feuilles à revoir » et de l'onglet « Équipe ».
4. **J5d — mémo.** Propriétaire de `src/scenario/memo/`, `ui/screens/memo/`, de la source de palette « Mémo » et de sa section de `docs/points-a-verifier.md` (statut de chaque référence) ; arrêt de validation par l'expert avant le commit.
5. **Intégration** (commit J5) : partie de référence scriptée (340 h), test de temps, annexe d'observabilité ; dossier de revue métier étendu (`npm run review-pack` : réponses, confrontations, notes de l'équipe, textes éthiques, mémo), à partir des exports de chaque lot ; revue adversariale d'ensemble ; `CLAUDE.md`.

## 20. Reporté

- **J6.** Réunions de synthèse (17/03, 19/03) et application des `clientStance` ; acceptation des corrections ; escalade en négociation (« coûte de la confiance si son dossier est faible ») ; dérivation de `a11ConfrontedAlone` et de `reviewOutcome` ; notation de la supervision (8 %) et de l'éthique (7 %), dont le traitement de la source ; communications des NEP 260 et 265 ; note de synthèse écrite du niveau manager ; constats devenus significatifs après le final.
- **J7.** Contenu du tutoriel, choix du niveau, emplacements de sauvegarde, mode concepteur complet ; portraits illustrés, `ironman`, compteur de rechargements ; test de bout en bout reprenant les actions de J5.
- **Après la V1.** Entretiens en langage naturel (§13.1) ; entretiens avec les tiers (notaire, avocate, mandataire), aujourd'hui servis par les confirmations et le courrier ; progression de l'équipe au-delà des consignes ; sous-ensemble d'anomalies selon le niveau (§10.9).

## 21. Revue critique

Trois relectures du projet du 22/10/2026 : commissaire aux comptes, concepteur de jeu, architecte. Leurs affirmations sur le code ont été vérifiées : appelants de `hoursUsed`, `Execution.review` requis, `store.ts:30`, `knownDocuments`, `conditions: Set`, dates de `usePhaseMessage`, tests cités. Les arbitrages sont reportés au §2.2.

**Ce qui change.**

- **Découpage** (J5-1, §19) : quatre étapes ; J5a fait toutes les modifications partagées et pose les registres ; l'arc de Karim revient aux entretiens ; le mémo devient une étape avec son arrêt d'expertise.
- **Entretiens** (J5-2, J5-4, §5.4) : les entretiens corroborent. A19, A06, A01, A04 et A07 ne passent plus par des questions neutres ouvertes d'emblée, mais par `reveals` ou par un objet issu d'un travail réel. Un constructeur par famille et un test de forme. Questions reposables ; `from` sans réponse partielle ; partiel uniforme.
- **Confrontation** (J5-6, §6) : pertinence dérivée des objets pour tout sujet ; position générique ; chaînes de personnes et cumul entre séances. Tables alignées sur les modules : A12.i et A12.iii (`requiresInsist`), A14.ii avec ses deux pièces, A06 ajouté. Fiches de référence à la place des mémos du cabinet.
- **Associée et gouvernance** (J5-20 à J5-22) : plafond de 5 décompté au sujet prêt ; venue maintenue sous 30 pour les constats bien documentés ; séances du président à la planification et au final. Pour A11 : réponse générique de la NEP 240, `governanceInformedOn`, aucune promesse de confidentialité à Karim, option fautive tentante, exposition par toute pièce venue de lui.
- **Jauges** (J5-17 à J5-19, §10) : tri déterministe, arrondis, `gauge-values.ts` ; remontée de la relation ; `publicBlame` et `oneToOne` non exploitables ; remontées à temps définies, drapeau de suspicion, instantané, surprise tardive sur la magnitude.
- **Équipe** (J5-9 à J5-15, §8) : règles de signalement sur les données ; recalcul sur les hypothèses du client ; entrées figées au lancement ; un renvoi par feuille ; notes de revue le 16/03 ; liste unique des tâches ; consignes rares qui réduisent le défaut. Le travail du membre devient visible des critères.
- **Éthique** (J5-16, §9) : options d'action concrète ; +3 lié à la note ; B1 et B2 ; E1 sans réponse neutre ; E3 reformulé et rattaché à PV-08 ; E4 et E5 corrigés ; échéances dans les attendus.
- **Données** (§14) : `reviewRounds`, `restarted`, `seq`, identifiants des comptes rendus, orphelins.
- **Secrets** : fichiers séparés, garde-fou étendu dans `matching.test.ts`.
- **Mémo** (§12) : sous `src/scenario/memo/` ; « référence à vérifier » ; trois canaux ; « risque à considérer » ; NEP 230 et 300 ; conventions en termes généraux ; résolveur des tableaux.
- **Divers** : objectif du DG au PV du CA ; famille `compliance` ; badges ; messages aux dates de J4 (20/11 et 13/03, et non 21/11 et 16/03), `levels`, `planning`, liens typés. Noms corrigés : les réponses génériques sont construites par `scenario/documents/replies.ts` ; le gabarit de l'IRL ne se résolvait pas.

**Constat chiffré.** La population `capitalised-works` compte dix éléments pour 1,46 M€. Le plus gros est le transfert des Peupliers (378 k€, écriture d'OD sans fournisseur) ; aucun élément ne dépasse 500 k€. « Les cinq plus gros éléments » inclurait donc A06, et le seuil du CDC ne retient rien. La règle retenue, les cinq plus grosses factures fournisseurs, est un écart au CDC, laissé **à valider** (J5-13).

**Écarté, avec le motif.**

- **Bloquer les confidences de Karim après une confrontation seule de la DAF** (CAC, option 4). L'effet visible dépendrait de ce que le sujet est celui d'A11 ; J6 évalue cette conduite.
- **Reprise par l'associée et le manager sous 30, au prix d'heures du senior** (CAC). La règle des deux pièces suffit.
- **Faire valider PV-02, 03, 05, 06, 14 et 21 avant la livraison** (CAC). Ce n'est pas une décision de plan : l'affichage « référence à vérifier » couvre l'attente, et la validation reste souhaitée.
- **Imputer les séances sur la capacité journalière du senior dans `schedule()`** (concepteur). Les séances pèsent sur le budget seulement, comme les demandes de J4 ; l'ordonnancement ne couvre que les procédures, et ne pas le modifier évite de déplacer des livraisons annoncées.
- **Avancer E2, ou permettre la reprise de T1 hors site** (concepteur). Léa n'a pas d'heures hors site, et E2 suit la remise du projet d'états.
- **`showGaugeValues` et `maxActions` par niveau** (concepteur). Absents du CDC ; `maxActions` reste un paramètre de `characters.json`.
- **Citer le passage (bloc) dans les notes des membres au niveau assistant** (concepteur). Cela désignerait les blocs porteurs d'indices, ce que la règle de J4 interdit ; l'aide de Léa est redéfinie à partir des données du joueur.
- **Ne viser par `lateSurprise` que les constats créés plus de N jours avant la fin du final** (concepteur). Remplacé par la règle de J5-19, qui lit l'historique et l'instantané.
- **Renvoyer les deux erreurs de revue à J6, sans effet visible** (concepteur). Le CDC (§10.2) fait baisser la confiance de l'associée sur les erreurs de revue : elle le fait à sa revue du dossier, le 16/03.
- **Supprimer J5-9** (concepteur). Remplacé par des règles de signalement sur les données et un recalcul sur les hypothèses du client.
- **Ajouter un indice A06 au justificatif de l'OD** (architecte). Le justificatif générique liste déjà les factures ; l'indice reste sur `factures-peupliers`.
- **Faire envoyer par le membre des demandes de justificatifs dérivées** (architecte). Il signale et liste les pièces à obtenir, et le joueur les demande : c'est plus simple et le modèle des demandes de J4 reste inchangé.
- **Retirer `clock.processedUntil` en v3** (architecte). Gardé sans usage, pour éviter une migration de plus.
- **Dériver le remplacement de E3 dans la vue du programme** (architecte). Inutile : l'acceptation est une action explicite et l'option par défaut ne change rien.
- **Faire aussi redescendre vers 50 une relation plus haute** (lecture littérale de la remontée). Écarté : jouer sans faute ne doit rien coûter.
