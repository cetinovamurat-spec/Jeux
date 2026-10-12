# Cahier des charges — « Dossier Val d'Aurelle »
## Jeu de rôle interactif d'audit légal d'un organisme de logement social (navigateur)

> Destinataire : Claude Code. Lis l'intégralité de ce document avant d'écrire la moindre ligne de code.

---

## 0. Règles de travail

1. **Commence en mode plan.** Propose l'architecture, l'arborescence, le modèle de données (types TypeScript), le découpage par jalons (§12) et les risques techniques. Attends ma validation avant de coder.
2. **Avance jalon par jalon.** À la fin de chaque jalon : `npm run test` vert, `npm run build` sans erreur, commit git explicite, mise à jour de `CLAUDE.md` (conventions + état d'avancement) et de `docs/points-a-verifier.md`.
3. **Point d'arrêt obligatoire à la fin de J2.** Avant toute interface de jeu, présente-moi : la balance générale N/N-1, les états financiers présentés et corrigés, le tableau des anomalies avec leurs impacts calculés, et la liste des indices par anomalie. Je suis auditeur senior spécialisé dans les organismes de logement social (OLS) : je valide le fond avant qu'on construise le jeu dessus.
4. **Exactitude technique.** Le jeu sert à former des auditeurs : une erreur technique dans le contenu est un bug bloquant. N'invente jamais une référence précise (numéro d'article, paragraphe de NEP, numéro de compte) dont tu n'es pas sûr : formule-la de façon générale et consigne le point dans `docs/points-a-verifier.md`. Les références et paramètres réglementaires vivent dans des fichiers de données éditables, jamais en dur dans les composants.
5. **Aucun montant saisi à la main** dans l'interface ou les documents : tout chiffre affiché est dérivé du moteur comptable (§3). Les documents sont des modèles alimentés par les données.
6. **Langue.** Interface et contenus en français, registre professionnel, vocabulaire CAC/HLM exact. Code, identifiants et commentaires techniques en anglais. Format fr-FR (1 234 567,89 € ; JJ/MM/AAAA).
7. Ne me pose de question que si une décision est structurante et non tranchée ici ; sinon, choisis l'option la plus simple et note-la dans `CLAUDE.md`.

---

## 1. Vision

Le joueur incarne **un(e) auditeur(trice) senior** du cabinet fictif **Sequana Audit**, chargé(e) de l'audit des comptes de l'exercice clos le **31/12/2025** de **Val d'Aurelle Habitat**, entreprise sociale pour l'habitat (ESH) fictive. Il pilote la mission sous l'autorité d'une associée signataire et d'un manager, supervise deux collaborateurs et interagit avec la direction de l'organisme et des tiers.

Principes de design (non négociables) :

- **Rien n'est signalé automatiquement.** Une procédure produit des données, des documents, des réponses — jamais des conclusions. C'est le joueur qui repère, quantifie, documente et conclut.
- **Un dossier piégé mais crédible** : erreurs factuelles, estimations biaisées, un indice de fraude, des irrégularités, et des **fausses pistes** qui sanctionnent l'excès de zèle.
- **Des ressources rares** : le budget d'heures ne permet pas de tout faire → l'approche par les risques est obligatoire.
- **Des personnages qui ont des intérêts** : ils répondent partiellement, défendent leurs positions avec de vrais arguments techniques, et cèdent devant des preuves.
- **Une fin ouverte** : certification sans réserve, avec réserve, ou opinion inappropriée — selon ce que le joueur a trouvé, prouvé et obtenu.
- **Le débrief est le cœur pédagogique** : pour chaque anomalie, ce qu'il fallait voir, où, avec quelle procédure, la référence et l'écriture de correction.

Durée cible d'une partie complète : 3 à 5 heures, avec sauvegarde.

---

## 2. Stack et contraintes techniques

- Vite + React + TypeScript (mode strict), Tailwind CSS, React Router.
- Zustand pour l'état de jeu, avec persistance versionnée et migrations de schéma.
- TanStack Table + TanStack Virtual pour les grands tableaux (balance, grand livre, FEC de plusieurs dizaines de milliers de lignes).
- Zod pour valider le scénario au chargement.
- Recharts pour les graphiques d'analyse.
- Vitest (tests unitaires et d'intégrité comptable) ; Playwright pour un test de bout en bout en J7.
- 100 % client, aucune API externe, fonctionnement hors ligne. Polices auto-hébergées (@fontsource : Inter, et JetBrains Mono pour les montants en chiffres tabulaires).
- Sauvegarde : localStorage (sauvegarde automatique + 3 emplacements) et export/import JSON de la partie. Tout accès au stockage est encapsulé dans un try/catch.
- Exports : CSV (balance, grand livre, FEC, tableau des anomalies) ; feuille d'impression soignée pour le rapport du commissaire aux comptes (PDF via le navigateur).
- Builds : `npm run build` (site statique) et `npm run build:single` (fichier HTML unique via vite-plugin-singlefile) pour partager le jeu sans serveur.
- Arborescence indicative :

```
src/
  engine/       moteur comptable pur (sans React) : types, plan de comptes, écritures,
                balance, états, annexe, FEC, CAF, ratios
  scenario/     cas « Val d'Aurelle 2025 »
    generator/  génération déterministe (seed) du grand livre « propre »
    anomalies/  un module par anomalie (patch, indices, clé, dialogues, débrief)
    documents/  modèles de documents alimentés par les données
    npc/        fiches personnages et arbres de dialogue
    params/     paramètres réglementaires, de calibrage et de scoring (JSON)
  game/         règles : temps, budget, procédures, constats, négociation, opinion,
                scoring, événements
  ui/           écrans et composants
  content/      textes pédagogiques, mémo réglementaire
scripts/        generate-scenario.ts → public/scenarios/val-aurelle-2025/*.json
tests/
docs/           points-a-verifier.md, guide-auteur.md (créer un scénario, une anomalie)
```

---

## 3. Moteur comptable : la garantie de cohérence

C'est la pièce la plus importante du projet. Des états financiers écrits « à la main » ne tombent jamais juste ; ici, tout découle d'écritures.

### 3.1 Principe : grand livre propre + patches d'anomalies

1. Le générateur (seed fixe) produit le **grand livre « propre »** de l'exercice 2025 : à-nouveaux au 01/01/2025 (égaux au bilan certifié 2024), puis les écritures de l'exercice : quittancement, RLS, APL, encaissements, achats et travaux, paie, échéances d'emprunts, amortissements par composant, quote-part des subventions virée au résultat, provisions, cessions, opérations d'investissement, écritures d'inventaire.
2. Chaque anomalie est un **module** qui transforme le grand livre propre en grand livre **présenté** (écritures modifiées, ajoutées ou supprimées) et injecte ses **indices** dans les documents et données annexes.
3. Les comptes **corrigés** sont le grand livre propre. Invariant central, testé : `présenté + Σ écritures de correction attendues = propre`.
4. Tout le reste est **dérivé** : balance N et N-1, grand livre, FEC, bilan, compte de résultat, tableaux d'annexe, CAF, autofinancement net HLM, ratios, auxiliaires (locataires, dette par prêt, registre des immobilisations par composant).

Interface indicative d'un module d'anomalie :

```ts
interface AnomalyModule {
  id: string;                              // 'A01'…'A22'
  cycle: Cycle;
  assertions: Assertion[];
  classification: 'factuelle' | 'jugement' | 'extrapolee';
  severity: 1 | 2 | 3;
  difficulty: 1 | 2 | 3;
  apply(ctx: ScenarioContext): void;       // propre → présenté + indices
  correctingEntries(ctx: ScenarioContext): JournalEntry[];
  // impacts (résultat, capitaux propres, CAF, bilan) : CALCULÉS par le moteur, jamais saisis
  clues: ClueRef[];                        // au moins 2 indices indépendants
  signature: { cycle: Cycle; objectIds: string[]; natures: Nature[] }; // appariement des constats
  tolerance: { min: number; max: number };
  clientStance: NegotiationProfile;        // accepte / conteste / cède sous conditions de preuves / refuse
  debrief: { explanation: string; references: string[]; goodPractice: string };
}
```

### 3.2 Plan de comptes

Fichier de données (CSV/JSON) : numéro, libellé, classe, sens, rubrique du bilan ou du compte de résultat, rubrique d'annexe. Propose un plan fidèle à l'**instruction comptable des organismes HLM applicable à l'exercice 2025** (règlement ANC n° 2015-04 et instruction antérieure à la réforme de 2026). Marque `toValidate: true` tout compte dont tu n'es pas certain. Prévois l'**import d'un plan de comptes officiel en CSV** pour remplacer le tien.

> Repère : la réforme du cadre comptable des OLS (règlement ANC n° 2025-05 du 5 décembre 2025, qui intègre les évolutions du règlement ANC n° 2022-06) s'applique aux exercices ouverts à compter du 1er janvier 2026. Les comptes 2025 du cas relèvent donc encore de l'ancien plan. Ne mélange pas les deux référentiels.

### 3.3 Volumétrie et formats

- Environ 40 programmes, 8 600 baux, 1 200 ex-locataires débiteurs, 120 lignes de prêts, 3 500 composants immobilisés, 4 000 factures fournisseurs ; FEC de 25 000 à 40 000 lignes.
- Le quittancement est comptabilisé en écritures récapitulatives par programme et par mois, comme une interface de gestion locative ; le détail par locataire vit dans l'auxiliaire du logiciel de gestion locative fictif **LOGIGES**.
- FEC conforme à l'article A. 47 A-1 du LPF : 18 champs (JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise). Ajoute un champ interne non exporté (utilisateur de saisie) exploitable par l'outil de tests d'écritures.
- Comptes 2024 : balance N-1, bilan, compte de résultat et annexe « certifiés », plus le rapport du commissaire aux comptes 2024. Historique sur 5 exercices pour le tableau des résultats et le ratio d'autofinancement net.

### 3.4 Tests d'intégrité (Vitest, bloquants)

- Chaque écriture est équilibrée ; la balance est à zéro ; total du grand livre = balance ; FEC = balance.
- Bilan actif = passif, et résultat du compte de résultat = résultat du bilan, en présenté comme en corrigé.
- Colonne N-1 des états = comptes certifiés 2024, à l'exception volontaire de l'anomalie A22.
- Tableaux d'annexe rapprochés de la balance (immobilisations, amortissements, provisions, subventions, dettes, créances), à l'exception volontaire de A21.
- Auxiliaire locataires = comptes de locataires de la comptabilité générale, sauf l'écart volontaire A19 ; dette par prêt = comptes d'emprunts, sauf A18.
- Pour chaque anomalie : écritures de correction équilibrées ; au moins 2 indices indépendants présents ; impacts calculés conformes aux cibles du §5 (tolérance ± 3 %, ± 10 % pour A08).
- Cibles du §4.3 respectées dans leurs tolérances.

---

## 4. Le cas : Val d'Aurelle Habitat — exercice 2025

### 4.1 Identité

- **Val d'Aurelle Habitat**, SA d'HLM (ESH), siège à Aurelle-sur-Marne (ville fictive). Actionnaire de référence : **Altaïr Habitat SA** (71 % du capital), tête du **groupe Altaïr** ; collectivités et autres actionnaires : 29 %. Avec moins de 12 000 logements, l'ESH satisfait à l'obligation d'appartenance à un groupe d'organismes de logement social via le groupe Altaïr.
- Patrimoine au 31/12/2025 : environ 8 600 logements familiaux (dont 52 livrés en 2025 aux Tilleuls et 25 ventes HLM effectives dans l'année), 4 structures collectives (FJT « Le Phare » 150 places géré par l'association **Accueil Horizons**, résidence sociale 70 places, pension de famille 25 places, résidence autonomie 60 places), 46 locaux commerciaux, environ 2 150 places de stationnement.
- Environ 190 salariés, dont les gardiens d'immeubles.
- Gouvernance : conseil d'administration (dont des représentants des locataires), président du CA (dirigeant du groupe Altaïr, également administrateur de l'ESH sœur **Coteaux du Serein Habitat**), directeur général. Arrêté des comptes par le CA le 26/03/2026 ; assemblée générale le 18/06/2026.
- Le mandat de Sequana Audit arrive à échéance à l'issue de l'assemblée qui statuera sur les comptes 2025.

