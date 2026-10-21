/**
 * Procedure library (params/procedures.json, plan J4 §7.4 and §7.5): hours
 * calibration, contract ids between the lots, coverage of the anomaly parts
 * by effective procedures executable when their evidence exists, planning
 * and cycles parameters.
 */
import { describe, expect, it } from 'vitest';
import { RECALC_TOOLS } from '../../src/game/recalcs';
import { POPULATIONS } from '../../src/game/samples';
import { PART_KEYS } from '../../src/scenario/anomalies/modules';
import { ANOMALY_IDS } from '../../src/scenario/anomalies/types';
import { loadParams } from '../../src/scenario/params';
import { CLOSING_FILES, CYCLE_IDS, MANDATORY_IDS, PHASE_IDS, type Condition, type ProcedureDef } from '../../src/scenario/schemas/procedures';
import { documents } from '../helpers/scenario';

const params = loadParams();
const lib = params.procedures;
const byId = new Map(lib.procedures.map((p) => [p.id, p]));
type Member = 'senior' | 'lea' | 'hugo' | 'sofia';

function cheapest(p: ProcedureDef): number {
  return Math.min(...Object.values(p.hours).filter((h): h is number => h !== undefined));
}

function hoursFor(p: ProcedureDef, m: Member): number | undefined {
  return p.hours[lib.profiles[m]];
}

/** Team hours (senior, Léa, Hugo) and Sofia's envelope of a programme. */
function programmeHours(items: readonly { procedureId: string; assignee: Member }[]): { team: number; sofia: number; byMember: Record<Member, number> } {
  const byMember: Record<Member, number> = { senior: 0, lea: 0, hugo: 0, sofia: 0 };
  for (const it of items) {
    const p = byId.get(it.procedureId);
    if (!p) throw new Error(`procédure inconnue ${it.procedureId}`);
    const h = hoursFor(p, it.assignee);
    if (h === undefined) throw new Error(`${it.procedureId} ne peut pas être confiée à ${it.assignee}`);
    byMember[it.assignee] += h;
  }
  return { team: byMember.senior + byMember.lea + byMember.hugo, sofia: byMember.sofia, byMember };
}

/**
 * Reference programme of the senior level (plan J4 §7.4): every anomaly part
 * is covered by an effective procedure, every mandatory diligence and every
 * response to management override is planned, within the 340 h budget.
 */
const REFERENCE: readonly { procedureId: string; assignee: Member }[] = [
  { procedureId: 'engagement-acceptance', assignee: 'senior' },
  { procedureId: 'permanent-file', assignee: 'senior' },
  { procedureId: 'board-minutes', assignee: 'senior' },
  { procedureId: 'preliminary-analytical', assignee: 'senior' },
  { procedureId: 'fraud-assessment', assignee: 'senior' },
  { procedureId: 'journal-entry-tests', assignee: 'senior' },
  { procedureId: 'retrospective-estimates', assignee: 'senior' },
  { procedureId: 'unusual-transactions', assignee: 'senior' },
  { procedureId: 'subsequent-events', assignee: 'senior' },
  { procedureId: 'representation-letter', assignee: 'senior' },
  { procedureId: 'comparative-check', assignee: 'hugo' },
  { procedureId: 'statements-ticking', assignee: 'hugo' },
  { procedureId: 'regulated-agreements', assignee: 'senior' },
  { procedureId: 'subledger-reconciliation', assignee: 'lea' },
  { procedureId: 'aged-balance', assignee: 'hugo' },
  { procedureId: 'impairment-recalc', assignee: 'senior' },
  { procedureId: 'charges-regularisation', assignee: 'lea' },
  { procedureId: 'additions-test', assignee: 'hugo' },
  { procedureId: 'depreciation-recalc', assignee: 'lea' },
  { procedureId: 'pge-review', assignee: 'senior' },
  { procedureId: 'litigation', assignee: 'senior' },
  { procedureId: 'icne-recalc', assignee: 'lea' },
  { procedureId: 'lender-confirmations', assignee: 'lea' },
  { procedureId: 'unrecorded-liabilities', assignee: 'hugo' },
  { procedureId: 'subsidies-receivable', assignee: 'lea' },
  { procedureId: 'annex-comparison', assignee: 'senior' },
  { procedureId: 'management-report', assignee: 'senior' },
];

