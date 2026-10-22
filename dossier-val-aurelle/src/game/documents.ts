/**
 * Document management (GED): availability of documents for the player,
 * full-text search over their content and the filtered list shown by the
 * GED screen. Pure, no React.
 */
import type { IsoDate } from '../engine/dates';
import type { Block, DocumentModel } from '../scenario/documents';
import { onRequestKeys, type DocumentCategory } from '../scenario/documents/model';
import type { Params } from '../scenario/params';
import { sentConfirmations } from './confirmations';
import { answeredRequests, requestArrivals } from './requests';
import type { DocumentState, GameState } from './state';
import { foldText, type FoldedText } from './text';

export interface AvailabilityContext {
  date: IsoDate;
  /** Precise requests already answered (J4). */
  answeredRequests: ReadonlySet<string>;
  /** Confirmation requests sent (J4); the reply arrives at its date. */
  sentConfirmations: ReadonlySet<string>;
  /** Game conditions met (J5), e.g. 'chiefAccountantConfides'. */
  conditions: ReadonlySet<string>;
  /** Designer mode unlocks every document. */
  designer: boolean;
  /**
   * Date the reply to a request key reaches the auditor for a document dated
   * `docDate` (with the answer when the document exists by then, otherwise
   * its date plus the interlocutor's delay; null: established on the date of
   * the request, with the answer), served by the requests sent on `sentOn`
   * only when given; null when it was never asked (game/requests.ts →
   * requestArrivals). Without it, a document given on request is available
   * once its key is answered and its date reached.
   */
  requestArrival?: (key: string, docDate: IsoDate | null, sentOn?: IsoDate) => IsoDate | null;
}

/**
 * Availability context of the documents at the game date, from the game
 * state: requests answered and confirmations sent (J4c), conditions met (J5).
 */
export function availabilityContext(s: Pick<GameState, 'clock' | 'settings' | 'requests' | 'confirmations'>, params: Params, date: IsoDate = s.clock.date): AvailabilityContext {
  return {
    date,
    designer: s.settings.designer,
    answeredRequests: answeredRequests(s.requests, params, date),
    sentConfirmations: sentConfirmations(s.confirmations, params, date),
    conditions: new Set<string>(),
    requestArrival: requestArrivals(s.requests, params),
  };
}

/**
 * Date a document given on request reaches the auditor (earliest over the
 * keys it answers), or null when it was never asked. A reply built for a
 * request (`asOf`) is served by that request; the reference version of a
 * reply rebuilt on each request is « received » with the first answer, when
 * the player gets its first version (same id: ui/screens/ged/replies.ts).
 */
function onRequestArrival(doc: DocumentModel, ctx: AvailabilityContext): IsoDate | null {
  const a = doc.availability;
  if (a.kind !== 'onRequest') return null;
  const keys = onRequestKeys(a);
  let best: IsoDate | null = null;
  for (const k of keys) {
    const d = ctx.requestArrival ? ctx.requestArrival(k, a.rebuiltOnRequest ? null : doc.date, a.asOf) : ctx.answeredRequests.has(k) ? (doc.date > ctx.date ? null : doc.date) : null;
    if (d !== null && (best === null || d < best)) best = d;
  }
  return best;
}

export function isAvailable(doc: DocumentModel, ctx: AvailabilityContext): boolean {
  if (ctx.designer) return true;
  const a = doc.availability;
  switch (a.kind) {
    case 'initial':
      return doc.date <= ctx.date;
    case 'afterDate':
      return a.from <= ctx.date;
    case 'onRequest': {
      if (a.family === undefined) return ctx.answeredRequests.has(a.request); // legacy label
      const at = onRequestArrival(doc, ctx);
      return at !== null && at <= ctx.date;
    }
    case 'confirmation':
      return ctx.sentConfirmations.has(a.request) && a.arrives <= ctx.date;
    case 'conditional':
      return ctx.conditions.has(a.condition);
  }
}

/**
 * Date the document reached the auditor (« Reçu le », order of the mail
 * received): its date for the data room (the start of the engagement for the
 * documents that predate it), the date of receipt of a reply or of the mail.
 * Null when it is not available (designer mode excepted: then its own date).
 */
