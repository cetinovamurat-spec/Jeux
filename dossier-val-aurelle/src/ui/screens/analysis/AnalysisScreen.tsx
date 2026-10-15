/**
 * Analytical review (route '/analyse', §10.4): variations of the income
 * statement and of the balance sheet against thresholds typed by the player,
 * HLM ratios with their components and the Livret A average rate, charts.
 * Generic audit tools only: nothing points at the anomalies of the case
 * (the designer mode adds the comparison with the clean accounts).
 */
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { Badge, PageHeader, Tabs } from '../../components/ui';
import { useAnalysisView, type AnalysisTab } from './analysisView';
import { Charts } from './Charts';
import { RatiosPanel } from './RatiosPanel';
import { VariationReview } from './VariationReview';

const TABS: readonly { id: AnalysisTab; label: string }[] = [
  { id: 'income', label: 'Compte de résultat' },
  { id: 'balance', label: 'Bilan' },
  { id: 'ratios', label: 'Ratios HLM' },
  { id: 'charts', label: 'Graphiques' },
];

export function AnalysisScreen() {
  const c = useCase();
  const designer = useDesigner();
  const tab = useAnalysisView((s) => s.tab);
  const update = useAnalysisView((s) => s.update);
  const { current, prior } = c.params.scenario.years;
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  return (
    <>
      <PageHeader
        title="Revue analytique"
        description={
          <>
            Comptes {current} présentés par la société et comparatif {prior} tel que présenté : variations des états financiers au regard de vos seuils, ratios HLM et graphiques. Les conventions de calcul des ratios sont
            des propositions à valider.
          </>
        }
        actions={
          designer ? (
            <Badge tone="warn" title="Colonnes supplémentaires : comptes propres (clé de correction)">
              Concepteur : comparaison avec les comptes propres
            </Badge>
          ) : undefined
        }
      />
      <Tabs value={active.id} onChange={(id) => update({ tab: id })} items={TABS} label="Revue analytique" />
      <div role="tabpanel" aria-label={active.label} className="pt-3">
        {active.id === 'income' && <VariationReview key="income" kind="income" />}
        {active.id === 'balance' && <VariationReview key="balance" kind="balance" />}
        {active.id === 'ratios' && <RatiosPanel />}
        {active.id === 'charts' && <Charts />}
      </div>
    </>
  );
}
