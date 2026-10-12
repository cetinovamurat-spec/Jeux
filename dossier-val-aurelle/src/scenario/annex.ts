/**
 * Annex tables (tableaux de l'annexe) built from the ledger and the
 * sub-ledgers. The closing column of each table reconciles with the trial
 * balance (tested), except where an anomaly deliberately alters a cell (A21).
 */
import { OPENING_JOURNAL } from '../engine/balance';
import type { Cents } from '../engine/money';
import type { Ledger, World } from '../engine/types';
import type { ScenarioDatasets } from './datasets';
import type { Params } from './params';

export interface AnnexColumn {
  id: string;
  label: string;
}

export interface AnnexRow {
  id: string;
  label: string;
  /** Account prefixes the row is built from (reconciliation with the balance). */
  accounts: readonly string[];
  values: Record<string, Cents>;
}

export interface AnnexTable {
  id: string;
  title: string;
  columns: readonly AnnexColumn[];
  rows: AnnexRow[];
  notes?: string[];
}

type Group = { id: string; label: string; accounts: string[]; exclude?: string[] };

const matches = (account: string, g: Group) => g.accounts.some((p) => account.startsWith(p)) && !(g.exclude ?? []).some((p) => account.startsWith(p));

interface Flows {
  opening: Cents;
  debit: Cents;
  credit: Cents;
  transferDebit: Cents;
  transferCredit: Cents;
}

function flows(ledger: Ledger, g: Group): Flows {
  const f: Flows = { opening: 0, debit: 0, credit: 0, transferDebit: 0, transferCredit: 0 };
  for (const e of ledger.entries) {
    const transfer = e.origin === 'gen:ODI';
    for (const l of e.lines) {
      if (!matches(l.account, g)) continue;
      if (e.journal === OPENING_JOURNAL) f.opening += l.debit - l.credit;
      else if (transfer) {
        f.transferDebit += l.debit;
        f.transferCredit += l.credit;
      } else {
        f.debit += l.debit;
        f.credit += l.credit;
      }
    }
  }
  return f;
}

