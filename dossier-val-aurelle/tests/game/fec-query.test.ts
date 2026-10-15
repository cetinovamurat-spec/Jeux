/** Journal-entry testing on the FEC: index, every filter of runQuery, pairs, descriptions, presets, inputs, exports. */
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/engine/csv';
import { isWeekend } from '../../src/engine/dates';
import { buildFec, FEC_FIELDS } from '../../src/engine/fec';
import { formatEuro, formatFecAmount } from '../../src/engine/format';
import type { FecLineInternal } from '../../src/engine/types';
import {
  buildFecIndex,
  CSV_USER_FIELD,
  describeQuery,
  EMPTY_QUERY,
  entryLinesOf,
  euroInputText,
  fecToCsv,
  isEmptyQuery,
  journalSummary,
  normalize,
  pairsOf,
  parseAccountPrefixes,
  parseEuroAmount,
  queryKey,
  rarePairsOf,
  runQuery,
  sameQuery,
  standardTests,
  type FecIndex,
  type FecQuery,
} from '../../src/game/fec-query';
import { correctionKey } from '../helpers/scenario';

// ---------------------------------------------------------------------------
// synthetic FEC
// ---------------------------------------------------------------------------

interface EntrySpec {
  id: string;
  journal?: string;
  date?: string;
  validDate?: string;
  user?: string;
  piece?: string;
  label?: string;
  /** [account, debit, credit, aux?, auxLabel?, accountLabel?] in cents */
  lines: [string, number, number, string?, string?, string?][];
}

const fecDate = (iso: string) => iso.replaceAll('-', '');

function entry(spec: EntrySpec): FecLineInternal[] {
  const journal = spec.journal ?? 'OD';
  const date = spec.date ?? '2025-03-04';
  const validDate = spec.validDate ?? '2025-03-05';
  return spec.lines.map(([account, debit, credit, aux = '', auxLabel = '', accountLabel = `Compte ${account}`]) => ({
    JournalCode: journal,
    JournalLib: `Journal ${journal}`,
    EcritureNum: spec.id,
    EcritureDate: fecDate(date),
    CompteNum: account,
    CompteLib: accountLabel,
    CompAuxNum: aux,
    CompAuxLib: auxLabel,
    PieceRef: spec.piece ?? `P-${spec.id}`,
    PieceDate: '',
    EcritureLib: spec.label ?? 'Opération courante',
    Debit: formatFecAmount(debit),
    Credit: formatFecAmount(credit),
    EcritureLet: '',
    DateLet: '',
    ValidDate: fecDate(validDate),
    Montantdevise: '',
    Idevise: '',
    entryId: spec.id,
    enteredBy: spec.user ?? 'KHADDAD',
    debitCents: debit,
    creditCents: credit,
    date,
    validDate,
  }));
}

// 2025-03-04 is a Tuesday, 2025-03-08 a Saturday, 2025-03-09 a Sunday.
const SPECS: EntrySpec[] = [
  // opening entry: never used for pair rarity
  { id: 'AN1', journal: 'AN', date: '2025-01-01', validDate: '2025-01-01', user: 'MIGRATION', lines: [['512', 500000, 0], ['401', 0, 500000]] },
  // a frequent pair 6061 → 401 (three entries)
  { id: 'AC1', journal: 'AC', user: 'SLEFEBVRE', label: 'Facture électricité', lines: [['6061', 12345, 0], ['401', 0, 12345, 'F001', 'Énergie Aurelloise']] },
  { id: 'AC2', journal: 'AC', user: 'SLEFEBVRE', label: 'Facture électricité', date: '2025-03-08', lines: [['6061', 100000, 0], ['401', 0, 100000, 'F001', 'Énergie Aurelloise']] },
  { id: 'AC3', journal: 'AC', user: 'SLEFEBVRE', label: 'Facture électricité', lines: [['6061', 5000, 0], ['401', 0, 5000, 'F002', 'Société générale d’électricité']] },
  // the opening pair 512 → 401 reused once: its count must not include the opening entry
  { id: 'BQ1', journal: 'BQ', user: 'MDUBOIS', validDate: '2025-03-09', label: 'Règlement fournisseur', lines: [['401', 7000, 0, 'F001', 'Énergie Aurelloise'], ['512', 0, 7000]] },
  // rare pair 4687 → 7088, after closing, no piece, round amount
  { id: 'OD1', journal: 'OD', user: 'NFERRAND', date: '2025-12-31', validDate: '2026-02-03', piece: '', label: 'Régularisation produits à recevoir', lines: [['4687', 3000000, 0, '', '', 'Produits à recevoir'], ['7088', 0, 3000000]] },
  // large summary entry (more than maxLinesForPairs lines): left out of the pair statistics
  {
    id: 'QT1',
    journal: 'QT',
    user: 'ITF_LG2',
    lines: [['4111', 10000, 0], ['4111', 20000, 0], ['4111', 30000, 0], ['4111', 40000, 0], ['704', 0, 100000]],
  },
  // same pair as the opening entry (512 → 401): seen once, since the opening entry is not counted
  { id: 'BQ2', journal: 'BQ', user: 'KHADDAD', label: 'Remboursement reçu', lines: [['512', 2500, 0], ['401', 0, 2500]] },
];
const LINES: FecLineInternal[] = SPECS.flatMap(entry);
const MAX_LINES = 4;

