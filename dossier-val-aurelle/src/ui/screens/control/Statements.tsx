import type { StatementLineDef } from '../../../engine/types';
import { useDossierData } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Panel, td, th } from '../../components/Panel';

function depth(defs: readonly StatementLineDef[], d: StatementLineDef): number {
  let n = 0;
  let p = d.parent;
  while (p) {
    n++;
    p = defs.find((x) => x.id === p)?.parent;
  }
  return n;
}

export function StatementsScreen() {
  const d = useDossierData();
  const defs = d.params.statements;
  const render = (statement: 'assets' | 'liabilities' | 'income', title: string) => {
    const lines = defs.filter((x) => x.statement === statement);
    const ordered = statement === 'income' ? lines : [...lines.filter((x) => x.kind !== 'total'), ...lines.filter((x) => x.kind === 'total')];
    return (
      <Panel title={title}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Rubrique</th>
              {statement === 'assets' && <th className={`${th} text-right`}>Brut 2025</th>}
              {statement === 'assets' && <th className={`${th} text-right`}>Amort. et dépréc.</th>}
              <th className={`${th} text-right`}>{statement === 'assets' ? 'Net 2025' : '2025'}</th>
              <th className={`${th} text-right`}>{statement === 'assets' ? 'Net 2024' : '2024'}</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((def) => {
              const v = d.statements.lines[def.id]!;
              const strong = def.kind !== 'detail';
              return (
                <tr key={def.id} className={strong ? 'font-semibold' : ''}>
                  <td className={td} style={{ paddingLeft: `${0.75 + depth(defs, def) * 1}rem` }}>{def.label}</td>
                  {statement === 'assets' && <td className={td}><Amount cents={v.currentGross ?? 0} /></td>}
                  {statement === 'assets' && <td className={td}><Amount cents={v.currentDepreciation ?? 0} /></td>}
                  <td className={td}><Amount cents={v.current} /></td>
                  <td className={td}><Amount cents={v.prior} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    );
  };
  const c = d.statements.checks;
  return (
    <>
      <p className="text-sm text-muted">
        Contrôles : actif = passif {c.assetsTotal === c.liabilitiesTotal ? '✓' : '✗'} ; résultat du compte de résultat = résultat au bilan {c.incomeStatementResult === c.balanceSheetResult ? '✓' : '✗'} ; exercice précédent : actif = passif {c.priorAssetsTotal === c.priorLiabilitiesTotal ? '✓' : '✗'}. Montants en euros.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {render('assets', 'Bilan – actif')}
        {render('liabilities', 'Bilan – passif')}
      </div>
      {render('income', 'Compte de résultat')}
    </>
  );
}
