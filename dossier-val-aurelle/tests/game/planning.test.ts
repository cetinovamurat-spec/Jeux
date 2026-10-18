/** Planning (plan J4 §6): materiality, risks, fraud presumption, coverage, leaving the planning. Pure rules. */
import { describe, expect, it } from 'vitest';
import { closingBalances } from '../../src/engine/balance';
import { advanceTo } from '../../src/game/advance';
import { deserialize, serialize } from '../../src/game/persistence';
import {
  assessMateriality,
  baseAmount,
  captureRiskFactor,
  clearRisk,
  coverage,
  currentMateriality,
  cycleOfAccount,
  deleteRiskFactor,
  fraudRetained,
  INTERIM_WITHOUT_PLANNING,
  latestVintage,
  leavePlanningCheck,
  materialityErrors,
  materialityFrom,
  materialityRevisionDue,
  maxRiskOfCycle,
  monthsCovered,
  partnerReaction,
  planningThreshold,
  recordInterimWithoutPlanning,
  riskErrors,
  riskLevelOf,
  roundToUnit,
  setFraudPresumption,
  setRisk,
  significantAccounts,
  thresholdsOf,
  toggleLaw,
  uncoveredRisks,
  validateMateriality,
  validateRisks,
  vintageInputs,
  type MaterialityChoice,
} from '../../src/game/planning';
import { planProcedure, validateProgramme } from '../../src/game/program';
import { initialState, type GameState } from '../../src/game/state';
import { ledgerAt, type DataView } from '../../src/game/vintages';
import { loadParams } from '../../src/scenario/params';
import { correctionKey } from '../helpers/scenario';

const params = loadParams();
const fresh = (): GameState => initialState(params);
const base = (id: string) => params.planning.bases.find((b) => b.id === id)!;
const EUR = 100;

function presentedInputs(view: DataView) {
  const w = correctionKey().presented.world;
  const current = view.ledger2025 === 'none' ? new Map<string, number>() : closingBalances(view.ledger2025 === 'interim' ? ledgerAt(w.ledgers.current, view.cutoff) : w.ledgers.current);
  return vintageInputs({ current, prior: closingBalances(w.ledgers.prior), chart: w.chart, statements: params.statements, presentation: w.presentation, view, currentYear: 2025 });
}

const DRAFT: DataView = { ledger2025: 'draft', statements2025: true, cutoff: '2025-12-31', priorCutoff: '2024-12-31' };
const INTERIM: DataView = { ledger2025: 'interim', statements2025: false, cutoff: '2025-10-31', priorCutoff: '2024-10-31' };
const NONE: DataView = { ledger2025: 'none', statements2025: false, cutoff: '2025-10-31', priorCutoff: '2024-10-31' };

function choice(over: Partial<MaterialityChoice> = {}): Omit<MaterialityChoice, 'on'> {
  return { base: 'rents', vintage: 'draft2025', baseAmount: 46_400_000 * EUR, pct: 1.25, amount: 580_000 * EUR, planningPct: 65, trivialPct: 5, specificPct: null, factors: ['users'], comment: '', ...over };
}

