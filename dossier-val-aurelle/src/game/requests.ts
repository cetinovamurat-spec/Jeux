/**
 * Document requests (plan J4 §8, J4-6): parametric requests (family × object
 * of params/requests.json) sent to an interlocutor of the client, reminders.
 * Only the decisions are stored (what, when); everything that arrives is
 * derived from the date: the interlocutor answers after its delay (working
 * days of the game calendar, times the difficulty factor), and a document is
 * never handed over before it exists — before its date the reply is « pas
 * encore établi », and the document is served automatically at its date plus
 * the delay. Section of the game state owned by J4c.
 */
import { z } from 'zod';
import { formatDateFr, type IsoDate } from '../engine/dates';
import type { ScenarioDatasets } from '../scenario/datasets';
import { requestKey } from '../scenario/documents/model';
import { programmeLabel, requestLabel } from '../scenario/documents/request-labels';
import { loadParams, type Params } from '../scenario/params';
import type { RequestFamily } from '../scenario/schemas/requests';
import type { UpcomingContext, UpcomingEvent } from './advance';
import type { HoursCharge } from './budget';
import { addWorkingDays, workCalendar, type WorkCalendar } from './calendar';
import { recordGaugeEvent, type GaugesState } from './gauges';

export type RequestDifficulty = 'assistant' | 'senior' | 'manager';

export interface RequestItem {
  id: string;
  /** Request family (params/requests.json). */
  family: string;
  /** Object of the request (programme, third party, 'YYYY:EcritureNum', month…), '' when the family has none. */
  object: string;
  sentOn: IsoDate;
  /** Last reminder. */
  remindedOn?: IsoDate;
  /** Difficulty of the game when the request was sent (delay factor of the interlocutors). */
  difficulty?: RequestDifficulty;
}

export interface RequestsState {
  items: RequestItem[];
}

export function initialRequests(): RequestsState {
  return { items: [] };
}

export const requestsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      family: z.string(),
      object: z.string(),
      sentOn: z.string(),
      remindedOn: z.string().optional(),
      difficulty: z.enum(['assistant', 'senior', 'manager']).optional(),
    }),
  ),
});

export { requestKey };

// ---------------------------------------------------------------------------
// catalogue: families, interlocutors, delays
// ---------------------------------------------------------------------------

export function familyOf(params: Params, id: string): RequestFamily | undefined {
  return params.requests.families.find((f) => f.id === id);
}

/** Person of the client who answers the request (params.documents.people key). */
export function interlocutorOf(params: Params, family: string, object: string): string {
  const f = familyOf(params, family);
  return f?.objects?.find((o) => o.id === object)?.interlocutor ?? f?.interlocutor ?? 'chiefAccountant';
}

/** Delay of the interlocutor in working days (§10.2), times the difficulty factor (§10.9), rounded up. */
export function delayDays(params: Params, family: string, object: string, difficulty: RequestDifficulty = 'senior'): number {
  const base = params.game.responseDelaysBusinessDays[interlocutorOf(params, family, object)] ?? 1;
  const factor = params.game.difficulty[difficulty].responseDelayFactor;
  return Math.ceil(base * factor - 1e-9);
}

/** Date the interlocutor answers the request (« réponse attendue le »). */
export function answerDate(params: Params, cal: WorkCalendar, item: RequestItem): IsoDate {
  return addWorkingDays(cal, item.sentOn, delayDays(params, item.family, item.object, item.difficulty));
}

/**
 * Date a document dated `docDate` answering the request reaches the auditor:
 * the interlocutor's delay counted from the request, or from the date of the
 * document when it does not exist yet.
 */
export function arrivalDate(params: Params, cal: WorkCalendar, item: RequestItem, docDate: IsoDate): IsoDate {
  return addWorkingDays(cal, docDate > item.sentOn ? docDate : item.sentOn, delayDays(params, item.family, item.object, item.difficulty));
}

/**
 * Keys of the requests answered at the date (`family` or `family:object`):
 * the interlocutor has replied (with the documents that exist, or « pas
 * encore établi »). Read by the data vintages (interim extraction).
 */
export function answeredRequests(s: RequestsState, params: Params, date: IsoDate): ReadonlySet<string> {
  const cal = workCalendar(params);
  const out = new Set<string>();
  for (const it of s.items) if (answerDate(params, cal, it) <= date) out.add(requestKey(it.family, it.object));
  return out;
}

/**
 * Arrival of the reply to a request key for a document dated `docDate`
 * (earliest over the requests of that key), or null when it was never asked.
 */
export function requestArrivals(s: RequestsState, params: Params): (key: string, docDate: IsoDate) => IsoDate | null {
  const cal = workCalendar(params);
  const byKey = new Map<string, RequestItem[]>();
  for (const it of s.items) {
    const k = requestKey(it.family, it.object);
    byKey.set(k, [...(byKey.get(k) ?? []), it]);
  }
  return (key, docDate) => {
    let best: IsoDate | null = null;
    for (const it of byKey.get(key) ?? []) {
      const d = arrivalDate(params, cal, it, docDate);
      if (best === null || d < best) best = d;
    }
    return best;
  };
}

