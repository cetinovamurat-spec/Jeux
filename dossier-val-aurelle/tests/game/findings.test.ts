/** Findings (plan J4 §13.1, J4-11): drafts from the context, checks of the form, actions, history, pending points, save. Pure rules. */
import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../../src/game/persistence';
import {
  captureQuestion,
  createFinding,
  deleteFinding,
  draftErrors,
  draftFromSeed,
  draftOf,
  draftWarnings,
  entryTotals,
  escalateFinding,
  evidenceKey,
  findingAmount,
  findingMagnitude,
  finalEnd,
  linkEvidence,
  meaningfulLines,
  pendingPoints,
  setFindingStatus,
  uniqueEvidence,
  updateFinding,
  type FindingDraft,
} from '../../src/game/findings';
import { overrunJustified } from '../../src/game/program';
import { initialState, type GameState } from '../../src/game/state';
import { loadParams } from '../../src/scenario/params';

const params = loadParams();
const EUR = 100;
const fresh = (date = '2026-02-24'): GameState => {
  const s = initialState(params);
  return { ...s, clock: { date, processedUntil: date } };
};
const accounts = new Set(['7088', '4687', '68174', '4915', '1651', '6281', '4081']);
const ctx = { params, accounts };

function draft(over: Partial<FindingDraft> = {}): FindingDraft {
  return {
    title: 'Produit à recevoir sans pièce',
    cycle: 'crossCycle',
    objects: [{ kind: 'account', id: '4687' }],
    natures: ['occurrence'],
    classification: 'factual',
    treatments: ['adjust'],
    proposedEntry: [
      { account: '7088', debit: 300_000 * EUR, credit: 0 },
      { account: '4687', debit: 0, credit: 300_000 * EUR },
    ],
    disclosureFix: null,
    evidence: [{ kind: 'fec', year: 2025, num: 'OD000189' }],
    status: 'finding',
    comment: '',
    suspicion: false,
    ...over,
  };
}

describe('draft from the context of a button', () => {
  it('keeps a known cycle, the known kinds of objects (three at most), the evidence without duplicates and the amount noted', () => {
    const d = draftFromSeed(
      {
        cycle: 'rentReceivables',
        objects: [
          { kind: 'thirdParty', id: 'ACCUEIL_HORIZONS' },
          { kind: 'thirdParty', id: 'ACCUEIL_HORIZONS' },
          { kind: 'unknown', id: 'x' },
          { kind: 'programme', id: 'PHA' },
          { kind: 'account', id: '4114' },
          { kind: 'document', id: 'courrier-mandataire' },
        ],
        evidence: [{ kind: 'confirmation', id: 'ACCUEIL_HORIZONS' }, { kind: 'confirmation', id: 'ACCUEIL_HORIZONS' }, { kind: 'doc', docId: 'a', block: 2 }],
        amount: -123_45,
        label: '  Sans réponse ',
      },
      params,
    );
    expect(d.cycle).toBe('rentReceivables');
    expect(d.objects).toEqual([
      { kind: 'thirdParty', id: 'ACCUEIL_HORIZONS' },
      { kind: 'programme', id: 'PHA' },
      { kind: 'account', id: '4114' },
    ]);
    expect(d.evidence).toHaveLength(2);
    expect(d.contextAmount).toBe(123_45);
    expect(d.title).toBe('Sans réponse');
    expect(d.status).toBe('finding');
    expect(draftFromSeed({ cycle: 'nonsense' }, params).cycle).toBe('crossCycle');
  });

  it('a finding created from a sample drawn at random is projected; from specific items it is factual', () => {
    const samples = { items: [{ id: 'S1', method: 'random' }, { id: 'S2', method: 'specific' }] };
    expect(draftFromSeed({ evidence: [{ kind: 'sample', id: 'S1' }] }, params, 'finding', samples).classification).toBe('projected');
    expect(draftFromSeed({ evidence: [{ kind: 'sample', id: 'S2' }] }, params, 'finding', samples).classification).toBe('factual');
    expect(draftFromSeed({ evidence: [{ kind: 'sample', id: 'S9' }] }, params, 'finding', samples).classification).toBe('factual');
  });
});

