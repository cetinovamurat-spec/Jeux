/**
 * Master worksheets by cycle (plan J4 §12, J4-10): N, N-1 and the variation
 * of the cycle's groups of accounts at the data vintage available; references
 * to the work of the cycle (executions, samples, recalculations, findings,
 * saved queries, linked documents), all derived; explained variations with
 * their evidence; a conclusion chosen from a list. Section of the game state
 * owned by J4b: only the player's decisions are stored.
 */
import { z } from 'zod';
import { sumPrefixes } from '../engine/balance';
import type { IsoDate } from '../engine/dates';
import type { Cents } from '../engine/money';
import type { Params } from '../scenario/params';
import type { CycleDef } from '../scenario/schemas/cycles';
import { procedureDef, type WorkRef } from './program';
import { log, type GameState } from './state';

export interface Explanation {
  text: string;
  /** Documents supporting the explanation (ids of the GED). */
  evidence: string[];
  on?: IsoDate;
}

export interface MasterSheet {
  conclusion: string | null;
  comment: string;
  /** Variations explained by the player (line of the master sheet → explanation and evidence). */
  explained: Record<string, Explanation>;
  /** References pinned by the player ('doc:<id>', 'finding:<id>', 'query:<id>'…). */
  pins: string[];
  /** Date of the conclusion. */
  on?: IsoDate;
}

export interface WorksheetsState {
  master: Record<string, MasterSheet>;
}

export function initialWorksheets(): WorksheetsState {
  return { master: {} };
}

export const worksheetsSchema = z.object({
  master: z.record(
    z.string(),
    z.object({
      conclusion: z.string().nullable(),
      comment: z.string(),
      explained: z.record(z.string(), z.object({ text: z.string(), evidence: z.array(z.string()), on: z.string().optional() })),
      pins: z.array(z.string()),
      on: z.string().optional(),
    }),
  ),
});

export function emptyMasterSheet(): MasterSheet {
  return { conclusion: null, comment: '', explained: {}, pins: [] };
}

export function masterSheetOf(s: Pick<GameState, 'worksheets'>, cycle: string): MasterSheet {
  return s.worksheets.master[cycle] ?? emptyMasterSheet();
}

function withSheet(s: GameState, cycle: string, f: (m: MasterSheet) => MasterSheet): GameState {
  return { ...s, worksheets: { ...s.worksheets, master: { ...s.worksheets.master, [cycle]: f(masterSheetOf(s, cycle)) } } };
}

// ---------------------------------------------------------------------------
// figures
// ---------------------------------------------------------------------------

export interface MasterRow {
  id: string;
  label: string;
  /** Amount of the year at the vintage available (null: no 2025 data yet). */
  current: Cents | null;
  /** Same date of the previous year. */
  prior: Cents;
  variation: Cents | null;
  /** Variation in proportion of |N-1| (null when N-1 is nil or N unknown). */
  variationPct: number | null;
}

/**
 * Rows of a master sheet: each group of accounts of the cycle, signed as
 * shown (debit or credit balances positive), N against N-1 at the same date.
 */
export function masterRows(cycle: CycleDef, current: ReadonlyMap<string, Cents> | null, prior: ReadonlyMap<string, Cents>): MasterRow[] {
  return cycle.lines.map((l) => {
    const sign = l.sign === 'debit' ? 1 : -1;
    const n = current ? sign * sumPrefixes(current, l.include, l.exclude ?? []) : null;
    const p = sign * sumPrefixes(prior, l.include, l.exclude ?? []);
    const variation = n === null ? null : n - p;
    return { id: l.id, label: l.label, current: n, prior: p, variation, variationPct: variation === null || p === 0 ? null : variation / Math.abs(p) };
  });
}

/** Variations to explain: both above the amount and the percentage of the analytical review (generic thresholds, nothing is flagged by the key). */
export function variationsToExplain(rows: readonly MasterRow[], thresholdCents: Cents, thresholdPct: number): MasterRow[] {
  return rows.filter((r) => r.variation !== null && Math.abs(r.variation) >= thresholdCents && (r.variationPct === null || Math.abs(r.variationPct) * 100 >= thresholdPct));
}

// ---------------------------------------------------------------------------
// references (derived)
// ---------------------------------------------------------------------------

export interface MasterReferences {
  executions: string[];
  samples: string[];
  recalcs: string[];
  findings: string[];
  /** Saved FEC queries on accounts of the cycle. */
  queries: string[];
  /** Documents linked to the work of the cycle (risk factors, worksheet references, explanations, pins). */
  documents: string[];
}

export function cycleAccountsMatch(cycle: CycleDef, accounts: readonly string[]): boolean {
  return accounts.some((a) => cycle.lines.some((l) => l.include.some((p) => a.startsWith(p) || p.startsWith(a))));
}

