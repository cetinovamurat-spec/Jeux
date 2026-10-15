/** Balance and general-ledger helpers (src/game/ledger.ts) on synthetic FEC lines. */
import { describe, expect, it } from 'vitest';
import type { FecLineInternal } from '../../src/engine/types';
import {
  accountLedger,
  accountLineIndex,
  balanceCheck,
  balanceTotals,
  compareLedgerLines,
  EMPTY_BALANCE_FILTER,
  EMPTY_LEDGER_FILTER,
  filterBalance,
  filterLedger,
  groupByAux,
  isLedgerFilterActive,
  ledgerLineMatcher,
  matchesAccount,
  neighbours,
  NO_AUX,
  parseDecimal,
  resolveAccount,
  topAccounts,
  variation,
  type BalanceLine,
} from '../../src/game/ledger';

let seq = 0;

function line(over: Partial<FecLineInternal> & { account: string; debit?: number; credit?: number }): FecLineInternal {
  const { account, debit = 0, credit = 0, ...rest } = over;
  seq++;
  const date = rest.date ?? '2025-03-15';
  return {
    JournalCode: 'OD',
    JournalLib: 'Opérations diverses',
    EcritureNum: `OD${String(seq).padStart(6, '0')}`,
    EcritureDate: date.replaceAll('-', ''),
    CompteNum: account,
    CompteLib: `Compte ${account}`,
    CompAuxNum: '',
    CompAuxLib: '',
    PieceRef: '',
    PieceDate: '',
    EcritureLib: 'Écriture',
    Debit: '',
    Credit: '',
    EcritureLet: '',
    DateLet: '',
    ValidDate: '',
    Montantdevise: '',
    Idevise: '',
    entryId: `e${seq}`,
    enteredBy: 'USER',
    debitCents: debit,
    creditCents: credit,
    date,
    validDate: date,
    ...rest,
  };
}

function bal(account: string, prior: number, closing: number, label = `Compte ${account}`): BalanceLine {
  return { account, label, prior, opening: prior, debit: Math.max(0, closing - prior), credit: Math.max(0, prior - closing), closing };
}

describe('variation', () => {
  it('amount is closing − prior, ratio relative to |prior|', () => {
    expect(variation(1000, 1500)).toEqual({ amount: 500, ratio: 0.5 });
    expect(variation(-2000, -1000)).toEqual({ amount: 1000, ratio: 0.5 });
    expect(variation(-2000, -3000)).toEqual({ amount: -1000, ratio: -0.5 });
  });
  it('no ratio when the prior balance is zero', () => {
    expect(variation(0, 700)).toEqual({ amount: 700, ratio: null });
    expect(variation(0, 0)).toEqual({ amount: 0, ratio: null });
  });
});

describe('balance filters', () => {
  const rows = [bal('101300', -500000, -500000, 'Capital souscrit – appelé, versé'), bal('2131', 800000, 900000, 'Bâtiments'), bal('4111', 1000, 3000, 'Locataires'), bal('6061', 0, 0, 'Fournitures non stockables'), bal('706', 0, -40000, 'Prestations de services'), bal('512', 0, 0, 'Banques')];

  it('matches an account prefix or the words of the label, without accents', () => {
    expect(matchesAccount('2131', 'Bâtiments', '21')).toBe(true);
    expect(matchesAccount('2131', 'Bâtiments', '31')).toBe(false);
    expect(matchesAccount('2131', 'Bâtiments', 'batim')).toBe(true);
    expect(matchesAccount('2131', 'Bâtiments', 'BÂTIMENTS 213')).toBe(true);
    expect(matchesAccount('2131', 'Bâtiments', 'terrains')).toBe(false);
    expect(matchesAccount('2131', 'Bâtiments', '  ')).toBe(true);
  });

  it('filters by class, text, minimum variation in euros and in percentage', () => {
    const accounts = (f: Partial<typeof EMPTY_BALANCE_FILTER>) => filterBalance(rows, { ...EMPTY_BALANCE_FILTER, ...f }).map((r) => r.account);
    expect(accounts({})).toHaveLength(rows.length);
    expect(accounts({ accountClass: '2' })).toEqual(['2131']);
    expect(accounts({ text: 'capital' })).toEqual(['101300']);
    expect(accounts({ minVariation: 2000 })).toEqual(['2131', '4111', '706']);
    expect(accounts({ minVariation: 50000 })).toEqual(['2131']);
    // 2131: +12,5 % ; 4111: +200 % ; 706: new account (infinite) ; settled accounts: no variation.
    expect(accounts({ minRatio: 0.2 })).toEqual(['4111', '706']);
    expect(accounts({ minRatio: 0.1 })).toEqual(['2131', '4111', '706']);
  });

  it('hides accounts settled at both closing dates', () => {
    const shown = filterBalance(rows, { ...EMPTY_BALANCE_FILTER, hideSettled: true }).map((r) => r.account);
    expect(shown).not.toContain('6061');
    expect(shown).not.toContain('512');
    expect(shown).toContain('706');
  });

  it('totals and balance check', () => {
    const balanced = [bal('2131', 1000, 1500), bal('164', -1000, -1500)];
    expect(balanceTotals(balanced)).toMatchObject({ count: 2, prior: 0, closing: 0 });
    expect(balanceCheck(balanced)).toEqual({ prior: 0, current: 0, balanced: true });
    expect(balanceCheck([...balanced, bal('471', 0, 5)])).toEqual({ prior: 0, current: 5, balanced: false });
  });

  it('top accounts by a score', () => {
    expect(topAccounts(rows, (r) => Math.abs(r.closing), 3).map((r) => r.account)).toEqual(['2131', '101300', '706']);
    expect(topAccounts(rows, (r) => Math.abs(r.closing), 10)).toHaveLength(4);
  });
});

