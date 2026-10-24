/** Desk: steps of the method validated by the player (prescriptive, never a lead). */
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { useGame } from '../../app/store';
import { Card } from '../../components/ui';

export function MethodCard() {
  const validated = useGame((s) => s.game.planning.validated);
  const items: { label: string; on: string | undefined }[] = [
    { label: 'Seuils de signification', on: validated.materiality },
    { label: 'Évaluation des risques', on: validated.risks },
    { label: 'Programme de travail', on: validated.program },
  ];
  return (
    <Card title="Méthode" actions={<Link to="/planification" className="text-xs text-accent hover:underline">Planification</Link>}>
      <ul className="space-y-1 px-3 py-2 text-sm">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span aria-hidden className={it.on ? 'text-ok' : 'text-muted'}>
              {it.on ? '☑' : '☐'}
            </span>
            <span>{it.label}</span>
            <span className="ml-auto text-xs text-muted">{it.on ? `validé le ${formatDateFr(it.on)}` : 'à faire'}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
