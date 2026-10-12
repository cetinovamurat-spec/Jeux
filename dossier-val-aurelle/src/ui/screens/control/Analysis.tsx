import { formatPercent } from '../../../engine/format';
import { useDossierData } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Panel, td, th } from '../../components/Panel';

export function AnalysisScreen() {
  const d = useDossierData();
  const f25 = d.figures.y2025;
  const f24 = d.figures.y2024;
  const rows: [string, number, number, boolean?][] = [
    ['Loyers nets de RLS', f25.rents, f24.rents],
    ['Récupération des charges locatives', f25.chargeRecoveries, f24.chargeRecoveries],
    ['Excédent brut d’exploitation', f25.ebe, f24.ebe],
    ['Frais financiers', f25.financialCharges, f24.financialCharges],
    ['Plus-values nettes de cessions', f25.disposalGains, f24.disposalGains],
    ['Résultat net', f25.netResult, f24.netResult, true],
    ['+ Charges calculées (dotations, valeurs comptables des éléments cédés)', f25.cafAddBack, f24.cafAddBack],
    ['− Produits calculés et produits de cession (reprises, quote-part de subventions, cessions)', -f25.cafDeduct, -f24.cafDeduct],
    ['Capacité d’autofinancement (méthode additive)', f25.caf, f24.caf, true],
    ['− Remboursements d’emprunts locatifs (hors anticipés)', -f25.loanRepayments, -f24.loanRepayments],
    ['Autofinancement net HLM', f25.netSelfFinancing, f24.netSelfFinancing, true],
    ['Dénominateur (produits d’activité hors récupérations + produits financiers)', f25.denominator, f24.denominator],
  ];
  const ref = d.params.regulatory.netSelfFinancing;
  const history = [...d.params.scenario.history.map((h) => ({ year: h.year, ratio: h.netSelfFinancingRatioPct / 100 })), { year: 2024, ratio: f24.netSelfFinancingRatio }, { year: 2025, ratio: f25.netSelfFinancingRatio }];
  const last3 = history.slice(-3);
  const mean3 = last3.reduce((s, h) => s + h.ratio, 0) / 3;
  return (
    <>
      <Panel title="CAF et autofinancement net HLM (comptes propres) – convention paramétrable, à valider">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Agrégat</th>
              <th className={`${th} text-right`}>2025</th>
              <th className={`${th} text-right`}>2024</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b, strong]) => (
              <tr key={label} className={strong ? 'font-semibold' : ''}>
                <td className={td}>{label}</td>
                <td className={td}><Amount cents={a} /></td>
                <td className={td}><Amount cents={b} /></td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={td}>Ratio d’autofinancement net</td>
              <td className={`${td} num`}>{formatPercent(f25.netSelfFinancingRatio, 2)}</td>
              <td className={`${td} num`}>{formatPercent(f24.netSelfFinancingRatio, 2)}</td>
            </tr>
            <tr>
              <td className={td}>EBE / loyers</td>
              <td className={`${td} num`}>{formatPercent(f25.ebeOnRents, 1)}</td>
              <td className={`${td} num`}>{formatPercent(f24.ebeOnRents, 1)}</td>
            </tr>
          </tbody>
        </table>
      </Panel>
      <Panel title="Historique du ratio d’autofinancement net">
        <table className="w-full">
          <thead>
            <tr>
              {history.map((h) => (
                <th key={h.year} className={`${th} text-right`}>{h.year}</th>
              ))}
              <th className={`${th} text-right`}>Moyenne 3 ans</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {history.map((h) => (
                <td key={h.year} className={`${td} num`}>{formatPercent(h.ratio, 2)}</td>
              ))}
              <td className={`${td} num font-semibold`}>{formatPercent(mean3, 2)}</td>
            </tr>
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-muted">
          Taux de référence paramétrés (à vérifier, {ref.ref}) : {ref.referenceRateYearPct} % pour l’exercice et {ref.referenceRate3YearsPct} % en moyenne sur trois exercices ({ref.threeYearMethod === 'meanOfRatios' ? 'moyenne des ratios' : 'ratio des cumuls'}). Les exercices 2021 à 2023 sont des agrégats paramétrés.
        </p>
      </Panel>
    </>
  );
}
