/** Desk: engagement agenda (Gantt of the game calendar periods, game date marked). */
import { useMemo } from 'react';
import { daysBetween, formatDateFr } from '../../../engine/dates';
import { periodAt } from '../../../game/clock';
import type { Tone } from '../../../game/state';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Card, cx } from '../../components/ui';
import { buildTimeline, periodDates, relativeDays, STATUS_LABEL, type PeriodStatus, type Timeline } from './agenda';

const STATUS_TONE: Record<PeriodStatus, Tone> = { past: 'ok', current: 'accent', upcoming: 'muted' };

const BAR_CLASS: Record<PeriodStatus, string> = {
  past: 'bg-muted/45',
  current: 'bg-accent',
  upcoming: 'border border-accent/70 bg-accent/25',
};

const GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-x-3';

/** Month boundaries and game date line of a track cell. */
function TrackBackground({ t }: { t: Timeline }) {
  return (
    <>
      {t.months.map((m) => (
        <span key={`${m.year}-${m.label}`} className="absolute inset-y-0 border-l border-line" style={{ left: `${m.leftPct}%` }} />
      ))}
      <span className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-warn" style={{ left: `${t.todayPct}%` }} />
    </>
  );
}

function Header({ t }: { t: Timeline }) {
  return (
    <div className={cx(GRID, 'items-end')} aria-hidden="true">
      <span className="pb-1 text-xs text-muted">Étape</span>
      <div className="relative h-9 text-[11px] text-muted">
        {t.years.map((y) => (
          <span key={y.year} className="absolute top-0 truncate border-l border-line pl-1 font-semibold" style={{ left: `${y.leftPct}%`, width: `${y.widthPct}%` }}>
            {y.year}
          </span>
        ))}
        {t.months.map((m) => (
          <span key={`${m.year}-${m.label}`} className="absolute bottom-0 truncate border-l border-line pb-0.5 text-center" style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgendaCard() {
  const c = useCase();
  const date = useGame((s) => s.game.clock.date);
  const calendar = c.params.game.calendar;
  const t = useMemo(() => buildTimeline(calendar, date), [calendar, date]);
  const { current, next } = useMemo(() => periodAt(calendar, date), [calendar, date]);
  const reporting = calendar.find((p) => p.id === 'reporting');

  return (
    <Card title="Agenda de la mission" actions={<Badge tone="warn">Aujourd’hui : {formatDateFr(date)}</Badge>}>
      <div className="space-y-1 px-3 pt-2.5 text-sm">
        {current ? (
          <p>
            Phase en cours : <span className="font-semibold text-accent">{current.label}</span>
            {current.from !== current.to && (
              <span className="text-muted">
                {' '}
                – jusqu’au {formatDateFr(current.to)} ({relativeDays(daysBetween(date, current.to))})
              </span>
            )}
          </p>
        ) : (
          <p className="text-muted">Aucune phase en cours à cette date.</p>
        )}
        {next && (
          <p>
            Étape suivante : <span className="font-semibold">{next.label}</span>{' '}
            <span className="text-muted">
              {periodDates(next, formatDateFr)} ({relativeDays(daysBetween(date, next.from))})
            </span>
          </p>
        )}
        {reporting && (
          <p>
            Signature du rapport au plus tard le <span className="font-mono">{formatDateFr(reporting.to)}</span>{' '}
            <span className="text-muted">({relativeDays(daysBetween(date, reporting.to))})</span>
          </p>
        )}
      </div>
      <div className="px-3 pb-3 pt-3">
        <Header t={t} />
        <ol aria-label="Étapes de la mission" className="border-b border-line">
          {t.bars.map((b) => (
            <li key={b.period.id} aria-current={b.status === 'current' ? 'step' : undefined} className={cx(GRID, 'border-t border-line', b.status === 'current' && 'bg-accent-soft')}>
              <div className="min-w-0 py-1.5 pl-1">
                <p className={cx('text-sm leading-snug', b.status === 'current' && 'font-semibold text-accent', b.status === 'past' && 'text-muted')}>{b.period.label}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  <span className="font-mono">{b.milestone ? formatDateFr(b.period.from) : `${formatDateFr(b.period.from)} – ${formatDateFr(b.period.to)}`}</span>
                  <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                </p>
              </div>
              <div className="relative min-h-10" aria-hidden="true">
                <TrackBackground t={t} />
                {b.milestone ? (
                  <span
                    title={`${b.period.label} : ${formatDateFr(b.period.from)}`}
                    className={cx('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45', BAR_CLASS[b.status])}
                    style={{ left: `${b.leftPct + b.widthPct / 2}%` }}
                  />
                ) : (
                  <span
                    title={`${b.period.label} : ${formatDateFr(b.period.from)} – ${formatDateFr(b.period.to)}`}
                    className={cx('absolute top-1/2 h-2.5 min-w-1 -translate-y-1/2 rounded-sm', BAR_CLASS[b.status])}
                    style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className={cx('inline-block h-2 w-4 rounded-sm', BAR_CLASS.past)} /> Terminé
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cx('inline-block h-2 w-4 rounded-sm', BAR_CLASS.current)} /> En cours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cx('inline-block h-2 w-4 rounded-sm', BAR_CLASS.upcoming)} /> À venir
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rotate-45 bg-muted/60" /> Jalon
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 bg-warn" /> Date du jour
          </span>
        </p>
      </div>
    </Card>
  );
}
