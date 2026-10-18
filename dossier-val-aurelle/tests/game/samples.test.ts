/** Samples (plan J4 §10, J4-8): populations on the presented data, sizes, frozen draws, redraws, results and projection; coverage of A06, A17 and A20. */
import { describe, expect, it } from 'vitest';
import {
  addSample,
  controlRelianceOf,
  delegatedAcquisitions,
  draw,
  hoursCharged,
  initialSamples,
  nextSeed,
  plannedSize,
  POPULATION_IDS,
  POPULATIONS,
  populationItems,
  sampleCell,
  sampleProjection,
  samplesSchema,
  setSampleException,
} from '../../src/game/samples';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { SAMPLE_POPULATIONS } from '../../src/scenario/schemas/procedures';
import { correctionKey } from '../helpers/scenario';
import { params } from '../helpers/world';

const p = params();
const key = correctionKey();
const w = key.presented.world;
const ds = w.datasets as unknown as ScenarioDatasets;
/** Reference planning materiality of the case (§4.7), the tolerable misstatement of the tests of details. */
const TOLERABLE = 37_500_000;

describe('populations', () => {
  it('every population of the contract between the lots is defined, with its cycle', () => {
    expect([...POPULATION_IDS].sort()).toEqual([...SAMPLE_POPULATIONS].sort());
    for (const d of POPULATIONS) expect(p.cycles.cycles.some((c) => c.id === d.cycle), d.id).toBe(true);
  });
  it('are filters on the presented data, in a canonical order, with unique short keys', () => {
    for (const id of POPULATION_IDS) {
      const items = populationItems(id, w, p);
      expect(items.length, id).toBeGreaterThan(0);
      expect(new Set(items.map((x) => x.key)).size, id).toBe(items.length);
      expect(populationItems(id, w, p).map((x) => x.key), id).toEqual(items.map((x) => x.key));
      for (const x of items) expect(Number.isInteger(x.amount), `${id} ${x.key}`).toBe(true);
    }
    expect(populationItems('nope', w, p)).toEqual([]);
  });
  it('the entries are keyed by their public FEC number, never by their internal id', () => {
    for (const id of ['capitalised-works', 'construction-progress', 'maintenance-charges']) {
      for (const x of populationItems(id, w, p)) {
        expect(x.key).toMatch(/^2025:[A-Z]{2}\d{6}$/);
        expect(x.request).toEqual({ family: 'entry-voucher', object: x.key });
      }
    }
  });
  it('A06: the transfer of the maintenance of Les Peupliers is in the capitalised works', () => {
    const items = populationItems('capitalised-works', w, p);
    const od = items.find((x) => x.piece === 'MES-OP-PEU-A2025');
    expect(od).toBeDefined();
    expect(od!.amount).toBe(key.presented.world.ledgers.current.entries.find((e) => e.pieceRef === 'MES-OP-PEU-A2025')!.lines.find((l) => l.account.startsWith('21'))!.debit);
    // internal transfers (works in progress put into service) are not acquisitions
    expect(items.some((x) => x.piece?.startsWith('MES-') && x.piece !== 'MES-OP-PEU-A2025')).toBe(false);
  });
  it('A17: the rents of the regulated programmes are in the rent roll, month by month', () => {
    const keys = new Set(populationItems('rent-roll', w, p).map((x) => x.key));
    const family = p.programmes.filter((x) => x.kind === 'family');
    for (const prog of family.slice(0, 10)) {
      expect(keys.has(`${prog.id}:2025-01`), prog.id).toBe(true);
      expect(keys.has(`${prog.id}:2025-12`), prog.id).toBe(true);
    }
  });
  it('A20: the invoice of the GIE received in January 2026 is in the invoices of 2026', () => {
    const gie = ds.invoices.filter((i) => i.supplierId === 'F0027' && i.invoiceDate >= '2026-01-01' && i.invoiceDate <= '2026-02-28');
    expect(gie.length).toBeGreaterThan(0);
    const keys = new Set(populationItems('invoices-2026', w, p).map((x) => x.key));
    for (const i of gie) expect(keys.has(`inv:${i.number}`)).toBe(true);
  });
});