describe('checks of the form', () => {
  it('accepts a balanced entry on accounts of the chart', () => {
    expect(draftErrors(draft(), ctx)).toEqual([]);
    expect(entryTotals(draft().proposedEntry)).toEqual({ debit: 300_000 * EUR, credit: 300_000 * EUR, balanced: true });
    expect(findingAmount(draft())).toBe(300_000 * EUR);
  });

  it('refuses an unbalanced entry, an unknown account, a single line, a line both debited and credited', () => {
    expect(draftErrors(draft({ proposedEntry: [{ account: '7088', debit: 10, credit: 0 }, { account: '4687', debit: 0, credit: 9 }] }), ctx).join(' ')).toMatch(/équilibrée/);
    expect(draftErrors(draft({ proposedEntry: [{ account: '9999', debit: 10, credit: 0 }, { account: '4687', debit: 0, credit: 10 }] }), ctx).join(' ')).toMatch(/9999/);
    expect(draftErrors(draft({ proposedEntry: [{ account: '7088', debit: 10, credit: 0 }] }), ctx).join(' ')).toMatch(/au moins une ligne/);
    expect(draftErrors(draft({ proposedEntry: [{ account: '7088', debit: 10, credit: 10 }, { account: '4687', debit: 0, credit: 0 }] }), ctx).join(' ')).toMatch(/à la fois/);
    // empty lines of the form are ignored
    expect(draftErrors(draft({ proposedEntry: [...draft().proposedEntry, { account: '', debit: 0, credit: 0 }] }), ctx)).toEqual([]);
  });

  it('reports a line with an amount and no account (it would be dropped on saving) and refuses a negative amount', () => {
    const lines = [
      { account: '6281', debit: 100_000 * EUR, credit: 0 },
      { account: '', debit: 84_000 * EUR, credit: 0 },
      { account: '4081', debit: 0, credit: 100_000 * EUR },
      { account: '', debit: 0, credit: 84_000 * EUR },
    ];
    expect(draftErrors(draft({ proposedEntry: lines }), ctx)).toEqual(['Ligne 2 : compte manquant.', 'Ligne 4 : compte manquant.']);
    // what is saved and matched, and what the form totals
    expect(entryTotals(meaningfulLines(lines))).toEqual({ debit: 100_000 * EUR, credit: 100_000 * EUR, balanced: true });
    expect(draftErrors(draft({ proposedEntry: [{ account: '', debit: -100, credit: 0 }] }), ctx)).toContain('Ligne 1 : compte manquant.');
    const negative = draftErrors(draft({ proposedEntry: [{ account: '7088', debit: -100, credit: 0 }, { account: '4687', debit: 0, credit: -100 }] }), ctx);
    expect(negative).toEqual(['Montant invalide sur le compte 7088.', 'Montant invalide sur le compte 4687.']);
  });

  it('limits objects and natures, requires a treatment for a « constat » and a fix compatible with the treatments', () => {
    const four = [1, 2, 3, 4].map((i) => ({ kind: 'programme' as const, id: `P${i}` }));
    expect(draftErrors(draft({ objects: four }), ctx).join(' ')).toMatch(/objets au plus/);
    expect(draftErrors(draft({ natures: ['occurrence', 'cutoff', 'valuation'] }), ctx).join(' ')).toMatch(/natures au plus/);
    expect(draftErrors(draft({ treatments: [] }), ctx).join(' ')).toMatch(/traitement/);
    expect(draftErrors(draft({ treatments: [], status: 'question' }), ctx)).toEqual([]);
    expect(draftErrors(draft({ disclosureFix: 'special-report' }), ctx).join(' ')).toMatch(/correction d’information/);
    expect(draftErrors(draft({ treatments: ['specialReport'], disclosureFix: 'special-report', proposedEntry: [] }), ctx)).toEqual([]);
    expect(draftErrors(draft({ cycle: 'x' }), ctx).join(' ')).toMatch(/cycle/);
  });

  it('warns (without blocking) about an unquantified or undocumented finding', () => {
    const w = draftWarnings(draft({ proposedEntry: [], evidence: [], objects: [], treatments: ['adjust', 'disclose'] }));
    expect(w).toHaveLength(4);
    expect(draftWarnings(draft())).toEqual([]);
    expect(draftWarnings(draft({ status: 'question', evidence: [] }))).toEqual([]);
  });
});

