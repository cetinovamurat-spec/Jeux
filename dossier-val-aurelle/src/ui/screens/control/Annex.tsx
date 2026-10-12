import { useDossierData } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Panel, td, th } from '../../components/Panel';

export function AnnexScreen() {
  const d = useDossierData();
  return (
    <>
      {d.annex.current.map((t) => (
        <Panel key={t.id} title={`${t.title} – exercice 2025`}>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Rubrique</th>
                {t.columns.map((c) => (
                  <th key={c.id} className={`${th} text-right`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.label}</td>
                  {t.columns.map((c) => (
                    <td key={c.id} className={td}><Amount cents={r.values[c.id] ?? 0} /></td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>Total</td>
                {t.columns.map((c) => (
                  <td key={c.id} className={td}><Amount cents={t.rows.reduce((s, r) => s + (r.values[c.id] ?? 0), 0)} /></td>
                ))}
              </tr>
            </tbody>
          </table>
          {t.notes?.map((n) => (
            <p key={n} className="px-4 py-2 text-xs text-muted">{n}</p>
          ))}
        </Panel>
      ))}
    </>
  );
}
