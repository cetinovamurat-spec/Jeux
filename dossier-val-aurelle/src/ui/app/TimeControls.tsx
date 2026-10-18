/**
 * Clock of the game in the top bar (plan J4 §5): date and phase, « Jour ouvré
 * suivant », « Prochain événement » with the list of what is expected, and,
 * in designer mode, a date picker (forward or backward).
 *
 * Leaving the planning for the interim without validated materiality, risks
 * and programme asks for a confirmation: going on costs the partner's trust
 * (gauge event, game/planning.ts). The designer date picker is not checked.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDateFr, type IsoDate } from '../../engine/dates';
import { advanceTo, nextEventDate, upcomingEvents, type UpcomingContext } from '../../game/advance';
import { isOnSite, MEMBERS, nextWorkingDay, workCalendar } from '../../game/calendar';
import { periodAt } from '../../game/clock';
import { leavePlanningCheck, recordInterimWithoutPlanning, type LeavePlanningCheck } from '../../game/planning';
import { Button, cx } from '../components/ui';
import { useFullCase } from './context';
import { useDesigner } from './hooks';
import { useGame } from './store';
import { useRequestDocDates } from '../screens/ged/replies';

export function TimeControls() {
  const c = useFullCase();
  const date = useGame((s) => s.game.clock.date);
  const act = useGame((s) => s.act);
  const game = useGame((s) => s.game);
  const designer = useDesigner();
  const cal = useMemo(() => workCalendar(c.params), [c]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const requestDocDates = useRequestDocDates();
  const ctx: UpcomingContext = useMemo(() => ({ params: c.params, cal, date, requestDocDates }), [c, cal, date, requestDocDates]);
  const upcoming = useMemo(() => upcomingEvents(game, ctx), [game, ctx]);
  const period = periodAt(c.params.game.calendar, date);
  const onSite = MEMBERS.filter((m) => isOnSite(cal, m, date));
  const nextDate = nextEventDate(game, ctx);
  const [leaving, setLeaving] = useState<{ target: IsoDate; check: LeavePlanningCheck } | null>(null);

  /** Moves the clock, after the check of the planning when the move leaves it. */
  const moveTo = (target: IsoDate) => {
    const check = designer ? null : leavePlanningCheck(game, c.params, target);
    if (check) setLeaving({ target, check });
    else act((s) => advanceTo(s, target));
  };

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
        <Button className="whitespace-nowrap" onClick={() => moveTo(nextWorkingDay(cal, date))} title="Avancer d’un jour ouvré">
          Jour ouvré suivant
        </Button>
        <Button className="whitespace-nowrap" onClick={() => moveTo(nextDate)} title={`Avancer jusqu’au prochain événement attendu (${formatDateFr(nextDate)})`}>
          Prochain événement
        </Button>
        <Button variant="ghost" className="whitespace-nowrap" aria-expanded={open} aria-controls="clock-upcoming" onClick={() => setOpen((o) => !o)} title="Ce qui est attendu">
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
                      setOpen(false);
                      moveTo(e.date);
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
      <LeavePlanningDialog
        leaving={leaving}
        partner={c.params.game.firm.find((f) => f.id === 'partner')?.name ?? 'L’associée'}
        onCancel={() => setLeaving(null)}
        onConfirm={() => {
          const target = leaving?.target;
          setLeaving(null);
          if (target) act((s) => advanceTo(recordInterimWithoutPlanning(s), target));
        }}
      />
    </div>
  );
}

/** Confirmation before leaving the planning without validated materiality, risks and programme (plan J4 §3). */
function LeavePlanningDialog({ leaving, partner, onCancel, onConfirm }: { leaving: { target: IsoDate; check: LeavePlanningCheck } | null; partner: string; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (leaving && !d.open) d.showModal();
    if (!leaving && d.open) d.close();
  }, [leaving]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="leave-planning-title"
      aria-describedby="leave-planning-text"
      onClose={onCancel}
      className="m-auto w-[min(34rem,94vw)] rounded-lg border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      {leaving && (
        <div className="space-y-3 px-5 py-4 text-sm">
          <h2 id="leave-planning-title" className="text-base font-semibold">
            Quitter la planification ?
          </h2>
          <div id="leave-planning-text" className="space-y-2">
            <p>
              L’intérim commence et la planification n’est pas validée. {partner} attend avant l’intérim :
            </p>
            <ul className="list-disc space-y-0.5 pl-6">
              {leaving.check.missing.map((m) => (
                <li key={m.step}>{m.label}</li>
              ))}
            </ul>
            <p className="text-warn">
              {leaving.check.alreadyRecorded
                ? 'Elle a déjà relevé que l’intérim avait commencé sans planification validée.'
                : 'Commencer l’intérim sans planification validée entame sa confiance.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              autoFocus
              onClick={() => {
                onCancel();
                navigate('/planification');
              }}
            >
              Revenir à la planification
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              Continuer jusqu’au {formatDateFr(leaving.target)}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