describe('actions', () => {
  it('creates a finding with its dated history and logs it; the id comes from the state counter', () => {
    const [s, id] = createFinding(fresh(), draft(), params);
    expect(id).toBe('C1');
    const f = s.findings.items[0]!;
    expect(f).toMatchObject({ id: 'C1', status: 'finding', createdOn: '2026-02-24', escalatedToPartnerOn: null, history: [{ on: '2026-02-24', status: 'finding' }] });
    expect(s.journal.at(-1)).toMatchObject({ kind: 'finding', ref: 'C1', data: { action: 'create', status: 'finding' } });
    expect(String(s.journal.at(-1)!.data!['title'])).toMatch(/^C1 – Produit à recevoir sans pièce/);
  });

  it('captures a question in one click from the context', () => {
    const [s, id] = captureQuestion(fresh('2025-11-05'), { cycle: 'fixedAssets', objects: [{ kind: 'programme', id: 'TIL' }], evidence: [{ kind: 'doc', docId: 'fiche-operation-tilleuls', block: 3 }], label: 'Opération livrée ?' }, params);
    expect(s.findings.items[0]).toMatchObject({ id, status: 'question', cycle: 'fixedAssets', title: 'Opération livrée ?', treatments: [], proposedEntry: [] });
  });

  it('updates the finding; a change of status is dated in the history', () => {
    let [s, id] = createFinding(fresh(), draft({ status: 'question' }), params);
    s = { ...s, clock: { date: '2026-03-02', processedUntil: '2026-03-02' } };
    s = updateFinding(s, id, { ...draftOf(s.findings.items[0]!), comment: 'Vu avec la DAF' }, params);
    expect(s.findings.items[0]!.history).toHaveLength(1);
    expect(s.findings.items[0]!.updatedOn).toBe('2026-03-02');
    s = updateFinding(s, id, { ...draftOf(s.findings.items[0]!), status: 'finding' }, params);
    expect(s.findings.items[0]!.history).toEqual([
      { on: '2026-02-24', status: 'question', magnitude: 0, suspicion: false },
      { on: '2026-03-02', status: 'finding', magnitude: 0, suspicion: false },
    ]);
    s = setFindingStatus(s, id, 'dismissed');
    expect(s.findings.items[0]!.history.at(-1)).toEqual({ on: '2026-03-02', status: 'dismissed', magnitude: 0, suspicion: false });
    expect(setFindingStatus(s, id, 'dismissed')).toBe(s);
    expect(updateFinding(s, 'nope', draft(), params)).toBe(s);
  });

  it('escalates to the partner once (dated), links evidence without duplicates, deletes', () => {
    let [s, id] = createFinding(fresh(), draft(), params);
    s = escalateFinding(s, id);
    expect(s.findings.items[0]!.escalatedToPartnerOn).toBe('2026-02-24');
    const later = { ...s, clock: { date: '2026-03-05', processedUntil: '2026-03-05' } };
    expect(escalateFinding(later, id)).toBe(later);
    s = linkEvidence(s, id, { kind: 'doc', docId: 'conventions-gestionnaires-foyers' });
    expect(linkEvidence(s, id, { kind: 'doc', docId: 'conventions-gestionnaires-foyers' })).toBe(s);
    expect(s.findings.items[0]!.evidence.map(evidenceKey)).toEqual(['fec:2025:OD000189', 'doc:conventions-gestionnaires-foyers']);
    s = deleteFinding(s, id);
    expect(s.findings.items).toEqual([]);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'finding', data: { action: 'delete' } });
  });

  it('evidence keys distinguish blocks, entries and other references', () => {
    expect(uniqueEvidence([{ kind: 'doc', docId: 'a' }, { kind: 'doc', docId: 'a', block: 1 }, { kind: 'doc', docId: 'a' }, { kind: 'sample', id: 'S1' }, { kind: 'recalc', id: 'S1' }])).toHaveLength(4);
  });

  it('an open finding of a cycle at least equal to the planning materiality justifies an overrun (J4-4, read by the programme)', () => {
    const [s] = createFinding(fresh(), draft({ cycle: 'crossCycle' }), params);
    const withMateriality: GameState = { ...s, planning: { ...s.planning, materiality: [{ base: 'rents', vintage: 'draft2025', baseAmount: 0, pct: 1.25, amount: 400_000 * EUR, planningPct: 65, trivialPct: 5, specificPct: null, factors: [], comment: '', on: '2026-02-24' }] } };
    expect(overrunJustified(withMateriality, 'crossCycle')).toBe(true);
    expect(overrunJustified(withMateriality, 'purchases')).toBe(false);
  });
});

describe('end of the final and save', () => {
  it('questions still open after the final are pending points', () => {
    let [s] = createFinding(fresh(), draft({ status: 'question' }), params);
    [s] = createFinding(s, draft(), params);
    expect(pendingPoints(s.findings.items, params, finalEnd(params))).toEqual([]);
    expect(pendingPoints(s.findings.items, params, '2026-03-16').map((f) => f.id)).toEqual(['C1']);
  });

  it('the findings survive a save and a reload; an old item without title or updatedOn loads', () => {
    let [s, id] = createFinding(fresh(), draft(), params);
    s = escalateFinding(s, id);
    const r = deserialize(serialize(s), initialState(params));
    expect(r.ok && r.state.findings).toEqual(s.findings);
    const raw = JSON.parse(serialize(s));
    delete raw.findings.items[0].title;
    const r2 = deserialize(JSON.stringify(raw), initialState(params));
    expect(r2.ok && r2.state.findings.items[0]!.title).toBe('');
  });
});

