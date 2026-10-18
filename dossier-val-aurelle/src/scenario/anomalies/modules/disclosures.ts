/** Annex, management report and governance: A12, A13, A14, A21, A22. */
import { acct, doc, tp } from '../refs';
import { item } from './util';
import type { AnomalyModule } from '../types';

export const A12: AnomalyModule = {
  id: 'A12',
  title: 'Avance à l’ESH sœur : engagement hors bilan et convention réglementée',
  cycle: 'crossCycle',
  assertions: ['exhaustivité de l’annexe', 'conformité'],
  classification: 'factual',
  severity: 3,
  difficulty: 3,
  parts: [
    {
      id: 'A12.i',
      label: 'Annexe : engagement donné (solde non tiré de l’avance) et transaction avec une partie liée',
      signature: { cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN'), acct('2748'), doc('convention-soutien-csh')], natures: ['completeness', 'presentation'] },
      treatment: 'disclose',
      cycles: ['crossCycle', 'debtTreasury', 'fixedAssets', 'disclosures'],
      keyObjects: [item('off-balance-commitments'), item('related-parties'), acct('2748'), doc('releve-bancaire-2025-09')],
      disclosureItems: ['off-balance-commitments', 'related-parties'],
      creditBasis: ['disclosure'],
      expectedFixes: ['add-missing'],
      disclosureFix: 'Mentionner en annexe l’engagement donné (solde non tiré de l’avance à Coteaux du Serein Habitat) et la transaction avec une partie liée ; documenter la recouvrabilité de l’avance (soutien de la société de tête).',
    },
    {
      id: 'A12.ii',
      label: 'Convention non autorisée préalablement et non conclue à des conditions normales : mention au rapport spécial',
      signature: { cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN'), doc('convention-soutien-csh'), doc('composition-ca')], natures: ['compliance'] },
      treatment: 'specialReport',
      cycles: ['crossCycle', 'debtTreasury', 'fixedAssets', 'disclosures'],
      keyObjects: [doc('composition-ca'), doc('registre-conventions'), doc('pv-ca-2025-09')],
      creditBasis: ['disclosure'],
      expectedFixes: ['special-report'],
      disclosureFix: 'Rapport spécial : convention non autorisée préalablement (administrateur commun), avance sans intérêt.',
    },
    {
      id: 'A12.iii',
      label: 'Déclaration préalable de l’avance au titre du CCH non justifiée : à demander, irrégularité à signaler',
      signature: { cycle: 'crossCycle', objects: [tp('COTEAUX_SEREIN'), doc('convention-soutien-csh')], natures: ['compliance'] },
      treatment: 'governance',
      cycles: ['crossCycle', 'debtTreasury', 'fixedAssets', 'disclosures'],
      creditBasis: ['disclosure'],
      expectedFixes: ['governance-irregularity', 'request-justification'],
      disclosureFix: 'Demander la justification de la déclaration préalable de l’avance ; à défaut, signaler l’irrégularité au conseil.',
    },
  ],
  apply(draft, ctx) {
    if (ctx.isActive('A12.i')) draft.annexCells.push({ table: 'engagements', rowId: 'avance-groupe', column: '*', transform: 'omit' });
    if (ctx.isActive('A12.ii')) draft.facts.documents['specialReport.missingConventions'] = ['convention-soutien-csh'];
    if (ctx.isActive('A12.iii')) draft.facts.documents['cch.advanceDeclaration'] = 'missing';
  },
  stance: [
    { partId: 'A12.i', stance: 'yieldsOnEvidence', character: 'ceo', argument: 'C’est une opération de groupe, demandée par l’actionnaire : il n’y a rien à dire de plus.', requiredEvidence: ['convention-soutien-csh'], requiresPartner: true },
    { partId: 'A12.ii', stance: 'contests', character: 'ceo', argument: 'Le conseil était informé de façon informelle.' },
    { partId: 'A12.iii', stance: 'yieldsOnEvidence', character: 'cfo', argument: 'Je vais vérifier si la déclaration a été faite.', requiredEvidence: ['convention-soutien-csh'] },
  ],
  debrief: {
    explanation:
      'La convention de soutien (avance plafonnée à 3,5 M€, sans intérêt, 1,5 M€ versés) est conclue avec une société dont le président du conseil est administrateur : elle devait être autorisée préalablement et, n’étant pas conclue à des conditions normales, elle relève du rapport spécial. Le solde non tiré est un engagement donné à mentionner en annexe, comme la transaction avec une partie liée. La déclaration préalable de l’avance au titre du CCH doit être justifiée.',
    references: ['CCOM-L225-38', 'CCH-L423-15', 'NEP550', 'PCG-ANNEXE', 'CCOM-L823-12'],
    goodPractice: 'Rapprocher les mouvements avec les entités du groupe des conventions et des PV du conseil ; comparer la composition des conseils pour identifier les administrateurs communs.',
    procedures: ['Revue des conventions réglementées', 'Lecture des PV du conseil', 'Demande de confirmation à l’ESH sœur'],
  },
};

export const A13: AnomalyModule = {
  id: 'A13',
  title: 'Engagements de fin de carrière omis dans l’annexe',
  cycle: 'disclosures',
  assertions: ['exhaustivité de l’annexe'],
  classification: 'factual',
  severity: 1,
  difficulty: 1,
  parts: [
    {
      id: 'A13',
      label: 'Annexe : mention du montant des indemnités de fin de carrière non provisionnées',
      signature: { cycle: 'disclosures', objects: [doc('rapport-actuariel-2025'), doc('annexe-2024')], natures: ['completeness'] },
      treatment: 'disclose',
      cycles: ['disclosures', 'provisions'],
      keyObjects: [item('retirement-commitments'), doc('rapport-actuariel-2025')],
      disclosureItems: ['retirement-commitments'],
      creditBasis: ['disclosure'],
      expectedFixes: ['add-missing'],
      disclosureFix: 'Compléter l’annexe : engagements de retraite (indemnités de fin de carrière) non provisionnés, selon le rapport actuariel 2025.',
    },
  ],
  apply(draft) {
    draft.annexCells.push({ table: 'engagements', rowId: 'ifc', column: '*', transform: 'omit' });
  },
  stance: [{ partId: 'A13', stance: 'accepts', character: 'cfo', argument: 'Un oubli dans la mise à jour de l’annexe.' }],
  debrief: {
    explanation: 'L’organisme ne provisionne pas ses indemnités de fin de carrière (option permise) mais doit en mentionner le montant en annexe ; l’annexe 2025 l’omet alors que le rapport actuariel est disponible.',
    references: ['PCG-ANNEXE'],
    goodPractice: 'Comparer l’annexe de l’exercice à celle de l’exercice précédent, rubrique par rubrique.',
    procedures: ['Revue comparative des annexes N et N-1', 'Lecture du rapport actuariel'],
  },
};

export const A14: AnomalyModule = {
  id: 'A14',
  title: 'Rapport de gestion : informations inexactes',
  cycle: 'disclosures',
  assertions: ['concordance et sincérité du rapport de gestion'],
  classification: 'factual',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A14.i',
      label: 'Délais de paiement fournisseurs : factures échues non réglées omises',
      signature: { cycle: 'disclosures', objects: [doc('rapport-gestion-2025'), doc('balance-agee-fournisseurs')], natures: ['compliance', 'presentation'] },
      treatment: 'report',
      cycles: ['disclosures', 'crossCycle'],
      keyObjects: [item('payment-terms'), doc('balance-agee-fournisseurs')],
      disclosureItems: ['payment-terms'],
      creditBasis: ['disclosure'],
      expectedFixes: ['correct-amount'],
      disclosureFix: 'Rectifier le tableau des délais de paiement fournisseurs du rapport de gestion.',
    },
    {
      id: 'A14.ii',
      label: 'Taux de vacance annoncé hors vacance technique, sans définition et différent de N-1',
      signature: { cycle: 'disclosures', objects: [doc('rapport-gestion-2025'), doc('rapport-vacance'), doc('rapport-gestion-2024')], natures: ['presentation'] },
      treatment: 'report',
      cycles: ['disclosures', 'crossCycle'],
      keyObjects: [item('vacancy'), doc('rapport-vacance'), doc('rapport-gestion-2024')],
      disclosureItems: ['vacancy'],
      creditBasis: ['disclosure'],
      expectedFixes: ['correct-amount', 'specify-definition'],
      disclosureFix: 'Rectifier le taux de vacance (définition de N-1) ou préciser la définition retenue.',
    },
    {
      id: 'A14.iii',
      label: 'Ratio d’autofinancement net à mettre à jour après corrections',
      signature: { cycle: 'disclosures', objects: [doc('rapport-gestion-2025')], natures: ['presentation'] },
      treatment: 'report',
      cycles: ['disclosures', 'crossCycle'],
      keyObjects: [item('net-self-financing')],
      disclosureItems: ['net-self-financing'],
      creditBasis: ['disclosure'],
      expectedFixes: ['update-after-corrections', 'correct-amount'],
      disclosureFix: 'Mettre à jour le ratio d’autofinancement net du rapport de gestion après prise en compte des corrections.',
    },
  ],
  apply(draft, ctx) {
    if (ctx.isActive('A14.i')) draft.facts.report['paymentTerms.overdue'] = 'none';
    if (ctx.isActive('A14.ii')) draft.facts.report['vacancy.definition'] = 'excludingTechnical';
    if (ctx.isActive('A14.iii')) draft.facts.report['netSelfFinancing.basis'] = 'presented';
  },
  stance: [
    { partId: 'A14.i', stance: 'accepts', character: 'cfo' },
    {
      partId: 'A14.ii',
      stance: 'yieldsOnEvidence',
      character: 'cfo',
      argument: 'Notre définition exclut la vacance technique : les logements neutralisés ne sont pas à louer.',
      requiredEvidence: ['rapport-gestion-2024', 'rapport-vacance'],
    },
    { partId: 'A14.iii', stance: 'accepts', character: 'cfo' },
  ],
  debrief: {
    explanation:
      'Le commissaire aux comptes vérifie la sincérité et la concordance avec les comptes des informations du rapport de gestion, dont les délais de paiement. Le tableau omet les factures échues non réglées ; le taux de vacance change de définition sans le dire ; le ratio d’autofinancement net doit refléter les comptes corrigés. À défaut de rectification, une observation est portée dans la partie « vérifications spécifiques » du rapport.',
    references: ['NEP9510', 'CCOM-L441-14', 'CCH-AUTOFINANCEMENT', 'NEP700'],
    goodPractice: 'Rapprocher chaque donnée chiffrée du rapport de gestion de sa source (balance âgée, données de gestion, comptes) et des définitions de l’exercice précédent.',
    procedures: ['Vérifications spécifiques du rapport de gestion', 'Rapprochement avec la balance âgée fournisseurs', 'Comparaison avec le rapport de gestion N-1'],
  },
};

