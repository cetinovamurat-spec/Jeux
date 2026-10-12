/** Rents, recoverable charges and other income: A10, A11, A17, A19. */
import { credit as C, debit as D } from '../../../engine/ledger';
import type { Cents } from '../../../engine/money';
import type { EntryLine } from '../../../engine/types';
import type { ChargesRegularisation } from '../../datasets';
import { acct, doc, prog, tp } from '../refs';
import type { AnomalyModule } from '../types';

/** Lines of the yearly charges regularisation entry (same rule as the clean posting). */
function regularisationLines(regs: readonly ChargesRegularisation[]): EntryLine[] {
  const lines: EntryLine[] = [];
  for (const r of regs.filter((x) => x.year === 2025)) {
    const ref = { refs: [`prog:${r.programmeId}`] };
    if (r.regularisation > 0) lines.push(D('4181', r.regularisation, ref), C('7031', r.regularisation, ref));
    else if (r.regularisation < 0) lines.push(D('7031', -r.regularisation, ref), C('4196', -r.regularisation, ref));
  }
  return lines;
}

export const A10: AnomalyModule = {
  id: 'A10',
  title: 'Charges non récupérables intégrées à la régularisation des charges',
  cycle: 'rentReceivables',
  assertions: ['évaluation', 'conformité'],
  classification: 'factual',
  severity: 2,
  difficulty: 3,
  parts: [
    {
      id: 'A10.a',
      label: 'Honoraires du syndic de la copropriété des Marronniers intégrés aux charges récupérées',
      signature: { cycle: 'rentReceivables', objects: [prog('MAR'), acct('4181'), acct('7031'), doc('regularisation-charges-2025')], natures: ['valuation', 'compliance'] },
      treatment: 'adjust',
    },
    {
      id: 'A10.b',
      label: 'Rémunération des gardiens récupérée à 100 % au lieu de la quote-part réglementaire',
      signature: { cycle: 'rentReceivables', objects: [acct('4181'), acct('7031'), doc('regularisation-charges-2025'), doc('fiches-poste-gardiens')], natures: ['valuation', 'compliance'] },
      treatment: 'adjust',
    },
  ],
  apply(draft, ctx) {
    const extra = new Map<string, { amount: Cents; syndic: Cents; caretakers: Cents }>();
    const bump = (pid: string, k: 'syndic' | 'caretakers', x: Cents) => {
      const e = extra.get(pid) ?? { amount: 0, syndic: 0, caretakers: 0 };
      e.amount += x;
      e[k] += x;
      extra.set(pid, e);
    };
    if (ctx.isActive('A10.a')) {
      for (const inv of draft.data.invoices) {
        if (inv.serviceYear !== 2025) continue;
        for (const l of inv.lines) if (l.nature === 'honoraires_syndic' && l.programmeId) bump(l.programmeId, 'syndic', l.amount);
      }
    }
    if (ctx.isActive('A10.b')) {
      const shares = ctx.params.regulatory.recoverableShares;
      const presented = ctx.params.anomalies.A10.presentedCaretakerShare;
      for (const c of draft.data.caretakers) {
        if (c.role !== 'gardien') continue;
        const share = c.tasks.length >= 2 ? shares.caretakerBothTasks : shares.caretakerOneTask;
        const parts = c.programmeIds.length;
        c.programmeIds.forEach((pid, i) => {
          const total = Math.round(c.annualCost.y2025 * (presented - share));
          const part = i === parts - 1 ? total - Math.round(total / parts) * (parts - 1) : Math.round(total / parts);
          bump(pid, 'caretakers', part);
        });
      }
    }
    const regs = draft.data.regularisations.map((r): ChargesRegularisation => {
      const e = r.year === 2025 ? extra.get(r.programmeId) : undefined;
      if (!e) return r;
      const expenses = { ...r.expenses };
      if (e.syndic) expenses['honoraires_syndic'] = (expenses['honoraires_syndic'] ?? 0) + e.syndic;
      if (e.caretakers) expenses['gardiennage'] = (expenses['gardiennage'] ?? 0) + e.caretakers;
      return { ...r, expenses, recoverable: r.recoverable + e.amount, regularisation: r.regularisation + e.amount };
    });
    draft.setDataset('regularisations', regs);
    draft.replace(draft.one((e) => e.pieceRef === 'INV2025-REGUL', 'la régularisation des charges'), { lines: regularisationLines(regs) });
  },
  stance: [
    { partId: 'A10.a', stance: 'accepts', character: 'cfo', argument: 'Les honoraires du syndic n’auraient pas dû y figurer, c’est une erreur de paramétrage.' },
    {
      partId: 'A10.b',
      stance: 'yieldsOnEvidence',
      character: 'cfo',
      argument: 'Nos gardiens sont affectés à 100 % à leurs immeubles : leur rémunération est entièrement récupérable.',
      requiredEvidence: ['fiches-poste-gardiens', 'memo-charges-recuperables'],
    },
  ],
  debrief: {
    explanation:
      'Seules les charges limitativement énumérées par la réglementation sont récupérables : les honoraires du syndic ne le sont pas, et la rémunération d’un gardien n’est récupérable que pour une quote-part qui dépend des tâches effectivement assurées (entretien des parties communes, élimination des rejets). Le produit à recevoir est surévalué et la régularisation expose l’organisme à des contestations des locataires ; l’irrégularité est à porter à la connaissance du conseil.',
    references: ['DECRET-82-955', 'CCOM-L823-12', 'NEP260'],
    goodPractice: 'Rapprocher l’état de régularisation par programme de la liste réglementaire des charges récupérables ; contrôler la quote-part des gardiens à partir des fiches de poste ; exploiter les constats antérieurs (ANCOLS) et les contestations des locataires.',
    procedures: ['Revue de la régularisation des charges par programme', 'Lecture des fiches de poste des gardiens', 'Lecture du rapport ANCOLS et des courriers des locataires'],
  },
};

