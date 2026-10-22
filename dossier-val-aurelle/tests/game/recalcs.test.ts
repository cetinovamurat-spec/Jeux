/** Recalculation tools (plan J4 §11): client assumptions give no gap, clean-world assumptions give the correction of the key, guards. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { World } from '../../src/engine/types';
import { initialRecalcs, runRecalc, saveRecalc, toolAccess, toolScopes, unsourcedChanges, hoursCharged, clientAssumptions, type RecalcData, type RecalcToolId } from '../../src/game/recalcs';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { correctionKey, documents } from '../helpers/scenario';
import { params, world } from '../helpers/world';

const key = correctionKey();
const docs = documents();
const p = params();

function data(w: World = key.presented.world, available: (id: string) => boolean = () => true): RecalcData {
  return { params: p, world: w, facts: key.presented.facts, doc: (id) => (available(id) ? docs.byId.get(id) : undefined), obtained: () => true };
}

const impact = (part: string) => key.corrections.find((c) => c.key === part)!.impact.result;

describe('recalculations: the client’s assumptions reproduce the books', () => {
  const d = data();
  const tools: RecalcToolId[] = ['depreciation', 'icne', 'impairment', 'pge', 'rent-revision'];
  for (const tool of tools) {
    it(`${tool}: zero gap on every scope`, () => {
      for (const s of toolScopes(tool, d)) {
        const r = runRecalc(tool, s.id, {}, d);
        expect(r.gap, `${tool} ${s.id}`).toBe(0);
      }
    });
  }
  it('recorded amounts are read at the posting grain (non-zero where the client books something)', () => {
    expect(runRecalc('icne', 'all', {}, d).recorded).toBeGreaterThan(0);
    expect(runRecalc('pge', 'pge', {}, d).recorded).toBeGreaterThan(0);
    expect(runRecalc('depreciation', 'LIL', {}, d).recorded).toBeGreaterThan(0);
    expect(runRecalc('impairment', 'tenants', {}, d).recorded).toBeGreaterThan(0);
  });
});

describe('recalculations: the clean-world assumptions give the correction of the key', () => {
  const d = data();
  const sp = p.scenario.specific;
  const ds = key.presented.world.datasets as unknown as ScenarioDatasets;
  it('A01 – Les Tilleuls put into service with the nomenclature', () => {
    expect(runRecalc('depreciation', 'TIL', { inService: sp.tilleuls.inServiceDate }, d).gap).toBe(impact('A01'));
  });
  it('A02 – the boiler of Les Érables retired when the heat pump comes into service', () => {
    const boiler = ds.components.find((c) => c.programmeId === 'ERA' && c.id.includes('-CHAUF'))!;
    expect(runRecalc('depreciation', 'ERA', { retire: `${boiler.id}@${sp.erables.disposalDate}` }, d).gap).toBe(impact('A02'));
  });
  it('A04 – revised plan of Les Glycines B until the demolition', () => {
    expect(runRecalc('depreciation', 'GLB', { revisedFrom: sp.glycinesB.revisedFrom, revisedUntil: sp.glycinesB.demolitionPlannedEnd }, d).gap).toBe(impact('A04'));
  });
  it('A05 – maintenance provision on the plan of the asset department', () => {
    expect(runRecalc('pge', 'pge', { planVersion: 'official' }, d).gap).toBe(impact('A05'));
  });
  it('A07.a – former tenants at the rate of the annex method', () => {
    expect(runRecalc('impairment', 'tenants', { formerRate: p.scenario.tenants.cleanMethod.formerRate * 100 }, d).gap).toBe(impact('A07.a'));
  });
  it('A07.b – debts discharged written off (list read from the decisions)', () => {
    expect(runRecalc('impairment', 'tenants', { discharge: 'loss' }, d).gap).toBe(impact('A07.b'));
  });
  it('A08 – accrued interest at the rate of each loan', () => {
    expect(runRecalc('icne', 'all', { method: 'loan' }, d).gap).toBe(impact('A08'));
  });
  it('A15 – receivable of the residence manager impaired at 80 %', () => {
    expect(runRecalc('impairment', 'managers', { managerRate: p.scenario.tenants.cleanMethod.residenceManagerRate * 100 }, d).gap).toBe(impact('A15'));
  });
  it('A17 – rents capped at the variation of the rent index', () => {
    expect(runRecalc('rent-revision', 'all', { capPct: p.regulatory.rentRevision.byYear['2025']!.legalCapPct }, d).gap).toBe(impact('A17'));
  });
});

describe('recalculations: a perimeter without anomaly reproduces the clean world', () => {
  const clean = data(world().world);
  const presented = data();
  it('depreciation of programmes no anomaly touches', () => {
    for (const pid of ['LIL', 'MIM', 'ROS']) {
      const a = runRecalc('depreciation', pid, {}, presented);
      const b = runRecalc('depreciation', pid, {}, clean);
      expect(a.computed, pid).toBe(b.recorded);
      expect(b.gap, pid).toBe(0);
    }
  });
  it('accrued interest of the commercial banks', () => {
    for (const lender of ['BANK1', 'BANK3']) expect(runRecalc('icne', lender, { method: 'loan' }, presented).computed).toBe(runRecalc('icne', lender, {}, clean).recorded);
  });
});

describe('recalculations: access, sources, storage', () => {
  it('the client’s file is accessible only once its source document is obtained', () => {
    const none: RecalcData = { ...data(key.presented.world, () => false), obtained: () => false };
    for (const tool of ['depreciation', 'icne', 'impairment', 'pge', 'rent-revision'] as const) expect(toolAccess(tool, tool === 'depreciation' ? 'ERA' : 'all', none).ok, tool).toBe(false);
    expect(toolAccess('prorata', 'free', none).ok).toBe(true);
    expect(toolAccess('icne', 'all', data()).ok).toBe(true);
  });
  it('a changed assumption needs a source; only the summary is stored', () => {
    const d = data();
    const outcome = runRecalc('icne', 'all', { method: 'loan' }, d);
    const s0 = { recalcs: initialRecalcs(), clock: { date: '2026-03-02' }, journal: [] as { on: string; kind: string }[] };
    const unsourced = { method: { value: 'loan', source: null }, flatRatePct: { value: p.anomalies.A08.flatRatePct, source: null } };
    expect(unsourcedChanges(p, 'icne', 'all', unsourced)).toEqual(['method']);
    expect(saveRecalc(s0, { executionId: null, tool: 'icne', scope: 'all', assumptions: unsourced, outcome, title: 'ICNE' }, p)).toBe(s0);
    const sourced = { ...unsourced, method: { value: 'loan', source: 'doc:etat-dette' } };
    const s1 = saveRecalc(s0, { executionId: null, tool: 'icne', scope: 'all', assumptions: sourced, outcome, title: 'ICNE' }, p);
    expect(s1.recalcs.items).toHaveLength(1);
    expect(Object.keys(s1.recalcs.items[0]!)).not.toContain('lines');
    expect(s1.recalcs.items[0]!.summary).toEqual({ computed: outcome.computed, recorded: outcome.recorded });
    expect(s1.journal.at(-1)!.kind).toBe('recalc');
    expect(hoursCharged(s1.recalcs, p)).toEqual([{ member: 'senior', hours: p.sampling.recalcHours, on: '2026-03-02' }]);
    expect(clientAssumptions(p, 'pge', 'pge')).toEqual({ planVersion: 'daf' });
  });

  it('a percentage typed in the French format is the client’s value: « 2,4 » equals 2.4, no source needed', () => {
    const fr = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 6, useGrouping: false });
    let checked = 0;
    for (const [tool, scope] of [['icne', 'all'], ['impairment', 'tenants'], ['impairment', 'managers'], ['rent-revision', 'all']] as const) {
      const client = clientAssumptions(p, tool, scope);
      for (const [k, v] of Object.entries(client)) {
        if (typeof v !== 'number') continue;
        const as = (value: string | number) => ({ ...Object.fromEntries(Object.entries(client).map(([id, x]) => [id, { value: x, source: null }])), [k]: { value, source: null } });
        expect(fr(v), `${tool} ${k}`).toContain(',');
        expect(unsourcedChanges(p, tool, scope, as(fr(v))), `${tool} ${k} ${fr(v)}`).toEqual([]);
        expect(unsourcedChanges(p, tool, scope, as(` ${fr(v)} `)), `${tool} ${k}`).toEqual([]);
        expect(unsourcedChanges(p, tool, scope, as(fr(v + 0.1))), `${tool} ${k}`).toEqual([k]);
        expect(unsourcedChanges(p, tool, scope, as('abc')), `${tool} ${k}`).toEqual([k]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(5);
    // « 2,4 » is 2.4
    expect(unsourcedChanges({ ...p, anomalies: { ...p.anomalies, A08: { ...p.anomalies.A08, flatRatePct: 2.4 } } }, 'icne', 'all', { method: { value: 'flat', source: null }, flatRatePct: { value: '2,4', source: null } })).toEqual([]);
  });
  it('the tools never read the fields that betray the key', () => {
    for (const f of ['src/game/recalcs.ts', 'src/game/samples.ts']) {
      const text = readFileSync(resolve(import.meta.dirname, '../..', f), 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, '');
      expect(text, f).not.toMatch(/inOfficialPlan|writeOff|serviceYear|\.clues\b|correctionKey|anomalies\/modules/);
    }
  });
});
