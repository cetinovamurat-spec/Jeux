/**
 * Building blocks of the analytical review charts (Recharts): series colours
 * taken from the theme tokens, axis styles, legend keys, tooltip box and the
 * chart card with its "data table" toggle.
 *
 * Colours: the two years are an ordinal pair of the accent hue — the current
 * year in the accent, the prior year in the accent mixed with the panel
 * surface (validated as an ordinal ramp in both themes: one hue, distinct
 * lightness, the prior-year series at least 3:1 against the surface, the non-text contrast of WCAG AA). Text never wears a series
 * colour; identity is carried by keys next to the text.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Button, Card, cx } from '../../components/ui';
import { useAnalysisView } from './analysisView';

export const SERIES = { current: 'var(--accent)', prior: 'var(--series-prior)' } as const;

/** CSS variables of the chart area (set on the figure so that SVG attributes and tooltips can use them). */
export const CHART_VARS = { '--series-prior': 'color-mix(in oklab, var(--accent) 65%, var(--panel))' } as CSSProperties;

export const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 } as const;
export const AXIS_LINE = { stroke: 'var(--line)' } as const;
export const GRID_STROKE = 'var(--line)';

export interface LegendItem {
  name: string;
  color: string;
  shape: 'line' | 'rect';
}

/** Key mark of a series: a short line for lines, a small rounded rect for bars. */
export function SeriesKey({ color, shape }: { color: string; shape: LegendItem['shape'] }) {
  return shape === 'line' ? (
    <span aria-hidden="true" className="inline-block h-0.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
  ) : (
    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
  );
}

export function Legend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul aria-label="Légende" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((it) => (
        <li key={it.name} className="inline-flex items-center gap-1.5">
          <SeriesKey color={it.color} shape={it.shape} />
          {it.name}
        </li>
      ))}
    </ul>
  );
}

export interface TooltipRow {
  name: string;
  color: string;
  value: string;
  note?: string;
}

/** Tooltip content: values lead, series names follow, keyed by a short line of the series colour. */
export function TooltipBox({ title, rows, footer }: { title: string; rows: readonly TooltipRow[]; footer?: string }) {
  return (
    <div className="min-w-40 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-1 font-medium text-ink">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <SeriesKey color={r.color} shape="line" />
            <span className="num font-semibold text-ink">{r.value}</span>
            <span className="text-muted">{r.name}</span>
            {r.note && <span className="text-muted">({r.note})</span>}
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1 text-muted">{footer}</p>}
    </div>
  );
}

/** Data point under the pointer, from the props Recharts gives a custom tooltip. */
export function activeDatum<T>(p: { active?: boolean; payload?: readonly { payload?: unknown }[] }): T | null {
  if (!p.active || !p.payload?.length) return null;
  return (p.payload[0]?.payload as T | undefined) ?? null;
}

/**
 * Card of one chart: title, short description, legend, the chart, and a
 * toggle showing the underlying table (every value of the chart is reachable
 * without hovering).
 */
export function ChartCard({
  id,
  title,
  description,
  legend,
  summary,
  children,
  table,
  className,
}: {
  id: string;
  title: string;
  description: ReactNode;
  legend?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const shown = useAnalysisView((s) => !!s.dataShown[id]);
  const toggle = useAnalysisView((s) => s.toggleData);
  const tableId = `an-chart-${id}-data`;
  return (
    <Card
      className={className}
      title={<span id={`an-chart-${id}-title`}>{title}</span>}
      actions={
        <Button variant="ghost" className="text-xs" aria-expanded={shown} aria-controls={tableId} onClick={() => toggle(id)}>
          {shown ? 'Masquer les données' : 'Voir les données'}
        </Button>
      }
    >
      <figure aria-labelledby={`an-chart-${id}-title`} aria-describedby={`an-chart-${id}-desc`} className="m-0 space-y-2 px-3 py-2.5" style={CHART_VARS}>
        <figcaption id={`an-chart-${id}-desc`} className="text-xs text-muted">
          {description}
        </figcaption>
        {(legend || summary) && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            {legend}
            {summary && <p className="text-xs text-muted">{summary}</p>}
          </div>
        )}
        <div className="min-w-0">{children}</div>
      </figure>
      <div id={tableId} hidden={!shown} className={cx('border-t border-line')}>
        {shown && table}
      </div>
    </Card>
  );
}

/** Table of the data of a chart (header row, body rows, optional total row). */
export function DataTableView({ caption, head, rows, foot }: { caption: string; head: readonly ReactNode[]; rows: readonly (readonly ReactNode[])[]; foot?: readonly ReactNode[] }) {
  const cell = (i: number) => cx('py-1', i === 0 ? 'pl-3 pr-2 text-left' : 'num px-2', i === head.length - 1 && 'pr-3');
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-sunken text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={cx('py-1 font-medium', i === 0 ? 'pl-3 pr-2 text-left' : 'px-2 text-right', i === head.length - 1 && 'pr-3')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j} className="border-t border-line">
              {r.map((v, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className={cx(cell(i), 'font-normal')}>
                    {v}
                  </th>
                ) : (
                  <td key={i} className={cell(i)}>
                    {v}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t border-line bg-sunken font-semibold">
              {foot.map((v, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className={cx(cell(i), 'font-semibold')}>
                    {v}
                  </th>
                ) : (
                  <td key={i} className={cell(i)}>
                    {v}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