describe('materiality: base amounts from the balances available at the date', () => {
  it('offers the certified 2024 accounts first, then the extraction (annualised), then the draft accounts', () => {
    expect(Object.keys(presentedInputs(NONE))).toEqual(['certified2024']);
    expect(Object.keys(presentedInputs(INTERIM)).sort()).toEqual(['certified2024', 'interim']);
    expect(Object.keys(presentedInputs(DRAFT)).sort()).toEqual(['certified2024', 'draft2025']);
    expect(latestVintage(presentedInputs(INTERIM))).toBe('interim');
    expect(monthsCovered('2025-10-31')).toBe(10);
    expect(monthsCovered('2025-10-15')).toBe(9);
    expect(monthsCovered('2025-12-31')).toBe(12);
  });

  it('gives the reference materiality of §4.7 on the net rents of the draft accounts (≈ 580 k€, 1 % – 1,5 % ≈ 470 – 700 k€)', () => {
    const inputs = presentedInputs(DRAFT);
    const rents = baseAmount(base('rents'), inputs.draft2025!);
    expect(rents / EUR).toBeGreaterThan(45_500_000);
    expect(rents / EUR).toBeLessThan(47_500_000);
    const m = materialityFrom(rents, params.planning.reference.pct, 5000);
    expect(m / EUR).toBeGreaterThanOrEqual(570_000);
    expect(m / EUR).toBeLessThanOrEqual(590_000);
    expect(m % (5000 * EUR)).toBe(0);
    const [lo, hi] = params.planning.reference.pctRange;
    expect(materialityFrom(rents, lo, 0) / EUR).toBeGreaterThan(450_000);
    expect(materialityFrom(rents, hi, 0) / EUR).toBeLessThan(720_000);
    const t = thresholdsOf({ amount: m, planningPct: params.planning.reference.planningPct, trivialPct: params.planning.reference.trivialPct, specificPct: null });
    expect(t.planning / EUR).toBeGreaterThan(360_000);
    expect(t.planning / EUR).toBeLessThan(390_000);
    expect(t.trivial / EUR).toBeGreaterThan(28_000);
    expect(t.trivial / EUR).toBeLessThan(30_000);
  });

  it('annualises the flows of the extraction, not the stocks', () => {
    const inputs = presentedInputs(INTERIM);
    const i = inputs.interim!;
    expect(i.months).toBe(10);
    const rawRents = -[...i.balances].filter(([a]) => a.startsWith('704')).reduce((s, [, b]) => s + b, 0);
    expect(baseAmount(base('rents'), i)).toBe(Math.round((rawRents * 12) / 10));
    const assets = baseAmount(base('totalAssets'), i);
    expect(baseAmount(base('totalAssets'), { ...i, months: 12 })).toBe(assets);
  });

  it('reads the certified 2024 totals like the certified statements', () => {
    const inputs = presentedInputs(NONE);
    const cert = correctionKey().cleanFigures.statements.lines;
    expect(baseAmount(base('totalAssets'), inputs.certified2024!)).toBe(cert['ACTIF_TOTAL']!.prior);
    expect(baseAmount(base('netResult'), inputs.certified2024!)).toBe(cert['CR_RESULTAT']!.prior);
  });

  it('gives several millions on the total assets or the equity (unsuitable bases)', () => {
    const d = presentedInputs(DRAFT).draft2025!;
    for (const id of ['totalAssets', 'equity']) {
      const b = base(id);
      expect(materialityFrom(baseAmount(b, d), b.pctRange[0], 0) / EUR, id).toBeGreaterThan(2_000_000);
      expect(b.suitability).toBe('unsuitable');
    }
  });

  it('rounds to the unit chosen', () => {
    expect(roundToUnit(578_437 * EUR, 5000)).toBe(580_000 * EUR);
    expect(roundToUnit(578_437 * EUR, 0)).toBe(578_437 * EUR);
    expect(roundToUnit(578_437_12, 1000)).toBe(578_000 * EUR);
  });
});

describe('materiality: feedback, validation, history and revision', () => {
  it('approves the recommended base within the ranges and flags the others, without naming the case', () => {
    const ok = assessMateriality(params, choice());
    expect(ok.every((f) => f.tone === 'ok')).toBe(true);
    expect(partnerReaction(params, 'senior', ok)).toBeNull();
    const assets = assessMateriality(params, choice({ base: 'totalAssets', pct: 0.75 }));
    expect(assets.some((f) => f.tone === 'ko')).toBe(true);
    expect(partnerReaction(params, 'senior', assets)).not.toBeNull();
    expect(partnerReaction(params, 'manager', assets)).toBeNull();
    const out = assessMateriality(params, choice({ pct: 3, planningPct: 90, trivialPct: 10 }));
    expect(out.filter((f) => f.tone === 'warn').length).toBe(3);
    expect(assessMateriality(params, choice({ vintage: 'interim' })).some((f) => f.text.includes('annualisé'))).toBe(true);
  });

  it('requires a justification (a factor or a comment) and keeps the history of the decisions', () => {
    let s = fresh();
    expect(materialityErrors(params, { ...choice({ factors: [], comment: '  ' }), on: s.clock.date })).toHaveLength(1);
    expect(validateMateriality(s, params, choice({ factors: [], comment: '' }))).toBe(s);
    s = validateMateriality(s, params, choice({ vintage: 'certified2024' }));
    expect(s.planning.validated.materiality).toBe('2025-11-03');
    expect(planningThreshold(s.planning)).toBe(377_000 * EUR);
    s = validateMateriality(advanceTo(s, '2026-02-23'), params, choice({ amount: 590_000 * EUR, comment: 'Révision sur le projet de comptes' }));
    expect(s.planning.materiality).toHaveLength(2);
    expect(currentMateriality(s.planning)!.amount).toBe(590_000 * EUR);
    expect(s.journal.filter((e) => e.kind === 'materiality').map((e) => e.data?.['revision'])).toEqual([false, true]);
  });

  it('requires the revision on the draft accounts from the start of the final', () => {
    let s = validateMateriality(fresh(), params, choice({ vintage: 'interim' }));
    expect(materialityRevisionDue(s.planning, params, '2026-02-20')).toBe(false);
    expect(materialityRevisionDue(s.planning, params, '2026-02-23')).toBe(true);
    s = validateMateriality(advanceTo(s, '2026-02-24'), params, choice({ vintage: 'draft2025' }));
    expect(materialityRevisionDue(s.planning, params, '2026-02-24')).toBe(false);
  });
});