describe('size of a test of details', () => {
  const items = populationItems('maintenance-charges', w, p);
  const size = (risk: string, controls: string) => plannedSize(p, items, { risk, controls, tolerable: TOLERABLE });
  it('grows with the assessed risk and with deficient controls, within the bounds', () => {
    expect(size('high', 'notTested')).toBeGreaterThan(size('low', 'notTested'));
    expect(size('moderate', 'deficient')).toBeGreaterThan(size('moderate', 'effective'));
    for (const r of ['low', 'moderate', 'high', 'significant']) for (const c of ['effective', 'notTested', 'deficient']) {
      expect(size(r, c)).toBeGreaterThanOrEqual(p.sampling.minSize);
      expect(size(r, c)).toBeLessThanOrEqual(p.sampling.maxSize);
    }
  });
  it('a lower tolerable misstatement gives a larger sample', () => {
    expect(plannedSize(p, items, { risk: 'moderate', controls: 'notTested', tolerable: TOLERABLE / 2 })).toBeGreaterThanOrEqual(size('moderate', 'notTested'));
  });
});

describe('draws', () => {
  it('are deterministic for a seed', () => {
    const items = populationItems('maintenance-charges', w, p);
    for (const method of ['random', 'systematic', 'stratified', 'monetaryUnit'] as const) {
      const a = draw(p, items, { population: 'maintenance-charges', method, seed: 'x', size: 15 });
      expect(draw(p, items, { population: 'maintenance-charges', method, seed: 'x', size: 15 }), method).toEqual(a);
      expect(a.items.length, method).toBeGreaterThan(0);
    }
  });
  it('specific items: the keys chosen and the items above a threshold, no extrapolation', () => {
    const items = populationItems('capitalised-works', w, p);
    const r = draw(p, items, { population: 'capitalised-works', method: 'specific', seed: '', size: 0, selected: [items[0]!.key], threshold: 15_000_000 });
    expect(r.items).toEqual(items.filter((x, i) => i === 0 || x.amount > 15_000_000).map((x) => x.key));
    expect(r.parameters['size']).toBe(r.items.length);
  });
  it('stratified and monetary units record their strata and interval', () => {
    const items = populationItems('maintenance-charges', w, p);
    expect(draw(p, items, { population: 'maintenance-charges', method: 'stratified', seed: 'x', size: 20 }).parameters['strata']).toBe(p.sampling.strata);
    const mus = draw(p, items, { population: 'maintenance-charges', method: 'monetaryUnit', seed: 'x', size: 20 });
    expect(mus.parameters['interval']).toBeGreaterThan(0);
  });
  it('A06: the reference sample of the acquisitions retains the transfer of Les Peupliers in at least 90 % of 50 seeds', () => {
    const ref = p.sampling.reference['acquisitions']!;
    const items = populationItems(ref.population, w, p);
    const od = items.find((x) => x.piece === 'MES-OP-PEU-A2025')!.key;
    const size = plannedSize(p, items, { risk: ref.risk, controls: ref.controls, tolerable: TOLERABLE });
    let hits = 0;
    for (let i = 0; i < 50; i++) if (draw(p, items, { population: ref.population, method: ref.method, seed: `seed-${i}`, size }).items.includes(od)) hits++;
    expect(hits).toBeGreaterThanOrEqual(45);
  });
  it('T2: the delegated rule (acquisitions above the threshold only) excludes it', () => {
    const items = [...populationItems('capitalised-works', w, p), ...populationItems('construction-progress', w, p)];
    const od = items.find((x) => x.piece === 'MES-OP-PEU-A2025')!.key;
    const t2 = delegatedAcquisitions(p, items);
    expect(t2.length).toBeGreaterThan(0);
    expect(t2).not.toContain(od);
  });
});

