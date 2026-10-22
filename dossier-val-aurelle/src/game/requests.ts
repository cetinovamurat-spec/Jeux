/**
 * Document requests (plan J4 §8, J4-6): parametric requests (family × object
 * of params/requests.json) sent to an interlocutor of the client, reminders.
 * Only the decisions are stored (what, when); everything that arrives is
 * derived from the date: the interlocutor answers after its delay (working
 * days of the game calendar, times the difficulty factor), and a document is
 * never handed over before it exists — before its date the reply is « pas
 * encore établi », and the document is served automatically at its date plus
 * the delay. Which documents a request lists (established on the request date
 * for some families, the scenario's pieces established later being mail) is
 * the as-of rule of scenario/documents/replies.ts. Section of the game state
 * owned by J4c.
 */
import { z } from 'zod';
import { formatDateFr, type IsoDate } from '../engine/dates';
import type { ScenarioDatasets } from '../scenario/datasets';
import { requestKey } from '../scenario/documents/model';
import { hasTenderFile, ofName } from '../scenario/documents/replies';
import { programmeLabel, requestLabel } from '../scenario/documents/request-labels';
import { loadParams, type Params } from '../scenario/params';
import type { RequestFamily } from '../scenario/schemas/requests';
import type { UpcomingContext, UpcomingEvent } from './advance';
import type { HoursCharge } from './budget';
import { addWorkingDays, workCalendar, type WorkCalendar } from './calendar';
import { periodAt } from './clock';
import { recordGaugeEvent, type GaugesState } from './gauges';

export type RequestDifficulty = 'assistant' | 'senior' | 'manager';

export interface RequestItem {
  id: string;
  /** Request family (params/requests.json). */
  family: string;
  /** Object of the request (programme, third party, 'YYYY:EcritureNum', month…), '' when the family has none. */
  object: string;
  sentOn: IsoDate;
  /** Dates of the reminders, oldest first (each one is charged). */
  reminders?: IsoDate[];
  /** Difficulty of the game when the request was sent (delay factor of the interlocutors). */
  difficulty?: RequestDifficulty;
}

export interface RequestsState {
  items: RequestItem[];
}

export function initialRequests(): RequestsState {
  return { items: [] };
}

/**
 * Reminders of a saved item: the list, or the single `remindedOn` of the
 * saves made before the reminders were listed (read as a list of one).
 */
export function readReminders<T extends { reminders?: string[] | undefined; remindedOn?: string | undefined }>(item: T): Omit<T, 'remindedOn' | 'reminders'> & { reminders?: string[] } {
  const { remindedOn, reminders, ...rest } = item;
  const list = reminders ?? (remindedOn !== undefined ? [remindedOn] : undefined);
  return list ? { ...rest, reminders: list } : rest;
}

export const requestsSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        family: z.string(),
        object: z.string(),
        sentOn: z.string(),
        reminders: z.array(z.string()).optional(),
        remindedOn: z.string().optional(),
        difficulty: z.enum(['assistant', 'senior', 'manager']).optional(),
      })
      .transform(readReminders),
  ),
});

/** Date of the last reminder of a request or a confirmation, if any. */
export function lastReminder(item: { reminders?: readonly IsoDate[] }): IsoDate | undefined {
  return item.reminders?.[item.reminders.length - 1];
}

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
 * Date a document dated `docDate` answering the request reaches the auditor
 * (plan J4 §8.4): with the answer when it exists by then (established before
 * the request, or between the request and the answer), otherwise the
 * interlocutor's delay counted from the date of the document.
 */