describe('risks, fraud presumption, laws and regulations', () => {
  it('rates every cycle moderate by default; an assertion takes its cycle level until detailed', () => {
    let s = fresh();
    expect(riskLevelOf(s.planning, 'provisions')).toBe('moderate');
    s = setRisk(s, 'provisions', null, 'low', '');
    expect(riskLevelOf(s.planning, 'provisions', 'valuation')).toBe('low');
    s = setRisk(s, 'provisions', 'valuation', 'significant', 'Estimation de la direction');
    expect(riskLevelOf(s.planning, 'provisions', 'valuation')).toBe('significant');
    expect(maxRiskOfCycle(s.planning, 'provisions')).toBe('significant');
    s = clearRisk(s, 'provisions:valuation');
    expect(maxRiskOfCycle(s.planning, 'provisions')).toBe('low');
    expect(s.journal.filter((e) => e.kind === 'risk')).toHaveLength(3);
  });

  it('logs the risk decisions with a French title when the parameters are given (desk journal)', () => {
    let s = setRisk(fresh(), 'provisions', 'valuation', 'significant', 'Estimation', params);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'risk', ref: 'provisions:valuation', data: { level: 'significant', title: 'Provisions – Évaluation : risque important' } });
    s = setFraudPresumption(s, 'recurringRents', false, 'Automatique', params);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'risk', ref: 'fraud:recurringRents', data: { retained: false } });
    expect(String(s.journal.at(-1)!.data!['title'])).toMatch(/réfutée$/);
    s = toggleLaw(s, 'rentRevision', params);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'risk', ref: 'laws:rentRevision', data: { retained: true } });
    s = validateRisks(s, params);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'risk', ref: 'validated', data: { action: 'validate' } });
  });

  it('asks a justification for high and significant risks only, and for a rebutted fraud presumption', () => {
    let s = setRisk(fresh(), 'fixedAssets', null, 'high', '  ');
    s = setRisk(s, 'purchases', null, 'low', '');
    expect(riskErrors(params, s.planning)).toHaveLength(1);
    expect(validateRisks(s, params)).toBe(s);
    s = setRisk(s, 'fixedAssets', null, 'high', 'Opérations livrées et composants');
    expect(fraudRetained(s.planning, 'recurringRents')).toBe(true);
    s = setFraudPresumption(s, 'recurringRents', false, '');
    expect(riskErrors(params, s.planning)).toHaveLength(1);
    s = setFraudPresumption(s, 'recurringRents', false, 'Quittancement automatique, contrôles testés');
    expect(fraudRetained(s.planning, 'recurringRents')).toBe(false);
    expect(riskErrors(params, s.planning)).toEqual([]);
  });

  it('always retains management override: validating the risks adds its mandatory responses to the programme', () => {
    const s = validateRisks(fresh(), params);
    expect(s.planning.validated.risks).toBe('2025-11-03');
    const planned = s.program.planned.map((p) => p.procedureId);
    for (const id of params.planning.overrideResponses) expect(planned).toContain(id);
    // idempotent
    expect(validateRisks(s, params).program.planned).toHaveLength(planned.length);
  });

  it('shows the coverage of the risks by the planned procedures and the risks left without a response', () => {
    let s = setRisk(fresh(), 'debtTreasury', null, 'high', 'Endettement important');
    s = toggleLaw(s, 'rentRevision');
    const before = uncoveredRisks(s.planning, s.program, params).map((r) => r.key);
    expect(before).toContain('debtTreasury');
    expect(before).toContain('laws:rentRevision');
    expect(before).toContain('override');
    expect(before).toContain('fraud:recurringRents');
    s = planProcedure(s, params, 'icne-recalc');
    s = planProcedure(s, params, 'rent-increase');
    s = validateRisks(s, params);
    const rows = coverage(s.planning, s.program, params);
    expect(rows.find((r) => r.key === 'debtTreasury')!.procedures).toContain('icne-recalc');
    const after = uncoveredRisks(s.planning, s.program, params).map((r) => r.key);
    expect(after).not.toContain('debtTreasury');
    expect(after).not.toContain('laws:rentRevision');
    expect(after).not.toContain('override');
    expect(after).not.toContain('fraud:recurringRents');
    // a cycle left moderate expects no response
    expect(rows.find((r) => r.key === 'purchases')!.required).toBe(false);
    s = toggleLaw(s, 'rentRevision');
    expect(s.planning.laws).toEqual([]);
  });

  it('captures risk factors from document passages', () => {
    let s = captureRiskFactor(fresh(), { docId: 'pv-ca-2025-03', block: 4, cycle: 'fixedAssets', assertion: 'valuation', note: '  à suivre ' });
    expect(s.planning.riskFactors).toHaveLength(1);
    const f = s.planning.riskFactors[0]!;
    expect(f).toMatchObject({ docId: 'pv-ca-2025-03', block: 4, cycle: 'fixedAssets', note: 'à suivre', on: '2025-11-03' });
    expect(captureRiskFactor(s, { docId: '', block: null, cycle: 'x', assertion: null, note: '' })).toBe(s);
    s = deleteRiskFactor(s, f.id);
    expect(s.planning.riskFactors).toEqual([]);
  });
});

