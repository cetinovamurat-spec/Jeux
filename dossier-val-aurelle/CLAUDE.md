# Dossier Val d'Aurelle — notes de projet pour Claude

Jeu de rôle d'audit légal (navigateur, 100 % client) : le joueur audite les comptes 2025 de Val d'Aurelle Habitat, ESH fictive.

- Cahier des charges : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md). C'est la référence : le relire avant chaque jalon.
- Plan J0 : [`docs/plan-j0.md`](docs/plan-j0.md).
- Points à vérifier : [`docs/points-a-verifier.md`](docs/points-a-verifier.md).

## État d'avancement

| Jalon | Statut | Notes |
|---|---|---|
| J0 — Plan | **Validé le 12/10/2026** | Option 1 retenue pour D2 ; D1, D3 à D7 acceptées |
| J1 — Moteur comptable | **Livré le 12/10/2026** | Monde propre 2024 + 2025 ; 34/34 cibles de calibrage ; 85 tests verts ; écran de contrôle |
| J2 — Anomalies et contenus | **Validé le 12/10/2026** | 22 anomalies (30 parties), clé de correction calculée, 125 documents et 127 indices, 7 fausses pistes ; 53/53 cibles ; 131 tests verts ; dossier `docs/revue-metier/`. Choix « à valider » de la section G acceptés par défaut |
| J3 — Consultation | **Livré le 15/10/2026** | Bureau, GED, balance N / N-1, grand livre, explorateur du FEC, états et pointage, revue analytique ; état de jeu pur et sauvegarde automatique ; __TESTS__ tests verts |
| J4 — Mécanique d'audit | À faire | |
| J5 — Personnages | À faire | |
| J6 — Synthèse | À faire | |
| J7 — Finitions | À faire | |

## Règles de travail (§0 du cahier des charges)

- Avancer jalon par jalon. À la fin de chaque jalon : `npm run test` vert, `npm run build` sans erreur, commit explicite, mise à jour de ce fichier et de `docs/points-a-verifier.md`.
- Une erreur technique dans le contenu est un bug bloquant. Ne jamais inventer une référence précise (article, paragraphe de NEP, numéro de compte) : la formuler de façon générale et l'inscrire dans `docs/points-a-verifier.md`.
- Aucun montant saisi à la main dans l'interface ou les documents : tout chiffre affiché dérive du moteur.
- Ne poser de question que si la décision est structurante et non tranchée ; sinon choisir l'option la plus simple et la noter ci-dessous.

## Conventions

- **Langue** : interface et contenus en français (registre professionnel CAC/HLM) ; code, identifiants et commentaires techniques en anglais. Formats fr-FR (`1 234 567,89 €`, `JJ/MM/AAAA`).
- **Couches** : `engine` (pur, sans React) ← `scenario` ← `game` (règles pures) ← `ui`. Pas d'import à rebours.
- **Montants** : centimes entiers (type `Cents`). Création à partir d'un littéral interdite dans `src/ui/` et `src/scenario/documents/`.
- **Dates** : `IsoDate` (`'YYYY-MM-DD'`), sans fuseau horaire.
- **Prorata temporis** : jours exacts / 365. C'est la convention qui reproduit les chiffres du §5.
- **Reprise des subventions** : subvention × dotation / base amortissable hors terrain.
- **Arrondi** : une seule fois par ligne d'écriture ; ventilations par la méthode du plus fort reste.
- **Impacts des anomalies** : calculés à partir des écritures de correction, postées dans l'ordre canonique (`after`), jamais déclarés. Comptes après négociation = `monde(anomalies non corrigées)`.
- **Références réglementaires et paramètres** : dans `src/scenario/params/`, jamais en dur dans les composants.
- **Plan de comptes** : référentiel OLS applicable à 2025 (antérieur à la réforme 2026). Ne jamais mélanger avec le règlement ANC n° 2025-05.
- **Commits** : messages en français, explicites ; au moins un commit par jalon.