/** References of a cycle's work, derived from the other sections (read-only). */
export function masterReferences(s: Pick<GameState, 'program' | 'samples' | 'recalcs' | 'findings' | 'savedQueries' | 'planning' | 'worksheets'>, params: Params, cycle: CycleDef): MasterReferences {
  const execs = s.program.executions.filter((e) => procedureDef(params, e.procedureId)?.cycle === cycle.id);
  const execIds = new Set(execs.map((e) => e.id));
  const docs = new Set<string>();
  for (const f of s.planning.riskFactors) if (f.cycle === cycle.id) docs.add(f.docId);
  for (const e of execs) for (const r of e.refs as WorkRef[]) if (r.kind === 'doc') docs.add(r.id);
  const sheet = masterSheetOf(s, cycle.id);
  for (const x of Object.values(sheet.explained)) for (const d of x.evidence) docs.add(d);
  for (const p of sheet.pins) if (p.startsWith('doc:')) docs.add(p.slice(4));
  for (const f of s.findings.items) if (f.cycle === cycle.id) for (const ev of f.evidence) if (ev.kind === 'doc') docs.add(ev.docId);
  return {
    executions: execs.map((e) => e.id),
    samples: s.samples.items.filter((x) => x.executionId !== null && execIds.has(x.executionId)).map((x) => x.id),
    recalcs: s.recalcs.items.filter((x) => x.executionId !== null && execIds.has(x.executionId)).map((x) => x.id),
    findings: s.findings.items.filter((f) => f.cycle === cycle.id).map((f) => f.id),
    queries: s.savedQueries.filter((q) => cycle.lines.length > 0 && q.query.accounts.length > 0 && cycleAccountsMatch(cycle, q.query.accounts)).map((q) => q.id),
    documents: [...docs],
  };
}

export function referenceCount(r: MasterReferences): number {
  return r.executions.length + r.samples.length + r.recalcs.length + r.findings.length + r.queries.length + r.documents.length;
}

export type MasterStatus = 'notStarted' | 'inProgress' | 'concluded';

export const MASTER_STATUS_LABEL: Record<MasterStatus, string> = { notStarted: 'Non commencée', inProgress: 'En cours', concluded: 'Conclue' };

export function masterStatus(sheet: MasterSheet, refs: MasterReferences): MasterStatus {
  if (sheet.conclusion !== null) return 'concluded';
  return referenceCount(refs) > 0 || Object.keys(sheet.explained).length > 0 || sheet.comment ? 'inProgress' : 'notStarted';
}

/** Manager's form check of a master sheet: concluded without any reference, or with variations left unexplained. */
export function masterFormCheck(sheet: MasterSheet, refs: MasterReferences, toExplain: readonly MasterRow[]): string[] {
  const out: string[] = [];
  if (sheet.conclusion !== null && referenceCount(refs) === 0) out.push('Feuille maîtresse conclue sans aucune référence aux travaux.');
  const unexplained = toExplain.filter((r) => !sheet.explained[r.id]);
  if (sheet.conclusion !== null && unexplained.length) out.push(`Variations significatives non expliquées : ${unexplained.map((r) => r.label).join(', ')}.`);
  return out;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export function concludeMasterSheet(s: GameState, params: Params, cycle: string, conclusion: string | null, comment: string): GameState {
  if (conclusion !== null && !params.cycles.conclusions.some((c) => c.id === conclusion)) return s;
  const next = withSheet(s, cycle, (m) => ({ ...m, conclusion, comment: comment.trim(), ...(conclusion !== null ? { on: s.clock.date } : {}) }));
  return log(next, 'masterSheet', cycle, { conclusion: conclusion ?? '' });
}

export function explainVariation(s: GameState, cycle: string, lineId: string, text: string, evidence: readonly string[]): GameState {
  const clean = text.trim();
  if (!clean) return s;
  const next = withSheet(s, cycle, (m) => ({ ...m, explained: { ...m.explained, [lineId]: { text: clean, evidence: [...new Set(evidence)], on: s.clock.date } } }));
  return log(next, 'variationExplained', `${cycle}:${lineId}`);
}

export function removeExplanation(s: GameState, cycle: string, lineId: string): GameState {
  return withSheet(s, cycle, (m) => {
    const explained = { ...m.explained };
    delete explained[lineId];
    return { ...m, explained };
  });
}

export function togglePin(s: GameState, cycle: string, ref: string): GameState {
  return withSheet(s, cycle, (m) => ({ ...m, pins: m.pins.includes(ref) ? m.pins.filter((p) => p !== ref) : [...m.pins, ref] }));
}
