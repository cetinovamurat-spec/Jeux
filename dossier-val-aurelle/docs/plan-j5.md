# Dossier Val d'Aurelle — Plan J5 (personnages)

> **Statut** : projet de plan du 22/10/2026, établi après relecture du cahier des charges, du code livré en J4 et des reports du plan J4. Les questions ouvertes sont tranchées par l'option la plus simple compatible avec le cahier des charges (§0.7) ; les décisions structurantes sont marquées **à valider** (§2.2). À la livraison, elles seront reportées dans `CLAUDE.md`, et les références dans `docs/points-a-verifier.md` (§12.3).
>
> Références : cahier des charges §1, §2, §4.1, §4.2, §4.5, §4.6, §5 à §9, §10.1, §10.2, §10.4, §10.5, §10.9, §10.10, §11, §12, §13.1 et annexe ; plan J4 §2, §5, §7.1, §8.5, §13.1, §14, §15, §20 ; `docs/j4-observabilite.md`.

## 1. Périmètre

J5 (§12 : « dialogues, confrontation, équipe et revue de travaux, événements éthiques, messagerie ») couvre :

- les personnages : fiches, états (confiance, humeur, disponibilité), portraits (§4.5) ;
- les entretiens et la confrontation (§10.5) ;
- les confidences du chef comptable et les pièces conditionnelles (§8, §9) ;
- l'équipe : variantes fautives T1 à T4, revue, encadrement (§7) ;
- les événements d'éthique et d'indépendance E1 à E5 (§8) ;
- les effets des jauges, dont les événements enregistrés en J4 (§10.2) ;
- la messagerie (§11) ;
- le mémo réglementaire, reporté de J4 (J4-16, §10.4, annexe).

