/** Data vintages: availability by date, extraction at the interim cutoff (prefix of the final FEC). */
import { describe, expect, it } from 'vitest';
import { closingBalances } from '../../src/engine/balance';
import { buildFec } from '../../src/engine/fec';
import { dataViewAt, inExtraction, ledgerAt } from '../../src/game/vintages';
import { loadParams } from '../../src/scenario/params';
import { correctionKey } from '../helpers/scenario';

const params = loadParams();
const at = (date: string, interimObtained = false, designer = false) => dataViewAt(params, { date, interimObtained, designer });

describe('availability of the 2025 data', () => {
  it('nothing of 2025 at the planning unless the extraction was obtained', () => {
    expect(at('2025-11-03')).toMatchObject({ ledger2025: 'none', statements2025: false });
    expect(at('2025-11-05', true)).toMatchObject({ ledger2025: 'interim', cutoff: '2025-10-31', priorCutoff: '2024-10-31' });
  });
  it('the extraction is handed over at the interim, the final ledger and the draft statements at their dates', () => {
    expect(at('2025-11-17').ledger2025).toBe('interim');
    expect(at('2026-02-05')).toMatchObject({ ledger2025: 'interim', statements2025: false });
    expect(at('2026-02-06')).toMatchObject({ ledger2025: 'draft', statements2025: false, cutoff: '2025-12-31' });
    expect(at('2026-02-20')).toMatchObject({ ledger2025: 'draft', statements2025: true });
  });
  it('designer mode sees everything', () => {
    expect(at('2025-11-03', false, true)).toMatchObject({ ledger2025: 'draft', statements2025: true });
  });
});

describe('extraction at the interim cutoff', () => {
  const w = correctionKey().presented.world;
  const cutoff = params.game.dataVintages.interim.cutoff;
  const full = buildFec(w.ledgers.current, w.chart, w.journals, w.auxiliaries);
  const ext = ledgerAt(w.ledgers.current, cutoff);
  const fec = buildFec(ext, w.chart, w.journals, w.auxiliaries);

  it('keeps the entries validated on or before the cutoff, opening entries included', () => {
    expect(ext.entries.length).toBeGreaterThan(0);
    expect(ext.entries.length).toBeLessThan(w.ledgers.current.entries.length);
    expect(ext.entries.every((e) => inExtraction(e, cutoff))).toBe(true);
    expect(w.ledgers.current.entries.filter((e) => inExtraction(e, cutoff)).length).toBe(ext.entries.length);
  });
  it('its FEC is a prefix of the final FEC, with the same entry numbers', () => {
    expect(fec.length).toBeLessThan(full.length);
    fec.forEach((l, i) => {
      const f = full[i]!;
      expect([l.EcritureNum, l.CompteNum, l.debitCents, l.creditCents, l.entryId]).toEqual([f.EcritureNum, f.CompteNum, f.debitCents, f.creditCents, f.entryId]);
    });
    expect(full[fec.length]!.validDate > cutoff).toBe(true);
  });
  it('shows no lettering made after the cutoff', () => {
    const cut = cutoff.replaceAll('-', '');
    expect(fec.every((l) => l.DateLet === '' || l.DateLet <= cut)).toBe(true);
    expect(full.slice(0, fec.length).some((l) => l.DateLet > cut)).toBe(true); // the final FEC does carry later letterings
  });
  it('its balance is the balance of its FEC', () => {
    const fromFec = new Map<string, number>();
    for (const l of fec) fromFec.set(l.CompteNum, (fromFec.get(l.CompteNum) ?? 0) + l.debitCents - l.creditCents);
    const b = closingBalances(ext);
    for (const [acc, v] of b) expect(fromFec.get(acc) ?? 0, acc).toBe(v);
    expect([...b.values()].reduce((s, v) => s + v, 0)).toBe(0);
  });
});