function makeIndex(): FecIndex {
  return buildFecIndex(LINES, { closingDate: '2025-12-31', maxLinesForPairs: MAX_LINES });
}

function run(index: FecIndex, q: Partial<FecQuery>) {
  return runQuery(index, { ...EMPTY_QUERY, ...q });
}

/** Ids of the entries of the retained lines, in order of appearance. */
function entryIds(index: FecIndex, lines: readonly number[]): string[] {
  return [...new Set(lines.map((i) => index.lines[i]!.entryId))];
}

// ---------------------------------------------------------------------------

describe('buildFecIndex', () => {
  const index = makeIndex();
  it('groups the lines of each entry in FEC order and lists journals and users', () => {
    expect(index.entryLines.get('AC1')).toEqual([2, 3]);
    expect(index.entryLines.size).toBe(SPECS.length);
    expect(index.journals).toEqual(['AC', 'AN', 'BQ', 'OD', 'QT']);
    expect(index.users).toEqual(['ITF_LG2', 'KHADDAD', 'MDUBOIS', 'MIGRATION', 'NFERRAND', 'SLEFEBVRE'].filter((u) => LINES.some((l) => l.enteredBy === u)));
    expect(index.closingDate).toBe('2025-12-31');
    expect(index.maxLinesForPairs).toBe(MAX_LINES);
  });
  it('counts debit→credit pairs per entry, without the opening entry and the large entries', () => {
    expect(index.pairCounts.get('6061→401')).toBe(3);
    expect(index.pairCounts.get('401→512')).toBe(1);
    expect(index.pairCounts.get('512→401')).toBe(1);
    expect(index.pairCounts.get('4687→7088')).toBe(1);
    expect(index.pairCounts.get('4111→704')).toBeUndefined();
    expect(index.entryPairs.has('AN1')).toBe(false);
    expect(index.entryPairs.has('QT1')).toBe(false);
    expect(index.entryPairs.get('OD1')).toEqual(['4687→7088']);
  });
  it('defaults to 20 lines for the pair statistics and normalises the searchable text', () => {
    const def = buildFecIndex(LINES, { closingDate: '2025-12-31' });
    expect(def.maxLinesForPairs).toBe(20);
    expect(def.pairCounts.get('4111→704')).toBe(1);
    expect(index.text[2]).toContain('facture electricite');
    expect(normalize('Régul’été')).toBe('regul ete');
  });
});

