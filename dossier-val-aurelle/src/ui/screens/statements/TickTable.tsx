/**
 * A tickable table (statement, annex table or certified statement): labels
 * indented by level, subtotals and totals in bold, each figure followed by its
 * tick button. Row labels open the detail panel when `onSelectRow` is given;
 * the menu of a figure then also offers « Créer un constat » on its row.
 */
import { Amount } from '../../components/Amount';
import { cx } from '../../components/ui';
import type { SectionModel } from './model';
import { TickButton } from './TickControls';

export interface TickTableProps {
  section: SectionModel;
  /** Header of the label column. */
  labelHeader?: string;
  selectedRow?: string | null;
  onSelectRow?: (rowId: string) => void;
  /** Id of the detail panel (aria-controls of the row buttons). */
  panelId?: string;
  /** Background of the sticky header (the table sits on a panel or on paper). */
  surface?: 'panel' | 'paper';
  /** Width of the figure columns (CSS length). */
  figureWidth?: string;
  /** Tooltip of the row labels (default: composition of the line or of the total). */
  rowHint?: string;
}

/** Value of the data-row attribute of a row label button (focus return, scrolling). */
export function rowAnchor(sectionId: string, rowId: string): string {
  return `${sectionId}:${rowId}`;
}

/** Opens « Créer un constat » of the detail panel once it shows the row (the panel renders after the selection). */
function openFindingInPanel(panelId: string): void {
  let tries = 0;
  const step = () => {
    const b = document.getElementById(panelId)?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
    if (b) {
      b.focus();
      b.click();
    } else if (++tries < 10) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function Figure({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="num" />;
  return <Amount cents={value} />;
}

export function TickTable({ section, labelHeader = 'Rubrique', selectedRow, onSelectRow, panelId, surface = 'panel', figureWidth = '9.5rem', rowHint }: TickTableProps) {
  const bg = surface === 'paper' ? 'bg-paper' : 'bg-panel';
  const head = cx('border-b border-line px-2 py-1.5 text-xs font-semibold text-muted', bg);
  return (
    <table data-tick-grid aria-label={section.title} className="w-full border-separate border-spacing-0 text-sm">
      <colgroup>
        <col />
        {section.columns.map((c) => (
          <col key={c.id} style={{ width: figureWidth }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-10">
        {section.groups && (
          <tr>
            <td className={cx(bg, 'border-b border-transparent')} />
            {section.groups.map((g) => (
              <th key={g.label} scope="colgroup" colSpan={g.span} className={cx(head, 'text-center')}>
                {g.label}
              </th>
            ))}
          </tr>
        )}
        <tr>
          <th scope="col" className={cx(head, 'text-left')}>
            {labelHeader}
          </th>
          {section.columns.map((c) => (
            <th key={c.id} scope="col" className={cx(head, 'pr-9 text-right leading-tight')}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {section.rows.map((row, r) => {
          const selected = selectedRow === row.id;
          const strong = row.kind !== 'detail';
          const total = row.kind === 'total';
          return (
            <tr key={row.id} className={cx(selected ? 'bg-accent-soft' : total ? 'bg-sunken' : 'hover:bg-sunken/70', strong && 'font-semibold')}>
              <th scope="row" className={cx('border-b border-line py-1 pr-2 text-left align-middle', strong ? 'font-semibold' : 'font-normal')} style={{ paddingLeft: `${0.5 + row.depth * 1.1}rem` }}>
                {onSelectRow ? (
                  <button
                    type="button"
                    data-row={rowAnchor(section.id, row.id)}
                    onClick={() => onSelectRow(row.id)}
                    aria-expanded={selected}
                    {...(panelId && selected ? { 'aria-controls': panelId } : {})}
                    title={rowHint ?? (row.kind === 'detail' ? 'Afficher les comptes qui composent la ligne' : 'Afficher les rubriques qui composent ce total')}
                    className={cx('scroll-mt-20 scroll-mb-4 text-left underline-offset-2 hover:text-accent hover:underline', selected && 'text-accent')}
                  >
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
              </th>
              {row.cells.map((cell, ci) => {
                const col = section.columns[ci]!;
                return (
                  <td key={cell.key} className="whitespace-nowrap border-b border-line px-2 py-1 align-middle">
                    <div className="flex items-center justify-end gap-2">
                      <Figure value={cell.value} />
                      <TickButton
                        cell={cell.key}
                        label={`${row.label} – ${col.name}${section.qualify ? ` (${section.title})` : ''}`}
                        row={r}
                        col={ci}
                        onFinding={
                          onSelectRow && panelId
                            ? () => {
                                if (!selected) onSelectRow(row.id);
                                openFindingInPanel(panelId);
                              }
                            : undefined
                        }
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
