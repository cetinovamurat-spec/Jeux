/**
 * Findings (plan J4 §13.1, J4-11): structured findings created in context
 * (block of a document, FEC entry, balance line, sample exception,
 * recalculation gap, unanswered confirmation) or from the Constats screen.
 * A finding carries a cycle, up to three objects chosen from closed lists, up
 * to two natures, a classification, treatments, a proposed correction entry
 * (its impacts are derived, never typed) or a disclosure fix, typed evidence,
 * a status with its dated history, the date it was escalated to the partner
 * and a free comment that the engine never reads.
 *
 * J5 (plan §10.3): a « suspicion of fraud / irregularity » flag, the dates
 * the first and second pieces of evidence were linked, the magnitude and the
 * flag noted in every history entry (the magnitude is computed by the caller
 * from the proposed entry, findingMagnitude) and the snapshot frozen at the
 * escalation to the partner.
 *
 * The matching to the correction key is computed (game/matching.ts, designer
 * mode and J6 only), never stored. Section of the game state owned by J4d:
 * types, initial value, save schema and pure actions.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';
import type { Impact } from '../scenario/anomalies/presented';
import type { Classification, Nature } from '../scenario/anomalies/types';
import type { Params } from '../scenario/params';
import { FINDING_TREATMENT_IDS } from '../scenario/schemas/disclosure-items';
import { evidenceSchema, type Evidence } from './evidence';
import { log, nextId, nextSeq, type GameState } from './state';

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export const FINDING_STATUSES = ['question', 'finding', 'dismissed', 'closed'] as const;
/** question, constat, écarté, clos. */
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/** Kinds of objects of a finding (closed lists of the form, built from the presented data and the parameters). */
export const FINDING_OBJECT_KINDS = ['programme', 'thirdParty', 'account', 'document', 'loan', 'subsidy', 'disclosureItem'] as const;
export type FindingObjectKind = (typeof FINDING_OBJECT_KINDS)[number];

export interface FindingObject {
  kind: FindingObjectKind;
  id: string;
}

export const FINDING_NATURES = ['occurrence', 'completeness', 'cutoff', 'valuation', 'classification', 'presentation', 'compliance'] as const satisfies readonly Nature[];
export const FINDING_CLASSIFICATIONS = ['factual', 'judgemental', 'projected'] as const satisfies readonly Classification[];
export const FINDING_TREATMENTS = FINDING_TREATMENT_IDS;
export type FindingTreatment = (typeof FINDING_TREATMENTS)[number];

export { evidenceSchema, type Evidence } from './evidence';

export interface ProposedLine {
  account: string;
  /** Cents. */
  debit: number;
  /** Cents. */
  credit: number;
  aux?: string;
}

/** What the context of a « Créer un constat » button pre-fills (object being looked at, evidence, amount). */
export interface FindingSeed {
  cycle?: string;
  objects?: { kind: string; id: string }[];
  evidence?: Evidence[];
  /** Amount in cents (gap of a recalculation, exception of a sample…), positive. */
  amount?: number;
  /** Short description of the context, shown in the form (never read by the matching). */
  label?: string;
}

export interface FindingHistoryEntry {
  on: IsoDate;
  status: FindingStatus;
  /** Magnitude of the proposed entry at the entry (cents, findingMagnitude; absent in the saves of J4: 0). */
  magnitude?: number;
  /** Suspicion flag at the entry (absent in the saves of J4: false). */
  suspicion?: boolean;
}

/** What the partner was told, frozen at the escalation (plan J5 §10.3, J5-19). */
export interface EscalationSnapshot {
  on: IsoDate;
  seq: number;
  /** Evidence linked at the escalation. */
  evidence: Evidence[];
  /** Magnitude of the proposed entry at the escalation (cents; 0 for the escalations of J4). */
  magnitude: number;
  status: FindingStatus;
  /** A correction entry was proposed. */
  hasEntry: boolean;
  suspicion: boolean;
}

