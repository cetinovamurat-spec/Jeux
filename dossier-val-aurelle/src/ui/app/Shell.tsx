/** Game shell: sidebar navigation (unread messages), top bar (date, period, gauges, budget), command palette, theme. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { GaugeId } from '../../game/gauges';
import { setTheme, type ThemeChoice } from '../../game/state';
import { Badge, cx, Gauge, Kbd, Select } from '../components/ui';
import { useFullCase } from './context';
import { useAvailabilityText } from './DataGate';
import { useGaugeValues, useHoursUsed, useUnreadCount } from './hooks';
import { TimeControls } from './TimeControls';
import { CommandPalette } from './CommandPalette';
import { NAV, type NavItem } from './routes';
import { useGame } from './store';

/** Number of unread messages, next to the entry of the mailbox. */
function UnreadBadge() {
  const n = useUnreadCount();
  if (n === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-panel">
      {n}
      <span className="sr-only"> {n > 1 ? 'messages non lus' : 'message non lu'}</span>
    </span>
  );
}

function NavEntry({ item }: { item: NavItem }) {
  const unavailable = useAvailabilityText(item.needs);
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={unavailable ? `${item.description} – ${unavailable}` : item.description}
      className={({ isActive }) =>
        cx('mx-2 block rounded-md px-3 py-1.5 text-sm', isActive ? 'bg-accent-soft font-semibold text-accent' : unavailable ? 'text-muted hover:bg-sunken' : 'text-ink hover:bg-sunken', item.designerOnly && 'italic')
      }
    >
      {item.label}
      {item.to === '/messagerie' && <UnreadBadge />}
      {unavailable && <span className="sr-only"> (pas encore disponible)</span>}
    </NavLink>
  );
}

/** Hours in the French format (« 12,5 »). */
function formatHours(h: number): string {
  return h.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

export function Shell() {
  const c = useFullCase();
  const settings = useGame((s) => s.game.settings);
  const difficulty = useGame((s) => s.game.difficulty);
  const act = useGame((s) => s.act);
  const gauges = useGaugeValues();
  const [palette, setPalette] = useState(false);
  const location = useLocation();
  const designer = settings.designer;
  const gp = c.params.game;

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset['theme'];
    else root.dataset['theme'] = settings.theme;
  }, [settings.theme]);

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

  const budget = gp.budgetHours[difficulty];
  const used = useHoursUsed().team;

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
            <NavEntry key={n.to} item={n} />
          ))}
        </nav>
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs">
          <button type="button" onClick={() => setPalette(true)} className="flex w-full items-center justify-between rounded-md border border-line px-2 py-1 text-muted hover:bg-sunken">
            Rechercher <Kbd>Ctrl K</Kbd>
          </button>
          <label className="flex items-center justify-between gap-2 text-muted">
            Thème
            <Select aria-label="Thème" value={settings.theme} onChange={(e) => act((s) => setTheme(s, e.target.value as ThemeChoice))} className="py-0.5 text-xs">
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
          <TimeControls />
          <div className="flex flex-wrap gap-4">
            {(Object.entries(gp.gauges) as [GaugeId, (typeof gp.gauges)[GaugeId]][]).map(([id, g]) => (
              <Gauge key={id} label={g.label} value={gauges[id] ?? g.initial} low={g.lowThreshold} />
            ))}
          </div>
          <div className="ml-auto text-right text-xs">
            <p className="text-muted">Budget</p>
            <p className={cx('font-mono text-sm', used > budget && 'text-warn')}>
              {formatHours(used)} / {budget} h
            </p>
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
