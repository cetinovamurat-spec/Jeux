/**
 * Integrity of the requests and confirmations (plan J4 §8, §9, §16): every
 * document given on request answers an existing (family, object) with the
 * right interlocutor and reaches the auditor before the end of the final;
 * every request of the scenario unlocks a document; every other object gets a
 * generic reply without clue; in the families answered as of the request
 * date, a scenario object is answered like its neighbours (date, issuer,
 * number and shape of the documents, content as of the request; clues only
 * tagged) and its pieces established later are never listed; the
 * confirmation replies are split by third party and the silent third party
 * never replies.
 */
import { describe, expect, it } from 'vitest';
import { formatDateFr as date } from '../../src/engine/dates';
import { addWorkingDays, workCalendar } from '../../src/game/calendar';
import { confirmationCandidates } from '../../src/game/confirmations';
import { delayDays, interlocutorOf, requestObjects } from '../../src/game/requests';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import {
  baseDocumentId,
  builtForEveryObject,
  genericConfirmationReply,
  genericReplies,
  isRebuiltOnRequest,
  makeContext,
  onRequestKeys,
  REQUEST_DATED_FAMILIES,
  requestKey,
  requestReply,
  SCENARIO_REPLIES,
  scenarioConfirmations,
  scenarioRequestKeys,
} from '../../src/scenario/documents';
import { CLOSING_TRANSMITTALS, fecNumbers } from '../../src/scenario/documents/replies';
import type { Block, DocumentModel } from '../../src/scenario/documents/model';
import { correctionKey, documents } from '../helpers/scenario';
import { params, world } from '../helpers/world';

const p = params();
const set = documents();
const key = correctionKey();
const ctx = makeContext(p, world().world, key);
const ds = key.presented.world.datasets as unknown as ScenarioDatasets;
const cal = workCalendar(p);
const FINAL_END = p.game.calendar.find((x) => x.id === 'final')!.to;
const byKey = scenarioRequestKeys(set.documents);
const numbers2025 = new Set(fecNumbers(key.presented.world.ledgers.current).values());
const numbers2024 = new Set(fecNumbers(key.presented.world.ledgers.prior).values());

function validObject(family: string, object: string): boolean {
  const f = p.requests.families.find((x) => x.id === family);
  if (!f) return false;
  if (f.parameter === 'fecEntry') {
    const [y, n] = object.split(':');
    return (y === '2025' ? numbers2025 : numbers2024).has(n ?? '');
  }
  return requestObjects(p, ds, family).some((o) => o.id === object);
}

/** Documents listed in the reply to a request sent on `sentOn` (the first one of its key unless `first` says otherwise). */
function answer(family: string, object: string, sentOn = '2026-02-23', first = sentOn): readonly DocumentModel[] {
  return requestReply(ctx, byKey.get(requestKey(family, object)) ?? [], family, object, sentOn, first);
}

