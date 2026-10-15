/** Ticking helpers (src/game/ticking.ts): keys, display order, progress, marks usage, composition of the statements. */
import { describe, expect, it } from 'vitest';
import { closingBalances, trialBalance } from '../../src/engine/balance';
import { accountMap } from '../../src/engine/chart';
import { buildStatements } from '../../src/engine/statements';
import type { PresentationOverrides, StatementId } from '../../src/engine/types';
import { addTickMark, initialState, removeTickMark, setTick } from '../../src/game/state';
import {
  accountsByPrefixes,
  annexCell,
  annexCells,
  certifiedCell,
  certifiedCells,
  clearTicks,
  componentLines,
  countByPrefix,
  lineComposition,
  markForDigit,
  markUsage,
  movementsByPrefixes,
  orderedLines,
  progressRatio,
  resultComposition,
  statementCell,
  statementCells,
  statementColumns,
  symbolLength,
  tickProgress,
} from '../../src/game/ticking';
import { buildAnnex } from '../../src/scenario/annex';
import { loadParams } from '../../src/scenario/params';
import { world } from '../helpers/world';

const params = loadParams();
const defs = params.statements;
const fresh = () => initialState(params);

describe('cell keys', () => {
  it('follow the documented formats', () => {
    expect(statementCell('A_TERRAINS', 'brut')).toBe('etats:A_TERRAINS:brut');
    expect(statementCell('P_CP', 'n-1')).toBe('etats:P_CP:n-1');
    expect(annexCell('provisions', 'pge', 'dotations')).toBe('annexe:provisions:pge:dotations');
    expect(certifiedCell('PASSIF_TOTAL')).toBe('certifies:PASSIF_TOTAL');
  });
  it('assets have gross, depreciation, net and comparative columns; other statements current and comparative', () => {
    expect(statementColumns('assets')).toEqual(['brut', 'amort', 'n', 'n-1']);
    expect(statementColumns('liabilities')).toEqual(['n', 'n-1']);
    expect(statementColumns('income')).toEqual(['n', 'n-1']);
  });
});

describe('display order', () => {
  it('moves the balance-sheet totals to the bottom and keeps the income statement order', () => {
    const assets = orderedLines(defs, 'assets');
    expect(assets[assets.length - 1]!.def.id).toBe('ACTIF_TOTAL');
    expect(assets[0]!.def.id).toBe('A_IMMO');
    const liabilities = orderedLines(defs, 'liabilities');
    expect(liabilities[liabilities.length - 1]!.def.id).toBe('PASSIF_TOTAL');
    const income = orderedLines(defs, 'income');
    expect(income.map((l) => l.def.id)).toEqual(defs.filter((d) => d.statement === 'income').map((d) => d.id));
    expect(income[income.length - 1]!.def.id).toBe('CR_RESULTAT');
  });
  it('indents by the number of ancestors', () => {
    const depth = (s: StatementId, id: string) => orderedLines(defs, s).find((l) => l.def.id === id)!.depth;
    expect(depth('assets', 'ACTIF_TOTAL')).toBe(0);
    expect(depth('assets', 'A_IMMO')).toBe(1);
    expect(depth('assets', 'A_TERRAINS')).toBe(2);
    expect(depth('liabilities', 'P_EMPRUNTS_CDC')).toBe(3);
    expect(depth('income', 'CR_LOYERS_BRUTS')).toBe(2);
    expect(depth('income', 'CR_RESULTAT')).toBe(0);
  });
  it('lists the children of a subtotal and the signed terms of a formula total', () => {
    expect(componentLines(defs, 'A_IMMO').map((c) => c.def.id)).toEqual(defs.filter((d) => d.parent === 'A_IMMO').map((d) => d.id));
    expect(componentLines(defs, 'CR_RESULTAT_EXPL').map((c) => [c.def.id, c.sign])).toEqual([
      ['CR_PRODUITS_EXPL', 1],
      ['CR_CHARGES_EXPL', -1],
    ]);
    expect(componentLines(defs, 'A_TERRAINS')).toEqual([]);
  });
});

