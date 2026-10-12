import { createHashRouter, NavLink, Outlet, RouterProvider } from 'react-router';
import { DossierProvider } from './context';
import { useDossier } from './dossier';
import { Targets } from '../screens/Targets';
import { BalanceScreen } from '../screens/Balance';
import { StatementsScreen } from '../screens/Statements';
import { AnnexScreen } from '../screens/Annex';
import { AnalysisScreen } from '../screens/Analysis';
import { FecScreen } from '../screens/Fec';

const TABS = [
  { to: '/', label: 'Cibles de calibrage' },
  { to: '/balance', label: 'Balance N / N-1' },
  { to: '/etats', label: 'États financiers' },
  { to: '/annexe', label: 'Annexe' },
  { to: '/analyse', label: 'CAF et autofinancement' },
  { to: '/fec', label: 'FEC' },
];

function Layout() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Dossier Val d’Aurelle – écran de contrôle</h1>
          <p className="text-sm text-muted">Comptes propres 2025 et comptes certifiés 2024 générés par le moteur (jalon J1). Les anomalies seront injectées au jalon J2.</p>
        </div>
      </header>
      <nav aria-label="Sections" className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => `-mb-px rounded-t-md border px-3 py-1.5 text-sm ${isActive ? 'border-line border-b-panel bg-panel font-semibold text-accent' : 'border-transparent text-muted hover:text-ink'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <main className="space-y-4">
        <Outlet />
      </main>
    </div>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Targets /> },
      { path: 'balance', element: <BalanceScreen /> },
      { path: 'etats', element: <StatementsScreen /> },
      { path: 'annexe', element: <AnnexScreen /> },
      { path: 'analyse', element: <AnalysisScreen /> },
      { path: 'fec', element: <FecScreen /> },
    ],
  },
]);

export function App() {
  const state = useDossier();
  if (state.status === 'loading')
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-muted">
        Génération du dossier en cours (grand livre 2024 et 2025, sous-ledgers, calibrage)…
      </div>
    );
  if (state.status === 'error') return <div role="alert" className="p-8 text-ko">Erreur de génération : {state.message}</div>;
  return (
    <DossierProvider data={state.data}>
      <RouterProvider router={router} />
    </DossierProvider>
  );
}