describe('procedure library: hours calibration (plan J4 §7.4)', () => {
  it('has about sixty procedures in every cycle', () => {
    expect(lib.procedures.length).toBeGreaterThanOrEqual(55);
    expect(lib.procedures.length).toBeLessThanOrEqual(75);
    for (const c of CYCLE_IDS) expect(lib.procedures.some((p) => p.cycle === c), c).toBe(true);
  });

  it('costs about 450 h for the whole library at the cheapest profile (± 10 %)', () => {
    const total = lib.procedures.reduce((a, p) => a + cheapest(p), 0);
    expect(total).toBeGreaterThanOrEqual(405);
    expect(total).toBeLessThanOrEqual(495);
  });

  it('proposes a firm programme of about 380 h (± 10 %), assigned to allowed profiles, without the migration review and with a light review of the PGE', () => {
    const h = programmeHours(lib.firmProgramme2024 as { procedureId: string; assignee: Member }[]);
    expect(h.team).toBeGreaterThanOrEqual(342);
    expect(h.team).toBeLessThanOrEqual(418);
    const ids = new Set(lib.firmProgramme2024.map((f) => f.procedureId));
    expect(ids.size).toBe(lib.firmProgramme2024.length);
    expect(ids.has('migration-review')).toBe(false);
    expect(ids.has('pge-review')).toBe(false);
    expect(ids.has('pge-light')).toBe(true);
    // every mandatory diligence is in the firm's programme
    for (const p of lib.procedures.filter((x) => x.mandatory)) expect(ids.has(p.id), p.id).toBe(true);
  });

  it('allows a reference programme covering every anomaly part and every mandatory diligence within 340 h', () => {
    const h = programmeHours(REFERENCE);
    expect(h.team).toBeLessThanOrEqual(340);
    expect(h.sofia).toBeLessThanOrEqual(params.game.team.find((t) => t.id === 'sofia')!.hoursByDifficulty.senior);
    const planned = new Set(REFERENCE.map((r) => r.procedureId));
    const covered = new Set(REFERENCE.flatMap((r) => byId.get(r.procedureId)!.effectiveFor));
    for (const part of PART_KEYS) expect(covered.has(part), part).toBe(true);
    for (const p of lib.procedures.filter((x) => x.mandatory)) expect(planned.has(p.id), p.id).toBe(true);
    for (const id of params.planning.overrideResponses) expect(planned.has(id), id).toBe(true);
  });

  it('keeps each member within capacity in the reference programme (indicative budgets ± tolerance)', () => {
    const h = programmeHours(REFERENCE);
    const tol = 1 + params.game.overrunTolerancePct / 100;
    for (const m of ['senior', 'lea', 'hugo'] as const) expect(h.byMember[m], m).toBeLessThanOrEqual(params.game.team.find((t) => t.id === m)!.hoursByDifficulty.senior * tol);
  });

  it('has a senior who is never slower than the assistant, and an assistant never slower than the intern', () => {
    for (const p of lib.procedures) {
      if (p.hours.senior !== undefined && p.hours.assistant !== undefined) expect(p.hours.senior, p.id).toBeLessThanOrEqual(p.hours.assistant);
      if (p.hours.assistant !== undefined && p.hours.intern !== undefined) expect(p.hours.assistant, p.id).toBeLessThanOrEqual(p.hours.intern);
    }
  });
});

