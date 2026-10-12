# Dossier Val d'Aurelle — Plan J0

> **Statut** : proposition soumise à validation (§0.1 du cahier des charges). Aucun code applicatif n'est écrit avant votre accord. Seuls sont versionnés les **types TypeScript** du modèle de données (projet, compilés en mode strict) et l'annexe de simulation utilisée au §2.2.
>
> Documents liés : [`cahier-des-charges.md`](cahier-des-charges.md) · [`points-a-verifier.md`](points-a-verifier.md) · [`../CLAUDE.md`](../CLAUDE.md) · types : [`src/engine/types.ts`](../src/engine/types.ts), [`src/scenario/types.ts`](../src/scenario/types.ts), [`src/game/types.ts`](../src/game/types.ts) · annexe : [`annexes/simulation-frais-financiers.py`](annexes/simulation-frais-financiers.py)

## Sommaire

1. [Décisions à valider](#1-décisions-à-valider)
2. [Contrôle de cohérence du cahier des charges](#2-contrôle-de-cohérence-du-cahier-des-charges)
3. [Architecture](#3-architecture)
4. [Modèle de données](#4-modèle-de-données)
5. [Moteur comptable et générateur](#5-moteur-comptable-et-générateur)
6. [Contenus du scénario](#6-contenus-du-scénario)
7. [Règles du jeu](#7-règles-du-jeu)
8. [Interface](#8-interface)
9. [Tests et qualité](#9-tests-et-qualité)
10. [Jalons détaillés](#10-jalons-détaillés)
11. [Risques techniques et parades](#11-risques-techniques-et-parades)
12. [Hypothèses et simplifications de la V1](#12-hypothèses-et-simplifications-de-la-v1)

---

## 1. Décisions à valider

Seule D2 est une vraie question : le cahier des charges y est contradictoire. Pour les autres décisions, j'ai retenu l'option la plus simple ; il suffit de les confirmer ou de les corriger.

| # | Sujet | Proposition retenue | Alternative |
|---|---|---|---|
| **D1** | Emplacement du projet | Sous-dossier autonome `dossier-val-aurelle/` du dépôt `Jeux` (son propre `package.json`). Les Olympiades restent intactes à la racine, déploiement Render inchangé. | Dépôt séparé. |
| **D2** | **Calibrage frais financiers / ICNE (A08) / structure de la dette** — incompatibles en l'état (§2.2) | **Option 1** : dette de 365 M€ dont 84 % indexés sur le Livret A, marge moyenne ≈ LA + 0,50 (portefeuille dominé par des PLUS) ; A08 ≈ −236 k€ conservée ; frais financiers ≈ 11,3 M€ en 2024 et ≈ 10,4 M€ en 2025 (présentés). | **Option 2** : conserver les frais financiers à ≈ 9,5 / 8,8 M€ en ramenant la part indexée sur le Livret A à ≈ 64 % (≈ 129 M€ de prêts à taux fixe bas) ; A08 ≈ −232 k€. |
| **D3** | Convention de calcul des impacts | Impact d'une anomalie = effet de ses écritures de correction sur les comptes présentés, dans un **ordre canonique** (A16 après A01). Les comptes « après négociation » sont recalculés exactement en réappliquant au propre les seules anomalies non corrigées (§5.4). | Impacts isolés par rapport au propre (non additifs en cas d'interaction). |
| **D4** | Exercice 2024 | Simulé par **le même générateur** que 2025 : les comptes certifiés 2024 sont des sorties du moteur, pas des saisies. Les exercices 2021-2023 sont réduits à des agrégats paramétrés (tableau des résultats, ratio d'autofinancement net). | Balance 2024 synthétique sans écritures. |
| **D5** | Granularité des écritures | Écritures récapitulatives pour le quittancement (programme × mois), les encaissements (jour × mode) et les amortissements (programme × famille de composants). Écritures unitaires pour les 4 000 factures, la paie mensuelle, les échéances de prêts et les opérations d'inventaire. FEC estimé à ≈ 32 000 lignes. | Plus de détail : FEC plus lourd, sans gain pédagogique. |
| **D6** | Données générées | Non versionnées ; régénérées par `npm run generate` avant `dev`, `test` et `build`. Seule une **empreinte** (`scenario.lock.json` : hash et agrégats clés) est versionnée, et un test bloque toute dérive non voulue. | Versionner les JSON (plusieurs Mo). |
| **D7** | Points de contenu non tranchés (A10 régularisation 2024, A06 portes palières, A19 composition du lot doublé, subventions d'A02 et A03…) | Valeurs par défaut proposées dans `points-a-verifier.md` (PV-29 à PV-40). | — |

---

## 2. Contrôle de cohérence du cahier des charges

### 2.1 Ce qui tombe juste

J'ai recalculé toutes les données chiffrées du §5. Elles sont **exactes** sous deux conventions, que je retiens pour le moteur :

- **prorata temporis en jours exacts / 365** ;
- **reprise des subventions = subvention × dotation / base amortissable hors terrain**.

| Anomalie | Contrôle | Résultat |
|---|---|---|
| A01 | Base 8,45 M€ hors terrain ; taux composite 2,82 %/an ; 184/365 | Amortissement 120,1 ; reprise 19,8 ; impact 100,3 ✓ |
| A02 | 42 k€/an ; 181/365 ; VNC au 31/12/2024 = 336 | Amortissement 20,8 ; sortie 315,2 ; impact 294 ✓ |
| A04 | 914 jours du 01/07/2025 au 31/12/2027 | 483,2 au lieu de 60,5 ; 90,6 au lieu de 11,3 ; impact 343,4 ✓ |
| A06 | 378/15 × 122/365 | Extourne 8,4 ; impact 369,6 ✓ |
| A07 | 15 % × 3 115 ; borne basse à 96 % (recouvrement historique 4 %) | 467,25 ; 342,65 ✓ |
| A16 | 210 × 2,82 % × 184/365 | 3,0 ✓ (sous le seuil des anomalies insignifiantes) |
| A17 | 1 − 1,0326/1,035 = 0,232 % | Assiette implicite ≈ 42,3 M€ de loyers conventionnés révisables : plausible ✓ |
| Synthèse | +4 603,3 / −236 / net 4 367,3 | Résultat corrigé 4 832,7 k€ ✓ |
| Autofinancement net | Surévaluation 1 268,3 k€ ; écart de ratio 2,6 pts | Dénominateur implicite ≈ 48,8 M€, cohérent avec les loyers, produits annexes et produits financiers ✓ |
| Ratio sur 3 ans | (3,1 + 2,6 + 5,2)/3 et (3,1 + 2,6 + 2,6)/3 | 3,63 % présenté ; 2,77 % corrigé ✓ |
| Seuils | 1,25 % × 46,8 = 585 (580 retenu) ; 65 % × 580 = 377 (375 retenu) ; 5 % × 580 = 29 | ✓ |
| PGE | 7,40 + 1,45 − 2,67 | 6,18 ; corrigée 6,96 ✓ |

### 2.2 Le point qui ne tombe pas : frais financiers, ICNE (A08) et structure de la dette

**Constat.** Prenons une dette de 365 M€ dont 84 % auprès de la Banque des Territoires indexés sur le Livret A (≈ 302,5 M€ hors prêt de haut de bilan à taux nul). Le Livret A est à 3 % pendant tout 2024. Des frais financiers 2024 de 9,6 M€ donnent alors un taux apparent de 2,63 %, ce qui suppose une **marge moyenne négative** sur les prêts indexés.

Or, pour un échéancier annuel, l'erreur d'A08 vaut :

> Σ encours × (3,0 % − [Livret A à la date de révision + marge]) × fraction d'année courue

Avec une marge moyenne nulle ou négative, elle atteint **1,0 à 1,4 M€**, et non 236 k€. Pour retrouver −236 k€, il faut une marge moyenne d'environ **LA + 0,50**, ce qui est réaliste pour une ESH dont l'encours est dominé par des PLUS. Mais les frais financiers 2024 montent alors à ≈ 11,3 M€.

Le tableau suivant est obtenu avec l'annexe `docs/annexes/simulation-frais-financiers.py` (échéances annuelles réparties sur l'année ; autres prêts à 1 %) :

| Marge moyenne des prêts indexés | Frais financiers 2024 | 2025 présentés (variation) | Erreur A08 |
|---|---|---|---|
| −0,20 | 9,19 | 9,48 (+3,1 %) | −1 387 k€ |
| 0,00 | 9,80 | 9,75 (−0,5 %) | −1 058 k€ |
| +0,30 | 10,71 | 10,17 (−5,1 %) | −564 k€ |
| **+0,50** | **11,32** | **10,44 (−7,7 %)** | **−235 k€** |
| +0,60 | 11,62 | 10,58 (−8,9 %) | −71 k€ |

J'ai aussi tiré 200 000 portefeuilles réalistes (mix PLUS/PAM, PLAI, éco-prêts, PLS ; échéances quelconques, ≤ 30 % de l'encours sur un même mois). **Aucun** ne satisfait à la fois les frais financiers 2024 (9,6 ± 3 %), ceux de 2025 (8,6 ± 3 %) et A08 (−236 ± 10 %).

**Options :**

- **Option 1 (recommandée).** On conserve A08 (−235 k€), la dette (365 M€, 84 % indexés) et une structure réaliste. Les frais financiers passent à ≈ 11,3 M€ (2024) et ≈ 10,4 M€ (2025 présentés, −7,7 % ; −9,8 % après correction).
  - Résultat, CAF, ratio et PGE ne bougent pas : le surcroît de frais financiers est compensé par un EBE plus élevé d'autant.
  - EBE 2025 : il reste dans la fourchette 52-55 % des loyers.
  - EBE 2024 : pour rester dans 50-53 %, il faut loger ≈ 0,5 à 1 M€ de produits encaissables hors EBE (dégrèvements de TFPB, produits de gestion exceptionnels). À défaut, la fourchette 2024 doit monter d'environ 1 point.
  - L'indice analytique s'en trouve renforcé. Compte tenu du décalage des révisions, on attend une baisse d'environ −10 % ; la baisse présentée n'est que de −7,7 %. L'écart, ≈ 0,24 M€, correspond exactement à A08.
- **Option 2.** On conserve les frais financiers (≈ 9,5 / 8,8 M€) et A08 (≈ −232 k€) en ramenant la part indexée sur le Livret A à ≈ 64 %. La part Banque des Territoires peut rester à 84 % si une partie de son encours est à taux fixe. L'EBE tombe naturellement dans les fourchettes.
  - Il faut ≈ 129 M€ de prêts à taux fixe autour de 1 %, ce qui est peu courant.
  - Les frais financiers 2025 sont en limite haute de tolérance (8,84 pour un maximum de 8,86) : la fenêtre de calibrage est étroite (frais financiers 2024 entre 9,31 et 9,51).
- **Option 3 (déconseillée).** On conserve les frais financiers et la structure ; A08 devient ≈ −1,2 M€. Elle serait alors individuellement significative, et le résultat corrigé passerait à ≈ 5,8 M€.

### 2.3 Cibles implicites que le générateur devra respecter

- **Dotation aux dépréciations des créances présentée = 1 425 k€ exactement** : A21 la reporte à 1 245 k€ dans l'annexe (inversion de chiffres).
- **Chronologie des dates de validation** dans le FEC, à rendre cohérente avec les mails :
  - le 28/01/2026, « loin de l'objectif » : ≈ 8,12 M€ avant A05 et A11 ;
  - la reprise excédentaire de PGE (A05) est validée entre le 28 et le 30/01 ;
  - le 30/01, la DAF écrit « on est à 8,9 M€ » ;
  - la PAR d'A11 est validée le 03/02, ce qui porte le résultat à 9,2 M€.

  Ces dates de validation deviennent un indice supplémentaire pour A05.
- **Ventes HLM.** Les « 25 ventes effectives » s'entendent hors les 7 pavillons du Clos Fleuri : l'état présenté compte donc 32 sorties. Les plus-values présentées (3,5 M€) se décomposent en 2,73 M€ réels et 0,77 M€ d'A03. Cela fait ≈ 109 k€ par logement, cohérent avec A03 (110 k€).
- **Dette.** Présentée : 362,5 M€ en emprunts + 2,5 M€ en compte d'attente (A18). Corrigée : 365 M€. La CAF présentée implicite est d'environ 15,9 M€ (autofinancement net 2,54 + remboursements 13,4), soit des dotations aux amortissements d'environ 15 M€.
- **Coût des Tilleuls.** Les 9,55 M€ s'entendent **hors** ordre de service n° 7 (210 k€, A16) et **nets** des 340 k€ de pénalités retenues : le coût propre est de 9,76 M€.

---

## 3. Architecture

### 3.1 Principes

1. **Couches à sens unique** : `engine` (comptabilité pure) ← `scenario` (données, générateur, modules) ← `game` (règles pures) ← `ui` (React). Une règle de lint interdit les imports à rebours.
2. **Un monde, des vues.** Un `World` regroupe le plan de comptes, les journaux, les grands livres 2024 et 2025, les sous-ledgers (immobilisations, prêts, baux, locataires, factures…) et les choix de présentation. Balance, états, annexe, FEC, CAF, ratios et documents sont des **fonctions pures** d'un `World`, mémoïsées.
3. **Propre, présenté, et tout intermédiaire.**
   - `présenté = propre + patches(toutes les anomalies)` ;
   - plus généralement, `monde(S) = propre + patches(S)` pour tout sous-ensemble S.

   Le même mécanisme sert au mode concepteur (activer ou désactiver une anomalie) et au calcul des comptes après négociation.
4. **Aucun montant saisi** dans l'interface ni dans les documents. Un document est un modèle qui lit des valeurs du moteur. Le type `Cents` est « marqué » ; sa création à partir d'un littéral est interdite par une règle de lint dans `ui/` et `scenario/documents/`, et un test le vérifie.
5. **Déterminisme.**
   - Graine fixe, avec des flux aléatoires nommés (`rng.fork('leases')`) pour qu'ajouter un flux ne décale pas les autres.
   - Montants en centimes entiers, dates sans fuseau horaire, tris stables.
   - L'empreinte du scénario est testée.
6. **Paramètres hors du code.** Références réglementaires, taux, durées, cibles de calibrage et pondérations du scoring vivent dans `src/scenario/params/` (JSON et CSV). Ils sont validés par Zod et marqués `toVerify` quand ils sont incertains.

### 3.2 Arborescence

```
dossier-val-aurelle/
  CLAUDE.md                     conventions + état d'avancement
  README.md                     (J7) guide utilisateur
  package.json, tsconfig.json, vite.config.ts, vitest.config.ts, playwright.config.ts
  docs/
    plan-j0.md                  ce document
    points-a-verifier.md        références et choix à faire valider
    guide-auteur.md             (J7) créer un scénario, une anomalie
    annexes/                    simulations et notes de calcul
    revue-metier/               (J2, généré) dossier de validation : balance, états, anomalies, indices
  scripts/
    generate-scenario.ts        → public/scenarios/val-aurelle-2025/*.json
    calibration-report.ts       cibles / obtenu / tolérance
    review-pack.ts              (J2) → docs/revue-metier/
  public/scenarios/val-aurelle-2025/   (généré, non versionné)
  src/
    engine/                     sans React
      types.ts
      money.ts dates.ts rng.ts rounding.ts
      chart/                    chargement et import CSV du plan de comptes
      ledger/                   écritures, contrôles d'équilibre, numérotation
      balance.ts general-ledger.ts fec.ts
      statements/               bilan, compte de résultat, mapping, tableaux d'annexe
      analysis/                 sig.ts caf.ts self-financing.ts ratios.ts
      subledgers/               fixed-assets, depreciation, subsidies, loans, icne, tenants, provisions
      world.ts                  application des patches, sélecteurs mémoïsés
    scenario/
      types.ts
      schema/                   schémas Zod des contenus JSON
      params/                   regulatory.json, calibration.json, scoring.json, game.json,
                                components.json, loan-products.json, plan-comptable-ols-2025.csv
      generator/                programmes, assets, subsidies, loans, leases, rents, purchases,
                                payroll, taxes, sales, closing, history, calibration
      anomalies/                A01-tilleuls-en-cours.ts … A22-comparatif-depots.ts, index.ts
      false-leads/              F1 … F7
      team-reviews/             T1 … T4
      ethics/                   E1 … E5, confidences de Karim
      documents/                registre, modèle de contenu, gabarits (≈ 70)
      npc/                      fiches, dialogues, confrontations, portraits
      procedures/               bibliothèque (≈ 60) par cycle
      events/                   messagerie et calendrier
    game/
      types.ts
      clock.ts budget.ts gauges.ts conditions.ts effects.ts
      procedures.ts requests.ts confirmations.ts worksheets.ts
      findings.ts matching.ts negotiation.ts opinion.ts scoring.ts debrief.ts
      store/                    Zustand, persistance, migrations
    ui/
      app/                      routes, mise en page, palette Ctrl+K, thèmes
      screens/                  Accueil, Bureau, GED, Balance, GrandLivre, FEC, États, Analyse,
                                Entretiens, Programme, Confirmations, Équipe, Constats,
                                Synthèse, Rapport, Débrief, Mémo, Contrôle, Concepteur
      components/               DataTable virtualisée, Montant, VisionneuseDocument, Portrait, Jauge…
      format/                   formats fr-FR
    content/                    mémo réglementaire, textes pédagogiques
  tests/
    engine/ scenario/ integrity/ game/ e2e/
```

### 3.3 Flux de données

```
params/*.json + plan-comptable.csv ──(Zod)──┐
                                            ▼
             scripts/generate-scenario.ts (Node, graine fixe)
                                            │  monde propre 2024 + 2025, format compact
                                            ▼
             public/scenarios/val-aurelle-2025/*.json  (importé comme module : inclus dans le build mono-fichier)
                                            │
                       navigateur : chargement + validation Zod
                                            ▼
     monde propre ──► anomalies[i].patch(ctx, S) ──► monde(S)   (présenté si S = toutes)
          │                                              │
          └───────► dérivés mémoïsés (balance, GL, FEC, états, annexe, CAF, AN, ratios, auxiliaires)
                                            │
          documents.build(vue) → contenu structuré → rendu React (recherche, annotation, preuve)
                                            │
          état de jeu (Zustand) ──► sélecteurs ──► écrans
```

Le générateur (lourd : baux, factures, calibrage) tourne hors navigateur. Les modules d'anomalies et les dérivations tournent dans le navigateur, ce qui permet au mode concepteur et à la négociation de recalculer n'importe quel `monde(S)`. Si une recomposition dépasse 50 ms en mesure, elle passe dans un Web Worker.

### 3.4 Choix techniques

- Vite, React, TypeScript strict (`strict`, `noUncheckedIndexedAccess`), Tailwind CSS. React Router en **mode hash** pour que le build mono-fichier fonctionne depuis `file://`.
- Zustand avec une persistance maison : localStorage sous `try/catch`, `schemaVersion`, migrations testées.
- TanStack Table et Virtual pour la balance, le grand livre et le FEC ; Recharts ; Zod ; Vitest ; Playwright en J7 (Chromium préinstallé dans l'environnement).
- Polices `@fontsource` Inter et JetBrains Mono : woff2, sous-ensemble latin seulement, pour limiter le poids du fichier unique.
- Données du scénario : format **colonnaire compact** (centimes entiers, comptes et tiers indexés). Volume estimé à 4-6 Mo non compressés, sous la limite d'un fichier HTML unique.
- Formats fr-FR via `Intl` : séparateur de milliers = espace fine insécable (U+202F), comportement standard des navigateurs, vérifié en test ; dates JJ/MM/AAAA.
- Versions des dépendances : dernières versions stables au moment de J1, figées dans `package-lock.json`.

---

## 4. Modèle de données

Les types complets sont dans les trois fichiers `types.ts`. Ils compilent avec `tsc --strict --noUncheckedIndexedAccess`.

### 4.1 Moteur (`src/engine/types.ts`)

| Type | Rôle |
|---|---|
| `Cents`, `IsoDate` | Montant en centimes entiers (type marqué) ; date sans fuseau. |
| `Account`, `ChartOfAccounts` | Plan de comptes : numéro, libellé, classe, sens, rubrique du bilan ou du compte de résultat selon le signe, rubrique d'annexe, poste de CAF, `toValidate`, origine (proposition ou import). |
| `JournalEntry`, `EntryLine` | Écriture : journal, date, pièce, libellé, lignes, date de validation, **utilisateur de saisie interne**, origine (générateur, anomalie, correction, joueur). Une ligne peut porter des références d'objets métier (programme, composant, prêt, tiers…) pour la navigation et les constats. |
| `Ledger`, `TrialBalance`, `FecLine(Internal)` | Grand livre ; balance signée ; ligne FEC à 18 champs (+ champs internes non exportés). `EcritureNum` suit l'ordre de **validation** : une écriture d'inventaire validée en février reçoit donc un numéro tardif (indice A11). |
| `FinancialStatements`, `AnnexTable` | Lignes d'états (brut / amortissements / net N / net N-1) et contrôles d'intégrité ; tableaux d'annexe. |
| `CafComputation`, `NetSelfFinancing` | CAF par la méthode additive (postes paramétrés) ; autofinancement net HLM avec dénominateur détaillé. |
| `Programme`, `AssetComponent`, `ConstructionOperation`, `Subsidy`, `Loan`, `LoanScheduleLine`, `Lease`, `TenantAccount`, `ThirdParty`, `Invoice` | Sous-ledgers : environ 40 programmes, 3 500 composants, 120 prêts, 8 600 baux, 1 200 ex-locataires, 4 000 factures. |
| `PresentationOverrides` | Choix de présentation appliqués aux états et à l'annexe (A21, A22). |
| `World` | Monde complet : plan, journaux, grands livres N-1 et N, sous-ledgers, présentation. |

### 4.2 Scénario (`src/scenario/types.ts`)

L'interface `AnomalyModule` du §3.1 est conservée, avec cinq ajustements :

1. **`patch(ctx, active)` renvoie une liste d'opérations** au lieu de muter le contexte (retirer, ajouter ou remplacer des écritures ; modifier un sous-ledger, la présentation ou un document). Les opérations étant des données, on peut composer n'importe quel `monde(S)` ; l'argument `active` permet à une anomalie de rester cohérente quand une autre est active ou non (A01 et A16 sur Les Tilleuls).
2. **`after`** déclare l'ordre canonique des corrections (A16 après A01).
3. **`parts`** découpe une anomalie en éléments appariés et notés séparément : A07 (a), (b) et présentation des soldes créditeurs ; A10 syndic et gardiens ; A12 (i) à (iii) ; A14 (i) à (iii) ; A03 correction et événement postérieur. Chaque partie a sa signature et sa tolérance.
4. **La tolérance est calculée par le moteur** (plage en euros), par exemple 342-467 k€ pour A07 (a) avec le taux de recouvrement historique.
5. **Les impacts ne sont jamais déclarés** : ils sont calculés à partir des écritures de correction (résultat, capitaux propres, CAF, autofinancement net, bilan). Les valeurs cibles du §5 vivent dans un fichier réservé aux tests et ne sont jamais affichées.

Autres types :

- **`ClueRef`** : un indice = une source (document + ancre, ou vue de données + sélecteur), un **groupe d'indépendance** (les deux indices exigés pour une anomalie doivent appartenir à des groupes différents), les procédures qui le révèlent et une condition d'accès (confidences de Karim, par exemple).
- **`DocumentDef`** : modèle de document qui produit un **contenu structuré** (blocs et éléments en ligne : texte, montant, date, ancre, tableau, signature, tampon « Reçu le »). Ce format est cherchable, annotable par ancre et testable sans navigateur ; un élément « montant » n'accepte qu'une valeur issue du moteur. Une disponibilité est associée : dès le départ, sur demande, en réponse d'un tiers avec délai, ou sous condition.
- **`Condition` et `Effect`** : un mini-langage sérialisable (JSON), commun aux dialogues, aux documents, aux événements et aux procédures. Conditions : drapeau, document lu, procédure faite, constat ouvert, preuve liée, date, phase, jauge. Effets : drapeau, variation de jauge, déblocage de document, mail, événement, heures consommées.
- **`CharacterSheet`, `DialogueNode`, `ConfrontationRule`** : fiches de personnages (secrets et conditions de révélation), arbres de dialogue, réactions à la présentation d'une pièce (concède, nuance, révèle).
- **`ProcedureDef`, `TeamReviewScenario`, `EthicsEvent`, `FalseLeadModule`** : bibliothèque de procédures (coût par profil, prérequis, sorties), erreurs scénarisées T1 à T4, événements éthiques, fausses pistes avec les preuves qui permettent de les écarter.

### 4.3 Jeu (`src/game/types.ts`)

`GameState` contient tout ce que le joueur fait, et rien d'autre :

- horloge et phase ; heures par membre de l'équipe ; jauges ;
- seuils et justification ; risques ; programme ; exécutions ;
- demandes de documents et confirmations ; état des documents (lu, annotations) ; feuilles de travail ;
- **constats structurés** ; négociation ; choix éthiques ; projet de rapport ;
- messagerie ; drapeaux ; **journal chronologique** (pour le débrief) ; mode concepteur.

Les données générées ne sont jamais sauvegardées : une sauvegarde contient l'empreinte du scénario et `schemaVersion`.

---

## 5. Moteur comptable et générateur

### 5.1 Plan de comptes

- Fichier `params/plan-comptable-ols-2025.csv`, séparateur `;`, ouvrable dans Excel. Colonnes : `numero ; libelle ; classe ; sens ; rubrique_debit ; rubrique_credit ; rubrique_annexe ; poste_caf ; a_valider ; commentaire`.
- Proposition fidèle à l'instruction comptable OLS applicable à 2025. Tout compte incertain est marqué `a_valider = oui`. Aucun compte du nouveau référentiel 2026.
- **Import d'un plan officiel** au même format, avec un rapport d'écarts. Un compte utilisé par le générateur et absent du plan importé est bloquant ; les rubriques manquantes sont signalées.

### 5.2 Génération du monde propre

L'ordre des étapes suit les dépendances :

1. **Patrimoine** : environ 40 programmes, dont les dix programmes clés du §4.4 (logements, année, financement, classe énergie, statut, gestionnaire des foyers).
2. **Immobilisations** : environ 3 500 composants (nomenclature et durées dans `params/components.json`) et les terrains. Le cumul d'amortissement à une date donnée se calcule analytiquement, sans simuler les exercices antérieurs.
3. **Subventions** par programme, reprises au rythme des amortissements.
4. **Dette** : 120 prêts. Le catalogue des produits (`params/loan-products.json` : marges, durées, périodicité, progressivité) est à valider. Échéanciers calculés avec l'historique du Livret A (`params/regulatory.json`) ; ICNE par prêt.
5. **Baux et locataires** : 8 600 baux et 1 200 ex-locataires.
   - Loyers 2024 et 2025 : révision de +3,26 % dans le propre, +3,50 % dans le présenté (A17).
   - RLS, APL, provisions pour charges, dépôts de garantie.
   - Auxiliaire LOGIGES : soldes, balance âgée, procédures.
   - Les quittances individuelles sont calculées à la demande (échantillons d'A17).
6. **Exploitation** : quittancement récapitulatif par interface ; encaissements ; 4 000 factures fournisseurs (dont celles des Peupliers et des Érables) ; paie (≈ 190 salariés, dont 14 gardiens) ; TFPB ; GIE ; honoraires.
7. **Investissement** : opérations en cours, réception des Tilleuls, PAC des Érables, réhabilitation des Charmes, travaux des Peupliers.
8. **Cessions** : 25 ventes HLM en 2025. Dans le propre, le Clos Fleuri est vendu en 2026.
9. **Inventaire** : amortissements, reprises de subventions, PGE (PPE officiel), dépréciations des créances (méthode de l'annexe), ICNE, charges à payer, produits à recevoir, charges constatées d'avance, régularisation des charges. Les indemnités de fin de carrière restent hors bilan.
10. **Exercice 2024** simulé de même. L'ouverture au 01/01/2024 se déduit des sous-ledgers à cette date, les capitaux propres servant de solde. Les exercices 2021-2023 sont réduits à des agrégats.

### 5.3 Calibrage

- **Leviers bornés** : niveau de loyer par programme, entretien courant, frais de personnel, autres charges externes, produits annexes, marge moyenne des prêts, échéances, trésorerie placée… Résolution séquentielle (quasi linéaire), sans valeur aberrante sur une ligne isolée.
- `npm run calibrate` produit un rapport « cible / obtenu / écart / tolérance ». Les tests de calibrage sont bloquants.
- **Cibles propres de J1** = cibles présentées du §4.3 − effets attendus du §5. Ces effets sont tabulés dans `params/calibration.json` en J1, puis recalculés par le moteur en J2. Quelques exemples :

| Agrégat | Présenté | Effets attendus | Propre |
|---|---|---|---|
| Résultat net | 9,20 | −4,37 | 4,83 |
| Loyers nets de RLS | 46,8 | A17 −0,098 ; A19 −0,052 | ≈ 46,65 |
| Récupération des charges | 11,2 | A10 −0,254 | ≈ 10,95 |
| Plus-values de cession | 3,5 | A03 −0,77 | ≈ 2,73 |
| Reprise / clôture PGE | 2,67 / 6,18 | A05 | 1,89 / 6,96 |
| Ratio d'autofinancement net | 5,2 % | −1,27 M€ | ≈ 2,6 % |

### 5.4 Anomalies : patches, corrections, impacts

- **`patch(ctx, active)`** renvoie des opérations ciblant des identifiants d'écritures et d'enregistrements. Un test vérifie qu'aucune écriture n'est touchée par deux anomalies, sauf dépendance déclarée.
- **Écritures de correction** : rédigées par chaque module (pédagogiques : libellés, comptes, pièces), postées sur le présenté dans l'ordre canonique.
- **Invariant central** (testé sur la balance et sur tous les dérivés) : `présenté + Σ corrections = propre`.
- **Impact d'une anomalie** = effet de ses corrections dans l'ordre canonique ; impacts additifs par construction.
- **Comptes après négociation** = `monde(anomalies non corrigées)`, recalculé exactement. Si A01 n'est pas corrigée et A16 l'est, les 210 k€ restent en immobilisations en cours, sans amortissement.
- **Composabilité testée** : chaque `monde({i})`, chaque paire (231 paires) et des sous-ensembles tirés au hasard doivent produire des comptes équilibrés, avec des états qui se rapprochent.

### 5.5 Dérivés

- Balance N et N-1 ; grand livre.
- FEC : 18 champs, numérotation continue par ordre de validation, utilisateur interne, export CSV.
- États : mapping des comptes sur les rubriques, colonnes N et N-1 ; annexe : tableaux rapprochés de la balance.
- SIG et EBE ; CAF ; autofinancement net HLM (convention paramétrée, §4.3 du cahier des charges) ; ratios OLS (annuités / loyers, vacance, impayés, coût de gestion par logement).
- Auxiliaires : locataires, dette par prêt, registre des composants.

### 5.6 Arrondis

Les calculs intermédiaires sont faits en double précision ; l'arrondi au centime intervient **une seule fois**, à la création de chaque ligne d'écriture. Les ventilations (coût par composant, quittancement par programme) utilisent la méthode du **plus fort reste**, pour que la somme des parts égale exactement le total.

---

## 6. Contenus du scénario

- **Anomalies** : un fichier par anomalie, avec patch, corrections, parties, indices, profil de négociation et débrief. Les références précises (article, NEP) proviennent de `params/regulatory.json`, où chacune porte son statut de vérification.
- **Fausses pistes F1-F7** : présentes dans le **propre** (ce sont des faits réels), avec les preuves qui permettent de les écarter.
- **Revue de l'équipe T1-T4** : feuilles de travail erronées scénarisées. Les autres travaux délégués sont produits à partir des vraies données et sont donc corrects.
- **Environ 70 documents**, dont un quart de bruit. Registre par catégorie et disponibilité ; gabarits en TypeScript qui lisent le monde. Les réponses de tiers lisent le **monde propre**, puisque le tiers dit vrai : notaire, Banque des Territoires, Département.
- **Personnages** : fiches, dialogues sous forme de graphe de données, règles de confrontation. Portraits SVG stylisés générés à partir d'une graine (formes géométriques, aucune photo).
- **Bibliothèque d'environ 60 procédures** par cycle, avec coûts par profil calibrés pour qu'un programme exhaustif coûte ≈ 450 h.
- **Messagerie et événements** datés ou conditionnels (premier mail de l'associée = tutoriel).
- **Mémo réglementaire** (`content/`) : chaque point incertain renvoie à `points-a-verifier.md`.

---

## 7. Règles du jeu

| Domaine | Règle |
|---|---|
| Horloge | Jours ouvrés, quatre périodes (intérim 17-20/11/2025, final 23/02-13/03/2026, synthèse 17-26/03, rapport jusqu'au 20/05). Délais de réponse par interlocuteur, relances. |
| Budget | Heures par membre (340 h en niveau senior). Dépassement toléré jusqu'à 10 % ; au-delà, arbitrage de l'associée, avec perte de confiance si le dépassement n'est pas justifié par un risque documenté. |
| Jauges | Relation client (70), confiance de l'associée (60), confiance de Karim. Effets paramétrés dans `params/game.json`. |
| Procédures | Exécutées par le senior, ou déléguées à Léa ou Hugo : la feuille de travail produite doit être revue (acceptée ou renvoyée avec un motif). |
| Confirmations | Préparées à l'intérim, envoyées automatiquement début janvier, réponses datées (ou absence de réponse), procédures alternatives. |
| Constats | Structurés, sans texte libre : cycle, objets choisis dans des listes, nature, classification, impacts, écriture proposée, pièces liées, statut. |
| Appariement | Cycle identique, au moins un objet commun avec la signature, nature compatible. Crédit complet si le montant est dans la tolérance, partiel sinon. Un constat sans correspondance est un faux positif, sauf au statut « question ». |
| Négociation | Profil par partie d'anomalie ; preuves exigées ; escalade à l'associée, qui coûte de la confiance si le dossier est faible. |
| Opinion attendue | Règles dans `params/scoring.json` : anomalies non corrigées rapportées au seuil du joueur s'il est dans la plage acceptable, sinon au seuil de référence ; facteurs qualitatifs (franchissement du taux de référence de l'autofinancement net, indice de fraude, irrégularités). |
| Scoring | Sept compétences pondérées, pénalités, note de A à D, revue qualité de l'associée générée par règles. |
| Sauvegarde | Sauvegarde automatique et trois emplacements, export et import JSON, migrations versionnées, empreinte du scénario vérifiée au chargement. |

Toute la logique de `game/` est faite de **fonctions pures** (état, action → nouvel état), testables sans React. Le store Zustand ne fait que les appeler.

---

## 8. Interface

- Écrans du §11, en onglets. Palette de commandes (Ctrl+K), thèmes clair et sombre, cible 1280 px, utilisable à 1024 px. Contrastes AA, navigation au clavier, libellés ARIA (grilles ARIA pour les tableaux virtualisés).
- **Écran de contrôle** dès J1, pour vérifier le fond avant le jeu : cibles et valeurs obtenues, balance N/N-1, états, export FEC et CSV. En J2, il s'enrichit d'une visionneuse de documents et du tableau des anomalies. Il préfigure le **mode concepteur** (`?designer=1`), complété en J7.
- Montants en JetBrains Mono à chiffres tabulaires, alignés à droite ; négatifs entre parenthèses ou signés selon le contexte comptable.

---

## 9. Tests et qualité

| Suite | Contenu |
|---|---|
| Moteur | Centimes et arrondis, dates et prorata, amortissement par composant, échéanciers et ICNE, CAF, autofinancement net, format FEC. |
| Intégrité (§3.4) | Sur le propre, le présenté, chaque `monde({i})` et chaque paire : écritures équilibrées ; balance nulle ; grand livre = balance = FEC ; actif = passif ; résultat du compte de résultat = résultat au bilan ; colonne N-1 = certifiés 2024 (sauf A22) ; annexe = balance (sauf A21) ; auxiliaire locataires = comptabilité générale (sauf A19) ; dette par prêt = emprunts (sauf A18). |
| Calibrage | Cibles du §4.3 (présenté et propre) dans leurs tolérances ; cibles implicites du §2.3. |
| Anomalies | Corrections équilibrées ; invariant ; impacts conformes au §5 (± 3 %, ± 10 % pour A08) ; au moins deux indices de groupes différents, **présents dans le document rendu** (l'ancre existe et contient la valeur calculée par le moteur). |
| Contenus | Identifiants référencés existants ; sorties des procédures existantes ; dialogues atteignables ; conditions valides ; aucun montant saisi à la main (lint et analyse des gabarits). |
| Déterminisme | Deux générations successives donnent la même empreinte ; `scenario.lock.json` à jour. |
| Jeu | Appariement, négociation, opinion attendue, scoring, migrations de sauvegarde. |
| Bout en bout (J7) | Partie complète scriptée en mode concepteur (Playwright) ; aucune erreur en console ; build mono-fichier ouvert hors ligne ; budget de taille. |

`npm run test` et `npm run build` doivent passer à la fin de chaque jalon.

---

## 10. Jalons détaillés

### J1 — Moteur comptable

- Mise en place : Vite, TypeScript strict, Tailwind, Vitest, lint (couches, montants), scripts `generate`, `calibrate`, `build:single`.
- Moteur : centimes, dates, graine, plan de comptes (CSV et import), écritures, balance, grand livre, FEC, états, annexe, SIG, CAF, autofinancement net, ratios, sous-ledgers (amortissements, prêts et ICNE, locataires).
- Paramètres : plan de comptes proposé, `regulatory.json`, `components.json`, `loan-products.json`, `calibration.json`.
- Générateur : monde propre 2024 + 2025 et historique 2021-2023.
- Tests d'intégrité et de calibrage ; écran de contrôle minimal.
- **Critères** : tests verts, build sans erreur ; **cibles propres atteintes** (§5.3) ; FEC entre 25 000 et 40 000 lignes ; déterminisme vérifié.

### J2 — Anomalies et contenus

- Modules A01 à A22, fausses pistes F1 à F7, paramètres complétés.
- Modèles de documents (≈ 70) portant les indices.
- **Dossier de revue métier** (`npm run review-pack` → `docs/revue-metier/`, HTML et CSV) :
  - balance N/N-1 ;
  - états financiers présentés et corrigés côte à côte ;
  - tableau des anomalies avec les impacts calculés (résultat, capitaux propres, CAF, autofinancement net, bilan) et les écritures de correction ;
  - liste des indices par anomalie, avec l'extrait du document.

  Je pourrai aussi en publier une version en page web privée, si c'est plus pratique pour vous.
- **Critères** : invariant `présenté + corrections = propre` ; impacts conformes au §5 ; au moins deux indices indépendants par anomalie ; composabilité ; cibles présentées du §4.3.
- **Arrêt obligatoire : validation métier.**

### J3 — Consultation

- Bureau ; GED (recherche plein texte, annotations, liaison de preuves).
- Balance interactive (variations, filtres, navigation vers le grand livre).
- Explorateur du grand livre et du FEC : filtres combinables (journal, compte, utilisateur, date de saisie ou de validation, week-end, montants ronds, mots-clés, couples de comptes rares), requêtes sauvegardées, export.
- États et pointage (marques personnalisables, colonne N-1 contre les comptes certifiés) ; analyse (graphiques, ratios OLS).

### J4 — Mécanique d'audit

- Seuils avec justification ; évaluation des risques ; programme de travail et affectations.
- Procédures, temps et budget ; demandes de documents et relances ; confirmations.
- Outils de recalcul et d'échantillonnage (aléatoire, systématique, par strates, par unités monétaires ; graine affichée ; taille calculée).
- Feuilles maîtresses ; constats et appariement.

### J5 — Personnages

- Fiches, dialogues et confrontation ; portraits.
- Équipe et revue des travaux (T1-T4).
- Événements éthiques (E1-E5) et confidences de Karim ; messagerie et événements.

### J6 — Synthèse

- Tableau des anomalies ; négociation ; comptes après négociation.
- Opinion et rapports :
  - rapport du commissaire aux comptes (structure NEP 700 d'une entité qui n'est pas une EIP), imprimable ;
  - rapport spécial ; lettre d'affirmation ;
  - communications NEP 260 et 265 ; signalement des irrégularités.
- Scoring et débrief : anomalies trouvées ou manquées, fausses pistes, présenté et corrigé côte à côte, chronologie, radar.

### J7 — Finitions

Tutoriel, niveaux de difficulté, mode concepteur complet, sauvegardes, accessibilité, build mono-fichier, test de bout en bout, README utilisateur, `docs/guide-auteur.md`.

---

## 11. Risques techniques et parades

| # | Risque | Parade |
|---|---|---|
| R1 | Cibles contradictoires (frais financiers, A08) | Arbitrage D2 avant J1 ; simulation en annexe. |
| R2 | Calibrage simultané de nombreuses cibles, dont certaines exactes (résultat ± 0,1 M€, PGE, 1 425 k€ de dotation, ratio ± 0,2 pt) | Leviers bornés, résolution séquentielle, rapport de calibrage, tests bloquants ; cibles exactes posées par construction (écritures d'inventaire calculées pour tomber juste). |
| R3 | Interactions entre anomalies (A01 et A16 ; dépréciations A07, A15 et A21) | Opérations ciblées, ordre canonique, argument `active`, tests unitaires, par paire et aléatoires. |
| R4 | Volume (≈ 32 000 lignes de FEC, 8 600 baux) et fluidité | Format colonnaire, virtualisation, mémoïsation par monde, Web Worker si nécessaire, mesure en J3. |
| R5 | Poids du build mono-fichier | Données compactes, polices réduites au latin, budget de taille vérifié en test (objectif < 10 Mo). |
| R6 | Déterminisme Node / navigateur | Centimes entiers, graine et flux nommés, dates sans fuseau, tris stables, test d'empreinte. |
| R7 | Exactitude réglementaire | `points-a-verifier.md`, références dans les paramètres, comptes `toValidate`, validation métier à J2. |
| R8 | Volume de contenu (70 documents, 60 procédures, une quinzaine de personnages) : principal poste d'effort | Gabarits pilotés par les données, tests de contenu, guide d'auteur ; contenu rédigé par cycle, en commençant par les anomalies. |
| R9 | Appariement sans texte libre (ambiguïtés, plusieurs constats pour une même anomalie) | Signatures par partie, objets choisis dans des listes, tests avec des jeux de constats scriptés. |
| R10 | Équilibrage (340 h disponibles pour ≈ 450 h de procédures possibles) | Script de simulation des programmes (optimal, exhaustif, naïf) ; coûts paramétrés. |
| R11 | Stockage local (quota, navigation privée) | Sauvegarder seulement l'état du joueur ; `try/catch` ; export JSON ; avertissement si le stockage est indisponible. |
| R12 | Évolution du format de sauvegarde | `schemaVersion`, migrations testées, empreinte du scénario. |
| R13 | Accessibilité des grands tableaux virtualisés | Rôles ARIA de grille, navigation au clavier, tests axe en J7. |
| R14 | La clé de correction est lisible dans le bundle | Acceptable (jeu de formation, en solo) ; à documenter. |

---

## 12. Hypothèses et simplifications de la V1

Ces hypothèses seront reportées dans `CLAUDE.md` une fois validées.

- **TVA** : charges d'exploitation enregistrées TTC (activité locative exonérée) ; la livraison à soi-même des opérations neuves n'est pas modélisée.
- **Prêts** : échéances majoritairement annuelles ; révision simple (taux = Livret A à la date d'échéance + marge) ; base exact/365. La double révisabilité et la progressivité révisable ne sont pas modélisées (à valider, PV-19).
- **Exercices 2021-2023** : agrégats seulement.
- **Impôt sur les sociétés** : aucun (exonération des activités de service d'intérêt économique général).
- **Anomalies** : toutes actives en V1. Les niveaux de difficulté jouent sur le budget, les aides et les délais ; l'architecture permettra des sous-ensembles plus tard.
- **Plan de comptes** : référentiel OLS antérieur à 2026 uniquement ; aucun mélange avec le règlement ANC n° 2025-05.
