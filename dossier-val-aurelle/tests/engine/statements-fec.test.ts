import { describe, expect, it } from 'vitest';
import { closingBalances, trialBalance } from '../../src/engine/balance';
import { importChart, parseChartCsv } from '../../src/engine/chart';
import { buildFec, compareFecEntries, fecToText, FEC_FIELDS } from '../../src/engine/fec';
import { credit, debit, checkEntry } from '../../src/engine/ledger';
import type { JournalEntry, Ledger } from '../../src/engine/types';
import { loadParams } from '../../src/scenario/params';

const e = (id: string, date: string, validDate: string, lines: JournalEntry['lines']): JournalEntry => ({ id, journal: 'OD', date, label: id, lines, validDate, enteredBy: 'U', origin: 'test' });

describe('ledger, balance and FEC', () => {
  const ledger: Ledger = {
    fiscalYear: 2025,
    openingDate: '2025-01-01',
    closingDate: '2025-12-31',
    entries: [
      e('late', '2025-12-31', '2026-02-03', [debit('4687', 30_000_000), credit('7088', 30_000_000)]),
      e('early', '2025-12-15', '2025-12-16', [debit('5121', 10_000), credit('7088', 10_000)]),
    ],
  };
  it('checks entries', () => {
    expect(checkEntry(ledger.entries[0]!)).toEqual([]);
    expect(checkEntry(e('bad', '2025-01-01', '2025-01-01', [debit('5121', 1), credit('7088', 2)]))).toHaveLength(1);
  });
  it('numbers FEC entries in validation order and exports 18 fields', () => {
    const p = loadParams();
    const fec = buildFec(ledger, p.chart, [{ code: 'OD', label: 'Opérations diverses', kind: 'misc' }], {});
    expect(fec[0]!.EcritureNum).toBe('OD000001');
    expect(fec[0]!.entryId).toBe('early');
    expect(fec.find((l) => l.entryId === 'late')!.EcritureNum).toBe('OD000002');
    expect(fec.find((l) => l.entryId === 'late')!.ValidDate).toBe('20260203');
    const text = fecToText(fec);
    expect(text.split('\r\n')[0]!.split('|')).toHaveLength(18);
    expect(FEC_FIELDS).toHaveLength(18);
  });
  it('puts the opening entries (AN) first, whatever their validation date, without changing the numbering', () => {
    const p = loadParams();
    const journals = [
      { code: 'AN', label: 'À-nouveaux', kind: 'opening' as const },
      { code: 'OD', label: 'Opérations diverses', kind: 'misc' as const },
    ];
    const opening: JournalEntry = { ...e('opening', '2025-01-01', '2025-02-24', [debit('5121', 50_000), credit('1068', 50_000)]), journal: 'AN' };
    const january = e('january', '2025-01-03', '2025-01-03', [debit('5121', 1_000), credit('7088', 1_000)]);
    const withOpening: Ledger = { ...ledger, entries: [january, ...ledger.entries, opening] };
    const fec = buildFec(withOpening, p.chart, journals, {});
    expect(fec.slice(0, 2).map((l) => [l.JournalCode, l.EcritureNum, l.ValidDate])).toEqual([
      ['AN', 'AN000001', '20250224'],
      ['AN', 'AN000001', '20250224'],
    ]);
    // the other entries keep the validation order and their per-journal numbers
    expect([...new Set(fec.slice(2).map((l) => `${l.entryId}:${l.EcritureNum}`))]).toEqual(['january:OD000001', 'early:OD000002', 'late:OD000003']);
    const text = fecToText(fec).split('\r\n');
    expect(text[1]!.startsWith('AN|')).toBe(true);
    // comparator: AN before any other journal, then (ValidDate, date, id)
    expect(compareFecEntries(opening, january)).toBeLessThan(0);
    expect(compareFecEntries(january, opening)).toBeGreaterThan(0);
    expect(compareFecEntries(january, ledger.entries[1]!)).toBeLessThan(0);
    expect(compareFecEntries(january, january)).toBe(0);
  });
  it('builds a balanced trial balance', () => {
    const tb = trialBalance(ledger, loadParams().chart);
    expect(tb.totals.closing).toBe(0);
    expect(closingBalances(ledger).get('7088')).toBe(-30_010_000);
  });
});

describe('chart of accounts', () => {
  it('parses the proposed chart and flags accounts to validate', () => {
    const chart = loadParams().chart;
    expect(chart.accounts.length).toBeGreaterThan(100);
    expect(chart.accounts.some((a) => a.toValidate)).toBe(true);
    expect(new Set(chart.accounts.map((a) => a.number)).size).toBe(chart.accounts.length);
  });
  it('reports accounts missing from an imported official chart', () => {
    const current = loadParams().chart;
    const csv = 'numero;libelle;classe;sens;rubrique_debit;rubrique_credit;rubrique_annexe;poste_caf;a_valider;commentaire\n5121;Banque;5;D;;;;;non;\n';
    const report = importChart(csv, current, ['5121', '7088'], 'Officiel');
    expect(report.missing).toEqual(['7088']);
    expect(report.chart.accounts[0]!.rubriqueDebit).toBe('A_DISPO');
    expect(parseChartCsv(csv, 'x').accounts).toHaveLength(1);
  });
});