describe('procedure library: contract ids and references', () => {
  const families = params.requests.families as { id: string; parameter?: string; objects?: { id: string }[] }[];

  it('references only request families, objects, populations, tools and screens of the contract', () => {
    for (const p of lib.procedures) {
      const o = p.output;
      if (o.kind === 'requests')
        for (const r of o.requests) {
          // closing documents: the ids of the contract until the request catalogue exists, then those of the catalogue
          if (r.family === 'closing-file' && families.length === 0) expect(CLOSING_FILES as readonly string[], p.id).toContain(r.object);
          if (r.family === 'bank-statements') expect(r.object, p.id).toMatch(/^\d{4}-\d{2}$/);
          // once the request catalogue exists (lot C), the family and its fixed object must exist there
          if (families.length > 0) {
            const f = families.find((x) => x.id === r.family);
            expect(f, `${p.id} → ${r.family}`).toBeDefined();
            if (f?.objects && r.object) expect(f.objects.map((x) => x.id), `${p.id} → ${r.family}:${r.object}`).toContain(r.object);
          }
        }
    }
  });

  it('opens every recalculation tool and every sample population from a procedure of the library', () => {
    const tools = new Set(lib.procedures.flatMap((p) => (p.output.kind === 'recalc' ? [p.output.tool] : [])));
    const populations = new Set(lib.procedures.flatMap((p) => (p.output.kind === 'sample' ? [p.output.population] : [])));
    for (const t of RECALC_TOOLS) expect(tools.has(t), t).toBe(true);
    for (const x of POPULATIONS) expect(populations.has(x.id), x.id).toBe(true);
  });

  it('references existing anomaly parts, risks, phases, procedures and documents', () => {
    const parts = new Set(PART_KEYS);
    const revenue = new Set(params.planning.revenueTypes.map((r) => r.id));
    const laws = new Set(params.planning.lawsRegulations.map((l) => l.id));
    const assertions = new Set(params.planning.assertions.map((a) => a.id as string));
    const cycles = new Set<string>(CYCLE_IDS);
    const docs = new Set(documents().documents.map((d) => d.id));
    const periods = new Set(params.game.calendar.map((c) => c.id));
    for (const id of PHASE_IDS) expect(periods.has(id), id).toBe(true);
    const checkCondition = (c: Condition, where: string): void => {
      if (c.kind === 'document') expect(docs.has(c.docId), `${where} → ${c.docId}`).toBe(true);
      if (c.kind === 'procedure') expect(byId.has(c.procedureId), `${where} → ${c.procedureId}`).toBe(true);
      if (c.kind === 'period') for (const id of c.ids) expect(periods.has(id), where).toBe(true);
      if (c.kind === 'all' || c.kind === 'any') for (const x of c.of) checkCondition(x, where);
      if (c.kind === 'not') checkCondition(c.of, where);
    };
    for (const p of lib.procedures) {
      for (const part of p.effectiveFor) expect(parts.has(part), `${p.id} → ${part}`).toBe(true);
      for (const c of p.requires) checkCondition(c, p.id);
      for (const r of p.risksAddressed) {
        const [head, tail] = r.split(':') as [string, string | undefined];
        if (head === 'override') expect(tail, `${p.id} → ${r}`).toBeUndefined();
        else if (head === 'fraud') expect(revenue.has(tail ?? ''), `${p.id} → ${r}`).toBe(true);
        else if (head === 'laws') expect(laws.has(tail ?? ''), `${p.id} → ${r}`).toBe(true);
        else {
          expect(cycles.has(head), `${p.id} → ${r}`).toBe(true);
          if (tail !== undefined) expect(assertions.has(tail), `${p.id} → ${r}`).toBe(true);
        }
      }
    }
  });

  it('flags the mandatory diligences and the responses to management override', () => {
    for (const m of MANDATORY_IDS) expect(lib.procedures.filter((p) => p.mandatory === m).length, m).toBe(1);
    for (const id of params.planning.overrideResponses) expect(byId.get(id)?.overrideResponse, id).toBe(true);
    expect(lib.procedures.filter((p) => p.overrideResponse).map((p) => p.id).sort()).toEqual([...params.planning.overrideResponses].sort());
    // subsequent events: executable from 01/01/2026 and updated up to the signature
    const se = lib.procedures.find((p) => p.mandatory === 'subsequentEvents')!;
    expect(se.requires).toContainEqual({ kind: 'dateFrom', date: '2026-01-01' });
    expect(se.phases).toContain('reporting');
    expect(se.completion.some((c) => c.kind === 'updated')).toBe(true);
  });

  it('scripts the delegated variants T1 to T4 of J5 on four procedures, for a member allowed to run them', () => {
    const variants = lib.procedures.filter((p) => p.delegated).map((p) => p.delegated!.variant).sort();
    expect(variants).toEqual(['T1', 'T2', 'T3', 'T4']);
    for (const p of lib.procedures.filter((x) => x.delegated)) expect(hoursFor(p, p.delegated!.member), p.id).toBeDefined();
  });

  it('never names an anomaly, a programme of the case or an amount in the texts shown to the player', () => {
    const anomaly = new RegExp(`\\b(${ANOMALY_IDS.join('|')}|F[1-7]|T[1-4])\\b`);
    const programmes = params.programmes.map((p) => p.name).filter((n) => n.length > 4);
    for (const p of lib.procedures) {
      const text = [p.title, p.objective, ...p.steps].join(' ');
      expect(text, p.id).not.toMatch(anomaly);
      expect(text, p.id).not.toMatch(/\d[\d  ]*(?:,\d+)?\s?(?:€|k€|M€)/);
      for (const n of programmes) expect(text.includes(n), `${p.id} cite ${n}`).toBe(false);
    }
  });
});

