/** Master worksheets by cycle (plan J4 §12): figures, derived references, explanations, conclusion. Pure rules. */
import { describe, expect, it } from 'vitest';
import { closingBalances } from '../../src/engine/balance';
import { workCalendar } from '../../src/game/calendar';
import { conditionContext } from '../../src/game/conditions';
import { deserialize, serialize } from '../../src/game/persistence';
import { captureRiskFactor } from '../../src/game/planning';
import { launchExecution, procedureProgress } from '../../src/game/program';
import { EMPTY_QUERY } from '../../src/game/fec-query';
import { initialState, saveQuery, type GameState } from '../../src/game/state';
import {
  concludeMasterSheet,
  explainVariation,
  masterFormCheck,
  masterReferences,
  masterRows,
  masterSheetOf,
  masterStatus,
  referenceCount,
  removeExplanation,
  togglePin,
  variationsToExplain,
} from '../../src/game/worksheets';
import { loadParams } from '../../src/scenario/params';
import { correctionKey } from '../helpers/scenario';

const params = loadParams();
const cal = workCalendar(params);
const fresh = (): GameState => initialState(params);
const cycle = (id: string) => params.cycles.cycles.find((c) => c.id === id)!;

describe('master sheet figures', () => {
  it('shows each group of accounts signed as presented, N against N-1, and the variation', () => {
    const current = new Map([
      ['70411', -10_000_00],
      ['70491', 1_000_00],
      ['4111', 2_000_00],
    ]);
    const prior = new Map([
      ['70411', -8_000_00],
      ['4111', 2_500_00],
    ]);
    const rows = masterRows(cycle('rentReceivables'), current, prior);
    const rents = rows.find((r) => r.id === 'rents')!;
    expect(rents).toMatchObject({ current: 9_000_00, prior: 8_000_00, variation: 1_000_00 });
    expect(rents.variationPct).toBeCloseTo(0.125);
    expect(rows.find((r) => r.id === 'receivables')).toMatchObject({ current: 2_000_00, prior: 2_500_00, variation: -500_00 });
    // before the 2025 data: N-1 only
    expect(masterRows(cycle('rentReceivables'), null, prior).find((r) => r.id === 'rents')).toMatchObject({ current: null, variation: null, prior: 8_000_00 });
    expect(variationsToExplain(rows, 900_00, 10).map((r) => r.id)).toEqual(['rents']);
  });

  it('reads non-zero amounts on the presented balances for every cycle with accounts', () => {
    const w = correctionKey().presented.world;
    const b = closingBalances(w.ledgers.current);
    const rows = params.cycles.cycles.flatMap((c) => masterRows(c, b, b));
    // every group reads amounts; at least one group per cycle with accounts is non-zero
    for (const c of params.cycles.cycles.filter((x) => x.lines.length > 0)) expect(masterRows(c, b, b).some((r) => r.current !== 0), c.id).toBe(true);
    expect(rows.length).toBeGreaterThan(30);
  });
});

describe('master sheet references, status and form check', () => {
  it('derives the references of the cycle from the executions, risk factors, findings and saved queries', () => {
    let s = fresh();
    const ctx = { ...conditionContext(s, params, s.clock.date, { procedureProgress: procedureProgress(s.program, cal, s.clock.date) }), cal };
    s = launchExecution(s, params, 'fixed-assets-walkthrough', 'senior', ctx);
    s = launchExecution(s, params, 'board-minutes', 'senior', ctx);
    s = captureRiskFactor(s, { docId: 'pv-ca-2025-06', block: 3, cycle: 'fixedAssets', assertion: 'valuation', note: '' });
    s = saveQuery(s, 'Immobilisations en cours', { ...EMPTY_QUERY, accounts: ['231'] });
    s = saveQuery(s, 'Ventes', { ...EMPTY_QUERY, accounts: ['7752'] });
    s = saveQuery(s, 'Tout', { ...EMPTY_QUERY, validatedAfterClosing: true });
    const refs = masterReferences(s, params, cycle('fixedAssets'));
    expect(refs.executions).toHaveLength(1);
    expect(refs.documents).toEqual(['pv-ca-2025-06']);
    expect(refs.queries).toHaveLength(2);
    expect(masterStatus(masterSheetOf(s, 'fixedAssets'), refs)).toBe('inProgress');
    expect(masterStatus(masterSheetOf(s, 'purchases'), masterReferences(s, params, cycle('purchases')))).toBe('notStarted');
    expect(referenceCount(refs)).toBe(4);
  });

  it('records explanations with evidence, pins and the conclusion; flags a conclusion without reference', () => {
    let s = explainVariation(fresh(), 'purchases', 'external', '  Études de renouvellement urbain  ', ['contrats-etudes-npnru', 'contrats-etudes-npnru']);
    expect(masterSheetOf(s, 'purchases').explained['external']).toEqual({ text: 'Études de renouvellement urbain', evidence: ['contrats-etudes-npnru'], on: '2025-11-03' });
    expect(explainVariation(s, 'purchases', 'payroll', '  ', [])).toBe(s);
    s = togglePin(s, 'purchases', 'doc:accord-nao-2025');
    expect(masterSheetOf(s, 'purchases').pins).toEqual(['doc:accord-nao-2025']);
    expect(masterReferences(s, params, cycle('purchases')).documents.sort()).toEqual(['accord-nao-2025', 'contrats-etudes-npnru']);
    s = togglePin(s, 'purchases', 'doc:accord-nao-2025');
    expect(concludeMasterSheet(s, params, 'purchases', 'nonsense', '')).toBe(s);
    s = concludeMasterSheet(s, params, 'purchases', 'satisfactory', 'RAS');
    const sheet = masterSheetOf(s, 'purchases');
    expect(sheet).toMatchObject({ conclusion: 'satisfactory', comment: 'RAS', on: '2025-11-03' });
    const refs = masterReferences(s, params, cycle('purchases'));
    expect(masterStatus(sheet, refs)).toBe('concluded');
    const rows = [{ id: 'payroll', label: 'Charges de personnel', current: 10, prior: 5, variation: 5, variationPct: 1 }];
    expect(masterFormCheck(sheet, refs, rows)).toEqual(['Variations significatives non expliquées : Charges de personnel.']);
    const bare = concludeMasterSheet(removeExplanation(s, 'purchases', 'external'), params, 'purchases', 'satisfactory', '');
    expect(masterFormCheck(masterSheetOf(bare, 'purchases'), masterReferences(bare, params, cycle('purchases')), [])).toEqual(['Feuille maîtresse conclue sans aucune référence aux travaux.']);
    const r = deserialize(serialize(s), fresh());
    expect(r.ok && r.state.worksheets).toEqual(s.worksheets);
  });
});
