/** §3.1 and §3.4 — presented world: integrity, central invariant, deliberate exceptions (A18, A19, A21, A22). */
import { describe, expect, it } from 'vitest';
import { closingBalances, closingBalancesByAux, trialBalance } from '../../src/engine/balance';
import { checkEntry, checkLedger } from '../../src/engine/ledger';
import { outstandingAt } from '../../src/engine/subledgers/loans';
import { buildAnnex, transposeDigits23 } from '../../src/scenario/annex';
import { depreciationLines, subsidyReleaseLines } from '../../src/scenario/anomalies/closing';
import { PART_KEYS } from '../../src/scenario/anomalies/modules';
import { buildState, stateFigures } from '../../src/scenario/anomalies/presented';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { CLEAN_METHOD, impairmentMovements } from '../../src/scenario/impairment';
import { correctionKey } from '../helpers/scenario';
import { params, world } from '../helpers/world';

const strip = (lines: readonly { account: string; debit: number; credit: number; aux?: string }[]) => lines.map((l) => [l.account, l.aux ?? '', l.debit, l.credit]);

describe('presented world', () => {
  const key = correctionKey();
  const presented = key.presented.world;
  const clean = world().world;

  it('every entry is balanced and dated in the year; the trial balance is balanced', () => {
    expect(checkLedger(presented.ledgers.current)).toEqual([]);
    expect(trialBalance(presented.ledgers.current, presented.chart).totals.closing).toBe(0);
  });
  it('balance sheet assets = liabilities and income statement result = balance sheet result (presented and corrected)', () => {
    for (const f of [key.presentedFigures, key.cleanFigures]) {
      expect(f.statements.checks.assetsTotal).toBe(f.statements.checks.liabilitiesTotal);
      expect(f.statements.checks.incomeStatementResult).toBe(f.statements.checks.balanceSheetResult);
      expect(f.statements.checks.priorAssetsTotal).toBe(f.statements.checks.priorLiabilitiesTotal);
    }
  });
  it('central invariant: presented + Σ correction entries = clean (by account and auxiliary account)', () => {
    const acc = closingBalancesByAux(presented.ledgers.current);
    for (const c of key.corrections) for (const l of c.entry?.lines ?? []) {
      const k = `${l.account}|${l.aux ?? ''}`;
      acc.set(k, (acc.get(k) ?? 0) + l.debit - l.credit);
    }
    const target = closingBalancesByAux(clean.ledgers.current);
    for (const k of new Set([...acc.keys(), ...target.keys()])) expect(acc.get(k) ?? 0, k).toBe(target.get(k) ?? 0);
  });
  it('every correction entry is balanced; the state without anomalies is the clean world', () => {
    for (const c of key.corrections) if (c.entry) expect(checkEntry(c.entry)).toEqual([]);
    const none = buildState(clean, params(), []);
    expect(none.world.ledgers.current.entries).toEqual(clean.ledgers.current.entries);
    expect([...closingBalances(none.world.ledgers.current)]).toEqual([...closingBalances(clean.ledgers.current)]);
  });
  it('the closing entries recomputed from unchanged sub-ledgers are the clean entries', () => {
    const ds = clean.datasets as unknown as ScenarioDatasets;
    const entries = clean.ledgers.current.entries;
    for (const pid of new Set(ds.components.map((c) => c.programmeId))) {
      const amort = entries.find((e) => e.pieceRef === `INV2025-AMORT-${pid}`);
      expect(strip(depreciationLines(ds.components, pid, 2025)), pid).toEqual(strip(amort?.lines ?? []));
    }
    for (const pid of new Set(ds.subsidies.map((s) => s.programmeId))) {
      const qps = entries.find((e) => e.pieceRef === `INV2025-QPS-${pid}`);
      expect(strip(subsidyReleaseLines(ds.subsidies, ds.components, pid, 2025)), pid).toEqual(strip(qps?.lines ?? []));
    }
    const depr = entries.find((e) => e.pieceRef === 'INV2025-DEPR')!;
    expect(strip(impairmentMovements(ds.tenants, params(), 2025, CLEAN_METHOD).lines)).toEqual(strip(depr.lines));
  });
  it('N-1 column = certified 2024 accounts, except the deposits reclassified by A22', () => {
    const affected = new Set(['P_DEPOTS', 'P_AUTRES_DETTES', 'P_DETTES_FIN']);
    for (const [id, v] of Object.entries(key.presentedFigures.statements.lines)) {
      const certified = key.cleanFigures.statements.lines[id]!.prior;
      if (affected.has(id)) continue;
      expect(v.prior, id).toBe(certified);
    }
    expect(key.presentedFigures.statements.lines['P_DEPOTS']!.prior).toBe(0);
    const withoutA22 = stateFigures(buildState(clean, params(), PART_KEYS.filter((k) => k !== 'A22')).world, params());
    for (const [id, v] of Object.entries(withoutA22.statements.lines)) expect(v.prior, id).toBe(key.cleanFigures.statements.lines[id]!.prior);
  });
  it('annex: deliberate reporting error (A21) and omitted commitments (A12, A13, A16)', () => {
    const tables = buildAnnex(presented, params(), 'current');
    const row = tables.find((t) => t.id === 'provisions')!.rows.find((r) => r.id === 'creances-locataires')!;
    let credits = 0;
    for (const e of presented.ledgers.current.entries) if (e.journal !== 'AN') for (const l of e.lines) if (['4911', '4915', '4916'].includes(l.account)) credits += l.credit;
    expect(row.values['dotations']).toBe(transposeDigits23(credits));
    expect(row.values['dotations']).not.toBe(credits);
    const commitments = tables.find((t) => t.id === 'engagements')!.rows.map((r) => r.id);
    expect(commitments).not.toContain('ifc');
    expect(commitments).not.toContain('avance-groupe');
    expect(commitments).not.toContain('passif-eventuel-tilleuls');
    const cleanCommitments = buildAnnex(clean, params(), 'current').find((t) => t.id === 'engagements')!.rows.map((r) => r.id);
    expect(cleanCommitments).toEqual(expect.arrayContaining(['ifc', 'avance-groupe', 'passif-eventuel-tilleuls']));
  });
  it('tenant auxiliary = tenant accounts of the general ledger, except the duplicated batch of A19', () => {
    const ds = presented.datasets as unknown as ScenarioDatasets;
    const b = closingBalances(presented.ledgers.current);
    const bal = (p: string[]) => [...b].filter(([a]) => p.some((x) => a.startsWith(x))).reduce((s, [, v]) => s + v, 0);
    const presentTotal = ds.tenants.reduce((s, t) => s + (t.byYear.y2025 && t.byYear.y2025.category !== 'former' && ds.leases.some((l) => l.tenantId === t.id && l.start <= '2025-12-31' && (!l.end || l.end > '2025-12-31')) ? t.byYear.y2025.balance : 0), 0);
    const duplicate = key.corrections.find((c) => c.key === 'A19')!.entry!.lines.find((l) => l.account === '4111')!.credit;
    expect(bal(['4111', '4116', '4191']) - presentTotal).toBe(duplicate);
    expect(bal(['4115'])).toBe(ds.tenants.reduce((s, t) => s + (t.byYear.y2025?.category === 'former' ? t.byYear.y2025.balance : 0), 0));
  });
  it('loans by account = debt statement of the presented world; the Banque des Territoires confirms the drawdown of A18 on top', () => {
    const ds = presented.datasets as unknown as ScenarioDatasets;
    const b = closingBalances(presented.ledgers.current);
    for (const account of ['1631', '1641', '1678']) {
      const crd = ds.loans.filter((l) => l.account === account).reduce((s, l) => s + outstandingAt(l, ds.loanSchedules.filter((x) => x.loanId === l.id), '2025-12-31'), 0);
      expect(0 - (b.get(account) ?? 0), account).toBe(crd);
    }
    expect(0 - (b.get('471') ?? 0)).toBeGreaterThan(0);
  });
});
