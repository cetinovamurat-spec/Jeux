/** Document requests (plan J4 §8, J4-6): delays, dates of the documents, status, cost, duplicates, catalogue. */
import { describe, expect, it } from 'vitest';
import { addWorkingDays, workCalendar } from '../../src/game/calendar';
import { initialGauges } from '../../src/game/gauges';
import { initialPlanning } from '../../src/game/planning';
import {
  answerDate,
  answeredRequests,
  arrivalDate,
  delayDays,
  familyOf,
  hoursCharged,
  initialRequests,
  interlocutorOf,
  isValidObject,
  lastReminder,
  notYetEstablishedText,
  receivedRequests,
  remindRequest,
  requestArrivals,
  requestKey,
  requestObjects,
  requestsSchema,
  requestStatus,
  sendRequest,
  upcomingRequests,
  type RequestItem,
} from '../../src/game/requests';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { CLOSING_FILES, REQUEST_FAMILIES } from '../../src/scenario/schemas/procedures';
import { params, world } from '../helpers/world';

const p = params();
const cal = workCalendar(p);
const item = (over: Partial<RequestItem> = {}): RequestItem => ({ id: 'req1', family: 'programme-components', object: 'LIL', sentOn: '2025-11-07', ...over });

function host(date = '2025-11-07') {
  return { requests: initialRequests(), clock: { date }, gauges: initialGauges(), journal: [] as { on: string; kind: string; ref?: string; data?: Record<string, string | number | boolean> }[], planning: initialPlanning(), findings: { items: [] as { cycle: string }[] } };
}

describe('catalogue', () => {
  it('declares every family of the contract between the lots, with an interlocutor of the client', () => {
    for (const f of REQUEST_FAMILIES) expect(familyOf(p, f), f).toBeDefined();
    for (const f of p.requests.families) expect(p.documents.people[f.interlocutor], f.id).toBeDefined();
  });
  it('the closing file offers one object per type of closing document of the contract', () => {
    const ds = world().world.datasets as unknown as ScenarioDatasets;
    const ids = requestObjects(p, ds, 'closing-file').map((o) => o.id);
    for (const id of CLOSING_FILES) expect(ids, id).toContain(id);
  });
  it('objects are built from the data (programmes, months, third parties)', () => {
    const ds = world().world.datasets as unknown as ScenarioDatasets;
    expect(requestObjects(p, ds, 'interim-extraction')).toEqual([{ id: '', label: p.requests.families.find((f) => f.id === 'interim-extraction')!.label }]);
    const comps = requestObjects(p, ds, 'programme-components').map((o) => o.id);
    expect(comps).toEqual(expect.arrayContaining(['ERA', 'PEU', 'GLB', 'TIL', 'LIL']));
    const rents = requestObjects(p, ds, 'programme-rent-roll').map((o) => o.id);
    expect(rents).toContain('CLF:2025-12');
    expect(rents).toContain('LIL:2024-12');
    expect(requestObjects(p, ds, 'bank-statements').map((o) => o.id)).toEqual(expect.arrayContaining(['2025-09', '2025-12', '2026-01', '2026-02']));
    expect(requestObjects(p, ds, 'supplier-tender').map((o) => o.id)).toContain('F0015');
    expect(requestObjects(p, ds, 'third-party-agreements').map((o) => o.id)).toEqual(expect.arrayContaining(['F0027', 'COTEAUX_SEREIN', 'ACCUEIL_HORIZONS']));
    expect(requestObjects(p, ds, 'sale-notary').map((o) => o.id)).toContain('CLF');
    expect(requestObjects(p, ds, 'entry-voucher')).toEqual([]);
  });
  it('never proposes the auditor’s firm, nor a tender file for purchases that no commission awards (statutory contributions, water, co-ownership charges, bank services)', () => {
    const ds = world().world.datasets as unknown as ScenarioDatasets;
    const firm = ds.thirdParties.find((t) => t.name === p.game.firmName)!;
    expect(firm).toBeDefined();
    for (const f of p.requests.families.filter((x) => x.parameter === 'thirdParty')) expect(requestObjects(p, ds, f.id).map((o) => o.id), f.id).not.toContain(firm.id);
    const tender = requestObjects(p, ds, 'supplier-tender').map((o) => o.id);
    // CGLLS and ANCOLS, the water distribution service, the bank, the syndic
    for (const id of ['F0028', 'F0029', 'F0002', 'F0040', 'F0045']) expect(tender, id).not.toContain(id);
    for (const id of ['F0022', 'F0026', 'F0030']) expect(tender, id).toContain(id);
    // the agreements are still asked from every third party of the client
    expect(requestObjects(p, ds, 'third-party-agreements').map((o) => o.id)).toEqual(expect.arrayContaining(['F0028', 'F0029', 'F0040', 'BANK1']));
  });
  it('validates the objects, FEC entries by their public number', () => {
    const ds = world().world.datasets as unknown as ScenarioDatasets;
    expect(isValidObject(p, ds, 'programme-components', 'ERA')).toBe(true);
    expect(isValidObject(p, ds, 'programme-components', 'XXX')).toBe(false);
    expect(isValidObject(p, ds, 'entry-voucher', '2025:OD000073')).toBe(true);
    expect(isValidObject(p, ds, 'entry-voucher', '2025:OD000073', () => false)).toBe(false);
    expect(isValidObject(p, ds, 'entry-voucher', 'OD000073')).toBe(false);
    expect(isValidObject(p, ds, 'no-such-family', '')).toBe(false);
  });
  it('the interlocutor of a closing document can differ from the family’s', () => {
    expect(interlocutorOf(p, 'closing-file', 'icne')).toBe('chiefAccountant');
    expect(interlocutorOf(p, 'closing-file', 'pge')).toBe('assetDirector');
    expect(interlocutorOf(p, 'closing-file', 'impairment')).toBe('rentManager');
    expect(interlocutorOf(p, 'programme-rent-roll', 'LIL:2025-01')).toBe('rentManager');
  });
});