describe('procedure library: effective procedures (plan J4 §7.5)', () => {
  /** Earliest date at which a document can be in the player's hands (conditional documents excluded: they depend on J5). */
  function earliest(d: ReturnType<typeof documents>['documents'][number]): string | null {
    const a = d.availability;
    switch (a.kind) {
      case 'initial':
      case 'onRequest':
        return d.date;
      case 'afterDate':
        return a.from;
      case 'confirmation':
        return a.arrives;
      case 'conditional':
        return null;
    }
  }

  it('gives every anomaly part an effective procedure executable in a phase where its evidence exists', () => {
    const docs = documents().documents;
    const periodEnd = new Map(params.game.calendar.map((c) => [c.id, c.to]));
    for (const part of PART_KEYS) {
      const anomaly = part.split('.')[0]!;
      const dates = docs
        .filter((d) => d.clues.some((c) => c.target === anomaly && (!c.parts || c.parts.includes(part))))
        .map(earliest)
        .filter((x): x is string => x !== null)
        .sort();
      expect(dates.length, `${part} : aucune pièce`).toBeGreaterThan(0);
      const first = dates[0]!;
      const procs = lib.procedures.filter((p) => p.effectiveFor.includes(part) && p.phases.some((ph) => (periodEnd.get(ph) ?? '') >= first));
      expect(procs.length, `${part} : aucune procédure efficace exécutable après le ${first}`).toBeGreaterThan(0);
    }
  });

  it('has about twenty-five productive procedures or more, and realistic procedures without any clue', () => {
    const productive = lib.procedures.filter((p) => p.effectiveFor.length > 0).length;
    expect(productive).toBeGreaterThanOrEqual(25);
    expect(lib.procedures.length - productive).toBeGreaterThanOrEqual(10);
  });
});

describe('planning and cycles parameters', () => {
  it('sets the materiality ranges of §4.7 on the recommended base', () => {
    const p = params.planning;
    const rents = p.bases.find((b) => b.id === p.reference.base)!;
    expect(rents.suitability).toBe('recommended');
    expect(rents.pctRange).toEqual(p.reference.pctRange);
    expect(p.thresholds.planningPctRange).toEqual([60, 75]);
    expect(p.thresholds.trivialPctRange).toEqual([3, 5]);
    expect(p.reference.planningPct).toBeGreaterThanOrEqual(60);
    expect(p.reference.planningPct).toBeLessThanOrEqual(75);
    for (const b of p.bases) expect(b.defaultPct, b.id).toBeGreaterThanOrEqual(b.pctRange[0]);
    for (const b of p.bases) expect(b.defaultPct, b.id).toBeLessThanOrEqual(b.pctRange[1]);
  });

  it('rebuts the fraud presumption on recurring rents only (reference answer)', () => {
    const rebuttable = params.planning.revenueTypes.filter((r) => r.reference === 'rebuttable').map((r) => r.id);
    expect(rebuttable).toEqual(['recurringRents']);
  });

  it('defines the eight cycles of the anomaly signatures, with statement lines that exist', () => {
    const lines = new Set(params.statements.map((l) => l.id));
    expect(params.cycles.cycles.map((c) => c.id).sort()).toEqual([...CYCLE_IDS].sort());
    for (const c of params.cycles.cycles) for (const l of c.statementLines) expect(lines.has(l), `${c.id} → ${l}`).toBe(true);
    for (const c of CYCLE_IDS) expect(params.planning.referenceRisks[c], c).toBeDefined();
  });
});
