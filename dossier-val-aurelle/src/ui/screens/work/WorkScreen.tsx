/**
 * Travaux (route '/travaux', optional '?onglet=feuilles' and '?procedure=<id>'):
 * the procedures of the programme and their worksheets — launch, follow-up,
 * tool, completion, references, conclusion — and the master worksheets by
 * cycle (plan J4 §7, §12, §17). The procedure is the hub of the work.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import type { MemberId } from '../../../game/calendar';
import { canLaunch, EXECUTION_STATUS_LABEL, executionOf, executionStatus, procedureDef, type Execution, type ExecutionStatus } from '../../../game/program';
import type { ProcedureDef } from '../../../scenario/schemas/procedures';
import { useCase } from '../../app/context';
import { useHoursUsed } from '../../app/hooks';
import { useGame } from '../../app/store';
import { Badge, Card, cx, PageHeader, Select, tabId, tabPanelId, Tabs } from '../../components/ui';
import { formatHours, memberShort } from '../planning/labels';
import { AidButton } from './AidButton';
import { ExecutionPanel, STATUS_TONE } from './ExecutionPanel';
import { useWorkContext } from './hooks';
import { MasterSheets } from './MasterSheets';
import { useWorkView, type WorkFilter, type WorkTab } from './workStore';

const ID_PREFIX = 'travaux';

const FILTER_LABEL: Record<WorkFilter, string> = {
  all: 'Toutes',
  launchable: 'Lançables aujourd’hui',
  toLaunch: 'Non lancées',
  running: 'Planifiées ou en cours',
  toDocument: 'Livrées, à documenter',
  documented: 'Documentées',
};

interface Item {
  def: ProcedureDef;
  e: Execution | undefined;
  assignee: MemberId;
  status: ExecutionStatus | null;
  end: string | null;
  launchable: boolean;
}

function matches(filter: WorkFilter, x: Item): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'launchable':
      return x.launchable;
    case 'toLaunch':
      return x.status === null;
    case 'running':
      return x.status === 'waiting' || x.status === 'inProgress' || x.status === 'unfinishable';
    case 'toDocument':
      return x.status === 'delivered';
    case 'documented':
      return x.status === 'documented';
  }
}

function ProcedureList() {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const w = useWorkContext();
  const { filter, selected, set } = useWorkView();
  const date = game.clock.date;
  const items = useMemo(() => {
    // the programme and the procedures launched outside it, by cycle then in the order of the library
    const ids = new Set([...game.program.planned.map((p) => p.procedureId), ...game.program.executions.map((e) => e.procedureId)]);
    const order = new Map(params.procedures.procedures.map((d, i) => [d.id, i]));
    const cycleOrder = new Map(params.cycles.cycles.map((cy, i) => [cy.id, i]));
    return [...ids]
      .flatMap((id): Item[] => {
        const def = procedureDef(params, id);
        if (!def) return [];
        const e = executionOf(game.program, id);
        const assignee = e?.assignee ?? game.program.planned.find((p) => p.procedureId === id)?.assignee ?? 'senior';
        const status = e ? executionStatus(e, w.sched.get(e.id), date) : null;
        const launchable = !e && canLaunch(game, params, id, assignee, w.launch).ok;
        return [{ def, e, assignee, status, end: e ? (w.sched.get(e.id)?.end ?? null) : null, launchable }];
      })
      .sort((a, b) => (cycleOrder.get(a.def.cycle) ?? 99) - (cycleOrder.get(b.def.cycle) ?? 99) || (order.get(a.def.id) ?? 0) - (order.get(b.def.id) ?? 0));
  }, [game, params, w, date]);
  const counts = useMemo(() => {
    const out = Object.fromEntries((Object.keys(FILTER_LABEL) as WorkFilter[]).map((f) => [f, 0])) as Record<WorkFilter, number>;
    for (const x of items) for (const f of Object.keys(out) as WorkFilter[]) if (matches(f, x)) out[f]++;
    return out;
  }, [items]);
  const shown = items.filter((x) => matches(filter, x));
  const groups = params.cycles.cycles.map((cy) => ({ cycle: cy, items: shown.filter((x) => x.def.cycle === cy.id) })).filter((g) => g.items.length > 0);
  return (
    <Card
      title="Procédures"
      actions={
        <span className="flex items-center gap-1 text-xs text-muted">
          <label htmlFor="work-filter">Afficher</label>
          <Select id="work-filter" value={filter} onChange={(e) => set({ filter: e.target.value as WorkFilter })} className="py-0.5 text-xs">
            {(Object.keys(FILTER_LABEL) as WorkFilter[]).map((f) => (
              <option key={f} value={f}>
                {FILTER_LABEL[f]} ({counts[f]})
              </option>
            ))}
          </Select>
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">
          Le programme est vide : composez-le dans l’écran{' '}
          <Link to="/planification?onglet=programme" className="text-accent hover:underline">
            Planification, onglet Programme
          </Link>
          .
        </p>
      ) : (
        <div className="max-h-[calc(100vh-14rem)] overflow-auto pb-1 text-sm">
          {groups.map((g) => (
            <section key={g.cycle.id} aria-labelledby={`work-cycle-${g.cycle.id}`}>
              <h3 id={`work-cycle-${g.cycle.id}`} className="sticky top-0 z-10 border-b border-line bg-sunken px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {g.cycle.label}
              </h3>
              <ul>
                {g.items.map((x) => {
                  const isSel = selected === x.def.id;
                  return (
                    <li key={x.def.id}>
                      <button type="button" aria-current={isSel ? 'true' : undefined} onClick={() => set({ selected: x.def.id })} className={cx('block w-full px-3 py-1.5 text-left hover:bg-sunken', isSel && 'bg-accent-soft')}>
                        <span className={cx('block', isSel && 'font-semibold text-accent')}>{x.def.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {x.status ? <Badge tone={STATUS_TONE[x.status]}>{EXECUTION_STATUS_LABEL[x.status]}</Badge> : x.launchable ? <Badge tone="accent">Lançable</Badge> : <Badge>Non lancée</Badge>}
                          {memberShort(params, x.assignee)}
                          {x.e && ` · ${formatHours(x.e.hours)} h`}
                          {x.end && (x.status === 'waiting' || x.status === 'inProgress') && ` · livraison le ${formatDateFr(x.end)}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {shown.length === 0 && <p className="px-3 py-4 text-center text-muted">Aucune procédure dans cette catégorie.</p>}
        </div>
      )}
    </Card>
  );
}

function Procedures() {
  const { selected } = useWorkView();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,2fr)_minmax(0,3fr)]">
      <ProcedureList />
      {selected ? (
        <ExecutionPanel key={selected} procedureId={selected} />
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Choisissez une procédure pour la lancer ou ouvrir sa feuille de travail.</p>
      )}
    </div>
  );
}

export function WorkScreen() {
  const c = useCase();
  const params = c.params;
  const [search, setSearch] = useSearchParams();
  const tab: WorkTab = search.get('onglet') === 'feuilles' ? 'feuilles' : 'procedures';
  const launched = useGame((s) => s.game.program.executions.length);
  const used = useHoursUsed().team;
  const difficulty = useGame((s) => s.game.difficulty);
  const tabsRef = useRef<HTMLDivElement>(null);

  // '?procedure=<id>' opens a worksheet (links from the other screens)
  const linked = search.get('procedure');
  useEffect(() => {
    if (linked && procedureDef(params, linked)) useWorkView.getState().set({ selected: linked, filter: 'all' });
  }, [linked, params]);

  useEffect(() => {
    const list = tabsRef.current;
    if (list?.contains(document.activeElement)) list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [tab]);

  const go = (t: WorkTab) => {
    const p = new URLSearchParams(search);
    if (t === 'procedures') p.delete('onglet');
    else p.set('onglet', t);
    setSearch(p, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Travaux"
        description={`Lancez les procédures du programme, documentez leurs feuilles de travail, concluez les feuilles maîtresses par cycle. ${launched} procédure${launched > 1 ? 's' : ''} lancée${launched > 1 ? 's' : ''}, ${formatHours(used)} h sur ${params.game.budgetHours[difficulty]} h.`}
        actions={<AidButton />}
      />
      <div ref={tabsRef}>
        <Tabs
          value={tab}
          onChange={go}
          label="Travaux"
          idPrefix={ID_PREFIX}
          items={[
            { id: 'procedures', label: 'Procédures et feuilles de travail' },
            { id: 'feuilles', label: 'Feuilles maîtresses' },
          ]}
        />
      </div>
      <section id={tabPanelId(ID_PREFIX)} role="tabpanel" aria-labelledby={tabId(ID_PREFIX, tab)} className="pt-4">
        {tab === 'procedures' ? <Procedures /> : <MasterSheets />}
      </section>
    </div>
  );
}
