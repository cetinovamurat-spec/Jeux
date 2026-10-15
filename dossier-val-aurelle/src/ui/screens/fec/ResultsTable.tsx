/** Lines retained by the query: virtualised, sortable grid; a row opens the detail of its entry. */
import { memo, useMemo, useRef } from 'react';
import { formatDateFr } from '../../../engine/dates';
import type { FecIndex } from '../../../game/fec-query';
import { Amount } from '../../components/Amount';
import { DataTable, type Column } from '../../components/DataTable';
import { Badge } from '../../components/ui';
import { isTouched, originLabel, type Diagnostics } from './diagnostics';
import { formatFecDate } from './labels';
import { useElementHeight } from './layout';

export interface ResultsTableProps {
  index: FecIndex;
  lines: readonly number[];
  selectedEntry: string | null;
  onSelect: (entryId: string) => void;
  roles: ReadonlyMap<string, string>;
  /** Designer mode only. */
  diagnostics: Diagnostics | null;
}

export const ResultsTable = memo(function ResultsTable({ index, lines, selectedEntry, onSelect, roles, diagnostics }: ResultsTableProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const height = useElementHeight(boxRef, 400);

  const columns = useMemo<Column<number>[]>(() => {
    const L = (i: number) => index.lines[i]!;
    const cols: Column<number>[] = [
      { id: 'journal', header: 'Journal', width: '3rem', cell: (i) => <span className="font-mono text-xs">{L(i).JournalCode}</span>, sortValue: (i) => L(i).JournalCode, title: (i) => L(i).JournalLib },
      { id: 'num', header: 'N°', width: '4.4rem', cell: (i) => <span className="font-mono text-xs">{L(i).EcritureNum}</span>, sortValue: (i) => L(i).EcritureNum },
      { id: 'date', header: 'Date', width: '4.8rem', cell: (i) => <span className="font-mono text-xs">{formatDateFr(L(i).date)}</span>, sortValue: (i) => L(i).date },
      { id: 'account', header: 'Compte', width: '3.6rem', cell: (i) => <span className="font-mono text-xs">{L(i).CompteNum}</span>, sortValue: (i) => L(i).CompteNum, title: (i) => `${L(i).CompteNum} – ${L(i).CompteLib}` },
      { id: 'aux', header: 'Auxiliaire', width: '4rem', cell: (i) => <span className="font-mono text-xs">{L(i).CompAuxNum}</span>, sortValue: (i) => L(i).CompAuxNum, title: (i) => (L(i).CompAuxNum ? `${L(i).CompAuxNum} – ${L(i).CompAuxLib}` : '') },
      {
        id: 'piece',
        header: 'Pièce',
        width: '5.4rem',
        cell: (i) => (L(i).PieceRef ? <span className="font-mono text-xs">{L(i).PieceRef}</span> : <span className="text-muted">–</span>),
        sortValue: (i) => L(i).PieceRef,
        title: (i) => (L(i).PieceRef ? `${L(i).PieceRef}${L(i).PieceDate ? ` du ${formatFecDate(L(i).PieceDate)}` : ''}` : 'Aucune référence de pièce'),
      },
      { id: 'label', header: 'Libellé', width: 'minmax(7rem,1fr)', cell: (i) => <span className="text-xs">{L(i).EcritureLib}</span>, sortValue: (i) => L(i).EcritureLib, title: (i) => L(i).EcritureLib },
      { id: 'debit', header: 'Débit', width: '6.2rem', align: 'right', cell: (i) => <span className="text-xs"><Amount cents={L(i).debitCents} decimals={2} /></span>, sortValue: (i) => L(i).debitCents },
      { id: 'credit', header: 'Crédit', width: '6.2rem', align: 'right', cell: (i) => <span className="text-xs"><Amount cents={L(i).creditCents} decimals={2} /></span>, sortValue: (i) => L(i).creditCents },
      { id: 'valid', header: 'Validée le', width: '4.8rem', cell: (i) => <span className="font-mono text-xs">{formatDateFr(L(i).validDate)}</span>, sortValue: (i) => L(i).validDate },
      { id: 'user', header: 'Saisie par', width: '5.2rem', cell: (i) => <span className="font-mono text-xs">{L(i).enteredBy}</span>, sortValue: (i) => L(i).enteredBy, title: (i) => roles.get(L(i).enteredBy) ?? L(i).enteredBy },
    ];
    if (diagnostics) {
      const d = (i: number) => diagnostics.entries.get(L(i).entryId);
      cols.push({
        id: 'origin',
        header: 'Origine',
        width: '5.6rem',
        cell: (i) => {
          const x = d(i);
          if (!x) return null;
          return isTouched(x) ? <Badge tone="warn">{x.change === 'modified' ? `${originLabel(x.origin)} modif.` : originLabel(x.origin)}</Badge> : <span className="font-mono text-xs text-muted">{originLabel(x.origin)}</span>;
        },
        sortValue: (i) => {
          const x = d(i);
          return `${isTouched(x) ? '0' : '1'}${x?.origin ?? ''}`;
        },
        title: (i) => `Concepteur – ${d(i)?.origin ?? ''}${d(i)?.change ? ` (${d(i)?.change === 'added' ? 'ajoutée' : 'modifiée'})` : ''}`,
      });
    }
    return cols;
  }, [index, roles, diagnostics]);

  const rowClassName = useMemo(() => (selectedEntry ? (i: number) => (index.lines[i]!.entryId === selectedEntry ? 'bg-accent-soft' : '') : undefined), [index, selectedEntry]);

  return (
    <div ref={boxRef} className="min-h-0 flex-1">
      <DataTable
        rows={lines}
        columns={columns}
        rowKey={(i) => String(i)}
        ariaLabel="Lignes du FEC retenues par la requête"
        height={`${height}px`}
        rowHeight={28}
        onRowClick={(i) => onSelect(index.lines[i]!.entryId)}
        rowClassName={rowClassName}
      />
    </div>
  );
});
