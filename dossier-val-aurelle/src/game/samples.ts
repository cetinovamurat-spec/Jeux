/**
 * Samples (plan J4 §10, J4-8): populations defined as filters on the
 * presented data (FEC and datasets), in canonical order; a draw stores its
 * method, seed, parameters and the keys of the items drawn (frozen); a new
 * draw costs hours and stays visible. Results per item use the ticking of J3
 * (cells 'sample:<id>:<item>'); the misstatements found on items are stored
 * to project the exception on the population. Never reads a field that
 * betrays the correction key (service year of an invoice, clue targets…).
 * Section of the game state owned by J4c.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';
import { compareFecEntries } from '../engine/fec';
import type { Cents } from '../engine/money';
import { drawMonetaryUnit, drawRandom, drawStratified, drawSystematic, projectMisstatement, sampleSize, type SamplingItem } from '../engine/sampling';
import { outstandingAt } from '../engine/subledgers/loans';
import type { JournalEntry, Ledger, LoanScheduleLine, World } from '../engine/types';
import type { ScenarioDatasets } from '../scenario/datasets';
import { programmeLabel } from '../scenario/documents/request-labels';
import type { Params } from '../scenario/params';
import type { HoursCharge } from './budget';

export type SampleMethod = 'specific' | 'random' | 'systematic' | 'stratified' | 'monetaryUnit';
export const SAMPLE_METHODS: readonly SampleMethod[] = ['specific', 'random', 'systematic', 'stratified', 'monetaryUnit'];

export interface Sample {
  id: string;
  executionId: string | null;
  population: string;
  method: SampleMethod;
  seed: string;
  /** Size, risk, reliance on controls, tolerable misstatement, interval… (frozen at the draw). */
  parameters: Record<string, number | string | boolean>;
  /** Keys of the items drawn, in canonical order. */
  items: string[];
  drawnOn: IsoDate;
  /** Misstatement found on an item (cents, overstatement positive), set by the player. */
  exceptions?: Record<string, number>;
}

export interface SamplesState {
  items: Sample[];
}

export function initialSamples(): SamplesState {
  return { items: [] };
}

export const samplesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      executionId: z.string().nullable(),
      population: z.string(),
      method: z.enum(['specific', 'random', 'systematic', 'stratified', 'monetaryUnit']),
      seed: z.string(),
      parameters: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
      items: z.array(z.string()),
      drawnOn: z.string(),
      exceptions: z.record(z.string(), z.number().int()).optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// populations
// ---------------------------------------------------------------------------

export const POPULATION_IDS = ['capitalised-works', 'construction-progress', 'maintenance-charges', 'invoices-2026', 'rent-roll', 'tenant-receivables', 'loans'] as const;
export type PopulationId = (typeof POPULATION_IDS)[number];

export interface PopulationItem extends SamplingItem {
  date: IsoDate | null;
  label: string;
  /** Attributes shown in the sample table. */
  account?: string;
  thirdParty?: string;
  programme?: string;
  piece?: string;
  /** Request that obtains the supporting document of the item. */
  request?: { family: string; object: string };
}

export interface PopulationDef {
  id: PopulationId;
  label: string;
  description: string;
  /** Unit of an item, for the sample table. */
  unit: string;
  /** Cycle of the work programme (risk assessed, controls tested, findings). */
  cycle: string;
  /**
   * Data needed: the 2025 ledger as available (the extraction at the interim,
   * then the final ledger), or the year-end data (final ledger, subsequent
   * invoices, year-end receivables and loans).
   */
  needs: 'ledger' | 'yearEnd';
}

