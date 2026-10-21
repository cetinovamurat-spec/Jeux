/**
 * Virtualised, sortable table (ARIA grid) for large data: balance, ledger,
 * FEC. Columns are CSS grid tracks; rows can be clicked or activated with
 * Enter when `onRowClick` is given. Keyboard: the rows are a single Tab stop
 * (roving tabindex); arrows, Page up / Page down, Home and End move between
 * them. Rows carry `data-row-index` (position in the sorted rows), so that a
 * screen can give the focus back to a row. Controls inside a cell should be
 * tabbable on the active row only (`active` argument of `cell`).
 */
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './ui';

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** CSS grid track, e.g. '6rem', 'minmax(12rem,1fr)'. */
  width: string;
  align?: 'left' | 'right';
  /** `active`: the row is the Tab stop of the table (controls in a cell are tabbable only there). */
  cell: (row: T, index: number, active: boolean) => ReactNode;
  /** Enables sorting on this column. */
  sortValue?: (row: T) => number | string;
  title?: (row: T) => string;
}

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T, index: number) => string;
  ariaLabel: string;
  /** Height of the scroll area (CSS). */
  height?: string;
  rowHeight?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  /** Rendered under the rows (totals). */
  footer?: ReactNode;
  initialSort?: { id: string; dir: 'asc' | 'desc' };
}

export function DataTable<T>({ rows, columns, rowKey, ariaLabel, height = '65vh', rowHeight = 30, onRowClick, rowClassName, footer, initialSort }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const f = col.sortValue;
    const out = [...rows].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return sort!.dir === 'desc' ? out.reverse() : out;
  }, [rows, columns, sort]);
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: sorted.length, getScrollElement: () => parentRef.current, estimateSize: () => rowHeight, overscan: 16 });
  const template = columns.map((c) => c.width).join(' ');
  // Roving tabindex: the active row (or, when it is scrolled away, the first rendered one) is the Tab stop.
  const [active, setActive] = useState(0);
  const items = v.getVirtualItems();
  const tabStop = items.some((i) => i.index === active) ? active : (items[0]?.index ?? -1);
  const pageRows = Math.max(1, Math.floor((parentRef.current?.clientHeight ?? rowHeight * 10) / rowHeight) - 1);
  const focusRow = (index: number) => {
    setActive(index);
    v.scrollToIndex(index, { align: 'auto' });
    requestAnimationFrame(() => parentRef.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)?.focus({ preventScroll: true }));
  };
  const onRowKey = (e: KeyboardEvent<HTMLDivElement>, index: number, row: T) => {
    const last = sorted.length - 1;
    const next =
      e.key === 'ArrowDown' ? Math.min(last, index + 1) : e.key === 'ArrowUp' ? Math.max(0, index - 1) : e.key === 'PageDown' ? Math.min(last, index + pageRows) : e.key === 'PageUp' ? Math.max(0, index - pageRows) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next !== null) {
      e.preventDefault();
      focusRow(next);
    } else if (e.key === 'Enter' && onRowClick) {
      e.preventDefault();
      onRowClick(row);
    }
  };
  const toggle = (c: Column<T>) => {
    if (!c.sortValue) return;
    setSort((s) => (s?.id === c.id ? (s.dir === 'asc' ? { id: c.id, dir: 'desc' } : null) : { id: c.id, dir: 'asc' }));
  };
  return (
    <div role="grid" aria-label={ariaLabel} aria-rowcount={sorted.length + 1} aria-colcount={columns.length} className="text-sm">
      <div ref={parentRef} className="overflow-auto" style={{ height }}>
        <div role="row" aria-rowindex={1} className="sticky top-0 z-10 grid gap-x-3 border-b border-line bg-sunken px-3 py-1.5 text-xs font-semibold text-muted" style={{ gridTemplateColumns: template, minWidth: 'max-content' }}>
          {columns.map((c) => (
            <div
              key={c.id}
              role="columnheader"
              aria-sort={sort?.id === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined}
              className={cx(c.align === 'right' && 'text-right', c.sortValue && 'cursor-pointer select-none hover:text-ink')}
              onClick={() => toggle(c)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault(); // Space would also scroll the table
                toggle(c);
              }}
              tabIndex={c.sortValue ? 0 : undefined}
            >
              {c.header}
              {sort?.id === c.id && <span aria-hidden="true">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
            </div>
          ))}
        </div>
        <div style={{ height: v.getTotalSize(), position: 'relative', minWidth: 'max-content' }}>
          {items.map((item) => {
            const row = sorted[item.index]!;
            return (
              <div
                key={rowKey(row, item.index)}
                role="row"
                aria-rowindex={item.index + 2}
                data-row-index={item.index}
                tabIndex={item.index === tabStop ? 0 : -1}
                onFocus={() => setActive(item.index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={(e) => onRowKey(e, item.index, row)}
                className={cx('absolute left-0 right-0 grid items-center gap-x-3 border-b border-line px-3', onRowClick && 'cursor-pointer hover:bg-accent-soft', rowClassName?.(row))}
                style={{ top: item.start, height: item.size, gridTemplateColumns: template }}
              >
                {columns.map((c) => (
                  <div key={c.id} role="gridcell" className={cx('truncate', c.align === 'right' && 'text-right')} title={c.title?.(row)}>
                    {c.cell(row, item.index, item.index === tabStop)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {footer && <div className="border-t border-line bg-sunken px-3 py-1.5">{footer}</div>}
    </div>
  );
}
