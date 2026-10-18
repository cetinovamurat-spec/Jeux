/**
 * Integrity of the requests and confirmations (plan J4 §8, §9, §16): every
 * document given on request answers an existing (family, object) with the
 * right interlocutor and reaches the auditor before the end of the final;
 * every request of the scenario unlocks a document; every other object gets a
 * generic reply without clue; the confirmation replies are split by third
 * party and the silent third party never replies.
 */
import { describe, expect, it } from 'vitest';
import { addWorkingDays, workCalendar } from '../../src/game/calendar';
import { confirmationCandidates } from '../../src/game/confirmations';
import { delayDays, interlocutorOf, requestObjects } from '../../src/game/requests';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { genericConfirmationReply, genericReplies, makeContext, onRequestKeys, requestKey, scenarioConfirmations, scenarioRequestKeys } from '../../src/scenario/documents';
import { CLOSING_TRANSMITTALS, fecNumbers } from '../../src/scenario/documents/replies';
import type { DocumentModel } from '../../src/scenario/documents/model';
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

/** Documents answering a request key: the scenario's, or the generic replies. */
function answer(family: string, object: string, asOf = '2026-02-23'): readonly DocumentModel[] {
  return byKey.get(requestKey(family, object)) ?? genericReplies(ctx, family, object, asOf);
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
  it('ids are unique across the objects', () => {
    const ids = generic.flatMap((g) => g.docs.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('the scenario documents look like their neighbours (same title pattern)', () => {
    const peu = byKey.get('programme-invoices:PEU')!.map((d) => d.title.replace(/ – .*$/, ''));
    const lil = genericReplies(ctx, 'programme-invoices', 'LIL', '2025-11-18').map((d) => d.title.replace(/ – .*$/, ''));
    expect(peu.sort()).toEqual(lil.sort());
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
