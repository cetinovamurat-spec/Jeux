/**
 * Desk: relationship gauges (§10.2) with a one-line explanation of each, their
 * value derived at the game date (game/gauge-values.ts) and their last
 * variations, with a generic label (plan J5 §10.5: never a lead).
 */
import { formatDateFr } from '../../../engine/dates';
import type { GaugeId } from '../../../game/gauges';
import { useCase } from '../../app/context';
import { useGaugeReport } from '../../app/hooks';
import { Card, cx } from '../../components/ui';

/** Number of the last variations shown under each gauge. */
const LAST_VARIATIONS = 5;

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

function explanation(id: string, low: number, chiefAccountant: string): string {
  switch (id) {
    case 'clientRelation':
      return `Se dégrade en cas d’accusation infondée, de demandes inutiles répétées ou de ton agressif. En dessous de ${low}, les réponses du client deviennent plus lentes et moins complètes.`;
    case 'partnerTrust':
      return 'Progresse avec des remontées pertinentes et anticipées ; baisse avec les surprises tardives, les dépassements de budget injustifiés et les erreurs de revue.';
    case 'karimTrust':
      return `Se gagne par des entretiens en tête-à-tête, dans le respect et sans mise en cause publique ; débloque les confidences de ${chiefAccountant}.`;
    default:
      return '';
  }
}

function tone(value: number, low: number): string {
  if (value <= low) return 'bg-ko';
  if (value < 50) return 'bg-warn';
  return 'bg-ok';
}

export function GaugesCard() {
  const c = useCase();
  const gauges = Object.entries(c.params.game.gauges) as [GaugeId, (typeof c.params.game.gauges)[GaugeId]][];
  const chiefAccountant = c.params.documents.people['chiefAccountant']?.name ?? 'chef comptable';
  const report = useGaugeReport();

  return (
    <Card title="Jauges">
      <ul className="divide-y divide-line">
        {gauges.map(([id, g]) => {
          const value = report.values[id] ?? g.initial;
          const text = explanation(id, g.lowThreshold, chiefAccountant);
          const last = report.history.filter((h) => h.gauge === id && h.delta !== 0).slice(-LAST_VARIATIONS).reverse();
          return (
            <li key={id} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span id={`desk-gauge-${id}`} className="text-sm font-medium">
                  {g.label}
                </span>
                <span className="font-mono text-sm">
                  {value}
                  <span className="text-xs text-muted"> / 100</span>
                </span>
              </div>
              <div
                role="meter"
                aria-labelledby={`desk-gauge-${id}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                aria-valuetext={`${value} sur 100${g.lowThreshold > 0 ? `, seuil bas ${g.lowThreshold}` : ''}`}
                className="relative mt-1.5 h-2 rounded bg-sunken"
              >
                <div className={cx('h-2 rounded', tone(value, g.lowThreshold))} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
                {g.lowThreshold > 0 && <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 bg-ink/70" style={{ left: `${g.lowThreshold}%` }} title={`Seuil bas : ${g.lowThreshold}`} />}
              </div>
              {g.lowThreshold > 0 && <p className="mt-1 text-[11px] text-muted">Seuil bas : {g.lowThreshold}</p>}
              {text && <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>}
              {last.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs" aria-label={`Dernières variations : ${g.label}`}>
                  {last.map((h, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="w-20 shrink-0 font-mono text-muted">{formatDateFr(h.on)}</span>
                      <span className="min-w-0 flex-1">{h.label}</span>
                      <span className={cx('shrink-0 font-mono', h.delta < 0 ? 'text-ko' : 'text-ok')}>{signed(h.delta)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