export function arrivalDate(params: Params, cal: WorkCalendar, item: RequestItem, docDate: IsoDate): IsoDate {
  const due = answerDate(params, cal, item);
  return docDate <= due ? due : addWorkingDays(cal, docDate, delayDays(params, item.family, item.object, item.difficulty));
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
 * Keys of the requests whose documents have reached the auditor at the date:
 * answered, and at least one of the documents served (dated `docDates(key)`)
 * arrived; a reply « pas encore établi » does not count. A key without any
 * document counts once answered (generic reply).
 */
export function receivedRequests(s: RequestsState, params: Params, date: IsoDate, docDates?: RequestDocDates): ReadonlySet<string> {
  const cal = workCalendar(params);
  const out = new Set<string>();
  for (const it of s.items) {
    const key = requestKey(it.family, it.object);
    if (out.has(key) || answerDate(params, cal, it) > date) continue;
    const dates = docDates?.(key) ?? [];
    if (dates.length === 0 || dates.some((d) => arrivalDate(params, cal, it, d) <= date)) out.add(key);
  }
  return out;
}

/**
 * Arrival of the reply to a request key for a document dated `docDate`
 * (earliest over the requests of that key), or null when it was never asked.
 * `docDate` null: a document established on the date of each request, which
 * comes with the answer; `sentOn`: a version built for the requests sent that
 * day, which only they serve.
 */
export function requestArrivals(s: RequestsState, params: Params): (key: string, docDate: IsoDate | null, sentOn?: IsoDate) => IsoDate | null {
  const cal = workCalendar(params);
  const byKey = new Map<string, RequestItem[]>();
  for (const it of s.items) {
    const k = requestKey(it.family, it.object);
    byKey.set(k, [...(byKey.get(k) ?? []), it]);
  }
  return (key, docDate, sentOn) => {
    let best: IsoDate | null = null;
    for (const it of byKey.get(key) ?? []) {
      if (sentOn !== undefined && it.sentOn !== sentOn) continue;
      const d = docDate === null ? answerDate(params, cal, it) : arrivalDate(params, cal, it, docDate);
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
      // never the auditor's own firm (its engagement letter is in the permanent file)
      let tps = ds.thirdParties.filter((t) => (kinds.size === 0 || kinds.has(t.kind)) && t.name !== params.game.firmName);
      if (family === 'supplier-tender') {
        // suppliers invoiced since 2024 whose purchases are awarded after competition (no statutory contribution, co-ownership charges nor bank services)
        const invoiced = new Set(ds.invoices.filter((i) => i.invoiceDate >= '2024-01-01').map((i) => i.supplierId));
        tps = tps.filter((t) => invoiced.has(t.id) && hasTenderFile(ds.invoices, t.id));
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
 * Phase of the engagement at a date: the calendar period in progress, or the
 * last one ended (off site, between two periods).
 */
function phaseAt(params: Params, date: IsoDate): string {
  const p = periodAt(params.game.calendar, date);
  return p.current?.id ?? p.previous?.id ?? '';
}

/**
 * Earlier request of the same family and object sent in the same phase of
 * the engagement as `date` (asking again then is a duplicate; at a later
 * visit, the documents built on the request date are updated), if any.
 */
export function duplicateOf(items: readonly RequestItem[], family: string, object: string, date: IsoDate, params: Params): RequestItem | undefined {
  const key = requestKey(family, object);
  const phase = phaseAt(params, date);
  return items.find((it) => requestKey(it.family, it.object) === key && phaseAt(params, it.sentOn) === phase);
}

/**
 * Sends a document request (family × object) at the game date; the answer
 * arrives later (interlocutor delay, date of the document). Cost: a quarter
 * of an hour of the senior (hoursCharged). A duplicate request (same family
 * and object already asked in the same phase of the engagement: asking again
 * at a later visit updates the documents built on the request date) is
 * recorded as a gauge event for J5 ('duplicateRequest'), and so is a request
 * about a cycle assessed at low risk without any finding on it
 * ('unrelatedRequest').
 */
export function sendRequest<S extends RequestHost>(s: S, family: string, object: string, params: Params = loadParams()): S {
  const date = s.clock.date;
  const key = requestKey(family, object);
  const duplicate = duplicateOf(s.requests.items, family, object, date, params) !== undefined;
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

/** Reminds the interlocutor of a request, once a day at most (journal, cost; the reply itself keeps its date). */
export function remindRequest<S extends RequestHost>(s: S, id: string, params: Params = loadParams()): S {
  const it = s.requests.items.find((x) => x.id === id);
  const date = s.clock.date;
  if (!it || lastReminder(it) === date) return s;
  let next: S = { ...s, requests: { items: s.requests.items.map((x) => (x.id === id ? { ...x, reminders: [...(x.reminders ?? []), date] } : x)) } };
  if (next.journal) next = { ...next, journal: [...next.journal, { on: date, kind: 'requestReminder', ref: requestKey(it.family, it.object), data: { title: `Relance – ${requestLabel(params, it.family, it.object)}` } }] };
  return next;
}

// ---------------------------------------------------------------------------
// clock and budget
// ---------------------------------------------------------------------------

/**
 * Dates of the documents answering a request key (scenario documents and
 * generic replies), given by the UI to announce the documents served later
 * (« pas encore établi »). Optional: without it, only the answers are announced.
 */
export type RequestDocDates = (key: string) => readonly IsoDate[];

/**
 * Upcoming events of the requests: answers due after the game date and,
 * when the context knows the dates of the documents (`requestDocDates`), the
 * documents not established yet that will be served at their date plus the
 * interlocutor's delay.
 */
export function upcomingRequests(s: RequestsState, ctx: UpcomingContext & { requestDocDates?: RequestDocDates }): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  const seen = new Set<string>();
  for (const it of s.items) {
    const key = requestKey(it.family, it.object);
    const label = requestLabel(ctx.params, it.family, it.object);
    const due = answerDate(ctx.params, ctx.cal, it);
    const who = ctx.params.documents.people[interlocutorOf(ctx.params, it.family, it.object)];
    if (due > ctx.date && !seen.has(`${key}|${due}`)) {
      seen.add(`${key}|${due}`);
      out.push({ date: due, kind: 'answer', label: `Réponse attendue${who ? ` ${ofName(who.name)}` : ''} : ${label}`, to: '/ged?onglet=demandes' });
    }
    for (const d of ctx.requestDocDates?.(key) ?? []) {
      const on = arrivalDate(ctx.params, ctx.cal, it, d);
      if (on <= ctx.date || on === due || seen.has(`${key}|${on}`)) continue;
      seen.add(`${key}|${on}`);
      out.push({ date: on, kind: 'answer', label: `Pièce attendue (établie le ${formatDateFr(d)}) : ${label}`, to: '/ged?onglet=demandes' });
    }
  }
  return out;
}

/** Hours charged to the budget by the document requests and each of their reminders (time of the senior). */
export function hoursCharged(s: RequestsState, params: Params): HoursCharge[] {
  const out: HoursCharge[] = [];
  for (const it of s.items) {
    out.push({ member: 'senior', hours: params.requests.costHours.request, on: it.sentOn });
    for (const on of it.reminders ?? []) out.push({ member: 'senior', hours: params.requests.costHours.reminder, on });
  }
  return out;
}