### 4.2 Contexte et facteurs de risque

Ces éléments sont distillés dans les documents et les entretiens, jamais listés tels quels au joueur.

- Nouvelle DAF arrivée en avril 2025 (départ en retraite de son prédécesseur) ; équipe comptable réduite.
- Migration du logiciel comptable et de l'interface de gestion locative au 01/10/2025.
- Part variable du DG assise notamment sur un objectif de résultat net de 9 M€ fixé par le CA.
- Le groupe demande à l'ESH de soutenir l'ESH sœur en difficulté financière.
- Rapport de contrôle ANCOLS de 2022 : recommandations sur le recouvrement, les charges récupérables et le suivi des subventions.
- Baisse du taux du Livret A en 2025 : 3 % jusqu'au 31/01, 2,4 % du 01/02 au 31/07, 1,7 % à compter du 01/08 (moyenne pondérée ≈ 2,16 %). Les prêts indexés sont révisés à leurs dates d'échéance : la baisse des frais financiers est réelle mais décalée.
- Révision des loyers au 01/01/2025 plafonnée par la variation de l'IRL du 2e trimestre 2024 (+3,26 %) ; le CA d'octobre 2024 a pourtant voté +3,50 % (cf. A17).
- Loi Climat et résilience : depuis le 01/01/2025, les logements classés G ne satisfont plus au critère de décence énergétique pour les nouveaux baux → contexte de la résidence Les Glycines.
- Programme de renouvellement urbain (NPNRU) sur le quartier des Glycines.
- Réduction de loyer de solidarité (RLS) toujours en vigueur.

### 4.3 Chiffres cibles (comptes présentés) — le générateur doit les atteindre

| Agrégat | 2025 présenté | 2024 certifié | Tolérance |
|---|---|---|---|
| Loyers (nets de RLS) | ≈ 46,8 M€ | ≈ 44,9 M€ | ± 2 % |
| RLS | ≈ 2,5 M€ | ≈ 2,4 M€ | ± 5 % |
| Récupération des charges locatives | ≈ 11,2 M€ | ≈ 10,9 M€ | ± 2 % |
| Excédent brut d'exploitation / loyers | 52 – 55 % | 50 – 53 % | — |
| Frais financiers | ≈ 8,6 M€ | ≈ 9,6 M€ | ± 3 % |
| Dette financière | ≈ 365 M€, dont ≈ 84 % auprès de la Banque des Territoires indexés sur le Livret A | — | ± 3 % |
| Remboursements en capital (hors anticipés) | ≈ 13,4 M€ | ≈ 13,0 M€ | ± 3 % |
| Plus-values nettes de cessions (ventes HLM) | ≈ 3,5 M€ | ≈ 2,7 M€ | ± 5 % |
| **Résultat net** | **9,20 M€** | **5,40 M€** | ± 0,1 M€ |
| **Résultat net corrigé (comptes propres)** | **≈ 4,83 M€** | — | ± 0,15 M€ |
| **Ratio d'autofinancement net HLM** | **5,2 %** (2023 : 3,1 % ; 2024 : 2,6 %) | 2,6 % | ± 0,2 pt |
| **Ratio corrigé** | **≈ 2,6 %** ; moyenne sur 3 ans ≈ 2,8 % (présentée ≈ 3,6 %) | — | ± 0,3 pt |
| Total du bilan | ≈ 640 M€ | — | ± 5 % |
| Capitaux propres | ≈ 230 M€, dont subventions d'investissement ≈ 98 M€ | — | ± 5 % |
| Provision pour gros entretien (PGE) | ouverture 7,40 M€ ; dotation 1,45 ; reprise 2,67 ; clôture 6,18 (corrigée 6,96) | — | exact |
| Trésorerie | ≈ 28 M€ | — | ± 10 % |

Convention de calcul, paramétrable et **à valider** : autofinancement net HLM = CAF au sens du PCG − remboursements d'emprunts liés à l'activité locative (hors remboursements anticipés) ; ratio = autofinancement net / (produits d'activité hors récupérations de charges + produits financiers). Les taux de référence fixés par arrêté sont des paramètres de `params/regulatory.json` (valeurs par défaut à vérifier : 0 % pour l'exercice, 3 % en moyenne sur trois exercices). Avec ces valeurs, les comptes présentés passent le seuil et les comptes corrigés ne le passent plus : c'est un facteur qualitatif majeur.

### 4.4 Programmes clés (à placer parmi environ 40 programmes)

