/**
 * Matching of the player's findings to the correction key (plan J4 §13.2,
 * J4-12, J4-13; cahier des charges §10.6). Pure, deterministic, without free
 * text: the title and the comment of a finding are never read.
 *
 * GUARD: this module reads the correction key. It is imported only by the
 * designer-mode files and by the J6 rules (checked by
 * tests/game/matching.test.ts).
 *
 * 1. Eligibility of a finding for a part (or for a group of sibling parts of
 *    the same anomaly, or for a false lead):
 *    - its cycle is one of the cycles accepted by the part;
 *    - no conflict: a programme, third party, subsidy, loan or annex item
 *      named by the finding belongs to the part whenever the part has objects
 *      of that kind (wrong programme, wrong third party);
 *    - at least one object in common with the part's signature or key
 *      objects: objects named, accounts of the proposed entry, evidence linked
 *      (documents, FEC entries, confirmations, recalculations, samples,
 *      queries), accounts compared by prefix;
 *    - when it proposes an entry, at least one of its accounts is an account
 *      of the part (signature, key objects or correction entry);
 *    - at least one key object when the part has some (sibling parts sharing
 *      their objects), named or linked (not inferred from a population);
 *    - the part's treatment when the part requires it (A12.ii, A12.iii).
 * 2. Score: key objects, common objects, accounts of the correction entry,
 *    compatible treatment, quantification within the tolerance (the natures
 *    are a quality axis only).
 * 3. Deterministic one-to-one assignment: pairs by decreasing score, ties by
 *    the canonical order of the parts, then the order of the findings. A
 *    finding whose best target is already taken is a duplicate (neutral). A
 *    finding may cover several sibling parts when its amount matches their
 *    sum (A10 in one finding; A07.a keeps its estimate range in the sum) or,
 *    for disclosure parts and for parts credited on different bases (A16: the
 *    adjustment and its disclosure), when it is eligible for each of them
 *    with their treatments. A real anomaly always wins over a false lead,
 *    except when the finding links one of the lead's evidence documents and
 *    shares with the part nothing but linked documents.
 * 4. Quantification on the part's credit basis (result, equity, amount
 *    reclassified, disclosure fix): tolerance max(± tolerance % of the
 *    measure, reference clearly-trivial threshold), widened by the part's
 *    share range (A07.a) and, for a finding projected from a sample (not
 *    drawn on specific items), by the range of the projected misstatements;
 *    signed amounts (A08 is negative).
 * 5. Only the findings with the status « constat » are reported; « écarté »
 *    and « clos » (a point settled with nothing to report) are not. False
 *    leads: « écartée avec preuves » when a dismissed or closed finding
 *    eligible for the lead links at least one of its evidence documents;
 *    « signalée à tort » when a finding « constat » is matched to it above the
 *    trivial threshold (or without any entry).
 */
import type { IsoDate } from '../engine/dates';
import { compareFecEntries } from '../engine/fec';
import type { Cents } from '../engine/money';
import type { Ledger, World } from '../engine/types';
import type { ScenarioDatasets } from '../scenario/datasets';
import { ANOMALIES } from '../scenario/anomalies/modules';
import { impactOfLines, type CorrectionKey, type Impact } from '../scenario/anomalies/presented';
import type { AnomalyId, Classification, CreditBasis, PartKey, Treatment } from '../scenario/anomalies/types';
import type { FalseLead } from '../scenario/documents/false-leads';
import { baseDocumentId, type DocumentModel, type FalseLeadId } from '../scenario/documents/model';
import type { Params } from '../scenario/params';
import { findingAmount, linksProjectedSample, meaningfulLines, type Evidence, type Finding } from './findings';
import type { GameState } from './state';

// ---------------------------------------------------------------------------
// objects
// ---------------------------------------------------------------------------

interface Obj {
  kind: string;
  id: string;
}

/** Kinds whose foreign objects contradict a part (wrong programme, wrong third party…). */
const DISCRIMINATING_KINDS: ReadonlySet<string> = new Set(['programme', 'thirdParty', 'subsidy', 'loan', 'disclosureItem']);

/** Two accounts match when one is a prefix of the other, the shorter having at least three digits. */
export function accountsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.startsWith(short);
}

function same(a: Obj, b: Obj): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'account' ? accountsMatch(a.id, b.id) : a.id === b.id;
}

const acct = (id: string): Obj => ({ kind: 'account', id });
/** A later version of a reply (`<id>~YYYY-MM-DD`) is the document it updates. */
const docObj = (id: string): Obj => ({ kind: 'document', id: baseDocumentId(id) });

function hasAny(pool: readonly Obj[], o: Obj): boolean {
  return pool.some((x) => same(x, o));
}

