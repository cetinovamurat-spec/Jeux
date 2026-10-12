/** §9 and §3.4 — documents: volume, clues (≥ 2 independent per anomaly), false leads, references. */
import { describe, expect, it } from 'vitest';
import { ANOMALIES } from '../../src/scenario/anomalies/modules';
import { documents } from '../helpers/scenario';

describe('documents', () => {
  const set = documents();
  it('about seventy documents or more, a share of realistic noise', () => {
    expect(set.documents.length).toBeGreaterThanOrEqual(70);
    expect(set.documents.filter((d) => d.noise).length / set.documents.length).toBeGreaterThanOrEqual(0.15);
    expect(set.documents.filter((d) => d.noise && d.clues.length > 0).map((d) => d.id)).toEqual([]);
  });
  it('every anomaly has at least two clues in two different documents', () => {
    for (const m of ANOMALIES) {
      const docs = new Set(set.cluesOf(m.id).map((c) => c.documentId));
      expect(docs.size, m.id).toBeGreaterThanOrEqual(2);
    }
  });
  it('every false lead is dismissed by at least two documents, which exist', () => {
    for (const f of set.falseLeads) {
      expect(new Set(set.cluesOf(f.id).map((c) => c.documentId)).size, f.id).toBeGreaterThanOrEqual(2);
      for (const e of f.evidence) expect(set.byId.has(e), `${f.id} → ${e}`).toBe(true);
    }
  });
  it('every clue is carried by a block of its document and every tagged block refers to a clue', () => {
    for (const d of set.documents) {
      const ids = new Set(d.clues.map((c) => c.id));
      const tagged = new Set<string>();
      for (const b of d.blocks) {
        const tags = 'clue' in b && b.clue ? [b.clue] : [];
        if (b.kind === 'fields') for (const r of b.rows) if (r.clue) tags.push(r.clue);
        if (b.kind === 'table') for (const r of b.rows) if (r.clue) tags.push(r.clue);
        if (b.kind === 'list') for (const r of b.items) if (r.clue) tags.push(r.clue);
        for (const t of tags) {
          expect(ids.has(t), `${d.id}: ${t}`).toBe(true);
          tagged.add(t);
        }
      }
      for (const id of ids) expect(tagged.has(id), `${d.id}: indice ${id} non porté par un bloc`).toBe(true);
    }
  });
  it('documents referenced by signatures and negotiation stances exist', () => {
    for (const m of ANOMALIES) {
      for (const s of m.stance) for (const e of s.requiredEvidence ?? []) expect(set.byId.has(e), `${m.id} → ${e}`).toBe(true);
      for (const p of m.parts) for (const o of p.signature.objects) if (o.kind === 'document') expect(set.byId.has(o.id), `${p.id} → ${o.id}`).toBe(true);
    }
  });
  it('no unresolved value in any document', () => {
    for (const d of set.documents) expect(JSON.stringify(d), d.id).not.toMatch(/NaN|undefined|Infinity|\[object /);
  });
});