describe('runQuery', () => {
  const index = makeIndex();

  it('returns every line without filter, with the totals', () => {
    const r = run(index, {});
    expect(r.lines).toEqual(LINES.map((_, i) => i));
    expect(r.entries).toBe(SPECS.length);
    expect(r.debit).toBe(LINES.reduce((t, l) => t + l.debitCents, 0));
    expect(r.credit).toBe(r.debit);
  });
  it('filters on journals', () => {
    const r = run(index, { journals: ['AC', 'BQ'] });
    expect(entryIds(index, r.lines)).toEqual(['AC1', 'AC2', 'AC3', 'BQ1', 'BQ2']);
    expect(r.lines.every((i) => ['AC', 'BQ'].includes(index.lines[i]!.JournalCode))).toBe(true);
  });
  it('filters on any of several account prefixes', () => {
    const r = run(index, { accounts: ['606', ' 70 '] });
    expect(r.lines.map((i) => index.lines[i]!.CompteNum)).toEqual(['6061', '6061', '6061', '7088', '704']);
    expect(r.entries).toBe(5);
  });
  it('filters on the auxiliary account (number or label, case and accents ignored)', () => {
    expect(run(index, { aux: 'f001' }).lines.map((i) => index.lines[i]!.entryId)).toEqual(['AC1', 'AC2', 'BQ1']);
    expect(entryIds(index, run(index, { aux: 'ELECTRICITE' }).lines)).toEqual(['AC3']);
  });
  it('filters on the users (entry property)', () => {
    const r = run(index, { users: ['NFERRAND', 'MDUBOIS'] });
    expect(entryIds(index, r.lines)).toEqual(['BQ1', 'OD1']);
    expect(r.lines).toHaveLength(4);
  });
  it('filters on the entry date range', () => {
    expect(entryIds(index, run(index, { entryFrom: '2025-03-05' }).lines)).toEqual(['AC2', 'OD1']);
    expect(entryIds(index, run(index, { entryTo: '2025-01-31' }).lines)).toEqual(['AN1']);
    expect(entryIds(index, run(index, { entryFrom: '2025-03-04', entryTo: '2025-03-04' }).lines)).toEqual(['AC1', 'AC3', 'BQ1', 'QT1', 'BQ2']);
  });
  it('filters on the validation date range', () => {
    expect(entryIds(index, run(index, { validFrom: '2025-03-06' }).lines)).toEqual(['BQ1', 'OD1']);
    expect(entryIds(index, run(index, { validFrom: '2025-03-06', validTo: '2025-12-31' }).lines)).toEqual(['BQ1']);
  });
  it('keeps the entries validated after the closing date', () => {
    const r = run(index, { validatedAfterClosing: true });
    expect(entryIds(index, r.lines)).toEqual(['OD1']);
    expect(r.lines.every((i) => index.lines[i]!.validDate > index.closingDate)).toBe(true);
  });
  it('filters on weekends: entry date, validation date or either', () => {
    expect(isWeekend('2025-03-08') && isWeekend('2025-03-09') && !isWeekend('2025-03-04') && !isWeekend('2025-03-05')).toBe(true);
    expect(entryIds(index, run(index, { weekend: 'entry' }).lines)).toEqual(['AC2']);
    expect(entryIds(index, run(index, { weekend: 'validation' }).lines)).toEqual(['BQ1']);
    expect(entryIds(index, run(index, { weekend: 'either' }).lines)).toEqual(['AC2', 'BQ1']);
    // 2025-01-01 is a Wednesday: the opening entry is never a weekend entry
    expect(entryIds(index, run(index, { weekend: 'either' }).lines)).not.toContain('AN1');
  });
  it('keeps the lines whose amount is a multiple of the round amount', () => {
    const r = run(index, { roundMultiple: 100000 });
    expect(r.lines.map((i) => index.lines[i]!.debitCents || index.lines[i]!.creditCents)).toEqual([500000, 500000, 100000, 100000, 3000000, 3000000, 100000]);
    expect(run(index, { roundMultiple: 1000000 }).lines.map((i) => index.lines[i]!.entryId)).toEqual(['OD1', 'OD1']);
  });
  it('requires every keyword, without accents, in the label, piece or account label', () => {
    expect(entryIds(index, run(index, { keywords: 'facture ÉLECTRICITÉ' }).lines)).toEqual(['AC1', 'AC2', 'AC3']);
    expect(run(index, { keywords: 'facture gaz' }).lines).toEqual([]);
    expect(entryIds(index, run(index, { keywords: 'produits a recevoir' }).lines)).toEqual(['OD1']);
    expect(entryIds(index, run(index, { keywords: 'P-AC3' }).lines)).toEqual(['AC3']);
  });
  it('filters on the line amount (min, max, both)', () => {
    expect(run(index, { minAmount: 500000 }).lines.map((i) => index.lines[i]!.entryId)).toEqual(['AN1', 'AN1', 'OD1', 'OD1']);
    expect(run(index, { maxAmount: 7000 }).lines.map((i) => index.lines[i]!.entryId)).toEqual(['AC3', 'AC3', 'BQ1', 'BQ1', 'BQ2', 'BQ2']);
    expect(run(index, { minAmount: 7000, maxAmount: 12345 }).lines.map((i) => index.lines[i]!.entryId)).toEqual(['AC1', 'AC1', 'BQ1', 'BQ1', 'QT1']);
  });
  it('keeps the entries with a rare account pair, excluding the opening entry and the large entries', () => {
    const r = run(index, { rarePairsMax: 1 });
    // BQ2 stays rare: the opening entry, which has the same pair, is not counted
    expect(entryIds(index, r.lines)).toEqual(['BQ1', 'OD1', 'BQ2']);
    expect(entryIds(index, run(index, { rarePairsMax: 3 }).lines)).toEqual(['AC1', 'AC2', 'AC3', 'BQ1', 'OD1', 'BQ2']);
    // QT1 (5 lines) is left out with maxLinesForPairs = 4; with a higher limit its pair is counted, and rare
    const all = buildFecIndex(LINES, { closingDate: '2025-12-31', maxLinesForPairs: 100 });
    expect(entryIds(all, run(all, { rarePairsMax: 1 }).lines)).toEqual(['BQ1', 'OD1', 'QT1', 'BQ2']);
  });
  it('keeps the entries without a piece reference', () => {
    expect(entryIds(index, run(index, { missingPiece: true }).lines)).toEqual(['OD1']);
  });
  it('shows every line of the retained entries with wholeEntries', () => {
    const lineOnly = run(index, { accounts: ['401'], journals: ['AC'] });
    expect(lineOnly.lines).toHaveLength(3);
    const whole = run(index, { accounts: ['401'], journals: ['AC'], wholeEntries: true });
    expect(whole.lines).toHaveLength(6);
    expect(whole.entries).toBe(3);
    expect(whole.debit).toBe(whole.credit);
    expect(whole.lines).toEqual([...whole.lines].sort((a, b) => a - b));
  });
  it('combines line and entry filters', () => {
    const r = run(index, { journals: ['OD'], validatedAfterClosing: true, missingPiece: true, rarePairsMax: 2 });
    expect(entryIds(index, r.lines)).toEqual(['OD1']);
    expect(run(index, { journals: ['AC'], validatedAfterClosing: true }).entries).toBe(0);
  });
});