function uniq(objs: readonly Obj[]): Obj[] {
  const seen = new Set<string>();
  const out: Obj[] = [];
  for (const o of objs) {
    const k = `${o.kind}:${o.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

// ---------------------------------------------------------------------------
// targets: parts of the key and false leads
// ---------------------------------------------------------------------------

type NumericBasis = Exclude<CreditBasis, 'disclosure'>;

export interface PartTarget {
  kind: 'part';
  id: PartKey;
  anomalyId: AnomalyId;
  /** Canonical order (order of application of the parts). */
  order: number;
  cycles: readonly string[];
  /** Signature objects, key objects and annex items. */
  objects: readonly Obj[];
  keys: readonly Obj[];
  /** Accounts of the correction entry (score and consistency of the entry). */
  correctionAccounts: readonly string[];
  treatment: Treatment;
  treatmentRequired: boolean;
  creditBasis: readonly CreditBasis[];
  measures: Partial<Record<NumericBasis, Cents>>;
  toleranceShare?: { min: number; max: number };
  expectedFixes: readonly string[];
  natures: readonly string[];
  classification: Classification;
  /** Documents carrying a clue of the part (evidence axis). */
  clueDocs: ReadonlySet<string>;
}

export interface FalseLeadTarget {
  kind: 'falseLead';
  id: FalseLeadId;
  order: number;
  cycles: readonly string[];
  objects: readonly Obj[];
  keys: readonly Obj[];
  evidence: ReadonlySet<string>;
}

type Target = PartTarget | FalseLeadTarget;

function accountsOf(objs: readonly Obj[]): string[] {
  return objs.filter((o) => o.kind === 'account').map((o) => o.id);
}

const targetCache = new WeakMap<CorrectionKey, { documents: readonly DocumentModel[]; falseLeads: readonly FalseLead[]; parts: PartTarget[]; leads: FalseLeadTarget[] }>();

/** Parts of the key and false leads as matching targets (cached per key). */
export function matchTargets(key: CorrectionKey, documents: readonly DocumentModel[], falseLeads: readonly FalseLead[]): { parts: PartTarget[]; leads: FalseLeadTarget[] } {
  const hit = targetCache.get(key);
  if (hit && hit.documents === documents && hit.falseLeads === falseLeads) return hit;
  const clueDocs = new Map<string, Set<string>>();
  for (const d of documents)
    for (const cl of d.clues) {
      const m = ANOMALIES.find((x) => x.id === cl.target);
      if (!m) continue;
      for (const p of m.parts) if (!cl.parts || cl.parts.includes(p.id)) (clueDocs.get(p.id) ?? clueDocs.set(p.id, new Set()).get(p.id)!).add(d.id);
    }
  let order = 0;
  const parts: PartTarget[] = [];
  for (const m of ANOMALIES)
    for (const p of m.parts) {
      const c = key.corrections.find((x) => x.key === p.id);
      const impact: Impact | undefined = c?.impact;
      const debits = c?.entry ? c.entry.lines.reduce((s, l) => s + l.debit, 0) : 0;
      const keys = uniq([...(p.keyObjects ?? [])]);
      parts.push({
        kind: 'part',
        id: p.id,
        anomalyId: m.id,
        order: order++,
        cycles: p.cycles,
        objects: uniq([...p.signature.objects, ...keys, ...(p.disclosureItems ?? []).map((id) => ({ kind: 'disclosureItem', id }))]),
        keys,
        correctionAccounts: c?.entry ? [...new Set(c.entry.lines.map((l) => l.account))] : [],
        treatment: p.treatment,
        treatmentRequired: !!p.treatmentRequired,
        creditBasis: p.creditBasis,
        measures: { result: impact?.result ?? 0, equity: impact?.equity ?? 0, reclassified: debits },
        ...(p.toleranceShare ? { toleranceShare: p.toleranceShare } : {}),
        expectedFixes: p.expectedFixes ?? [],
        natures: p.signature.natures,
        classification: m.classification,
        clueDocs: clueDocs.get(p.id) ?? new Set(),
      });
    }
  const leads: FalseLeadTarget[] = falseLeads.map((f, i) => ({
    kind: 'falseLead',
    id: f.id,
    order: 1000 + i,
    cycles: f.signature.cycles,
    objects: uniq([...f.signature.objects, ...(f.signature.keyObjects ?? [])]),
    keys: uniq([...(f.signature.keyObjects ?? [])]),
    evidence: new Set(f.evidence),
  }));
  const value = { documents, falseLeads, parts, leads };
  targetCache.set(key, value);
  return value;
}

// ---------------------------------------------------------------------------
// findings: objects of the evidence, measures of the proposed entry
// ---------------------------------------------------------------------------

/** Accounts of the populations of the samples and of the recalculation tools (prefixes, expanded on the chart). */
const POPULATION_ACCOUNTS: Readonly<Record<string, readonly string[]>> = {
  'capitalised-works': ['21'],
  'construction-progress': ['2313'],
  'maintenance-charges': ['615'],
  'invoices-2026': ['401', '404', '408'],
  'rent-roll': ['704'],
  'tenant-receivables': ['411', '491'],
  loans: ['163', '164', '1688', '6611'],
};
const TOOL_ACCOUNTS: Readonly<Record<string, readonly string[]>> = {
  depreciation: ['281', '681'],
  icne: ['1688', '6611'],
  impairment: ['491', '6817', '7817'],
  pge: ['1572', '6815', '7815'],
  'rent-revision': ['704', '4196'],
  prorata: ['281', '681'],
};

function expand(world: World, prefixes: readonly string[]): Obj[] {
  return world.chart.accounts.filter((a) => prefixes.some((p) => a.number.startsWith(p))).map((a) => acct(a.number));
}

const fecCache = new WeakMap<World, Map<string, string[]>>();

function numberLedger(ledger: Ledger, year: number, out: Map<string, string[]>): void {
  const counters = new Map<string, number>();
  for (const e of [...ledger.entries].sort(compareFecEntries)) {
    const n = (counters.get(e.journal) ?? 0) + 1;
    counters.set(e.journal, n);
    out.set(`${year}:${e.journal}${String(n).padStart(6, '0')}`, [...new Set(e.lines.map((l) => l.account))]);
  }
}

/** Accounts of every entry of the presented world, by FEC number ('YYYY:EcritureNum'). */
export function fecAccounts(world: World): ReadonlyMap<string, string[]> {
  let m = fecCache.get(world);
  if (!m) {
    m = new Map();
    numberLedger(world.ledgers.prior, world.ledgers.prior.fiscalYear, m);
    numberLedger(world.ledgers.current, world.ledgers.current.fiscalYear, m);
    fecCache.set(world, m);
  }
  return m;
}

export type EvidenceState = Pick<GameState, 'samples' | 'recalcs' | 'savedQueries'>;

/**
 * Objects of a piece of evidence: `strong` ones (documents, accounts of a
 * real entry, third party confirmed, scope of a recalculation, items found in
 * error) can satisfy the key objects; `weak` ones (accounts of a population,
 * of a tool, of a query) only count as common objects.
 */
export function evidenceObjects(ev: Evidence, world: World, state: EvidenceState | undefined): { strong: Obj[]; weak: Obj[] } {
  const ds = world.datasets as unknown as ScenarioDatasets;
  switch (ev.kind) {
    case 'doc':
      return { strong: [docObj(ev.docId)], weak: [] };
    case 'fec':
      return { strong: (fecAccounts(world).get(`${ev.year}:${ev.num}`) ?? []).map(acct), weak: [] };
    case 'confirmation':
      return { strong: [{ kind: 'thirdParty', id: ev.id }], weak: [] };
    case 'recalc': {
      const r = state?.recalcs.items.find((x) => x.id === ev.id);
      if (!r) return { strong: [], weak: [] };
      const strong: Obj[] = [];
      if (ds.thirdParties.some((t) => t.id === r.scope)) strong.push({ kind: 'thirdParty', id: r.scope });
      else if (r.scope && r.scope !== 'all') strong.push({ kind: 'programme', id: r.scope });
      for (const a of Object.values(r.assumptions)) if (a.source?.startsWith('doc:')) strong.push(docObj(a.source.slice(4).split('#')[0]!));
      return { strong, weak: expand(world, TOOL_ACCOUNTS[r.tool] ?? []) };
    }
    case 'sample': {
      const x = state?.samples.items.find((it) => it.id === ev.id);
      if (!x) return { strong: [], weak: [] };
      const strong: Obj[] = [];
      for (const [k, v] of Object.entries(x.exceptions ?? {})) {
        if (v === 0) continue;
        const accounts = fecAccounts(world).get(k);
        if (accounts) strong.push(...accounts.map(acct));
        else if (/^[A-Z0-9]+:\d{4}-\d{2}$/.test(k)) strong.push({ kind: 'programme', id: k.split(':')[0]! });
        else if (k.startsWith('inv:')) {
          const inv = ds.invoices.find((i) => i.number === k.slice(4));
          if (inv) strong.push({ kind: 'thirdParty', id: inv.supplierId });
        } else {
          const loan = ds.loans.find((l) => l.contractNumber === k);
          if (loan) strong.push({ kind: 'loan', id: loan.id }, { kind: 'thirdParty', id: loan.lenderId });
        }
      }
      return { strong, weak: expand(world, POPULATION_ACCOUNTS[x.population] ?? []) };
    }
    case 'query': {
      const q = state?.savedQueries.find((it) => it.id === ev.id);
      return { strong: [], weak: q ? expand(world, q.query.accounts) : [] };
    }
    case 'execution':
      return { strong: [], weak: [] };
  }
}

export interface FindingMeasures {
  result: Cents;
  equity: Cents;
  caf: Cents;
  netSelfFinancing: Cents;
  /** Sum of the debits of the proposed entry. */
  reclassified: Cents;
}

interface Profile {
  finding: Finding;
  index: number;
  named: Obj[];
  entryAccounts: string[];
  /** Named objects and accounts of the entry. */
  direct: Obj[];
  /** Strong objects of the evidence. */
  linked: Obj[];
  /** Weak objects of the evidence. */
  inferred: Obj[];
  evidenceDocs: ReadonlySet<string>;
  measures: FindingMeasures | null;
  /** A sample drawn otherwise than on specific items is linked: the misstatement can be projected. */
  projectable: boolean;
}

function profileOf(f: Finding, index: number, input: MatchInput): Profile {
  const world = input.key.presented.world;
  const lines = meaningfulLines(f.proposedEntry);
  const entryAccounts = [...new Set(lines.map((l) => l.account))];
  const named: Obj[] = f.objects.map((o) => ({ kind: o.kind, id: o.id }));
  const linked: Obj[] = [];
  const inferred: Obj[] = [];
  for (const ev of f.evidence) {
    const o = evidenceObjects(ev, world, input.state);
    linked.push(...o.strong);
    inferred.push(...o.weak);
  }
  let measures: FindingMeasures | null = null;
  if (lines.length > 0) {
    const i = impactOfLines(input.key.presentedFigures, lines, { world, params: input.params });
    measures = { result: i.result, equity: i.equity, caf: i.caf, netSelfFinancing: i.netSelfFinancing, reclassified: findingAmount({ proposedEntry: lines }) };
  }
  return {
    finding: f,
    index,
    named,
    entryAccounts,
    direct: uniq([...named, ...entryAccounts.map(acct)]),
    linked: uniq(linked),
    inferred: uniq(inferred),
    evidenceDocs: new Set(f.evidence.flatMap((e) => (e.kind === 'doc' ? [baseDocumentId(e.docId)] : []))),
    measures,
    projectable: linksProjectedSample(f.evidence, input.state?.samples),
  };
}

// ---------------------------------------------------------------------------
// evaluation of a finding against a target
// ---------------------------------------------------------------------------

export interface Evaluation {
  eligible: boolean;
  /** Why it is not eligible (designer mode). */
  reasons: string[];
  keyOk: boolean;
  score: number;
  treatmentOk: boolean;
  quantified: boolean;
  basis: CreditBasis | null;
  measure: Cents | null;
  expected: Cents | null;
  range: [Cents, Cents] | null;
  classificationOk: boolean;
  evidenceOk: boolean;
  naturesOk: boolean;
  /** The finding shares with the target nothing but linked documents (no object named, no account of its entry, no other linked object). */
  documentary: boolean;
}

function trivialOf(params: Params): Cents {
  return Math.round(params.regulatory.materiality.reference.trivialEuros * 100);
}

/** Accepted range for a measure: ± max(tolerance %, trivial threshold), widened by the part's share range and, for a projected finding, by the range of projected misstatements. */
export function acceptedRange(expected: Cents, params: Params, opts: { share?: { min: number; max: number }; projected?: boolean } = {}): [Cents, Cents] {
  const m = params.disclosureItems.matching;
  const tol = Math.max(Math.round((Math.abs(expected) * m.tolerancePct) / 100), trivialOf(params));
  let lo = expected - tol;
  let hi = expected + tol;
  const widen = (a: number, b: number) => {
    lo = Math.min(lo, Math.round(expected * a), Math.round(expected * b));
    hi = Math.max(hi, Math.round(expected * a), Math.round(expected * b));
  };
  if (opts.share) widen(opts.share.min, opts.share.max);
  if (opts.projected) widen(m.projectedShareRange[0], m.projectedShareRange[1]);
  return [lo, hi];
}

function fixTreatments(params: Params, fix: string | null): readonly string[] {
  return fix === null ? [] : (params.disclosureItems.fixes.find((f) => f.id === fix)?.treatments ?? []);
}

function partTreatmentOk(p: Profile, t: PartTarget, params: Params): boolean {
  const f = p.finding;
  if ((f.treatments as readonly string[]).includes(t.treatment)) return true;
  return f.disclosureFix !== null && t.expectedFixes.includes(f.disclosureFix) && fixTreatments(params, f.disclosureFix).some((x) => (f.treatments as readonly string[]).includes(x));
}

interface Common {
  conflict: string | null;
  /** Target objects found among the finding's direct objects, linked evidence, inferred objects. */
  direct: number;
  linked: number;
  inferred: number;
  keys: number;
  keyOk: boolean;
  entryConsistent: boolean;
  correction: number;
  /** Only linked documents in common (no direct object, no account of the correction entry, no other linked object). */
  documentary: boolean;
}

function commonWith(p: Profile, objects: readonly Obj[], keys: readonly Obj[], correctionAccounts: readonly string[]): Common {
  let conflict: string | null = null;
  for (const o of p.named) {
    if (!DISCRIMINATING_KINDS.has(o.kind)) continue;
    if (objects.some((x) => x.kind === o.kind) && !hasAny(objects, o)) {
      conflict = `${o.kind} ${o.id} étranger à la cible`;
      break;
    }
  }
  let direct = 0;
  let linked = 0;
  let linkedOther = 0;
  let inferred = 0;
  for (const o of objects) {
    if (hasAny(p.direct, o)) direct++;
    else if (hasAny(p.linked, o)) {
      linked++;
      if (o.kind !== 'document') linkedOther++;
    } else if (hasAny(p.inferred, o)) inferred++;
  }
  const strong = [...p.direct, ...p.linked];
  const keyHits = keys.filter((k) => hasAny(strong, k)).length;
  const targetAccounts = [...accountsOf(objects), ...correctionAccounts];
  const entryConsistent = p.entryAccounts.length === 0 || targetAccounts.length === 0 || p.entryAccounts.some((a) => targetAccounts.some((b) => accountsMatch(a, b)));
  const correction = correctionAccounts.filter((a) => p.entryAccounts.some((b) => accountsMatch(a, b)) && !accountsOf(objects).some((x) => accountsMatch(x, a))).length;
  return { conflict, direct, linked, inferred, keys: keyHits, keyOk: keys.length === 0 || keyHits > 0, entryConsistent, correction, documentary: direct === 0 && correction === 0 && linkedOther === 0 };
}

/** Projected finding: classified « extrapolée » and linking a sample drawn otherwise than on specific items. */
function projectedFinding(p: Profile): boolean {
  return p.finding.classification === 'projected' && p.projectable;
}

function quantification(p: Profile, t: PartTarget, params: Params): Pick<Evaluation, 'quantified' | 'basis' | 'measure' | 'expected' | 'range'> {
  let first: Pick<Evaluation, 'quantified' | 'basis' | 'measure' | 'expected' | 'range'> | null = null;
  for (const b of t.creditBasis) {
    let r: Pick<Evaluation, 'quantified' | 'basis' | 'measure' | 'expected' | 'range'>;
    if (b === 'disclosure') {
      const ok = t.expectedFixes.length === 0 ? partTreatmentOk(p, t, params) : p.finding.disclosureFix !== null && t.expectedFixes.includes(p.finding.disclosureFix);
      r = { quantified: ok, basis: b, measure: null, expected: null, range: null };
    } else {
      const expected = t.measures[b] ?? 0;
      const range = acceptedRange(expected, params, { ...(t.toleranceShare ? { share: t.toleranceShare } : {}), projected: projectedFinding(p) });
      const measure = p.measures ? p.measures[b] : null;
      r = { quantified: measure !== null && measure >= range[0] && measure <= range[1], basis: b, measure, expected, range };
    }
    if (r.quantified) return r;
    first ??= r;
  }
  return first ?? { quantified: false, basis: null, measure: null, expected: null, range: null };
}

function evaluatePart(p: Profile, t: PartTarget, params: Params): Evaluation {
  const f = p.finding;
  const c = commonWith(p, t.objects, t.keys, t.correctionAccounts);
  const treatmentOk = partTreatmentOk(p, t, params);
  const q = quantification(p, t, params);
  const reasons: string[] = [];
  if (!t.cycles.includes(f.cycle)) reasons.push('cycle non accepté');
  if (c.conflict) reasons.push(c.conflict);
  if (c.direct + c.linked + c.inferred === 0) reasons.push('aucun objet commun');
  if (!c.entryConsistent) reasons.push('écriture sans compte de la partie');
  if (!c.keyOk) reasons.push('aucun objet discriminant');
  if (t.treatmentRequired && !treatmentOk) reasons.push('traitement requis absent');
  const strongDocs = [...p.evidenceDocs];
  const evidenceOk =
    strongDocs.some((d) => t.clueDocs.has(d) || t.objects.some((o) => o.kind === 'document' && o.id === d)) ||
    p.linked.some((o) => o.kind !== 'document' && (hasAny(t.objects, o) || (o.kind === 'account' && t.correctionAccounts.some((a) => accountsMatch(a, o.id)))));
  const score = c.keys * 4 + c.direct * 2 + c.linked * 2 + c.inferred + c.correction + (treatmentOk ? 3 : 0) + (q.quantified ? 4 : 0);
  return {
    eligible: reasons.length === 0,
    reasons,
    keyOk: c.keyOk,
    score,
    treatmentOk,
    ...q,
    classificationOk: f.classification === t.classification || projectedFinding(p),
    evidenceOk,
    naturesOk: f.natures.some((n) => t.natures.includes(n)),
    documentary: c.documentary,
  };
}

function evaluateLead(p: Profile, t: FalseLeadTarget): Evaluation {
  const f = p.finding;
  const c = commonWith(p, t.objects, t.keys, []);
  const reasons: string[] = [];
  if (!t.cycles.includes(f.cycle)) reasons.push('cycle non accepté');
  if (c.conflict) reasons.push(c.conflict);
  if (c.direct + c.linked + c.inferred === 0) reasons.push('aucun objet commun');
  if (!c.entryConsistent) reasons.push('écriture sans compte de la fausse piste');
  if (!c.keyOk) reasons.push('aucun objet discriminant');
  const evidenceOk = [...p.evidenceDocs].some((d) => t.evidence.has(d));
  return {
    eligible: reasons.length === 0,
    reasons,
    keyOk: c.keyOk,
    score: c.keys * 4 + c.direct * 2 + c.linked * 2 + c.inferred,
    treatmentOk: false,
    quantified: false,
    basis: null,
    measure: null,
    expected: null,
    range: null,
    classificationOk: false,
    evidenceOk,
    naturesOk: false,
    documentary: c.documentary,
  };
}

// ---------------------------------------------------------------------------
// candidates (single parts, groups of sibling parts, false leads)
// ---------------------------------------------------------------------------

interface Candidate {
  profile: Profile;
  /** Parts covered (empty for a false lead). */
  parts: PartTarget[];
  lead: FalseLeadTarget | null;
  /** Evaluation of each part covered (same order), or of the false lead. */
  evals: Evaluation[];
  score: number;
  order: number;
  /** Numeric group: the amount matches the sum of the parts. */
  groupQuantified?: boolean;
}

function subsets<T>(xs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << xs.length; mask++) {
    const s = xs.filter((_, i) => mask & (1 << i));
    if (s.length >= 2) out.push(s);
  }
  return out;
}

function groupCandidate(p: Profile, members: PartTarget[], evals: Evaluation[], params: Params): Candidate | null {
  const f = p.finding;
  const basis = members[0]!.creditBasis[0]!;
  if (basis === 'disclosure' || members.some((m) => m.creditBasis[0] !== basis)) {
    // disclosure parts, or parts credited on different bases (A16: the adjustment and its disclosure):
    // each member eligible on its own, with its treatment, and credited on its own evaluation
    if (!evals.every((e) => e.eligible && e.treatmentOk)) return null;
    return { profile: p, parts: members, lead: null, evals, score: evals.reduce((s, e) => s + e.score, 0), order: members[0]!.order };
  }
  // numeric group: the amount matches the sum of the parts
  if (!p.measures) return null;
  if (!members.every((m) => m.cycles.includes(f.cycle))) return null;
  const objects = uniq(members.flatMap((m) => m.objects));
  const keys = uniq(members.flatMap((m) => m.keys));
  const c = commonWith(p, objects, keys, [...new Set(members.flatMap((m) => m.correctionAccounts))]);
  if (c.conflict || !c.entryConsistent || c.direct + c.linked + c.inferred === 0) return null;
  if (!members.some((m, i) => m.keys.length === 0 || evals[i]!.keyOk)) return null;
  const expected = members.reduce((s, m) => s + (m.measures[basis] ?? 0), 0);
  // the members' estimate ranges (A07.a) carried into the sum, the tolerance applied once
  const bound = (pick: (s: { min: number; max: number }) => number) => members.reduce((s, m) => s + (m.measures[basis] ?? 0) * (m.toleranceShare ? pick(m.toleranceShare) : 1), 0);
  const share = expected !== 0 && members.some((m) => m.toleranceShare) ? { min: bound((s) => s.min) / expected, max: bound((s) => s.max) / expected } : null;
  const range = acceptedRange(expected, params, { ...(share ? { share } : {}), projected: projectedFinding(p) });
  const measure = p.measures[basis];
  if (measure < range[0] || measure > range[1]) return null;
  // the amount is the one of a single part, unless the finding is eligible for every member on its own (overlapping estimate ranges)
  if (evals.some((e) => e.quantified) && !evals.every((e) => e.eligible)) return null;
  const groupEvals = evals.map((e) => ({ ...e, eligible: true, quantified: true, basis, measure, expected, range }));
  return { profile: p, parts: members, lead: null, evals: groupEvals, score: evals.reduce((s, e) => s + e.score, 0) + 4, order: members[0]!.order, groupQuantified: true };
}

function candidatesOf(p: Profile, parts: readonly PartTarget[], leads: readonly FalseLeadTarget[], params: Params): { real: Candidate[]; leads: Candidate[]; evalOf: Map<string, Evaluation> } {
  const evalOf = new Map<string, Evaluation>();
  for (const t of parts) evalOf.set(t.id, evaluatePart(p, t, params));
  const real: Candidate[] = [];
  for (const t of parts) {
    const e = evalOf.get(t.id)!;
    if (e.eligible) real.push({ profile: p, parts: [t], lead: null, evals: [e], score: e.score, order: t.order });
  }
  const byAnomaly = new Map<string, PartTarget[]>();
  for (const t of parts) byAnomaly.set(t.anomalyId, [...(byAnomaly.get(t.anomalyId) ?? []), t]);
  for (const siblings of byAnomaly.values()) {
    if (siblings.length < 2) continue;
    for (const members of subsets(siblings)) {
      const g = groupCandidate(p, members, members.map((m) => evalOf.get(m.id)!), params);
      if (g) real.push(g);
    }
  }
  const leadCands: Candidate[] = [];
  for (const t of leads) {
    const e = evaluateLead(p, t);
    evalOf.set(t.id, e);
    if (e.eligible) leadCands.push({ profile: p, parts: [], lead: t, evals: [e], score: e.score, order: t.order });
  }
  // a false lead whose own evidence is linked wins over a part reached only through linked documents
  // (the bank statement of December tied to the reconciliation of F6 is not the loan of A18)
  const leadEvidenced = leadCands.some((c) => c.evals[0]!.evidenceOk);
  return { real: leadEvidenced ? real.filter((c) => !c.evals.every((e) => e.documentary)) : real, leads: leadCands, evalOf };
}

// ---------------------------------------------------------------------------
// results
// ---------------------------------------------------------------------------

export type FindingOutcome =
  /** Reported finding assigned to one or several parts. */
  | 'matched'
  /** Reported finding whose target is already credited to another finding (neutral). */
  | 'duplicate'
  /** Reported finding matching nothing. */
  | 'falsePositive'
  /** Reported finding matched to a false lead above the trivial threshold (or without entry): « signalée à tort ». */
  | 'falseLeadReported'
  /** Reported finding matched to a false lead at or below the trivial threshold. */
  | 'falseLeadTrivial'
  /** Dismissed or closed finding on a false lead, with at least one of its evidence documents: « écartée avec preuves ». */
  | 'falseLeadDismissed'
  /** Dismissed or closed finding on a false lead without its evidence. */
  | 'falseLeadDismissedWithoutEvidence'
  /** Dismissed or closed finding that is in fact about a real anomaly (not credited). */
  | 'dismissedAnomaly'
  /** Question (not credited; a pending point when still open after the final). */
  | 'question'
  /** Dismissed or closed finding matching nothing. */
  | 'none';

export interface FindingMatch {
  findingId: string;
  /** Main part covered (first in canonical order), or null. */
  partId: PartKey | null;
  /** Every part covered (aggregation of sibling parts). */
  partIds: PartKey[];
  falseLeadId: FalseLeadId | null;
  detected: boolean;
  quantified: boolean;
  treatmentOk: boolean;
  classificationOk: boolean;
  evidenceOk: boolean;
  naturesOk: boolean;
  outcome: FindingOutcome;
  /** Holder of the target, for a duplicate. */
  duplicateOf?: string;
  /** Question still open after the end of the final (J6 « point en suspens »). */
  pending?: boolean;
  basis: CreditBasis | null;
  measure: Cents | null;
  expected: Cents | null;
  range: [Cents, Cents] | null;
  score: number;
}

export interface PartMatch {
  partId: PartKey;
  anomalyId: AnomalyId;
  findingId: string | null;
  detected: boolean;
  quantified: boolean;
  treatmentOk: boolean;
  classificationOk: boolean;
  evidenceOk: boolean;
  naturesOk: boolean;
  /** Findings of the same part credited to another finding. */
  duplicates: string[];
  /** Open questions pointing to the part. */
  questions: string[];
  /** Dismissed or closed findings that were about the part. */
  dismissedBy: string[];
}

export interface FalseLeadMatch {
  id: FalseLeadId;
  dismissedWithEvidence: boolean;
  reportedWrongly: boolean;
  reportedTrivial: boolean;
  findingIds: string[];
}

export interface MatchReport {
  findings: FindingMatch[];
  parts: PartMatch[];
  falseLeads: FalseLeadMatch[];
  /** Questions still open after the end of the final. */
  pending: string[];
}

export interface MatchInput {
  params: Params;
  key: CorrectionKey;
  /** Documents of the case (clue documents of the evidence axis). */
  documents: readonly DocumentModel[];
  falseLeads: readonly FalseLead[];
  /** Samples, recalculations and saved queries the evidence refers to. */
  state?: EvidenceState;
  /** Game date: questions still open after the final are pending points. */
  date?: IsoDate;
}

/** Reported points: status « constat » only (« clos » is a point settled with nothing to report, like « écarté »; the table of misstatements keeps the same findings). */
const reported = (f: Finding): boolean => f.status === 'finding';

function emptyMatch(f: Finding, outcome: FindingOutcome): FindingMatch {
  return { findingId: f.id, partId: null, partIds: [], falseLeadId: null, detected: false, quantified: false, treatmentOk: false, classificationOk: false, evidenceOk: false, naturesOk: false, outcome, basis: null, measure: null, expected: null, range: null, score: 0 };
}

function fromCandidate(c: Candidate, outcome: FindingOutcome, credited: boolean): FindingMatch {
  const f = c.profile.finding;
  const e = c.evals;
  const main = e[0]!;
  return {
    findingId: f.id,
    partId: c.parts[0]?.id ?? null,
    partIds: c.parts.map((p) => p.id),
    falseLeadId: c.lead?.id ?? null,
    detected: credited && c.parts.length > 0,
    quantified: credited && c.parts.length > 0 && e.every((x) => x.quantified),
    treatmentOk: c.parts.length > 0 && e.every((x) => x.treatmentOk),
    classificationOk: c.parts.length > 0 && main.classificationOk,
    evidenceOk: e.some((x) => x.evidenceOk),
    naturesOk: c.parts.length > 0 && e.some((x) => x.naturesOk),
    outcome,
    basis: main.basis,
    measure: main.measure,
    expected: main.expected,
    range: main.range,
    score: c.score,
  };
}

function byScore(a: Candidate, b: Candidate): number {
  return b.score - a.score || a.order - b.order || a.profile.index - b.profile.index;
}

function finalEndOf(params: Params): IsoDate {
  return params.game.calendar.find((p) => p.id === 'final')?.to ?? '9999-12-31';
}

/** Matching of every finding to the key (one-to-one), per finding, per part and per false lead. */
export function matchFindings(findings: readonly Finding[], input: MatchInput): MatchReport {
  const { params } = input;
  const { parts, leads } = matchTargets(input.key, input.documents, input.falseLeads);
  const trivial = trivialOf(params);
  const profiles = findings.map((f, i) => profileOf(f, i, input));
  const results = new Map<string, FindingMatch>();
  const cands = new Map<string, ReturnType<typeof candidatesOf>>();
  for (const p of profiles) cands.set(p.finding.id, candidatesOf(p, parts, leads, params));

  // --- reported findings: one-to-one assignment -----------------------------
  const pairs: Candidate[] = [];
  const top = new Map<string, number>();
  for (const p of profiles) {
    if (!reported(p.finding)) continue;
    const c = cands.get(p.finding.id)!;
    const list = c.real.length > 0 ? c.real : c.leads; // a real anomaly always wins over a false lead (see candidatesOf)
    for (const x of list) pairs.push(x);
    if (list.length) top.set(p.finding.id, Math.max(...list.map((x) => x.score)));
  }
  pairs.sort(byScore);
  const holder = new Map<string, string>(); // target id (part key or false lead id) → finding id
  const assigned = new Map<string, Candidate>(); // finding id → candidate credited
  const done = new Set<string>();
  for (const c of pairs) {
    const fid = c.profile.finding.id;
    if (done.has(fid)) continue;
    const ids = c.lead ? [c.lead.id] : c.parts.map((p) => p.id);
    const freeIdx = ids.map((id, i) => (holder.has(id) ? -1 : i)).filter((i) => i >= 0);
    if (freeIdx.length === ids.length) {
      for (const id of ids) holder.set(id, fid);
      done.add(fid);
      assigned.set(fid, c);
      if (c.lead) {
        const amount = c.profile.measures?.reclassified ?? 0;
        results.set(fid, fromCandidate(c, amount === 0 || amount > trivial ? 'falseLeadReported' : 'falseLeadTrivial', false));
      } else results.set(fid, fromCandidate(c, 'matched', true));
      continue;
    }
    if (c.score < (top.get(fid) ?? 0)) continue;
    // best target taken: another best target of the finding may still be free
    const otherFree = pairs.some((o) => o !== c && o.profile === c.profile && o.score === c.score && (o.lead ? !holder.has(o.lead.id) : o.parts.every((p) => !holder.has(p.id))));
    if (otherFree) continue;
    done.add(fid);
    if (!c.lead && freeIdx.length > 0) {
      // group partly credited to another finding: its free parts are detected, the amount (a sum) is not credited
      const sub: Candidate = { ...c, parts: freeIdx.map((i) => c.parts[i]!), evals: freeIdx.map((i) => ({ ...c.evals[i]!, quantified: false })) };
      for (const p of sub.parts) holder.set(p.id, fid);
      assigned.set(fid, sub);
      results.set(fid, fromCandidate(sub, 'matched', true));
      continue;
    }
    results.set(fid, { ...fromCandidate(c, 'duplicate', false), duplicateOf: holder.get(ids.find((id) => holder.has(id))!)! });
  }

  // --- other findings --------------------------------------------------------
  const pendingAfter = input.date !== undefined && input.date > finalEndOf(params);
  for (const p of profiles) {
    const f = p.finding;
    if (results.has(f.id)) continue;
    const c = cands.get(f.id)!;
    const bestReal = [...c.real].sort(byScore)[0];
    const bestLead = [...c.leads].sort(byScore)[0];
    if (reported(f)) {
      results.set(f.id, emptyMatch(f, 'falsePositive'));
      continue;
    }
    if (f.status === 'question') {
      const best = bestReal ?? bestLead;
      const m = best ? fromCandidate(best, 'question', false) : emptyMatch(f, 'question');
      results.set(f.id, pendingAfter ? { ...m, pending: true } : m);
      continue;
    }
    // dismissed or closed
    if (bestReal) results.set(f.id, fromCandidate(bestReal, 'dismissedAnomaly', false));
    else if (bestLead) results.set(f.id, fromCandidate(bestLead, bestLead.evals[0]!.evidenceOk ? 'falseLeadDismissed' : 'falseLeadDismissedWithoutEvidence', false));
    else results.set(f.id, emptyMatch(f, 'none'));
  }

  // --- per part, per false lead --------------------------------------------
  const ordered = findings.map((f) => results.get(f.id)!);
  const partMatches: PartMatch[] = parts.map((t) => {
    const fid = holder.get(t.id) ?? null;
    const c = fid ? assigned.get(fid) : undefined;
    const i = c && !c.lead ? c.parts.indexOf(t) : -1;
    const e = i >= 0 ? c!.evals[i]! : null;
    return {
      partId: t.id,
      anomalyId: t.anomalyId,
      findingId: e ? fid : null,
      detected: !!e,
      quantified: !!e && e.quantified,
      treatmentOk: !!e && e.treatmentOk,
      classificationOk: !!e && e.classificationOk,
      evidenceOk: !!e && e.evidenceOk,
      naturesOk: !!e && e.naturesOk,
      duplicates: ordered.filter((x) => x.outcome === 'duplicate' && x.partIds.includes(t.id)).map((x) => x.findingId),
      questions: ordered.filter((x) => x.outcome === 'question' && x.partIds.includes(t.id)).map((x) => x.findingId),
      dismissedBy: ordered.filter((x) => x.outcome === 'dismissedAnomaly' && x.partIds.includes(t.id)).map((x) => x.findingId),
    };
  });
  const leadMatches: FalseLeadMatch[] = leads.map((t) => {
    const related = ordered.filter((x) => x.falseLeadId === t.id);
    return {
      id: t.id,
      dismissedWithEvidence: related.some((x) => x.outcome === 'falseLeadDismissed'),
      reportedWrongly: related.some((x) => x.outcome === 'falseLeadReported'),
      reportedTrivial: related.some((x) => x.outcome === 'falseLeadTrivial'),
      findingIds: related.map((x) => x.findingId),
    };
  });
  return { findings: ordered, parts: partMatches, falseLeads: leadMatches, pending: ordered.filter((x) => x.pending).map((x) => x.findingId) };
}

/** Evaluation of one finding against every part and false lead (designer mode: why a finding matches or not). */
export function explainFinding(f: Finding, input: MatchInput): { target: string; evaluation: Evaluation }[] {
  const { parts, leads } = matchTargets(input.key, input.documents, input.falseLeads);
  const p = profileOf(f, 0, input);
  return [...parts.map((t) => ({ target: t.id, evaluation: evaluatePart(p, t, input.params) })), ...leads.map((t) => ({ target: t.id, evaluation: evaluateLead(p, t) }))];
}