export interface Finding {
  id: string;
  /** Short title chosen by the player (lists; never read by the engine). */
  title: string;
  cycle: string;
  objects: FindingObject[];
  natures: Nature[];
  classification: Classification;
  treatments: FindingTreatment[];
  proposedEntry: ProposedLine[];
  /** Expected disclosure fix chosen from the list (disclosure treatments without an entry). */
  disclosureFix: string | null;
  evidence: Evidence[];
  status: FindingStatus;
  history: FindingHistoryEntry[];
  escalatedToPartnerOn: IsoDate | null;
  /** Free comment, never read by the engine. */
  comment: string;
  createdOn: IsoDate;
  updatedOn?: IsoDate;
  /** Amount noted in the context of the creation (cents, shown in the form; never read by the matching). */
  contextAmount?: number;
  /** « Suspicion de fraude / irrégularité » (proposed on every finding). */
  suspicion: boolean;
  /** Dates the first and the second pieces of evidence were linked (kept when evidence is unlinked afterwards). */
  piecesOn?: IsoDate[];
  /** Snapshot frozen at the escalation to the partner. */
  escalation?: EscalationSnapshot;
}

/** What the form edits (the rest is managed by the actions). */
export type FindingDraft = Pick<Finding, 'title' | 'cycle' | 'objects' | 'natures' | 'classification' | 'treatments' | 'proposedEntry' | 'disclosureFix' | 'evidence' | 'status' | 'comment' | 'suspicion'> & { contextAmount?: number };

export interface FindingsState {
  items: Finding[];
}

export function initialFindings(): FindingsState {
  return { items: [] };
}

const status = z.enum(FINDING_STATUSES);
const evidence = evidenceSchema;
export const findingsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string().default(''),
      cycle: z.string(),
      objects: z.array(z.object({ kind: z.enum(FINDING_OBJECT_KINDS), id: z.string() })),
      natures: z.array(z.enum(FINDING_NATURES)),
      classification: z.enum(FINDING_CLASSIFICATIONS),
      treatments: z.array(z.enum(FINDING_TREATMENTS)),
      proposedEntry: z.array(z.object({ account: z.string(), debit: z.number().int().min(0), credit: z.number().int().min(0), aux: z.string().optional() })),
      disclosureFix: z.string().nullable(),
      evidence: z.array(evidence),
      status,
      history: z.array(z.object({ on: z.string(), status, magnitude: z.number().int().min(0).optional(), suspicion: z.boolean().optional() })),
      escalatedToPartnerOn: z.string().nullable(),
      comment: z.string(),
      createdOn: z.string(),
      updatedOn: z.string().optional(),
      contextAmount: z.number().int().optional(),
      suspicion: z.boolean(),
      piecesOn: z.array(z.string()).max(2).optional(),
      escalation: z
        .object({ on: z.string(), seq: z.number().int(), evidence: z.array(evidence), magnitude: z.number().int().min(0), status, hasEntry: z.boolean(), suspicion: z.boolean() })
        .optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Key of a piece of evidence (duplicates). */
export function evidenceKey(e: Evidence): string {
  switch (e.kind) {
    case 'doc':
      return e.block === undefined ? `doc:${e.docId}` : `doc:${e.docId}#${e.block}`;
    case 'fec':
      return `fec:${e.year}:${e.num}`;
    default:
      return `${e.kind}:${e.id}`;
  }
}

/** Evidence without duplicates, in the order given. */
export function uniqueEvidence(list: readonly Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const e of list) {
    const k = evidenceKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

export function objectKey(o: { kind: string; id: string }): string {
  return `${o.kind}:${o.id}`;
}

function isObjectKind(k: string): k is FindingObjectKind {
  return (FINDING_OBJECT_KINDS as readonly string[]).includes(k);
}

/** Objects of a finding: known kinds, without duplicates, at most `max`. */
export function normaliseObjects(list: readonly { kind: string; id: string }[], max: number): FindingObject[] {
  const seen = new Set<string>();
  const out: FindingObject[] = [];
  for (const o of list) {
    if (!isObjectKind(o.kind) || !o.id) continue;
    const k = objectKey(o);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ kind: o.kind, id: o.id });
    if (out.length >= max) break;
  }
  return out;
}

