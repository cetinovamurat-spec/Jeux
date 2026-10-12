/**
 * Impairment of tenant receivables (method of the annex, §5-A07): computed
 * tenant by tenant; the charge and the release of the year are the positive
 * and negative variations of each tenant's allowance. Shared by the clean
 * world and by the presented world (A07, A15 change the method).
 */
import { credit as C, debit as D } from '../engine/ledger';
import type { Cents } from '../engine/money';
import type { EntryLine } from '../engine/types';
import type { TenantAccount } from './datasets';
import type { Params } from './params';

export type YearKey = 'y2023' | 'y2024' | 'y2025';

export interface ImpairmentMethod {
  formerRate: number;
  over6mRate: number;
  procedureRate: number;
  debtDischargeRate: number;
  /** Receivable on the residence manager in receivership (Accueil Horizons). */
  managerRate: number;
}

export const CLEAN_METHOD: ImpairmentMethod = { formerRate: 1, over6mRate: 0.5, procedureRate: 1, debtDischargeRate: 0.5, managerRate: 0.8 };

export function tenantAllowance(t: TenantAccount, key: YearKey, method: ImpairmentMethod): { account: string; amount: Cents } | null {
  const y = t.byYear[key];
  if (!y || y.balance <= 0) return null;
  switch (y.category) {
    case 'presentOver6m':
      return { account: '4911', amount: Math.round(y.balance * method.over6mRate) };
    case 'debtDischarge':
      return { account: '4911', amount: Math.round(y.balance * method.debtDischargeRate) };
    case 'procedure':
      return { account: '4916', amount: Math.round(y.balance * method.procedureRate) };
    case 'former':
      return { account: '4915', amount: Math.round(Math.max(0, y.balance - y.depositHeld) * method.formerRate) };
    default:
      return null;
  }
}

export function allowances(tenants: readonly TenantAccount[], key: YearKey, method: ImpairmentMethod): Map<string, Map<string, Cents>> {
  const m = new Map<string, Map<string, Cents>>();
  for (const t of tenants) {
    const a = tenantAllowance(t, key, method);
    if (!a || a.amount === 0) continue;
    if (!m.has(a.account)) m.set(a.account, new Map());
    m.get(a.account)!.set(t.id, a.amount);
  }
  return m;
}

/** Unpaid fees of a residence manager at a date (stops paying from the parameter date). */
export function managerReceivable(params: Params, managerId: string, date: string): Cents {
  const stop = params.scenario.residenceManagers[managerId]?.stopsPayingFrom;
  if (!stop || date < stop) return 0;
  const p = params.programmes.find((x) => x.managerId === managerId)!;
  const fee = Math.round((p.monthlyFeeEuros ?? 0) * 100);
  let months = 0;
  for (let m = 1; m <= 12; m++) {
    const d = `${date.slice(0, 4)}-${String(m).padStart(2, '0')}-01`;
    if (d >= stop && d <= date) months++;
  }
  return months * fee;
}

export interface ImpairmentMovements {
  lines: EntryLine[];
  dotation: Cents;
  reprise: Cents;
  allowanceByAccount: Map<string, Cents>;
}

export function impairmentMovements(
  tenants: readonly TenantAccount[],
  params: Params,
  year: number,
  method: ImpairmentMethod,
  prevMethod: ImpairmentMethod = CLEAN_METHOD,
): ImpairmentMovements {
  const prevKey = `y${year - 1}` as YearKey;
  const key = `y${year}` as YearKey;
  const prev = allowances(tenants, prevKey, prevMethod);
  const cur = allowances(tenants, key, method);
  const lines: EntryLine[] = [];
  let dotation = 0;
  let reprise = 0;
  const allowanceByAccount = new Map<string, Cents>();
  for (const a of ['4911', '4915', '4916']) {
    const p = prev.get(a) ?? new Map<string, Cents>();
    const c = cur.get(a) ?? new Map<string, Cents>();
    let up = 0;
    let down = 0;
    for (const id of new Set([...p.keys(), ...c.keys()])) {
      const delta = (c.get(id) ?? 0) - (p.get(id) ?? 0);
      if (delta > 0) up += delta;
      else down -= delta;
    }
    if (up) lines.push(C(a, up));
    if (down) lines.push(D(a, down));
    dotation += up;
    reprise += down;
    allowanceByAccount.set(a, [...c.values()].reduce((s, x) => s + x, 0));
  }
  const prevAh = Math.round(managerReceivable(params, 'ACCUEIL_HORIZONS', `${year - 1}-12-31`) * prevMethod.managerRate);
  const curAh = Math.round(managerReceivable(params, 'ACCUEIL_HORIZONS', `${year}-12-31`) * method.managerRate);
  if (curAh > prevAh) {
    lines.push(C('4914', curAh - prevAh, { aux: 'G001' }));
    dotation += curAh - prevAh;
  } else if (curAh < prevAh) {
    lines.push(D('4914', prevAh - curAh, { aux: 'G001' }));
    reprise += prevAh - curAh;
  }
  allowanceByAccount.set('4914', curAh);
  lines.push(D('68174', dotation), C('78174', reprise));
  return { lines, dotation, reprise, allowanceByAccount };
}