describe('documents given on request', () => {
  const onRequest = set.documents.filter((d) => d.availability.kind === 'onRequest');
  it('every one answers an existing family and object, with the right interlocutor', () => {
    expect(onRequest.length).toBeGreaterThan(30);
    for (const d of onRequest) {
      const a = d.availability as Extract<DocumentModel['availability'], { kind: 'onRequest' }>;
      expect(a.family, d.id).toBeDefined();
      for (const k of onRequestKeys(a)) {
        const object = k.slice(a.family!.length + 1);
        expect(validObject(a.family!, object), `${d.id} → ${k}`).toBe(true);
        expect(a.from, `${d.id} → ${k}`).toBe(interlocutorOf(p, a.family!, object));
      }
      expect(a.request, d.id).not.toMatch(/^[a-z-]+:/);
    }
  });
  it('every one reaches the auditor before the end of the final (date of the document + delay)', () => {
    for (const d of onRequest) {
      const a = d.availability as Extract<DocumentModel['availability'], { kind: 'onRequest' }>;
      const at = addWorkingDays(cal, d.date, delayDays(p, a.family!, a.object ?? ''));
      expect(at <= FINAL_END, `${d.id} : ${at}`).toBe(true);
    }
  });
  it('the replies rebuilt on each request keep a reference version in the catalogue, with the ids the anomalies name', () => {
    const refs = onRequest.filter(isRebuiltOnRequest);
    expect(refs.map((d) => d.id).sort()).toEqual(['bons-commande-erables', 'bons-commande-peupliers', 'facture-pac-erables', 'factures-peupliers', 'os7-tilleuls', 'pv-reception-tilleuls']);
    for (const d of refs) {
      const [k] = onRequestKeys(d.availability);
      expect(SCENARIO_REPLIES[k!], d.id).toBeDefined();
      expect(answer((d.availability as { family: string }).family, k!.split(':')[1]!, '2025-11-04').map((x) => x.id), d.id).toContain(d.id);
    }
  });
  it('the label of the request never names an anomaly', () => {
    for (const d of onRequest) expect((d.availability as { request: string }).request, d.id).not.toMatch(/\bA\d{2}\b|anomalie|indice/i);
  });
  it('the components register is served per programme', () => {
    const regs = onRequest.filter((d) => d.id.startsWith('registre-composants'));
    expect(regs.length).toBeGreaterThanOrEqual(3);
    for (const d of regs) expect(onRequestKeys(d.availability)).toHaveLength(1);
    for (const o of requestObjects(p, ds, 'programme-components').slice(0, 12)) {
      const docs = answer('programme-components', o.id);
      expect(docs, o.id).toHaveLength(1);
      expect(docs[0]!.title, o.id).toContain(o.label);
    }
  });
});

describe('requests of the scenario', () => {
  it('every request of the procedures unlocks at least one document', () => {
    const keys: { family: string; object: string }[] = [];
    const walk = (c: unknown): void => {
      if (!c || typeof c !== 'object') return;
      if (Array.isArray(c)) return c.forEach(walk);
      const x = c as { kind?: string; family?: string; object?: string; of?: unknown };
      if (x.kind === 'request' && x.family) keys.push({ family: x.family, object: x.object ?? '' });
      walk(x.of);
    };
    for (const proc of p.procedures.procedures) {
      walk(proc.requires);
      if (proc.output.kind === 'requests') for (const r of proc.output.requests) keys.push({ family: r.family, object: r.object ?? '' });
    }
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(answer(k.family, k.object).length, `${k.family}:${k.object}`).toBeGreaterThan(0);
  });
  it('every key answered by a scenario document is a valid request', () => {
    for (const k of byKey.keys()) {
      const f = p.requests.families.find((x) => k === x.id || k.startsWith(`${x.id}:`))!;
      expect(f, k).toBeDefined();
      expect(validObject(f.id, k === f.id ? '' : k.slice(f.id.length + 1)), k).toBe(true);
    }
  });
});