describe('dates', () => {
  it('the interlocutor answers after its delay in working days of the game calendar, times the difficulty factor', () => {
    expect(delayDays(p, 'interim-extraction', '')).toBe(p.game.responseDelaysBusinessDays['chiefAccountant']);
    expect(delayDays(p, 'closing-file', 'pge')).toBe(p.game.responseDelaysBusinessDays['assetDirector']);
    expect(delayDays(p, 'closing-file', 'pge', 'manager')).toBe(Math.ceil(p.game.responseDelaysBusinessDays['assetDirector']! * p.game.difficulty.manager.responseDelayFactor));
    // Friday 07/11/2025 + 1 working day: Monday 10/11; + 2: Wednesday 12/11 (11/11 is a public holiday)
    expect(answerDate(p, cal, item({ family: 'interim-extraction', object: '' }))).toBe('2025-11-10');
    expect(answerDate(p, cal, item({ family: 'closing-file', object: 'subsidies' }))).toBe('2025-11-12');
  });
  it('a document is never handed over before its date: date of the document + delay', () => {
    const it0 = item();
    expect(arrivalDate(p, cal, it0, '2025-06-30')).toBe(answerDate(p, cal, it0));
    expect(arrivalDate(p, cal, it0, '2026-02-06')).toBe(addWorkingDays(cal, '2026-02-06', 1));
  });
  it('a document established between the request and the answer comes with the answer (max(envoi + délai, date de la pièce))', () => {
    // asset director (3 days): asked on Thursday 13/11/2025, answer due Tuesday 18/11; the plan is dated Saturday 15/11
    const pge = item({ family: 'closing-file', object: 'pge', sentOn: '2025-11-13' });
    expect(answerDate(p, cal, pge)).toBe('2025-11-18');
    expect(arrivalDate(p, cal, pge, '2025-11-15')).toBe('2025-11-18');
    expect(arrivalDate(p, cal, pge, '2025-11-18')).toBe('2025-11-18');
    const st = requestStatus(p, cal, pge, [{ id: 'ppe-officiel', date: '2025-11-15' }], '2025-11-18');
    expect(st.state).toBe('received');
    expect(st.received).toEqual([{ id: 'ppe-officiel', on: '2025-11-18' }]);
    expect(requestStatus(p, cal, pge, [{ id: 'ppe-officiel', date: '2025-11-15' }], '2025-11-19').canRemind).toBe(false);
    // established after the answer: its own date plus the delay
    expect(arrivalDate(p, cal, pge, '2025-11-19')).toBe(addWorkingDays(cal, '2025-11-19', 3));
  });
  it('answered keys: the family alone, or family:object', () => {
    const s = { items: [item({ family: 'interim-extraction', object: '' }), item({ id: 'req2' })] };
    expect([...answeredRequests(s, p, '2025-11-07')]).toEqual([]);
    expect([...answeredRequests(s, p, '2025-11-10')].sort()).toEqual(['interim-extraction', 'programme-components:LIL']);
    expect(requestKey('closing-file', 'icne')).toBe('closing-file:icne');
  });
  it('received keys: a reply « pas encore établi » does not count until a document arrives', () => {
    const s = { items: [item({ family: 'interim-extraction', object: '' }), item({ id: 'req2' })] };
    const docDates = (key: string) => (key === 'programme-components:LIL' ? ['2026-02-06'] : []);
    expect([...receivedRequests(s, p, '2025-11-10', docDates)]).toEqual(['interim-extraction']);
    expect([...receivedRequests(s, p, addWorkingDays(cal, '2026-02-06', 1), docDates)].sort()).toEqual(['interim-extraction', 'programme-components:LIL']);
    expect([...receivedRequests(s, p, '2025-11-10')].sort()).toEqual(['interim-extraction', 'programme-components:LIL']);
  });
  it('the earliest arrival over the requests of a key', () => {
    const s = { items: [item({ sentOn: '2026-02-23' }), item({ id: 'req2', sentOn: '2025-11-07' })] };
    expect(requestArrivals(s, p)('programme-components:LIL', '2025-06-30')).toBe('2025-11-10');
    expect(requestArrivals(s, p)('programme-components:ERA', '2025-06-30')).toBeNull();
    // a document established on the date of each request comes with the first answer; a version built for a request, with its answer
    expect(requestArrivals(s, p)('programme-components:LIL', null)).toBe('2025-11-10');
    expect(requestArrivals(s, p)('programme-components:LIL', '2026-02-23', '2026-02-23')).toBe(addWorkingDays(cal, '2026-02-23', 1));
    expect(requestArrivals(s, p)('programme-components:LIL', '2026-02-23', '2026-01-05')).toBeNull();
  });
});

