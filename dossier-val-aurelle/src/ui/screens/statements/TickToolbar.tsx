/**
 * Bar above the tables (always visible): progress of the tab, legend of the
 * marks with their count in the tab, behaviour of a click on a cell (menu or
 * quick mark), clearing the tab.
 */
import { useEffect, useId, useState } from 'react';
import { formatPercent } from '../../../engine/format';
import type { TickMark } from '../../../game/state';
import { progressRatio, type TickProgress } from '../../../game/ticking';
import { Button, cx, Select, toneText } from '../../components/ui';
import { formatCount, plural } from './labels';

export interface TickToolbarProps {
  tabLabel: string;
  progress: TickProgress;
  marks: readonly TickMark[];
  clickMark: string | null;
  onClickMark: (id: string | null) => void;
  onClear: () => void;
  onManage: () => void;
}

export function TickToolbar({ tabLabel, progress, marks, clickMark, onClickMark, onClear, onManage }: TickToolbarProps) {
  const id = useId();
  const ratio = progressRatio(progress);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [tabLabel]);
  const known = new Set(marks.map((m) => m.id));
  const orphan = Object.entries(progress.byMark).reduce((s, [m, n]) => (known.has(m) ? s : s + n), 0);

  return (
    <section aria-label="Pointage de l’onglet et légende des marques" className="mb-3 rounded-lg border border-line bg-panel px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Pointage de l’onglet</span>
          <div
            role="progressbar"
            aria-label={`Pointage de l’onglet ${tabLabel}`}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.ticked}
            aria-valuetext={`${plural(progress.ticked, 'case pointée', 'cases pointées')} sur ${formatCount(progress.total)}`}
            className="h-1.5 w-28 rounded bg-sunken"
          >
            <div className="h-1.5 rounded bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          <span className="font-mono text-xs">
            {formatCount(progress.ticked)} / {formatCount(progress.total)}
          </span>
          <span className="text-xs text-muted">({formatPercent(ratio, 0)})</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-click`} className="text-xs text-muted">
            Clic sur une case
          </label>
          <Select id={`${id}-click`} value={clickMark ?? ''} onChange={(e) => onClickMark(e.target.value || null)} className="max-w-[16rem] py-0.5 text-xs">
            <option value="">ouvre le menu des marques</option>
            {marks.map((m) => (
              <option key={m.id} value={m.id}>
                applique {m.symbol} {m.label}
              </option>
            ))}
          </Select>
          <Button className="py-0.5 text-xs" onClick={onManage}>
            Gérer les marques…
          </Button>
          {confirming ? (
            <span role="alert" className="inline-flex items-center gap-1 text-xs">
              Effacer {plural(progress.ticked, 'case pointée', 'cases pointées')} ?
              <Button
                variant="danger"
                className="py-0.5 text-xs"
                onClick={() => {
                  onClear();
                  setConfirming(false);
                }}
              >
                Confirmer
              </Button>
              <Button autoFocus className="py-0.5 text-xs" onClick={() => setConfirming(false)}>
                Annuler
              </Button>
            </span>
          ) : (
            <Button variant="ghost" className="py-0.5 text-xs" disabled={progress.ticked === 0} onClick={() => setConfirming(true)}>
              Effacer le pointage de l’onglet
            </Button>
          )}
        </div>
      </div>

      <ul aria-label="Légende des marques (cases de l’onglet)" className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-1.5 text-xs">
        {marks.length === 0 && <li className="text-muted">Aucune marque : ouvrez la gestion des marques pour en créer.</li>}
        {marks.map((m, i) => {
          const n = progress.byMark[m.id] ?? 0;
          return (
            <li key={m.id} className={cx('inline-flex items-center gap-1.5', clickMark === m.id && 'rounded bg-accent-soft px-1')}>
              <span aria-hidden="true" className={cx('inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-sunken px-0.5 font-semibold', toneText(m.tone))}>
                {m.symbol}
              </span>
              <span>
                <span className="sr-only">{m.symbol} : </span>
                {m.label}
              </span>
              <span className="font-mono text-muted" aria-label={plural(n, 'case', 'cases')}>
                {formatCount(n)}
              </span>
              {i < 9 && (
                <span className="sr-only">
                  {' '}
                  (touche {i + 1})
                </span>
              )}
            </li>
          );
        })}
        {orphan > 0 && <li className="text-muted">Autres marques : {formatCount(orphan)}</li>}
        <li className="ml-auto text-muted">
          Sur une case : 1 à 9 pour une marque, Suppr pour effacer, flèches pour se déplacer, Maj + clic pour le menu.
        </li>
      </ul>
    </section>
  );
}