describe('parseDecimal', () => {
  it('reads fr-FR and plain numbers', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('1 234,5')).toBe(1234.5);
    expect(parseDecimal('1 234,50')).toBe(1234.5);
    expect(parseDecimal('1234.5')).toBe(1234.5);
    expect(parseDecimal('−3')).toBe(-3);
    expect(parseDecimal('10')).toBe(10);
  });
  it('NaN for an invalid text', () => {
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });
});

describe('account ledger', () => {
  const fec = [
    line({ account: '4111', debit: 300, date: '2025-02-10', EcritureNum: 'VT000002', JournalCode: 'VT', CompAuxNum: 'L002', CompAuxLib: 'Martin' }),
    line({ account: '706', credit: 300, date: '2025-02-10', EcritureNum: 'VT000002', JournalCode: 'VT' }),
    line({ account: '4111', debit: 500, date: '2025-01-31', EcritureNum: 'VT000001', JournalCode: 'VT', CompAuxNum: 'L001', CompAuxLib: 'Durand', EcritureLib: 'Quittancement janvier' }),
    line({ account: '4111', credit: 200, date: '2025-02-10', EcritureNum: 'BQ000001', JournalCode: 'BQ', CompAuxNum: 'L001', CompAuxLib: 'Durand', EcritureLib: 'Règlement Durand', PieceRef: 'REM-12' }),
    line({ account: '4111', debit: 1000, date: '2025-01-01', EcritureNum: 'AN000001', JournalCode: 'AN' }),
    line({ account: '4111', credit: 100, date: '2025-01-01', EcritureNum: 'OD000001', JournalCode: 'OD' }),
  ];

  it('opening entries first, then by date, then by entry number', () => {
    const l = accountLedger(fec, '4111');
    expect(l.rows.map((r) => r.line.EcritureNum)).toEqual(['AN000001', 'OD000001', 'VT000001', 'BQ000001', 'VT000002']);
    expect(l.rows.map((r) => r.index)).toEqual([4, 5, 2, 3, 0]);
    expect(l.rows[0]!.opening).toBe(true);
    expect(l.rows.slice(1).every((r) => !r.opening)).toBe(true);
  });

  it('running balance (debit positive) and totals', () => {
    const l = accountLedger(fec, '4111');
    expect(l.rows.map((r) => r.balance)).toEqual([1000, 900, 1400, 1200, 1500]);
    expect(l).toMatchObject({ account: '4111', debit: 1800, credit: 300, movementDebit: 800, movementCredit: 300, opening: 1000, balance: 1500 });
    expect(l.opening + l.movementDebit - l.movementCredit).toBe(l.balance);
  });

  it('the account index gives the same ledger', () => {
    const idx = accountLineIndex(fec);
    expect(idx.get('4111')).toEqual([0, 2, 3, 4, 5]);
    expect(idx.get('706')).toEqual([1]);
    expect(accountLedger(fec, '4111', idx.get('4111'))).toEqual(accountLedger(fec, '4111'));
    expect(accountLedger(fec, '999').rows).toEqual([]);
  });

  it('compareLedgerLines puts the opening lines first whatever their date', () => {
    const an = line({ account: '1', JournalCode: 'AN', date: '2025-02-24', EcritureNum: 'AN000001' });
    const od = line({ account: '1', JournalCode: 'OD', date: '2025-01-01', EcritureNum: 'OD000001' });
    expect(compareLedgerLines(an, od)).toBeLessThan(0);
    expect(compareLedgerLines(od, an)).toBeGreaterThan(0);
  });

  it('filters recompute the running balance on the kept lines', () => {
    const l = accountLedger(fec, '4111');
    const durand = filterLedger(l, ledgerLineMatcher({ ...EMPTY_LEDGER_FILTER, aux: 'L001' }));
    expect(durand.rows.map((r) => r.balance)).toEqual([500, 300]);
    expect(durand).toMatchObject({ debit: 500, credit: 200, balance: 300, opening: 0 });
    const noAux = filterLedger(l, ledgerLineMatcher({ ...EMPTY_LEDGER_FILTER, aux: NO_AUX }));
    expect(noAux.rows.map((r) => r.line.EcritureNum)).toEqual(['AN000001', 'OD000001']);
    expect(noAux.opening).toBe(1000);
    const bank = filterLedger(l, ledgerLineMatcher({ ...EMPTY_LEDGER_FILTER, journal: 'BQ' }));
    expect(bank.rows.map((r) => r.line.EcritureNum)).toEqual(['BQ000001']);
    const text = filterLedger(l, ledgerLineMatcher({ ...EMPTY_LEDGER_FILTER, text: 'reglement' }));
    expect(text.rows.map((r) => r.line.EcritureNum)).toEqual(['BQ000001']);
    const piece = filterLedger(l, ledgerLineMatcher({ ...EMPTY_LEDGER_FILTER, text: 'rem-12' }));
    expect(piece.rows).toHaveLength(1);
    // ligatures are folded as in the GED and the FEC: « oeuvre » finds « maîtrise d’œuvre »
    const works = [
      line({ account: '2313', debit: 900, EcritureLib: 'Honoraires de maîtrise d’œuvre' }),
      line({ account: '2313', debit: 100, EcritureLib: 'Recouvrement des frais' }),
    ];
    const lumen = accountLedger(works, '2313');
    for (const typed of ['oeuvre', 'œuvre', "maitrise d'oeuvre", 'MAÎTRISE D’ŒUVRE'])
      expect(
        filterLedger(lumen, ledgerLineMatcher({ ...EMPTY_LEDGER_FILTER, text: typed })).rows.map((r) => r.line.EcritureLib),
        typed,
      ).toEqual(['Honoraires de maîtrise d’œuvre']);
    expect(isLedgerFilterActive(EMPTY_LEDGER_FILTER)).toBe(false);
    expect(isLedgerFilterActive({ ...EMPTY_LEDGER_FILTER, text: ' x ' })).toBe(true);
  });

  it('groups by auxiliary account, lines without auxiliary last', () => {
    const groups = groupByAux(accountLedger(fec, '4111').rows.map((r) => r.line));
    expect(groups).toEqual([
      { aux: 'L001', label: 'Durand', count: 2, debit: 500, credit: 200, balance: 300 },
      { aux: 'L002', label: 'Martin', count: 1, debit: 300, credit: 0, balance: 300 },
      { aux: '', label: '', count: 2, debit: 1000, credit: 100, balance: 900 },
    ]);
    const total = groups.reduce((s, g) => s + g.balance, 0);
    expect(total).toBe(accountLedger(fec, '4111').balance);
  });
});

