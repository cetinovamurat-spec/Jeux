/** Debt, subsidies and purchases: A08, A09, A18, A20. */
import { credit as C, debit as D } from '../../../engine/ledger';
import { accruedInterest } from '../../../engine/subledgers/loans';
import type { EntryLine, LoanScheduleLine } from '../../../engine/types';
import { acct, doc, prog, sub, tp } from '../refs';
import type { AnomalyModule } from '../types';
import { without } from './util';

export const A08: AnomalyModule = {
  id: 'A08',
  title: 'Intérêts courus non échus calculés à un taux forfaitaire erroné',
  cycle: 'debtTreasury',
  assertions: ['évaluation', 'séparation des exercices'],
  classification: 'factual',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A08',
      label: 'ICNE des prêts indexés sur le Livret A : recalcul prêt par prêt au taux de la dernière révision (le taux unique de 3 % surévalue la charge)',
      signature: { cycle: 'debtTreasury', objects: [acct('1688'), acct('6611'), doc('calcul-icne'), doc('etat-dette'), tp('BDT')], natures: ['valuation', 'cutoff'] },
      treatment: 'adjust',
    },
  ],
  apply(draft, ctx) {
    const flat = ctx.params.anomalies.A08.flatRatePct;
    const entry = draft.one((e) => e.pieceRef === 'INV2025-ICNE', 'les intérêts courus');
    const loans = new Map(draft.data.loans.map((l) => [l.id, l]));
    const schedules = new Map<string, LoanScheduleLine[]>();
    for (const l of draft.data.loanSchedules) schedules.set(l.loanId, [...(schedules.get(l.loanId) ?? []), l]);
    const lines: EntryLine[] = [];
    let total = 0;
    for (const l of entry.lines) {
      if (l.account !== '1688') continue;
      const id = l.refs?.find((r) => r.startsWith('loan:'))?.slice(5);
      const loan = id ? loans.get(id) : undefined;
      const amount = loan && loan.rate.kind === 'livretA' ? accruedInterest(loan, schedules.get(loan.id) ?? [], '2025-12-31', flat) : l.credit;
      lines.push(C('1688', amount, { ...(l.aux ? { aux: l.aux } : {}), ...(l.refs ? { refs: l.refs } : {}) }));
      total += amount;
    }
    lines.push(D('6611', total));
    draft.replace(entry, { lines });
  },
  stance: [{ partId: 'A08', stance: 'accepts', character: 'cfo', argument: 'Avec plaisir : c’est une bonne nouvelle pour le résultat.' }],
  debrief: {
    explanation:
      'Les intérêts courus d’un prêt indexé se calculent au taux appliqué depuis sa dernière échéance (Livret A en vigueur à la date de révision plus la marge du produit). Avec la baisse du Livret A en 2025, un taux unique de 3 % surévalue la charge : le résultat présenté est sous-évalué. Une anomalie favorable se corrige aussi ; elle ne se compense pas silencieusement avec les autres.',
    references: ['PCG-SEPARATION', 'NEP450', 'NEP505'],
    goodPractice: 'Mener une revue analytique des frais financiers à partir du taux moyen du Livret A ; recalculer les ICNE à partir de l’état de la dette et confirmer la dette auprès de la Banque des Territoires.',
    procedures: ['Revue analytique des frais financiers', 'Recalcul des ICNE prêt par prêt', 'Demande de confirmation à la Banque des Territoires'],
  },
};

export const A09: AnomalyModule = {
  id: 'A09',
  title: 'Subvention à recevoir devenue caduque',
  cycle: 'equitySubsidies',
  assertions: ['réalité', 'évaluation'],
  classification: 'factual',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A09',
      label: 'Les Charmes : annulation de la créance et de la subvention départementale frappée de caducité',
      signature: { cycle: 'equitySubsidies', objects: [prog('CHA'), sub('SUB-CHA-H2026-DEPARTEMENT'), acct('4413'), acct('1313'), doc('courrier-caducite-charmes')], natures: ['occurrence', 'valuation'] },
      treatment: 'adjust',
      disclosureFix: 'Mettre à jour le plan de financement de l’opération des Charmes.',
    },
  ],
  apply(draft) {
    const id = 'SUB-CHA-H2026-DEPARTEMENT';
    draft.remove(draft.one((e) => e.label.startsWith(`Caducité de la subvention ${id}`), 'la caducité de la subvention des Charmes'));
    draft.setDataset('subsidies', draft.data.subsidies.map((s) => (s.id === id ? without(s, 'cancelledOn') : s)));
  },
  stance: [{ partId: 'A09', stance: 'accepts', character: 'cfo', argument: 'Le courrier ne m’est jamais parvenu… Cela pose un vrai problème de financement pour l’opération.' }],
  debrief: {
    explanation:
      'L’arrêté attributif prévoit la caducité si les travaux ne commencent pas dans un délai de trois ans ; l’ordre de service est postérieur à l’échéance et le Département a notifié la caducité en octobre 2025. La créance et la subvention n’existent plus : capitaux propres et créances sont surévalués ; l’effet sur le résultat est nul tant que les travaux ne sont pas achevés.',
    references: ['PCG-SUBVENTIONS', 'NEP505'],
    goodPractice: 'Pour chaque subvention à recevoir ancienne, lire l’arrêté attributif (clauses de caducité), vérifier les dates des ordres de service et confirmer auprès du financeur.',
    procedures: ['Revue des subventions à recevoir (ancienneté, clauses)', 'Demande de confirmation au Département', 'Lecture du courrier arrivé'],
  },
};