describe('status of a request', () => {
  const it0 = item();
  const docs = [{ id: 'registre', date: '2026-02-06' }];
  it('waiting until the answer, then « pas encore établi » until the document exists, then received', () => {
    expect(requestStatus(p, cal, it0, docs, '2025-11-07').state).toBe('waiting');
    const early = requestStatus(p, cal, it0, docs, '2025-11-12');
    expect(early.state).toBe('notYetEstablished');
    expect(early.pending).toEqual([{ id: 'registre', establishedOn: '2026-02-06', servedOn: '2026-02-09' }]);
    expect(early.canRemind).toBe(true);
    const late = requestStatus(p, cal, it0, docs, '2026-02-09');
    expect(late.state).toBe('received');
    expect(late.received).toEqual([{ id: 'registre', on: '2026-02-09' }]);
    expect(late.canRemind).toBe(false);
    expect(requestStatus(p, cal, it0, [...docs, { id: 'old', date: '2025-01-01' }], '2025-11-12').state).toBe('partial');
  });
  it('the reply says when the document will exist', () => {
    expect(notYetEstablishedText('2026-02-06')).toBe('Pas encore établi, disponible à partir du 06/02/2026.');
  });
});

describe('actions', () => {
  it('sends a request: id, date, journal (no internal id, the label of the request)', () => {
    const s = sendRequest(host(), 'programme-components', 'ERA', p);
    expect(s.requests.items).toEqual([{ id: 'req1', family: 'programme-components', object: 'ERA', sentOn: '2025-11-07' }]);
    expect(s.journal).toEqual([{ on: '2025-11-07', kind: 'request', ref: 'programme-components:ERA', data: { title: 'Registre des composants d’un programme – Les Érables' } }]);
    expect(s.gauges.events).toEqual([]);
    expect(requestsSchema.parse(s.requests)).toEqual(s.requests);
    const s2 = sendRequest({ ...s, difficulty: 'manager' as const }, 'closing-file', 'icne', p);
    expect(s2.requests.items[1]).toMatchObject({ id: 'req2', difficulty: 'manager' });
  });
  it('a duplicate request is recorded as a gauge event for J5', () => {
    let s = sendRequest(host(), 'closing-file', 'icne', p);
    s = sendRequest(s, 'closing-file', 'icne', p);
    expect(s.requests.items).toHaveLength(2);
    expect(s.gauges.events).toEqual([{ on: '2025-11-07', gauge: 'clientRelation', reason: 'duplicateRequest', ref: 'closing-file:icne' }]);
  });
  it('asking again at a later phase of the engagement (updated documents) is not a duplicate', () => {
    let s = sendRequest(host('2025-11-04'), 'sale-notary', 'COQ', p);
    // off site after the interim: same phase as the interim, but not as the planning
    s = sendRequest({ ...s, clock: { date: '2025-11-25' } }, 'sale-notary', 'COQ', p);
    s = sendRequest({ ...s, clock: { date: '2025-11-18' } }, 'sale-notary', 'COQ', p);
    expect(s.gauges.events.map((e) => [e.on, e.reason])).toEqual([['2025-11-18', 'duplicateRequest']]);
    s = sendRequest({ ...s, clock: { date: '2026-02-23' } }, 'sale-notary', 'COQ', p);
    expect(s.gauges.events).toHaveLength(1);
    expect(s.requests.items.map((x) => x.sentOn)).toEqual(['2025-11-04', '2025-11-25', '2025-11-18', '2026-02-23']);
  });
  it('a request about a cycle assessed at low risk, without any finding, is recorded as unrelated', () => {
    const h = host();
    const low = { ...h, planning: { ...h.planning, risks: { fixedAssets: { level: 'low' as const, justification: '', on: '2025-11-05' } } } };
    expect(sendRequest(low, 'programme-components', 'ERA', p).gauges.events.map((e) => e.reason)).toEqual(['unrelatedRequest']);
    expect(sendRequest({ ...low, findings: { items: [{ cycle: 'fixedAssets' }] } }, 'programme-components', 'ERA', p).gauges.events).toEqual([]);
    expect(sendRequest(low, 'closing-file', 'icne', p).gauges.events).toEqual([]);
  });
  it('works on a host without gauges nor journal (generic over the state)', () => {
    const s = sendRequest({ requests: initialRequests(), clock: { date: '2025-11-07' } }, 'interim-extraction', '', p);
    expect(s.requests.items).toHaveLength(1);
  });
  it('reminder: journal and cost; the reply keeps its date', () => {
    let s = sendRequest(host(), 'programme-components', 'ERA', p);
    s = remindRequest({ ...s, clock: { date: '2025-11-20' } }, 'req1', p);
    expect(s.requests.items[0]!.reminders).toEqual(['2025-11-20']);
    expect(lastReminder(s.requests.items[0]!)).toBe('2025-11-20');
    expect(s.journal.at(-1)).toMatchObject({ kind: 'requestReminder', ref: 'programme-components:ERA' });
    expect(answerDate(p, cal, s.requests.items[0]!)).toBe(answerDate(p, cal, item({ object: 'ERA' })));
    expect(hoursCharged(s.requests, p)).toEqual([
      { member: 'senior', hours: p.requests.costHours.request, on: '2025-11-07' },
      { member: 'senior', hours: p.requests.costHours.reminder, on: '2025-11-20' },
    ]);
    expect(remindRequest(s, 'nope', p)).toBe(s);
    expect(requestsSchema.parse(s.requests)).toEqual(s.requests);
  });
  it('every reminder is charged, one a day at most', () => {
    let s = sendRequest(host(), 'closing-file', 'pge', p);
    for (const d of ['2025-11-20', '2025-11-21', '2025-11-21', '2025-11-24']) s = remindRequest({ ...s, clock: { date: d } }, 'req1', p);
    expect(s.requests.items[0]!.reminders).toEqual(['2025-11-20', '2025-11-21', '2025-11-24']);
    expect(s.journal.filter((j) => j.kind === 'requestReminder')).toHaveLength(3);
    expect(hoursCharged(s.requests, p).filter((h) => h.hours === p.requests.costHours.reminder).map((h) => h.on)).toEqual(['2025-11-20', '2025-11-21', '2025-11-24']);
  });
  it('a save holding the last reminder only (remindedOn) is read as a list of one', () => {
    const legacy = { items: [{ id: 'req1', family: 'closing-file', object: 'pge', sentOn: '2025-11-07', remindedOn: '2025-11-20' }, { id: 'req2', family: 'closing-file', object: 'icne', sentOn: '2025-11-07' }] };
    const read = requestsSchema.parse(legacy);
    expect(read.items).toEqual([
      { id: 'req1', family: 'closing-file', object: 'pge', sentOn: '2025-11-07', reminders: ['2025-11-20'] },
      { id: 'req2', family: 'closing-file', object: 'icne', sentOn: '2025-11-07' },
    ]);
    expect(Object.keys(read.items[1]!)).not.toContain('reminders');
    expect(hoursCharged(read, p)).toHaveLength(3);
  });
  it('a request costs a quarter of an hour of the senior', () => {
    expect(p.requests.costHours.request).toBe(0.25);
  });
});