describe('pairs of an entry', () => {
  const index = makeIndex();
  it('rarePairsOf lists the pairs seen in at most N entries with their count', () => {
    expect(rarePairsOf(index, 'OD1', 2)).toEqual([{ pair: '4687→7088', count: 1 }]);
    expect(rarePairsOf(index, 'AC1', 2)).toEqual([]);
    expect(rarePairsOf(index, 'AC1', 3)).toEqual([{ pair: '6061→401', count: 3 }]);
    expect(rarePairsOf(index, 'AN1', 10)).toEqual([]);
  });
  it('pairsOf splits the pairs and is null for the entries left out of the statistics', () => {
    expect(pairsOf(index, 'BQ1')).toEqual([{ pair: '401→512', debit: '401', credit: '512', count: 1 }]);
    expect(pairsOf(index, 'QT1')).toBeNull();
    expect(pairsOf(index, 'AN1')).toBeNull();
    expect(entryLinesOf(index, 'AC2').map((l) => l.CompteNum)).toEqual(['6061', '401']);
    expect(entryLinesOf(index, 'unknown')).toEqual([]);
  });
});

describe('describeQuery and query comparison', () => {
  it('describes nothing for the empty query', () => {
    expect(describeQuery(EMPTY_QUERY)).toEqual([]);
    expect(isEmptyQuery({ ...EMPTY_QUERY, aux: '  ' })).toBe(true);
  });
  it('describes every active filter with fr-FR dates and amounts', () => {
    const q: FecQuery = {
      journals: ['OD', 'AC'],
      accounts: ['4687'],
      aux: ' F001 ',
      users: ['NFERRAND'],
      entryFrom: '2025-12-01',
      entryTo: '2025-12-31',
      validFrom: '2026-01-01',
      validTo: '',
      validatedAfterClosing: true,
      weekend: 'either',
      roundMultiple: 100000,
      keywords: ' régul ',
      minAmount: 1000000,
      maxAmount: 5000050,
      rarePairsMax: 2,
      missingPiece: true,
      wholeEntries: true,
    };
    expect(describeQuery(q)).toEqual([
      'journaux OD, AC',
      'compte 4687',
      'auxiliaire « F001 »',
      'saisies par NFERRAND',
      'datées du 01/12/2025 au 31/12/2025',
      'validées à partir du 01/01/2026',
      'validées après la clôture',
      'datées ou validées un week-end',
      `montants ronds (multiples de ${formatEuro(100000, 0)})`,
      'mots-clés « régul »',
      `montants de ${formatEuro(1000000, 0)} à ${formatEuro(5000050, 2)}`,
      'couples de comptes rares (2 écritures au plus)',
      'sans pièce justificative',
      'écritures complètes',
    ]);
    expect(describeQuery({ ...EMPTY_QUERY, entryTo: '2025-06-30', weekend: 'entry', maxAmount: 500 })).toEqual(['datées jusqu’au 30/06/2025', 'datées un week-end', `montants ≤ ${formatEuro(500, 0)}`]);
    expect(describeQuery({ ...EMPTY_QUERY, weekend: 'validation', minAmount: 0, rarePairsMax: 1 })).toEqual(['validées un week-end', `montants ≥ ${formatEuro(0, 0)}`, 'couples de comptes rares (1 écriture au plus)']);
  });
  it('compares queries regardless of the order of the selected values', () => {
    const a = { ...EMPTY_QUERY, journals: ['OD', 'AC'], users: ['B', 'A'] };
    const b = { ...EMPTY_QUERY, journals: ['AC', 'OD'], users: ['A', 'B'] };
    expect(sameQuery(a, b)).toBe(true);
    expect(queryKey(a)).toBe(queryKey(b));
    expect(sameQuery(a, { ...b, missingPiece: true })).toBe(false);
  });
});