export const A11: AnomalyModule = {
  id: 'A11',
  title: 'Produit à recevoir fictif saisi après la clôture',
  cycle: 'crossCycle',
  assertions: ['réalité', 'séparation des exercices'],
  classification: 'factual',
  severity: 3,
  difficulty: 3,
  parts: [
    {
      id: 'A11',
      label: 'Extourne du produit à recevoir de 300 000 € sur les gestionnaires de foyers, sans fondement contractuel',
      signature: { cycle: 'crossCycle', objects: [acct('4687'), acct('7088'), prog('PHA'), tp('ACCUEIL_HORIZONS'), doc('conventions-gestionnaires-foyers')], natures: ['occurrence'] },
      treatment: 'adjust',
      disclosureFix: 'Alerter l’associée, documenter, réévaluer le risque de fraude et la fiabilité des déclarations de la direction, communiquer avec la gouvernance ; l’associée instruit avec le département technique la question de la révélation de faits délictueux.',
    },
  ],
  apply(draft, ctx) {
    const a = ctx.params.anomalies.A11;
    const amount = Math.round(a.euros * 100);
    draft.add({
      journal: 'OD',
      date: a.date,
      label: a.label,
      lines: [D(a.debitAccount, amount), C(a.creditAccount, amount)],
      validDate: a.validDate,
      enteredBy: ctx.params.scenario.users.cfo.id,
    });
  },
  stance: [
    {
      partId: 'A11',
      stance: 'yieldsOnEvidence',
      character: 'cfo',
      argument: 'Il s’agit d’une erreur d’interprétation des conventions : nous pensions pouvoir refacturer nos frais de gestion. Je vous transmets une note de calcul.',
      requiredEvidence: ['conventions-gestionnaires-foyers', 'confirmations-gestionnaires', 'journal-ecritures-inventaire'],
      requiresPartner: true,
    },
  ],
  debrief: {
    explanation:
      'Écriture d’opérations diverses datée du 31/12/2025 mais validée le 03/02/2026 par la DAF, montant rond, couple de comptes inhabituel, sans pièce : aucune convention ne prévoit de refacturation et les gestionnaires déclarent ne rien devoir. Le produit est fictif et sert l’objectif de résultat. La bonne conduite : ne pas confronter la DAF seul à chaud, documenter, alerter immédiatement l’associée, réévaluer le risque de fraude, étendre les tests d’écritures et communiquer avec la gouvernance. La révélation éventuelle de faits délictueux est instruite par l’associée avec le département technique.',
    references: ['NEP240', 'NEP260', 'NEP580', 'CCOM-L823-12', 'PCG-SEPARATION'],
    goodPractice: 'Tester les écritures manuelles postérieures à la clôture (date de validation, utilisateur, montants ronds, comptes inhabituels, absence de pièce) et demander les justificatifs sans annoncer la cible.',
    procedures: ['Tests d’écritures sur le FEC (validation après clôture, utilisateurs, montants ronds)', 'Lecture des conventions avec les gestionnaires', 'Demandes de confirmation aux gestionnaires'],
  },
};