| Jalon | Ce que J5 prépare |
|---|---|
| J6 | J5 enregistre sans noter : les concessions obtenues en entretien (sujet, personne, pièces, présence de l'associée), les choix éthiques datés, les décisions de revue et leur justesse (`reviewOutcome`), la conduite sur A11 et les remontées à l'associée. J6 les lit pour la négociation (17/03 et 19/03, `clientStance` du §5), la supervision (8 %) et l'éthique (7 %), et applique les effets différés. Le moteur de confrontation (§6) sert aussi aux réunions de synthèse. |
| J7 | Les messages portent une clé `tutorial` et des liens d'action, auxquels le tutoriel se greffe. Les leviers de difficulté sont des paramètres. Le mode concepteur peut déclencher les confidences et les événements éthiques (§10.10). |

Hors périmètre : négociation, opinion, notation, débrief (J6) ; tutoriel, niveaux, sauvegardes (J7) ; entretiens en langage naturel (§13.1).

## 2. Principes et décisions

### 2.1 Six principes

1. **Un entretien est une demande orale.** Une question se pose à une personne sur une famille et un objet, comme une demande de pièce (plan J4 §8). Tout objet reçoit une réponse, générique (construite à partir des données) ou propre au scénario. Jamais « rien ici ».
2. **Rien ne révèle la clé hors mode concepteur.** Les catalogues sont identiques avec ou sans anomalies actives : questions, objets, motifs de renvoi, consignes, messages, options. Aucune réplique ne nomme une anomalie, et un personnage ne concède que devant la pièce posée. Les règles de J5 n'importent ni `game/matching` ni `case.key`.
3. **Une jauge bouge quand son titulaire apprend le fait.** Le client réagit sur-le-champ à ce qu'il vit. L'associée réagit à ce qu'on lui remonte et à ce que le manager lui rapporte. Ce qui ne se découvre qu'à la revue du dossier est évalué en J6. Une variation visible ne dépend donc jamais de la clé.
4. **Le temps reste une donnée** (plan J4 §2.1). L'état stocke les actions datées (séances, choix, revues, consignes) et leur issue, figée à l'action comme l'arbitrage de J4. Messages, événements en attente, jauges, reprises et pièces conditionnelles en sont dérivés à la date du jeu.
5. **Ce qui est dit est un élément probant.** Chaque réponse produit un compte rendu dans la GED. On peut le lire, l'annoter, le marquer comme facteur de risque (plan J4 §6.2) et le lier à un constat. Ses indices ne s'affichent qu'en mode concepteur.
6. **Tout est scripté et déterministe** (§7, §13.1). « Insister fait parfois bouger un personnage » (§10.5) est une règle du catalogue, pas un tirage.

### 2.2 Décisions (défauts retenus, révisables)

| # | Sujet | Décision |
|---|---|---|
| J5-1 | Entretiens | Scriptés (§13.1). Question = personne × famille × objet. Les objets viennent des listes du formulaire des constats (construites sans les anomalies, plan J4 §13.1) et de ce que le joueur a lu, consulté ou ouvert (§5.2). |
| J5-2 | Séances | Sur site seulement (présence du senior, `game.json → onSite`), un jour ouvré. 0,5 h du senior par séance et quatre actions au plus. Une séance par personne et par jour, avec un espacement propre à chacune (§4.3). |
| J5-3 | Comptes rendus | Chaque réponse produit un compte rendu `entretien-<personne>-<famille>-<objet>`, daté de la séance. Trois nouveautés : la catégorie GED « Entretiens » (`interviews`), le mode d'accès `{ kind: 'interview' }` et la source d'indice `interview`. Une version datée `id~date`, comme les réponses de J4, laisse à l'appariement l'identifiant stable. **À valider.** |
| J5-4 | Réponses | Complète ou partielle. Elle est partielle si la relation client est sous son seuil bas, si la personne est hostile, ou si le fait n'est pas encore connu à la date (`from`). Une réponse partielle ne porte jamais d'indice. L'issue est figée à l'action. |
| J5-5 | Confrontation | Les tables de pertinence sont écrites dans `src/scenario/npc/` ; elles ne lisent jamais la clé à l'exécution. Un test les recoupe avec `stance.requiredEvidence` des modules. J5 enregistre les concessions ; l'acceptation des corrections revient à J6. |
| J5-6 | L'associée en séance | Il faut qu'un constat lié au sujet lui ait été remonté et que sa confiance ne soit pas sous son seuil bas. Trois fois au plus dans la mission. |
| J5-7 | Confidences de Karim | Sa confiance part de 20. Il se confie à partir de 60, en tête-à-tête, à partir du final (premier jour sur site après le courriel du 30/01/2026), en réponse à une question générique. **À valider** (seuil, calendrier). |
| J5-8 | Pièces conditionnelles | Elles sont disponibles, et « Reçu le » est daté, à max(date où la condition est remplie, date de la pièce). C'est la correction du défaut latent de `game/documents.ts`. La pièce de E4 (`tenantAssociationContact`) est créée. |
| J5-9 | Travail du membre | Léa ou Hugo fait lui-même l'outil (échantillon ou recalcul) de toute procédure qui lui est confiée. Ce travail est dérivé, non stocké ; le joueur peut le refaire dans la feuille. Les autres sorties gardent le modèle de J4. **À valider** : le modèle des travaux délégués de J4 change, puisque le joueur y opérait l'outil. |
| J5-10 | Variantes T1 à T4 | Seulement si la procédure est confiée au membre scénarisé (`procedures.json → delegated.member`). Une consigne de lancement qui vise le défaut l'évite (§8.4). |
| J5-11 | Revue | Accepter, ou renvoyer avec un motif (liste fermée) et un commentaire obligatoire, jamais lu par le moteur. La reprise coûte au membre 50 % des heures de la procédure, sur site. Elle ne change le résultat que si le motif vise un défaut réel. |
| J5-12 | Revue erronée | Renvoi sans motif fondé : heures de reprise, puis −3 en confiance de l'associée à la livraison de la reprise (le manager le lui rapporte). Travail fautif accepté : enregistré, sans effet visible, évalué au débrief (J6). **À valider** : un effet à la revue du dossier par l'associée (16/03) révélerait le nombre de feuilles fautives. |
| J5-13 | T2 | Hugo retient au plus les cinq plus grosses acquisitions au-dessus du seuil de `sampling.json` (500 k€), sur `capitalised-works` ∪ `construction-progress`. Le nombre affiché est dérivé. **À valider** : sur la seule population de la procédure, la règle ne retient rien. |
| J5-14 | T1 | Seul l'écart de capital restant dû (A18) est mal conclu ; le point sur les intérêts courus (A08) reste rapporté. La conclusion est datée de la réponse. |
| J5-15 | Éthique | Déclencheurs datés ou conditionnels, portés par la messagerie ou une séance. Choix fermés, datés, stockés. Seul ce que voit l'interlocuteur a un effet visible. Le caractère attendu ou fautif du choix n'apparaît qu'en mode concepteur ; il est noté en J6. |
| J5-16 | Jauges | Valeur = départ + effets d'un barème par code (`params/gauges.json`), dans l'ordre chronologique, entre 0 et 100. Les événements sont ceux que stocke J4 et ceux que J5 dérive de ses sections. Retoucher le barème ne demande aucune migration. |
| J5-17 | Relation client basse | Sous 30 : délais des demandes × 1,5, figés à l'envoi comme la difficulté en J4. Les réponses deviennent partielles et l'espacement des séances s'allonge de 2 jours ouvrés. |
| J5-18 | Remontées | L'associée juge sur la forme, jamais sur la clé. Remontée pendant les travaux avec au moins deux pièces : +4. Remontée sans pièce : −2. Constat au moins égal au seuil de planification non remonté à la fin du final : −6. |
| J5-19 | Messagerie | Boîte dérivée ; seules les marques de lecture sont stockées. Les messages de phase de l'associée (`DeskScreen.tsx`) y migrent. Les pièces du scénario ne sont pas annoncées (règle de J4). |
| J5-20 | Données consultées | Section `consulted` : date de première ouverture d'un compte au grand livre et d'une écriture du FEC. Rien au journal. |
| J5-21 | Mémo | `src/content/memo.json`, dans la couche `content` prévue au §2. Références par identifiant de `references.json`, valeurs tirées de `regulatory.json`. Les mémos techniques de la GED restent les pièces probantes. |
| J5-22 | Interlocuteurs | Six personnes du client, dont le président du CA pour une séance. Les tiers passent par les confirmations, la présidente de l'association par E4. L'équipe et l'encadrement passent par la messagerie, la revue et la séance avec l'associée. |
| J5-23 | Sauvegarde | `schemaVersion` 3 ; migration 2 → 3 non destructive ; `CONTENT_VERSION` 2. |
| J5-24 | Observabilité | Restent hors calcul : les pièces conditionnelles et les comptes rendus qui dépendent d'une jauge (les confidences). Les autres comptes rendus y entrent comme mode « entretien ». |

## 3. Ce que vit le joueur, phase par phase

1. **Planification** (03 au 14/11/2025, senior seul).
   - Premier mail de l'associée (accroche du tutoriel), puis mail d'Antoine sur le programme du cabinet.
   - Entretiens de prise de connaissance (§10.1) :
     - le DG : organisation, groupe, objectifs, dont la part variable assise sur le résultat (§4.2) ;
     - la DAF : arrivée en avril 2025, clôture, équipe réduite ;
     - Karim : extraction au 31/10, migration ;
     - Isabelle Moreau : opérations, Glycines, PPE ;
     - Julien Petit : recouvrement.
   - Questions sur la fraude à la direction (NEP 240).
   - En affectant les procédures déléguées, le joueur donne ses consignes.
   - Si le programme validé contient la revue complète de la PGE, E3 se déclenche.
2. **Intérim** (17 au 20/11/2025).
   - Le DG propose deux places en loge (E1, 18/11).
   - Les premières feuilles arrivent à revoir (T2 et T4 possibles).
   - Sofia et Karim répondent sur la migration (F7).
   - Le joueur peut avoir des tête-à-tête avec Karim.
   - Au niveau assistant, Léa signale des zones à creuser.
3. **Hors site** (21/11/2025 au 20/02/2026).
   - Pas d'entretien.
   - Léa conclut T1 sur la réponse de la Banque des Territoires (26/01). La revue se fait à distance ; la reprise attend le final.
   - La DAF demande de préparer les tableaux de l'annexe (E2, 09/02).
4. **Final** (23/02 au 13/03/2026).
   - E3 se déclenche s'il n'a pas eu lieu.
   - La présidente de l'association contacte le senior (E4, 24/02).
   - Confrontations, éventuellement avec l'associée.
   - Si sa confiance le permet, Karim se confie, et le joueur choisit comment protéger la source.
   - Sur A11, il faut remonter avant de confronter.
   - Le DG évoque le mandat (E5) à la première séance du final, sinon par message le 06/03.
   - Revue de T3, reprises, remontées.
5. **Après le final** (à partir du 16/03/2026, senior seul).
   - Entretiens sur les événements postérieurs (courrier du mandataire du 15/03).
   - Les surprises tardives sont constatées.
   - La synthèse relève de J6.

## 4. Personnages et états

### 4.1 Distribution

| Id | Personne | En J5 | Espacement | Sujets |
|---|---|---|---|---|
| `ceo` | Bertrand Vasseur, DG | entretiens | 3 jours ouvrés | contexte, objectifs, groupe ; E1, E5 ; positions sur A04, A05, A12, A17 |
| `cfo` | Nathalie Ferrand, DAF | entretiens | 1 | méthodes, estimations ; E2 ; A01, A03, A07, A09 à A16, A20, A22 ; F1, F2, F3, F5 |
| `chiefAccountant` | Karim Haddad | entretiens, jauge propre | 0 (une par jour) | comptes, écritures, migration, confidences ; A08, A18, A19, A21 ; F6, F7 |
| `assetDirector` | Isabelle Moreau | entretiens | 2 | programmes, PPE, réceptions, fournisseurs ; A01, A02, A04, A05, A06 ; F4 |
| `rentManager` | Julien Petit | entretiens | 1 | recouvrement, loyers, régularisation ; A07, A10, A15, A17 |
| `chairman` | Gérard Lambert, président du CA | une séance (intérim ou final) | — | gouvernance, fraude, A12 (administrateur commun, §4.1) |
| `tenantAssociation` | Rachida Benamar | E4 | — | A10, A17 |
| `partner`, `manager` | Claire Delmas, Antoine Roussel | messagerie ; associée en séance (J5-6) | — | encadrement, E3, remontées |
| `lea`, `hugo`, `sofia` | équipe | revue, messagerie | — | T1 à T4, consignes, migration |

- **Noms et fonctions** : `documents.json → people` et `game.json → team, firm`.
- **Type** : `PersonId` = `Interlocutor` (`model.ts:39`) ∪ `'chairman'`.
- **Délais des demandes** : ceux de `responseDelaysBusinessDays`, inchangés.

### 4.2 Fiche (§4.5)

Les fiches sont du contenu TypeScript (`src/scenario/npc/sheets.ts`), comme le catalogue des documents, pour que les répliques citent des montants du moteur. Les réglages sont dans `params/characters.json`.

```ts
interface CharacterSheet {
  id: PersonId;
  personality: string;                                         // §4.5
  knowledge: QuestionFamilyId[];                               // familles servies ; les autres sont redirigées
  secrets: { id: string; text: string; revealedBy: string }[]; // mode concepteur seulement
  sensitivity: { insist: number; offTopic: number; accusation: number }; // « effets sur la relation client »
  lines: { greeting: Record<Mood, string>; unavailable: string; offTopic: string; redirect: string; partial: string; closing: string };
  portrait: PortraitSpec;
}
```

- **Sensibilité.** Le DG supporte mal l'insistance (×1,5). Isabelle Moreau, « technique, franche », supporte mal la mise en cause (×1,5).
- **Secrets.** Les deux courriels de la DAF ; le malaise de Karim sur la reprise de PGE et la PAR ; l'objectif de 9 M€ et le mandat pour le DG.

### 4.3 États

- **Confiance.** Seul Karim a une jauge propre (§10.2). Les autres personnes partagent la relation client.
- **Humeur** (dérivée, `game/characters.ts → moodOf`), visible sur le portrait.

  | Humeur | Règle |
  |---|---|
  | Cordiale | relation ≥ 50 |
  | Réservée | 30 ≤ relation < 50, ou insistance ou pièce hors sujet dans les 5 derniers jours ouvrés |
  | Tendue | relation < 30, ou mise en cause dans les 5 derniers jours ouvrés |
  | Hostile | mise en cause sans preuve dans les 10 derniers jours ouvrés ; pour la DAF, jusqu'à la fin de la mission si la source de Karim est exposée |

  Une personne hostile ne répond que partiellement. Pour Karim, l'humeur suit sa jauge : épuisé sous 40, confiant à partir de 60.

- **Disponibilité** (`availabilityOf`). Une personne est disponible si le senior est sur site, un jour ouvré, et si l'espacement depuis sa dernière séance est respecté. L'espacement est multiplié par `responseDelayFactor` et allongé de 2 jours ouvrés si la relation est sous 30. L'écran affiche la prochaine date possible.

### 4.4 Portraits

Les portraits sont des SVG stylisés générés par `ui/components/Portrait.tsx` à partir de `characters.json → portrait` (palette, formes, accessoire), sans photo. L'expression varie avec l'humeur, et le texte alternatif donne le nom, la fonction et l'humeur. La couche de jeu reste discrète (§11).

## 5. Entretiens

### 5.1 Séance

1. **Ouverture.** Le joueur ouvre une séance avec une personne disponible. L'audience est « seul » par défaut, « en présence de la DAF » pour Karim, ou « avec l'associée » (J5-6). La séance coûte 0,5 h du senior, imputée par `budget.ts`.
2. **Actions.** Quatre au plus, parmi : question, pièce présentée, insistance, mise en cause (§6). L'historique de la séance et des précédentes s'affiche avec le portrait (§10.5).
3. **Questions déjà posées.** Une question à réponse complète n'est plus proposée. Une question à réponse partielle peut être reposée dans une séance ultérieure ; son issue est alors réévaluée.

### 5.2 Familles de questions (`src/scenario/npc/questions.ts`)

| Famille | Personne(s) | Objet | Proposée quand | Réponse générique |
|---|---|---|---|---|
| `entity-overview` | DG | — | dès le début | organisation, groupe, objectifs du conseil, dont l'objectif de résultat de la part variable (`ceoBonusResultTargetEuros`) |
| `closing-organisation` | DAF | — | dès le début | planning de clôture, équipe, arrivée de la DAF, migration (§4.2) |
| `fraud-inquiry` | DG, DAF, chef comptable, président | — | dès le début | réponse standard ; pour Karim, chemin des confidences (§7.2) |
| `migration` | chef comptable | — | dès le début | bascule, reprise des soldes, interfaces |
| `account` | chef comptable | compte | compte ouvert au grand livre (`consulted`) ou objet d'un constat | nature, mouvements, rapprochement (millésime disponible) |
| `entry` | chef comptable | écriture | écriture ouverte dans le FEC (`consulted`) | utilisateur, dates de saisie et de validation, pièce |
| `programme` | directrice du patrimoine | programme | dès le début | état, opérations, travaux (jeux de données) |
| `replacements` | directrice du patrimoine | programme | question ou constat ouvert sur un programme | « aucun autre remplacement significatif » |
| `maintenance-plan` | directrice du patrimoine | — | PPE officiel ou tableau des provisions lu | plan pluriannuel, budget voté |
| `supplier` | directrice du patrimoine | fournisseur | dès le début | procédure d'attribution (dossiers de marché) |
| `estimate` | DAF (ICNE : chef comptable) | PGE, dépréciation, ICNE, régularisation, retraite, produits à recevoir | pièce de calcul correspondante lue | méthode de la direction |
| `recovery` | gestion locative | — ou débiteur | balance âgée lue | statistiques, prestataire, procédures |
| `rent-revision` | gestion locative | — | PV du CA d'octobre 2024 ou quittancement lu | application de la révision au 01/01/2025 |
| `related-parties` | DG, DAF, président | — | convention de soutien ou registre des conventions lu | conventions de groupe |
| `litigation` | DAF | — | registre des contentieux lu | contentieux du registre |
| `subsequent-events` | DAF, DG | — | à partir du 01/01/2026 | « rien de particulier » |
| `document` | émetteur interne | pièce lue | pièce lue (`readOn`) | contexte d'établissement |
| `finding` | toute personne | question ou constat ouvert | constat ouvert | renvoi vers la famille de son objet |
| `wellbeing` | chef comptable | — | dès le début | charge de travail, migration |

- **Déblocage.** Les questions se débloquent selon les documents lus, les données consultées et les constats ouverts (§10.5), par l'évaluateur de conditions étendu (§16).
- **Questions verrouillées.** Elles ne s'affichent pas : leur seule existence renseignerait.
- **Hors domaine.** Une famille hors du domaine de la personne reçoit une redirection (« voyez avec … »), sans coût.

### 5.3 Résolution d'une réponse

`answerOf(person, family, object, date, ctx)` est pure. Elle cherche dans l'ordre :

1. la réponse du scénario, si sa date `from` est atteinte ;
2. la réponse générique, produite par le même constructeur pour tout objet ;
3. la redirection.

La version partielle reprend la première phrase : la position de la personne, sans fait apporté.

**Faits datés.** Le PPE officiel n'est évoqué qu'à partir du 15/11/2025. La réponse évasive sur les événements postérieurs commence au jugement du 24/02/2026. Une écriture n'existe qu'avec le millésime qui la contient.

**Comptes rendus.**

- La version du scénario vient de `scenario/npc/interview-docs.ts`, appelé par `buildDocuments`, avec ses indices.
- La version générique est construite à la volée, comme les réponses génériques de J4 (`ui/screens/ged/replies.ts`).
- Le rendu est le même dans les deux cas.

### 5.4 Réponses du scénario

Les indices « d'entretien » du §5 deviennent des comptes rendus de source `interview`. Les positions reprennent celles des `stance` (`anomalies/modules/*.ts`). Aucune réponse n'apporte de fait hors clé.

| Partie | Personne (famille) | Réponse complète | Indice |
|---|---|---|---|
| A01 | Moreau (programme Tilleuls) | Réception le 30/06/2025, locataires en juillet, inauguration en septembre | oui |
| A02 | Moreau (`replacements`) | La PAC a remplacé la chaufferie de 2008, déposée ; « aucun autre cas significatif » ailleurs. La démarche est enregistrée pour J6 (« réflexe NEP 450 ») | oui |
| A04 | Moreau (Glycines) | Relogements engagés depuis septembre ; démolition prévue au 4e trimestre 2027 | oui (§5) |
| A05 | Moreau (`maintenance-plan`) | « Ces travaux n'ont jamais été décalés » | oui (§5) |
| A05 | DAF (`estimate` PGE) | « J'ai retenu mon fichier de calcul à jour de mes arbitrages » | position |
| A06 | Moreau (Peupliers) | Programme d'entretien 2025 : peinture, robinetterie, toiture | oui |
| A07.a | Petit (`recovery`) ; DAF | Petit : recouvrement des ex-locataires d'environ 4 % par an, premier rapport du prestataire décevant (valeurs des jeux de données). DAF : « nouveau prestataire, taux ramené à 85 % » | oui (Petit) |
| A07.b | Petit (`recovery`) | Dossiers de rétablissement personnel : locataires restés dans les lieux, maintenus à 50 % | oui |
| A08 | Karim (`estimate` ICNE) | « Taux unique de 3 % par simplification » | oui |
| A10 | DAF, Petit | Syndic : « erreur de paramétrage » ; gardiens : « affectés à 100 % » | positions |
| A11 | Karim (`entry` de la PAR, `account` 4687) | « Mme Ferrand l'a saisie elle-même ; la pièce devait suivre. » Réponse partielle tant que sa confiance est sous 60 | oui |
| A12 | DG ; DAF | DG : « opération de groupe ». DAF, sur la déclaration préalable : « je vais vérifier ». Après insistance : « nous n'en avons pas retrouvé trace » | oui (A12.iii) |
| A15 | DAF (`subsequent-events`) | À partir du 24/02/2026 : « rien qui modifie les comptes ; ils ont toujours fini par payer » | oui (§5 : « réponse évasive ») |
| A16 | DAF (`litigation`) | Énumère le registre, sans l'assignation | non : le registre est l'indice |
| A17 | Petit ; DG | Petit : « nous avons appliqué la délibération » (note du 05/11/2024). DG : « régulariser sur 2026 sans écriture » | oui (Petit) |
| A18 | Karim (`account` 471, `entry` du 15/12) | Versement de la Banque des Territoires, contrat non reçu, mis en attente. L'écriture ronde est légitime ; seule son imputation est erronée (§5) | oui |
| A19 | Karim (`migration`) | Lot d'octobre rejoué à la bascule, sans rapprochement depuis | oui |
| A20, A21 | DAF ; Karim | Facture du GIE arrivée en janvier ; « faute de frappe » | positions |

### 5.5 Contexte et fausses pistes

- **Contexte du §4.2.** Il est distillé dans les réponses génériques : arrivée de la DAF, migration, soutien demandé par le groupe, ANCOLS 2022, vote de +3,50 %, NPNRU. L'objectif de résultat n'apparaît qu'à deux endroits : dans `entity-overview` du DG et dans le courriel conditionnel.
- **F1, F2, F3, F5.** La DAF explique et renvoie aux pièces qui écartent la piste (`false-leads.ts → evidence`).
- **F6, F7.** Karim répond (chèques dénoués en janvier ; reprise des soldes rapprochée et signée). Sofia confirme F7 dans sa feuille.
- **F4.** La question neutre `supplier` sur Bâti-Rénov Est donne la réponse complète : quatre offres, moins-disant, homonymie, attestation. La mise en cause est traitée au §6.3.

## 6. Confrontation (§10.5)

### 6.1 Pièces présentables

Le joueur présente une `Evidence` de `findings.ts`, avec le sélecteur du formulaire des constats :

- un document (`baseDocumentId`, réponses scindées comprises) ;
- une écriture du FEC (par son numéro) ;
- un recalcul dont l'écart est non nul et les hypothèses sourcées ;
- un échantillon avec exception.

Les pièces posées sur un sujet s'accumulent dans la séance.

### 6.2 Réactions

```ts
interface Confrontation {                    // scenario/npc/confrontations.ts
  topic: QuestionKey;
  related: PieceRef[];                       // pièces du sujet ; toute autre est hors sujet
  yields?: { all: PieceRef[]; requiresPartner?: boolean; line: string };   // §5 : « cède sur… »
  reveals?: { on: PieceRef[]; line: string }[];                            // fait nouveau, avec compte rendu
  nuance: string;
  insist: 'moves' | 'holds'; insistLine: string;
}
```

| Issue | Condition | Effet |
|---|---|---|
| Concède | toutes les pièces de `yields.all` posées, et l'associée présente si elle est requise | réplique, compte rendu, concession enregistrée pour J6 |
| Révèle | pièce de `reveals.on` | fait nouveau et compte rendu avec indice (A09 : « ce courrier ne m'est jamais parvenu ») |
| Nuance | pièce de `related` mais ensemble incomplet, ou associée requise et absente | maintien de la position (« nous en reparlerons avec votre associée ») ; sans coût |
| Hors sujet | pièce absente de `related` | « perte de crédibilité » : `offTopicEvidence`, humeur réservée |
| Déjà acquis | sujet déjà concédé | rappel |

Les sujets sans anomalie ont aussi leurs pièces `related`, qui reçoivent « c'est conforme ». Une pièce pertinente ne désigne donc pas une anomalie, et passer toutes les pièces en revue coûte de la relation.

### 6.3 Insister, mettre en cause

- **Insister.** Une fois par sujet et par séance, au coût `insist` × sensibilité ; pour Karim, la perte porte sur sa jauge. Le personnage bouge si le sujet porte `moves` et qu'il n'est pas hostile :
  - A12.iii : « pas de trace » ;
  - A14.ii : la DAF admet que la définition n'est pas précisée ;
  - A12.i, en présence de l'associée : le DG accepte l'information en annexe, §5.
- **Mettre en cause.** L'action est proposée sur tout sujet, pour ne rien désigner, et coûte toujours `accusation` (ton agressif). Elle est « sans preuve » si `yields.all` n'a pas été posé dans la séance : `unfoundedAccusation` s'ajoute, doublé quand la fausse piste du sujet porte `relationshipCost: 'high'` (F4 : « dégrade fortement »). La personne devient hostile.

### 6.4 Positions par anomalie (CDC §5)

| Partie | Personne | Position | `yields.all` | Associée |
|---|---|---|---|---|
| A03 | DAF | article 1583 du Code civil (PV-14) | `promesses-clos-fleuri`, `levee-condition-clos-fleuri` | — |
| A04 | DG | « tant que les financements ANRU ne sont pas notifiés… » | `pv-ca-2025-06`, `avenant-anru-glycines`, `deliberation-relogement` | — |
| A05 | DG | « politique patrimoniale, le plan sera révisé en 2026 » | `ppe-officiel`, `budget-2026`, `pv-ca-2025-12` | requise |
| A07.a | DAF | « nouveau prestataire » | `stats-recouvrement`, `rapport-prestataire-recouvrement`, `annexe-2025` | — |
| A10.b | DAF | gardiens « affectés à 100 % » | `fiches-poste-gardiens`, `memo-charges-recuperables` | — |
| A11 | DAF | « erreur d'interprétation » | conventions des gestionnaires, réponses des gestionnaires, `journal-ecritures-inventaire` | requise |
| A12.i | DG | « opération de groupe » | insistance de l'associée | requise |
| A14.ii | DAF | « notre définition exclut la vacance technique » | rapport de gestion 2024, rapport de vacance | — |
| A15 | DAF | « ils ont toujours fini par payer » | `courrier-mandataire` | — |
| A17 | DG | « régulariser sur 2026 sans écriture » | `pv-ca-2024-10`, `memo-irl`, `quittances-echantillon` | — |

- Les autres parties sont acceptées dès que leur pièce est posée.
- Les identifiants viennent de `requiredEvidence` ; un test vérifie leur existence (§18).
- La concession est un fait d'entretien. Le constat, la correction et l'opinion restent au joueur et à J6.

### 6.5 Indice de fraude (A11)

La conduite attendue (§5) combine des actions de J4 (révision du risque de fraude, requêtes du FEC, remontée) et de J5 :

- **Confronter seul.** Poser une pièce ou mettre en cause la DAF sur la PAR, seul et avant toute remontée, est enregistré `a11ConfrontedAlone`. La DAF répond « erreur d'interprétation, je vous transmets une note de calcul ». La note garde sa date (27/02/2026, sur demande).
- **Exposer la source.** Présenter ses courriels à la DAF expose Karim (§7.3).
- **Confronter avec l'associée.** Après remontée, et avec `yields.all` posé, la DAF concède.
- **Révélation au procureur.** Elle est instruite par l'associée : le jeu n'en tire aucune conclusion juridique (PV-02).

## 7. Confidences de Karim et pièces conditionnelles

### 7.1 Jauge de Karim (§10.2 : « tête-à-tête, respect, absence de mise en cause publique »)

| Fait | Effet |
|---|---|
| Séance en tête-à-tête (une par jour) | +8 (`oneToOne`) |
| Insistance auprès de Karim | −5 |
| Séance « en présence de la DAF » où le joueur pose une pièce, insiste ou met en cause sur son travail (A18, A19, A21, F6, F7) | −15 (`publicBlame`) |
| Confidences accueillies, source protégée | +10 (`sourceProtected`) |
| Source exposée | −40 (`sourceExposed`) |

En partant de 20, cinq tête-à-tête atteignent 60, pour 2,5 h du senior.

### 7.2 Confidences

- **Question.** La question générique `fraud-inquiry` posée à Karim : « Y a-t-il des écritures de clôture qui vous ont mis mal à l'aise ? ».
- **Réponse partielle,** constante, tant que les conditions de J5-7 ne sont pas réunies : « La clôture a été très dure avec la migration… ».
- **Réponse complète.** Karim décrit la pression sur l'objectif. Un compte rendu porte les indices A05 et A11 ; il est exclu de l'observabilité (J5-24). La condition `chiefAccountantConfides` est remplie à la date de la séance.

### 7.3 Protection de la source (§8, bonus)

Le choix est stocké dans `ethics.karim`.

| Option | Effets visibles | Pour J6 |
|---|---|---|
| Rassurer Karim, documenter, porter le sujet à l'associée en limitant l'exposition de son nom | Karim +10 ; associée +3 le jour ouvré suivant | attendu |
| En parler directement à la DAF | Karim −40 ; DAF hostile ; relation −5 | fautif (et conduite A11) |
| Garder l'information pour soi | aucun | fautif |

### 7.4 Pièces conditionnelles

- **Contexte de disponibilité.** `AvailabilityContext.conditions` devient `ReadonlyMap<ConditionId, IsoDate>`, construite à partir de `ethics`. `useAvailability` (`ui/app/hooks.ts`) ajoute `ethics` et `interviews` à son `Pick` et à son `useMemo`. `isAvailable` et `receivedOn` (`game/documents.ts:86, 112`) appliquent max(`metOn`, `doc.date`).
- **Mails de la DAF.** `mail-daf-2026-01-28` (A05) et `mail-daf-2026-01-30` (A11) dépendent de `chiefAccountantConfides`.
- **Nouvelle pièce `courriel-association-locataires-2026`** (`catalog/correspondence.ts`, 24/02/2026, `people.tenantAssociation`). Elle dépend de `tenantAssociationContact`, remplie par l'option « écouter » de E4. Elle ne contient que des faits de la clé :
  - au conseil de concertation, la direction a annoncé une régularisation 2025 calculée « selon les mêmes principes que le projet 2024 » contesté (syndic, totalité des gardiens : A10, cohérent avec PV-29) ;
  - les locataires ont constaté une hausse de 3,50 % au 01/01/2025 (A17 ; taux tiré de `regulatory.json`).

  La date du conseil vient de `documents.json → E4.concertationDate`. **À valider** (PV-110).
- **Libellés.** `CONDITION_LABELS` (`ged/labels.ts`) reste exhaustif ; `AVAILABILITY_SHORT` gagne « Entretien ».
- **Observabilité.** Les trois pièces restent hors calcul : elles renforcent les preuves sans être nécessaires (`j4-observabilite.md`).

## 8. Équipe : travaux délégués, revue, encadrement (§7)

### 8.1 Travail du membre (J5-9)

`memberWork(e, def, ctx)` (`game/review.ts`) est pur. Il est dérivé à la livraison.

- **Échantillon.**
  - Tirage : méthode par unités monétaires, taille `plannedSize`, graine = identifiant de l'exécution ; ou sélection de la variante.
  - Éléments signalés : ceux dont la pièce justificative (`PopulationItem.request`) porte un indice d'une partie de `effectiveFor`. C'est la règle de portée de `delegatedWorksheet`, étendue aux éléments.
  - Le membre signale sans chiffrer : le joueur demande la pièce et apprécie.
- **Recalcul.**
  - `runRecalc` sur chaque périmètre accessible (`toolAccess`).
  - Le membre correct modifie une hypothèse seulement si sa pièce source est disponible (`review.json → recalcSources`, mêmes valeurs que les tests de J4 §11). La variante garde les hypothèses du client.
- **Feuille.** `delegatedWorksheet` (`program.ts`) intègre ce travail (`work`), une note du membre et la conclusion proposée. Ce travail remplit les critères `sample` et `recalc`. Ce que le joueur refait dans la feuille reste à lui.

### 8.2 Variantes T1 à T4

`variantOf(e, def)` (J5-10). Les notes sont des gabarits de `review.json`, et les montants sont tirés du moteur et des pièces.

| Var. | Procédure, membre | Travail fautif et note | Défaut | Reprise si le motif est juste |
|---|---|---|---|---|
| T1 | `lender-confirmations`, Léa | « Capital restant dû confirmé {confirmed} contre {booked} en comptabilité, écart de {gap} : décalage de calendrier, RAS. » Conclusion « satisfaisant » | `unexplainedDifference` | Écart rapproché du versement du {date}, absent de l'état de la dette, porté au compte {account} ; conclusion « anomalies » |
| T2 | `additions-test`, Hugo | Sélection J5-13 : « Les {n} acquisitions supérieures à {threshold} examinées : aucune exception ; conclusion étendue aux travaux immobilisés. » | `nonRepresentativeSample` | Tous les travaux immobilisés examinés (10 éléments, plafond 60) ; l'OD des Peupliers est signalée, et A06 devient détectable (§7) |
| T3 | `impairment-recalc`, Léa | Hypothèses du client : « Fichier de dépréciation recalculé : concordant. » | `clientDataNotChallenged` | Taux confrontés à la méthode de l'annexe et à l'historique de recouvrement (A07.a, A07.b) ; à défaut, liste des pièces à obtenir |
| T4 | `rent-increase`, Hugo | « Quittances concordantes avec les états de quittancement : aucune exception. » | `objectiveNotCovered` | Hausse appliquée comparée à la hausse autorisée (`rentExcess`) : éléments en dépassement (A17) |

Accepter une feuille fautive ne retire aucune pièce : A06, A07, A17 et A18 restent détectables par le travail du joueur (test, §18).

### 8.3 Revue

**Conditions.** `reviewExecution` (`program.ts:497`) exige une feuille livrée et sans attente (`pending === null`), et un membre autre que le senior. Un renvoi exige un motif et un commentaire. Une décision ne s'écrase plus : un nouveau tour suit la livraison de la reprise. Chaque décision coûte 0,25 h au senior.

**Motifs** (`review.json → returnMotives`) :

- écart non expliqué ou explication non corroborée ;
- sélection non représentative ou conclusion étendue au-delà des éléments testés ;
- données ou hypothèses de l'entité non corroborées ;
- travail qui ne répond pas à l'objectif ou à l'assertion ;
- documentation incomplète : fondé si `formCheck` signale un manque, auquel cas la reprise complète les références ;
- autre motif : jamais fondé.

**Reprise.** Elle est imputée au membre à la date du renvoi, ordonnancée sur ses jours de présence (`schedule()`) et livrée comme une feuille. Si le membre ne peut pas la terminer avant la fin du final, le renvoi est refusé : « Léa n'est plus sur le dossier : reprenez vous-même la feuille ».

| Travail | Décision | Effet visible | Pour J6 (`reviewOutcome`) |
|---|---|---|---|
| fautif | renvoi, motif juste | heures ; feuille corrigée | revue juste |
| fautif | renvoi, autre motif | heures ; « rien à modifier » ; associée −3 à la livraison | revue erronée |
| fautif | acceptation | aucun (J5-12) | travail fautif accepté |
| correct | acceptation | aucun | revue juste |
| correct | renvoi | heures ; « rien à modifier » ; associée −3 à la livraison (§7 : « budget et confiance ») | renvoi sans motif |

### 8.4 Encadrement

- **Consignes.** Au lancement d'une délégation, le joueur peut donner une consigne prise dans `review.json → briefings`, une seule, pour 0,5 h du senior :
  - rapprocher chaque réponse de la comptabilité ;
  - échantillon représentatif, sans extrapoler ;
  - corroborer les hypothèses de l'entité ;
  - tester la règle visée, pas seulement la concordance.

  Une consigne qui vise le défaut l'évite ; sinon, elle n'a pas d'effet visible. L'offre est identique pour toute délégation. La consigne est stockée sur l'exécution (`briefing`).
- **Aide de Léa** (§10.9, niveau assistant, `teamHints`). Au début de l'intérim et du final, Léa envoie un message « zones à creuser ». Il désigne des cycles selon la règle du conseil d'Antoine (`aid.ts`), en termes de méthode. Aux autres niveaux, seul le conseil d'Antoine existe (J4).
- **Messages de l'équipe.** Livraisons, reprises, heures disponibles de Sofia.

La supervision (8 %, §10.8) est notée en J6 à partir de `reviewOutcome`, des consignes et des renvois.

## 9. Éthique et indépendance (§8)

`params/ethics.json` décrit chaque événement : déclencheur, expéditeur, message, options avec leurs effets (codes du §10.2) et leur `outcome` (`expected`, `acceptable`, `fault`, lu par le mode concepteur et par J6), échéance et option par défaut.

| Év. | Déclencheur | Options | Effets visibles en J5 | Pour J6 |
|---|---|---|---|---|
| E1 — loge pour un match de rugby (DG) | mail du 18/11/2025 ; match le samedi 29/11 ; échéance le 28/11 | accepter / décliner / décliner et en informer l'associée | accepter : relation +3 ; informer : associée +3 ; sans réponse : relation −2 | accepter = pénalité lourde |
| E2 — « préparer les tableaux de l'annexe » (DAF) | mail du 09/02/2026 ; échéance le 20/02 | accepter / refuser et proposer de commenter le projet établi par l'entité / refuser sèchement | accepter : 6 h du senior et relation +3, le projet d'annexe restant celui de l'entité (PV-111) ; refus sec : relation −2 | accepter = autorévision |
| E3 — PGE en « revue légère » (Antoine) | premier jour ouvré après la validation du programme (`planning.validated.program`) s'il contient `pge-review`, sinon au lancement de `pge-review` | accepter / refuser et porter le sujet à l'associée / refuser sans en parler | accepter : `pge-review` remplacée par `pge-light` si elle n'est pas lancée ; porter : associée +3 et dépassement du cycle des provisions justifié (`overrunJustified`) | porter = attendu (environ +9,5 h de senior) |
| E4 — contact direct de la présidente de l'association | mail du 24/02/2026 | écouter sans rien divulguer / écouter et partager ses constats / refuser l'échange | écouter ou partager : la pièce du §7.4 arrive ; refuser : rien | partager = atteinte au secret professionnel (PV-99) ; refuser = information perdue |
| E5 — mandat et rapport « sans histoires » (DG) | première séance avec le DG au final, sinon message du 06/03/2026 | documenter et remonter à l'associée / ne rien faire / rassurer le DG | remonter : associée +3 ; rassurer : relation +3 | intimidation (PV-100) |
| Bonus — Karim se confie | §7.2 | §7.3 | §7.3 | protection de la source |

Un événement non traité prend son option par défaut à l'échéance. Les déclarations d'indépendance restent dans la procédure `engagement-acceptance` (J4).

## 10. Jauges (§10.2)

### 10.1 Calcul

`gaugeValues(s, params, date)` (`game/gauges.ts`) part des valeurs initiales de `game.json → gauges`. Elle applique, dans l'ordre chronologique, les effets de tous les événements datés au plus tard à `date`, entre 0 et 100.

- **Sources.** Les événements stockés de J4 (`state.gauges.events`, inchangés) et les événements dérivés des sections de J5 : `interviewGaugeEvents`, `ethicsGaugeEvents`, `reviewGaugeEvents`, `escalationGaugeEvents`.
- **Niveau assistant.** Le facteur `clientRelationLossFactor` adoucit les pertes de relation (« relation client indulgente »).
- **Interface.** Les lectures de `initial` (`GaugesCard.tsx → gaugeValue`, `Shell.tsx:106`) sont remplacées.
- **Écart au plan J4 §5.** `advanceTo` n'applique rien : tout est dérivé, et le recul d'horloge reste cohérent.

### 10.2 Barème (`params/gauges.json → effects`)

| Code | Jauge | Effet | Émetteur, date |
|---|---|---|---|
| `duplicateRequest` | relation | −2 | `requests.ts` (J4), envoi |
| `unrelatedRequest` | relation | −1 au-delà de trois par phase (« demandes inutiles répétées ») | `requests.ts` (J4), envoi |
| `interimWithoutPlanning` | associée | −10 | `planning.ts` (J4) |
| `unjustifiedOverrun` | associée | −8 | `program.ts` (J4), lancement |
| `aidUsed` | associée | −3 | `aid.ts` (J4) |
| `insist` | relation (Karim : sa jauge, −5) | −3 × sensibilité | `interviews.ts`, séance |
| `offTopicEvidence` | relation | −2 × sensibilité | `interviews.ts` |
| `accusation` | relation | −5 × sensibilité (ton agressif) | `interviews.ts` |
| `unfoundedAccusation` | relation | −10 ; −20 pour une fausse piste « high » (F4) | `interviews.ts` |
| `weakPartnerMeeting` | associée | −3 (séance avec l'associée sans pièce pertinente) | `interviews.ts` |
| `oneToOne`, `publicBlame`, `sourceProtected`, `sourceExposed` | Karim (`sourceExposed` : relation −5 en plus) | §7.1 | `interviews.ts`, `ethics.ts` |
| `courtesyAccepted` | relation | +3 (E1, E2, E5 acceptés) | `ethics.ts`, choix |
| `bluntRefusal` | relation | −2 (refus sec de E2, E1 sans réponse) | `ethics.ts` |
| `ethicsReported` | associée | +3 (E1, E3, E5, Karim) | `ethics.ts`, jour ouvré suivant |
| `timelyEscalation` | associée | +4, trois au plus | `gauges.ts`, remontée |
| `weakEscalation` | associée | −2 | `gauges.ts`, remontée |
| `lateSurprise` | associée | −6 par constat | `gauges.ts`, premier jour ouvré après le final ou remontée tardive |
| `unjustifiedReturn` | associée | −3 | `review.ts`, livraison de la reprise |

**Surprise tardive.** Elle vise un constat au statut « constat » dont l'impact sur le résultat (`impactOfLines` de l'écriture proposée) atteint le seuil de planification, ou qui porte un traitement d'irrégularité ou de communication à la gouvernance, et qui n'a pas été remonté avant la fin du final. La règle ne lit que ce que le joueur a saisi.

### 10.3 Seuils

| Jauge | Seuil | Effet |
|---|---|---|
| Relation client | < 30 | Délais des demandes × 1,5, figé à l'envoi (`RequestItem.lowRelation`, lu par `delayDays`, cumulé avec `responseDelayFactor`). Réponses partielles. Espacement des séances +2 jours ouvrés (« les délais s'allongent et les réponses s'appauvrissent ») |
| Confiance de l'associée | < 30 | L'associée ne vient plus en séance ; message d'alerte |
| Confiance de Karim | ≥ 60 (`characters.json → karim.confideAt`) | Confidences possibles |

### 10.4 Retour visible sans révéler la clé

- **Carte « Jauges » du bureau.** Valeur, seuil bas, et les cinq dernières variations avec leur libellé générique (« Demande en double », « Mise en cause sans preuve », « Remontée documentée pendant les travaux »). Aucun code ne dépend de la clé : les feuilles fautives acceptées ne sont pas au barème.
- **Messages au franchissement.** Sous 30 en relation, la DAF écrit « mes équipes croulent sous les demandes ». Sous 30 en confiance, l'associée demande un point.
- **Karim.** Sa jauge est visible, son seuil de confidences ne l'est pas.

## 11. Messagerie (§11)

### 11.1 Modèle

`inbox(s, ctx)` (`game/messages.ts`) réunit deux sources :

- les messages du catalogue dont la condition est remplie à la date ;
- les messages dérivés fournis par les sections (`MessageProvider`) : livraisons et reprises, réactions de l'associée aux remontées (accusé de réception générique, sans jugement de fond), alertes de budget d'Antoine à 80 % et 100 %, rappels de J4 (`partnerReaction`, confirmations), événements éthiques, alertes du §10.4, aide de Léa.

Seule la section `messages.read` est stockée ; reculer l'horloge masque les messages postérieurs. Un message a la forme `{ id, on, from, subject, body[], links, ethics?, tutorial? }`. Son corps est un gabarit (`{date:…}`, `{person:…}`, `{firm}`) : aucun montant n'est saisi.

### 11.2 Catalogue (`params/messages.json`)

| Id | Date ou déclencheur | De | Objet |
|---|---|---|---|
| `partner-planning` | 03/11/2025 | associée | Prise en charge du dossier (message de phase migré ; `tutorial: 'welcome'`) |
| `manager-programme` | 03/11/2025 | manager | Programme 2024 du cabinet, budget |
| `sofia-availability` | 17/11/2025 | Sofia | Ses heures à l'intérim et au final |
| `partner-interim` | 17/11/2025 | associée | Intérim |
| `ethics-e1` | 18/11/2025 | DG | Invitation (E1) |
| `manager-confirmations` | 20/11/2025, si rien n'est préparé (niveaux assistant et senior) | manager | Rappel des confirmations (J4) |
| `partner-offsite` | 21/11/2025 | associée | Hors site |
| `ethics-e2` | 09/02/2026 | DAF | Tableaux de l'annexe (E2) |
| `partner-final` | 23/02/2026 | associée | Final |
| `ethics-e3` | §9 | manager | Revue de la PGE (E3) |
| `ethics-e4` | 24/02/2026 | présidente de l'association | Prise de contact (E4) |
| `ethics-e5` | 06/03/2026, à défaut de séance | DG | Mandat (E5) |
| `partner-after-final` | 16/03/2026 | associée | Après le final |

Le courrier postérieur (presse du 03/03, mandataire du 15/03) n'est pas annoncé : il arrive dans « Courrier reçu » de la GED, comme en J4.

### 11.3 Prochain événement et tutoriel

- `nextEventDate` (`advance.ts`) s'arrête aussi aux nouveaux messages (sorte `'message'`), sans les lister dans les attendus, car un mail du DG n'est pas connu d'avance. Les reprises apparaissent comme des livraisons.
- Le premier message porte `tutorial: 'welcome'` et des liens d'action. J7 pose `tutorial` sur d'autres messages et lit `messages.read`, sans changer le modèle.
- Le bureau remplace `PartnerMessage` par une carte « Messages » (dernier non lu).

## 12. Mémo réglementaire (§10.4, annexe)

### 12.1 Forme

- **Écran.** `/memo` : recherche plein texte (pliage de `game/text.ts`), sections repliables, liens vers les mémos techniques de la GED.
- **Contenu.** `src/content/memo.json` (schéma `src/content/schema.ts`), organisé en sections → entrées `{ id, title, text[], refs[], params[], seeAlso[], keywords[] }`.
  - `refs` renvoie à `references.json`, avec le statut affiché : « référence à vérifier » pour `cdc`, formulation générale pour `general`.
  - `params` insère des valeurs de `regulatory.json` par gabarit (`{regulatory.irl.2024-T2.annualChangePct}`), jamais saisies.
- **Imports.** La couche `content` n'est importée que par `ui` ; le garde-fou de couches l'ajoute (`content` → `engine`, `scenario`, `content`).
- **Sources de recalcul.** Une entrée liée à un paramètre peut servir de source d'hypothèse (`param:<nom>`, plan J4 §11).

### 12.2 Contenu (amorce de l'annexe, complétée)

| Section | Entrées | PV |
|---|---|---|
| Normes d'exercice professionnel | Une par NEP de l'annexe (200 à 9510) : intitulé et objet, sans paragraphe | PV-08 |
| Fraude et escalade | Présomption sur les produits, contournement, alerte de l'associée, communication à la gouvernance, révélation instruite par l'associée | PV-01, PV-02 |
| Déontologie et indépendance | Cadeaux et avantages (E1) ; services interdits, autorévision (E2) ; menaces et sauvegardes, dont l'intimidation (E5) ; secret professionnel (E4) | PV-15, PV-99, PV-100 |
| Supervision | Direction, supervision et revue des travaux (T1 à T4) | PV-101 |
| Code de commerce | Irrégularités et révélation (L. 823-12) ; conventions réglementées (L. 225-38 à L. 225-42) ; délais de paiement (L. 441-14, D. 441-6) | PV-02, PV-03, PV-05 |
| CCH | Autofinancement net (définition, ratio, taux par arrêté, délibération, rapport de gestion) ; avances intra-groupe (L. 423-15) ; révision des loyers selon l'IRL du 2e trimestre et dérogations ; groupe sous 12 000 logements ; RLS | PV-10, PV-04, PV-11, PV-13, PV-102 |
| Charges récupérables | Décret n° 82-955 modifié ; quotes-parts des gardiens (`recoverableShares`) | PV-06 |
| Cadre comptable | PCG (ANC n° 2014-03) ; ANC n° 2015-04 et instruction OLS 2025 ; ANC n° 2025-05, applicable au 01/01/2026, à ne pas mélanger | PV-103, PV-21 |
| Données de marché | Livret A, IRL des 2es trimestres 2024 et 2025, plafonnement à 3,5 % et sa période | PV-17, PV-18 |
| Décence énergétique | Logements G non décents pour les baux conclus ou renouvelés depuis le 01/01/2025 | PV-12 |
| Méthode | Rapprochement des confirmations (T1), représentativité et extrapolation (T2), corroboration des estimations (T3), événements postérieurs et déclarations de la direction (A15) | PV-08, PV-09 |

### 12.3 Références à inscrire dans `docs/points-a-verifier.md` (section J)

Aucun texte du jeu ne cite une référence précise absente de ce tableau. Celles qui y figurent restent formulées en termes généraux tant qu'elles ne sont pas validées.

| ID | Sujet | Dans le jeu |
|---|---|---|
| PV-15 (étendu) | Cadeaux, services interdits, autorévision (E1, E2, E3) | « règles déontologiques de la profession », sans article |
| PV-08 (étendu) | NEP 330 (E3), 450 (A02), 505 (T1), 530 (T2), 540 (T3), 560 et 580 (A15) | numéro et objet, sans paragraphe |
| PV-01, PV-02 (étendus) | Conduite sur A11 : NEP 240 et 260 ; L. 823-12 instruit par l'associée | termes généraux |
| PV-14, PV-03, PV-04, PV-11, PV-18 | Répliques des A03, A12, A17 ; note de T4 | arguments ou mentions « à vérifier » |
| PV-99 | Secret professionnel du commissaire aux comptes (E4) | sans article |
| PV-100 | Intimidation et sauvegardes ; durée et renouvellement du mandat (E5) | termes généraux |
| PV-101 | Supervision et revue des travaux (T1 à T4) | aucune NEP citée : la liste du cahier n'en contient pas |
| PV-102 | RLS | sans article |
| PV-103 | PCG, règlement ANC n° 2014-03 | numéro du cahier, intitulé à confirmer |
| PV-104 | Protection d'une source interne (Karim) | aucun régime de lanceur d'alerte cité |
| PV-105 à PV-109 | Barème et seuils des jauges, humeurs ; confidences (J5-7) ; règle de T2 (J5-13) ; coûts des séances, revues et reprises ; travail du membre (J5-9) | choix de conception |
| PV-110 | Contenu de E4 : conseil de concertation, hausse de 3,50 % | faits narratifs à valider |
| PV-111 | E2 accepté sans changement des documents | simplification |

## 13. Leviers de difficulté (§10.9)

`game.json → difficulty[niveau]` (`difficultyLevel`, `schema.ts:393`) gagne deux champs : `clientRelationLossFactor` et `teamHints`.

| Levier | Assistant | Senior | Manager |
|---|---|---|---|
| `clientRelationLossFactor` (relation indulgente) | 0,5 | 1 | 1 |
| `teamHints` (Léa signale des zones à creuser) | oui | non | non |
| `aid` (J4) | gratuite | payante (confiance de l'associée) | indisponible |
| `responseDelayFactor` (J4), étendu à l'espacement des séances | 1 | 1 | 1,5 |
| `reminders` (J4) | oui | oui | non |

La note de synthèse écrite du niveau manager relève de J6. Toutes les anomalies restent actives (V1).

## 14. Modèle de données (`GameState` v3) et persistance

Chaque nouvelle section a son module dans `src/game/`, propriétaire de ses types, de ses actions pures et de son sous-schéma Zod.

```ts
// game/interviews.ts — QuestionKey = 'person:family[:object]'
type InterviewAction =
  | { kind: 'ask'; question: QuestionKey; variant: 'full' | 'partial' | 'redirect' }
  | { kind: 'present'; topic: QuestionKey; evidence: Evidence; outcome: 'concede' | 'reveal' | 'nuance' | 'offTopic' | 'already' }
  | { kind: 'insist'; topic: QuestionKey; outcome: 'moved' | 'holds' }
  | { kind: 'accuse'; topic: QuestionKey; founded: boolean };
interface Session { id: string; person: PersonId; on: IsoDate; audience: 'alone' | 'withCfo' | 'withPartner'; actions: InterviewAction[] }
interface InterviewsState { sessions: Session[] }

type ConsultedState = Record<string, IsoDate>;                 // game/consulted.ts : 'acct:4687', 'fec:2025:OD000189'

interface EthicsState {                                        // game/ethics.ts
  choices: Partial<Record<'E1' | 'E2' | 'E3' | 'E4' | 'E5', { on: IsoDate; option: string }>>;
  karim?: { confidedOn: IsoDate; response?: { on: IsoDate; option: string } };
}

interface MessagesState { read: Record<string, IsoDate> }      // game/messages.ts
```

- **Champs facultatifs ajoutés** (`.optional()`) :
  - `Execution.review` (`program.ts:54`) : `motive`, `rounds: { on, decision, motive?, comment }[]` ; le dernier tour donne `status` ;
  - `Execution.briefing` : `{ on, point }` ;
  - `RequestItem.lowRelation`.

  `GaugesState` ne change pas.
- **Dérivé, non stocké** : humeurs, disponibilités, boîte de réception, événements en attente, jauges, pièces conditionnelles, travail du membre, reprises, `reviewOutcome`.
- **Migration.** `SCHEMA_VERSION = 3`. `MIGRATIONS[2] = (raw, fresh) => ({ ...raw, interviews: fresh.interviews, consulted: fresh.consulted, ethics: fresh.ethics, messages: fresh.messages, schemaVersion: 3 })`. Elle est non destructive, et la chaîne 1 → 3 reste valide. Sans migration, Zod 4 rejetterait les sauvegardes v2 faute des sections obligatoires.
- **Contenu.** `CONTENT_VERSION = 2` (comptes rendus, pièce de E4).
- **Orphelins.** `cleanOrphans` (`persistence.ts`, `ui/app/orphans.ts`) retire :
  - les actions de séance sur une question ou une pièce inconnue ;
  - les marques de lecture de messages inconnus ;
  - les choix d'options disparues.

## 15. Paramètres et schémas

| Fichier | Contenu | Schéma |
|---|---|---|
| `params/characters.json` | `interview` (`sessionHours` 0,5, `maxActions` 4). Par personne : espacement, séances maximales, périodes, sensibilité, portrait. `lowRelation` (`delayFactor` 1,5, `gapExtraDays` 2), `mood`, `karim` (`confideAt` 60, `confideFromPeriod` `final`), `partnerMeetings` (`max` 3, `minPartnerTrust` 30) | `schemas/characters.ts` |
| `params/gauges.json` | `effects` (code → gauge, delta, label) ; `repeat.unrelatedRequest.freePerPhase` 3 ; `escalation` (`minEvidence` 2, `maxCounted` 3) | `schemas/gauges.ts` (énumération des codes partagée) |
| `params/review.json` | `reviewHours` 0,25, `briefingHours` 0,5, `reworkShare` 0,5 ; `returnMotives` ; `briefings` (`prevents`) ; `variants` T1 à T4 (défaut, gabarits, sélection de T2 : populations, `maxItems` 5) ; `memberSample` ; `recalcSources` | `schemas/review.ts` |
| `params/ethics.json` | E1 à E5 : déclencheur, expéditeur, options (libellé, effets, `outcome`), échéance, défaut, heures (6 pour E2) | `schemas/ethics.ts` |
| `params/messages.json` | Catalogue du §11.2 | `schemas/messages.ts` |
| `params/game.json`, `documents.json`, `references.json` | Champs de difficulté ; `E4.concertationDate` ; identifiants nouveaux (NEP manquantes, déontologie, secret, intimidation, supervision, RLS, PCG) | `schema.ts` |
| `src/content/memo.json` | Mémo (§12) | `src/content/schema.ts` |

**Intégrité** (Vitest). Chaque question, confrontation, message, option et motif ne référence que des pièces, personnes, familles, codes, conditions et procédures existants, et chaque gabarit se résout. Le garde-fou « aucun montant saisi » (`tests/guards.test.ts`) s'étend à `scenario/npc/`, `src/content/` et aux nouveaux JSON.

## 16. Règles pures (`src/game`) et contenu (`src/scenario/npc`)

| Fichier | Rôle et fonctions |
|---|---|
| `scenario/npc/sheets.ts`, `questions.ts`, `answers.ts`, `confrontations.ts`, `interview-docs.ts` | Fiches (`CHARACTERS`), familles et objets (`QUESTION_FAMILIES`, `questionObjects`), réponses (`scenarioAnswer`, `genericAnswer`), tables de pertinence (`CONFRONTATIONS`), comptes rendus (`interviewDocuments(c: DocContext)`, appelé par `buildDocuments`) |
| `schemas/conditions.ts` | Schéma déplacé de `schemas/procedures.ts` (réexporté) ; sortes nouvelles `read`, `consulted` (préfixe), `finding` (objets, cycle, statuts), `escalated`, `gauge`, `asked`, `ethics`, `confided` ; état `planned` pour `procedure` |
| `game/conditions.ts` | Accesseurs facultatifs du contexte (`isRead`, `consulted`, `openFindings`, `gaugeValue`, `asked`, `ethicsChoice`), sur le modèle de `procedureProgress` ; `evaluate` reste exhaustif |
| `game/characters.ts` | `moodOf`, `availabilityOf`, `nextAvailable` |
| `game/interviews.ts` | `availableQuestions`, `openSession`, `ask`, `present`, `insist`, `accuse`, `closeSession`, `interviewAnswers` (GED), `concessions` (J6), `interviewGaugeEvents`, `hoursCharged` |
| `game/consulted.ts` | `markConsulted` |
| `game/review.ts` | `variantOf`, `memberWork`, `reviewOutcome`, `returnWorksheet`, `acceptWorksheet`, `briefExecution`, `reworkTasks`, `reviewGaugeEvents`, `hoursCharged` |
| `game/program.ts` | `delegatedWorksheet` lit `memberWork` ; `reviewExecution` délègue à `review.ts` ; `scheduleExecutions` inclut les reprises ; `overrunJustified` lit E3 |
| `game/ethics.ts` | `ethicsEvents` (en attente, échéances), `answerEthics`, `respondToConfidence`, `conditionsMet` (`Map`), `ethicsGaugeEvents` |
| `game/messages.ts` | `inbox`, `unreadCount`, `markMessageRead`, `messageStops` |
| `game/gauges.ts` | `gaugeValues`, `gaugeHistory`, `relationLow`, `escalationGaugeEvents` |
| `game/documents.ts`, `requests.ts`, `aid.ts`, `budget.ts`, `advance.ts` | Conditions datées et mode `interview` ; `lowRelation` figé dans `sendRequest` et lu par `delayDays` ; `leaHints` ; agrégation des séances, revues, consignes, reprises et de E2 ; arrêts sur les messages |

`memberWork` lit les indices des pièces, comme `delegatedWorksheet` en J4, et n'expose que la pièce ou l'élément, jamais l'anomalie.

## 17. Écrans et routes

| Écran | Route | Contenu |
|---|---|---|
| Entretiens | `/entretiens`, `/entretiens/:personne` | Personnes : portrait, humeur, disponibilité ou prochaine date, jauge de Karim. Séance : audience, historique, questions par famille, sélecteur d'objet, « Présenter une pièce », « Insister », « Mettre en cause », « Clore ». Liens vers les comptes rendus |
| Revue de l'équipe | `/equipe` | Feuilles à revoir, en reprise, acceptées. Travail du membre (note, échantillon, recalcul, points), conclusion proposée, « Accepter », « Renvoyer » (motif, commentaire), tours. Consignes, heures par membre, aide de Léa |
| Messagerie | `/messagerie`, `/messagerie/:id` | Boîte avec non lus, lecture, liens d'action, choix éthiques et échéance |
| Mémo | `/memo` | Recherche, sections, statut des références |
| Bureau | `/` | Carte « Messages » (remplace `PartnerMessage`), jauges dérivées et dernières variations, feuilles à revoir |
| Barre supérieure | — | Jauges dérivées (`Shell.tsx`), badge des messages |
| Travaux | `/travaux` | Consigne au lancement ; « Travail préparé par … » enrichi (`ExecutionPanel.tsx`), revue renvoyée vers `/equipe` |
| GED | `/ged` | Catégorie « Entretiens », mode « Entretien », pièce de E4 |
| Grand livre, FEC | `/grand-livre`, `/fec` | `markConsulted` à la première ouverture |
| Mode concepteur | `/controle` | Onglets « Personnages » (fiches, secrets, conditions de révélation, confrontations), « Équipe » (variante, `reviewOutcome`), « Éthique » (options attendues), « Jauges » (tous les événements). Actions : faire se confier Karim, déclencher E1 à E5. Le déblocage des pièces couvre les pièces conditionnelles (§10.10) |

- **Palette** (Ctrl+K) : personnes, entrées du mémo, messages.
- **Accessibilité.** Contrastes AA et clavier. Historique de séance en `aria-live="polite"`, choix en groupes radio étiquetés, portraits avec texte alternatif.
- **Vérification visuelle.** `scripts/ui-check.mjs` sur les quatre écrans nouveaux, en thème clair et sombre, à 1280 et 1024 px.

## 18. Tests

**Règles pures** (fixtures légères) :

- **Entretiens.** Déblocage, présence sur site, plafond d'actions, espacement, président une fois, heures, variante selon la relation, l'humeur et `from`, issue figée, redirection, question reposée.
- **Confrontation.** Accumulation des pièces ; concession seulement avec l'ensemble complet et l'associée si elle est requise ; nuance ; coût du hors sujet ; `moves` et `holds` ; mise en cause avec ou sans preuve, F4 doublée ; `a11ConfrontedAlone`.
- **Karim.** Calcul de sa jauge. Confidences refusées sous 60, en présence de la DAF ou avant le final, puis acceptées. Date de la condition. Trois options.
- **Pièces conditionnelles.** Une condition remplie avant la date de la pièce ne la montre qu'à sa date. « Reçu le » vaut le max. Pièce de E4 ; mode concepteur.
- **Équipe.**
  - Variante seulement pour le membre scénarisé ; consigne qui évite le défaut ; travail correct hors T1 à T4.
  - T2 : de 1 à 5 éléments, l'OD des Peupliers exclue, nombre dérivé. T1 : écart calculé à partir de la réponse et de la comptabilité. T3 : écart nul. T4 : aucune exception.
  - Reprises selon le motif ; reprise refusée après le final ; aucun événement visible pour une feuille fautive acceptée.
- **Éthique.** Déclencheurs, échéances et options par défaut, effets, E3 et `overrunJustified`.
- **Jauges.** Ordre chronologique, bornes, facteur du niveau assistant, cumul de J4 et J5, recul d'horloge, délai figé sous 30, remontées et surprises tardives.
- **Messagerie.** Boîte dérivée, lecture, recul d'horloge, arrêts non listés, messages de phase identiques à ceux de J4.
- **Mémo.** Schéma, `refs` existants, gabarits résolus, aucune référence précise hors du §12.3.
- **Persistance.** Migrations 2 → 3 et 1 → 3, nettoyage des orphelins.

**Déterminisme.**

- Une partie scriptée (séances, confrontations, revues, choix éthiques) jouée deux fois donne des états et des sorties identiques.
- Ni `Math.random` ni `Date.now` dans `game/`, `scenario/npc/` ou `src/content/` (garde-fou).

**Aucune fuite hors mode concepteur.**

- Catalogues identiques avec toutes les anomalies inactives ou actives : familles, objets, déblocages, motifs, consignes, messages, options. Seules les réponses et les notes diffèrent.
- Aucun texte visible du joueur ne contient d'identifiant d'anomalie, de partie ou de fausse piste, ni de texte d'indice, ni d'identifiant interne d'écriture. Sont couverts : réponses partielles, redirections, fiches, messages, notes, libellés de jauges, mémo.
- Aucun événement de l'historique des jauges ne dépend de la clé.
- `matching` et `case.key` restent interdits aux fichiers de J5. Secrets, variantes et issues attendues ne sont importés que par le mode concepteur et `game/j6/` (nouveau garde-fou).

**Observabilité** (`tests/anomalies/observability.test.ts`, annexe régénérée en `docs/j5-observabilite.md`).

- Le mode « entretien » est ajouté ; les pièces conditionnelles et les confidences restent exclues.
- Chaque partie reste observable dans sa fenêtre dans les cas suivants :
  - relation au plus bas : toute pièce sur demande arrive au plus tard le 13/03/2026 avec × 1,5 (× 2,25 au niveau manager), sinon le facteur est plafonné ;
  - T1 à T4 acceptés ;
  - E4 refusé ;
  - Karim qui ne se confie jamais.
- Aucune partie ne dépend d'un compte rendu seul : au moins deux indices indépendants hors entretien demeurent (§3.4).

**Recoupements.**

- Chaque `stance` avec `requiredEvidence` a une confrontation de la même personne, sur le même ensemble de pièces existantes.
- Chaque indice d'entretien du §5 (A02, A04, A05, A15) existe dans un compte rendu.

**Calibrage.** Le programme de référence scripté de J4 tient en 340 h ou moins, une fois augmenté d'environ 15 séances, des revues, de deux consignes et d'une reprise.

## 19. Découpage et parallélisation

1. **J5a — socle**, en séquence :
   - `GameState` v3 et migration, section `consulted` et ses appels (grand livre, FEC) ;
   - `schemas/conditions.ts` et sortes nouvelles ;
   - conditions datées, mode `interview`, catégorie et source d'indice ;
   - `gaugeValues` avec fournisseurs vides, `params/gauges.json` avec tous les codes, lectures de l'interface ;
   - schémas et squelettes des nouveaux paramètres, champs de difficulté ;
   - routes et écrans provisoires ;
   - contrats : `MessageProvider`, `GaugeEventProvider`, `PersonId`, `QuestionKey`, `EthicsEventId`.
2. **Lot E — entretiens et personnages.** Agent E, propriétaire de :
   - `src/scenario/npc/`, `params/characters.json` ;
   - `game/characters.ts`, `game/interviews.ts`, dont la jauge de Karim et les confidences ;
   - l'appel à `interviewDocuments` dans `scenario/documents/index.ts` (une ligne) ;
   - `ui/screens/interviews/`, `ui/components/Portrait.tsx`.
3. **Lot T — équipe.** Agent T, propriétaire de :
   - `game/review.ts` ;
   - dans `game/program.ts`, de la section des travaux délégués et de la revue ;
   - `delegatedAcquisitions` (`samples.ts`) et `leaHints` (`aid.ts`) ;
   - `params/review.json` ;
   - `ui/screens/team/` et la section de revue d'`ExecutionPanel.tsx`.
4. **Lot M — messagerie et éthique.** Agent M, propriétaire de :
   - `game/messages.ts`, `game/ethics.ts`, `params/messages.json`, `params/ethics.json` ;
   - la pièce de E4 (`catalog/correspondence.ts`, seul fichier modifié du catalogue) et `documents.json → E4` ;
   - `ui/screens/messages/`, la carte « Messages » du bureau, les arrêts d'`advance.ts`.
5. **Lot R — mémo et références.** Agent R, propriétaire de :
   - `src/content/`, `ui/screens/memo/` ;
   - `params/references.json`, la section J de `docs/points-a-verifier.md` ;
   - le garde-fou de couches.
6. **Intégration**, en séquence :
   - `escalationGaugeEvents` ;
   - partie de référence scriptée (340 h) et annexe d'observabilité ;
   - dossier de revue métier étendu (`npm run review-pack` : réponses, confrontations, notes de l'équipe, textes éthiques, mémo, pour validation par l'expert) ;
   - revue adversariale ;
   - `CLAUDE.md`, commit J5.

Après le socle, les lots ne partagent aucun fichier. Codes de jauge, identifiants de personnes et clés de question sont fixés en J5a.

## 20. Reporté

- **J6.**
  - Réunions de synthèse (17/03, 19/03) et application des `clientStance`.
  - Acceptation des corrections ; escalade en négociation (« coûte de la confiance si son dossier est faible »).
  - Notation de la supervision (8 %) et de l'éthique (7 %), effets différés des revues.
  - Communications NEP 260 et 265 ; note de synthèse écrite du niveau manager.
- **J7.**
  - Contenu du tutoriel (accroches du §11.3), choix du niveau, emplacements de sauvegarde, mode concepteur complet.
  - Test de bout en bout reprenant les actions de J5.
- **Après la V1.**
  - Entretiens en langage naturel (§13.1).
  - Entretiens avec les tiers (notaire, avocate, mandataire), aujourd'hui servis par les confirmations et le courrier.
  - Progression de l'équipe au-delà des consignes.
  - Sous-ensemble d'anomalies selon le niveau (§10.9).