export function receivedOn(doc: DocumentModel, ctx: AvailabilityContext, startDate: IsoDate): IsoDate | null {
  const a = doc.availability;
  const real = (() => {
    switch (a.kind) {
      case 'initial':
        return doc.date <= ctx.date ? (doc.date > startDate ? doc.date : startDate) : null;
      case 'afterDate':
        return a.from <= ctx.date ? a.from : null;
      case 'onRequest': {
        if (a.family === undefined) return ctx.answeredRequests.has(a.request) ? doc.date : null;
        const at = onRequestArrival(doc, ctx);
        return at !== null && at <= ctx.date ? at : null;
      }
      case 'confirmation':
        return ctx.sentConfirmations.has(a.request) && a.arrives <= ctx.date ? a.arrives : null;
      case 'conditional':
        return ctx.conditions.has(a.condition) ? doc.date : null;
    }
  })();
  return real ?? (ctx.designer ? doc.date : null);
}

/** Plain text of a block (search, snippets). */
export function blockText(b: Block): string {
  switch (b.kind) {
    case 'heading':
    case 'paragraph':
    case 'note':
      return b.text;
    case 'fields':
      return b.rows.map((r) => `${r.label} ${r.value}`).join(' ');
    case 'table':
      return [b.title ?? '', b.columns.join(' '), ...b.rows.map((r) => r.cells.join(' ')), (b.footer ?? []).join(' ')].join(' ');
    case 'list':
      return b.items.map((i) => i.text).join(' ');
    case 'signature':
      return `${b.name} ${b.role} ${b.date ?? ''}`;
    case 'stamp':
      return `${b.text} ${b.date}`;
  }
}

// ---------------------------------------------------------------------------
// folding (accent-, case- and ligature-insensitive search, shared with the FEC and the ledger: ./text)
// ---------------------------------------------------------------------------

export { foldText, type FoldedText };

/** Folded words of a search query (letters and digits, more than one character, without duplicates). */
export function searchWords(query: string): string[] {
  return [...new Set(foldText(query).text.split(/[^a-z0-9]+/).filter((w) => w.length > 1))];
}

// ---------------------------------------------------------------------------
// full-text search
// ---------------------------------------------------------------------------

export interface SearchHit {
  docId: string;
  score: number;
  /** Index of the first matching block, -1 for title or metadata. */
  block: number;
  /** Every block containing at least one word of the query (in document order). */
  blocks: number[];
  snippet: string;
}

export interface DocumentIndex {
  search(query: string, docIds?: ReadonlySet<string>): SearchHit[];
}

/** Characters kept before and after the first occurrence in a snippet. */
const SNIPPET_BEFORE = 60;
const SNIPPET_AFTER = 120;

interface IndexedBlock {
  raw: string;
  norm: string;
  map: number[];
}

