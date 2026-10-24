/** Contracts of the interviews (plan J5 §5.6, §14): question and topic keys, ids of the records, data consulted. Pure. */
import { describe, expect, it } from 'vitest';
import { accountConsultedKey, consultedOn, fecEntryConsultedKey, markConsulted } from '../../src/game/consulted';
import {
  decodeNoteObject,
  encodeNoteObject,
  hoursCharged,
  interviewGaugeEvents,
  interviewNoteId,
  interviewNoteIds,
  isInterviewNoteId,
  parseQuestionKey,
  PERSON_IDS,
  questionKey,
  questionTopic,
  topicKey,
  type InterviewsState,
} from '../../src/game/interviews';
import { advanceTo } from '../../src/game/advance';
import { workCalendar } from '../../src/game/calendar';
import { initialState } from '../../src/game/state';
import { baseDocumentId, versionedId } from '../../src/scenario/documents';
import { loadParams } from '../../src/scenario/params';

const params = loadParams();

describe('question keys', () => {
  it('split on the first two « : » only: the object keeps its own', () => {
    expect(parseQuestionKey('chiefAccountant:entry:2025:OD000189')).toEqual({ person: 'chiefAccountant', family: 'entry', object: '2025:OD000189' });
    expect(parseQuestionKey('ceo:entity-overview')).toEqual({ person: 'ceo', family: 'entity-overview' });
    expect(parseQuestionKey('assetDirector:programme:PEU')).toEqual({ person: 'assetDirector', family: 'programme', object: 'PEU' });
    expect(parseQuestionKey('ceo')).toBeNull();
    expect(parseQuestionKey('ceo:')).toBeNull();
    expect(parseQuestionKey(':entry')).toBeNull();
  });

  it('round-trip: questionKey ∘ parseQuestionKey is the identity', () => {
    const keys = ['chiefAccountant:entry:2025:OD000189', 'ceo:entity-overview', 'cfo:document:ventes-coquelicots~2026-02-23', 'cfo:estimate:pge', 'rentManager:recovery', 'chairman:fraud-inquiry'];
    for (const k of keys) {
      const q = parseQuestionKey(k)!;
      expect(questionKey(q.person as (typeof PERSON_IDS)[number], q.family, q.object)).toBe(k);
    }
    expect(questionKey('cfo', 'litigation', '')).toBe('cfo:litigation');
  });

  it('give the topic of a question (family and object, common to the chain of people)', () => {
    expect(questionTopic('chiefAccountant:entry:2025:OD000189')).toBe('entry:2025:OD000189');
    expect(questionTopic('ceo:related-parties')).toBe('related-parties');
    expect(topicKey('programme', 'GLB')).toBe('programme:GLB');
    expect(topicKey('subsequent-events')).toBe('subsequent-events');
  });

  it('name the six people of the client who can be interviewed', () => {
    expect(PERSON_IDS).toEqual(['ceo', 'cfo', 'chiefAccountant', 'assetDirector', 'rentManager', 'chairman']);
  });
});

describe('records of the answers', () => {
  it('encode the object without « : » nor « ~ », reversibly', () => {
    for (const o of ['2025:OD000189', 'a_b:c~d__', 'PEU', '', '_c', '~:_']) {
      const e = encodeNoteObject(o);
      expect(e).not.toMatch(/[:~]/);
      expect(decodeNoteObject(e)).toBe(o);
    }
  });

  it('have the encoded base object in their id, the version (date of the session) last', () => {
    const id = interviewNoteId('chiefAccountant:entry:2025:OD000189', '2026-02-24');
    expect(id).toBe('entretien-chiefAccountant-entry-2025_cOD000189~2026-02-24');
    expect(id.match(/~/g)).toHaveLength(1);
    expect(id).not.toContain(':');
    expect(versionedId(baseDocumentId(id), '2026-02-24')).toBe(id);
    expect(isInterviewNoteId(id)).toBe(true);
    expect(isInterviewNoteId('pv-ca-2025-06')).toBe(false);
    // a family without object
    expect(interviewNoteId('ceo:entity-overview', '2025-11-04')).toBe('entretien-ceo-entity-overview~2025-11-04');
    // the document family: a later version of a document is the document itself
    expect(interviewNoteId('cfo:document:ventes-coquelicots~2026-02-23', '2026-02-25')).toBe(interviewNoteId('cfo:document:ventes-coquelicots', '2026-02-25'));
    // the object decodes back from the base id
    const base = baseDocumentId(id);
    expect(decodeNoteObject(base.slice('entretien-chiefAccountant-entry-'.length))).toBe('2025:OD000189');
    expect(() => interviewNoteId('invalide', '2026-02-24')).toThrow();
  });

  it('are derived from the sessions: answered questions, pieces that obtained a concession or revealed a fact', () => {
    const s: InterviewsState = {
      sessions: [
        {
          id: 'session1',
          seq: 1,
          person: 'assetDirector',
          on: '2026-02-24',
          audience: 'alone',
          closed: true,
          actions: [
            { kind: 'ask', seq: 2, question: 'assetDirector:programme:PEU', variant: 'partial' },
            { kind: 'ask', seq: 3, question: 'assetDirector:litigation', variant: 'redirect' },
            { kind: 'present', seq: 4, topic: 'programme:GLB', evidence: { kind: 'doc', docId: 'pv-ca-2025-06' }, outcome: 'reveal' },
            { kind: 'present', seq: 5, topic: 'programme:PEU', evidence: { kind: 'doc', docId: 'factures-peupliers' }, outcome: 'position' },
          ],
        },
      ],
    };
    expect([...interviewNoteIds(s)].sort()).toEqual([interviewNoteId('assetDirector:programme:GLB', '2026-02-24'), interviewNoteId('assetDirector:programme:PEU', '2026-02-24')].sort());
  });

  it('the providers of the interviews charge no hour and give no gauge event yet (bodies of J5b)', () => {
    const s = initialState(params);
    expect(hoursCharged(s.interviews, params)).toEqual([]);
    expect(interviewGaugeEvents(s, { params, cal: workCalendar(params) })).toEqual([]);
  });
});

describe('data consulted', () => {
  it('records the first opening of an account and of an entry, dated; the same state when already noted', () => {
    let s = advanceTo(initialState(params), '2025-11-05');
    s = markConsulted(s, accountConsultedKey('4687'));
    expect(s.consulted).toEqual({ 'acct:4687': '2025-11-05' });
    const later = advanceTo(s, '2026-02-24');
    expect(markConsulted(later, accountConsultedKey('4687'))).toBe(later);
    const both = markConsulted(later, fecEntryConsultedKey(2025, 'OD000189'));
    expect(both.consulted).toEqual({ 'acct:4687': '2025-11-05', 'fec:2025:OD000189': '2026-02-24' });
    expect(markConsulted(both, '')).toBe(both);
    // a clock moved back hides what was opened later
    expect(consultedOn(both, 'fec:2025:OD000189', '2025-12-01')).toBeUndefined();
    expect(consultedOn(both, 'acct:4687', '2025-12-01')).toBe('2025-11-05');
  });
});
