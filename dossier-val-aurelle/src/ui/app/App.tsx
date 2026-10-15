import { useEffect, useMemo } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { setDesigner } from '../../game/state';
import { loadParams } from '../../scenario/params';
import { AnalysisScreen } from '../screens/analysis/AnalysisScreen';
import { BalanceScreen } from '../screens/balance/BalanceScreen';
import { AnalysisScreen as ControlAnalysis } from '../screens/control/Analysis';
import { AnnexScreen as ControlAnnex } from '../screens/control/Annex';
import { BalanceScreen as ControlBalance } from '../screens/control/Balance';
import { ControlScreen } from '../screens/control/ControlScreen';
import { FecScreen as ControlFec } from '../screens/control/Fec';
import { StatementsScreen as ControlStatements } from '../screens/control/Statements';
import { Targets } from '../screens/control/Targets';
import { DeskScreen } from '../screens/desk/DeskScreen';
import { FindingsScreen } from '../screens/findings/FindingsScreen';
import { PlanningScreen } from '../screens/planning/PlanningScreen';
import { WorkScreen } from '../screens/work/WorkScreen';
import { FecScreen } from '../screens/fec/FecScreen';
import { GedScreen } from '../screens/ged/GedScreen';
import { LedgerScreen } from '../screens/ledger/LedgerScreen';
import { StatementsScreen } from '../screens/statements/StatementsScreen';
import { CaseData } from './case';
import { CaseProvider } from './context';
import { DataGate } from './DataGate';
import { useCaseLoader } from './dossier';
import { DesignerOnly, NotFound, RootError, ScreenError } from './RouteStates';
import { Shell } from './Shell';
import { useGame } from './store';

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    errorElement: <RootError />,
    children: [
      {
        errorElement: <ScreenError />,
        children: [
          { index: true, element: <DeskScreen /> },
          { path: 'planification', element: <PlanningScreen /> },
          { path: 'travaux', element: <WorkScreen /> },
          { path: 'constats', element: <FindingsScreen /> },
          { path: 'ged', element: <GedScreen /> },
          { path: 'ged/:docId', element: <GedScreen /> },
          {
            path: 'balance',
            element: (
              <DataGate need="ledger2025" title="Balance N / N-1">
                <BalanceScreen />
              </DataGate>
            ),
          },
          { path: 'grand-livre', element: <LedgerScreen /> },
          { path: 'fec', element: <FecScreen /> },
          { path: 'etats', element: <StatementsScreen /> },
          {
            path: 'analyse',
            element: (
              <DataGate need="statements2025" title="Revue analytique">
                <AnalysisScreen />
              </DataGate>
            ),
          },
          {
            path: 'controle',
            element: (
              <DesignerOnly>
                <ControlScreen />
              </DesignerOnly>
            ),
            children: [
              { index: true, element: <Targets /> },
              { path: 'balance', element: <ControlBalance /> },
              { path: 'etats', element: <ControlStatements /> },
              { path: 'annexe', element: <ControlAnnex /> },
              { path: 'analyse', element: <ControlAnalysis /> },
              { path: 'fec', element: <ControlFec /> },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

/**
 * `?designer=1` (before or after the hash) switches the designer mode on;
 * `?designer=0` switches it off. On a change of address only the parameter
 * after the hash counts (the one before it was applied at load).
 */
function designerFlag(hashOnly: boolean): boolean | null {
  const read = (s: string) => new URLSearchParams(s).get('designer');
  const v = read(window.location.hash.split('?')[1] ?? '') ?? (hashOnly ? null : read(window.location.search));
  return v === null ? null : v === '1';
}

export function App() {
  const state = useCaseLoader();
  const act = useGame((s) => s.act);
  useEffect(() => {
    // on load, and on every change of address (a link or a typed URL with ?designer= after the #)
    const apply = (hashOnly: boolean) => {
      const flag = designerFlag(hashOnly);
      if (flag !== null) act((s) => (s.settings.designer === flag ? s : setDesigner(s, flag)));
    };
    const onHashChange = () => apply(true);
    apply(false);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [act]);
  const data = useMemo(() => (state.status === 'ready' ? new CaseData(state.payload, loadParams()) : null), [state]);
  if (state.status === 'error')
    return (
      <div role="alert" className="p-8 text-ko">
        Erreur de génération du dossier : {state.message}
      </div>
    );
  if (!data)
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted">
        <p className="text-base font-semibold text-ink">Dossier Val d’Aurelle</p>
        <p>{state.status === 'loading' ? state.step : ''}</p>
      </div>
    );
  return (
    <CaseProvider value={data}>
      <RouterProvider router={router} />
    </CaseProvider>
  );
}
