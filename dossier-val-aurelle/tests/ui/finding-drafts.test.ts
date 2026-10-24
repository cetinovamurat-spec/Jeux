/** Unsaved drafts of the finding form (Constats screen): what counts as a change, staleness, kept and dropped drafts. */
import { describe, expect, it } from 'vitest';
import { createFinding, draftOf, updateFinding, type FindingDraft } from '../../src/game/findings';
import { initialState, type GameState } from '../../src/game/state';
import { loadParams } from '../../src/scenario/params';
import { draftSignature, keptDraft, useFindingDrafts } from '../../src/ui/screens/findings/findingsStore';

const params = loadParams();
const EUR = 100;
const fresh = (date = '2026-02-24'): GameState => {
  const s = initialState(params);
  return { ...s, clock: { date, processedUntil: date } };
};

function draft(over: Partial<FindingDraft> = {}): FindingDraft {
  return {
    title: 'Honoraires non provisionnés',
    cycle: 'purchases',
    objects: [{ kind: 'account', id: '6281' }],
    natures: ['cutoff', 'completeness'],
    classification: 'factual',
    treatments: ['adjust'],
    proposedEntry: [
      { account: '6281', debit: 1_000 * EUR, credit: 0 },
      { account: '4081', debit: 0, credit: 1_000 * EUR },
    ],
    disclosureFix: null,
    evidence: [{ kind: 'doc', docId: 'facture-x' }],
    status: 'finding',
    comment: '',
    suspicion: false,
    ...over,
  };
}

describe('changes of the finding form', () => {
  it('ignores what is not saved: empty lines, a line with an account and no amount, the order of the natures, spaces around the title', () => {
    const d = draft();
    const same = draft({
      title: `  ${d.title} `,
      natures: ['completeness', 'cutoff'],
      proposedEntry: [...d.proposedEntry, { account: '', debit: 0, credit: 0 }, { account: '6064', debit: 0, credit: 0 }],
    });
    expect(draftSignature(same)).toBe(draftSignature(d));
  });

  it('counts an amount typed without its account, a negative amount, a comment, a status', () => {
    const d = draft();
    expect(draftSignature(draft({ proposedEntry: [...d.proposedEntry, { account: '', debit: 84_000 * EUR, credit: 0 }] }))).not.toBe(draftSignature(d));
    expect(draftSignature(draft({ proposedEntry: [{ account: '6281', debit: -1_000 * EUR, credit: 0 }, d.proposedEntry[1]!] }))).not.toBe(draftSignature(d));
    expect(draftSignature(draft({ comment: 'À revoir avec le manager' }))).not.toBe(draftSignature(d));
    expect(draftSignature(draft({ status: 'closed' }))).not.toBe(draftSignature(d));
  });

  it('a draft is no longer a change once saved (creation and update)', () => {
    const d = draft({ title: ' Honoraires ', proposedEntry: [...draft().proposedEntry, { account: '', debit: 0, credit: 0 }] });
    const [s1, id] = createFinding(fresh(), d, params);
    const saved = s1.findings.items.find((f) => f.id === id)!;
    expect(draftSignature(draftOf(saved))).toBe(draftSignature(d));
    const edited = { ...d, comment: 'Pièce reçue le 25/02', natures: ['completeness' as const] };
    const s2 = updateFinding(s1, id, edited, params);
    expect(draftSignature(draftOf(s2.findings.items.find((f) => f.id === id)!))).toBe(draftSignature(edited));
  });
});

describe('kept drafts', () => {
  const [s1, id] = createFinding(fresh(), draft(), params);
  const saved = s1.findings.items.find((f) => f.id === id)!;
  const edited = draft({ comment: 'Écriture à compléter' });

  it('are restored for the finding as saved when they were started, not once it has changed otherwise', () => {
    const drafts = { [id]: { draft: edited, base: saved }, new: { draft: draft({ title: 'Nouveau' }), base: null } };
    expect(keptDraft(drafts, id, saved)).toBe(edited);
    expect(keptDraft(drafts, id, { ...saved })).toBeUndefined();
    expect(keptDraft(drafts, 'new', undefined)?.title).toBe('Nouveau');
    expect(keptDraft(drafts, 'C99', undefined)).toBeUndefined();
  });

  it('are kept and dropped by key', () => {
    const { keep } = useFindingDrafts.getState();
    keep(id, { draft: edited, base: saved });
    keep('new', { draft: draft(), base: null });
    expect(Object.keys(useFindingDrafts.getState().drafts).sort()).toEqual([id, 'new'].sort());
    keep(id, null);
    expect(Object.keys(useFindingDrafts.getState().drafts)).toEqual(['new']);
    const before = useFindingDrafts.getState().drafts;
    keep(id, null);
    expect(useFindingDrafts.getState().drafts).toBe(before);
    keep('new', null);
    expect(useFindingDrafts.getState().drafts).toEqual({});
  });
});
