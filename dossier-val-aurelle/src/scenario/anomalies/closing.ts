/**
 * Closing entries recomputed from the (patched) sub-ledgers: depreciation and
 * subsidy release by programme, receivables impairment. Same algorithms as the
 * clean posting, so that unchanged data give back the clean entries (tested).
 */
import { credit as C, debit as D } from '../../engine/ledger';
import type { Cents } from '../../engine/money';
import { accumulatedDepreciation, accumulatedSubsidyRelease } from '../../engine/subledgers/depreciation';
import type { AssetComponent, EntryLine, Subsidy } from '../../engine/types';
import { grantorAccounts } from '../generator/core';

export function depreciationAccount(account: string): string {
  return `28${account.slice(1)}`;
}

/** Depreciation entry lines of a programme for the year (components disposed during the year are booked at disposal). */
export function depreciationLines(components: readonly AssetComponent[], programmeId: string, year: number): EntryLine[] {
  const yEnd = `${year}-12-31`;
  const yPrevEnd = `${year - 1}-12-31`;
  const byAcc = new Map<string, Cents>();
  for (const c of components) {
    if (c.programmeId !== programmeId || c.usefulLifeYears <= 0 || c.inServiceDate > yEnd) continue;
    if (c.disposal && c.disposal.date <= yEnd) continue;
    const dot = accumulatedDepreciation(c, yEnd) - accumulatedDepreciation(c, yPrevEnd);
    if (!dot) continue;
    const a = depreciationAccount(c.account);
    byAcc.set(a, (byAcc.get(a) ?? 0) + dot);
  }
  if (byAcc.size === 0) return [];
  const ref = { refs: [`prog:${programmeId}`] };
  const total = [...byAcc.values()].reduce((x, y) => x + y, 0);
  return [D('68111', total, ref), ...[...byAcc.entries()].map(([a, x]) => C(a, x, ref))];
}

/** Subsidy release lines of a programme for the year. */
export function subsidyReleaseLines(subsidies: readonly Subsidy[], components: readonly AssetComponent[], programmeId: string, year: number): EntryLine[] {
  const yEnd = `${year}-12-31`;
  const yPrevEnd = `${year - 1}-12-31`;
  const byAcc = new Map<string, Cents>();
  for (const s of subsidies) {
    if (s.programmeId !== programmeId || s.decisionDate > yEnd) continue;
    const x = accumulatedSubsidyRelease(s, components, yEnd) - accumulatedSubsidyRelease(s, components, yPrevEnd);
    if (!x) continue;
    const ga = grantorAccounts(s.grantorId);
    byAcc.set(ga.released, (byAcc.get(ga.released) ?? 0) + x);
  }
  if (byAcc.size === 0) return [];
  const ref = { refs: [`prog:${programmeId}`] };
  const total = [...byAcc.values()].reduce((x, y) => x + y, 0);
  return [...[...byAcc.entries()].map(([a, x]) => D(a, x, ref)), C('777', total, ref)];
}
