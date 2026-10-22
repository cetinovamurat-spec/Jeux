/**
 * Replies built on demand on the main thread (plan J4 §8.2-8.4, §9): the
 * documents answering each request sent (scenario/documents → requestReply:
 * built on the date of the request for the families dated on it, the
 * scenario's objects included, otherwise the scenario documents or the
 * generic replies), and the « sans écart » replies of the third parties
 * without a scenario reply, cached per case. The hooks merge them with the
 * scenario documents for the GED, the mail received and the tools; they never
 * read the correction key beyond what the document templates read.
 */
import { useMemo } from 'react';
import type { IsoDate } from '../../../engine/dates';
import { workCalendar } from '../../../game/calendar';
import { confirmationStatus, type ConfirmationItem, type ConfirmationState } from '../../../game/confirmations';
import { isAvailable, receivedOn, type AvailabilityContext } from '../../../game/documents';
import { requestKey, requestStatus, type RequestItem, type RequestStatus } from '../../../game/requests';
import { builtForEveryObject, genericConfirmationReply, requestReply, scenarioConfirmations, scenarioRequestKeys, type DocContext, type DocumentModel } from '../../../scenario/documents';
import type { CaseData } from '../../app/case';
import { useCase } from '../../app/context';
import { useAvailability, useAvailableDocuments } from '../../app/hooks';
import { useGame } from '../../app/store';

interface ReplyCache {
  ctx?: DocContext;
  byKey: ReadonlyMap<string, readonly DocumentModel[]>;
  confirmations: ReadonlyMap<string, DocumentModel>;
  replies: Map<string, readonly DocumentModel[]>;
  genericConfirmations: Map<string, DocumentModel | null>;
}

/** One cache per generated case (shared by every data vintage of the case). */
const caches = new WeakMap<object, ReplyCache>();

function cacheOf(c: CaseData): ReplyCache {
  let x = caches.get(c.payload);
  if (!x) {
    x = { byKey: scenarioRequestKeys(c.documents), confirmations: scenarioConfirmations(c.documents), replies: new Map(), genericConfirmations: new Map() };
    caches.set(c.payload, x);
  }
  return x;
}

function docContext(c: CaseData, x: ReplyCache): DocContext {
  return (x.ctx ??= c.docContext());
}

/**
 * Documents listed in the reply to a request (scenario/documents →
 * requestReply), `firstSentOn` being the date of the first request of its
 * key: the documents built for it, and the scenario documents of its key it
 * lists (the same objects as the catalogue's).
 */
export function requestDocuments(c: CaseData, item: Pick<RequestItem, 'family' | 'object' | 'sentOn'>, firstSentOn: IsoDate): readonly DocumentModel[] {
  const x = cacheOf(c);
  const key = requestKey(item.family, item.object);
  const k = `${key}|${item.sentOn}|${firstSentOn}`;
  let docs = x.replies.get(k);
  if (!docs) {
    docs = requestReply(docContext(c, x), x.byKey.get(key) ?? [], item.family, item.object, item.sentOn, firstSentOn);
    x.replies.set(k, docs);
  }
  return docs;
}

/** The document was built for a request or a confirmation (not a catalogue document, though it may share the id of a reference version). */
function isBuilt(c: CaseData, d: DocumentModel): boolean {
  return c.documentsById.get(d.id) !== d;
}

/** Reply of a third party to a confirmation request: the scenario's, a « sans écart » reply, or null when it never replies. */
export function confirmationReply(c: CaseData, thirdParty: string): DocumentModel | null {
  const x = cacheOf(c);
  const scenario = x.confirmations.get(thirdParty);
  if (scenario) return scenario;
  if (!x.genericConfirmations.has(thirdParty)) x.genericConfirmations.set(thirdParty, genericConfirmationReply(docContext(c, x), thirdParty));
  return x.genericConfirmations.get(thirdParty) ?? null;
}

/** Date the reply of a third party reaches the auditor, or null when it never replies. */
export function replyDate(reply: DocumentModel | null): IsoDate | null {
  return reply && reply.availability.kind === 'confirmation' ? reply.availability.arrives : null;
}

/** Date of the first request of every key (replies of the families not dated on the request are built as known at it). */
export function firstRequestDates(items: readonly RequestItem[]): Map<string, IsoDate> {
  const m = new Map<string, IsoDate>();
  for (const it of items) {
    const k = requestKey(it.family, it.object);
    const f = m.get(k);
    if (f === undefined || it.sentOn < f) m.set(k, it.sentOn);
  }
  return m;
}

/** Replies built for the requests sent (every version) and for the confirmations prepared, whatever their availability. */
export function useBuiltReplies(): readonly DocumentModel[] {
  const c = useCase();
  const requests = useGame((s) => s.game.requests.items);
  const confirmations = useGame((s) => s.game.confirmations.items);
  return useMemo(() => {
    const x = cacheOf(c);
    const out = new Map<string, DocumentModel>();
    const first = firstRequestDates(requests);
    for (const it of requests) for (const d of requestDocuments(c, it, first.get(requestKey(it.family, it.object))!)) if (isBuilt(c, d) && !out.has(d.id)) out.set(d.id, d);
    for (const it of confirmations) {
      if (x.confirmations.has(it.thirdParty)) continue;
      const d = confirmationReply(c, it.thirdParty);
      if (d) out.set(d.id, d);
    }
    return [...out.values()];
  }, [c, requests, confirmations]);
}