export const A18: AnomalyModule = {
  id: 'A18',
  title: 'Prêt encaissé en compte d’attente',
  cycle: 'debtTreasury',
  assertions: ['classement', 'exhaustivité des dettes'],
  classification: 'factual',
  severity: 1,
  difficulty: 1,
  parts: [
    {
      id: 'A18',
      label: 'Prêt de haut de bilan de 2,5 M€ : reclassement du compte d’attente en emprunts et mise à jour de l’état des dettes',
      signature: { cycle: 'debtTreasury', objects: [acct('471'), acct('1631'), tp('BDT'), doc('confirmation-bdt')], natures: ['classification', 'completeness'] },
      treatment: 'reclassify',
    },
  ],
  apply(draft, ctx) {
    const a = ctx.params.anomalies.A18;
    const phb = draft.data.loans.find((l) => l.product === 'PHB');
    if (!phb) throw new Error('A18 : prêt de haut de bilan introuvable');
    const e = draft.one((x) => x.origin === 'gen:BQN' && x.lines.some((l) => l.refs?.includes(`loan:${phb.id}`)), 'le versement du prêt de haut de bilan');
    draft.remove(e);
    draft.add({
      journal: e.journal,
      date: e.date,
      label: a.label,
      lines: e.lines.map((l) => (l.account === phb.account ? C(a.suspenseAccount, l.credit) : l)),
      validDate: e.validDate,
      enteredBy: e.enteredBy,
    });
    draft.setDataset('loans', draft.data.loans.filter((l) => l.id !== phb.id));
    draft.setDataset('loanSchedules', draft.data.loanSchedules.filter((l) => l.loanId !== phb.id));
  },
  stance: [{ partId: 'A18', stance: 'accepts', character: 'chiefAccountant', argument: 'Nous n’avions pas reçu le contrat au moment du virement ; il est resté en attente.' }],
  debrief: {
    explanation:
      'Le virement rond du 15/12 ressemble à une piste de fraude, mais l’opération est légitime : c’est le versement d’un prêt de haut de bilan de la Banque des Territoires. Seule son imputation est erronée : la dette financière est sous-évaluée et le compte d’attente créditeur doit être soldé. Une conclusion « décalage de calendrier » sur l’écart de confirmation ne suffit pas.',
    references: ['NEP505', 'PCG-ANNEXE'],
    goodPractice: 'Analyser tout écart de confirmation jusqu’à son origine ; solder les comptes d’attente à la clôture.',
    procedures: ['Demande de confirmation à la Banque des Territoires et analyse des écarts', 'Revue des comptes d’attente', 'Lecture des relevés bancaires de décembre'],
  },
};

export const A20: AnomalyModule = {
  id: 'A20',
  title: 'Facture du GIE non provisionnée',
  cycle: 'purchases',
  assertions: ['exhaustivité', 'séparation des exercices'],
  classification: 'factual',
  severity: 2,
  difficulty: 2,
  parts: [
    {
      id: 'A20',
      label: 'GIE Altaïr Services : charge à payer du complément de frais de structure 2025 (facture du 20/01/2026)',
      signature: { cycle: 'purchases', objects: [tp('F0027'), acct('6281'), acct('4081'), doc('confirmation-gie')], natures: ['completeness', 'cutoff'] },
      treatment: 'adjust',
      disclosureFix: 'Mentionner la transaction avec une partie liée (GIE du groupe) dans l’information sur les parties liées.',
    },
  ],
  apply(draft) {
    const gie = draft.data.invoices.find((i) => i.supplierId === 'F0027' && i.serviceYear === 2025 && i.invoiceDate > '2025-12-31');
    if (!gie) throw new Error('A20 : facture du GIE introuvable');
    const e = draft.one((x) => x.pieceRef === 'INV2025-FNP', 'les factures non parvenues');
    const line = gie.lines[0]!;
    const i = e.lines.findIndex((l) => l.account === line.account && l.debit === line.amount);
    if (i < 0) throw new Error('A20 : ligne du GIE absente des factures non parvenues');
    const lines = e.lines.filter((_, k) => k !== i).map((l) => (l.account === '4081' ? { ...l, credit: l.credit - gie.total } : l));
    draft.replace(e, { lines });
  },
  stance: [{ partId: 'A20', stance: 'accepts', character: 'cfo', argument: 'Le GIE nous l’a facturée tard, mais la clé de répartition le prévoit.' }],
  debrief: {
    explanation:
      'La convention de groupe prévoit un complément de fin d’année selon la clé de répartition : la charge se rattache à 2025, elle doit être comptabilisée en charge à payer même si la facture arrive en janvier. C’est aussi une transaction avec une partie liée.',
    references: ['PCG-SEPARATION', 'NEP550', 'NEP505'],
    goodPractice: 'Revoir les factures reçues et les décaissements de janvier-février pour rechercher les dettes non comptabilisées ; confirmer les soldes avec les entités du groupe.',
    procedures: ['Recherche de passifs non comptabilisés (factures et décaissements postérieurs)', 'Demande de confirmation au GIE', 'Lecture de la convention de groupe'],
  },
};


