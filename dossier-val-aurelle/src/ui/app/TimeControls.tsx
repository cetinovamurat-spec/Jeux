/**
 * Clock of the game in the top bar (plan J4 §5): date and phase, « Jour ouvré
 * suivant », « Prochain événement » with the list of what is expected, and,
 * in designer mode, a date picker (forward or backward).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateFr } from '../../engine/dates';
import { advanceOneDay, advanceTo, nextEventDate, upcomingEvents, type UpcomingContext } from '../../game/advance';
import { isOnSite, MEMBERS, workCalendar } from '../../game/calendar';
import { periodAt } from '../../game/clock';
import { Button, cx } from '../components/ui';
import { useFullCase } from './context';
import { useDesigner } from './hooks';
import { useGame } from './store';

export function TimeControls() {
  const c = useFullCase();
  const date = useGame((s) => s.game.clock.date);
  const act = useGame((s) => s.act);
  const game = useGame((s) => s.game);
  const designer = useDesigner();
  const cal = useMemo(() => workCalendar(c.params), [c]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const ctx: UpcomingContext = useMemo(() => ({ params: c.params, cal, date }), [c, cal, date]);
  const upcoming = useMemo(() => upcomingEvents(game, ctx), [game, ctx]);
  const period = periodAt(c.params.game.calendar, date);
  const onSite = MEMBERS.filter((m) => isOnSite(cal, m, date));
  const nextDate = nextEventDate(game, ctx);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative flex items-center gap-3">
      <div>
        <p className="text-sm font-semibold">{formatDateFr(date)}</p>
        <p className="text-xs text-muted">
          {period.current ? period.current.label : period.next ? `Hors site – avant : ${period.next.label.toLowerCase()}` : 'Mission terminée'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button onClick={() => act((s) => advanceOneDay(s, cal))} title="Avancer d’un jour ouvré">
          Jour ouvré suivant
        </Button>
        <Button onClick={() => act((s) => advanceTo(s, nextDate))} title={`Avancer jusqu’au prochain événement attendu (${formatDateFr(nextDate)})`}>
          Prochain événement
        </Button>
        <Button variant="ghost" aria-expanded={open} aria-controls="clock-upcoming" onClick={() => setOpen((o) => !o)} title="Ce qui est attendu">
          Attendus ▾
        </Button>
      </div>
      {designer && (
        <label className="flex items-center gap-1 text-xs text-warn">
          Concepteur
          <input
            type="date"
            aria-label="Date du dossier (mode concepteur)"
            value={date}
            onChange={(e) => e.target.value && act((s) => advanceTo(s, e.target.value))}
            className="rounded border border-warn/50 bg-panel px-1 py-0.5 text-xs"
          />
        </label>
      )}
      {open && (
        <div id="clock-upcoming" role="dialog" aria-label="Événements attendus" className="absolute left-0 top-full z-40 mt-1 w-[30rem] rounded-lg border border-line bg-panel p-2 shadow-xl">
          {upcoming.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted">Rien n’est attendu.</p>
          ) : (
            <ul className="max-h-80 overflow-auto text-sm">
              {upcoming.slice(0, 20).map((e, i) => (
                <li key={`${e.date}-${i}`} className={cx('flex gap-3 rounded px-2 py-1', i === 0 && 'bg-accent-soft')}>
                  <span className="w-20 shrink-0 font-mono text-xs leading-5 text-muted">{formatDateFr(e.date)}</span>
                  <span className="min-w-0 flex-1">{e.label}</span>
                  <Button
                    variant="ghost"
                    className="shrink-0 px-1.5 py-0 text-xs"
                    onClick={() => {
                      act((s) => advanceTo(s, e.date));
                      setOpen(false);
                    }}
                  >
                    Y aller
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 border-t border-line px-2 pt-1 text-xs text-muted">
            Sur site ce jour : {onSite.length ? onSite.map((m) => c.params.game.team.find((t) => t.id === m)?.name ?? m).join(', ') : 'personne'}.
          </p>
        </div>
      )}
    </div>
  );
}
