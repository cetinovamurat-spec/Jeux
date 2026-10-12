/** Chart of accounts: CSV loading, lookup and import of an official chart. */
import { parseCsvObjects } from './csv';
import type { Account, AccountClass, ChartOfAccounts } from './types';

export const CHART_COLUMNS = [
  'numero',
  'libelle',
  'classe',
  'sens',
  'rubrique_debit',
  'rubrique_credit',
  'rubrique_annexe',
  'poste_caf',
  'a_valider',
  'commentaire',
] as const;

export function parseChartCsv(text: string, framework: string, source: Account['source'] = 'proposal'): ChartOfAccounts {
  const rows = parseCsvObjects(text);
  const accounts: Account[] = rows.map((r, i) => {
    const number = r['numero'] ?? '';
    if (!/^[1-8]\d*$/.test(number)) throw new Error(`plan de comptes, ligne ${i + 2} : numéro invalide « ${number} »`);
    const accountClass = Number(number[0]) as AccountClass;
    const sens = (r['sens'] ?? '').toUpperCase();
    const rubriqueDebit = r['rubrique_debit'] ?? '';
    const account: Account = {
      number,
      label: r['libelle'] ?? '',
      accountClass,
      normalSide: sens === 'C' ? 'credit' : 'debit',
      rubriqueDebit,
      rubriqueCredit: r['rubrique_credit'] || rubriqueDebit,
      toValidate: /^(oui|o|1|true|x)$/i.test(r['a_valider'] ?? ''),
      source,
    };
    if (r['rubrique_annexe']) account.annex = r['rubrique_annexe'];
    if (r['poste_caf']) account.cafItem = r['poste_caf'];
    if (r['commentaire']) account.comment = r['commentaire'];
    return account;
  });
  return { framework, accounts };
}

export function accountMap(chart: ChartOfAccounts): Map<string, Account> {
  return new Map(chart.accounts.map((a) => [a.number, a]));
}

export interface ChartImportReport {
  chart: ChartOfAccounts;
  /** Accounts used by the scenario but absent from the imported chart (blocking). */
  missing: string[];
  /** Imported accounts without statement mapping (warnings). */
  unmapped: string[];
}

/**
 * Imports an official chart (same CSV layout). Accounts used by the scenario
 * must exist; mappings missing in the import are taken from the current chart.
 */
export function importChart(text: string, current: ChartOfAccounts, usedAccounts: Iterable<string>, framework: string): ChartImportReport {
  const imported = parseChartCsv(text, framework, 'import');
  const byNumber = accountMap(imported);
  const currentByNumber = accountMap(current);
  const missing = [...new Set(usedAccounts)].filter((n) => !byNumber.has(n)).sort();
  const unmapped: string[] = [];
  const accounts = imported.accounts.map((a) => {
    if (a.rubriqueDebit) return a;
    const fallback = currentByNumber.get(a.number);
    if (!fallback) {
      unmapped.push(a.number);
      return a;
    }
    return { ...a, rubriqueDebit: fallback.rubriqueDebit, rubriqueCredit: fallback.rubriqueCredit };
  });
  return { chart: { framework, accounts }, missing, unmapped };
}

export function isContraAsset(account: string): boolean {
  return /^(28|29|39|49|59)/.test(account);
}

export function isIncomeStatementAccount(account: string): boolean {
  return account.startsWith('6') || account.startsWith('7');
}