export const POPULATIONS: readonly PopulationDef[] = [
  { id: 'capitalised-works', label: 'Travaux immobilisés sur le patrimoine en service', description: 'Écritures 2025 débitant les comptes d’immobilisations corporelles (21), hors mises en service des immobilisations en cours.', unit: 'écriture', cycle: 'fixedAssets', needs: 'ledger' },
  { id: 'construction-progress', label: 'Situations de travaux des opérations en cours', description: 'Écritures 2025 débitant les constructions en cours (2313), hors virements internes.', unit: 'écriture', cycle: 'fixedAssets', needs: 'ledger' },
  { id: 'maintenance-charges', label: 'Charges d’entretien et de réparation', description: 'Factures 2025 débitant les comptes d’entretien et de réparations (615).', unit: 'écriture', cycle: 'purchases', needs: 'ledger' },
  { id: 'invoices-2026', label: 'Factures reçues en janvier et février 2026', description: 'Factures datées de janvier et février 2026 (recherche de passifs non comptabilisés).', unit: 'facture', cycle: 'purchases', needs: 'yearEnd' },
  { id: 'rent-roll', label: 'Quittancement par programme et par mois', description: 'Loyers quittancés en 2025, programme par programme et mois par mois (sélection par l’auditeur).', unit: 'programme × mois', cycle: 'rentReceivables', needs: 'ledger' },
  { id: 'tenant-receivables', label: 'Créances sur les locataires', description: 'Comptes de locataires débiteurs au 31/12/2025 (auxiliaire LOGIGES 2).', unit: 'compte', cycle: 'rentReceivables', needs: 'yearEnd' },
  { id: 'loans', label: 'Emprunts', description: 'Emprunts en cours au 31/12/2025 (capital restant dû).', unit: 'contrat', cycle: 'debtTreasury', needs: 'yearEnd' },
];

export function populationDef(id: string): PopulationDef | undefined {
  return POPULATIONS.find((p) => p.id === id);
}

/** FEC numbers of the entries of a ledger (per journal, in FEC order). */
function fecNumbers(ledger: Ledger): Map<string, string> {
  const counters = new Map<string, number>();
  const out = new Map<string, string>();
  for (const e of [...ledger.entries].sort(compareFecEntries)) {
    const n = (counters.get(e.journal) ?? 0) + 1;
    counters.set(e.journal, n);
    out.set(e.id, `${e.journal}${String(n).padStart(6, '0')}`);
  }
  return out;
}

function progOf(e: JournalEntry): string | undefined {
  for (const l of e.lines) for (const r of l.refs ?? []) if (r.startsWith('prog:')) return r.slice(5);
  return undefined;
}

function auxOf(e: JournalEntry, prefix: string): string | undefined {
  return e.lines.find((l) => l.aux && l.account.startsWith(prefix))?.aux;
}

/** Entries of 2025 (opening excluded) debiting accounts of `prefix`, as items keyed by their FEC number. */
function entryItems(world: World, params: Params, prefix: (a: string) => boolean, exclude: (e: JournalEntry) => boolean): PopulationItem[] {
  const ledger = world.ledgers.current;
  const nums = fecNumbers(ledger);
  const names = new Map((world.datasets as unknown as ScenarioDatasets).thirdParties.map((t) => [t.aux ?? t.id, t.name]));
  const out: PopulationItem[] = [];
  for (const e of [...ledger.entries].sort(compareFecEntries)) {
    if (e.journal === 'AN' || exclude(e)) continue;
    let amount = 0;
    let account: string | undefined;
    for (const l of e.lines) {
      if (!prefix(l.account) || l.debit <= 0) continue;
      amount += l.debit;
      account ??= l.account;
    }
    if (amount <= 0) continue;
    const num = nums.get(e.id)!;
    const supplier = auxOf(e, '40');
    const prog = progOf(e);
    out.push({
      key: `2025:${num}`,
      amount,
      date: e.date,
      label: e.label,
      ...(account ? { account } : {}),
      ...(supplier ? { thirdParty: names.get(supplier) ?? supplier } : {}),
      ...(prog ? { programme: programmeLabel(params, prog) } : {}),
      ...(e.pieceRef ? { piece: e.pieceRef } : {}),
      request: { family: 'entry-voucher', object: `2025:${num}` },
    });
  }
  return out;
}

const creditsWip = (e: JournalEntry) => e.lines.some((l) => (l.account === '2312' || l.account === '2313') && l.credit > 0);