## Décisions prises

- D1 : projet autonome dans `dossier-val-aurelle/`. Les Olympiades restent à la racine du dépôt ; leur déploiement Render n'utilise que le `package.json` racine.
- D2 (validée) : option 1 — frais financiers ≈ 11,3 M€ (2024) et ≈ 10,4 M€ (2025 présentés), marge moyenne des prêts indexés ≈ LA + 0,55, A08 ≈ −236 k€.
- D3 : impacts par écritures de correction en ordre canonique ; recalcul exact des mondes partiels.
- D4 : exercice 2024 simulé par le même générateur ; 2021-2023 en agrégats.
- D5 : écritures récapitulatives (quittancement programme × mois, encaissements par remise, amortissements programme × compte) ; FEC 2025 ≈ 26 900 lignes.
- D6 : données générées non versionnées ; empreinte `scenario.lock.json` versionnée.

### Choix d'implémentation de J1 (écarts au plan J0)

- **Génération dans le navigateur.** Le monde généré pèse ≈ 20 Mo en JSON : il n'est pas embarqué. L'application régénère le dossier dans un Web Worker (≈ 3 s) à partir des paramètres et des leviers calibrés (`src/scenario/params/levers.json`, versionné). `npm run generate` écrit des fichiers d'inspection dans `generated/val-aurelle-2025/` (non versionné : `world.json`, FEC 2024/2025, balances CSV) et compare l'empreinte au verrou.
- **Montants** : `Cents` est un alias de `number` (entiers, contrôlés par les tests) plutôt qu'un type marqué, pour la lisibilité du moteur ; l'interdiction des montants en dur dans `src/ui/` et `src/scenario/documents/` est vérifiée par `tests/guards.test.ts`.
- **Scripts** : `vite-node` (et non `tsx`) pour lire le plan de comptes CSV (`?raw`).
- **Calibrage** : leviers globaux résolus par `npm run calibrate -- --solve` (coût de construction, taux de subvention, entretien courant 2024/2025, dotation PGE 2024, trésorerie d'ouverture, allongement des prêts) ; calibrages locaux en clôture de chaque étape (loyers, RLS, dépôts, récupérations, prêts, plus-values, dotation présentée d'A21).
- **Structure du patrimoine retenue pour tenir le bilan du §4.3** (total ≈ 620 M€, capitaux propres ≈ 224 M€ avec des dotations ≈ 16,7 M€) : programmes construits après 2000 nombreux, foncier élevé pour les opérations récentes (zone tendue), décomposition rétrospective des programmes antérieurs à 2005 (structure 75 %), sept opérations en cours de construction (≈ 51 M€), subventions concentrées sur les réhabilitations (ANRU/PNRU), allongement de 5 ans des prêts de la Banque des Territoires (2019-2020). Points consignés dans `docs/points-a-verifier.md` (PV-44 à PV-52).
- **Recalibrer après une modification de paramètres** : `npm run calibrate -- --solve` puis `npm run generate -- --update-lock`, puis `npm test`.

### Choix d'implémentation de J2

