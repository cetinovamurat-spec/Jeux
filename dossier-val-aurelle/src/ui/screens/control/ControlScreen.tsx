/** Designer control screens (J1): clean world, calibration targets, statements, annex, FEC. */
import { NavLink, Outlet } from 'react-router';
import { DossierProvider } from '../../app/context';
import { useCase } from '../../app/context';
import { cx } from '../../components/ui';

export const CONTROL_TABS = [
  { to: '/controle', label: 'Cibles de calibrage' },
  { to: '/controle/balance', label: 'Balance (comptes propres)' },
  { to: '/controle/etats', label: 'États (comptes propres)' },
  { to: '/controle/annexe', label: 'Annexe (comptes propres)' },
  { to: '/controle/analyse', label: 'CAF et autofinancement' },
  { to: '/controle/fec', label: 'FEC (comptes propres)' },
];

export function ControlScreen() {
  const c = useCase();
  return (
    <DossierProvider data={c.payload.control}>
      <div className="mb-3">
        <h1 className="text-lg font-semibold">Contrôle – comptes propres (mode concepteur)</h1>
        <p className="text-sm text-muted">Monde propre généré par le moteur (comptes corrigés), cibles de calibrage des comptes propres et présentés. Dossier construit en {c.payload.durationMs.toLocaleString('fr-FR')} ms.</p>
      </div>
      <nav aria-label="Contrôle" className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {CONTROL_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => cx('-mb-px rounded-t-md border px-3 py-1.5 text-sm', isActive ? 'border-line border-b-panel bg-panel font-semibold text-accent' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-4">
        <Outlet />
      </div>
    </DossierProvider>
  );
}