describe('frozen samples, redraws, results', () => {
  const items = populationItems('maintenance-charges', w, p);
  const host = () => ({ samples: initialSamples(), clock: { date: '2026-02-24' }, journal: [] as { on: string; kind: string; ref?: string; data?: Record<string, string | number | boolean> }[] });
  const result = (seed: string) => draw(p, items, { population: 'maintenance-charges', method: 'random', seed, size: 12 });
  it('a draw stores its seed, parameters and keys; a new draw in the same procedure is a redraw (hours, journal)', () => {
    let s = host();
    expect(nextSeed(s, 'maintenance-charges')).toBe('maintenance-charges-1');
    s = addSample(s, { executionId: 'ex1', population: 'maintenance-charges', method: 'random', seed: 's1', result: result('s1'), title: 'Charges' });
    s = addSample(s, { executionId: 'ex1', population: 'maintenance-charges', method: 'random', seed: 's2', result: result('s2'), title: 'Charges' });
    s = addSample(s, { executionId: null, population: 'maintenance-charges', method: 'random', seed: 's3', result: result('s3'), title: 'Charges' });
    expect(s.samples.items.map((x) => x.id)).toEqual(['smp1', 'smp2', 'smp3']);
    expect(s.samples.items[0]!.items).toEqual(result('s1').items);
    expect(s.journal.map((j) => j.data?.['redraw'])).toEqual([false, true, false]);
    expect(s.journal[1]!.data?.['title']).toContain('Nouveau tirage');
    expect(hoursCharged(s.samples, p)).toEqual([
      { member: 'senior', hours: p.sampling.redrawHours, on: '2026-02-24' },
      { member: 'senior', hours: p.sampling.drawHours, on: '2026-02-24' },
    ]);
    expect(samplesSchema.parse(s.samples)).toEqual(s.samples);
    expect(s.samples.items.reduce((n, x) => n + x.items.join('').length, 0)).toBeLessThan(5_000);
  });
  it('the misstatements found on items are projected on the population', () => {
    let s = addSample(host(), { executionId: 'ex1', population: 'maintenance-charges', method: 'random', seed: 's1', result: result('s1'), title: 'Charges' });
    const k = s.samples.items[0]!.items[0]!;
    const amount = items.find((x) => x.key === k)!.amount;
    s = setSampleException(s, 'smp1', k, Math.round(amount / 2));
    s = setSampleException(s, 'smp1', 'not-drawn', 100);
    expect(s.samples.items[0]!.exceptions).toEqual({ [k]: Math.round(amount / 2) });
    const pr = sampleProjection(s.samples.items[0]!, items);
    expect(pr.exceptions).toBe(1);
    expect(pr.found).toBe(Math.round(amount / 2));
    expect(pr.projected).toBeGreaterThan(pr.found);
    expect(setSampleException(s, 'smp1', k, null).samples.items[0]!.exceptions).toEqual({});
    expect(sampleCell('smp1', k)).toBe(`sample:smp1:${k}`);
  });
});

describe('reliance on the controls', () => {
  const exec = (procedureId: string, conclusion: string | null) => ({ program: { executions: [{ procedureId, conclusion }] } });
  it('from the tests of controls documented by the player', () => {
    expect(controlRelianceOf({ program: { executions: [] } }, p, 'rentReceivables')).toBe('notTested');
    expect(controlRelianceOf(exec('rent-controls', 'satisfactory'), p, 'rentReceivables')).toBe('effective');
    expect(controlRelianceOf(exec('rent-controls', 'exceptions'), p, 'rentReceivables')).toBe('deficient');
    expect(controlRelianceOf(exec('rent-controls', 'satisfactory'), p, 'debtTreasury')).toBe('notTested');
    expect(controlRelianceOf(exec('it-general-controls', 'exceptions'), p, 'debtTreasury')).toBe('deficient');
    expect(controlRelianceOf(exec('rent-controls', null), p, 'rentReceivables')).toBe('notTested');
  });
});