describe('generic replies', () => {
  const scenarioIds = new Set(set.documents.map((d) => d.id));
  const objectsOf = (family: string) => {
    if (family === 'entry-voucher') {
      const n = [...numbers2025];
      return [n[0]!, n[Math.floor(n.length / 2)]!, n[n.length - 1]!].map((x) => `2025:${x}`).concat(`2024:${[...numbers2024][5]!}`);
    }
    const all = requestObjects(p, ds, family).map((o) => o.id);
    return all.length > 40 ? all.filter((_, i) => i % Math.ceil(all.length / 40) === 0) : all;
  };
  const generic: { family: string; object: string; docs: DocumentModel[] }[] = [];
  for (const f of p.requests.families) for (const o of objectsOf(f.id)) if (!byKey.has(requestKey(f.id, o))) generic.push({ family: f.id, object: o, docs: genericReplies(ctx, f.id, o, '2025-11-18') });
  const updated = generic.filter((g) => REQUEST_DATED_FAMILIES.has(g.family)).map((g) => ({ ...g, docs: genericReplies(ctx, g.family, g.object, '2026-02-23', true) }));

  it('every other object of every family gets a reply: a reply never signals « nothing here »', () => {
    expect(generic.length).toBeGreaterThan(100);
    for (const g of generic) expect(g.docs.length, `${g.family}:${g.object}`).toBeGreaterThan(0);
  });
  it('they carry no clue, answer their own key, and never collide with a scenario document', () => {
    for (const g of generic) {
      for (const d of g.docs) {
        expect(d.clues, d.id).toEqual([]);
        expect(onRequestKeys(d.availability), d.id).toEqual([requestKey(g.family, g.object)]);
        expect(scenarioIds.has(d.id), d.id).toBe(false);
        expect((d.availability as { request: string }).request, d.id).not.toContain(`${g.family}:`);
        expect(JSON.stringify(d), d.id).not.toMatch(/NaN|undefined|Infinity|\[object /);
      }
    }
  });
  it('ids are unique across the objects, and across the versions of the replies dated on the request', () => {
    const ids = [...generic, ...updated].flatMap((g) => g.docs.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(updated.length).toBeGreaterThan(20);
    for (const g of updated) for (const d of g.docs) expect(generic.find((x) => x.family === g.family && x.object === g.object)!.docs.map((x) => x.id), d.id).toContain(baseDocumentId(d.id));
  });
  it('the content of a reply dated on the request is as known on that date', () => {
    const asOf = '2025-11-17';
    const dates = (d: DocumentModel) => d.blocks.flatMap((b) => (b.kind === 'table' ? b.rows.flatMap((r) => r.cells) : b.kind === 'fields' ? b.rows.map((r) => r.value) : [])).flatMap((t) => [...t.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map((m) => `${m[3]}-${m[2]}-${m[1]}`));
    let n = 0;
    for (const f of REQUEST_DATED_FAMILIES)
      for (const o of objectsOf(f)) {
        for (const d of genericReplies(ctx, f, o, asOf)) {
          expect(d.date, d.id).toBe(asOf);
          // no date after the request, except the planned delivery of an operation in progress
          for (const x of dates(d)) if (!JSON.stringify(d.blocks).includes(`livraison prévue le ${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}`)) expect(x <= asOf, `${d.id} : ${x}`).toBe(true);
          n++;
        }
      }
    expect(n).toBeGreaterThan(40);
  });
  it('the scenario documents of the families of fixed dates look like their neighbours (same title pattern)', () => {
    const cfl = byKey.get('programme-rent-roll:CLF:2025-12')![0]!.title.replace(/ – .*$/, '');
    expect(genericReplies(ctx, 'programme-rent-roll', 'LIL:2025-12', '2025-11-18')[0]!.title.replace(/ – .*$/, '')).toBe(cfl);
  });
  it('the transmittals of the closing file are dated on or after the documents they list', () => {
    for (const [id, t] of Object.entries(CLOSING_TRANSMITTALS)) {
      for (const x of t.documents) {
        expect(t.date >= x.date, id).toBe(true);
        const doc = set.documents.find((d) => d.title === x.title.replace(/ \(délais de paiement\)$/, ''));
        if (doc) expect(doc.date, x.title).toBe(x.date);
      }
    }
  });
});

describe('scenario objects of the families answered as of the request date (plan J4 §8.2)', () => {
  const START = p.game.startDate;
  const INTERIM = p.game.calendar.find((x) => x.id === 'interim')!.from;
  const FINAL = p.game.calendar.find((x) => x.id === 'final')!.from;
  const neighbourOf = (family: string, object: string) => requestObjects(p, ds, family).find((o) => o.id !== object && !byKey.has(requestKey(family, o.id)))!.id;
  const tables = (d: DocumentModel) => d.blocks.filter((b): b is Extract<Block, { kind: 'table' }> => b.kind === 'table');
  const untagged = (d: DocumentModel) => JSON.stringify(d.blocks).replace(/,"clue":"[^"]*"/g, '');

  it('every scenario object of these families is answered by its own version of the family’s documents', () => {
    const keys = [...byKey.keys()].filter((k) => [...REQUEST_DATED_FAMILIES].some((f) => k.startsWith(`${f}:`)));
    expect(keys.sort()).toEqual(['operation-acceptance:TIL', 'operation-orders:TIL', 'programme-invoices:ERA', 'programme-invoices:PEU', 'sale-notary:CLF']);
    for (const k of keys) if (k !== 'sale-notary:CLF') expect(SCENARIO_REPLIES[k], k).toBeDefined();
  });

  for (const key of Object.keys(SCENARIO_REPLIES)) {
    const [family, object] = key.split(':') as [string, string];
    it(`${key}: same date, issuer, category, number and shape of documents as a neighbour; clues tagged only`, () => {
      const n = neighbourOf(family, object);
      for (const asOf of [START, INTERIM, FINAL]) {
        const mine = answer(family, object, asOf);
        const theirs = answer(family, n, asOf);
        expect(mine.length, `${key} ${asOf}`).toBe(theirs.length);
        mine.forEach((d, i) => {
          const o = theirs[i]!;
          expect([d.date, d.issuer, d.category, d.title.replace(/ – .*$/, '')], `${d.id} ${asOf}`).toEqual([o.date, o.issuer, o.category, o.title.replace(/ – .*$/, '')]);
          expect(d.date).toBe(asOf);
          expect(tables(d).map((t) => t.columns), d.id).toEqual(tables(o).map((t) => t.columns));
          expect(d.availability, d.id).toMatchObject({ kind: 'onRequest', family, object, asOf });
          expect(isRebuiltOnRequest(d), d.id).toBe(false);
        });
        // the clues are there from the first request of the engagement
        expect(mine.flatMap((d) => d.clues).length, `${key} ${asOf}`).toBeGreaterThan(0);
      }
    });
  }

  it('programme invoices: the scenario’s rows are the family’s rows on the request date, only tagged', () => {
    for (const pid of ['PEU', 'ERA'])
      for (const asOf of [START, FINAL]) {
        const mine = answer('programme-invoices', pid, asOf);
        const generic = genericReplies(ctx, 'programme-invoices', pid, asOf);
        expect(mine.map(untagged), `${pid} ${asOf}`).toEqual(generic.map(untagged));
      }
    // the invoices of the whole year at the final, not up to a date of the scenario
    const peu = answer('programme-invoices', 'PEU', FINAL)[0]!;
    expect(tables(peu)[0]!.rows.length).toBeGreaterThan(tables(answer('programme-invoices', 'PEU', START)[0]!)[0]!.rows.length);
  });

  it('Les Tilleuls: the orders and the acceptance are one document each, like every operation; the reception is a row', () => {
    expect(answer('operation-orders', 'TIL', START).map((d) => d.id)).toEqual(['os7-tilleuls']);
    const acc = answer('operation-acceptance', 'TIL', START)[0]!;
    expect(acc.id).toBe('pv-reception-tilleuls');
    const row = tables(acc)[0]!.rows.find((r) => r.clue)!;
    expect(row.cells[3]).toContain(date(p.scenario.specific.tilleuls.receptionDate));
    expect(tables(acc)[0]!.rows.length).toBe(tables(genericReplies(ctx, 'operation-acceptance', 'TIL', START)[0]!)[0]!.rows.length);
  });

  it('a later request gets updated documents beside the first ones; the first keep the ids the anomalies name', () => {
    const first = answer('programme-invoices', 'PEU', START);
    const later = answer('programme-invoices', 'PEU', FINAL, START);
    expect(first.map((d) => d.id)).toEqual(['factures-peupliers', 'bons-commande-peupliers']);
    expect(later.map((d) => d.id)).toEqual([`factures-peupliers~${FINAL}`, `bons-commande-peupliers~${FINAL}`]);
    expect(later.map((d) => baseDocumentId(d.id))).toEqual(first.map((d) => d.id));
    for (const d of later) for (const c of d.clues) expect(c.documentId).toBe(d.id);
    const coq = answer('sale-notary', 'COQ', FINAL, START);
    expect(coq.map((d) => d.id)).toEqual([`ventes-coquelicots~${FINAL}`]);
    // a family of fixed dates is answered by the same documents
    expect(answer('closing-file', 'pge', FINAL, START).map((d) => d.id)).toEqual(answer('closing-file', 'pge', START).map((d) => d.id));
  });

  it('a scenario piece established after the request is never listed: it arrives as mail; existing on the request date, it is attached', () => {
    const cf = p.scenario.specific.closFleuri2026;
    const before = answer('sale-notary', 'CLF', INTERIM);
    expect(before.map((d) => d.id)).toEqual(['ventes-clos-fleuri']);
    expect(before.map((d) => d.date)).toEqual(answer('sale-notary', neighbourOf('sale-notary', 'CLF'), INTERIM).map((d) => d.date));
    // the promises of December are not in the table of November
    expect(JSON.stringify(before[0]!.blocks)).not.toContain(date(cf.promiseDate));
    const after = answer('sale-notary', 'CLF', FINAL);
    expect(after.map((d) => d.id)).toEqual(['ventes-clos-fleuri', 'promesses-clos-fleuri', 'levee-condition-clos-fleuri']);
    // the supporting document of the entry of A11: the voucher like any entry; the note of the CFO (27/02/2026) only once it exists
    const a11 = [...byKey.keys()].find((k) => k.startsWith('entry-voucher:'))!;
    const object = a11.slice('entry-voucher:'.length);
    const note = byKey.get(a11)![0]!;
    const early = answer('entry-voucher', object, '2026-02-09');
    expect(early.map((d) => d.id)).toEqual([`piece-${object.replace(':', '-').toLowerCase()}`]);
    expect(answer('entry-voucher', object, addWorkingDays(cal, note.date, 1)).map((d) => d.id)).toEqual([early[0]!.id, note.id]);
    expect(builtForEveryObject('entry-voucher')).toBe(true);
    expect(builtForEveryObject('closing-file')).toBe(false);
  });
});

describe('confirmations', () => {
  const replies = scenarioConfirmations(set.documents);
  const candidates = confirmationCandidates(p, ds);
  const ids = new Set(candidates.map((c) => c.thirdParty));
  it('every scenario reply answers one third party proposed to the player', () => {
    for (const [tp, d] of replies) expect(ids.has(tp), `${d.id} → ${tp}`).toBe(true);
    const all = set.documents.filter((d) => d.availability.kind === 'confirmation');
    expect(new Set(all.map((d) => (d.availability as { request: string }).request)).size).toBe(all.length);
  });
  it('the grouped replies are split: one reply per bank and per residence manager', () => {
    for (const tp of ['BDT', 'BANK1', 'BANK2', 'BANK3', 'AL', 'HABITAT_INSERTION', 'CCAS_AURELLE']) expect(replies.has(tp), tp).toBe(true);
  });
  it('the silent third party never replies; every other candidate gets a reply (scenario or « sans écart »)', () => {
    for (const tp of p.requests.confirmations.nonResponders) {
      expect(replies.has(tp), tp).toBe(false);
      expect(genericConfirmationReply(ctx, tp), tp).toBeNull();
    }
    for (const c of candidates) {
      if (p.requests.confirmations.nonResponders.includes(c.thirdParty) || replies.has(c.thirdParty)) continue;
      const r = genericConfirmationReply(ctx, c.thirdParty)!;
      expect(r, c.thirdParty).not.toBeNull();
      expect(r.clues, c.thirdParty).toEqual([]);
      expect(r.availability).toMatchObject({ kind: 'confirmation', request: c.thirdParty });
      expect(JSON.stringify(r), c.thirdParty).not.toMatch(/NaN|undefined|Infinity/);
      expect(r.date > p.documents.calendar['confirmationsSent']!, c.thirdParty).toBe(true);
    }
  });
  it('no document says that a reminder had no effect (the reminder is a player action)', () => {
    for (const d of set.documents) expect(JSON.stringify(d), d.id).not.toMatch(/sans effet/i);
  });
  it('the general contractor of the Tilleuls confirms its claim and disputes the penalties, like the lawyer', () => {
    const f22 = replies.get('F0022')!;
    const lawyer = replies.get('F0033')!;
    expect(f22.clues.map((c) => c.parts?.[0]).sort()).toEqual(['A16.a', 'A16.b']);
    expect(lawyer.clues.map((c) => c.parts?.[0]).sort()).toEqual(['A16.a', 'A16.b']);
  });
  it('every reply arrives before the end of the final', () => {
    for (const d of replies.values()) expect((d.availability as { arrives: string }).arrives <= FINAL_END, d.id).toBe(true);
  });
});
