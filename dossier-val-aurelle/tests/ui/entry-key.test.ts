/** Public key of the FEC entries in the addresses: the FEC number, never the internal id (which can name an anomaly). */
import { describe, expect, it } from 'vitest';
import { buildFec } from '../../src/engine/fec';
import { buildFecIndex } from '../../src/game/fec-query';
import { entryIdsByNumber, entryNumber } from '../../src/ui/screens/fec/entryKey';
import { correctionKey } from '../helpers/scenario';

describe('entry keys of the FEC explorer and the general ledger', () => {
  const w = correctionKey().presented.world;
  for (const [year, ledger, closingDate] of [
    [2025, w.ledgers.current, '2025-12-31'],
    [2024, w.ledgers.prior, '2024-12-31'],
  ] as const) {
    it(`maps every entry of ${year} to a FEC number and back`, () => {
      const index = buildFecIndex(buildFec(ledger, w.chart, w.journals, w.auxiliaries), { closingDate });
      const byNumber = entryIdsByNumber(index);
      expect(byNumber.size).toBe(index.entryLines.size);
      for (const id of index.entryLines.keys()) {
        const num = entryNumber(index, id)!;
        expect(byNumber.get(num)).toBe(id);
        // the public key is a journal code and a sequence number, whatever the origin of the entry
        expect(num, id).toMatch(/^[A-Z]{2}\d{6}$/);
      }
    });
  }
  it('internal ids of entries created by anomalies do carry their tag (reason for the public key)', () => {
    const ids = [...w.ledgers.current.entries].map((e) => e.id);
    expect(ids.some((id) => /:A\d\d:/.test(id))).toBe(true);
  });
});
