# Dossier Val d'Aurelle — notes de projet pour Claude

Jeu de rôle d'audit légal (navigateur, 100 % client) : le joueur audite les comptes 2025 de Val d'Aurelle Habitat, ESH fictive.

- Cahier des charges : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md). C'est la référence : le relire avant chaque jalon.
- Plan J0 : [`docs/plan-j0.md`](docs/plan-j0.md).
- Points à vérifier : [`docs/points-a-verifier.md`](docs/points-a-verifier.md).

## État d'avancement

| Jalon | Statut | Notes |
|---|---|---|
| J0 — Plan | Livré le 12/10/2026, **en attente de validation** | Décisions D1 à D7 du plan ; D2 (calibrage frais financiers / A08) à arbitrer |
| J1 — Moteur comptable | À faire | Ne pas commencer avant la validation de J0 |
| J2 — Anomalies et contenus | À faire | **Arrêt obligatoire** en fin de jalon : validation métier (dossier `docs/revue-metier/`) |
| J3 — Consultation | À faire | |
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

## Décisions prises (en attente de confirmation à J0)

- D1 : projet autonome dans `dossier-val-aurelle/`. Les Olympiades restent à la racine du dépôt ; leur déploiement Render n'utilise que le `package.json` racine.
- D2 : calibrage frais financiers / ICNE. Option 1 proposée (FF ≈ 11,3 / 10,4 M€, marge moyenne LA + 0,50, A08 ≈ −235 k€). **Non tranché.**
- D3 : impacts par écritures de correction en ordre canonique ; recalcul exact des mondes partiels.
- D4 : exercice 2024 simulé par le même générateur ; 2021-2023 en agrégats.
- D5 : écritures récapitulatives (quittancement programme × mois, encaissements jour × mode, amortissements programme × famille) ; FEC ≈ 32 000 lignes.
- D6 : données générées non versionnées ; empreinte `scenario.lock.json` versionnée.
- Simplifications de la V1 : voir `docs/plan-j0.md` §12 (TVA, prêts, historique, IS, anomalies toutes actives).

## Commandes (à partir de J1)

```bash
npm run generate      # génère public/scenarios/val-aurelle-2025/*.json
npm run dev
npm run test
npm run build         # site statique
npm run build:single  # fichier HTML unique
npm run calibrate     # rapport cibles / obtenu
npm run review-pack   # (J2) dossier de revue métier dans docs/revue-metier/
```

Les types du J0 compilent déjà :
`tsc --noEmit --strict --noUncheckedIndexedAccess --target ES2022 --module ESNext --moduleResolution bundler src/engine/types.ts src/scenario/types.ts src/game/types.ts`
