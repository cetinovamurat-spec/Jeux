import { useDossierData } from '../../app/context';
import { Panel, td, th } from '../../components/Panel';

export function Targets() {
  const d = useDossierData();
  const ok = d.calibration.filter((r) => r.ok).length;
  return (
    <Panel title={`Cibles de calibrage – ${ok}/${d.calibration.length} atteintes (génération : ${(d.durationMs / 1000).toLocaleString('fr-FR')} s)`}>
      <table className="w-full">
        <thead>
          <tr>
            <th className={th}>Exercice</th>
            <th className={th}>Agrégat</th>
            <th className={`${th} text-right`}>Cible</th>
            <th className={`${th} text-right`}>Obtenu</th>
            <th className={th}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {d.calibration.map((r) => (
            <tr key={`${r.year}-${r.key}`}>
              <td className={td}>{r.year === 'J2' ? 'Anomalies (J2)' : r.year}</td>
              <td className={td}>{r.label}</td>
              <td className={`${td} num`}>{r.targetText}</td>
              <td className={`${td} num`}>{r.valueText}</td>
              <td className={`${td} font-semibold ${r.ok ? 'text-ok' : 'text-ko'}`}>{r.ok ? 'Atteinte' : 'Hors tolérance'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
