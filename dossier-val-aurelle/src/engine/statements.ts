/** Balance sheet and income statement built from closing balances and a chart mapping. */
import { accountMap, isContraAsset, isIncomeStatementAccount } from './chart';
import type { Cents } from './money';
import { netResult } from './balance';
import type { ChartOfAccounts, FinancialStatements, PresentationOverrides, StatementLineDef, StatementLineValue } from './types';

export interface StatementInput {
  defs: readonly StatementLineDef[];
  chart: ChartOfAccounts;
  current: ReadonlyMap<string, Cents>;
  prior: ReadonlyMap<string, Cents>;
  currentYear: number;
  priorYear: number;
  presentation: PresentationOverrides;
}

interface YearValues {
  value: Map<string, Cents>;
  gross: Map<string, Cents>;
  depreciation: Map<string, Cents>;
}

function lineFor(
  account: string,
  balance: Cents,
  chart: Map<string, { rubriqueDebit: string; rubriqueCredit: string }>,
  presentation: PresentationOverrides,
  year: number,
): string {
  const reclass = presentation.reclassifications.find((r) => r.account === account && r.years.includes(year));
  if (reclass) return reclass.to;
  const a = chart.get(account);
  if (!a) throw new Error(`compte ${account} absent du plan de comptes`);
  return balance >= 0 ? a.rubriqueDebit : a.rubriqueCredit;
}

function computeYear(input: StatementInput, balances: ReadonlyMap<string, Cents>, year: number): YearValues {
  const defs = new Map(input.defs.map((d) => [d.id, d]));
  const chart = accountMap(input.chart);
  const value = new Map<string, Cents>();
  const gross = new Map<string, Cents>();
  const depreciation = new Map<string, Cents>();
  const add = (m: Map<string, Cents>, k: string, v: Cents) => m.set(k, (m.get(k) ?? 0) + v);

  for (const [account, b] of balances) {
    if (b === 0) continue;
    const lineId = lineFor(account, b, chart, input.presentation, year);
    const def = defs.get(lineId);
    if (!def) throw new Error(`rubrique « ${lineId} » inconnue (compte ${account})`);
    if (isIncomeStatementAccount(account)) {
      add(value, lineId, def.nature === 'charge' ? b : -b);
    } else if (def.statement === 'assets') {
      if (isContraAsset(account)) add(depreciation, lineId, -b);
      else add(gross, lineId, b);
    } else {
      add(value, lineId, -b);
    }
  }
  for (const d of input.defs) {
    if (d.statement === 'assets' && d.kind === 'detail') value.set(d.id, (gross.get(d.id) ?? 0) - (depreciation.get(d.id) ?? 0));
    if (d.isResult) value.set(d.id, netResult(balances));
  }
  // subtotals and totals, deepest first
  const children = new Map<string, string[]>();
  for (const d of input.defs) if (d.parent) children.set(d.parent, [...(children.get(d.parent) ?? []), d.id]);
  const resolving = new Set<string>();
  const resolve = (id: string): Cents => {
    const d = defs.get(id)!;
    if (d.kind === 'detail' || d.isResult) return value.get(id) ?? 0;
    if (resolving.has(id)) throw new Error(`cycle in statement definition at ${id}`);
    resolving.add(id);
    let total = 0;
    if (d.formula) {
      for (const term of d.formula) total += (term.startsWith('-') ? -1 : 1) * resolve(term.slice(1));
    } else {
      for (const c of children.get(id) ?? []) total += resolve(c);
      if (d.statement === 'assets') {
        let g = 0;
        let dep = 0;
        for (const c of children.get(id) ?? []) {
          g += gross.get(c) ?? 0;
          dep += depreciation.get(c) ?? 0;
        }
        gross.set(id, g);
        depreciation.set(id, dep);
      }
    }
    resolving.delete(id);
    value.set(id, total);
    return total;
  };
  for (const d of input.defs) if (d.kind !== 'detail') resolve(d.id);
  return { value, gross, depreciation };
}

export const ASSETS_TOTAL = 'ACTIF_TOTAL';
export const LIABILITIES_TOTAL = 'PASSIF_TOTAL';
export const NET_RESULT_LINE = 'CR_RESULTAT';
export const BALANCE_SHEET_RESULT_LINE = 'P_RESULTAT';

export function buildStatements(input: StatementInput): FinancialStatements {
  const cur = computeYear(input, input.current, input.currentYear);
  const pri = computeYear(input, input.prior, input.priorYear);
  const lines: Record<string, StatementLineValue> = {};
  for (const d of input.defs) {
    const v: StatementLineValue = { id: d.id, current: cur.value.get(d.id) ?? 0, prior: pri.value.get(d.id) ?? 0 };
    if (d.statement === 'assets') {
      v.currentGross = cur.gross.get(d.id) ?? 0;
      v.currentDepreciation = cur.depreciation.get(d.id) ?? 0;
    }
    lines[d.id] = v;
  }
  return {
    lines,
    checks: {
      assetsTotal: cur.value.get(ASSETS_TOTAL) ?? 0,
      liabilitiesTotal: cur.value.get(LIABILITIES_TOTAL) ?? 0,
      incomeStatementResult: cur.value.get(NET_RESULT_LINE) ?? 0,
      balanceSheetResult: cur.value.get(BALANCE_SHEET_RESULT_LINE) ?? 0,
      priorAssetsTotal: pri.value.get(ASSETS_TOTAL) ?? 0,
      priorLiabilitiesTotal: pri.value.get(LIABILITIES_TOTAL) ?? 0,
    },
  };
}
