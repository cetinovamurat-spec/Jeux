/**
 * Criteria panel of the FEC explorer: tabs (filters, saved queries, journal
 * summary) that can be collapsed to leave the whole height to the results.
 */
import type { KeyboardEvent, ReactNode } from 'react';
import { Button, cx } from '../../components/ui';
import type { PanelTab } from './fecStore';

export interface CriteriaPanelProps {
  tab: PanelTab;
  open: boolean;
  onChange: (changes: { panelTab?: PanelTab; panelOpen?: boolean }) => void;
  tabs: readonly { id: PanelTab; label: ReactNode }[];
  /** Buttons on the right of the tab bar. */
  actions?: ReactNode;
  children: ReactNode;
}

export function CriteriaPanel({ tab, open, onChange, tabs, actions, children }: CriteriaPanelProps) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === tab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!.id;
    onChange({ panelTab: next, panelOpen: true });
    document.getElementById(`fec-tab-${next}`)?.focus();
  };
  return (
    <section aria-label="Critères de sélection" className="mb-3 rounded-lg border border-line bg-panel">
      <div className={cx('flex flex-wrap items-end gap-x-2 px-3 pt-1.5', open && 'border-b border-line')}>
        <div role="tablist" aria-label="Critères de sélection" className="-mb-px flex flex-wrap gap-1">
          {tabs.map((t) => {
            const selected = t.id === tab;
            return (
              <button
                key={t.id}
                id={`fec-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="fec-tabpanel"
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(selected ? { panelOpen: !open } : { panelTab: t.id, panelOpen: true })}
                onKeyDown={onKey}
                className={cx(
                  'rounded-t-md border px-3 py-1.5 text-sm',
                  selected && open ? 'border-line border-b-panel bg-panel font-semibold text-accent' : selected ? 'border-transparent font-semibold text-accent' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="mb-1 ml-auto flex flex-wrap items-center gap-1.5">
          {actions}
          <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => onChange({ panelOpen: !open })} aria-expanded={open} aria-controls="fec-tabpanel">
            {open ? 'Réduire ▴' : 'Développer ▾'}
          </Button>
        </div>
      </div>
      <div id="fec-tabpanel" role="tabpanel" aria-labelledby={`fec-tab-${tab}`} hidden={!open} className="max-h-[45vh] overflow-y-auto">
        {open && children}
      </div>
    </section>
  );
}