describe('accounts by cycle and significant accounts', () => {
  it('maps every account of the chart to a cycle by its longest prefix', () => {
    const cycles = params.cycles.cycles;
    expect(cycleOfAccount('4114', cycles)).toBe('rentReceivables');
    expect(cycleOfAccount('2313', cycles)).toBe('fixedAssets');
    expect(cycleOfAccount('1651', cycles)).toBe('debtTreasury');
    expect(cycleOfAccount('61522', cycles)).toBe('purchases');
    expect(cycleOfAccount('6111', cycles)).toBe('purchases');
    expect(cycleOfAccount('13913', cycles)).toBe('equitySubsidies');
    expect(cycleOfAccount('68157', cycles)).toBe('provisions');
    expect(cycleOfAccount('7718', cycles)).toBe('crossCycle');
    // only a few accounts are left to the cross-cycle work
    const unassigned = params.chart.accounts.filter((a) => cycleOfAccount(a.number, cycles) === 'crossCycle').map((a) => a.number);
    expect(unassigned.length).toBeLessThanOrEqual(4);
  });

  it('lists the accounts of each cycle reaching the planning materiality', () => {
    const balances = new Map([
      ['2131', 900_000_00],
      ['28131', -500_000_00],
      ['4111', 10_000_00],
      ['1572', -400_000_00],
    ]);
    const sig = significantAccounts(balances, params.cycles.cycles, 375_000_00);
    expect(sig.find((x) => x.cycle === 'fixedAssets')!.accounts.map((a) => a.account)).toEqual(['2131', '28131']);
    expect(sig.find((x) => x.cycle === 'rentReceivables')!.accounts).toEqual([]);
    expect(sig.find((x) => x.cycle === 'provisions')!.accounts).toHaveLength(1);
  });
});

describe('leaving the planning (« Aller à l’intérim »)', () => {
  it('warns when moving into the interim without validated materiality, risks and programme, and records the gauge event once', () => {
    let s = fresh();
    expect(leavePlanningCheck(s, params, '2025-11-14')).toBeNull();
    const check = leavePlanningCheck(s, params, '2025-11-17')!;
    expect(check.missing.map((m) => m.step)).toEqual(['materiality', 'risks', 'program']);
    expect(check.alreadyRecorded).toBe(false);
    s = recordInterimWithoutPlanning(s);
    expect(s.gauges.events).toEqual([{ on: '2025-11-03', gauge: 'partnerTrust', reason: INTERIM_WITHOUT_PLANNING, ref: 'materiality,risks,program' }]);
    expect(recordInterimWithoutPlanning(s)).toBe(s);
    expect(leavePlanningCheck(s, params, '2026-02-23')!.alreadyRecorded).toBe(true);
    // once in the interim, nothing to check
    expect(leavePlanningCheck(advanceTo(s, '2025-11-17'), params, '2025-11-18')).toBeNull();
  });

  it('lets the player leave without warning once the three steps are validated', () => {
    let s = validateMateriality(fresh(), params, choice({ vintage: 'certified2024' }));
    s = validateRisks(s, params);
    s = validateProgramme(s, params);
    expect(s.planning.validated.program).toBeUndefined(); // mandatory diligences missing
    for (const p of params.procedures.procedures.filter((x) => x.mandatory)) s = planProcedure(s, params, p.id);
    s = validateProgramme(s, params);
    expect(s.planning.validated.program).toBe('2025-11-03');
    expect(leavePlanningCheck(s, params, '2025-11-17')).toBeNull();
  });
});

describe('persistence of the planning section', () => {
  it('saves and reloads the planning decisions', () => {
    let s = validateMateriality(fresh(), params, choice());
    s = setRisk(s, 'provisions', 'valuation', 'significant', 'Estimation');
    s = setFraudPresumption(s, 'recurringRents', false, 'Automatique');
    s = toggleLaw(s, 'recoverableCharges');
    s = captureRiskFactor(s, { docId: 'kbis', block: null, cycle: 'crossCycle', assertion: null, note: '' });
    const r = deserialize(serialize(s), fresh());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.planning).toEqual(s.planning);
  });
});