export const A21: AnomalyModule = {
  id: 'A21',
  title: 'Erreur de report dans l’annexe',
  cycle: 'disclosures',
  assertions: ['présentation', 'concordance annexe / comptes'],
  classification: 'factual',
  severity: 1,
  difficulty: 1,
  parts: [
    {
      id: 'A21',
      label: 'Tableau des provisions : dotation aux dépréciations des créances locatives (inversion de chiffres)',
      signature: { cycle: 'disclosures', objects: [doc('annexe-2025'), acct('68174')], natures: ['presentation'] },
      treatment: 'disclose',
      cycles: ['disclosures', 'provisions'],
      keyObjects: [item('provisions-table')],
      disclosureItems: ['provisions-table'],
      creditBasis: ['disclosure'],
      expectedFixes: ['correct-amount', 'reconcile-table'],
      disclosureFix: 'Corriger la dotation du tableau des provisions et rapprocher le total de la balance.',
    },
  ],
  apply(draft) {
    draft.annexCells.push({ table: 'provisions', rowId: 'creances-locataires', column: 'dotations', transform: 'transposeDigits23' });
  },
  stance: [{ partId: 'A21', stance: 'accepts', character: 'chiefAccountant', argument: 'Une faute de frappe, nous corrigeons.' }],
  debrief: {
    explanation: 'Le tableau des provisions présente une dotation dont deux chiffres sont inversés ; le total du tableau n’a pas été rapproché de la balance.',
    references: ['PCG-ANNEXE'],
    goodPractice: 'Pointer chaque tableau de l’annexe sur la balance et vérifier les totaux.',
    procedures: ['Pointage de l’annexe sur la balance'],
  },
};