export interface EntryTotals {
  debit: number;
  credit: number;
  balanced: boolean;
}

export function entryTotals(lines: readonly ProposedLine[]): EntryTotals {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    debit += l.debit;
    credit += l.credit;
  }
  return { debit, credit, balanced: debit === credit };
}

/** Amount of a finding: the sum of the debits of its proposed entry (cents). */
export function findingAmount(f: Pick<Finding, 'proposedEntry'>): number {
  return entryTotals(f.proposedEntry).debit;
}

/**
 * Magnitude of a proposed entry (plan J5 §10.3): the largest of the absolute
 * impacts on the result, on the equity and on a line of the balance sheet
 * (cents). The form computes the impact (impactOfLines) and passes the
 * magnitude to the actions; 0 without an entry.
 */
export function findingMagnitude(impact: Pick<Impact, 'result' | 'equity' | 'lines'> | null, params: Params): number {
  if (!impact) return 0;
  const balanceSheet = new Set(params.statements.filter((l) => l.statement !== 'income').map((l) => l.id));
  let max = Math.max(Math.abs(impact.result), Math.abs(impact.equity));
  for (const [id, v] of Object.entries(impact.lines)) if (balanceSheet.has(id)) max = Math.max(max, Math.abs(v));
  return Math.round(max);
}

/**
 * Lines with an account and an amount: what is saved, matched and shown in the
 * table (empty lines of the form are dropped; a line with an amount and no
 * account is reported by draftErrors). The form computes its totals on them.
 */
export function meaningfulLines(lines: readonly ProposedLine[]): ProposedLine[] {
  return lines.filter((l) => l.account && (l.debit !== 0 || l.credit !== 0)).map((l) => ({ account: l.account, debit: l.debit, credit: l.credit, ...(l.aux ? { aux: l.aux } : {}) }));
}

function cycleIds(params: Params): Set<string> {
  return new Set(params.cycles.cycles.map((c) => c.id));
}

/** The evidence links a sample drawn otherwise than on specific items: its misstatement is projected on the population (form, matching). */
export function linksProjectedSample(evidence: readonly Evidence[], samples?: { items: readonly { id: string; method: string }[] }): boolean {
  return evidence.some((e) => {
    if (e.kind !== 'sample') return false;
    const x = samples?.items.find((it) => it.id === e.id);
    return x !== undefined && x.method !== 'specific';
  });
}

/** Draft of the form from the context of the button (cycle, objects, evidence, amount). */
export function draftFromSeed(seed: FindingSeed, params: Params, statusOf: FindingStatus = 'finding', samples?: { items: readonly { id: string; method: string }[] }): FindingDraft {
  const max = params.disclosureItems.matching.maxObjects;
  return {
    title: (seed.label ?? '').trim(),
    cycle: seed.cycle && cycleIds(params).has(seed.cycle) ? seed.cycle : 'crossCycle',
    objects: normaliseObjects(seed.objects ?? [], max),
    natures: [],
    classification: linksProjectedSample(seed.evidence ?? [], samples) ? 'projected' : 'factual',
    treatments: [],
    proposedEntry: [],
    disclosureFix: null,
    evidence: uniqueEvidence(seed.evidence ?? []),
    status: statusOf,
    comment: '',
    suspicion: false,
    ...(seed.amount !== undefined && seed.amount !== 0 ? { contextAmount: Math.round(Math.abs(seed.amount)) } : {}),
  };
}

export function draftOf(f: Finding): FindingDraft {
  return {
    title: f.title,
    cycle: f.cycle,
    objects: f.objects,
    natures: f.natures,
    classification: f.classification,
    treatments: f.treatments,
    proposedEntry: f.proposedEntry,
    disclosureFix: f.disclosureFix,
    evidence: f.evidence,
    status: f.status,
    comment: f.comment,
    suspicion: f.suspicion,
    ...(f.contextAmount !== undefined ? { contextAmount: f.contextAmount } : {}),
  };
}

