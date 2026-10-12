# Points à vérifier

Ce fichier recense toute référence, valeur ou convention dont l'exactitude n'est pas établie (§0.4 du cahier des charges). Le code ne cite une référence précise (article, paragraphe de NEP, numéro de compte) que si elle figure ici avec le statut **Validé**. Sinon, le contenu la formule de façon générale.

Légende :

- **Origine** — CDC : fourni par le cahier des charges ; Prop. : proposition de ma part.
- **Statut** — *À vérifier* (référence ou valeur à confirmer) ; *Défaut proposé* / *Défaut accepté (plan J0)* (choix de contenu proposé, accepté avec le plan J0, révisable à la revue métier de J2) ; **Validé** (confirmé par vous, avec la date).

Dernière mise à jour : J3 (12/10/2026) — J2 validé le 12/10/2026 : les choix « à valider » de la section G sont acceptés par défaut, révisables à tout moment.

---

## A. Références normatives et légales

| ID | Sujet | Ce qui sera utilisé | Où | Origine | Statut |
|---|---|---|---|---|---|
| PV-01 | Présomption de risque de fraude dans la comptabilisation des produits | Formulation exacte et caractère réfutable dans la NEP 240. Le jeu parle de « présomption à documenter » : réfutable pour le quittancement récurrent, pas pour les produits non récurrents ou de fin d'exercice. | Phase risques, débrief | CDC | À vérifier |
| PV-02 | Signalement des irrégularités et révélation des faits délictueux | C. com., art. L. 823-12 | A10, A11, A12, A17 | CDC | À vérifier |
| PV-03 | Conventions réglementées d'une SA à conseil d'administration | C. com., art. L. 225-38 à L. 225-42 : autorisation préalable, exclusion des conventions courantes conclues à des conditions normales, rapport spécial, conventions non autorisées. Dispositions propres au CCH sur les conventions des organismes HLM : à rechercher, non citées. | A12 | CDC | À vérifier |
| PV-04 | Avances en compte courant entre organismes d'un même groupe ; déclaration préalable | CCH, art. L. 423-15 | A12 (iii) | CDC | À vérifier |
| PV-05 | Délais de paiement dans le rapport de gestion | C. com., art. L. 441-14 et D. 441-6 (modèle de tableau) | A14 (i) | CDC | À vérifier |
| PV-06 | Quote-part récupérable de la rémunération des gardiens | Décret n° 82-955 du 9 novembre 1982 modifié : 75 % si le gardien assure l'entretien des parties communes **et** l'élimination des rejets ; 40 % (proposition) s'il n'assure que l'une des deux tâches ; éléments de rémunération retenus. | A10 | CDC + Prop. | À vérifier |
| PV-07 | Mention en annexe des engagements de retraite non provisionnés | Fondement (Code de commerce, PCG) non cité | A13 | Prop. | À vérifier |
| PV-08 | Normes d'exercice professionnel mobilisées | NEP 200, 210, 230, 240, 250, 260, 265, 300, 315, 320, 330, 450, 500, 505, 520, 530, 540, 550, 560, 570, 580, 700, 702, 9510 : numéros fournis, intitulés et paragraphes à confirmer avant toute citation de paragraphe. | Mémo, débriefs | CDC | À vérifier |
| PV-09 | Événement postérieur qui apporte des informations sur une situation existant à la clôture | NEP 560 et règles comptables sur les événements postérieurs ; classement d'A15 en événement donnant lieu à ajustement (jugement du 24/02/2026 et courrier du 15/03/2026, tous deux antérieurs à l'arrêté du 26/03/2026). | A15 | CDC | À vérifier |
| PV-10 | Autofinancement net HLM | Article du CCH et arrêté fixant les taux de référence : **non cités**. Définition du numérateur et du dénominateur ; taux de référence (0 % pour l'exercice, 3 % en moyenne sur trois exercices) ; méthode de la moyenne (moyenne des trois ratios **ou** ratio des cumuls, paramétrable ; moyenne des ratios par défaut) ; obligations en cas de franchissement (délibération, mention dans le rapport de gestion). | `params/regulatory.json`, A14 (iii), opinion | CDC | À vérifier |
| PV-11 | Révision annuelle des loyers des logements conventionnés | Au 1er janvier, dans la limite de la variation de l'IRL du 2e trimestre de l'année précédente ; dépassements possibles seulement avec un plan de redressement CGLLS ou après réhabilitation. Article du CCH non cité. | A17 | CDC | À vérifier |
| PV-12 | Décence énergétique | Loi Climat et résilience : logements classés G non décents pour les baux conclus ou renouvelés depuis le 01/01/2025 | Contexte des Glycines | CDC | À vérifier |
| PV-13 | Obligation d'appartenance à un groupe (moins de 12 000 logements) | Article du CCH non cité | Dossier permanent | CDC | À vérifier |
| PV-14 | Argument de la DAF sur A03 | C. civ., art. 1583 (vente parfaite dès l'accord sur la chose et le prix) | A03 | CDC | À vérifier |
| PV-15 | Déontologie (cadeaux, services interdits, autorévision) | Code de déontologie de la profession : articles non cités | E1, E2, E3 | CDC | À vérifier |
| PV-16 | Structure du rapport du commissaire aux comptes (entité non EIP) et vérifications spécifiques propres aux OLS | NEP 700 et 702 ; liste des vérifications spécifiques à confirmer | J6, rapport | CDC | À vérifier |

## B. Paramètres de marché et réglementaires

| ID | Sujet | Valeurs utilisées | Où | Origine | Statut |
|---|---|---|---|---|---|
| PV-17 | Taux du Livret A | 3 % jusqu'au 31/01/2025 ; 2,4 % du 01/02 au 31/07/2025 ; 1,7 % à compter du 01/08/2025. Historique antérieur (échéanciers 2022-2024) : 1 % au 01/02/2022, 2 % au 01/08/2022, 3 % au 01/02/2023. | `regulatory.json`, prêts, A08 | CDC + Prop. | À vérifier |
| PV-18 | IRL | T2 2024 : 145,17 (+3,26 %) ; T2 2025 : 146,68 (+1,04 %) ; plafonnement à 3,5 % du T3 2022 au T1 2024 | A17, mémo | CDC | À vérifier |
| PV-19 | Produits de prêt de la Banque des Territoires | Marges indicatives : PLUS LA + 0,60 ; PLAI LA − 0,20 ; PAM LA + 0,60 ; éco-prêt LA − 0,45 ; PLS LA + 1,11 ; PHB 0 % pendant 20 ans puis LA + 0,60. Révision simple (Livret A à la date d'échéance + marge), base exact/365, échéances annuelles. Double révisabilité et progressivité non modélisées. | `loan-products.json`, A08, A18 | Prop. | À vérifier |
| PV-20 | Durées d'amortissement par composant | Celles du §5 A01 (structure 50 ans ; menuiseries, chauffage, étanchéité, électricité, plomberie 25 ; ravalement-ITE 20), complétées par ascenseurs, VRD, aménagements intérieurs (durées à proposer en J1) ; nomenclature de l'organisme **sans** « agencements divers 15 ans » (A06). | `components.json` | CDC + Prop. | À vérifier |

## C. Cadre comptable OLS 2025

| ID | Sujet | Ce qui sera utilisé | Où | Origine | Statut |
|---|---|---|---|---|---|
| PV-21 | Textes du cadre | Règlement ANC n° 2015-04 et instruction comptable OLS applicable aux exercices 2025 ; réforme : règlement ANC n° 2025-05 du 05/12/2025 (intégrant le règlement ANC n° 2022-06), applicable aux exercices ouverts à compter du 01/01/2026, **non utilisé**. Intitulés exacts à confirmer. | Mémo, annexe | CDC | À vérifier |
| PV-22 | Plan de comptes proposé (J1) | Chaque compte incertain porte `a_valider = oui`. Points d'attention : emprunts par prêteur ; RLS (compte, présentation en déduction des loyers) ; PGE ; comptes de locataires (présents, partis, douteux, créditeurs) ; dépôts de garantie reçus ; quote-part des subventions virée au résultat ; valeur comptable des éléments sortis (cession, démolition, remplacement) ; produits des activités annexes ; récupération des charges et régularisation (produits à recevoir, charges à payer) ; compte d'attente. | `plan-comptable-ols-2025.csv` | Prop. | À vérifier |
| PV-23 | Modèles d'états OLS 2025 | Rubriques du bilan et du compte de résultat ; dépôts de garantie des locataires dans les dettes financières (référence d'A22). | Mapping des états | CDC + Prop. | À vérifier |
| PV-24 | Postes de la CAF (méthode additive) | Exclus : dotations et reprises d'amortissements, de dépréciations et de provisions (dont PGE et dépréciation des créances locatives), quote-part des subventions, plus et moins-values de cession. Inclus : pertes sur créances irrécouvrables. Cette répartition est **cohérente avec la liste du §5** des anomalies qui affectent l'autofinancement net (A06, A07-b, A08, A10, A11, A17, A19, A20). | `caf` dans les paramètres | CDC + Prop. | À vérifier |
| PV-25 | Définition de l'EBE du ratio EBE / loyers | Soldes intermédiaires de gestion du PCG (hors autres charges et produits de gestion, financiers, exceptionnels) **ou** définition sectorielle OLS | Calibrage, analyse | Prop. | À vérifier |
| PV-26 | Provision pour gros entretien | Méthode (plan pluriannuel d'entretien, dépenses éligibles, quote-part provisionnée) dans le cadre ANC 2015-04 | A05, PGE | Prop. | À vérifier |
| PV-27 | Démolition décidée (A04) | Référence du jeu : révision prospective du plan d'amortissement à compter du 01/07/2025 jusqu'au 31/12/2027, avec reprise accélérée des subventions. Crédit partiel pour une approche par dépréciation dûment justifiée. Coûts de démolition et financements ANRU non comptabilisés en 2025. | A04 | CDC | À vérifier |
| PV-28 | Ventes HLM | Traitement du solde des subventions des biens cédés ; affectation éventuelle des plus-values de cession propre aux ESH | Ventes, A03 | Prop. | À vérifier |

## D. Choix de contenu proposés par défaut

| ID | Sujet | Proposition | Où | Origine | Statut |
|---|---|---|---|---|---|
| PV-29 | A10 — courrier de l'association contestant la régularisation 2024 | Le **projet** de régularisation 2024, présenté en réunion de concertation en juin 2025, incluait les honoraires du syndic et 100 % des gardiens. Après la contestation, la régularisation envoyée a été rectifiée : les comptes 2024 sont justes. La régularisation 2025 reprend les mêmes erreurs. Le courrier devient un indice fort, sans erreur sur 2024. | A10 | Prop. | Défaut accepté (plan J0) |
| PV-30 | A06 — 82 k€ de portes palières | Correction limitée aux 378 k€. La durée de 15 ans appliquée aux 82 k€ (composant absent de la nomenclature) est commentée au débrief : écart ≈ 0,7 k€, insignifiant. Les anciennes portes, totalement amorties, ne donnent lieu à aucune sortie. | A06 | Prop. | Défaut accepté (plan J0) |
| PV-31 | A19 — contenu du lot doublé | Lignes de loyer (loyer principal et RLS) du lot de quittancement d'octobre 2025 des Saules, 52,3 k€ nets. APL et provisions pour charges passent par des lots séparés, non doublés. | A19 | Prop. | Défaut accepté (plan J0) |
| PV-32 | A02 — subventions de l'ancienne chaufferie | Chaufferie de 2008 financée sans subvention : aucune reprise de subvention résiduelle à la sortie | A02 | Prop. | Défaut accepté (plan J0) |
| PV-33 | A03 — subventions et séquestre | Aucune somme versée au vendeur à la promesse. **Révisé en J2** : les subventions du Clos Fleuri ne sont pas entièrement reprises ; la quote-part résiduelle des 7 pavillons (≈ 34 k€) n'est pas reprise par l'écriture de cession présentée (voir PV-55). | A03 | Prop. | Défaut accepté (revue J2) |
| PV-34 | A01 et A16 — coût des Tilleuls | 9,55 M€ hors ordre de service n° 7 (210 k€) et nets des 340 k€ de pénalités retenues (déduites du coût, pas comptées en produit). Coût propre : 9,76 M€. | A01, A16 | Prop. | Défaut accepté (plan J0) |
| PV-35 | Ventes et patrimoine | Les « 25 ventes effectives » s'entendent hors les 7 pavillons du Clos Fleuri. Le patrimoine de 8 600 logements au 31/12/2025 inclut ces 7 pavillons (vendus en 2026). L'état des ventes présenté compte 32 sorties. | A03, rapport de gestion | Prop. | Défaut accepté (plan J0) |
| PV-36 | A11 — compte de la PAR | Compte générique de produits à recevoir, en contrepartie des produits des activités annexes. La PAR ne vise pas nommément Accueil Horizons, pour éviter tout recoupement mécanique avec A15. | A11 | Prop. | Défaut accepté (plan J0) |
| PV-37 | Chronologie des validations (FEC) | Reprise excédentaire de PGE (A05) validée entre le 28 et le 30/01/2026 ; PAR d'A11 validée le 03/02/2026. Résultat ≈ 8,12 M€ avant A05 et A11, 8,9 M€ avant A11, 9,2 M€ au final. | A05, A11, FEC | Prop. | Défaut accepté (plan J0) |
| PV-38 | A17 — assiette de la restitution | Loyers des logements conventionnés révisés au 01/01/2025, hors premières mises en location de 2025 (Les Tilleuls), commerces, stationnements et redevances de foyers ; aucun loyer plafond de convention atteint. Assiette implicite ≈ 42,3 M€. | A17 | Prop. | Défaut accepté (plan J0) |
| PV-39 | A07 — périmètre | Base des ex-locataires nette des dépôts de garantie conservés : 3 115 k€. Effacements de dettes (rétablissement personnel) décidés en 2025, donc pertes de 2025. | A07 | CDC + Prop. | Défaut accepté (plan J0) |
| PV-40 | Comptes 2024 « certifiés » | Identiques au monde propre 2024 : aucune anomalie en 2024. Seule la présentation de la colonne N-1 est altérée en 2025 (A22). | Comparatif, tests | Prop. | Défaut accepté (plan J0) |

## E. Calibrage

| ID | Sujet | Proposition | Où | Origine | Statut |
|---|---|---|---|---|---|
| PV-41 | Frais financiers, ICNE (A08) et structure de la dette : cibles incompatibles | Voir `plan-j0.md` §2.2 et `annexes/simulation-frais-financiers.py`. **Option 1 retenue** : FF ≈ 11,3 M€ (2024) et ≈ 10,4 M€ (2025 présentés), marge moyenne ≈ LA + 0,50, A08 ≈ −236 k€. Obtenu en J1 : FF 2024 11,55 M€, FF 2025 propres 10,29 M€ (présentés ≈ 10,52 M€), A08 −236,0 k€, marge moyenne pondérée LA + 0,55. | `calibration.json` | Prop. | **Validé (12/10/2026)** |
| PV-42 | Dotation aux dépréciations des créances présentée | 1 425 k€ exactement (cible implicite d'A21) | Calibrage | Prop. | Défaut accepté (plan J0) |
| PV-43 | Dénominateur du ratio d'autofinancement net | ≈ 48,8 M€, déduit de l'écart de 2,6 pts pour 1 268 k€ | Calibrage | Prop. | Défaut accepté (plan J0) |

## F. Modélisation retenue en J1 pour tenir les cibles

| ID | Sujet | Choix retenu | Où | Origine | Statut |
|---|---|---|---|---|---|
| PV-44 | Taille du bilan (§4.3) | Total ≈ 620 M€ et capitaux propres ≈ 224 M€ (comptes propres) avec des dotations ≈ 16,7 M€ imposées par le résultat et la CAF cibles. Obtenu par : foncier ≈ 225 M€ (24 % des immobilisations brutes : 14 % pour les programmes anciens, jusqu'à 41 % pour les opérations récentes en zone tendue), sept opérations en cours (≈ 51 M€), subventions concentrées sur les réhabilitations (taux ≈ 40 %, ANRU/PNRU) plutôt que sur les constructions neuves (8 à 15 %). | `scenario.json`, générateur | Prop. | À vérifier (réalisme) |
| PV-45 | Décomposition rétrospective | Programmes antérieurs à 2005 décomposés lors du passage aux composants avec une structure de 75 % (menuiseries 5 %, chauffage 6 %, étanchéité 3 %, ravalement 4 %, électricité 4 %, plomberie 3 %) ; programmes postérieurs : répartition du §5-A01. Réhabilitations : composant « restructuration » (structure, 50 ans) de 25 %. | `components.json` | Prop. | À vérifier |
| PV-46 | Dette | 126 prêts. Banque des Territoires 307,5 M€ (dont PHB 2,5 M€) ; allongement de 5 ans des durées résiduelles en 2019-2020 ; prêts bancaires à taux fixe 0,7 % à 2,2 % (amortissement constant, échéances trimestrielles) ; prêts Action Logement à taux fixe bas. Échéances annuelles pour la Banque des Territoires ; annuité recalculée à chaque révision. | `loans.ts` | Prop. | À vérifier |
| PV-47 | Loyers et occupation | Loyer moyen 2025 ≈ 458 €/mois ; rotation 8,5 % par an ; vacance de relocation de 3,6 mois en moyenne (révisé en J2, PV-61) ; seul La Roseraie (1959) est non conventionné, d'où une assiette d'A17 ≈ 42 M€ ; RLS pour la moitié des ménages ; APL en tiers payant (≈ 47 %). | `scenario.json`, `tenancy.ts` | Prop. | À vérifier |
| PV-48 | Récupération des charges | Charges récupérables imputées par programme ; part récupérée = charges × taux d'occupation (la quote-part des logements vacants reste à la charge du bailleur) ; gardiens 75 %, employés d'immeuble 100 % (PV-06) ; régularisation N facturée en juin N+1. | `purchases.ts` | Prop. | À vérifier |
| PV-49 | Créances locatives | Méthode de l'annexe (§5-A07) appliquée locataire par locataire ; dotations et reprises calculées en variations individuelles ; soldes créditeurs reclassés au passif à la clôture (extourne au 1er janvier) ; dépôts de garantie imputés à la sortie, sauf « conservés » pour une partie des ex-locataires. | `posting.ts`, `tenancy.ts` | Prop. | À vérifier |
| PV-50 | Dégrèvements de TFPB et indemnités | En produits exceptionnels (7718) : ≈ 1,05 M€ en 2024 (encaissés), 0,85 M€ de produit à recevoir en 2025 (F2). | `scenario.json` | Prop. | À vérifier (classement, PV-22) |
| PV-51 | Charges d'exploitation | Entretien courant non récupérable ≈ 3,2 M€ en 2024 et en 2025 (levier de calibrage) ; personnel 8,2 → 8,84 M€ (+7,8 %, F3) ; TFPB 4,8 → 5,17 M€ (+7,7 %, F5) ; honoraires 0,45 → 0,70 M€ (+55 %, F1). | `scenario.json`, `levers.json` | Prop. | À vérifier |
| PV-52 | Dates et utilisateurs de saisie | Interface de quittancement validée en fin de mois avant la migration du 01/10/2025, puis au fil de l'eau ; écritures d'inventaire 2025 validées du 12/01 au 06/02/2026 ; écritures de reprise des soldes du week-end des 27-28/09/2025 (utilisateur MIGRATION, F7). | `posting.ts` | Prop. | Défaut proposé |

## G. Choix retenus en J2 (anomalies, documents, revue métier)

| ID | Sujet | Choix retenu | Où | Origine | Statut |
|---|---|---|---|---|---|
| PV-53 | Écritures de correction et impacts | Calculés par différence, compte par compte, entre l'état où une partie est corrigée et celui où elle ne l'est pas, les parties précédentes (ordre canonique A01 → A22, parties a, b, c) étant déjà corrigées. Les impacts ne dépendent de l'ordre que pour les anomalies qui interagissent (A01 et A16 sur les Tilleuls ; A07 et A15 via la dépréciation recalculée). | `anomalies/presented.ts` | Prop. (D3) | Défaut proposé |
| PV-54 | Écritures dérivées des sous-ledgers | Amortissements, quote-part des subventions et dépréciation des créances ne sont jamais patchés à la main : l'anomalie modifie le sous-ledger (registre, tiers) et l'écriture est recalculée par le même algorithme que le monde propre (testé). | `anomalies/closing.ts`, `draft.ts` | Prop. | Défaut proposé |
| PV-55 | A03 — écriture de cession présentée | Une écriture par pavillon au 31/12/2025 (promesse du 12/12/2025) : produit, créance sur le notaire, sortie des composants à leur valeur nette au 31/12/2025. La quote-part résiduelle des subventions (≈ 34 k€) **n'est pas reprise** : avec une reprise, l'impact serait ≈ 804,7 k€ au lieu des 770,5 k€ du §5. | `modules/fixed-assets.ts` | Prop. | Défaut accepté (revue J2) |
| PV-56 | A06 — forme de l'immobilisation | Les trois factures d'entretien, d'abord comptabilisées en 61521, sont transférées en immobilisations par une écriture d'OD du 30/09/2025 (D 2135 / C 61521) ; un seul composant de 460 k€ sur 15 ans (« travaux d'amélioration, agencements divers »). Incohérence à trancher : dans le monde propre, les portes palières (82 k€) restent dans la famille « agencements divers 15 ans », que l'indice du §5 dit absente de la nomenclature (PV-20, PV-30). | A06 | Prop. | Défaut accepté (revue J2) |
| PV-57 | A07-b — périmètre des effacements | Les 45 dossiers de rétablissement personnel (238 k€) concernent des locataires restés dans les lieux (générateur ajusté en J2). Comptes présentés : maintenus en « présents de plus de 6 mois » à 50 %, sans mouvement de dépréciation ; comptes propres : perte de 238 k€ et reprise de 119 k€. | A07, `tenancy.ts` | Prop. | Défaut proposé |
| PV-58 | A07-a / A21 — calage de la dotation présentée | La dotation présentée (1 425 k€) est obtenue en déplaçant des soldes entre locataires d'une même catégorie (procédure, puis plus de 6 mois), sans toucher aux ex-locataires : la base d'A07-a reste exactement 3 115 k€ et le taux de recouvrement des ex-locataires reste ≈ 4 % par an. | `tenancy.ts` | Prop. | Défaut proposé |
| PV-59 | A10 — régularisation présentée | Le produit à recevoir présenté ajoute les honoraires du syndic (96 k€) et 25 % du coût des gardiens (158 k€) **sans** appliquer le taux d'occupation (contrairement aux autres charges), pour retrouver l'impact du §5 (254 k€). | A10 | Prop. | Défaut accepté (revue J2) |
| PV-60 | A14 — définitions du rapport de gestion | Délais de paiement : 312 factures échues non réglées pour 1,42 M€, y compris les factures ordinairement réglées avec retard (générateur ajusté en J2). Taux de vacance au 31/12 : 3,3 % selon la définition 2024 (toute vacance) contre 2,1 % hors vacance technique (§5 : 3,4 % et 2,1 %). Ratio d'autofinancement net du rapport : celui des comptes présentés. | `report.ts` | CDC + Prop. | Défaut accepté (revue J2) |
| PV-61 | Vacance technique | Relocation en 3,6 mois en moyenne ; 40 % des départs de 2025 dans six programmes anciens suivis de travaux lourds (logements neutralisés). Paramètres choisis pour retrouver les taux du §5 (PV-60). | `scenario.json` (`rents`) | Prop. | À vérifier (réalisme) |
| PV-62 | A16 — présentation du passif éventuel | Dans les comptes propres, le litige (pénalités contestées de 340 k€) figure dans le tableau des engagements hors bilan (ligne « passif éventuel ») ; une note dédiée aux litiges serait peut-être plus usuelle. | `annex.ts` | Prop. | Défaut accepté (revue J2) |
| PV-63 | A08 — périmètre du taux forfaitaire | Le taux unique de 3 % ne s'applique qu'aux prêts indexés sur le Livret A ; les prêts à taux fixe et le prêt de haut de bilan (taux nul) gardent leurs intérêts courus exacts. | A08 | CDC + Prop. | Défaut proposé |
| PV-64 | A18 — monde présenté | Le prêt de haut de bilan est absent de l'état de la dette du client et son versement est crédité au compte d'attente 471 ; la Banque des Territoires confirme 307,5 M€ contre 305,0 M€ en comptabilité. | A18 | CDC | Défaut proposé |
| PV-65 | A21 — erreur de report | Inversion des 2e et 3e chiffres de la dotation aux dépréciations des créances locatives dans le tableau des provisions de l'annexe (1 425 k€ → 1 245 k€). | `annex.ts` | CDC | Défaut proposé |
| PV-66 | A12 — informations hors comptabilité | Annexe (solde non tiré de 2,0 M€, partie liée), rapport spécial et déclaration au titre du CCH traités comme des faits de présentation (aucune écriture). | A12 | CDC | Défaut proposé |
| PV-67 | Personnes, tiers et dates narratives des documents | Noms fictifs (personnes du §4.5 complétées : DG de l'ESH sœur, directeur du GIE, interlocuteurs du Département et de la Banque des Territoires, actuaire, maître d'œuvre, prestataire de recouvrement), dates des PV, courriers et réponses de tiers : `params/documents.json`. Aucun nom de personne ou d'organisme réel. | `documents.json` | Prop. | À vérifier |
| PV-68 | Mémos techniques du cabinet | Le mémo « révision des loyers » cite la variation de l'IRL et la fin du plafonnement (PV-11, PV-18) ; le mémo « charges récupérables » cite le décret n° 82-955 modifié et les quotes-parts des gardiens (PV-06). Ces références restent « à vérifier » et sont signalées comme telles dans les mémos. | `catalog/permanent.ts` | CDC | À vérifier |
| PV-69 | Statistiques de recouvrement et rapport du prestataire | Taux de recouvrement des ex-locataires calculés sur 2024 et 2025 (≈ 4 %) ; 2023 non modélisé. Rapport du prestataire : 1,2 % de la base nette au 31/12/2025. | `catalog/accounting-operations.ts` | CDC + Prop. | Défaut proposé |
| PV-70 | Accès aux documents | Cinq modes : dossier initial, sur demande précise (libellé de demande), réponse de tiers à une date du calendrier, courrier postérieur à une date, document conditionnel (mails de la DAF si le chef comptable se confie). Mise en œuvre en J4. | `documents/model.ts` | Prop. | Défaut proposé |
| PV-71 | Volume documentaire | 125 documents, dont 29 de « bruit » (23 %) ; 127 indices ; chaque anomalie a au moins deux indices dans des documents distincts, et chaque fausse piste au moins deux pièces qui l'écartent (tests bloquants). | `documents/` | CDC | Défaut proposé |

