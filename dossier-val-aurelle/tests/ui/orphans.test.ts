/** Cleaning of the orphan references of a save once the case is loaded (plan J4 §15, J4-15): what counts as a known document. */
import { describe, expect, it } from 'vitest';
import { prepareConfirmation } from '../../src/game/confirmations';
import { availabilityContext, isAvailable } from '../../src/game/documents';
import { cleanOrphans } from '../../src/game/persistence';
import { initialState, markRead, type GameState } from '../../src/game/state';
import type { Synthesis } from '../../src/scenario/anomalies/synthesis';
import { versionedId } from '../../src/scenario/documents';
import { CaseData } from '../../src/ui/app/case';
import type { CasePayload } from '../../src/ui/app/dossier';
import { cleanLoadedSave, knownDocuments } from '../../src/ui/app/orphans';
import { useGame, useLoadNotice } from '../../src/ui/app/store';
import { confirmationReply, requestDocuments } from '../../src/ui/screens/ged/replies';
import { correctionKey, documents } from '../helpers/scenario';
import { params, world } from '../helpers/world';

const P = params();
const docs = documents();
const c = new CaseData({ clean: world().world, key: correctionKey(), synthesis: {} as Synthesis, documents: [...docs.documents], falseLeads: [...docs.falseLeads], control: {} as CasePayload['control'], durationMs: 0 }, P);
const fresh = (): GameState => initialState(P);
const withRequest = (s: GameState, family: string, object: string): GameState => ({ ...s, requests: { items: [...s.requests.items, { id: `req${s.requests.items.length + 1}`, family, object, sentOn: s.clock.date }] } });

/** A generic reply (not a catalogue document) built for a request of programme invoices. */
function genericInvoices(): { object: string; id: string } {
  for (const object of ['ACA', 'BEL', 'ERA', 'MAR', 'SAU', 'CHA']) {
    const built = requestDocuments(c, { family: 'programme-invoices', object, sentOn: fresh().clock.date }, fresh().clock.date).find((d) => !c.documentsById.has(d.id));
    if (built) return { object, id: built.id };
  }
  throw new Error('aucune réponse construite');
}

/** A third party answering with a « sans écart » reply built on demand. */
function genericConfirmation(): { thirdParty: string; id: string } {
  for (const thirdParty of ['F0022', 'F0015', 'F0033', 'BDT', 'F0027']) {
    const d = confirmationReply(c, thirdParty);
    if (d && !c.documentsById.has(d.id)) return { thirdParty, id: d.id };
  }
  throw new Error('aucune réponse de confirmation construite');
}

describe('orphan references of a save', () => {
  it('a scenario document not yet available at the game date is known, and so is a later version of a scenario document', () => {
    const s = fresh();
    const later = c.documents.find((d) => !isAvailable(d, availabilityContext(s, P)));
    expect(later).toBeDefined();
    const known = knownDocuments(c, s);
    expect(known(later!.id)).toBe(true);
    expect(known(versionedId('factures-peupliers', '2026-02-23'))).toBe(true);
    expect(known('piece-disparue')).toBe(false);
  });

  it('a reply built for a request or a confirmation of the save is known; built for nothing the save holds, it is an orphan', () => {
    const inv = genericInvoices();
    const conf = genericConfirmation();
    const s = prepareConfirmation(withRequest(fresh(), 'programme-invoices', inv.object), conf.thirdParty, conf.thirdParty, 'senior', P);
    const known = knownDocuments(c, s);
    expect(known(inv.id)).toBe(true);
    expect(known(conf.id)).toBe(true);
    const none = knownDocuments(c, fresh());
    expect(none(inv.id)).toBe(false);
    expect(none(conf.id)).toBe(false);
    // a request of a family that no longer exists builds nothing (and is removed)
    expect(knownDocuments(c, withRequest(fresh(), 'famille-disparue', ''))('piece-disparue')).toBe(false);
  });

  it('only the orphans are removed (once), whatever the availability of the documents at the game date', () => {
    const inv = genericInvoices();
    let s = withRequest(fresh(), 'programme-invoices', inv.object);
    const later = c.documents.find((d) => !isAvailable(d, availabilityContext(s, P)))!;
    for (const id of [later.id, inv.id, versionedId('factures-peupliers', '2026-02-23'), 'piece-disparue']) s = markRead(s, id);
    const r = cleanOrphans(s, P, knownDocuments(c, s));
    expect(Object.keys(r.state.documents).sort()).toEqual([later.id, inv.id, versionedId('factures-peupliers', '2026-02-23')].sort());
    expect(r.removed).toHaveLength(1);
    expect(cleanOrphans(r.state, P, knownDocuments(c, r.state))).toEqual({ state: r.state, removed: [] });
  });

  it('the cleaning at load applies the cleaned save and lists what was removed on the desk notice; run again, it changes nothing', () => {
    useGame.setState({ game: markRead(markRead(fresh(), 'piece-disparue'), 'factures-peupliers') });
    useLoadNotice.setState({ notice: { restarted: false, contentChanged: true, removed: [] } });
    cleanLoadedSave(c);
    const cleaned = useGame.getState().game;
    expect(Object.keys(cleaned.documents)).toEqual(['factures-peupliers']);
    const notice = useLoadNotice.getState().notice!;
    expect(notice.contentChanged).toBe(true);
    expect(notice.removed).toHaveLength(1);
    expect(notice.removed[0]).toMatch(/^Pièces : 1 /);
    cleanLoadedSave(c);
    expect(useGame.getState().game).toBe(cleaned);
    expect(useLoadNotice.getState().notice).toBe(notice);
  });
});
