/** Desk: relationship gauges (§10.2) with a one-line explanation of each. */
import { useCase } from '../../app/context';
import { Card, cx } from '../../components/ui';

/**
 * Current value of a gauge. The gauges move with the player's actions from
 * J4/J5 on (interviews, requests, escalations); until then, the initial value.
 */
function gaugeValue(initial: number): number {
  return initial;
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
  const gauges = Object.entries(c.params.game.gauges);
  const chiefAccountant = c.params.documents.people['chiefAccountant']?.name ?? 'chef comptable';

  return (
    <Card title="Jauges">
      <ul className="divide-y divide-line">
        {gauges.map(([id, g]) => {
          const value = gaugeValue(g.initial);
          const text = explanation(id, g.lowThreshold, chiefAccountant);
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
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