export interface GedDocuments {
  /** Every document available at the game date: scenario documents and replies built on demand. */
  available: readonly DocumentModel[];
  /** Replies built on demand that are available (subset of `available`). */
  replies: readonly DocumentModel[];
  byId: (id: string) => DocumentModel | undefined;
  ctx: AvailabilityContext;
}

/**
 * Documents of the GED at the game date (scenario documents and replies built
 * on demand). A reply built for a request replaces the catalogue's reference
 * version of the same id (scenario replies rebuilt on each request).
 */
export function useGedDocuments(): GedDocuments {
  const c = useCase();
  const scenario = useAvailableDocuments();
  const ctx = useAvailability();
  const built = useBuiltReplies();
  return useMemo(() => {
    const replies = built.filter((d) => isAvailable(d, ctx));
    const extra = new Map(built.map((d) => [d.id, d]));
    return { available: [...scenario.filter((d) => !extra.has(d.id)), ...replies], replies, byId: (id: string) => extra.get(id) ?? c.documentsById.get(id), ctx };
  }, [c, scenario, built, ctx]);
}

/** Documents received during the engagement (« Courrier reçu »), most recent first. */
export interface ReceivedDocument {
  doc: DocumentModel;
  on: IsoDate;
}

export function useReceivedMail(): ReceivedDocument[] {
  const c = useCase();
  const { available, ctx } = useGedDocuments();
  const start = c.params.game.startDate;
  return useMemo(() => {
    const out: ReceivedDocument[] = [];
    for (const doc of available) {
      const on = receivedOn(doc, ctx, start);
      if (on !== null && on > start) out.push({ doc, on });
    }
    return out.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : a.doc.title.localeCompare(b.doc.title, 'fr')));
  }, [available, ctx, start]);
}

export interface RequestRow {
  item: RequestItem;
  docs: readonly DocumentModel[];
  status: RequestStatus;
}

/** Requests sent, most recent first, with the documents answering them and their status at the game date. */
export function useRequestRows(): RequestRow[] {
  const c = useCase();
  const items = useGame((s) => s.game.requests.items);
  const date = useGame((s) => s.game.clock.date);
  const cal = useMemo(() => workCalendar(c.params), [c]);
  return useMemo(() => {
    const first = firstRequestDates(items);
    return items
      .map((item) => {
        const docs = requestDocuments(c, item, first.get(requestKey(item.family, item.object))!);
        return { item, docs, status: requestStatus(c.params, cal, item, docs.map((d) => ({ id: d.id, date: d.date })), date) };
      })
      .reverse();
  }, [c, items, date, cal]);
}

/** The documents answering a request key have been received (at least one of them is available). */
export function useObtained(): (key: string) => boolean {
  const rows = useRequestRows();
  const designer = useGame((s) => s.game.settings.designer);
  return useMemo(() => {
    const got = new Set<string>();
    for (const r of rows) if (designer || r.status.received.length > 0) got.add(requestKey(r.item.family, r.item.object));
    return (key: string) => got.has(key);
  }, [rows, designer]);
}

export interface ConfirmationRow {
  item: ConfirmationItem;
  reply: DocumentModel | null;
  replyOn: IsoDate | null;
  state: ConfirmationState;
}

/** Confirmation requests prepared, with their reply and status at the game date. */
export function useConfirmationRows(): ConfirmationRow[] {
  const c = useCase();
  const items = useGame((s) => s.game.confirmations.items);
  const date = useGame((s) => s.game.clock.date);
  return useMemo(() => {
    const cal = workCalendar(c.params);
    return items.map((item) => {
      const reply = confirmationReply(c, item.thirdParty);
      const replyOn = replyDate(reply);
      return { item, reply, replyOn, state: confirmationStatus(c.params, item, replyOn, date, cal) };
    });
  }, [c, items, date]);
}

/**
 * Dates of the documents answering a request key, to announce the documents
 * served after the answer in the agenda (game/requests.ts → upcomingRequests,
 * `requestDocDates`) and to tell a reply « pas encore établi » from a reply
 * received (receivedRequests). Only the families answered by documents of
 * fixed dates have some: those built for every object list no document
 * established after the request (a scenario piece established later arrives
 * as mail, unannounced).
 */
export function useRequestDocDates(): (key: string) => readonly IsoDate[] {
  const c = useCase();
  const items = useGame((s) => s.game.requests.items);
  return useMemo(() => {
    const m = new Map<string, IsoDate[]>();
    for (const [k, first] of firstRequestDates(items)) {
      const it = items.find((x) => x.sentOn === first && requestKey(x.family, x.object) === k)!;
      m.set(k, builtForEveryObject(it.family) ? [] : requestDocuments(c, it, first).map((d) => d.date));
    }
    return (key: string) => m.get(key) ?? [];
  }, [c, items]);
}