describe('tickable cells', () => {
  it('cover every line and column once', () => {
    for (const s of ['assets', 'liabilities', 'income'] as const) {
      const cells = statementCells(defs, s);
      const lines = defs.filter((d) => d.statement === s).length;
      expect(cells.length).toBe(lines * statementColumns(s).length);
      expect(new Set(cells).size).toBe(cells.length);
    }
    const certified = certifiedCells(defs);
    expect(certified.length).toBe(defs.length);
    expect(certified).toContain('certifies:CR_RESULTAT');
  });
  it('cover every value cell of the annex', () => {
    const tables = [
      { id: 't1', columns: [{ id: 'a' }, { id: 'b' }], rows: [{ id: 'r1' }, { id: 'r2' }] },
      { id: 't2', columns: [{ id: 'm' }], rows: [{ id: 'x' }] },
    ];
    expect(annexCells(tables)).toEqual(['annexe:t1:r1:a', 'annexe:t1:r1:b', 'annexe:t1:r2:a', 'annexe:t1:r2:b', 'annexe:t2:x:m']);
  });
});

describe('progress and marks usage', () => {
  it('counts ticked cells of a list, per mark, ignoring other cells', () => {
    const cells = statementCells(defs, 'liabilities');
    let s = fresh();
    expect(tickProgress(s.ticks, cells)).toEqual({ total: cells.length, ticked: 0, byMark: {} });
    s = setTick(s, statementCell('P_CP', 'n'), 'balance');
    s = setTick(s, statementCell('P_CP', 'n-1'), 'certified');
    s = setTick(s, statementCell('P_CAPITAL', 'n'), 'balance');
    s = setTick(s, statementCell('A_TERRAINS', 'n'), 'gap'); // another tab
    s = setTick(s, certifiedCell('P_CP'), 'certified');
    const p = tickProgress(s.ticks, cells);
    expect(p).toEqual({ total: cells.length, ticked: 3, byMark: { balance: 2, certified: 1 } });
    expect(progressRatio(p)).toBeCloseTo(3 / cells.length);
    expect(progressRatio({ total: 0, ticked: 0, byMark: {} })).toBe(0);
    expect(countByPrefix(s.ticks, 'etats:')).toBe(4);
    expect(countByPrefix(s.ticks, 'certifies:')).toBe(1);
    expect(countByPrefix(s.ticks, 'annexe:')).toBe(0);
  });
  it('counts the uses of every mark, including unused ones, and follows mark removal', () => {
    let s = addTickMark(fresh(), { symbol: 'R', label: 'Recalculé', tone: 'accent' });
    const custom = s.tickMarks[s.tickMarks.length - 1]!.id;
    s = setTick(s, annexCell('provisions', 'pge', 'fin'), custom);
    s = setTick(s, annexCell('provisions', 'pge', 'debut'), custom);
    s = setTick(s, statementCell('P_PGE', 'n'), 'balance');
    const usage = markUsage(s.ticks, s.tickMarks);
    expect(usage[custom]).toBe(2);
    expect(usage['balance']).toBe(1);
    expect(usage['gap']).toBe(0);
    expect(Object.keys(usage).length).toBe(s.tickMarks.length);
    s = removeTickMark(s, custom);
    expect(markUsage(s.ticks, s.tickMarks)[custom]).toBeUndefined();
    expect(countByPrefix(s.ticks, 'annexe:')).toBe(0);
  });
  it('clears the ticks of a set of cells and leaves the others', () => {
    let s = fresh();
    s = setTick(s, statementCell('P_CP', 'n'), 'balance');
    s = setTick(s, statementCell('A_TERRAINS', 'n'), 'balance');
    const cleared = clearTicks(s, statementCells(defs, 'liabilities'));
    expect(cleared.ticks).toEqual({ [statementCell('A_TERRAINS', 'n')]: 'balance' });
    expect(clearTicks(cleared, statementCells(defs, 'liabilities'))).toBe(cleared);
  });
  it('maps digit keys to marks and measures symbols in visible characters', () => {
    const marks = fresh().tickMarks;
    expect(markForDigit(marks, '1')).toBe(marks[0]);
    expect(markForDigit(marks, '2')).toBe(marks[1]);
    expect(markForDigit(marks, '0')).toBeUndefined();
    expect(markForDigit(marks, '9')).toBeUndefined();
    expect(markForDigit(marks, 'a')).toBeUndefined();
    expect(symbolLength(' ✓ ')).toBe(1);
    expect(symbolLength('Ⓒ1')).toBe(2);
  });
});

