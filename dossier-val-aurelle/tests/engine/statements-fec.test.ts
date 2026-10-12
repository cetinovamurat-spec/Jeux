import { describe, expect, it } from 'vitest';
import { closingBalances, trialBalance } from '../../src/engine/balance';
import { importChart, parseChartCsv } from '../../src/engine/chart';
import { buildFec, fecToText, FEC_FIELDS } from '../../src/engine/fec';
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