| Programme | Caractéristiques | Anomalies |
|---|---|---|
| Les Tilleuls | neuf, 52 logements PLUS/PLAI, coût 9,55 M€ dont terrain 1,10 M€, réception le 30/06/2025, entrées dans les lieux en juillet | A01, A16 |
| Les Érables | 1986, chaufferie collective de 2008 remplacée par une PAC mise en service le 30/06/2025 | A02 |
| Le Clos Fleuri | pavillons, ventes aux locataires | A03 |
| Les Glycines (bâtiment B) | 72 logements, majoritairement classés G, démolition NPNRU | A04 |
| Les Acacias, Le Belvédère | travaux de gros entretien programmés (ravalement 2026, étanchéité 2027) | A05 |
| Les Peupliers | travaux d'entretien 2025 | A06 |
| Les Charmes | réhabilitation thermique, subvention départementale | A09 |
| Les Marronniers | lots en copropriété (syndic) | A10 |
| FJT Le Phare | 150 places, géré par Accueil Horizons | A11, A15 |
| Les Saules | doublon d'interface de quittancement en octobre | A19 |

### 4.5 Personnages

**Cabinet Sequana Audit**
- **Claire Delmas**, associée signataire — exigeante, pédagogue, a horreur des surprises tardives ; tranche les sujets sensibles (fraude, opinion).
- **Antoine Roussel**, manager — sur cinq dossiers à la fois, pousse au respect du budget, utile sur la méthodologie.
- **Léa Garnier**, assistante de 1re année — rigoureuse mais littérale : refait les calculs du client sans les challenger.
- **Hugo Mercier**, stagiaire — rapide, prend des raccourcis (échantillons biaisés, conclusions hâtives).
- **Sofia Benali**, auditrice des systèmes d'information, mobilisable quelques heures — revue de la migration.

**Val d'Aurelle Habitat**
- **Bertrand Vasseur**, directeur général — politique, charismatique, très attaché au résultat (part variable) et à des « partenaires sans histoires ».
- **Nathalie Ferrand**, DAF — compétente, sous pression, argumente techniquement (Code civil, doctrine) ; cède devant des preuves solides.
- **Karim Haddad**, chef comptable — fiable, épuisé par la migration, mal à l'aise avec certaines écritures ; peut se confier si le joueur instaure la confiance.
- **Isabelle Moreau**, directrice du patrimoine et de la maîtrise d'ouvrage — technique, franche ; détient le plan pluriannuel d'entretien (PPE) « officiel » et les PV de réception.
- **Julien Petit**, responsable de la gestion locative et du recouvrement — statistiques de recouvrement, balance âgée, enquêtes.
- **Gérard Lambert**, président du CA — dirigeant du groupe Altaïr.

