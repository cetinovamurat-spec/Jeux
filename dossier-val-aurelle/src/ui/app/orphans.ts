/**
 * References of a save that the current content no longer knows (plan J4
 * §15, J4-15): once the case is loaded, game/persistence → cleanOrphans
 * removes them and the desk lists what was removed. Idempotent: run at every
 * load, it changes nothing on a save without orphans.
 *
 * A document is known when it is a scenario document — every one, whatever
 * its availability at the game date (a piece not yet received is not an
 * orphan) — or a later version of one (`<id>~date`), or a reply built for the
 * requests and confirmations of the save, whatever its arrival date, or the
 * record of an answer in the interviews of the save (plan J5 §5.6).
 */
import { interviewNoteIds } from '../../game/interviews';
import { cleanOrphans } from '../../game/persistence';
import { requestKey } from '../../game/requests';
import type { GameState } from '../../game/state';
import { baseDocumentId } from '../../scenario/documents';
import { confirmationReply, firstRequestDates, requestDocuments } from '../screens/ged/replies';
import type { CaseData } from './case';
import { reportRemovedReferences, useGame } from './store';

/** Ids of the replies built for the requests (of a known family) and the confirmations of the save; null when one of them cannot be built. */
function builtReplyIds(c: CaseData, s: GameState): ReadonlySet<string> | null {
  const families = new Set((c.params.requests.families as readonly { id: string }[]).map((f) => f.id));
  const ids = new Set<string>();
  try {
    const items = s.requests.items.filter((it) => families.has(it.family));
    const first = firstRequestDates(items);
    for (const it of items) for (const d of requestDocuments(c, it, first.get(requestKey(it.family, it.object))!)) ids.add(d.id);
    for (const it of s.confirmations.items) {
      const d = confirmationReply(c, it.thirdParty);
      if (d) ids.add(d.id);
    }
  } catch {
    return null;
  }
  return ids;
}

/**
 * Whether a document id is known to the current case (see above): the
 * records of the interviews are those derivable from the sessions of the
 * save (game/interviews.ts → interviewNoteIds). The replies
 * are built only when an id is not a scenario document; when one of them
 * cannot be built, every document is deemed known (nothing is removed on a
 * doubt).
 */
export function knownDocuments(c: CaseData, s: GameState): (id: string) => boolean {
  let built: ReadonlySet<string> | null | undefined;
  let notes: ReadonlySet<string> | undefined;
  return (id) => {
    if (c.documentsById.has(id) || c.documentsById.has(baseDocumentId(id))) return true;
    notes ??= interviewNoteIds(s.interviews);
    if (notes.has(id)) return true;
    if (built === undefined) built = builtReplyIds(c, s);
    return built === null || built.has(id);
  };
}

/** Cleans the loaded save against the case (once the case data is loaded); the lines removed are added to the desk notice. */
export function cleanLoadedSave(c: CaseData): void {
  const s = useGame.getState().game;
  const r = cleanOrphans(s, c.params, knownDocuments(c, s));
  if (r.removed.length === 0) return;
  useGame.getState().act(() => r.state);
  reportRemovedReferences(r.removed);
}