export const A17: AnomalyModule = {
  id: 'A17',
  title: 'Hausse de loyers supérieure au plafond légal',
  cycle: 'rentReceivables',
  assertions: ['conformité', 'exhaustivité des dettes'],
  classification: 'factual',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A17',
      label: 'Dette de restitution aux locataires du trop-perçu 2025 (hausse de 3,50 % au lieu de la variation de l’IRL)',
      signature: { cycle: 'rentReceivables', objects: [acct('70411'), acct('4196'), doc('pv-ca-2024-10'), doc('quittances-echantillon')], natures: ['compliance', 'completeness'] },
      treatment: 'adjust',
      disclosureFix: 'Signaler l’irrégularité au conseil d’administration et demander la régularisation des quittances.',
    },
  ],
  apply(draft) {
    draft.remove(draft.one((e) => e.pieceRef === 'INV2025-RESTIT', 'la dette de restitution des loyers'));
  },
  stance: [
    {
      partId: 'A17',
      stance: 'yieldsOnEvidence',
      character: 'ceo',
      argument: 'Nous régulariserons en 2026 sur les quittances, sans passer d’écriture : l’écart est minime.',
      requiredEvidence: ['pv-ca-2024-10', 'memo-irl', 'quittances-echantillon'],
    },
  ],
  debrief: {
    explanation:
      'La hausse des loyers des logements conventionnés est limitée à la variation annuelle de l’IRL du 2e trimestre de l’année précédente ; le conseil a voté 3,50 % en confondant avec un plafonnement temporaire qui avait pris fin. Le trop-perçu est dû aux locataires dès 2025 : c’est une obligation à la clôture, à comptabiliser en dette ; l’irrégularité est à signaler.',
    references: ['CCH-LOYERS', 'PCG-PROVISIONS', 'CCOM-L823-12'],
    goodPractice: 'Comparer les quittances de décembre et de janvier sur un échantillon et rapprocher le taux appliqué du taux légal, pas seulement la concordance quittances / états de quittancement.',
    procedures: ['Test de la révision des loyers (quittances décembre / janvier)', 'Lecture du PV du conseil d’octobre 2024', 'Mémo réglementaire IRL'],
  },
};

export const A19: AnomalyModule = {
  id: 'A19',
  title: 'Écart entre l’auxiliaire locataires et la comptabilité générale',
  cycle: 'rentReceivables',
  assertions: ['réalité', 'exhaustivité du rapprochement'],
  classification: 'factual',
  severity: 1,
  difficulty: 1,
  parts: [
    {
      id: 'A19',
      label: 'Les Saules : extourne du doublon du lot d’interface de quittancement d’octobre 2025',
      signature: { cycle: 'rentReceivables', objects: [prog('SAU'), acct('4111'), acct('70411'), doc('journal-interface-octobre')], natures: ['occurrence'] },
      treatment: 'adjust',
      disclosureFix: 'Lettre de recommandations : instaurer un rapprochement mensuel de l’auxiliaire LOGIGES avec la comptabilité générale.',
    },
  ],
  apply(draft) {
    const lot = draft.one((e) => e.pieceRef === 'QT202510-SAU', 'le lot de quittancement d’octobre des Saules');
    draft.add({ journal: lot.journal, date: lot.date, label: lot.label, lines: lot.lines, validDate: lot.validDate, enteredBy: lot.enteredBy, pieceRef: lot.pieceRef!, pieceDate: lot.pieceDate! });
  },
  stance: [{ partId: 'A19', stance: 'accepts', character: 'chiefAccountant', argument: 'Le lot a été rejoué au moment de la bascule : nous n’avons pas fait de rapprochement depuis.' }],
  debrief: {
    explanation:
      'Le lot de quittancement d’octobre des Saules a été intégré deux fois lors de la migration : les loyers et les créances sont surévalués du montant du lot. L’absence de rapprochement mensuel de l’auxiliaire avec la comptabilité générale est une faiblesse de contrôle interne à communiquer.',
    references: ['NEP265', 'PCG-SEPARATION'],
    goodPractice: 'Rapprocher l’auxiliaire locataires des comptes de la comptabilité générale à la clôture et analyser tout écart ; revoir les journaux d’interface autour de la migration.',
    procedures: ['Rapprochement auxiliaire LOGIGES / comptabilité générale', 'Revue du journal d’interface (doublons)', 'Revue de la migration'],
  },
};