export interface DraftCheckContext {
  params: Params;
  /** Accounts of the chart (the entry is proposed on accounts of the chart only). */
  accounts: ReadonlySet<string>;
}

/** What prevents saving the draft (French). */
export function draftErrors(d: FindingDraft, ctx: DraftCheckContext): string[] {
  const { params } = ctx;
  const m = params.disclosureItems.matching;
  const errors: string[] = [];
  if (!cycleIds(params).has(d.cycle)) errors.push('Choisissez le cycle du constat.');
  if (d.objects.length > m.maxObjects) errors.push(`${m.maxObjects} objets au plus.`);
  if (d.natures.length > m.maxNatures) errors.push(`${m.maxNatures} natures au plus.`);
  d.proposedEntry.forEach((l, i) => {
    if (!l.account && (l.debit || l.credit)) errors.push(`Ligne ${i + 1} : compte manquant.`);
  });
  const lines = meaningfulLines(d.proposedEntry);
  for (const l of lines) {
    if (!ctx.accounts.has(l.account)) errors.push(`Le compte ${l.account} n’existe pas dans le plan de comptes.`);
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit) || l.debit < 0 || l.credit < 0) errors.push(`Montant invalide sur le compte ${l.account}.`);
    if (l.debit > 0 && l.credit > 0) errors.push(`Le compte ${l.account} est à la fois débité et crédité sur la même ligne.`);
  }
  if (lines.length === 1) errors.push('L’écriture proposée doit comporter au moins une ligne au débit et une au crédit.');
  if (lines.length > 0 && !entryTotals(lines).balanced) errors.push('L’écriture proposée n’est pas équilibrée (total des débits ≠ total des crédits).');
  if (d.disclosureFix !== null) {
    const fix = params.disclosureItems.fixes.find((f) => f.id === d.disclosureFix);
    if (!fix) errors.push('Correction d’information inconnue.');
    else if (!fix.treatments.some((t) => d.treatments.includes(t))) errors.push('La correction d’information choisie ne correspond à aucun des traitements retenus.');
  }
  if (d.status === 'finding' && d.treatments.length === 0) errors.push('Un constat doit proposer au moins un traitement (ou rester au statut « question »).');
  return errors;
}

/** Points to complete that do not prevent saving (French). */
export function draftWarnings(d: FindingDraft): string[] {
  const w: string[] = [];
  if (d.status !== 'finding') return w;
  const lines = meaningfulLines(d.proposedEntry);
  if ((d.treatments.includes('adjust') || d.treatments.includes('reclassify')) && lines.length === 0) w.push('Aucune écriture proposée : l’anomalie n’est pas chiffrée.');
  if (d.treatments.some((t) => t === 'disclose' || t === 'report' || t === 'specialReport' || t === 'governance') && d.disclosureFix === null) w.push('Aucune correction d’information choisie pour le traitement retenu.');
  if (d.evidence.length === 0) w.push('Aucune pièce liée : le constat n’est pas documenté.');
  if (d.objects.length === 0) w.push('Aucun objet désigné (programme, tiers, compte, pièce…).');
  return w;
}

function clean(d: FindingDraft, params: Params): FindingDraft {
  const max = params.disclosureItems.matching;
  return {
    title: d.title.trim(),
    cycle: d.cycle,
    objects: normaliseObjects(d.objects, max.maxObjects),
    natures: [...new Set(d.natures)].filter((n) => (FINDING_NATURES as readonly string[]).includes(n)).slice(0, max.maxNatures),
    classification: d.classification,
    treatments: [...new Set(d.treatments)].filter((t) => (FINDING_TREATMENTS as readonly string[]).includes(t)),
    proposedEntry: meaningfulLines(d.proposedEntry),
    disclosureFix: d.disclosureFix,
    evidence: uniqueEvidence(d.evidence),
    status: d.status,
    comment: d.comment,
    suspicion: d.suspicion === true,
    ...(d.contextAmount !== undefined ? { contextAmount: d.contextAmount } : {}),
  };
}