describe('account picker', () => {
  const sorted = ['1013', '2131', '4111', '706'];
  it('previous and next accounts', () => {
    expect(neighbours(sorted, '2131')).toEqual({ prev: '1013', next: '4111' });
    expect(neighbours(sorted, '1013')).toEqual({ prev: null, next: '2131' });
    expect(neighbours(sorted, '706')).toEqual({ prev: '4111', next: null });
    expect(neighbours(sorted, '3')).toEqual({ prev: '2131', next: '4111' });
    expect(neighbours([], '3')).toEqual({ prev: null, next: null });
  });
  it('resolves what is typed', () => {
    const accounts = [
      { account: '2131', label: 'Bâtiments' },
      { account: '4111', label: 'Locataires' },
      { account: '41181', label: 'Locataires – produits non encore facturés' },
    ];
    expect(resolveAccount('4111 – Locataires', accounts)).toBe('4111');
    expect(resolveAccount('4111', accounts)).toBe('4111');
    expect(resolveAccount('411', accounts)).toBe('4111');
    expect(resolveAccount('4118', accounts)).toBe('41181');
    expect(resolveAccount('batiments', accounts)).toBe('2131');
    expect(resolveAccount('non encore', accounts)).toBe('41181');
    expect(resolveAccount('9', accounts)).toBeNull();
    const banks = [
      { account: '1631', label: 'Emprunts auprès de la Caisse des dépôts (Banque des Territoires)' },
      { account: '5121', label: 'Banque – compte courant' },
    ];
    expect(resolveAccount('banque', banks)).toBe('5121');
    expect(resolveAccount('territoires', banks)).toBe('1631');
    expect(resolveAccount('', accounts)).toBeNull();
  });
});
