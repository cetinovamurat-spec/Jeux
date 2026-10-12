/** FEC (fichier des écritures comptables): 18 fields, numbering in validation order. */
import { accountMap } from './chart';
import { formatDateFec } from './dates';
import { formatFecAmount } from './format';
import type { ChartOfAccounts, FecLine, FecLineInternal, Journal, Ledger } from './types';

export const FEC_FIELDS: readonly (keyof FecLine)[] = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
];

/**
 * Entries are numbered per journal in validation order (ValidDate, then date,
 * then id): an entry dated 31/12 but validated in February gets a late number.
 */
export function buildFec(
  ledger: Ledger,
  chart: ChartOfAccounts,
  journals: readonly Journal[],
  auxiliaries: Readonly<Record<string, string>>,
): FecLineInternal[] {
  const accounts = accountMap(chart);
  const journalLabels = new Map(journals.map((j) => [j.code, j.label]));
  const ordered = [...ledger.entries].sort((a, b) =>
    a.validDate !== b.validDate ? (a.validDate < b.validDate ? -1 : 1) : a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const counters = new Map<string, number>();
  const lines: FecLineInternal[] = [];
  for (const e of ordered) {
    const n = (counters.get(e.journal) ?? 0) + 1;
    counters.set(e.journal, n);
    const num = `${e.journal}${String(n).padStart(6, '0')}`;
    for (const l of e.lines) {
      lines.push({
        JournalCode: e.journal,
        JournalLib: journalLabels.get(e.journal) ?? e.journal,
        EcritureNum: num,
        EcritureDate: formatDateFec(e.date),
        CompteNum: l.account,
        CompteLib: accounts.get(l.account)?.label ?? '',
        CompAuxNum: l.aux ?? '',
        CompAuxLib: l.aux ? (auxiliaries[l.aux] ?? '') : '',
        PieceRef: e.pieceRef ?? '',
        PieceDate: e.pieceDate ? formatDateFec(e.pieceDate) : '',
        EcritureLib: l.label ?? e.label,
        Debit: formatFecAmount(l.debit),
        Credit: formatFecAmount(l.credit),
        EcritureLet: l.lettering ?? '',
        DateLet: l.letteringDate ? formatDateFec(l.letteringDate) : '',
        ValidDate: formatDateFec(e.validDate),
        Montantdevise: '',
        Idevise: '',
        entryId: e.id,
        enteredBy: e.enteredBy,
        debitCents: l.debit,
        creditCents: l.credit,
        date: e.date,
        validDate: e.validDate,
      });
    }
  }
  return lines;
}

/** Text export with a header row; '|' or tab separators are accepted by the LPF format. */
export function fecToText(lines: readonly FecLine[], separator: '|' | '\t' = '|'): string {
  const header = FEC_FIELDS.join(separator);
  const body = lines.map((l) => FEC_FIELDS.map((f) => String(l[f]).replaceAll(separator, ' ')).join(separator));
  return [header, ...body].join('\r\n') + '\r\n';
}