// ---------------------------------------------------------------------------
// objects that can be requested (built from the data)
// ---------------------------------------------------------------------------

export interface RequestObject {
  id: string;
  label: string;
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (;;) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    if (k > to) break;
    out.push(k);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthText = (m: string) => `${MONTHS_FR[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function programmeIds(params: Params, ds: ScenarioDatasets, filter: RequestFamily['programmeFilter']): string[] {
  const all = params.programmes.map((p) => p.id);
  switch (filter) {
    case 'invoices': {
      const ids = new Set<string>();
      for (const i of ds.invoices) if (i.invoiceDate.startsWith('2025')) for (const l of i.lines) if (l.programmeId) ids.add(l.programmeId);
      return [...all.filter((id) => ids.has(id)), ...[...ids].filter((id) => !all.includes(id)).sort()];
    }
    case 'operations': {
      const ids = new Set(ds.operations.filter((o) => o.year >= 2024 && o.kind !== 'acquisition').map((o) => o.programmeId));
      return [...all.filter((id) => ids.has(id)), ...[...ids].filter((id) => !all.includes(id)).sort()];
    }
    case 'sales': {
      const ids = new Set(ds.sales.filter((s) => s.deedDate >= '2025-01-01' || s.promiseDate >= '2025-01-01').map((s) => s.programmeId));
      return all.filter((id) => ids.has(id));
    }
    case 'components':
      return [...all, ...(ds.components.some((c) => c.programmeId === 'SIE') ? ['SIE'] : [])];
    case 'rentRoll':
      return params.programmes.filter((p) => p.kind === 'family').map((p) => p.id);
    default:
      return all;
  }
}

/** Objects the player can choose for a family (none for the FEC entries, typed or chosen from the FEC). */
export function requestObjects(params: Params, ds: ScenarioDatasets, family: string): RequestObject[] {
  const f = familyOf(params, family);
  if (!f) return [];
  switch (f.parameter) {
    case 'none':
      return [{ id: '', label: f.label }];
    case 'programme':
      return programmeIds(params, ds, f.programmeFilter).map((id) => ({ id, label: programmeLabel(params, id) }));
    case 'programmeMonth': {
      const months = f.months ? monthsBetween(f.months.from, f.months.to) : [];
      return programmeIds(params, ds, f.programmeFilter).flatMap((id) => months.map((m) => ({ id: `${id}:${m}`, label: `${programmeLabel(params, id)}, ${monthText(m)}` })));
    }
    case 'month':
      return (f.months ? monthsBetween(f.months.from, f.months.to) : []).map((m) => ({ id: m, label: monthText(m) }));
    case 'closingDoc':
      return (f.objects ?? []).map((o) => ({ id: o.id, label: o.label }));
    case 'thirdParty': {
      const kinds = new Set(f.thirdPartyKinds ?? []);
      let tps = ds.thirdParties.filter((t) => kinds.size === 0 || kinds.has(t.kind));
      if (family === 'supplier-tender') {
        const invoiced = new Set(ds.invoices.filter((i) => i.invoiceDate >= '2024-01-01').map((i) => i.supplierId));
        tps = tps.filter((t) => invoiced.has(t.id));
      }
      return tps.map((t) => ({ id: t.id, label: t.name })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    }
    case 'fecEntry':
      return [];
  }
}

/** The object is valid for the family (`fecEntryExists` checks 'YYYY:Num' against the FEC). */
export function isValidObject(params: Params, ds: ScenarioDatasets, family: string, object: string, fecEntryExists?: (year: number, num: string) => boolean): boolean {
  const f = familyOf(params, family);
  if (!f) return false;
  if (f.parameter === 'fecEntry') {
    const m = /^(\d{4}):([A-Z]{1,4}\d{6})$/.exec(object);
    return !!m && (fecEntryExists ? fecEntryExists(Number(m[1]), m[2]!) : true);
  }
  return requestObjects(params, ds, family).some((o) => o.id === object);
}

// ---------------------------------------------------------------------------
// status of a request (tracker)
// ---------------------------------------------------------------------------

export type RequestState = 'waiting' | 'notYetEstablished' | 'partial' | 'received';

export interface RequestStatus {
  state: RequestState;
  /** Date the interlocutor answers. */
  due: IsoDate;
  /** Documents received, with their date of receipt. */
  received: { id: string; on: IsoDate }[];
  /** Documents not established yet: date they exist and date they will be served. */
  pending: { id: string; establishedOn: IsoDate; servedOn: IsoDate }[];
  /** A reminder can be sent (answer overdue, documents still missing). */
  canRemind: boolean;
}

/** Status of a request at the date, given the documents (id, date) that answer its key. */
export function requestStatus(params: Params, cal: WorkCalendar, item: RequestItem, docs: readonly { id: string; date: IsoDate }[], date: IsoDate): RequestStatus {
  const due = answerDate(params, cal, item);
  const received: RequestStatus['received'] = [];
  const pending: RequestStatus['pending'] = [];
  for (const d of docs) {
    const on = arrivalDate(params, cal, item, d.date);
    if (on <= date) received.push({ id: d.id, on });
    else pending.push({ id: d.id, establishedOn: d.date, servedOn: on });
  }
  const state: RequestState = date < due ? 'waiting' : pending.length === 0 ? 'received' : received.length ? 'partial' : 'notYetEstablished';
  return { state, due, received, pending, canRemind: date > due && pending.length > 0 };
}

/** Text of the reply of the interlocutor when a document does not exist yet. */
export function notYetEstablishedText(establishedOn: IsoDate): string {
  return `Pas encore établi, disponible à partir du ${formatDateFr(establishedOn)}.`;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

/** What sendRequest reads and writes in the game state (generic: the game state, or a test fixture). */
export interface RequestHost {
  requests: RequestsState;
  clock: { date: IsoDate };
  difficulty?: RequestDifficulty;
  gauges?: GaugesState;
  journal?: readonly { on: IsoDate; kind: string; ref?: string; data?: Record<string, string | number | boolean> }[];
  planning?: { risks: Record<string, { level: string }> };
  findings?: { items: readonly { cycle: string }[] };
}

/**
 * Sends a document request (family × object) at the game date; the answer
 * arrives later (interlocutor delay, date of the document). Cost: a quarter
 * of an hour of the senior (hoursCharged). A duplicate request (same family
 * and object) is recorded as a gauge event for J5 ('duplicateRequest'), and so
 * is a request about a cycle assessed at low risk without any finding on it
 * ('unrelatedRequest').
 */
export function sendRequest<S extends RequestHost>(s: S, family: string, object: string, params: Params = loadParams()): S {
  const date = s.clock.date;
  const key = requestKey(family, object);
  const duplicate = s.requests.items.some((it) => requestKey(it.family, it.object) === key);
  const item: RequestItem = { id: `req${s.requests.items.length + 1}`, family, object, sentOn: date, ...(s.difficulty ? { difficulty: s.difficulty } : {}) };
  let next: S = { ...s, requests: { items: [...s.requests.items, item] } };
  if (next.gauges) {
    const f = familyOf(params, family);
    const cycle = f?.cycle;
    const unrelated = !duplicate && !!cycle && cycle !== 'crossCycle' && s.planning?.risks[cycle]?.level === 'low' && !(s.findings?.items ?? []).some((x) => x.cycle === cycle);
    if (duplicate) next = { ...next, gauges: recordGaugeEvent(next.gauges!, { on: date, gauge: 'clientRelation', reason: 'duplicateRequest', ref: key }) };
    else if (unrelated) next = { ...next, gauges: recordGaugeEvent(next.gauges!, { on: date, gauge: 'clientRelation', reason: 'unrelatedRequest', ref: key }) };
  }
  if (next.journal) next = { ...next, journal: [...next.journal, { on: date, kind: 'request', ref: key, data: { title: requestLabel(params, family, object) } }] };
  return next;
}

/** Reminds the interlocutor of a request (journal; the reply itself keeps its date). */
export function remindRequest<S extends RequestHost>(s: S, id: string, params: Params = loadParams()): S {
  const it = s.requests.items.find((x) => x.id === id);
  if (!it) return s;
  const date = s.clock.date;
  let next: S = { ...s, requests: { items: s.requests.items.map((x) => (x.id === id ? { ...x, remindedOn: date } : x)) } };
  if (next.journal) next = { ...next, journal: [...next.journal, { on: date, kind: 'requestReminder', ref: requestKey(it.family, it.object), data: { title: `Relance – ${requestLabel(params, it.family, it.object)}` } }] };
  return next;
}

// ---------------------------------------------------------------------------
// clock and budget
// ---------------------------------------------------------------------------

/** Upcoming events of the requests: answers due after the game date. */
export function upcomingRequests(s: RequestsState, ctx: UpcomingContext): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  for (const it of s.items) {
    const due = answerDate(ctx.params, ctx.cal, it);
    if (due <= ctx.date) continue;
    const who = ctx.params.documents.people[interlocutorOf(ctx.params, it.family, it.object)];
    out.push({ date: due, kind: 'answer', label: `Réponse attendue${who ? ` de ${who.name}` : ''} : ${requestLabel(ctx.params, it.family, it.object)}`, to: '/ged?onglet=demandes' });
  }
  return out;
}

/** Hours charged to the budget by the document requests and their reminders (time of the senior). */
export function hoursCharged(s: RequestsState, params: Params): HoursCharge[] {
  const out: HoursCharge[] = [];
  for (const it of s.items) {
    out.push({ member: 'senior', hours: params.requests.costHours.request, on: it.sentOn });
    if (it.remindedOn) out.push({ member: 'senior', hours: params.requests.costHours.reminder, on: it.remindedOn });
  }
  return out;
}
