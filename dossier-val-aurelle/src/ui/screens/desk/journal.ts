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

/** Generic wording of the J4-J6 event kinds; the event may carry its subject in `data.title`. */
const KIND_TEXT: Readonly<Record<string, string>> = {
  clock: 'Date du dossier :',
  materiality: 'Seuils de signification :',
  risk: 'Évaluation des risques :',
  program: 'Programme de travail :',
  execution: 'Procédure :',
  request: 'Demande de documents :',
  confirmation: 'Demande de confirmation :',
  sample: 'Échantillon :',
  recalc: 'Recalcul :',
  finding: 'Constat :',
  worksheet: 'Feuille de travail :',
};

export function describeEvent(e: JournalEvent, ctx: JournalContext): EventView {
  const ref = e.ref ?? '';
  switch (e.kind) {
    case 'documentRead':
      return { text: 'Document consulté :', ...docSubject(ref, ctx) };
    case 'annotation':
      return { text: 'Annotation ajoutée :', ...docSubject(ref, ctx) };
    case 'evidence':
      return { text: e.data?.['kept'] === false ? 'Pièce retirée des éléments probants :' : 'Pièce conservée comme élément probant :', ...docSubject(ref, ctx) };
    case 'query': {
      const q = ctx.savedQueries.find((s) => s.name === ref);
      return { text: 'Requête FEC enregistrée :', subject: `« ${ref} »`, to: q ? `/fec?requete=${encodeURIComponent(q.id)}` : '/fec' };
    }
    case 'tick':
      return { text: 'Pointage des états :', subject: ref, to: '/etats' };
    case 'setting':
      return { text: 'Réglage modifié :', subject: ref };
    default: {
      const title = e.data?.['title'];
      return { text: KIND_TEXT[e.kind] ?? 'Action enregistrée :', subject: typeof title === 'string' ? title : ref };
    }
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