describe('findings: suspicion, pieces, magnitude and escalation snapshot (plan J5 §10.3)', () => {
  it('note the magnitude given by the caller and the flag in the history, an entry when one of them changes', () => {
    let [s, id] = createFinding(fresh(), draft({ status: 'question', evidence: [] }), params, 300_000 * EUR);
    expect(s.findings.items[0]!.history).toEqual([{ on: '2026-02-24', status: 'question', magnitude: 300_000 * EUR, suspicion: false }]);
    expect(s.findings.items[0]!.suspicion).toBe(false);
    s = { ...s, clock: { date: '2026-03-02', processedUntil: '2026-03-02' } };
    // same status, magnitude and flag: no entry
    s = updateFinding(s, id, draftOf(s.findings.items[0]!), params, 300_000 * EUR);
    expect(s.findings.items[0]!.history).toHaveLength(1);
    s = updateFinding(s, id, { ...draftOf(s.findings.items[0]!), suspicion: true }, params, 300_000 * EUR);
    s = updateFinding(s, id, draftOf(s.findings.items[0]!), params, 450_000 * EUR);
    expect(s.findings.items[0]!.history.slice(1)).toEqual([
      { on: '2026-03-02', status: 'question', magnitude: 300_000 * EUR, suspicion: true },
      { on: '2026-03-02', status: 'question', magnitude: 450_000 * EUR, suspicion: true },
    ]);
    expect(s.findings.items[0]!.suspicion).toBe(true);
  });

  it('date the linking of the first and the second pieces, kept when a piece is unlinked', () => {
    let [s, id] = createFinding(fresh(), draft({ evidence: [] }), params);
    expect(s.findings.items[0]!.piecesOn).toBeUndefined();
    s = linkEvidence({ ...s, clock: { date: '2026-02-25', processedUntil: '2026-02-25' } }, id, { kind: 'doc', docId: 'a' });
    s = linkEvidence({ ...s, clock: { date: '2026-02-27', processedUntil: '2026-02-27' } }, id, { kind: 'fec', year: 2025, num: 'OD000189' });
    s = linkEvidence({ ...s, clock: { date: '2026-03-02', processedUntil: '2026-03-02' } }, id, { kind: 'doc', docId: 'b' });
    expect(s.findings.items[0]!.piecesOn).toEqual(['2026-02-25', '2026-02-27']);
    s = updateFinding(s, id, { ...draftOf(s.findings.items[0]!), evidence: [] }, params);
    expect(s.findings.items[0]!.piecesOn).toEqual(['2026-02-25', '2026-02-27']);
    // created with two pieces: both dated at the creation
    const [two] = createFinding(fresh(), draft({ evidence: [{ kind: 'doc', docId: 'a' }, { kind: 'doc', docId: 'b' }] }), params);
    expect(two.findings.items[0]!.piecesOn).toEqual(['2026-02-24', '2026-02-24']);
  });

  it('freeze at the escalation what the partner was told, numbered; acting afterwards does not change it', () => {
    let [s, id] = createFinding(fresh(), draft({ suspicion: true }), params, 300_000 * EUR);
    s = escalateFinding(s, id, 300_000 * EUR);
    const snap = s.findings.items[0]!.escalation!;
    expect(snap).toEqual({ on: '2026-02-24', seq: s.seq, evidence: s.findings.items[0]!.evidence, magnitude: 300_000 * EUR, status: 'finding', hasEntry: true, suspicion: true });
    expect(snap.evidence).toHaveLength(1);
    expect(s.findings.items[0]!.escalatedToPartnerOn).toBe('2026-02-24');
    expect(escalateFinding(s, id, 1)).toBe(s);
    s = updateFinding(s, id, { ...draftOf(s.findings.items[0]!), evidence: [], status: 'dismissed', proposedEntry: [], suspicion: false }, params, 0);
    expect(s.findings.items[0]!.escalation).toEqual(snap);
    const r = deserialize(serialize(s), initialState(params));
    expect(r.ok && r.state.findings.items[0]!.escalation).toEqual(snap);
  });

  it('measure the magnitude of a proposed entry on the result, the equity and the lines of the balance sheet', () => {
    expect(findingMagnitude(null, params)).toBe(0);
    expect(findingMagnitude({ result: -120, equity: 80, lines: { A_DISPO: 500, CR_ENTRETIEN: 9_000 } }, params)).toBe(500);
    expect(findingMagnitude({ result: -1_200, equity: 80, lines: { A_DISPO: 500 } }, params)).toBe(1_200);
  });
});