export function buildAnnex(world: World, params: Params, year: 'current' | 'prior' = 'current'): AnnexTable[] {
  const ledger = world.ledgers[year];
  const fy = ledger.fiscalYear;
  const ds = world.datasets as unknown as ScenarioDatasets;
  const tables: AnnexTable[] = [];

  // 1. fixed assets (gross)
  const assetGroups: Group[] = [
    { id: 'incorporelles', label: 'Immobilisations incorporelles', accounts: ['205'] },
    { id: 'terrains', label: 'Terrains', accounts: ['211'] },
    { id: 'constructions', label: 'Constructions locatives', accounts: ['2131', '2135'] },
    { id: 'autres', label: 'Autres immobilisations corporelles', accounts: ['2138', '218'] },
    { id: 'encours', label: 'Immobilisations corporelles en cours', accounts: ['231'] },
    { id: 'financieres', label: 'Immobilisations financières', accounts: ['27'] },
  ];
  tables.push({
    id: 'immobilisations',
    title: 'Tableau des immobilisations (valeurs brutes)',
    columns: [
      { id: 'debut', label: 'Début d’exercice' },
      { id: 'augmentations', label: 'Augmentations' },
      { id: 'virements', label: 'Virements de poste à poste' },
      { id: 'diminutions', label: 'Diminutions' },
      { id: 'fin', label: 'Fin d’exercice' },
    ],
    rows: assetGroups.map((g) => {
      const f = flows(ledger, g);
      return { id: g.id, label: g.label, accounts: g.accounts, values: { debut: f.opening, augmentations: f.debit, virements: f.transferDebit - f.transferCredit, diminutions: f.credit, fin: f.opening + f.debit - f.credit + f.transferDebit - f.transferCredit } };
    }),
  });

  // 2. depreciation
  const depGroups: Group[] = [
    { id: 'incorporelles', label: 'Immobilisations incorporelles', accounts: ['2805'] },
    { id: 'constructions', label: 'Constructions locatives', accounts: ['28131', '28135'] },
    { id: 'autres', label: 'Autres immobilisations corporelles', accounts: ['28138', '2818'] },
  ];
  tables.push({
    id: 'amortissements',
    title: 'Tableau des amortissements',
    columns: [
      { id: 'debut', label: 'Début d’exercice' },
      { id: 'dotations', label: 'Dotations' },
      { id: 'diminutions', label: 'Diminutions (sorties)' },
      { id: 'fin', label: 'Fin d’exercice' },
    ],
    rows: depGroups.map((g) => {
      const f = flows(ledger, g);
      return { id: g.id, label: g.label, accounts: g.accounts, values: { debut: -f.opening, dotations: f.credit, diminutions: f.debit, fin: -f.opening + f.credit - f.debit } };
    }),
  });

  // 3. provisions and impairments
  const provGroups: Group[] = [
    { id: 'pge', label: 'Provision pour gros entretien', accounts: ['1572'] },
    { id: 'litiges', label: 'Provisions pour litiges', accounts: ['1511'] },
    { id: 'creances-locataires', label: 'Dépréciation des créances locatives', accounts: ['4911', '4915', '4916'] },
    { id: 'creances-gestionnaires', label: 'Dépréciation des créances sur gestionnaires de foyers', accounts: ['4914'] },
  ];
  tables.push({
    id: 'provisions',
    title: 'Tableau des provisions et dépréciations',
    columns: [
      { id: 'debut', label: 'Début d’exercice' },
      { id: 'dotations', label: 'Dotations' },
      { id: 'reprises', label: 'Reprises' },
      { id: 'fin', label: 'Fin d’exercice' },
    ],
    rows: provGroups.map((g) => {
      const f = flows(ledger, g);
      return { id: g.id, label: g.label, accounts: g.accounts, values: { debut: -f.opening, dotations: f.credit, reprises: f.debit, fin: -f.opening + f.credit - f.debit } };
    }),
  });

  // 4. investment subsidies
  const grantors: [string, string, string][] = [
    ['etat', 'État', '1311'],
    ['region', 'Région', '1312'],
    ['departement', 'Département', '1313'],
    ['communes', 'Communes et EPCI', '1314'],
    ['action-logement', 'Action Logement', '1317'],
    ['autres', 'Autres (ANRU…)', '1318'],
  ];
  tables.push({
    id: 'subventions',
    title: 'Subventions d’investissement',
    columns: [
      { id: 'montant', label: 'Montant accordé' },
      { id: 'reprisesCumulees', label: 'Quote-part cumulée virée au résultat' },
      { id: 'net', label: 'Montant net au bilan' },
      { id: 'quotePartExercice', label: 'Quote-part de l’exercice' },
    ],
    rows: grantors.map(([id, label, acc]) => {
      const gross = flows(ledger, { id, label, accounts: [acc] });
      const released = flows(ledger, { id, label, accounts: [`139${acc.slice(3)}`] });
      const montant = -(gross.opening + gross.debit - gross.credit);
      const cumul = released.opening + released.debit - released.credit;
      return { id, label, accounts: [acc, `139${acc.slice(3)}`], values: { montant, reprisesCumulees: cumul, net: montant - cumul, quotePartExercice: released.debit } };
    }),
  });

  // 5. debts by maturity
  const closing = `${fy}-12-31`;
  const loanRows = [
    { id: 'cdc', label: 'Emprunts auprès de la Caisse des dépôts', account: '1631' },
    { id: 'etablissements', label: 'Emprunts auprès des établissements de crédit', account: '1641' },
    { id: 'autres-emprunts', label: 'Autres emprunts (Action Logement)', account: '1678' },
  ];
  const maturity = (account: string) => {
    let lt1 = 0;
    let to5 = 0;
    let total = 0;
    for (const loan of ds.loans.filter((x) => x.account === account)) {
      const lines = ds.loanSchedules.filter((l) => l.loanId === loan.id);
      const last = [...lines].filter((l) => l.dueDate <= closing).pop();
      const crd = loan.refDate > closing ? 0 : last ? last.outstandingAfter : loan.refOutstanding;
      total += crd;
      for (const l of lines) {
        const y = Number(l.dueDate.slice(0, 4));
        if (y === fy + 1) lt1 += l.principal;
        else if (y > fy + 1 && y <= fy + 5) to5 += l.principal;
      }
    }
    return { total, lt1, to5, gt5: total - lt1 - to5 };
  };
  const otherDebt: Group[] = [
    { id: 'icne', label: 'Intérêts courus sur emprunts', accounts: ['1688'] },
    { id: 'depots', label: 'Dépôts de garantie des locataires', accounts: ['1651'] },
    { id: 'fournisseurs', label: 'Fournisseurs et comptes rattachés', accounts: ['401', '408'] },
    { id: 'dettes-immobilisations', label: 'Fournisseurs d’immobilisations', accounts: ['404'] },
    { id: 'fiscales-sociales', label: 'Dettes fiscales et sociales', accounts: ['421', '428', '43', '447'] },
    { id: 'autres-dettes', label: 'Autres dettes', accounts: ['4191', '4196', '4678', '4686', '471'] },
  ];
  tables.push({
    id: 'dettes',
    title: 'État des dettes',
    columns: [
      { id: 'montant', label: 'Montant brut' },
      { id: 'moinsUnAn', label: 'À un an au plus' },
      { id: 'unACinqAns', label: 'À plus d’un an et cinq ans au plus' },
      { id: 'plusCinqAns', label: 'À plus de cinq ans' },
    ],
    rows: [
      ...loanRows.map((r) => {
        const m = maturity(r.account);
        return { id: r.id, label: r.label, accounts: [r.account], values: { montant: m.total, moinsUnAn: m.lt1, unACinqAns: m.to5, plusCinqAns: m.gt5 } };
      }),
      ...otherDebt.map((g) => {
        const f = flows(ledger, g);
        const amount = -(f.opening + f.debit - f.credit + f.transferDebit - f.transferCredit);
        const longTerm = g.id === 'depots';
        return { id: g.id, label: g.label, accounts: g.accounts, values: { montant: amount, moinsUnAn: longTerm ? 0 : amount, unACinqAns: longTerm ? amount : 0, plusCinqAns: 0 } };
      }),
    ],
    notes: ['Les dépôts de garantie sont présentés à plus d’un an (convention à valider).'],
  });

  // 6. receivables
  const recv: (Group & { impairment?: string[] })[] = [
    { id: 'locataires', label: 'Locataires et organismes payeurs', accounts: ['4111', '4114', '4115', '4116', '4181'], impairment: ['491'] },
    { id: 'subventions', label: 'Subventions à recevoir', accounts: ['441'] },
    { id: 'autres', label: 'Autres créances', accounts: ['4431', '4487', '462', '4671', '4687', '486'] },
  ];
  tables.push({
    id: 'creances',
    title: 'État des créances',
    columns: [
      { id: 'brut', label: 'Montant brut' },
      { id: 'depreciation', label: 'Dépréciation' },
      { id: 'net', label: 'Montant net' },
    ],
    rows: recv.map((g) => {
      const f = flows(ledger, g);
      const brut = f.opening + f.debit - f.credit + f.transferDebit - f.transferCredit;
      let dep = 0;
      if (g.impairment) {
        const d = flows(ledger, { id: 'x', label: '', accounts: g.impairment });
        dep = -(d.opening + d.debit - d.credit);
      }
      return { id: g.id, label: g.label, accounts: [...g.accounts, ...(g.impairment ?? [])], values: { brut, depreciation: dep, net: brut - dep } };
    }),
  });

  // 7. off-balance-sheet commitments
  const c = params.scenario.commitments;
  const advance = params.scenario.specific.sisterAdvance;
  const drawn = fy >= Number(advance.date.slice(0, 4)) ? advance.euros : 0;
  const bdt = ds.loans.filter((l) => l.lenderId === 'BDT');
  let guaranteed = 0;
  for (const loan of bdt) {
    const lines = ds.loanSchedules.filter((l) => l.loanId === loan.id && l.dueDate <= closing);
    guaranteed += loan.refDate > closing ? 0 : lines.length ? lines[lines.length - 1]!.outstandingAfter : loan.refOutstanding;
  }
  tables.push({
    id: 'engagements',
    title: 'Engagements hors bilan',
    columns: [{ id: 'montant', label: 'Montant' }],
    rows: [
      { id: 'ifc', label: 'Engagements de retraite (indemnités de fin de carrière, non provisionnés)', accounts: [], values: { montant: Math.round((c.retirementEuros[String(fy)] ?? 0) * 100) } },
      { id: 'avance-groupe', label: 'Engagement donné – solde non tiré de l’avance à Coteaux du Serein Habitat', accounts: [], values: { montant: drawn ? Math.round((advance.ceilingEuros - drawn) * 100) : 0 } },
      { id: 'garanties', label: 'Engagements reçus – garanties des collectivités sur les emprunts', accounts: [], values: { montant: Math.round(guaranteed * c.guaranteedLoansShare) } },
      ...(fy >= 2025
        ? [{ id: 'passif-eventuel-tilleuls', label: 'Passif éventuel – litige avec l’entreprise générale des Tilleuls (pénalités de retard retenues et contestées)', accounts: [], values: { montant: Math.round(params.scenario.specific.tilleuls.penaltiesEuros * 100) } }]
        : []),
    ],
  });
  // normalise negative zeros
  for (const t of tables) for (const r of t.rows) for (const k of Object.keys(r.values)) r.values[k] = r.values[k]! + 0;
  return year === 'current' ? applyAnnexCells(tables, world.presentation.annexCells) : tables;
}

/** Swaps the 2nd and 3rd significant digits of an amount (reporting error of A21). */
export function transposeDigits23(value: Cents): Cents {
  const sign = value < 0 ? -1 : 1;
  const digits = String(Math.abs(value)).split('');
  if (digits.length < 3) return value;
  [digits[1], digits[2]] = [digits[2]!, digits[1]!];
  return sign * Number(digits.join(''));
}

/** Presentation alterations of the annex (omitted rows, altered cells). */
export function applyAnnexCells(tables: AnnexTable[], cells: World['presentation']['annexCells']): AnnexTable[] {
  for (const cell of cells) {
    const t = tables.find((x) => x.id === cell.table);
    if (!t) throw new Error(`tableau d’annexe inconnu : ${cell.table}`);
    const i = t.rows.findIndex((r) => r.id === cell.rowId);
    if (i < 0) throw new Error(`ligne d’annexe inconnue : ${cell.table}:${cell.rowId}`);
    if (cell.transform === 'omit') {
      if (cell.column === '*') t.rows.splice(i, 1);
      else delete t.rows[i]!.values[cell.column];
    } else {
      const row = t.rows[i]!;
      row.values[cell.column] = transposeDigits23(row.values[cell.column] ?? 0);
    }
  }
  return tables;
}