**Tiers** : Me Laurent Girard (notaire), Me Sophie Aubert (avocate), Me Patrice Lenoir (mandataire judiciaire), Rachida Benamar (présidente de l'association de locataires), Banque des Territoires, banques commerciales, Département, Accueil Horizons, Coteaux du Serein Habitat, GIE Altaïr Services.

Chaque personnage dispose d'une fiche : personnalité, connaissances, secrets, conditions de révélation, sensibilité (effets sur la relation client), répliques. Portraits en SVG stylisés générés, aucune photo de personne réelle.

### 4.6 Calendrier et budget

- **Intérim** : 17 au 20/11/2025 — prise de connaissance, contrôle interne, revue de la migration, tests intérimaires, préparation des demandes de confirmation.
- **Envoi des demandes de confirmation** : début janvier 2026 (étape automatique déclenchée par le joueur à l'intérim).
- **Final** : 23/02 au 13/03/2026.
- **Synthèse** : réunion avec la DAF le 17/03, avec le DG le 19/03 ; arrêté des comptes le 26/03/2026.
- **Rapport** : signature au plus tard le 20/05/2026 (AG du 18/06/2026). Les événements postérieurs sont suivis jusqu'à la signature.
- **Budget** : 340 heures (senior 140 h, Léa 110 h, Hugo 90 h). Exécuter toutes les procédures possibles demanderait environ 450 h. Dépassement toléré jusqu'à 10 % ; au-delà, arbitrage imposé par l'associée, avec perte de confiance si le dépassement n'est pas justifié par un risque significatif documenté.

### 4.7 Seuils de référence

- **Seuil de signification** : 580 k€ (≈ 1,25 % des loyers). Plage jugée appropriée : 470 à 700 k€ (1 % à 1,5 % des loyers), avec justification écrite obligatoire.
- **Seuil de planification** : 60 à 75 % du seuil de signification ; référence 375 k€ (≈ 65 %), justifiée par le changement de DAF, la migration et les constats de l'ANCOLS.
- **Seuil des anomalies manifestement insignifiantes** : 3 à 5 % du seuil de signification ; référence 29 k€.
- Retour pédagogique : un seuil assis sur les capitaux propres ou le total du bilan aboutit à plusieurs millions d'euros, inadapté ; un seuil assis sur le résultat net est instable (plus-values de cession, quote-part de subventions) ; un seuil spécifique plus bas peut être retenu pour les conventions réglementées.

---

## 5. Catalogue des anomalies (clé de correction)

Conventions : « Impact » = effet sur le résultat de la correction, exprimé comme surévaluation du résultat présenté (« + » = résultat présenté trop élevé). L'ESH étant exonérée d'impôt sur les sociétés pour ses activités de service d'intérêt économique général, pas d'effet d'impôt. Chaque anomalie précise ses indices (§9), la procédure efficace qui la révèle, l'attitude du client en négociation et le contenu du débrief. Étoiles = difficulté.

### A01 — Programme livré resté en immobilisations en cours ★★
- **Situation** : Les Tilleuls réceptionnés le 30/06/2025, 52 baux prenant effet en juillet ; le programme est toujours en immobilisations en cours (9,55 M€) au 31/12/2025 : pas de mise en service par composants, pas d'amortissement, pas de reprise des subventions (1 396 k€ : État 286 k€, communauté d'agglomération 520 k€, région 410 k€, Action Logement 180 k€).
- **Indices** : PV de réception ; quittancement du programme dès juillet (état de quittancement par programme) ; fiche de situation financière et comptable de l'opération indiquant « livrée » ; invitation à l'inauguration de septembre ; tableau des immobilisations sans mise en service correspondante.
- **Détection** : rapprochement programmes quittancés / programmes en service au registre ; revue des immobilisations en cours.
- **Correction** : ventilation par composant (structure 62 % sur 50 ans ; menuiseries extérieures 7 % / 25 ans ; chauffage 9 % / 25 ; étanchéité 4 % / 25 ; ravalement-ITE 6 % / 20 ; électricité 6 % / 25 ; plomberie-sanitaires 6 % / 25 — durées paramétrables selon la politique de l'organisme) ; amortissement prorata temporis à compter du 01/07 (≈ 120,1 k€) ; reprise des subventions au rythme des amortissements (≈ 19,8 k€). **Impact ≈ +100 k€** ; reclassement de 9,55 M€ au bilan et dans le tableau des immobilisations.
- **Client** : accepte (« oubli lié à la migration »).

### A02 — Composant remplacé non sorti de l'actif ★★
- **Situation** : aux Érables, la chaufferie collective (composant brut 1 050 k€, mis en service le 01/01/2008, 25 ans) est remplacée par une PAC mise en service le 30/06/2025 (nouveau composant correctement immobilisé). L'ancien composant reste à l'actif et est amorti sur l'année entière (42 k€).
- **Indices** : registre des immobilisations avec deux composants « chauffage » actifs sur le même programme ; facture mentionnant la dépose et l'évacuation de l'ancienne chaufferie ; tableau des immobilisations sans aucune sortie hors cessions alors que le plan de travaux comporte des remplacements.
- **Correction** : amortissement jusqu'au 30/06 (≈ 20,8 k€), puis sortie de la valeur nette comptable (≈ 315,2 k€). **Impact +294 k€** (charge correcte 336 k€ − charge comptabilisée 42 k€).
- **Client** : accepte. Si le joueur demande l'extension de la revue aux autres remplacements 2025, la réponse est « aucun autre cas significatif » et la démarche rapporte des points (réflexe NEP 450).

### A03 — Vente HLM comptabilisée avant l'acte authentique ★★ (individuellement significative)
- **Situation** : 7 pavillons du Clos Fleuri vendus à leurs locataires ; promesses signées le 12/12/2025 ; actes authentiques signés le 14/01/2026. La cession est comptabilisée au 31/12/2025 : produit 1 060 k€ (créance sur le notaire), sortie des valeurs nettes comptables 289,5 k€.
- **Indices** : actes datés du 14/01/2026 ; versement du notaire au relevé bancaire du 20/01/2026 ; loyers des 7 logements encore quittancés en décembre 2025 ; réponse du notaire à la demande de confirmation ; clause des promesses (« transfert de propriété et de jouissance à la signature de l'acte authentique ») et condition suspensive d'obtention de prêt levée le 05/01/2026.
- **Correction** : annulation de la cession en 2025 (produit, valeurs comptables, créance) et réintégration des biens. **Impact +770,5 k€**. Événement postérieur à mentionner : la cession relève de 2026.
- **Client** : la DAF conteste en invoquant l'article 1583 du Code civil (la vente est parfaite dès l'accord sur la chose et le prix). Elle cède si le joueur produit la clause de transfert différé **et** la date de levée de la condition suspensive.

### A04 — Démolition décidée sans révision du plan d'amortissement ★★★
- **Situation** : le CA du 18/06/2025 (point 7 d'un PV de 14 pages) décide la démolition du bâtiment B des Glycines (72 logements) dans le cadre du NPNRU ; avenant à la convention ANRU signé le 09/10/2025 ; relogements engagés dès septembre ; démolition prévue au 4e trimestre 2027. Aucune révision du plan d'amortissement.
- **Données** : valeur nette comptable au 30/06/2025 = 2 400 k€ (dotation normale 120 k€/an) ; subventions non encore reprises = 450 k€ (reprise normale 22,5 k€/an).
- **Indices** : PV du CA ; avenant ANRU ; état de la vacance (logements « neutralisés pour démolition ») ; délibération sur le plan de relogement ; entretien avec la directrice du patrimoine.
- **Correction** : amortissement de la valeur nette résiduelle sur la durée restant à courir jusqu'au 31/12/2027 (914 jours à compter du 01/07/2025) : dotation du 2e semestre ≈ 483,2 k€ au lieu de 60,5 k€ (+422,7 k€) ; reprise accélérée des subventions ≈ 90,6 k€ au lieu de 11,3 k€ (+79,2 k€). **Impact ≈ +343 k€**.
- **Client** : le DG conteste (« tant que les financements ANRU ne sont pas notifiés, rien n'est certain »). Il cède sur présentation du PV, de l'avenant et de l'engagement des relogements.
- **À valider** (`docs/points-a-verifier.md`) : traitement de référence (révision prospective du plan d'amortissement) versus approche par dépréciation ; le jeu accorde un crédit partiel à une approche par dépréciation dûment justifiée.

### A05 — Reprise de PGE sans contrepartie de travaux ★★★ (individuellement significative)
- **Situation** : reprise de 2,67 M€ alors que les dépenses de gros entretien provisionnées et réalisées en 2025 s'élèvent à 1,89 M€. L'écart de 780 k€ correspond à deux opérations (ravalement des Acacias en 2026, étanchéité du Belvédère en 2027) retirées du fichier de calcul de la DAF (`PPE_v3_DAF.xlsx`) comme « reportées », alors que le PPE officiel de la direction du patrimoine (15/11/2025) et le budget 2026 voté par le CA du 16/12/2025 les maintiennent.
- **Indices** : les deux versions du PPE ; budget 2026 et PV du CA de décembre ; tableau des provisions ; entretien avec la directrice du patrimoine (« ces travaux n'ont jamais été décalés ») ; mail de la DAF au chef comptable du 28/01/2026 (« on est loin de l'objectif, vois ce qui peut être décalé sur la PGE »), accessible seulement si Karim se confie.
- **Correction** : annulation de la reprise excédentaire. **Impact +780 k€** (estimation biaisée, NEP 540).
- **Client** : refus ferme du DG (« politique patrimoniale, le plan sera révisé en 2026 »). Bascule uniquement si le PPE officiel, le budget voté et le PV de décembre sont liés au constat **et** si l'associée est impliquée. Sinon, anomalie non corrigée supérieure au seuil → réserve pour désaccord attendue.

### A06 — Dépenses d'entretien immobilisées ★
- **Situation** : « travaux d'amélioration » des Peupliers immobilisés pour 460 k€ (mise en service le 01/09/2025, amortis sur 15 ans), dont 378 k€ relèvent de l'entretien : peinture des cages d'escalier (196 k€), remplacement ponctuel de robinetterie (58 k€), réparation de toiture après infiltrations (124 k€). Le solde (82 k€, remplacement de portes palières) est un remplacement de composant légitime.
- **Indices** : libellés des factures ; référence « programme d'entretien 2025 » sur les bons de commande ; politique d'immobilisation décrite dans l'annexe ; composant « agencements divers 15 ans » absent de la nomenclature de composants de l'organisme.
- **Détection** : test des acquisitions par échantillonnage. Piège : l'échantillon d'Hugo (T2) ne retient que les acquisitions supérieures à 500 k€.
- **Correction** : reclassement en charges de 378 k€ et extourne de l'amortissement correspondant (≈ 8,4 k€). **Impact ≈ +370 k€** ; CAF surévaluée de 378 k€.
- **Client** : accepte après lecture des factures.

### A07 — Dépréciation des créances locatives insuffisante ★★ (individuellement significative)
- **Situation** : méthode décrite dans l'annexe, inchangée depuis plusieurs exercices : ex-locataires dépréciés à 100 % du solde net des dépôts de garantie conservés ; locataires présents à 50 % au-delà de 6 mois d'ancienneté ; 100 % pour les dossiers en procédure et en surendettement. En 2025 : (a) taux ramené à 85 % sur les ex-locataires (base nette 3 115 k€) au motif d'un nouveau prestataire de recouvrement amiable ; (b) dossiers de rétablissement personnel avec effacement (238 k€) traités comme « présents de plus de 6 mois » à 50 %. Présentation : soldes créditeurs de locataires (910 k€) compensés avec les soldes débiteurs.
- **Indices** : fichier de calcul de la dépréciation ; note de méthode de l'annexe ; statistiques de recouvrement des ex-locataires (≈ 4 % par an sur 2023-2025) ; premier rapport du prestataire (1,2 % recouvré) ; décisions de la commission de surendettement ; balance âgée faisant apparaître les soldes créditeurs.
- **Correction** : (a) +467,25 k€ ; (b) passage en perte des créances effacées (238 k€) et reprise de la dépréciation existante (119 k€), soit +119 k€. **Impact +586,25 k€**. Reclassement des soldes créditeurs au passif (910 k€). Tolérance pour (a) : 342 à 467 k€ si le joueur retient un taux fondé sur le recouvrement historique, dûment justifié.
- **Client** : accepte (b) d'emblée, conteste (a) ; cède sur présentation des statistiques de recouvrement, du rapport du prestataire et de la note de méthode.
- **Piège d'équipe** : T3.

### A08 — ICNE calculés à un taux forfaitaire erroné ★★ (sens inverse)
- **Situation** : les intérêts courus non échus des prêts indexés sur le Livret A ont été calculés avec un taux unique de 3,0 % au lieu du taux propre à chaque prêt depuis sa dernière échéance (Livret A en vigueur à la date de révision + marge propre à chaque produit).
- **Indices** : revue analytique des frais financiers (baisse d'environ 10 % alors que le Livret A moyen baisse d'environ 28 %) ; état de la dette (taux et dates d'échéance par prêt) ; réponse de la Banque des Territoires ; fichier de calcul des ICNE.
- **Correction** : recalcul prêt par prêt. **Impact ≈ −236 k€** (résultat présenté sous-évalué), calibré par le générateur (± 10 %) à partir de l'échéancier réel des prêts.
- **Pédagogie** : une anomalie favorable se corrige aussi ; elle ne se « compense » pas silencieusement avec les autres.
- **Client** : accepte avec enthousiasme.

### A09 — Subvention à recevoir devenue caduque ★★
- **Situation** : 420 k€ de subvention départementale (réhabilitation thermique des Charmes) inscrits en créance. L'arrêté attributif du 12/03/2021 prévoit la caducité si les travaux ne commencent pas dans un délai de 3 ans ; l'ordre de service date du 02/06/2025 ; un courrier de caducité du Département du 10/10/2025 a été classé sans suite au courrier arrivé.
- **Indices** : arrêté attributif (clause de caducité) ; ordre de service ; courrier de caducité ; réponse du Département à la demande de confirmation ; plan de financement de l'opération non mis à jour.
- **Correction** : annulation de la créance et de la subvention d'investissement (capitaux propres −420 k€) ; mise à jour du plan de financement. Impact sur le résultat nul (travaux non achevés).
- **Client** : accepte, inquiet pour le financement de l'opération.

### A10 — Charges non récupérables intégrées à la régularisation des charges ★★★
- **Situation** : le produit à recevoir sur la régularisation des charges 2025 inclut les honoraires du syndic de la copropriété des Marronniers (96 k€) et 100 % de la rémunération de 14 gardiens (632 k€) au lieu de la quote-part récupérable applicable (75 % lorsque le gardien assure à la fois l'entretien des parties communes et l'élimination des rejets — **à vérifier**, décret n° 82-955 modifié), soit +158 k€.
- **Indices** : état de régularisation par programme ; liste réglementaire des charges récupérables (mémo) ; courrier de l'association de locataires contestant la régularisation 2024 ; rapport ANCOLS de 2022 ; fiches de poste des gardiens.
- **Correction** : réduction du produit à recevoir. **Impact +254 k€** ; irrégularité à porter à la connaissance du CA ; risque de contentieux locatif.
- **Client** : la DAF accepte pour le syndic, conteste pour les gardiens ; cède sur présentation des fiches de poste et du texte.

### A11 — Produit à recevoir fictif saisi après la clôture ★★★ (indice de fraude)
- **Situation** : écriture d'opérations diverses datée du 31/12/2025, validée le 03/02/2026 par l'utilisateur NFERRAND : débit « produits à recevoir », crédit « produits des activités annexes », 300 000,00 €, libellé « Régul PAR refacturation frais de gestion foyers 2025 », sans référence de pièce.
- **Indices** : dans le FEC, date de validation postérieure à la clôture, montant rond, couple de comptes inhabituel, utilisateur DAF, pièce absente. Documents : conventions avec les gestionnaires de foyers (aucune clause de refacturation) ; réponses des gestionnaires aux demandes de confirmation (« aucune somme due à ce titre » ; pas de réponse d'Accueil Horizons) ; « note de calcul » fournie a posteriori par la DAF ; mail de la DAF au chef comptable du 30/01/2026 (« on est à 8,9 M€, il faut sécuriser les 9 M€ : passe une PAR de 300 k€ sur les foyers, je fournirai le justificatif »), accessible uniquement si Karim se confie.
- **Bonne conduite attendue** : ne pas confronter la DAF seul à chaud ; documenter ; alerter immédiatement l'associée ; réévaluer le risque de fraude et la fiabilité des déclarations de la direction ; étendre les tests d'écritures ; communiquer avec la gouvernance (NEP 240 et 260). L'éventuelle révélation de faits délictueux au procureur de la République (C. com., art. L. 823-12) est instruite par l'associée avec le département technique : le jeu évalue l'escalade et la documentation, pas une conclusion juridique.
- **Correction** : extourne. **Impact +300 k€** ; CAF surévaluée de 300 k€.
- **Client** : la DAF invoque une « erreur d'interprétation » et extourne quand les preuves sont posées sur la table.

### A12 — Avance à l'ESH sœur : engagement hors bilan et convention réglementée ★★★
- **Situation** : convention de soutien financier du 01/09/2025 avec Coteaux du Serein Habitat (même groupe, administrateur commun) : avance en compte courant plafonnée à 3,5 M€, sans intérêt ; 1,5 M€ versés le 15/09/2025. (i) Le solde non tiré de 2,0 M€ est absent des engagements hors bilan ; (ii) la convention n'a pas été autorisée préalablement par le CA alors qu'elle n'est pas conclue à des conditions normales (taux zéro) → mention au rapport spécial (C. com., art. L. 225-38 et L. 225-42) ; (iii) la déclaration préalable de l'avance au titre du CCH (art. L. 423-15) n'est pas justifiée — à demander.
- **Indices** : relevé bancaire (virement de 1,5 M€) ; prêt en immobilisations financières ; convention au dossier juridique ; PV des CA (aucune autorisation) ; composition des CA des deux ESH ; réponse de l'ESH sœur.
- **Correction** : information en annexe (engagement donné de 2,0 M€, transaction avec une partie liée) ; rapport spécial ; signalement de l'irrégularité. Impact sur le résultat nul ; recouvrabilité de l'avance à documenter (soutien de la société de tête).
- **Client** : le DG minimise (« opération de groupe ») ; accepte l'information en annexe si l'associée insiste.

### A13 — Engagements de fin de carrière omis dans l'annexe ★
- **Situation** : l'organisme ne provisionne pas ses indemnités de fin de carrière (option permise), mais doit en mentionner le montant en annexe ; l'annexe 2025 l'omet (2024 : 1,55 M€ ; rapport actuariel 2025 : 1,62 M€).
- **Indices** : comparaison des annexes 2024 et 2025 ; rapport actuariel dans la GED.
- **Correction** : compléter l'annexe. **Client** : accepte.

### A14 — Rapport de gestion : informations inexactes ★★ (NEP 9510)
- **Situation** : (i) le tableau des délais de paiement fournisseurs indique 0 facture échue non réglée alors que la balance âgée fait apparaître 312 factures échues pour 1,42 M€ ; (ii) taux de vacance annoncé de 2,1 % contre 3,4 % selon les données de gestion ; (iii) ratio d'autofinancement net à mettre à jour après corrections.
- **Correction** : rectification du rapport de gestion ; à défaut, mention dans la partie « vérifications spécifiques » du rapport sur les comptes.
- **Client** : accepte (i) et (iii) ; hésite sur (ii) (« notre définition exclut la vacance technique ») ; cède si le joueur montre que la définition n'est pas précisée et diffère de celle de N-1.

### A15 — Gestionnaire de foyer en redressement judiciaire (événement postérieur) ★★
- **Situation** : Accueil Horizons doit 9 mois de redevances (585 k€) au 31/12/2025 ; aucune dépréciation. Jugement d'ouverture d'un redressement judiciaire le 24/02/2026 ; courrier du mandataire du 15/03/2026 (passif déclaré ≈ 2,1 M€, actif réalisable ≈ 0,4 M€ : perspective de recouvrement d'environ 20 % pour les créanciers chirographaires).
- **Indices** : balance âgée (9 mois impayés) ; absence de réponse à la demande de confirmation ; courrier du mandataire (courrier arrivé 2026) ; article de presse locale ; réponse évasive de la DAF sur les événements postérieurs.
- **Correction** : événement postérieur apportant des informations sur une situation existant à la clôture (NEP 560) → dépréciation de 80 %. **Impact +468 k€**. Déclaration de créance dans les délais ; information en annexe.
- **Client** : la DAF (« ils ont toujours fini par payer ») cède sur présentation du courrier du mandataire.

### A16 — Litige avec l'entreprise générale des Tilleuls ★★★
- **Situation** : assignation de novembre 2025 : l'entreprise réclame 210 k€ de travaux supplémentaires (ordre de service n° 7 signé par le maître d'œuvre et la maîtrise d'ouvrage) et conteste 340 k€ de pénalités de retard retenues. Rien n'est comptabilisé ni mentionné.
- **Indices** : réponse de l'avocate (travaux supplémentaires dus ; pénalités « sérieusement contestables, issue incertaine ») ; ordre de service n° 7 ; registre des contentieux incomplet.
- **Correction** : dette fournisseur d'immobilisations de 210 k€ en contrepartie du coût du programme — pas en charges ; information en annexe sur le passif éventuel (340 k€). Impact sur le résultat ≈ 3 k€ (amortissement du 2e semestre, sous le seuil des anomalies insignifiantes).
- **Pédagogie** : toute dette n'a pas une contrepartie en charges.
- **Client** : accepte.

### A17 — Hausse de loyers supérieure au plafond légal ★★
- **Situation** : le CA du 15/10/2024 a voté une hausse de 3,50 % au 01/01/2025 (« plafond légal » : confusion avec le plafonnement de l'IRL à 3,5 %, qui a pris fin au 1er trimestre 2024) alors que la hausse des loyers des logements conventionnés est limitée à la variation de l'IRL du 2e trimestre 2024 (+3,26 %). Aucune dérogation (ni plan de redressement CGLLS, ni réhabilitation ouvrant droit à un dépassement).
- **Indices** : PV du CA d'octobre 2024 ; comparaison des quittances de décembre 2024 et janvier 2025 sur un échantillon ; note interne de la gestion locative ; référence IRL au mémo.
- **Correction** : dette de restitution envers les locataires ≈ 98 k€ (recalculée par le moteur à partir du quittancement) ; irrégularité à signaler ; régularisation des quittances.
- **Client** : le DG préfère « régulariser sur 2026 sans écriture » ; cède si le joueur démontre l'existence d'une obligation à la clôture.
- **Piège d'équipe** : T4.

### A18 — Prêt encaissé en compte d'attente ★
- **Situation** : prêt de haut de bilan de 2,5 M€ (conditions fictives : taux nul pendant 20 ans) versé le 15/12/2025 et comptabilisé au crédit d'un compte d'attente ; la Banque des Territoires confirme un capital restant dû de 307,5 M€ contre 305,0 M€ en comptabilité.
- **Indices** : réponse de la Banque des Territoires ; relevé bancaire (virement rond) ; compte d'attente créditeur à la clôture ; état des dettes de l'annexe.
- **Correction** : reclassement en emprunts ; mise à jour de l'état des dettes. Impact sur le résultat nul.
- **Piège d'équipe** : T1. Note : l'écriture ronde du 15/12 ressemble à une piste de fraude ; l'opération est légitime, seule son imputation est erronée.

### A19 — Écart entre l'auxiliaire locataires et la comptabilité générale ★
- **Situation** : écart inexpliqué de 52,3 k€ entre l'auxiliaire LOGIGES et les comptes de locataires : doublon du lot d'interface de quittancement d'octobre 2025 (Les Saules) lors de la migration.
- **Indices** : rapprochement auxiliaire / générale ; journal d'interface d'octobre (deux lots identiques) ; note de migration.
- **Correction** : extourne du doublon. **Impact +52,3 k€** ; faiblesse de contrôle interne (absence de rapprochement mensuel) → lettre de recommandations.

### A20 — Facture du GIE non provisionnée ★★
- **Situation** : le GIE Altaïr Services facture le 20/01/2026 un « complément de frais de structure 2025 » de 184 k€, non provisionné au 31/12/2025.
- **Indices** : revue des factures reçues et des décaissements de janvier-février 2026 ; réponse du GIE à la demande de confirmation ; convention de groupe (clé de répartition avec complément de fin d'année).
- **Correction** : charge à payer. **Impact +184 k€** ; transaction avec une partie liée.

### A21 — Erreur de report dans l'annexe ★
- **Situation** : tableau des provisions : dotation aux dépréciations des créances de 1 245 k€ au lieu de 1 425 k€ (inversion de chiffres) ; total du tableau non rapproché de la balance.
- **Détection** : pointage de l'annexe sur la balance.

### A22 — Comparatif N-1 modifié et classement erroné des dépôts de garantie ★★
- **Situation** : les dépôts de garantie reçus des locataires (3,72 M€ en N ; 3,61 M€ en N-1) sont présentés en « autres dettes » au lieu de la rubrique des dettes financières du modèle, y compris dans la colonne N-1, qui ne concorde donc plus avec les comptes certifiés 2024 ; aucune information en annexe.
- **Détection** : pointage de la colonne N-1 sur les comptes certifiés 2024 annexés au rapport du CAC de l'exercice précédent ; contrôle du passage balance → états.
- **Correction** : rétablir le classement en N et en N-1.

### Synthèse de référence (calculée par le moteur, affichée au débrief)

- Surévaluations du résultat ≈ +4,60 M€ ; sous-évaluation (A08) ≈ −0,24 M€ ; net ≈ +4,37 M€ → résultat corrigé ≈ 4,83 M€.
- Individuellement supérieures au seuil de signification (580 k€) : A03, A05, A07. A15 est comprise entre le seuil de planification et le seuil de signification.
- Autofinancement net HLM surévalué d'environ 1,27 M€ (A06, A07-b, A08, A10, A11, A17, A19, A20 ; montant exact selon la convention paramétrée) → ratio 2025 ≈ 2,6 % au lieu de 5,2 % ; moyenne sur trois ans sous le taux de référence par défaut.

---

## 6. Fausses pistes

À rendre aussi crédibles que les vraies anomalies. Une fausse piste écartée avec preuves rapporte des points ; signalée à tort, elle coûte des points, de la relation client et de la confiance de l'associée.

- **F1** — Honoraires +55 % : études NPNRU et actualisation du plan stratégique de patrimoine, contrats et délibérations à l'appui.
- **F2** — Produit à recevoir sur dégrèvement de TFPB pour travaux d'économie d'énergie : réclamation déposée le 15/12/2025, historique d'acceptation, dégrèvement notifié en mars 2026 à 98 % du montant → écart négligeable.
- **F3** — Charges de personnel +7,8 % : NAO, prime de partage de la valeur, cinq recrutements de gardiens, postes vacants pourvus.
- **F4** — Fournisseur « Bâti-Rénov Est » dont le gérant porte le même nom que la directrice du patrimoine : aucun lien de parenté ; marché attribué après mise en concurrence (4 offres, moins-disant). Accuser sans preuve dégrade fortement la relation client.
- **F5** — TFPB +7,7 % : revalorisation forfaitaire des bases et fin de périodes d'exonération sur plusieurs programmes (tableau fiscal à l'appui).
- **F6** — Rapprochement bancaire : 38 k€ de règlements émis non débités, tous dénoués début janvier.
- **F7** — Écritures du week-end des 27 et 28/09/2025 saisies par l'utilisateur MIGRATION : reprise des soldes, rapprochée et signée.

---

## 7. Revue des travaux de l'équipe

Quand le joueur délègue une procédure, Léa ou Hugo produisent une feuille de travail que le joueur doit revoir (accepter, ou renvoyer avec un commentaire). Erreurs scénarisées :

- **T1** (Léa) — Confirmation de la Banque des Territoires : écart de 2,5 M€ conclu « décalage de calendrier, RAS » → A18.
- **T2** (Hugo) — Test des acquisitions : échantillon limité aux cinq acquisitions supérieures à 500 k€, conclusion étendue à toute la population → à rejeter ; l'élargissement de l'échantillon rend A06 détectable.
- **T3** (Léa) — Dépréciation des créances : elle a « recalculé » le fichier du client sans le confronter à la méthode de l'annexe ni à l'historique de recouvrement → A07.
- **T4** (Hugo) — Test des loyers : vérifie la concordance entre quittances et états de quittancement, pas le respect du plafond de hausse → A17.

Hors T1 à T4, les travaux délégués sont corrects : tout est déterministe et figure dans la clé. Renvoyer un travail correct sans motif coûte du budget et de la confiance.

---

## 8. Éthique et indépendance

- **E1** — Le DG propose deux places en loge pour un match de rugby → refuser (règles déontologiques sur les cadeaux et avantages). Accepter = pénalité lourde.
- **E2** — La DAF demande au senior de « préparer les tableaux de l'annexe » faute de temps → refuser (risque d'autorévision, services interdits) ; commenter un projet établi par l'entité reste possible.
- **E3** — Le manager propose de « passer la PGE en revue légère » faute de budget → refuser et porter le sujet à l'associée (risque significatif).
- **E4** — La présidente de l'association de locataires contacte directement l'auditeur → l'écouter, ne rien divulguer (secret professionnel), exploiter l'information.
- **E5** — Le DG laisse entendre que le renouvellement du mandat dépend d'un rapport « sans histoires » → menace d'intimidation, à documenter et à remonter à l'associée.
- **Bonus** — Karim se confie (A05, A11) : protéger la source autant que possible, documenter, escalader.

---

## 9. Documents

Chaque document est un modèle alimenté par les données (dates, montants et noms cohérents), rendu de façon réaliste (en-tête, références, signatures stylisées, tampon « Reçu le »), consultable, cherchable, annotable, et peut être lié comme élément probant. Certains documents ne sont communiqués que sur demande précise (liste de demandes et relances), d'autres arrivent avec un délai (réponses de tiers), d'autres ne sont jamais fournis spontanément.

Liste minimale, environ 70 documents dont un quart de « bruit » réaliste :

- **Dossier permanent** : statuts (extraits), extrait Kbis, organigramme, composition des CA des deux ESH, CUS (extraits), plan stratégique de patrimoine, rapport ANCOLS 2022 (extraits), lettre de mission, déclarations d'indépendance, comptes certifiés 2024 et rapport du CAC 2024.
- **Gouvernance** : PV des CA 2025 (mars, juin [A04, 14 pages], septembre, décembre [budget 2026, PPE]), PV du CA d'octobre 2024 [A17], PV de l'AG 2025, registre des conventions.
- **Comptabilité** : balance N/N-1, grand livre, FEC, projets d'états financiers, d'annexe et de rapport de gestion, tableau des immobilisations, registre des composants, tableau des subventions, état de la dette, calcul des ICNE, tableau des provisions, calcul de la PGE et deux versions du PPE, calcul de la dépréciation des créances et balance âgée, état des ventes HLM avec promesses et actes, fiches de situation financière et comptable des opérations, rapprochements bancaires, état des charges à payer, produits à recevoir et charges constatées d'avance, rapport actuariel, régularisation des charges par programme, états de quittancement (décembre 2024, janvier 2025), rapport de vacance, rapprochement RLS/APL, avis de TFPB et réclamation de dégrèvement, journal de migration.
- **Contrats et pièces** : conventions avec les gestionnaires de foyers, convention de groupe avec le GIE, convention de soutien avec l'ESH sœur, au moins 40 factures (dont celles des Peupliers et des Érables), situations de travaux, PV de réception des Tilleuls, ordre de service n° 7, arrêté attributif et ordre de service des Charmes, avenant ANRU, rapports du prestataire de recouvrement, statistiques de recouvrement, fiches de poste des gardiens, tableau des exonérations de TFPB.
- **Courrier** : lettre de caducité du Département, courrier du mandataire judiciaire (2026), lettre de l'association de locataires, article de presse locale.
- **Échanges internes** : sélection de mails, dont ceux de la DAF (accessibles sous condition).
- **Réponses de tiers** (arrivent en jeu) : banques et Banque des Territoires, notaire, avocate, Département, gestionnaires de foyers, ESH sœur, GIE.

---

## 10. Game design détaillé

### 10.1 Boucle et phases

1. Acceptation et maintien de la mission, indépendance.
2. Prise de connaissance : lectures, entretiens, revue analytique préliminaire.
3. Seuils (NEP 320), avec justification écrite.
4. Évaluation des risques (NEP 315, 240, 250) : le joueur identifie les risques d'anomalies significatives par cycle et par assertion. Il se prononce sur le risque de fraude dans la comptabilisation des produits (présomption à documenter ; formulation exacte de la NEP 240 **à vérifier**) : défendable à réfuter pour le quittancement récurrent, pas pour les produits non récurrents ou de fin d'exercice. Le risque de contournement des contrôles par la direction est toujours retenu.
5. Programme de travail (NEP 300 et 330) : choix des procédures par cycle, affectation aux membres de l'équipe, budget prévisionnel.
6. Intérim : contrôle interne (prises de connaissance des procédures, tests de contrôles, revue SI de la migration), préparation des demandes de confirmation.
7. Final : contrôles de substance, confirmations, tests d'écritures, pointage, événements postérieurs, revue des travaux de l'équipe.
8. Synthèse : tableau des anomalies, négociation, lettre d'affirmation (NEP 580), communications (NEP 260 et 265), opinion et rapports.
9. Débrief.

### 10.2 Ressources et jauges

- **Heures** par membre de l'équipe (§4.6). Chaque action a un coût ; le senior est plus rapide sur les tâches techniques mais ses heures sont les plus rares.
- **Horloge de jeu** par phase ; délais de réponse des interlocuteurs (chef comptable 1 jour, DAF 2 jours, patrimoine 3 jours, tiers 5 à 15 jours) ; relances possibles.
- **Relation client** (0-100, départ 70) : baisse en cas d'accusation infondée, de demandes inutiles répétées ou de ton agressif ; en dessous de 30, les délais s'allongent et les réponses s'appauvrissent.
- **Confiance de l'associée** (0-100, départ 60) : hausse avec des remontées pertinentes et anticipées ; baisse avec les surprises tardives, les dépassements injustifiés et les erreurs de revue.
- **Confiance de Karim** (jauge individuelle) : entretiens en tête-à-tête, respect, absence de mise en cause publique ; débloque ses confidences.
- Le risque d'audit résiduel est calculé en interne et révélé seulement au débrief.

### 10.3 Bibliothèque de procédures (environ 60)

Chaque procédure : intitulé, objectif, assertions couvertes, coût en heures par profil, prérequis, sorties (données, documents, vues). Par cycle, par exemple :

- **Transverse** : lecture du dossier permanent et des PV, entretiens, revue analytique, tests d'écritures sur le FEC, pointage des états et du comparatif, événements postérieurs, rapport de gestion, conventions réglementées, lettre d'affirmation.
- **Loyers et créances** : prise de connaissance du quittancement, revue analytique des loyers (prévisionnel / réel par programme), test de la hausse des loyers, rapprochement auxiliaire / générale, revue de la balance âgée, recalcul de la dépréciation, test RLS/APL, régularisation des charges.
- **Immobilisations et investissements** : revue des opérations en cours et des mises en service, test des acquisitions (échantillonnage), test des sorties et des composants remplacés, recalcul des amortissements, revue des cessions et de la séparation des exercices, revue des subventions (notifications, caducité).
- **Provisions** : PGE contre PPE, litiges et lettres d'avocats, engagements de retraite.
- **Dettes financières et trésorerie** : état de la dette, confirmations, recalcul des ICNE, rapprochements bancaires.
- **Achats et charges** : recherche de passifs non comptabilisés, charges à payer, conventions de groupe.

### 10.4 Outils

- **Balance interactive** : N et N-1, variations en euros et en pourcentage, filtres, navigation vers le grand livre.
- **Explorateur de grand livre et de FEC** : filtres combinables (journal, compte, utilisateur, date de saisie ou de validation, week-end, montants ronds, mots-clés, couples de comptes rares), requêtes sauvegardées, export. Les tests d'écritures doivent être une vraie activité d'analyse.
- **Pointage** : cocher chaque ligne des états et de l'annexe contre la balance, et la colonne N-1 contre les comptes certifiés 2024, avec des marques de pointage personnalisables.
- **Revue analytique** : tableaux et graphiques (variations, ratios OLS : autofinancement net, annuités / loyers, vacance, impayés, coût de gestion par logement).
- **Échantillonnage** : aléatoire, systématique, par strates, par unités monétaires ; seed affichée ; taille calculée.
- **Recalculs** : amortissements par composant, ICNE par prêt, dépréciation des créances, PGE, prorata temporis.
- **Confirmations** : choix des tiers, contenu, envoi, relances, réception et analyse ; procédures alternatives en cas de non-réponse.
- **Demandes de documents** et relances.
- **Feuilles de travail** : feuille maîtresse par cycle (N, N-1, variation, références des travaux, conclusion).
- **Mémo réglementaire** consultable avec recherche.

### 10.5 Entretiens et confrontation

- Interface de dialogue avec portrait, humeur et historique.
- Les questions se débloquent selon les documents lus, les données consultées et les constats ouverts.
- **Confrontation** : pendant un entretien, le joueur peut présenter une pièce (document, ligne de FEC, calcul). Pièce pertinente → le personnage concède, nuance ou révèle ; pièce hors sujet → perte de crédibilité.
- Insister fait parfois bouger un personnage, mais coûte de la relation client.

### 10.6 Constats et appariement à la clé

- Le joueur crée un **constat structuré** : cycle ; objet (programme, tiers, compte, document, choisis dans des listes) ; nature (réalité, exhaustivité, séparation des exercices, évaluation, classement, présentation, conformité) ; classification (factuelle, de jugement, extrapolée) ; impacts proposés (résultat, capitaux propres, bilan) ; écriture de correction proposée ; pièces liées ; statut.
- **Appariement sans texte libre** : chaque anomalie expose une signature (cycle, objets, natures) ; le moteur rapproche le constat de la clé ; crédit complet si le montant est dans la tolérance (± 5 % par défaut, plage spécifique pour les estimations), crédit partiel sinon. Un constat qui ne correspond à rien est un faux positif, sauf s'il reste au statut « question ».
- Le **tableau des anomalies** se construit à partir des constats : corrigées ou non, cumul comparé aux seuils, effets sur le résultat, les capitaux propres, la CAF et le ratio d'autofinancement net.

### 10.7 Synthèse, négociation et opinion

- Réunions de synthèse avec la DAF puis le DG. Pour chaque constat, le client applique son profil de négociation (§5). Le joueur peut escalader à l'associée, ce qui coûte de la confiance si son dossier est faible.
- Après négociation, le moteur calcule les anomalies non corrigées et les facteurs qualitatifs : franchissement du taux de référence de l'autofinancement net, indice de fraude, irrégularités.
- **Opinion** (NEP 700) : certification sans réserve, avec réserve (désaccord ou limitation) ou refus de certifier ; observation éventuelle ; justification des appréciations (NEP 702, 2 à 3 sujets à choisir) ; vérifications spécifiques (rapport de gestion, délais de paiement) ; rapport spécial sur les conventions réglementées ; lettre d'affirmation (points spécifiques à choisir) ; communication au conseil d'administration (NEP 260) ; lettre sur les faiblesses du contrôle interne (NEP 265) ; signalement des irrégularités.
- **Évaluation de l'opinion** : comparaison avec l'opinion attendue compte tenu de l'état final (anomalies non corrigées rapportées au seuil du joueur s'il est dans la plage acceptable, sinon au seuil de référence, plus les facteurs qualitatifs). Exemples : A05 non corrigée → réserve pour désaccord attendue ; tout corrigé → sans réserve ; certification sans réserve avec un cumul non corrigé supérieur au seuil → faute grave.
- Génération du **rapport du commissaire aux comptes** rédigé (structure NEP 700 d'une entité qui n'est pas une EIP), imprimable.

### 10.8 Scoring et débrief

Pondérations par défaut (fichier `params/scoring.json`, éditable) :

| Compétence | Poids |
|---|---|
| Planification (seuils, risques, programme) | 15 % |
| Détection et éléments probants (anomalies pondérées par gravité) | 35 % |
| Jugement et quantification | 15 % |
| Supervision de l'équipe (T1 à T4) | 8 % |
| Communication et négociation (corrections obtenues, relation client) | 10 % |
| Éthique et indépendance (E1 à E5, A11) | 7 % |
| Opinion et rapports | 10 % |

Pénalités : faux positifs, accusations infondées, dépassement de budget injustifié, diligences obligatoires omises (événements postérieurs, lettre d'affirmation, tests d'écritures, contrôle du comparatif). Note finale de A à D, présentée comme la revue qualité du dossier rédigée par l'associée (texte généré par règles).

**Débrief** :
- Pour chaque anomalie : trouvée, partiellement trouvée ou manquée ; indices et emplacement ; procédure efficace ; référence ; écriture de correction ; impact.
- Fausses pistes : écartées à juste titre ou signalées à tort.
- Comptes présentés et corrigés côte à côte (bilan, compte de résultat, CAF, ratio).
- Chronologie des actions du joueur ; radar par compétence.

### 10.9 Niveaux de difficulté

- **Assistant** : aides contextuelles (Léa signale des zones à creuser), budget de 400 h, relation client indulgente.
- **Senior** (référence) : 340 h, aides payantes en confiance de l'associée.
- **Manager** : 290 h, aucune aide, délais clients allongés, note de synthèse écrite exigée par l'associée.
- Option, si l'architecture le permet sans compromettre la cohérence des documents : activer un sous-ensemble d'anomalies selon le niveau. Sinon, en V1, toutes les anomalies sont actives.

### 10.10 Mode concepteur (`?designer=1`)

Affiche la clé, active ou désactive les anomalies, avance le temps, débloque tous les documents, montre les écarts présenté / corrigé et vérifie les indices. Indispensable pour que je puisse tester et ajuster le contenu.

---

## 11. Interface

- Esthétique de logiciel d'audit professionnel, sobre, avec une couche de jeu discrète (portraits, notifications, journal de mission). Pas de « gamification » criarde.
- Écrans : accueil (partie, niveau, sauvegardes) ; bureau (agenda, messagerie, jauges, tâches, équipe) ; GED ; balance, grand livre et FEC ; états financiers et pointage ; analyse ; entretiens ; programme et feuilles de travail ; confirmations ; revue de l'équipe ; constats et tableau des anomalies ; synthèse et rapport ; débrief ; mémo réglementaire.
- Navigation par onglets et palette de commandes (Ctrl+K). Thèmes clair et sombre. Optimisé pour un écran de 1280 px et plus, utilisable à 1024 px. Accessibilité : contrastes AA, navigation au clavier, libellés ARIA.
- Messagerie interne pour le rythme : mails de l'associée, du manager, du client et de l'équipe, qui déclenchent les événements.
- Tutoriel des dix premières minutes intégré à la narration (premier mail de l'associée).

---

## 12. Jalons et critères d'acceptation

- **J0 — Plan** : architecture, types, plan détaillé. Validation par moi.
- **J1 — Moteur comptable** : générateur du grand livre propre 2025, à-nouveaux et comptes 2024, dérivés (balance, grand livre, FEC, états, annexe, CAF, ratio), tests d'intégrité, écran de contrôle minimal. Critère : cibles du §4.3 atteintes pour les comptes propres.
- **J2 — Anomalies et contenus** : modules A01 à A22 (patches, indices, clés, impacts calculés), fausses pistes, modèles de documents, paramètres. Critères : invariant `présenté + corrections = propre` ; impacts conformes au §5 ; au moins 2 indices par anomalie. **Arrêt : validation métier.**
- **J3 — Consultation** : bureau, GED, balance, grand livre et FEC, états et pointage, analyse.
- **J4 — Mécanique d'audit** : seuils, risques, programme, procédures, temps et budget, demandes de documents, confirmations, feuilles de travail, constats.
- **J5 — Personnages** : dialogues, confrontation, équipe et revue de travaux, événements éthiques, messagerie.
- **J6 — Synthèse** : négociation, tableau des anomalies, opinion, rapports, scoring, débrief, comptes corrigés.
- **J7 — Finitions** : tutoriel, niveaux, mode concepteur, sauvegardes, accessibilité, build mono-fichier, test de bout en bout (partie complète scriptée en mode concepteur), README utilisateur, `docs/guide-auteur.md`.

**Définition de « terminé » pour la V1** : partie jouable de bout en bout ; aucun montant incohérent ; tous les tests verts ; aucune erreur en console ; build mono-fichier fonctionnel hors ligne.

---

## 13. Extensions (après la V1)

1. **Entretiens en langage naturel** via l'API Claude : fiches personnages (faits, secrets, conditions de révélation), un second appel « arbitre » qui décide si une question débloque un fait, garde-fous contre la fuite de la clé. Clé API fournie par l'utilisateur via un petit proxy local, jamais dans le dépôt.
2. **Dossiers aléatoires** : tirage d'anomalies dans un catalogue, montants et programmes variables, seed partageable, pour la rejouabilité.
3. **Exercice 2026 — première application du nouveau plan comptable OLS** (règlement ANC n° 2025-05) : import d'une table de correspondance ancien → nouveau plan (CSV), états au nouveau format, comparatif retraité, anomalies de transposition (comptes mal reclassés, comparatif non retraité, information insuffisante sur le changement de réglementation).
4. **Autres entités** : OPH, SEM agréée (activité agréée et hors activité agréée), coopérative HLM avec accession (PSLA, VEFA, avancement), SPL d'aménagement.
5. **Co-commissariat** (NEP 100) : répartition des travaux, revue croisée, divergences entre cabinets.
6. **Mode formateur** : parcours pour une équipe, export des résultats, dossier corrigé commenté.
7. **Variante belge** : société immobilière de service public bruxelloise, PCMN, CSA, normes ISA.
8. **Défis courts** : « trois anomalies dans le FEC en 20 minutes », « seuils en 5 minutes ».

---

## Annexe — Amorce du mémo réglementaire

À compléter, sourcer et faire valider ; chaque point incertain est tracé dans `docs/points-a-verifier.md`.

- **NEP mobilisées** : 200, 210, 230, 240, 250, 260, 265, 300, 315, 320, 330, 450, 500, 505, 520, 530, 540, 550, 560, 570, 580, 700, 702, 9510.
- **Code de commerce** : signalement des irrégularités et révélation des faits délictueux (art. L. 823-12) ; conventions réglementées (art. L. 225-38 à L. 225-42) ; informations sur les délais de paiement (art. L. 441-14 et D. 441-6 — à vérifier) ; règles déontologiques (cadeaux, services interdits).
- **Code de la construction et de l'habitation** : autofinancement net HLM (CAF au sens du PCG diminuée des remboursements d'emprunts liés à l'activité locative, hors remboursements anticipés ; ratio rapporté aux produits d'activité hors charges récupérables et aux produits financiers ; taux de référence fixés par arrêté ; obligation de rendre compte et de délibérer en cas de franchissement ; mention dans le rapport de gestion) ; avances en compte courant entre organismes d'un même groupe et déclaration préalable (art. L. 423-15) ; révision des loyers des logements conventionnés au 1er janvier selon l'IRL du 2e trimestre de l'année précédente, avec dépassements possibles seulement en cas de plan de redressement CGLLS ou de réhabilitation ; obligation d'appartenance à un groupe sous 12 000 logements ; RLS.
- **Charges récupérables** : décret n° 82-955 du 9 novembre 1982 modifié — quote-part récupérable de la rémunération des gardiens **à vérifier**.
- **Cadre comptable** : PCG (règlement ANC n° 2014-03) ; règlement ANC n° 2015-04 et instruction comptable OLS applicable en 2025 ; réforme : règlement ANC n° 2025-05 du 5 décembre 2025, applicable aux exercices ouverts à compter du 01/01/2026.
- **Données de marché** : Livret A 3 % jusqu'au 31/01/2025, 2,4 % du 01/02/2025 au 31/07/2025, 1,7 % à compter du 01/08/2025 ; IRL du 2e trimestre 2024 : 145,17 (+3,26 %) ; IRL du 2e trimestre 2025 : 146,68 (+1,04 %), applicable aux révisions du 01/01/2026 ; plafonnement de l'IRL à 3,5 % du 3e trimestre 2022 au 1er trimestre 2024.
- **Décence énergétique** (loi Climat et résilience) : logements classés G non décents pour les baux conclus ou renouvelés depuis le 01/01/2025.