/** Items of a population, in canonical order (FEC order, then data order), from the presented world. */
export function populationItems(id: string, world: World, params: Params): PopulationItem[] {
  const ds = world.datasets as unknown as ScenarioDatasets;
  switch (id) {
    case 'capitalised-works':
      return entryItems(world, params, (a) => a.startsWith('21'), creditsWip);
    case 'construction-progress':
      return entryItems(world, params, (a) => a === '2313', creditsWip);
    case 'maintenance-charges':
      return entryItems(world, params, (a) => a.startsWith('615'), (e) => e.journal !== 'AC');
    case 'invoices-2026': {
      const names = new Map(ds.thirdParties.map((t) => [t.id, t.name]));
      return ds.invoices
        .filter((i) => i.invoiceDate >= '2026-01-01' && i.invoiceDate <= '2026-02-28')
        .sort((a, b) => (a.invoiceDate < b.invoiceDate ? -1 : a.invoiceDate > b.invoiceDate ? 1 : a.number < b.number ? -1 : 1))
        .map((i) => ({ key: `inv:${i.number}`, amount: i.total, date: i.invoiceDate, label: i.description, thirdParty: names.get(i.supplierId) ?? i.supplierId, piece: i.number, request: { family: 'closing-file', object: 'subsequent-invoices' } }));
    }
    case 'rent-roll': {
      const cells = new Map<string, Cents>();
      for (const e of world.ledgers.current.entries) {
        if (e.journal !== 'QT' || !e.pieceRef?.startsWith('QT')) continue;
        const month = e.date.slice(0, 7);
        for (const l of e.lines) {
          if (!['70411', '70412', '70414', '70415'].includes(l.account)) continue;
          const p = l.refs?.find((r) => r.startsWith('prog:'))?.slice(5);
          if (!p) continue;
          const k = `${p}:${month}`;
          cells.set(k, (cells.get(k) ?? 0) + l.credit - l.debit);
        }
      }
      const order = new Map(params.programmes.map((p, i) => [p.id, i]));
      return [...cells.entries()]
        .filter(([, v]) => v !== 0)
        .sort(([a], [b]) => (order.get(a.split(':')[0]!) ?? 999) - (order.get(b.split(':')[0]!) ?? 999) || (a < b ? -1 : 1))
        .map(([k, v]) => {
          const [p, m] = k.split(':') as [string, string];
          return { key: k, amount: v, date: `${m}-01`, label: `Quittancement ${m.slice(5, 7)}/${m.slice(0, 4)}`, programme: programmeLabel(params, p), request: { family: 'programme-rent-roll', object: k } };
        });
    }
    case 'tenant-receivables':
      return ds.tenants
        .filter((t) => (t.byYear.y2025?.balance ?? 0) > 0)
        .map((t) => ({ key: t.id, amount: t.byYear.y2025!.balance, date: null, label: t.name, programme: programmeLabel(params, t.programmeId), request: { family: 'programme-rent-roll', object: `${t.programmeId}:2025-12` } }));
    case 'loans': {
      const schedules = new Map<string, LoanScheduleLine[]>();
      for (const l of ds.loanSchedules) schedules.set(l.loanId, [...(schedules.get(l.loanId) ?? []), l]);
      const names = new Map(ds.thirdParties.map((t) => [t.id, t.name]));
      return ds.loans
        .filter((l) => l.refDate <= '2025-12-31')
        .map((l) => ({ key: l.contractNumber, amount: outstandingAt(l, schedules.get(l.id) ?? [], '2025-12-31'), date: l.startDate, label: `Prêt ${l.product}`, thirdParty: names.get(l.lenderId) ?? l.lenderId, ...(l.programmeId ? { programme: programmeLabel(params, l.programmeId) } : {}), request: { family: 'closing-file', object: 'debt-schedule' } }))
        .filter((x) => x.amount > 0);
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// planning of a sample: size from the planning materiality, the risk and the controls
// ---------------------------------------------------------------------------

export interface SamplePlan {
  risk: string;
  controls: string;
  /** Tolerable misstatement (cents): the planning materiality. */
  tolerable: Cents;
}

export type ControlReliance = 'effective' | 'notTested' | 'deficient';

/**
 * Reliance on the controls of a cycle, from the tests of controls documented
 * by the player (procedures whose output is a memo on the controls, or the
 * IT general controls for every cycle): a satisfactory conclusion makes them
 * effective, exceptions make them deficient; otherwise not tested.
 */
export function controlRelianceOf(s: { program: { executions: readonly { procedureId: string; conclusion: string | null }[] } }, params: Params, cycle: string): ControlReliance {
  let effective = false;
  let deficient = false;
  for (const e of s.program.executions) {
    const def = params.procedures.procedures.find((p) => p.id === e.procedureId);
    if (!def || def.output.kind !== 'memo' || (def.output.memo !== 'controls' && def.output.memo !== 'it-controls')) continue;
    if (def.cycle !== cycle && def.output.memo !== 'it-controls') continue;
    if (e.conclusion === 'exceptions') deficient = true;
    else if (e.conclusion === 'satisfactory' && def.cycle === cycle) effective = true;
  }
  return deficient ? 'deficient' : effective ? 'effective' : 'notTested';
}

export function confidenceFactor(params: Params, risk: string, controls: string): number {
  const s = params.sampling;
  return (s.confidenceFactors[risk] ?? s.confidenceFactors['moderate'] ?? 1.6) * (s.controlReliance[controls] ?? 1);
}

/** Size of a test of details on the population (params/sampling.json). */
export function plannedSize(params: Params, items: readonly SamplingItem[], plan: SamplePlan): number {
  const s = params.sampling;
  const value = items.reduce((a, x) => a + Math.max(0, x.amount), 0);
  return sampleSize({
    populationValue: value,
    populationSize: items.length,
    tolerable: plan.tolerable,
    confidenceFactor: confidenceFactor(params, plan.risk, plan.controls),
    expectedMisstatement: Math.round(plan.tolerable * s.expectedMisstatementShare),
    expansionFactor: s.expansionFactor,
    min: s.minSize,
    max: s.maxSize,
  });
}

export interface DrawInput {
  population: string;
  method: SampleMethod;
  seed: string;
  size: number;
  /** Specific items: keys chosen, or a threshold (cents) above which every item is taken. */
  selected?: readonly string[];
  threshold?: Cents;
  plan?: SamplePlan;
}

export interface DrawResult {
  items: string[];
  parameters: Record<string, number | string | boolean>;
}

/** Draw on the items of the population (deterministic for a seed). */
export function draw(params: Params, items: readonly PopulationItem[], input: DrawInput): DrawResult {
  const base: Record<string, number | string | boolean> = { size: input.size, ...(input.plan ? { risk: input.plan.risk, controls: input.plan.controls, tolerable: input.plan.tolerable } : {}) };
  switch (input.method) {
    case 'specific': {
      const chosen = new Set(input.selected ?? []);
      const keys = items.filter((x) => chosen.has(x.key) || (input.threshold !== undefined && x.amount > input.threshold)).map((x) => x.key);
      return { items: keys, parameters: { ...base, size: keys.length, ...(input.threshold !== undefined ? { threshold: input.threshold } : {}) } };
    }
    case 'random':
      return { items: drawRandom(items, input.size, input.seed), parameters: base };
    case 'systematic':
      return { items: drawSystematic(items, input.size, input.seed), parameters: base };
    case 'stratified': {
      const r = drawStratified(items, input.size, params.sampling.strata, input.seed);
      return { items: r.keys, parameters: { ...base, strata: r.strata.length, size: r.keys.length } };
    }
    case 'monetaryUnit': {
      const r = drawMonetaryUnit(items, input.size, input.seed);
      return { items: r.keys, parameters: { ...base, interval: Math.round(r.interval), topStratum: r.topStratum.join(' '), size: r.keys.length } };
    }
  }
}

/** Selection rule of the delegated test of acquisitions (T2): acquisitions above the threshold only. */
export function delegatedAcquisitions(params: Params, items: readonly PopulationItem[]): string[] {
  const threshold = Math.round(params.sampling.delegatedAcquisitionsThresholdEuros * 100);
  return items.filter((x) => x.amount > threshold).map((x) => x.key);
}

// ---------------------------------------------------------------------------
// results and projection
// ---------------------------------------------------------------------------

/** Tick cell of an item of a sample (J3 ticking). */
export function sampleCell(sampleId: string, itemKey: string): string {
  return `sample:${sampleId}:${itemKey}`;
}

export interface SampleProjection {
  /** Value of the items drawn. */
  sampleValue: Cents;
  /** Misstatements found. */
  found: Cents;
  exceptions: number;
  /** Misstatement projected on the population. */
  projected: Cents;
  populationValue: Cents;
}

export function sampleProjection(sample: Sample, items: readonly PopulationItem[]): SampleProjection {
  const byKey = new Map(items.map((x) => [x.key, x]));
  const results = sample.items.map((k) => ({ key: k, amount: byKey.get(k)?.amount ?? 0, misstatement: sample.exceptions?.[k] ?? 0 }));
  const populationValue = items.reduce((s, x) => s + Math.max(0, x.amount), 0);
  const top = typeof sample.parameters['topStratum'] === 'string' ? (sample.parameters['topStratum'] as string).split(' ').filter(Boolean) : [];
  const interval = typeof sample.parameters['interval'] === 'number' ? (sample.parameters['interval'] as number) : undefined;
  return {
    sampleValue: results.reduce((s, r) => s + r.amount, 0),
    found: results.reduce((s, r) => s + r.misstatement, 0),
    exceptions: results.filter((r) => r.misstatement !== 0).length,
    projected: projectMisstatement({ method: sample.method, results, populationValue, ...(interval !== undefined ? { interval } : {}), topStratum: top }),
    populationValue,
  };
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export interface SampleHost {
  samples: SamplesState;
  clock: { date: IsoDate };
  journal?: readonly { on: IsoDate; kind: string; ref?: string; data?: Record<string, string | number | boolean> }[];
}

/** Default seed of the next draw (deterministic; shown to the player). */
export function nextSeed(s: { samples: SamplesState }, population: string): string {
  return `${population}-${s.samples.items.length + 1}`;
}

/** Records a draw (frozen sample); a new draw on the same population and procedure is a redraw (hours, journal). */
export function addSample<S extends SampleHost>(s: S, input: { executionId: string | null; population: string; method: SampleMethod; seed: string; result: DrawResult; title: string }): S {
  const id = `smp${s.samples.items.length + 1}`;
  const redraw = s.samples.items.some((x) => x.population === input.population && x.executionId === input.executionId);
  const sample: Sample = { id, executionId: input.executionId, population: input.population, method: input.method, seed: input.seed, parameters: input.result.parameters, items: input.result.items, drawnOn: s.clock.date };
  const next: S = { ...s, samples: { items: [...s.samples.items, sample] } };
  if (!next.journal) return next;
  return { ...next, journal: [...next.journal, { on: s.clock.date, kind: 'sample', ref: id, data: { title: `${redraw ? 'Nouveau tirage' : 'Échantillon'} – ${input.title}`, size: sample.items.length, seed: input.seed, redraw } }] };
}

/** Misstatement found on an item (null clears it). */
export function setSampleException<S extends SampleHost>(s: S, sampleId: string, itemKey: string, misstatement: Cents | null): S {
  return {
    ...s,
    samples: {
      items: s.samples.items.map((x) => {
        if (x.id !== sampleId || !x.items.includes(itemKey)) return x;
        const exceptions = { ...(x.exceptions ?? {}) };
        if (misstatement === null || misstatement === 0) delete exceptions[itemKey];
        else exceptions[itemKey] = Math.round(misstatement);
        return { ...x, exceptions };
      }),
    },
  };
}

/**
 * Hours charged by the samples: a draw outside a procedure costs `drawHours`;
 * within a procedure the first draw is part of its work and every new draw
 * (redraw) costs `redrawHours` (time of the senior).
 */
export function hoursCharged(s: SamplesState, params: Params): HoursCharge[] {
  const out: HoursCharge[] = [];
  const seen = new Set<string>();
  for (const x of s.items) {
    const k = `${x.executionId ?? '-'}|${x.population}`;
    const first = !seen.has(k);
    seen.add(k);
    const hours = x.executionId === null ? params.sampling.drawHours : first ? 0 : params.sampling.redrawHours;
    if (hours > 0) out.push({ member: 'senior', hours, on: x.drawnOn });
  }
  return out;
}
