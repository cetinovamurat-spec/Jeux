/** Entries and lines of the year per journal, with the part retained by the current query. */
import type { JournalSummaryRow } from '../../../game/fec-query';
import { Amount } from '../../components/Amount';
import { cx } from '../../components/ui';
import { formatCount } from './labels';

export interface JournalSummaryProps {
  year: number;
  rows: readonly JournalSummaryRow[];
  selection: readonly JournalSummaryRow[];
  pending: boolean;
  /** Filters the results on one journal. */
  onSelectJournal: (journal: string) => void;
}

export function JournalSummary({ year, rows, selection, pending, onSelectJournal }: JournalSummaryProps) {
  const selected = new Map(selection.map((r) => [r.journal, r]));
  const sum = (list: readonly JournalSummaryRow[]) => list.reduce((t, r) => ({ entries: t.entries + r.entries, lines: t.lines + r.lines, debit: t.debit + r.debit, credit: t.credit + r.credit }), { entries: 0, lines: 0, debit: 0, credit: 0 });
  const total = sum(rows);
  const totalSelected = sum(selection);
  const dim = cx(pending && 'opacity-60');
  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[40rem] text-xs">
        <caption className="sr-only">Écritures et lignes de l’exercice {year} par journal, et part retenue par la requête en cours</caption>
        <thead className="text-muted">
          <tr>
            <th scope="col" rowSpan={2} className="border-b border-line py-1 pr-2 text-left align-bottom font-medium">
              Journal
            </th>
            <th scope="colgroup" colSpan={4} className="border-b border-line px-2 py-0.5 text-center font-medium">
              Exercice {year}
            </th>
            <th scope="colgroup" colSpan={2} className="border-b border-line py-0.5 pl-2 text-center font-medium">
              Retenues par la requête
            </th>
          </tr>
          <tr className="border-b border-line">
            <th scope="col" className="px-2 py-1 text-right font-medium">Écritures</th>
            <th scope="col" className="px-2 py-1 text-right font-medium">Lignes</th>
            <th scope="col" className="px-2 py-1 text-right font-medium">Débit</th>
            <th scope="col" className="px-2 py-1 text-right font-medium">Crédit</th>
            <th scope="col" className="px-2 py-1 text-right font-medium">Écritures</th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">Lignes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = selected.get(r.journal);
            return (
              <tr key={r.journal} className="border-b border-line">
                <th scope="row" className="py-1 pr-2 text-left font-normal">
                  <button type="button" className="inline-flex items-baseline gap-1.5 text-left hover:text-accent" onClick={() => onSelectJournal(r.journal)} title={`Filtrer les résultats sur le journal ${r.journal}`}>
                    <span className="font-mono font-semibold">{r.journal}</span>
                    <span className="text-muted">{r.label}</span>
                  </button>
                </th>
                <td className="num px-2 py-1">{formatCount(r.entries)}</td>
                <td className="num px-2 py-1">{formatCount(r.lines)}</td>
                <td className="px-2 py-1 text-right">
                  <Amount cents={r.debit} decimals={2} />
                </td>
                <td className="px-2 py-1 text-right">
                  <Amount cents={r.credit} decimals={2} />
                </td>
                <td className={cx('num px-2 py-1', dim, !s && 'text-muted')}>{formatCount(s?.entries ?? 0)}</td>
                <td className={cx('num py-1 pl-2', dim, !s && 'text-muted')}>{formatCount(s?.lines ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <th scope="row" className="py-1 pr-2 text-left">
              Total
            </th>
            <td className="num px-2 py-1">{formatCount(total.entries)}</td>
            <td className="num px-2 py-1">{formatCount(total.lines)}</td>
            <td className="px-2 py-1 text-right">
              <Amount cents={total.debit} decimals={2} />
            </td>
            <td className="px-2 py-1 text-right">
              <Amount cents={total.credit} decimals={2} />
            </td>
            <td className={cx('num px-2 py-1', dim)}>{formatCount(totalSelected.entries)}</td>
            <td className={cx('num py-1 pl-2', dim)}>{formatCount(totalSelected.lines)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