describe('usual tests', () => {
  const tests = standardTests({ closingDate: '2025-12-31', roundMultiple: 100000, rarePairsMax: 2, miscJournals: ['OD'], manualUsers: ['KHADDAD', 'NFERRAND'] });
  it('offers the six generic journal-entry tests, each setting the whole query', () => {
    expect(tests.map((t) => t.id)).toEqual(['afterClosing', 'weekend', 'roundAmounts', 'rarePairs', 'missingPiece', 'manualMisc']);
    const changed = (q: FecQuery) => Object.keys(q).filter((k) => JSON.stringify(q[k as keyof FecQuery]) !== JSON.stringify(EMPTY_QUERY[k as keyof FecQuery]));
    expect(tests.map((t) => changed(t.query))).toEqual([['validatedAfterClosing'], ['weekend'], ['roundMultiple'], ['rarePairsMax'], ['missingPiece'], ['journals', 'users']]);
    expect(tests[1]!.query.weekend).toBe('either');
    expect(tests[2]!.query.roundMultiple).toBe(100000);
    expect(tests[3]!.query.rarePairsMax).toBe(2);
    expect(tests[5]!.query).toMatchObject({ journals: ['OD'], users: ['KHADDAD', 'NFERRAND'] });
    for (const t of tests) expect(t.label.length && t.description.length).toBeGreaterThan(0);
    expect(tests[0]!.description).toContain('31/12/2025');
  });
});

