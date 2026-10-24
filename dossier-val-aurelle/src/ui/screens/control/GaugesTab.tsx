/** Designer tab « Jauges »: every variation of the gauges up to the game date, with its reason and reference (plan J5 §17). */
import { formatDateFr } from '../../../engine/dates';
import { useCase } from '../../app/context';
import { useGaugeReport } from '../../app/hooks';
import { Card, EmptyState } from '../../components/ui';

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function GaugesTab() {
  const c = useCase();
  const report = useGaugeReport();
  const labels = c.params.game.gauges;
  return (
    <Card title="Variations des jauges jusqu’à la date du dossier">
      <p className="px-3 pt-2 text-xs text-muted">
        Valeurs : {Object.entries(report.values).map(([id, v]) => `${labels[id as keyof typeof labels]?.label ?? id} ${v}`).join(' ; ')}.
      </p>
      {report.history.length === 0 ? (
        <EmptyState>Aucune variation.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Variations des jauges</caption>
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-1.5 text-left font-medium">Date</th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">N°</th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">Jauge</th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">Motif</th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">Code</th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">Référence</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Effet</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Variation</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {report.history.map((h, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="px-3 py-1 font-mono text-xs">{formatDateFr(h.on)}</td>
                  <td className="px-3 py-1 font-mono text-xs">{h.seq}</td>
                  <td className="px-3 py-1">{labels[h.gauge]?.label ?? h.gauge}</td>
                  <td className="px-3 py-1">{h.label}</td>
                  <td className="px-3 py-1 font-mono text-xs">{h.reason}</td>
                  <td className="px-3 py-1 font-mono text-xs">{h.ref ?? ''}</td>
                  <td className="num px-3 py-1">{signed(h.effect)}</td>
                  <td className="num px-3 py-1">{signed(h.delta)}</td>
                  <td className="num px-3 py-1">{h.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