describe('upcoming events', () => {
  it('announces the answer, and the documents served later when their dates are known', () => {
    const s = { items: [item()] };
    const base = { params: p, cal, date: '2025-11-07' };
    expect(upcomingRequests(s, base)).toEqual([{ date: '2025-11-10', kind: 'answer', label: expect.stringContaining('Registre des composants d’un programme – Les Lilas'), to: '/ged?onglet=demandes' }]);
    const withDocs = upcomingRequests(s, { ...base, requestDocDates: (k) => (k === 'programme-components:LIL' ? ['2026-02-06'] : []) });
    expect(withDocs.map((e) => e.date)).toEqual(['2025-11-10', '2026-02-09']);
    expect(withDocs[1]!.label).toContain('établie le 06/02/2026');
    expect(upcomingRequests(s, { ...base, date: '2025-11-10' })).toEqual([]);
  });
});

describe('numbers and low relation (plan J5 J5-18)', () => {
  it('numbers the request and its gauge event when the host counts its actions', () => {
    const h = { ...host(), seq: 7 };
    const s1 = sendRequest(h, 'programme-components', 'LIL', p);
    expect(s1.seq).toBe(8);
    expect(s1.requests.items[0]).toMatchObject({ id: 'req1', seq: 8 });
    const s2 = sendRequest(s1, 'programme-components', 'LIL', p);
    expect(s2.seq).toBe(9);
    expect(s2.gauges.events).toEqual([{ on: '2025-11-07', gauge: 'clientRelation', reason: 'duplicateRequest', ref: 'programme-components:LIL', seq: 9 }]);
    // a host without counter: nothing numbered
    expect(sendRequest(host(), 'programme-components', 'LIL', p).requests.items[0]!.seq).toBeUndefined();
  });

  it('lengthens the delays of a request sent while the client relation is low, fixed at the sending', () => {
    const low = sendRequest(host(), 'programme-components', 'LIL', p, { lowRelation: true }).requests.items[0]!;
    expect(low.lowRelation).toBe(true);
    const normal = item();
    const base = delayDays(p, 'programme-components', 'LIL');
    expect(delayDays(p, 'programme-components', 'LIL', 'senior', true)).toBe(Math.ceil(base * 1.5));
    expect(answerDate(p, cal, { ...normal, lowRelation: true })).toBe(addWorkingDays(cal, normal.sentOn, Math.ceil(base * 1.5)));
    expect(answerDate(p, cal, normal)).toBe(addWorkingDays(cal, normal.sentOn, base));
    // cumulated with the factor of the manager level
    const manager = p.game.difficulty.manager.responseDelayFactor;
    expect(delayDays(p, 'programme-components', 'LIL', 'manager', true)).toBe(Math.ceil(base * manager * 1.5 - 1e-9));
    // the flag is saved
    expect(requestsSchema.parse({ items: [low] }).items[0]!.lowRelation).toBe(true);
  });
});