describe('composition of the statements from the balance', () => {
  const w = world().world;
  const chart = accountMap(w.chart);
  const current = closingBalances(w.ledgers.current);
  const prior = closingBalances(w.ledgers.prior);
  const { current: cy, prior: py } = params.scenario.years;

  const check = (presentation: PresentationOverrides) => {
    const st = buildStatements({ defs, chart: w.chart, current, prior, currentYear: cy, priorYear: py, presentation });
    for (const def of defs) {
      if (def.kind !== 'detail') continue;
      const v = st.lines[def.id]!;
      if (def.isResult) {
        expect(resultComposition(current).result, def.id).toBe(v.current);
        expect(resultComposition(prior).result, def.id).toBe(v.prior);
        continue;
      }
      const n = lineComposition(def, current, chart, presentation, cy);
      const n1 = lineComposition(def, prior, chart, presentation, py);
      expect(n.total, `${def.id} ${cy}`).toBe(v.current);
      expect(n1.total, `${def.id} ${py}`).toBe(v.prior);
      if (def.statement === 'assets') {
        expect(n.gross, def.id).toBe(v.currentGross);
        expect(n.depreciation, def.id).toBe(v.currentDepreciation);
      }
      for (const it of n.items) expect(it.balance).not.toBe(0);
    }
    return st;
  };

  it('every detail line equals the sum of the accounts mapped to it (both years)', () => {
    const st = check(w.presentation);
    expect(resultComposition(current).result).toBe(st.lines['CR_RESULTAT']!.current);
  });

  it('follows a presentation reclassification and flags the reclassified accounts', () => {
    const presentation: PresentationOverrides = { reclassifications: [{ account: '1651', to: 'P_AUTRES_DETTES', years: [py] }], annexCells: [] };
    check(presentation);
    const def = defs.find((d) => d.id === 'P_AUTRES_DETTES')!;
    const n1 = lineComposition(def, prior, chart, presentation, py);
    const n = lineComposition(def, current, chart, presentation, cy);
    expect(n1.items.find((i) => i.account === '1651')?.reclassified).toBe(true);
    expect(n.items.some((i) => i.account === '1651')).toBe(false);
  });

  it('puts contra-asset accounts in the depreciation column, positive', () => {
    const def = defs.find((d) => d.id === 'A_CONSTRUCTIONS')!;
    const c = lineComposition(def, current, chart, w.presentation, cy);
    const dep = c.items.filter((i) => i.part === 'depreciation');
    expect(dep.length).toBeGreaterThan(0);
    for (const i of dep) {
      expect(i.account.startsWith('28') || i.account.startsWith('29')).toBe(true);
      expect(i.amount).toBe(-i.balance);
    }
    expect(c.depreciation).toBeGreaterThan(0);
  });

  it('lists the accounts behind an annex row with opening and closing balances', () => {
    const tables = buildAnnex(w, params, 'current');
    const row = tables.find((t) => t.id === 'immobilisations')!.rows.find((r) => r.id === 'terrains')!;
    const r = accountsByPrefixes(row.accounts, prior, current);
    expect(r.accounts.length).toBeGreaterThan(0);
    expect(r.accounts.every((a) => row.accounts.some((p) => a.account.startsWith(p)))).toBe(true);
    expect(r.closing).toBe(row.values['fin']);
    expect(r.opening).toBe(row.values['debut']);
    expect(accountsByPrefixes([], prior, current)).toEqual({ accounts: [], opening: 0, closing: 0 });
    const synthetic = accountsByPrefixes(['41'], new Map([['4111', 500], ['4011', 7], ['4115', 0]]), new Map([['4111', 300], ['4115', 0], ['4116', -20]]));
    expect(synthetic).toEqual({ accounts: [{ account: '4111', opening: 500, closing: 300 }, { account: '4116', opening: 0, closing: -20 }], opening: 500, closing: 280 });
  });

  it('lists the movements of the year behind an annex row (opening entries excluded)', () => {
    const rows = [
      { account: '4911', debit: 10, credit: 70 },
      { account: '4011', debit: 5, credit: 5 },
      { account: '4915', debit: 0, credit: 0 },
      { account: '4916', debit: 3, credit: 0 },
    ];
    expect(movementsByPrefixes(['491'], rows)).toEqual({ accounts: [{ account: '4911', debit: 10, credit: 70 }, { account: '4916', debit: 3, credit: 0 }], debit: 13, credit: 70 });
    expect(movementsByPrefixes([], rows)).toEqual({ accounts: [], debit: 0, credit: 0 });
    // the closing balance of an annex row = opening + debit − credit of its accounts
    const tables = buildAnnex(w, params, 'current');
    const row = tables.find((t) => t.id === 'provisions')!.rows.find((r) => r.id === 'pge')!;
    const tb = trialBalance(w.ledgers.current, w.chart).rows;
    const m = movementsByPrefixes(row.accounts, tb);
    const b = accountsByPrefixes(row.accounts, prior, current);
    expect(b.opening + m.debit - m.credit).toBe(b.closing);
    expect(m.credit).toBe(row.values['dotations']);
    expect(m.debit).toBe(row.values['reprises']);
  });
});
