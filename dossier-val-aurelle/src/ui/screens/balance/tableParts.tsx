/**
 * Small components shared by the balance and the general ledger: neutral
 * signed amounts, a totals row aligned on the columns of a DataTable, a field
 * label stacked above its control.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { formatAmount } from '../../../engine/format';
import type { Column } from '../../components/DataTable';
import { cx } from '../../components/ui';

/** Signed amount (debit positive, credit negative) without colour: a credit balance is not an alert. */
export function Signed({ cents, decimals = 2, strong = false }: { cents: number; decimals?: number; strong?: boolean }) {
  if (cents === 0) return <span className="num text-muted">–</span>;
  const text = formatAmount(Math.abs(cents), decimals);
  return <span className={cx('num', strong && 'font-semibold')}>{cents < 0 ? `−${text}` : text}</span>;
}

/**
 * A row (totals) laid out on the columns of the DataTable it is rendered in
 * (as its `footer`): same grid tracks, compensates the vertical scrollbar of
 * the rows and follows their horizontal scroll.
 */
export function AlignedRow<T>({ columns, cells, lead, leadSpan = 1, className }: { columns: readonly Column<T>[]; cells: Readonly<Record<string, ReactNode>>; lead?: ReactNode; leadSpan?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const scroller = el?.closest('[role="grid"]')?.firstElementChild;
    if (!el || !(scroller instanceof HTMLElement)) return;
    const update = () => {
      el.style.paddingRight = `${scroller.offsetWidth - scroller.clientWidth}px`;
      el.style.transform = `translateX(${-scroller.scrollLeft}px)`;
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  });
  const rest = columns.slice(lead === undefined ? 0 : leadSpan);
  return (
    <div className="overflow-hidden">
      <div ref={ref} className={cx('grid items-center gap-x-3', className)} style={{ gridTemplateColumns: columns.map((c) => c.width).join(' ') }}>
        {lead !== undefined && (
          <div className="truncate" style={{ gridColumn: `span ${leadSpan}` }}>
            {lead}
          </div>
        )}
        {rest.map((c) => (
          <div key={c.id} className={cx('truncate', c.align === 'right' && 'text-right')}>
            {cells[c.id] ?? null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Field label stacked above its control (filter bars). */
export function Field({ id, label, children, className }: { id: string; label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
