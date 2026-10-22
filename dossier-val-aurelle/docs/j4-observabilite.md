# Dossier Val d'Aurelle — Observabilité des anomalies (annexe du plan J4)

> Annexe prévue au §20 du plan J4. Pour chaque partie d'anomalie : la date et la phase à partir desquelles un premier élément probant peut être observé, son mode d'obtention et les autres éléments disponibles ensuite. Le tableau est **calculé** par `tests/anomalies/observability.test.ts` à partir du dossier généré (dates des documents, modes d'accès, délais des interlocuteurs, millésimes des données) ; le test vérifie que chaque partie figure ici avec sa première date. Pour le régénérer :
>
> ```bash
> PRINT_OBSERVABILITY=1 npx vitest run tests/anomalies/observability.test.ts
> ```

## Règles de calcul

- **Dossier** (`initial`) : disponible à la date du document, au plus tôt le 03/11/2025 (début de la mission).
- **Courrier** (`afterDate`) : reçu à la date indiquée (courrier du mandataire, article de presse, actes, avis de dégrèvement).
- **Demande** (`onRequest`) : demande envoyée au plus tôt le 03/11/2025, réponse après le délai de l'interlocuteur en jours ouvrés (niveau senior). Une pièce qui existe à la date de la réponse arrive avec elle ; établie plus tard, elle arrive à sa date plus le délai (max(envoi + délai, date de la pièce)). Les réponses des familles établies à la date de la demande (factures et bons de commande d'un programme, ordres de service, réception d'une opération, ventes HLM) sont construites à cette date pour tous les objets, ceux du scénario compris (`facture-pac-erables`, `factures-peupliers`, `bons-commande-peupliers`, `os7-tilleuls`, `pv-reception-tilleuls`) : elles arrivent avec la réponse. Les pièces du scénario établies après la demande (promesses et courrier du notaire du Clos Fleuri, note de calcul de la DAF) ne sont ni listées ni annoncées : elles arrivent comme du courrier, à leur date plus le délai. Une demande de pièce justificative d'une écriture du FEC définitif ne peut partir qu'à la remise de la balance et du FEC définitifs (06/02/2026).
- **Confirmation** : réponse du tiers à sa date d'arrivée, si la demande a été préparée à l'intérim (envoi automatique le 06/01/2026).
- **Données** : l'anomalie se lit dans l'extraction au 31/10/2025 quand toutes ses écritures sont validées au plus tard à cette date (remise d'office au début de l'intérim, le 17/11/2025, ou sur demande au chef comptable dès le 04/11/2025) ; sinon dans la balance et le FEC définitifs (06/02/2026). Les états, l'annexe et le rapport de gestion arrivent le 20/02/2026 (projet) et le 02/03/2026 (rapport de gestion).
- Les pièces **conditionnelles** (courriels de la DAF, confidences du chef comptable : J5) ne sont pas comptées.

## Tableau

| Partie | Premier élément observable | Mode | Date | Phase | Autres éléments (date) |
|---|---|---|---|---|---|
| A01 | fiche-operation-tilleuls | dossier | 03/11/2025 | prise de connaissance et planification | invitation-inauguration-tilleuls (03/11/2025), pv-reception-tilleuls (06/11/2025), quittancement-programmes (08/01/2026), balance et FEC définitifs (06/02/2026), tableau-immobilisations (06/02/2026), tableau-subventions (06/02/2026), registre-composants-tilleuls (09/02/2026) |
| A02 | facture-pac-erables | demande | 04/11/2025 | prise de connaissance et planification | balance et FEC définitifs (06/02/2026), registre-composants (09/02/2026) |
| A03 | quittancement-clf-2025-12 | demande | 03/12/2025 | hors site | promesses-clos-fleuri (16/12/2025), levee-condition-clos-fleuri (07/01/2026), actes-clos-fleuri (14/01/2026), confirmation-notaire (16/01/2026), etat-ventes-hlm (26/01/2026), releve-bancaire-2026-01 (03/02/2026), balance et FEC définitifs (06/02/2026) |
| A04 | deliberation-relogement | dossier | 03/11/2025 | prise de connaissance et planification | pv-ca-2025-06 (03/11/2025), pv-ca-2025-09 (03/11/2025), avenant-anru-glycines (06/11/2025), rapport-vacance (15/01/2026), balance et FEC définitifs (06/02/2026), registre-composants-glycines-b (09/02/2026) |
| A05 | ppe-officiel | demande | 20/11/2025 | intérim | budget-2026 (16/12/2025), pv-ca-2025-12 (16/12/2025), ppe-daf (29/01/2026), tableau-provisions (30/01/2026), journal-ecritures-inventaire (04/02/2026), balance et FEC définitifs (06/02/2026) |
| A06 | bons-commande-peupliers | demande | 04/11/2025 | prise de connaissance et planification | factures-peupliers (04/11/2025), extraction au 31/10/2025 (17/11/2025), registre-composants-peupliers (09/02/2026), annexe-2025 (20/02/2026) |
| A07.a | annexe-2024 | dossier | 03/11/2025 | prise de connaissance et planification | rapport-prestataire-recouvrement (12/12/2025), stats-recouvrement (19/01/2026), calcul-depreciation-creances (22/01/2026), balance et FEC définitifs (06/02/2026), annexe-2025 (20/02/2026) |
| A07.b | decisions-surendettement | demande | 05/11/2025 | prise de connaissance et planification | calcul-depreciation-creances (22/01/2026), balance et FEC définitifs (06/02/2026) |
| A07.c | balance-agee-locataires | dossier | 08/01/2026 | hors site | balance et FEC définitifs (06/02/2026) |
| A08 | etat-dette | dossier | 14/01/2026 | hors site | calcul-icne (15/01/2026), confirmation-bdt (26/01/2026), balance et FEC définitifs (06/02/2026) |
| A09 | os-charmes | dossier | 03/11/2025 | prise de connaissance et planification | courrier-caducite-charmes (04/11/2025), arrete-subvention-charmes (05/11/2025), plan-financement-charmes (05/11/2025), registre-courrier-arrive (02/01/2026), confirmation-departement (03/02/2026), balance et FEC définitifs (06/02/2026), tableau-subventions (06/02/2026) |
| A10.a | memo-charges-recuperables | dossier | 03/11/2025 | prise de connaissance et planification | rapport-ancols-2022 (03/11/2025), courrier-association-locataires (05/11/2025), regularisation-charges-2025 (26/01/2026), balance et FEC définitifs (06/02/2026) |
| A10.b | memo-charges-recuperables | dossier | 03/11/2025 | prise de connaissance et planification | rapport-ancols-2022 (03/11/2025), courrier-association-locataires (05/11/2025), fiches-poste-gardiens (05/11/2025), regularisation-charges-2025 (26/01/2026), balance et FEC définitifs (06/02/2026) |
| A11 | conventions-gestionnaires-foyers | demande | 05/11/2025 | prise de connaissance et planification | confirmations-gestionnaires (22/01/2026), confirmation-ccas-aurelle (23/01/2026), etat-cap-par (04/02/2026), journal-ecritures-inventaire (04/02/2026), balance et FEC définitifs (06/02/2026), note-calcul-par-daf (02/03/2026) |
| A12.i | releve-bancaire-2025-09 | demande | 04/11/2025 | prise de connaissance et planification | convention-soutien-csh (05/11/2025), confirmation-csh (21/01/2026), annexe-2025 (20/02/2026) |
| A12.ii | pv-ca-2025-09 | dossier | 03/11/2025 | prise de connaissance et planification | composition-ca (05/11/2025), convention-soutien-csh (05/11/2025), registre-conventions (05/01/2026), confirmation-csh (21/01/2026) |
| A12.iii | convention-soutien-csh | demande | 05/11/2025 | prise de connaissance et planification |  |
| A13 | annexe-2024 | dossier | 03/11/2025 | prise de connaissance et planification | rapport-actuariel-2025 (22/01/2026), annexe-2025 (20/02/2026) |
| A14.i | balance-agee-fournisseurs | dossier | 09/01/2026 | hors site | rapport-gestion-2025 (02/03/2026) |
| A14.ii | rapport-gestion-2024 | dossier | 03/11/2025 | prise de connaissance et planification | rapport-vacance (15/01/2026), rapport-gestion-2025 (02/03/2026) |
| A14.iii | rapport-gestion-2025 | dossier | 02/03/2026 | final |  |
| A15 | balance-agee-locataires | dossier | 08/01/2026 | hors site | calcul-depreciation-creances (22/01/2026), balance et FEC définitifs (06/02/2026), article-presse-accueil-horizons (03/03/2026), courrier-mandataire (15/03/2026) |
| A16.a | os7-tilleuls | demande | 06/11/2025 | prise de connaissance et planification | registre-contentieux (10/01/2026), confirmation-bertin-lagarde (23/01/2026), balance et FEC définitifs (06/02/2026), reponse-avocate (12/02/2026) |
| A16.b | registre-contentieux | dossier | 10/01/2026 | hors site | confirmation-bertin-lagarde (23/01/2026), reponse-avocate (12/02/2026), annexe-2025 (20/02/2026) |
| A17 | memo-irl | dossier | 03/11/2025 | prise de connaissance et planification | note-gestion-locative-hausse (03/11/2025), pv-ca-2024-10 (03/11/2025), quittances-echantillon (05/11/2025), balance et FEC définitifs (06/02/2026) |
| A18 | releve-bancaire-2025-12 | demande | 02/01/2026 | hors site | detail-comptes-attente (12/01/2026), etat-dette (14/01/2026), confirmation-bdt (26/01/2026), balance et FEC définitifs (06/02/2026), balance-generale-2025 (06/02/2026) |
| A19 | journal-interface-octobre | demande | 04/11/2025 | prise de connaissance et planification | note-migration (04/11/2025), extraction au 31/10/2025 (17/11/2025), balance-auxiliaire-logiges (08/01/2026) |
| A20 | convention-gie | demande | 05/11/2025 | prise de connaissance et planification | confirmation-gie (19/01/2026), etat-cap-par (04/02/2026), balance et FEC définitifs (06/02/2026), factures-2026 (02/03/2026) |
| A21 | balance-generale-2025 | dossier | 06/02/2026 | hors site | annexe-2025 (20/02/2026) |
| A22 | comptes-certifies-2024 | dossier | 03/11/2025 | prise de connaissance et planification | etats-financiers-2025 (20/02/2026) |

## Lecture

- **Toutes les parties sont détectables avant la fin du final (13/03/2026).** La plupart ont un premier indice dès la planification (dossier permanent, PV, demandes de pièces) ; les anomalies de clôture (A07.c, A08, A14.i, A15, A16.b, A18, A21) n'apparaissent qu'avec les pièces de clôture de janvier-février 2026 ; A14.iii n'est observable qu'avec le rapport de gestion (02/03/2026, pendant le final).
- **A15** : la balance âgée (08/01/2026) montre neuf mois d'impayés dès la période hors site, mais l'élément **décisif** — le courrier du mandataire du 15/03/2026 — arrive après le final et avant la signature (20/05/2026) : la revue des événements postérieurs doit être mise à jour jusqu'au rapport.
- **A06 et A19** se lisent dans l'extraction au 31/10/2025 (écritures validées en octobre) : ils sont testables à l'intérim. **A11** (validée le 03/02/2026) n'existe que dans le FEC définitif, et la « note de calcul » de la DAF n'est remise qu'en réponse à une demande de pièce justificative de l'écriture.
- **A12.iii** ne repose que sur la convention de soutien : la partie se distingue des deux autres par son traitement (irrégularité, justification à demander), ce que l'appariement exige (`treatmentRequired`).
- Les mails de la DAF (A05, A11) restent hors calcul : ils renforcent les preuves sans être nécessaires à la détection.
