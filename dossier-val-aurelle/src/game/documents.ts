/**
 * Document management (GED): availability of documents for the player and
 * full-text search over their content. Pure, no React.
 */
import type { IsoDate } from '../engine/dates';
import type { Block, DocumentModel } from '../scenario/documents';
import { normalize } from './fec-query';

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
}

export function isAvailable(doc: DocumentModel, ctx: AvailabilityContext): boolean {
  if (ctx.designer) return true;
  const a = doc.availability;
  switch (a.kind) {
    case 'initial':
      return doc.date <= ctx.date;
    case 'afterDate':
      return a.from <= ctx.date;
    case 'onRequest':
      return ctx.answeredRequests.has(a.request);
    case 'confirmation':
      return ctx.sentConfirmations.has(a.request) && a.arrives <= ctx.date;
    case 'conditional':
      return ctx.conditions.has(a.condition);
  }
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

export interface SearchHit {
  docId: string;
  score: number;
  /** Index of the first matching block, -1 for title or metadata. */
  block: number;
  snippet: string;
}

export interface DocumentIndex {
  search(query: string, docIds?: ReadonlySet<string>): SearchHit[];
}

export function buildDocumentIndex(docs: readonly DocumentModel[]): DocumentIndex {
  const entries = docs.map((d) => ({
    id: d.id,
    head: normalize(`${d.title} ${d.issuer} ${d.recipient ?? ''} ${d.reference ?? ''}`),
    blocks: d.blocks.map((b) => {
      const raw = blockText(b);
      return { raw, norm: normalize(raw) };
    }),
  }));
  return {
    search(query, docIds) {
      const words = normalize(query).split(/[^a-z0-9]+/).filter((w) => w.length > 1);
      if (!words.length) return [];
      const hits: SearchHit[] = [];
      for (const e of entries) {
        if (docIds && !docIds.has(e.id)) continue;
        const all = `${e.head} ${e.blocks.map((b) => b.norm).join(' ')}`;
        if (!words.every((w) => all.includes(w))) continue;
        let score = 0;
        for (const w of words) {
          if (e.head.includes(w)) score += 5;
          for (const b of e.blocks) if (b.norm.includes(w)) score += 1;
        }
        const block = e.blocks.findIndex((b) => words.some((w) => b.norm.includes(w)));
        let snippet = '';
        if (block >= 0) {
          const b = e.blocks[block]!;
          const pos = b.norm.indexOf(words.find((w) => b.norm.includes(w))!);
          const start = Math.max(0, pos - 60);
          snippet = `${start > 0 ? '…' : ''}${b.raw.slice(start, pos + 120)}${pos + 120 < b.raw.length ? '…' : ''}`;
        }
        hits.push({ docId: e.id, score, block, snippet });
      }
      return hits.sort((a, b) => b.score - a.score || (a.docId < b.docId ? -1 : 1));
    },
  };
}