function snippetOf(b: IndexedBlock, words: readonly string[]): string {
  let pos = -1;
  for (const w of words) {
    const p = b.norm.indexOf(w);
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  if (pos < 0) return '';
  const at = b.map[pos] ?? 0;
  let start = Math.max(0, at - SNIPPET_BEFORE);
  let end = Math.min(b.raw.length, at + SNIPPET_AFTER);
  // cut on word boundaries when possible
  if (start > 0) {
    const sp = b.raw.indexOf(' ', start);
    if (sp >= 0 && sp < at) start = sp + 1;
  }
  if (end < b.raw.length) {
    const sp = b.raw.lastIndexOf(' ', end);
    if (sp > at) end = sp;
  }
  return `${start > 0 ? '…' : ''}${b.raw.slice(start, end).trim()}${end < b.raw.length ? '…' : ''}`;
}

/**
 * Index of the documents for the full-text search: every word of the query
 * (accents, case and ligatures ignored, words of one character ignored) must
 * appear in the document; a word found in the title, issuer, recipient or
 * reference weighs 5, each block containing it weighs 1.
 */
export function buildDocumentIndex(docs: readonly DocumentModel[]): DocumentIndex {
  const entries = docs.map((d) => {
    const head = foldText(`${d.title} ${d.issuer} ${d.recipient ?? ''} ${d.reference ?? ''}`).text;
    const blocks: IndexedBlock[] = d.blocks.map((b) => {
      const raw = blockText(b);
      const f = foldText(raw);
      return { raw, norm: f.text, map: f.map };
    });
    return { id: d.id, head, blocks, all: `${head} ${blocks.map((b) => b.norm).join(' ')}` };
  });
  return {
    search(query, docIds) {
      const words = searchWords(query);
      if (!words.length) return [];
      const hits: SearchHit[] = [];
      for (const e of entries) {
        if (docIds && !docIds.has(e.id)) continue;
        if (!words.every((w) => e.all.includes(w))) continue;
        let score = 0;
        for (const w of words) {
          if (e.head.includes(w)) score += 5;
          for (const b of e.blocks) if (b.norm.includes(w)) score += 1;
        }
        const blocks: number[] = [];
        e.blocks.forEach((b, i) => {
          if (words.some((w) => b.norm.includes(w))) blocks.push(i);
        });
        const block = blocks[0] ?? -1;
        const snippet = block >= 0 ? snippetOf(e.blocks[block]!, words) : '';
        hits.push({ docId: e.id, score, block, blocks, snippet });
      }
      return hits.sort((a, b) => b.score - a.score || (a.docId < b.docId ? -1 : 1));
    },
  };
}

// ---------------------------------------------------------------------------
// GED list: filters and sort
// ---------------------------------------------------------------------------

export type DocumentStatusFilter = 'all' | 'unread' | 'evidence' | 'annotated';
export type DocumentSort = 'relevance' | 'dateDesc' | 'dateAsc' | 'title';

export interface DocumentFilter {
  category: DocumentCategory | 'all';
  status: DocumentStatusFilter;
  sort: DocumentSort;
}

export const DEFAULT_DOCUMENT_FILTER: Readonly<DocumentFilter> = { category: 'all', status: 'all', sort: 'dateDesc' };

export interface ListedDocument {
  doc: DocumentModel;
  /** Search hit (null when no search is active). */
  hit: SearchHit | null;
}

export function matchesStatus(state: DocumentState | undefined, status: DocumentStatusFilter): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'unread':
      return !state?.readOn;
    case 'evidence':
      return !!state?.evidence;
    case 'annotated':
      return (state?.annotations.length ?? 0) > 0;
  }
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/**
 * Documents of the GED list: `docs` (already restricted to the available
 * ones) matching the search (`hits`, null when no search is active), the
 * category and the status, sorted. The document `keep` (being read) stays in
 * the list whatever its status, so that it does not vanish once it is read,
 * kept as evidence or annotated. Sorting by relevance without a search falls
 * back to the most recent first.
 */
export function listDocuments(
  docs: readonly DocumentModel[],
  states: Readonly<Record<string, DocumentState>>,
  filter: DocumentFilter,
  hits: readonly SearchHit[] | null,
  keep?: string,
): ListedDocument[] {
  const byId = hits ? new Map(hits.map((h) => [h.docId, h])) : null;
  const out: ListedDocument[] = [];
  for (const doc of docs) {
    const hit = byId ? byId.get(doc.id) : null;
    if (hit === undefined) continue;
    if (filter.category !== 'all' && doc.category !== filter.category) continue;
    if (doc.id !== keep && !matchesStatus(states[doc.id], filter.status)) continue;
    out.push({ doc, hit });
  }
  const byDate = (a: ListedDocument, b: ListedDocument) => (a.doc.date < b.doc.date ? -1 : a.doc.date > b.doc.date ? 1 : 0);
  const byTitle = (a: ListedDocument, b: ListedDocument) => collator.compare(a.doc.title, b.doc.title) || (a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0);
  const sort = filter.sort === 'relevance' && !hits ? 'dateDesc' : filter.sort;
  switch (sort) {
    case 'relevance':
      return out.sort((a, b) => (b.hit?.score ?? 0) - (a.hit?.score ?? 0) || byDate(b, a) || byTitle(a, b));
    case 'dateDesc':
      return out.sort((a, b) => byDate(b, a) || byTitle(a, b));
    case 'dateAsc':
      return out.sort((a, b) => byDate(a, b) || byTitle(a, b));
    case 'title':
      return out.sort((a, b) => byTitle(a, b) || byDate(b, a));
  }
}
