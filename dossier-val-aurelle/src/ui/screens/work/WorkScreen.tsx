/**
 * Travaux (route '/travaux', optional '?onglet=feuilles' and '?procedure=<id>'):
 * the procedures of the programme and their worksheets — launch, follow-up,
 * tool, completion, references, conclusion — and the master worksheets by
 * cycle (plan J4 §7, §12, §17). The procedure is the hub of the work.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { hoursUsed } from '../../../game/budget';
import { EXECUTION_STATUS_LABEL, executionOf, executionStatus, procedureDef, type ExecutionStatus } from '../../../game/program';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Card, cx, PageHeader, Select, tabId, tabPanelId, Tabs } from '../../components/ui';
import { formatHours, memberShort } from '../planning/labels';
import { AidButton } from './AidButton';
import { ExecutionPanel, STATUS_TONE } from './ExecutionPanel';
import { useWorkContext } from './hooks';
import { MasterSheets } from './MasterSheets';
import { useWorkView, type WorkFilter, type WorkTab } from './workStore';

const ID_PREFIX = 'travaux';

const FILTER_LABEL: Record<WorkFilter, string> = { all: 'Toutes', toLaunch: 'À lancer', running: 'Planifiées ou en cours', toDocument: 'Livrées, à documenter', documented: 'Documentées' };

function matches(filter: WorkFilter, status: ExecutionStatus | null): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'toLaunch':
      return status === null;
    case 'running':
      return status === 'waiting' || status === 'inProgress' || status === 'unfinishable';
    case 'toDocument':
      return status === 'delivered';
    case 'documented':
      return status === 'documented';
  }
}

function ProcedureList() {
  const c = useCase();
  const params = c.params;
  const program = useGame((s) => s.game.program);
  const date = useGame((s) => s.game.clock.date);
  const w = useWorkContext();
  const { filter, selected, set } = useWorkView();
  const items = useMemo(() => {
    // the programme, then the procedures launched outside it
    const ids = [...program.planned.map((p) => p.procedureId), ...program.executions.map((e) => e.procedureId)];
    return [...new Set(ids)].flatMap((id) => {
      const def = procedureDef(params, id);
      if (!def) return [];
      const e = executionOf(program, id);
      const assignee = e?.assignee ?? program.planned.find((p) => p.procedureId === id)?.assignee ?? 'senior';
      const status = e ? executionStatus(e, w.sched.get(e.id), date) : null;
      return [{ def, e, assignee, status, end: e ? (w.sched.get(e.id)?.end ?? null) : null }];
    });
  }, [program, params, w, date]);
  const shown = items.filter((x) => matches(filter, x.status));
  const counts = useMemo(() => {
    const out: Record<WorkFilter, number> = { all: 0, toLaunch: 0, running: 0, toDocument: 0, documented: 0 };
    for (const x of items) for (const f of Object.keys(out) as WorkFilter[]) if (matches(f, x.status)) out[f]++;
    return out;
  }, [items]);
  return (
    <Card
      title="Procédures"
      actions={
        <label className="flex items-center gap-1 text-xs text-muted">
          Afficher
          <Select value={filter} onChange={(e) => set({ filter: e.target.value as WorkFilter })} className="py-0.5 text-xs">
            {(Object.keys(FILTER_LABEL) as WorkFilter[]).map((f) => (
              <option key={f} value={f}>
                {FILTER_LABEL[f]} ({counts[f]})
              </option>
            ))}
          </Select>
        </label>
      }
    >
      {items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">Le programme est vide : composez-le dans l’écran Planification, onglet Programme.</p>
      ) : (
        <ul className="max-h-[calc(100vh-14rem)] overflow-auto py-1 text-sm">
          {shown.map((x) => {
            const isSel = selected === x.def.id;
            return (
              <li key={x.def.id}>
                <button type="button" aria-current={isSel ? 'true' : undefined} onClick={() => set({ selected: x.def.id })} className={cx('block w-full px-3 py-1.5 text-left hover:bg-sunken', isSel && 'bg-accent-soft')}>
                  <span className={cx('block', isSel && 'font-semibold text-accent')}>{x.def.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {x.status ? <Badge tone={STATUS_TONE[x.status]}>{EXECUTION_STATUS_LABEL[x.status]}</Badge> : <Badge>À lancer</Badge>}
                    {memberShort(params, x.assignee)}
                    {x.e && ` · ${formatHours(x.e.hours)} h`}
                    {x.end && (x.status === 'waiting' || x.status === 'inProgress') && ` · livraison le ${formatDateFr(x.end)}`}
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-3 py-4 text-center text-muted">Aucune procédure dans cette catégorie.</li>}
        </ul>
      )}
    </Card>
  );
}

function Procedures() {
  const { selected } = useWorkView();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,2fr)_minmax(0,3fr)]">
      <ProcedureList />
      {selected ? <ExecutionPanel key={selected} procedureId={selected} /> : <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Choisissez une procédure pour la lancer ou ouvrir sa feuille de travail.</p>}
    </div>
  );
}

export function WorkScreen() {
  const c = useCase();
  const params = c.params;
  const [search, setSearch] = useSearchParams();
  const tab: WorkTab = search.get('onglet') === 'feuilles' ? 'feuilles' : 'procedures';
  const program = useGame((s) => s.game.program);
  const sections = useGame((s) => s.game);
  const difficulty = useGame((s) => s.game.difficulty);
  const tabsRef = useRef<HTMLDivElement>(null);
  const used = hoursUsed(sections, params);

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
        description={`Procédures du programme et feuilles de travail ; feuilles maîtresses par cycle. ${program.executions.length} procédure${program.executions.length > 1 ? 's' : ''} lancée${program.executions.length > 1 ? 's' : ''}, ${formatHours(used.team)} h consommées sur ${params.game.budgetHours[difficulty]} h.`}
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