describe('filter inputs', () => {
  it('splits account prefixes on spaces, commas and semicolons', () => {
    expect(parseAccountPrefixes(' 4687, 70;6 ')).toEqual(['4687', '70', '6']);
    expect(parseAccountPrefixes('   ')).toEqual([]);
  });
  it('parses euros typed in fr-FR or with a dot, with Math.round(value × 100)', () => {
    expect(parseEuroAmount('')).toEqual({ cents: null, valid: true });
    expect(parseEuroAmount('12 500,5')).toEqual({ cents: 1250050, valid: true });
    expect(parseEuroAmount('12 500,50')).toEqual({ cents: 1250050, valid: true });
    expect(parseEuroAmount('0.1')).toEqual({ cents: 10, valid: true });
    expect(parseEuroAmount('1,005')).toEqual({ cents: Math.round(1.005 * 100), valid: true });
    expect(parseEuroAmount('abc')).toEqual({ cents: null, valid: false });
    expect(parseEuroAmount('-5')).toEqual({ cents: null, valid: false });
  });
  it('writes a stored bound back as an input text', () => {
    expect(euroInputText(null)).toBe('');
    expect(euroInputText(1000000)).toBe('10000');
    expect(euroInputText(1250050)).toBe('12500,50');
    for (const c of [0, 5, 1250050, 30000000]) expect(parseEuroAmount(euroInputText(c)).cents).toBe(c);
  });
});

describe('summaries and exports', () => {
  const index = makeIndex();
  it('summarises entries, lines and amounts per journal, for the year or a selection', () => {
    const all = journalSummary(index);
    expect(all.map((r) => r.journal)).toEqual(['AC', 'AN', 'BQ', 'OD', 'QT']);
    expect(all.find((r) => r.journal === 'AC')).toMatchObject({ label: 'Journal AC', entries: 3, lines: 6, debit: 117345, credit: 117345 });
    expect(all.reduce((t, r) => t + r.lines, 0)).toBe(LINES.length);
    const sel = journalSummary(index, run(index, { weekend: 'either' }).lines);
    expect(sel).toEqual([
      { journal: 'AC', label: 'Journal AC', entries: 1, lines: 2, debit: 100000, credit: 100000 },
      { journal: 'BQ', label: 'Journal BQ', entries: 1, lines: 2, debit: 7000, credit: 7000 },
    ]);
  });
  it('exports a semicolon CSV with a BOM, the FEC fields and the internal user', () => {
    const csv = fecToCsv(entryLinesOf(index, 'AC1'));
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...FEC_FIELDS, CSV_USER_FIELD]);
    expect(rows).toHaveLength(3);
    expect(rows[1]![FEC_FIELDS.indexOf('Debit')]).toBe(formatFecAmount(12345));
    expect(rows[2]![FEC_FIELDS.indexOf('CompAuxLib')]).toBe('Énergie Aurelloise');
    expect(rows[1]![FEC_FIELDS.length]).toBe('SLEFEBVRE');
  });
});

describe('journal-entry test on the presented FEC 2025 (integration)', () => {
  it('finds late OD entries without piece and with a rare account pair, each line satisfying the filters', () => {
    const w = correctionKey().presented.world;
    const lines = buildFec(w.ledgers.current, w.chart, w.journals, w.auxiliaries);
    const index = buildFecIndex(lines, { closingDate: `${w.meta.currentYear}-12-31`, maxLinesForPairs: 20 });
    const r = runQuery(index, { ...EMPTY_QUERY, validatedAfterClosing: true, missingPiece: true, rarePairsMax: 2, journals: ['OD'] });
    expect(r.entries).toBeGreaterThanOrEqual(1);
    expect(r.lines.length).toBeGreaterThanOrEqual(2);
    for (const i of r.lines) {
      const l = index.lines[i]!;
      expect(l.JournalCode).toBe('OD');
      expect(l.validDate > index.closingDate).toBe(true);
      expect(l.PieceRef).toBe('');
      expect(rarePairsOf(index, l.entryId, 2).length).toBeGreaterThan(0);
      expect(rarePairsOf(index, l.entryId, 2).every((p) => p.count <= 2)).toBe(true);
    }
    let debit = 0;
    let credit = 0;
    for (const i of r.lines) {
      debit += index.lines[i]!.debitCents;
      credit += index.lines[i]!.creditCents;
    }
    expect([r.debit, r.credit]).toEqual([debit, credit]);
  });
});
