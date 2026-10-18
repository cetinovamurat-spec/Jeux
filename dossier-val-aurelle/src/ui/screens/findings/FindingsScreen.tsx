/**
 * Constats (route '/constats', plan J4 §13): the list of the findings and
 * questions (filters by status and cycle) with the form of the selected one,
 * the table of misstatements and, in designer mode only, the matching to the
 * correction key. `?constat=<id>` opens a finding, `?onglet=tableau` the table.
 * Findings are also created in context from the other screens
 * (NewFindingButton).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { draftFromSeed, draftOf, finalEnd, findingAmount, pendingPoints, FINDING_STATUSES, type FindingStatus } from '../../../game/findings';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Badge, Button, Card, cx, EmptyState, PageHeader, Select, tabPanelId, Tabs } from '../../components/ui';
import { DesignerMatchingPanel } from './DesignerMatching';
import { FindingForm } from './FindingForm';
import { useFindingsView, type FindingsTab } from './findingsStore';
import { plural, STATUS_LABELS, STATUS_TONES } from './labels';
import { MisstatementsTab } from './MisstatementsTab';

const TAB_PARAM: Readonly<Record<FindingsTab, string | null>> = { list: null, table: 'tableau', designer: 'concepteur' };

export function FindingsScreen() {
  const c = useCase();
  const params = c.params;
  const designer = useDesigner();
  const [search, setSearch] = useSearchParams();
  const view = useFindingsView();
  const findings = useGame((s) => s.game.findings.items);
  const date = useGame((s) => s.game.clock.date);

  // links from the other screens: '?constat=<id>', '?onglet=tableau|concepteur'
  const urlId = search.get('constat');
  const urlTab = search.get('onglet');
  useEffect(() => {
    if (urlId && findings.some((f) => f.id === urlId)) view.update({ selected: urlId, tab: 'list' });
    const t = (Object.entries(TAB_PARAM) as [FindingsTab, string | null][]).find(([, v]) => v === urlTab)?.[0];
    if (t && (t !== 'designer' || designer)) view.update({ tab: t });
  }, [urlId, urlTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const tab: FindingsTab = view.tab === 'designer' && !designer ? 'list' : view.tab;
  const selectTab = (t: FindingsTab) => {
    view.update({ tab: t });
    const p = new URLSearchParams(search);
    p.delete('constat');
    if (TAB_PARAM[t]) p.set('onglet', TAB_PARAM[t]!);
    else p.delete('onglet');
    setSearch(p, { replace: true });
  };
  const open = (id: string | 'new') => {
    view.update({ selected: id, tab: 'list' });
    const p = new URLSearchParams(search);
    p.delete('onglet');
    if (id === 'new') p.delete('constat');
    else p.set('constat', id);
    setSearch(p, { replace: true });
  };

  const shown = useMemo(
    () =>
      findings
        .filter((f) => (view.status === 'all' ? true : view.status === 'open' ? f.status === 'question' || f.status === 'finding' : f.status === view.status))
        .filter((f) => view.cycle === 'all' || f.cycle === view.cycle)
        .slice()
        .reverse(),
    [findings, view.status, view.cycle],
  );
  const questions = findings.filter((f) => f.status === 'question').length;
  const pending = pendingPoints(findings, params, date);
  const selected = view.selected && view.selected !== 'new' ? findings.find((f) => f.id === view.selected) : undefined;
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view.selected) formRef.current?.scrollIntoView({ block: 'nearest' });
  }, [view.selected]);
  const cycleName = (id: string) => params.cycles.cycles.find((x) => x.id === id)?.label ?? id;

  const tabs = [
    { id: 'list' as const, label: <>Constats et questions <span className="text-xs font-normal text-muted">({findings.length})</span></> },
    { id: 'table' as const, label: 'Tableau des anomalies' },
    ...(designer ? [{ id: 'designer' as const, label: <span className="text-warn">Appariement (concepteur)</span> }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Constats"
        description="Constats structurés et questions, créés ici ou en contexte depuis les pièces, les écritures, la balance, les états, les échantillons, les recalculs et les confirmations ; tableau des anomalies dérivé des écritures proposées."
        actions={
          <Button variant="primary" onClick={() => open('new')}>
            Nouveau constat
          </Button>
        }
      />
      <Tabs value={tab} onChange={selectTab} items={tabs} label="Constats" idPrefix="constats" />
      <div id={tabPanelId('constats')} role="tabpanel" aria-labelledby={`constats-tab-${tab}`} className="pt-3">
        {tab === 'table' ? (
          <MisstatementsTab onOpen={open} />
        ) : tab === 'designer' ? (
          <DesignerMatchingPanel />
        ) : (
          <div className="space-y-3">
            {pending.length > 0 ? (
              <p role="status" className="rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
                Le final est terminé : {plural(pending.length, 'question encore ouverte devient un point en suspens', 'questions encore ouvertes deviennent des points en suspens')}. Instruisez-les (constat, écarté ou clos) avant la synthèse.
              </p>
            ) : (
              questions > 0 && (
                <p className="text-xs text-muted">
                  {plural(questions, 'question ouverte', 'questions ouvertes')} : à instruire avant la fin du final ({formatDateFr(finalEnd(params))}) ; restées ouvertes, elles deviendront des points en suspens.
                </p>
              )
            )}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <Card
                title={`Liste (${shown.length})`}
                actions={
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label htmlFor="constats-status" className="sr-only">
                      Statut
                    </label>
                    <Select id="constats-status" value={view.status} onChange={(e) => view.update({ status: e.target.value as FindingStatus | 'all' | 'open' })} className="py-0.5 text-xs">
                      <option value="all">Tous les statuts</option>
                      <option value="open">Ouverts (questions et constats)</option>
                      {FINDING_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                    <label htmlFor="constats-cycle" className="sr-only">
                      Cycle
                    </label>
                    <Select id="constats-cycle" value={view.cycle} onChange={(e) => view.update({ cycle: e.target.value })} className="py-0.5 text-xs">
                      <option value="all">Tous les cycles</option>
                      {params.cycles.cycles.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                }
              >
                {shown.length === 0 ? (
                  <EmptyState>{findings.length === 0 ? 'Aucun constat ni question. Créez-en un ici ou depuis une pièce, une écriture, un échantillon, un recalcul ou une confirmation (boutons « Constat… » et « ? »).' : 'Aucun constat ne correspond aux filtres.'}</EmptyState>
                ) : (
                  <ul aria-label="Constats et questions" className="max-h-[70vh] divide-y divide-line overflow-y-auto">
                    {shown.map((f) => {
                      const amount = findingAmount(f);
                      const active = view.selected === f.id;
                      return (
                        <li key={f.id}>
                          <button type="button" aria-current={active || undefined} onClick={() => open(f.id)} className={cx('block w-full px-3 py-2 text-left hover:bg-sunken', active && 'bg-accent-soft')}>
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0 text-sm">
                                <span className="font-mono text-xs text-muted">{f.id}</span> <span className="font-medium">{f.title || 'Sans intitulé'}</span>
                              </span>
                              <Badge tone={STATUS_TONES[f.status]}>{STATUS_LABELS[f.status]}</Badge>
                            </span>
                            <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                              <span>{cycleName(f.cycle)}</span>
                              <span>{amount ? <><Amount cents={amount} /> €</> : 'non chiffré'}</span>
                              <span>{plural(f.evidence.length, 'pièce', 'pièces')}</span>
                              <span>{formatDateFr(f.createdOn)}</span>
                              {f.escalatedToPartnerOn && <span className="text-accent">remonté à l’associée</span>}
                              {pending.includes(f) && <span className="text-warn">point en suspens</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
              <div ref={formRef} className="min-w-0">
                {view.selected === 'new' ? (
                  <Card title="Nouveau constat">
                    <div className="px-3 py-3">
                      <FindingForm key="new" initial={draftFromSeed({}, params, 'finding')} onDone={(id) => (id ? open(id) : view.update({ selected: null }))} />
                    </div>
                  </Card>
                ) : selected ? (
                  <Card title={<>Constat <span className="font-mono">{selected.id}</span></>}>
                    <div className="px-3 py-3">
                      <FindingForm key={selected.id} findingId={selected.id} initial={draftOf(selected)} onDone={(id) => view.update({ selected: id })} />
                    </div>
                  </Card>
                ) : (
                  <div className="rounded-lg border border-line bg-panel px-6 py-6 text-sm">
                    <h2 className="text-base font-semibold">Aucun constat sélectionné</h2>
                    <p className="mt-1 max-w-2xl text-muted">
                      Un constat désigne un cycle, ses objets (programme, tiers, compte, pièce, information de l’annexe…), sa nature, son traitement et, le cas échéant, l’écriture de correction proposée, dont les impacts sont calculés. Liez-y les pièces qui le fondent. Une question peut être notée en un clic depuis chaque écran (bouton « ? ») et instruite ensuite.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
