/**
 * French rendering of the mission journal (GameState.journal) for the desk:
 * one line per event, with an optional link to the screen concerned. Pure.
 */
import type { JournalEvent, SavedQuery } from '../../../game/state';

export interface EventView {
  /** Text before the subject, e.g. 'Document consulté :'. */
  text: string;
  /** Subject of the event (document title, query name…). */
  subject?: string;
  /** Route of the subject (react-router path). */
  to?: string;
}

export interface JournalContext {
  docTitle: (id: string) => string | undefined;
  savedQueries: readonly SavedQuery[];
}

function docLink(id: string): string {
  return `/ged/${encodeURIComponent(id)}`;
}

function docSubject(id: string, ctx: JournalContext): Pick<EventView, 'subject' | 'to'> {
  const title = ctx.docTitle(id);
  return title === undefined ? { subject: `${id} (document inconnu)` } : { subject: title, to: docLink(id) };
}

export function describeEvent(e: JournalEvent, ctx: JournalContext): EventView {
  switch (e.kind) {
    case 'documentRead':
      return { text: 'Document consulté :', ...docSubject(e.detail, ctx) };
    case 'annotation':
      return { text: 'Annotation ajoutée :', ...docSubject(e.detail, ctx) };
    case 'evidence': {
      const i = e.detail.lastIndexOf(':');
      const id = i < 0 ? e.detail : e.detail.slice(0, i);
      const removed = i >= 0 && e.detail.slice(i + 1) === 'retrait';
      return { text: removed ? 'Pièce retirée des éléments probants :' : 'Pièce conservée comme élément probant :', ...docSubject(id, ctx) };
    }
    case 'query': {
      const q = ctx.savedQueries.find((s) => s.name === e.detail);
      return { text: 'Requête FEC enregistrée :', subject: `« ${e.detail} »`, to: q ? `/fec?requete=${encodeURIComponent(q.id)}` : '/fec' };
    }
    case 'tick':
      return { text: 'Pointage des états :', subject: e.detail, to: '/etats' };
    case 'setting':
      return { text: 'Réglage modifié :', subject: e.detail };
    default:
      return { text: 'Action enregistrée :', subject: (e as JournalEvent).detail };
  }
}

/** Most recent events first (the journal is chronological), at most `limit`. */
export function latestEvents(journal: readonly JournalEvent[], limit: number): { event: JournalEvent; index: number }[] {
  const out: { event: JournalEvent; index: number }[] = [];
  for (let i = journal.length - 1; i >= 0 && out.length < limit; i--) {
    const event = journal[i];
    if (event) out.push({ event, index: i });
  }
  return out;
}