- **Monde présenté = propre + patches.** `buildState(propre, params, parties actives)` applique les modules dans l'ordre canonique (A01 → A22, parties `A07.a`…) sur un brouillon copie-sur-écriture (`WorldDraft`). Les anomalies modifient les sous-ledgers (registre des composants, tiers, régularisations…) et marquent les programmes concernés ; les écritures dérivées (amortissements, quote-part des subventions, dépréciation des créances) sont recalculées par le même code que le monde propre (`anomalies/closing.ts`, utilisé aussi par `posting.ts`).
- **Corrections et impacts.** `buildCorrectionKey` construit les 31 états successifs ; l'écriture de correction d'une partie est la différence, compte par compte et par auxiliaire, entre deux états consécutifs ; les impacts (résultat, capitaux propres, CAF, autofinancement net, bilan) se lisent sur ces différences. `buildSynthesis` produit la synthèse de référence du §5. Cibles des impacts : `calibration.json` → `impacts` (contrôle seulement).
- **Faits de présentation** sans écriture : lignes d'annexe omises ou altérées (`presentation.annexCells`, appliquées par `buildAnnex`), reclassements des états (`presentation.reclassifications`), rapport de gestion (`facts.report`, lu par `report.ts`), variantes de documents (`facts.documents`).
- **Documents** : modèles structurés (`documents/model.ts` : blocs, indices rattachés aux blocs, modes d'accès) construits à partir des mondes propre et présenté ; faits narratifs (personnes, dates, montants cités par des tiers) dans `params/documents.json` ; aucun montant littéral dans `src/scenario/documents/` (garde-fou).
- **Ajustements du générateur** (consignés en PV-57 à PV-61) : effacements de dettes limités aux locataires restés dans les lieux, factures échues intégrant les retards ordinaires, calage de la dotation présentée sans toucher aux ex-locataires, vacance technique paramétrée.
- **Revue métier** : `npm run review-pack` écrit `docs/revue-metier/` (HTML et CSV, versionnés pour la validation).

### Choix d'implémentation de J3

- **Données du dossier.** Le Web Worker renvoie une seule charge utile (monde propre, clé de correction, documents, fausses pistes, données de contrôle). `src/ui/app/case.ts` (`CaseData`, lu par `useCase()`) en dérive paresseusement balances, annexe, FEC, index du FEC et index documentaire. Le joueur ne voit que le monde présenté ; le monde propre et la clé ne servent qu'au mode concepteur.
- **État de jeu = fonctions pures** (`src/game/state.ts` : lecture, annotations, preuves, pointage, marques, requêtes, réglages, journal). Le store Zustand (`src/ui/app/store.ts`) ne fait que les appliquer et sauvegarde automatiquement dans `localStorage` (`val-aurelle:autosave`, différée de 400 ms). Format versionné (`schemaVersion`, schéma Zod, migrations) ; une sauvegarde d'un autre scénario est refusée (`persistence.ts`).
- **État d'affichage** (recherche, filtres, onglet, tri) : stores Zustand propres à chaque écran, en mémoire seulement — il survit à la navigation, pas au rechargement. Les paramètres d'URL servent aux liens entre écrans (`/grand-livre?compte=&exercice=`, `/fec?ecriture=&requete=&exercice=`, `/etats?onglet=`, `/ged/:docId`).
- **Horloge** : fixée en J3 au 23/02/2026 (début du final, `params/game.json` → `startDate`), pour que le projet de comptes, la balance et le FEC soient consultables. Elle avancera en J4 (PV-77).
- **Disponibilité des documents** (`src/game/documents.ts`) : dossier initial (date du document ≤ date du jeu), courrier postérieur, sur demande, confirmation, condition ; les trois derniers modes seront alimentés en J4-J5. Le mode concepteur débloque tout.
- **Mode concepteur** : `?designer=1` (avant ou après le `#`) l'active, `?designer=0` le coupe ; il est conservé dans l'état. Il montre les indices et l'accès des documents, les écarts présenté / propre (balance, grand livre, FEC, états, ratios) et l'écran de contrôle de J1 (`/controle`).
- **Aucune aide à la détection hors mode concepteur** : pas de mise en évidence d'écritures, de lignes ou d'écarts ; les tests d'écritures (« tests courants ») et les seuils de la revue analytique sont génériques.
- **Paramètres** : nom du cabinet, équipe, encadrement, budgets, jauges, calendrier, multiples des montants ronds, seuil des couples de comptes rares (`params/game.json`) ; regroupements de comptes des ratios HLM et seuils de variation par défaut (`params/analysis.json` → `review`).
- **Vérification visuelle** : `node scripts/ui-check.mjs <url> <dossier> <route>[@designer]…` (Chromium : captures et erreurs de console).

## Commandes

```bash
npm install
npm run dev           # jeu (Vite) ; écran de contrôle : ?designer=1#/controle
npm test              # génère puis lance Vitest (≈ 20 s)
npm run build         # typecheck + site statique (dist/)
npm run build:single  # fichier HTML unique hors ligne (dist-single/index.html, ≈ 2 Mo)
npm run generate      # fichiers d'inspection dans generated/ ; « -- --update-lock » met à jour scenario.lock.json
npm run calibrate     # rapport cibles / obtenu (propres et présentés) ; « -- --solve » recalcule params/levers.json
npm run review-pack   # dossier de revue métier : docs/revue-metier/ (HTML + CSV)
npm run typecheck
```

## Carte du code

- `src/engine/` — moteur pur : montants, dates, aléa à graine, plan de comptes (CSV + import), écritures, balance, FEC, états, analyse (EBE, CAF, autofinancement net), sous-ledgers (amortissements par composant, échéanciers et ICNE).
- `src/scenario/params/` — paramètres éditables (JSON, plan de comptes CSV), validés par Zod (`schema.ts`).
- `src/scenario/generator/` — générateur du monde propre : `portfolio` (patrimoine, composants, subventions), `loans`, `tenancy` (baux, quittancement, LOGIGES, ventes), `purchases` (factures, investissements, paie, taxes, PGE, régularisation des charges), `sales`, `posting` (écritures 2024-2025), `index` (assemblage).
- `src/scenario/annex.ts`, `calibration.ts`, `fingerprint.ts`, `report.ts` — annexe (et altérations de présentation), rapport de calibrage, empreinte, rapport de gestion (délais de paiement, vacance, autofinancement net).
- `src/scenario/anomalies/` — `types.ts` (module, parties, signature, négociation, débrief), `draft.ts` (brouillon copie-sur-écriture), `closing.ts` (écritures dérivées), `modules/` (A01 à A22 par cycle), `presented.ts` (états, corrections, impacts), `synthesis.ts` (synthèse de référence).
- `src/scenario/documents/` — `model.ts`, `context.ts` (formats, constructeur, indices), `catalog/` (permanent, gouvernance, comptabilité, contrats, courrier et tiers, bruit), `false-leads.ts` (F1 à F7), `index.ts` (`buildDocuments`).
- `scripts/review-pack.ts` — dossier de revue métier.
- `src/game/` — règles pures du jeu (sans React) : `state.ts` (état et actions), `persistence.ts` (sauvegarde versionnée), `clock.ts` (périodes du calendrier), `documents.ts` (disponibilité, recherche plein texte, liste de la GED), `ledger.ts` (balance et grand livre), `fec-query.ts` (requêtes du FEC, couples rares, tests courants, exports), `ticking.ts` (pointage), `analysis.ts` (variations, ratios HLM, Livret A).
- `src/ui/` — `app/` (coquille, routes, palette Ctrl+K, store, `CaseData`, chargement par le worker), `components/` (primitives, tableau virtualisé, rendu des documents), `worker/` (génération du dossier), `screens/` : `desk` (bureau), `ged`, `balance`, `ledger` (grand livre), `fec`, `statements` (états et pointage), `analysis` (revue analytique), `control` (écran de contrôle de J1, mode concepteur).
- `tests/` — moteur, intégrité (balance ↔ sous-ledgers ↔ annexe ↔ FEC), calibrage, déterminisme, garde-fous ; J2 : monde présenté et invariant (`anomalies/presented`), impacts du §5 (`anomalies/impacts`), composabilité deux à deux (`anomalies/composability`), documents et indices (`documents/`) ; J3 : règles du jeu (`game/` : état, persistance, documents, grand livre, FEC, pointage, analyse).

Dépendances de développement : les alertes `npm audit` (vitest, braces) concernent l'outillage de développement, pas le jeu livré.