export const A22: AnomalyModule = {
  id: 'A22',
  title: 'Comparatif N-1 modifié et classement erroné des dépôts de garantie',
  cycle: 'disclosures',
  assertions: ['présentation', 'comparabilité'],
  classification: 'factual',
  severity: 1,
  difficulty: 2,
  parts: [
    {
      id: 'A22',
      label: 'Dépôts de garantie des locataires : rétablir le classement en dettes financières en N et en N-1',
      signature: { cycle: 'disclosures', objects: [acct('1651'), doc('comptes-certifies-2024'), doc('etats-financiers-2025')], natures: ['presentation', 'classification'] },
      treatment: 'reclassify',
      cycles: ['disclosures', 'debtTreasury'],
      keyObjects: [acct('1651'), doc('comptes-certifies-2024')],
      creditBasis: ['disclosure'],
      expectedFixes: ['restate-classification'],
    },
  ],
  apply(draft, ctx) {
    draft.reclassifications.push({ account: '1651', to: ctx.params.anomalies.A22.presentedRubrique, years: [2024, 2025] });
  },
  stance: [{ partId: 'A22', stance: 'accepts', character: 'cfo', argument: 'Nous pensions améliorer la présentation ; nous rétablissons le classement.' }],
  debrief: {
    explanation:
      'Les dépôts de garantie reçus des locataires relèvent de la rubrique des dettes financières du modèle d’états. Ils sont présentés en « autres dettes », y compris dans la colonne N-1, qui ne concorde plus avec les comptes certifiés 2024, sans aucune information en annexe.',
    references: ['ANC-2015-04', 'PCG-ANNEXE'],
    goodPractice: 'Pointer la colonne N-1 sur les comptes certifiés annexés au rapport de l’exercice précédent et contrôler le passage de la balance aux états.',
    procedures: ['Pointage de la colonne N-1 sur les comptes certifiés 2024', 'Contrôle du passage balance → états'],
  },
};