const STATUS_TEXT: Readonly<Record<FindingStatus, string>> = { question: 'question', finding: 'constat', dismissed: 'écarté', closed: 'clos' };

function journalTitle(id: string, title: string, what: string): string {
  return `${id}${title ? ` – ${title}` : ''} (${what})`;
}

function withFindings(s: GameState, items: Finding[]): GameState {
  return { ...s, findings: { ...s.findings, items } };
}

/** Dates the first and second pieces were linked, completed with a count reached on `on` (never shortened). */
function notePieces(piecesOn: readonly IsoDate[] | undefined, count: number, on: IsoDate): IsoDate[] | undefined {
  const list = [...(piecesOn ?? [])];
  while (list.length < Math.min(2, count)) list.push(on);
  return list.length ? list : undefined;
}

function withPieces(f: Finding, on: IsoDate): Finding {
  const piecesOn = notePieces(f.piecesOn, f.evidence.length, on);
  if (piecesOn === undefined || (f.piecesOn && piecesOn.length === f.piecesOn.length)) return f;
  return { ...f, piecesOn };
}

function lastEntry(f: Finding): FindingHistoryEntry | undefined {
  return f.history[f.history.length - 1];
}

/** History completed with an entry when the status, the magnitude or the flag changed. */
function withHistory(f: Finding, on: IsoDate, statusTo: FindingStatus, magnitude: number, suspicion: boolean): FindingHistoryEntry[] {
  const last = lastEntry(f);
  if (last && last.status === statusTo && (last.magnitude ?? 0) === magnitude && (last.suspicion ?? false) === suspicion) return f.history;
  return [...f.history, { on, status: statusTo, magnitude, suspicion }];
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

/**
 * Creates a finding (or a question) from a draft; the draft is assumed
 * checked (draftErrors). `magnitude`: of its proposed entry, computed by the
 * caller (findingMagnitude). Returns the state and the new id.
 */
export function createFinding(s: GameState, draft: FindingDraft, params: Params, magnitude = 0): [GameState, string] {
  const d = clean(draft, params);
  const [id, s1] = nextId(s, 'C');
  const on = s1.clock.date;
  const created: Finding = { id, ...d, history: [{ on, status: d.status, magnitude: Math.round(magnitude), suspicion: d.suspicion }], escalatedToPartnerOn: null, createdOn: on };
  const f = withPieces(created, on);
  const s2 = withFindings(s1, [...s1.findings.items, f]);
  return [log(s2, 'finding', id, { action: 'create', status: d.status, title: journalTitle(id, d.title, `${STATUS_TEXT[d.status]} créé${d.status === 'question' ? 'e' : ''}`) }), id];
}

/** One-click capture of a question from the context of a button (plan J4 J4-11). */
export function captureQuestion(s: GameState, seed: FindingSeed, params: Params): [GameState, string] {
  return createFinding(s, draftFromSeed(seed, params, 'question', s.samples), params);
}

/**
 * Saves the form; a change of status, of magnitude (of the proposed entry,
 * computed by the caller) or of the suspicion flag is added to the history.
 */
export function updateFinding(s: GameState, id: string, draft: FindingDraft, params: Params, magnitude = 0): GameState {
  const f = s.findings.items.find((x) => x.id === id);
  if (!f) return s;
  const d = clean(draft, params);
  const history = withHistory(f, s.clock.date, d.status, Math.round(magnitude), d.suspicion);
  const next: Finding = withPieces({ ...f, ...d, history, updatedOn: s.clock.date }, s.clock.date);
  if (d.contextAmount === undefined) delete next.contextAmount;
  const s1 = withFindings(s, s.findings.items.map((x) => (x.id === id ? next : x)));
  const what = d.status === f.status ? 'mis à jour' : `statut : ${STATUS_TEXT[d.status]}`;
  return log(s1, 'finding', id, { action: d.status === f.status ? 'update' : 'status', status: d.status, title: journalTitle(id, d.title, what) });
}

/** Changes the status; the magnitude noted in the history is the caller's, the last one noted otherwise. */
export function setFindingStatus(s: GameState, id: string, statusTo: FindingStatus, magnitude?: number): GameState {
  const f = s.findings.items.find((x) => x.id === id);
  if (!f || f.status === statusTo) return s;
  const m = magnitude !== undefined ? Math.round(magnitude) : (lastEntry(f)?.magnitude ?? 0);
  const next: Finding = { ...f, status: statusTo, history: [...f.history, { on: s.clock.date, status: statusTo, magnitude: m, suspicion: f.suspicion }], updatedOn: s.clock.date };
  return log(withFindings(s, s.findings.items.map((x) => (x.id === id ? next : x))), 'finding', id, { action: 'status', status: statusTo, title: journalTitle(id, f.title, `statut : ${STATUS_TEXT[statusTo]}`) });
}

/**
 * Escalation to the partner, dated once, with a frozen snapshot of what she
 * was told (evidence, magnitude of the proposed entry computed by the
 * caller, status, entry, flag): unlinking, downgrading or deleting the
 * finding afterwards does not change it.
 */
export function escalateFinding(s: GameState, id: string, magnitude = 0): GameState {
  const f = s.findings.items.find((x) => x.id === id);
  if (!f || f.escalatedToPartnerOn !== null) return s;
  const [seq, s1] = nextSeq(s);
  const on = s1.clock.date;
  const escalation: EscalationSnapshot = { on, seq, evidence: f.evidence.map((e) => ({ ...e })), magnitude: Math.round(magnitude), status: f.status, hasEntry: f.proposedEntry.length > 0, suspicion: f.suspicion };
  const next: Finding = { ...f, escalatedToPartnerOn: on, escalation, updatedOn: on };
  return log(withFindings(s1, s1.findings.items.map((x) => (x.id === id ? next : x))), 'finding', id, { action: 'escalate', title: journalTitle(id, f.title, 'remonté à l’associée') });
}

export function deleteFinding(s: GameState, id: string): GameState {
  const f = s.findings.items.find((x) => x.id === id);
  if (!f) return s;
  return log(withFindings(s, s.findings.items.filter((x) => x.id !== id)), 'finding', id, { action: 'delete', title: journalTitle(id, f.title, 'supprimé') });
}

/** Adds evidence to a finding (from a document, an entry…), without duplicates. */
export function linkEvidence(s: GameState, id: string, ev: Evidence): GameState {
  const f = s.findings.items.find((x) => x.id === id);
  if (!f) return s;
  const list = uniqueEvidence([...f.evidence, ev]);
  if (list.length === f.evidence.length) return s;
  return withFindings(s, s.findings.items.map((x) => (x.id === id ? withPieces({ ...x, evidence: list, updatedOn: s.clock.date }, s.clock.date) : x)));
}

// ---------------------------------------------------------------------------
// end of the final: open questions become « points en suspens » (J6)
// ---------------------------------------------------------------------------

/** Last day of the final visit (game.json → calendar). */
export function finalEnd(params: Params): IsoDate {
  return params.game.calendar.find((p) => p.id === 'final')?.to ?? '9999-12-31';
}

/** Questions still open after the end of the final: « points en suspens », penalised by J6. */
export function pendingPoints(findings: readonly Finding[], params: Params, date: IsoDate): Finding[] {
  if (date <= finalEnd(params)) return [];
  return findings.filter((f) => f.status === 'question');
}

/** Open points (questions and findings) of a cycle, most recent first. */
export function findingsOfCycle(findings: readonly Finding[], cycle: string): Finding[] {
  return findings.filter((f) => f.cycle === cycle).reverse();
}
