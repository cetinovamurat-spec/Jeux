/** Game shell: sidebar navigation, top bar (date, period, gauges, budget), command palette, theme. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { formatDateFr } from '../../engine/dates';
import { periodAt } from '../../game/clock';
import { setTheme, type ThemeChoice } from '../../game/state';
import { Badge, cx, Gauge, Kbd, Select } from '../components/ui';
import { useCase } from './context';
import { CommandPalette } from './CommandPalette';
import { NAV } from './routes';
import { useGame } from './store';

export function Shell() {
  const c = useCase();
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const [palette, setPalette] = useState(false);
  const location = useLocation();
  const designer = game.settings.designer;
  const gp = c.params.game;

  useEffect(() => {
    const root = document.documentElement;
    if (game.settings.theme === 'system') delete root.dataset['theme'];
    else root.dataset['theme'] = game.settings.theme;
  }, [game.settings.theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setPalette(false), [location.pathname]);

  const period = periodAt(gp.calendar, game.clock.date);
  const budget = gp.budgetHours[game.difficulty];

  return (
    <div className="grid min-h-screen grid-cols-[13.5rem_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">{gp.firmName}</p>
          <p className="text-sm font-semibold leading-tight">{c.params.scenario.entity.name}</p>
          <p className="text-xs text-muted">Exercice clos le 31/12/2025</p>
        </div>
        <nav aria-label="Navigation principale" className="flex-1 overflow-auto py-2">
          {NAV.filter((n) => designer || !n.designerOnly).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              title={n.description}
              className={({ isActive }) => cx('mx-2 block rounded-md px-3 py-1.5 text-sm', isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-ink hover:bg-sunken', n.designerOnly && 'italic')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs">
          <button type="button" onClick={() => setPalette(true)} className="flex w-full items-center justify-between rounded-md border border-line px-2 py-1 text-muted hover:bg-sunken">
            Rechercher <Kbd>Ctrl K</Kbd>
          </button>
          <label className="flex items-center justify-between gap-2 text-muted">
            Thème
            <Select aria-label="Thème" value={game.settings.theme} onChange={(e) => act((s) => setTheme(s, e.target.value as ThemeChoice))} className="py-0.5 text-xs">
              <option value="system">Système</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </Select>
          </label>
          {designer && <Badge tone="warn" title="Mode concepteur : clé, documents débloqués, indices visibles">Mode concepteur</Badge>}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel/95 px-5 py-2 backdrop-blur">
          <div>
            <p className="text-sm font-semibold">{formatDateFr(game.clock.date)}</p>
            <p className="text-xs text-muted">{period.current ? period.current.label : period.next ? `Avant : ${period.next.label.toLowerCase()}` : 'Mission terminée'}</p>
          </div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(gp.gauges).map(([id, g]) => (
              <Gauge key={id} label={g.label} value={g.initial} low={g.lowThreshold} />
            ))}
          </div>
          <div className="ml-auto text-right text-xs">
            <p className="text-muted">Budget</p>
            <p className="font-mono text-sm">0 / {budget} h</p>
          </div>
        </header>
        <main className="px-5 py-4">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
