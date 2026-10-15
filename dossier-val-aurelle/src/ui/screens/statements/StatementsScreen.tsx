/**
 * États financiers et pointage (route '/etats', optional
 * '?onglet=actif|passif|resultat|annexe|certifies'): the client's draft
 * statements and annex exactly as presented, and the certified prior-year
 * accounts; every figure carries a tick button. Above the tables: progress of
 * the tab and legend of the marks (always visible); next to them: the detail
 * of the selected line (accounts of the trial balance) or annex row. Nothing is
 * compared or flagged automatically: finding the differences is the player's job.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toCsv } from '../../../engine/csv';
import { formatDateFr } from '../../../engine/dates';
import { formatFecAmount } from '../../../engine/format';
import { clearTicks, tickProgress, type TickProgress } from '../../../game/ticking';
import { useCase } from '../../app/context';
import { useAvailabilityText } from '../../app/DataGate';
import { useAvailableDocuments, useDesigner } from '../../app/hooks';
import { useGame } from '../../app/store';
import { download } from '../../components/download';
import { Button, cx, PageHeader, tabId as tabElementId, tabPanelId, Tabs } from '../../components/ui';
import { useFillHeight } from '../balance/hooks';
import { DetailPanel } from './DetailPanel';
import { AnnexDiagnostics, StatementDiagnostics } from './Diagnostics';
import { formatCount, parseTab, SOURCE_DOCUMENT, type TabId } from './labels';
import { MarksDialog } from './MarksDialog';
import { buildTabs, certifiedTitle, type SectionModel, type TabModel } from './model';
import { sameSelection, useStatementsView, type Selection } from './statementsView';
import { TickingProvider } from './TickControls';
import { rowAnchor, TickTable } from './TickTable';
import { TickToolbar } from './TickToolbar';

const PANEL_ID = 'etats-detail';
/** Space kept below the tab panel (page padding and border). */
const BOTTOM_RESERVE = 18;
/** UTF-8 BOM, so that spreadsheet software reads the accents of the export. */
const CSV_BOM = '﻿';

/** Ticked / tickable cells shown in a tab label (wide screens: the toolbar always shows the current tab). */
function TabCount({ p }: { p: TickProgress }) {
  return (
    <span className="ml-1.5 hidden font-mono text-[11px] font-normal text-muted xl:inline">
      <span aria-hidden="true">
        {formatCount(p.ticked)}/{formatCount(p.total)}
      </span>
      <span className="sr-only">
        {' '}
        – {formatCount(p.ticked)} sur {formatCount(p.total)} cases pointées
      </span>
    </span>
  );
}

function Intro({ children }: { children: ReactNode }) {
  return <p className="max-w-4xl px-3 pb-2 pt-3 text-xs text-muted">{children}</p>;
}

export function StatementsScreen() {
  const c = useCase();
  const designer = useDesigner();
  const [params, setParams] = useSearchParams();
  const { current: cy, prior: py } = c.params.scenario.years;
  // before the draft accounts of 2025, only the certified 2024 accounts can be ticked
  const draft = c.view.statements2025;
  const allTabs = useMemo(() => buildTabs(c), [c]);
  const tabs = useMemo(() => (draft ? allTabs : allTabs.filter((t) => t.id === 'certifies')), [allTabs, draft]);
  const tabId = parseTab(params.get('onglet'));
  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0]!;
  const draftText = useAvailabilityText('statements2025');

  const ticks = useGame((s) => s.game.ticks);
  const marks = useGame((s) => s.game.tickMarks);
  const act = useGame((s) => s.act);
  const { clickMark, setClickMark, selection: selections, select } = useStatementsView();
  const [marksOpen, setMarksOpen] = useState(false);

  const progress = useMemo(() => new Map(tabs.map((t) => [t.id, tickProgress(ticks, t.cells)])), [tabs, ticks]);
  const tabProgress = progress.get(tab.id) ?? { total: 0, ticked: 0, byMark: {} };

  // A quick mark that has been deleted falls back to the menu.
  useEffect(() => {
    if (clickMark && !marks.some((m) => m.id === clickMark)) setClickMark(null);
  }, [clickMark, marks, setClickMark]);

  const available = useAvailableDocuments();
  const source = available.find((d) => d.id === SOURCE_DOCUMENT[tab.id]);

  // Arrow keys on the tabs change the tab: the focus follows the selected tab.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tabsRef.current;
    if (list?.contains(document.activeElement)) list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [tab.id]);

  const goTab = (id: TabId) => {
    const p = new URLSearchParams(params);
    if (id === 'actif') p.delete('onglet');
    else p.set('onglet', id);
    setParams(p, { replace: true });
  };

  // ---- detail panel -------------------------------------------------------
  const selection: Selection | null = tab.id === 'certifies' ? null : (selections[tab.id] ?? null);
  const anchor = selection ? (selection.kind === 'line' ? rowAnchor(tab.statement ?? '', selection.lineId) : rowAnchor(selection.tableId, selection.rowId)) : null;
  const paneRef = useRef<HTMLElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const rowButton = (a: string | null) => (a ? (paneRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(a)}"]`) ?? null) : null);

  // Bring the selected row into view (selection made from the panel).
  useEffect(() => {
    if (anchor) rowButton(anchor)?.scrollIntoView({ block: 'nearest' });
  }, [anchor]);

  const closeDetail = () => {
    const inPanel = asideRef.current?.contains(document.activeElement) ?? false;
    const button = rowButton(anchor);
    select(tab.id, null);
    if (inPanel) button?.focus();
  };

  const selectRow = (section: SectionModel) => (rowId: string) => {
    const s: Selection = tab.id === 'annexe' ? { kind: 'annex', tableId: section.id, rowId } : { kind: 'line', lineId: rowId };
    select(tab.id, sameSelection(s, selection) ? null : s);
  };
  const selectedRow = (section: SectionModel): string | null => {
    if (!selection) return null;
    if (selection.kind === 'line') return selection.lineId;
    return selection.tableId === section.id ? selection.rowId : null;
  };

  // ---- export ---------------------------------------------------------------
  const exportCsv = () => {
    const byId = new Map(marks.map((m) => [m.id, m]));
    const rows: string[][] = [['Onglet', 'Tableau', 'Rubrique', 'Colonne', 'Montant', 'Marque', 'Signification de la marque']];
    for (const t of tabs)
      for (const s of t.sections)
        for (const r of s.rows)
          r.cells.forEach((cell, i) => {
            const markId = ticks[cell.key];
            const m = markId === undefined ? undefined : byId.get(markId);
            rows.push([t.label, s.title, r.label, s.columns[i]?.name ?? '', cell.value === undefined ? '' : formatFecAmount(cell.value), m?.symbol ?? '', m?.label ?? '']);
          });
    download(`pointage-etats-${cy}.csv`, CSV_BOM + toCsv(rows), 'text/csv;charset=utf-8');
  };

  const fillRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(fillRef, BOTTOM_RESERVE);

  return (
    <TickingProvider clickMark={clickMark} onManageMarks={() => setMarksOpen(true)}>
      <PageHeader
        title="États financiers et pointage"
        description={
          <>
            {draft ? `Projet de comptes annuels ${cy} remis par la société et comptes certifiés ${py}. ` : `Comptes certifiés ${py}. `}Pointez chaque montant des états et de l’annexe sur la balance, et la colonne {py} sur les comptes certifiés, à l’aide de vos marques de pointage.
            Cliquez sur une rubrique pour afficher les comptes qui la composent.
          </>
        }
        actions={
          <>
            {source && (
              <Link to={`/ged/${encodeURIComponent(source.id)}`} title={source.title} className="inline-flex items-center rounded-md border border-line bg-panel px-2.5 py-1 text-sm hover:bg-sunken">
                Ouvrir la pièce dans la GED
              </Link>
            )}
            <Button onClick={exportCsv} title="Télécharger les montants des cinq onglets et leurs marques (CSV, séparateur point-virgule)">
              Exporter le pointage (CSV)
            </Button>
          </>
        }
      />
      {draftText && (
        <p role="status" className="mb-3 rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">
          Le projet de comptes 2025 n’est pas encore remis : seuls les comptes certifiés 2024 peuvent être pointés. {draftText}.
        </p>
      )}

      <div ref={tabsRef}>
        <Tabs idPrefix="etats" value={tab.id} onChange={goTab} label="États financiers, annexe et comptes certifiés" items={tabs.map((t) => ({ id: t.id, label: <TabLabel tab={t} p={progress.get(t.id)} /> }))} />
      </div>

      <div id={tabPanelId('etats')} role="tabpanel" aria-labelledby={tabElementId('etats', tab.id)} className="rounded-b-lg border-x border-b border-line bg-panel">
        <TickToolbar
          tabLabel={tab.label}
          progress={tabProgress}
          marks={marks}
          clickMark={clickMark}
          onClickMark={setClickMark}
          onClear={() => act((s) => clearTicks(s, tab.cells))}
          onManage={() => setMarksOpen(true)}
        />
        <div
          ref={fillRef}
          style={{ height: height ? `${height}px` : 'calc(100vh - 17rem)' }}
          className={cx('grid grid-rows-[minmax(0,1fr)]', selection ? 'grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]' : 'grid-cols-[minmax(0,1fr)]')}
        >
          <section
            key={tab.id}
            ref={paneRef}
            aria-label={`${tab.label} – montants à pointer`}
            className="min-h-0 min-w-0 overflow-auto pb-4"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && selection && !e.defaultPrevented) {
                e.preventDefault();
                closeDetail();
              }
            }}
          >
            <TabContent tab={tab} cy={cy} py={py} designer={designer} selectedRow={selectedRow} onSelectRow={selectRow} />
          </section>
          {selection && (
            <aside ref={asideRef} id={PANEL_ID} aria-labelledby="etats-detail-title" className="flex min-h-0 min-w-0 flex-col border-l border-line">
              <DetailPanel selection={selection} designer={designer} onSelect={(s) => select(tab.id, s)} onGoTab={goTab} onClose={closeDetail} />
            </aside>
          )}
        </div>
      </div>

      <MarksDialog open={marksOpen} onClose={() => setMarksOpen(false)} />
    </TickingProvider>
  );
}

function TabLabel({ tab, p }: { tab: TabModel; p: TickProgress | undefined }) {
  return (
    <>
      {tab.label}
      {p && <TabCount p={p} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// content of a tab
// ---------------------------------------------------------------------------

interface TabContentProps {
  tab: TabModel;
  cy: number;
  py: number;
  designer: boolean;
  selectedRow: (section: SectionModel) => string | null;
  onSelectRow: (section: SectionModel) => (rowId: string) => void;
}

function TabContent({ tab, cy, py, designer, selectedRow, onSelectRow }: TabContentProps) {
  const end = (y: number) => formatDateFr(`${y}-12-31`);

  if (tab.statement) {
    const section = tab.sections[0]!;
    const assets = tab.statement === 'assets';
    return (
      <>
        <Intro>
          {tab.statement === 'income' ? `Compte de résultat de l’exercice ${cy}` : `${tab.label} au ${end(cy)}`}, tel que présenté dans le projet de comptes, en euros.{' '}
          {assets ? `Exercice ${cy} : valeurs brutes, amortissements et dépréciations, valeurs nettes ; exercice ${py} : valeurs nettes du comparatif présenté.` : `Colonne ${py} : comparatif présenté par la société.`} Cliquez sur une rubrique pour
          afficher sa composition.
        </Intro>
        <div className={assets ? 'max-w-5xl' : 'max-w-4xl'}>
          <TickTable section={section} selectedRow={selectedRow(section)} onSelectRow={onSelectRow(section)} panelId={PANEL_ID} figureWidth={assets ? '8.75rem' : '9.5rem'} />
        </div>
        {designer && <StatementDiagnostics statement={tab.statement} />}
      </>
    );
  }

  if (tab.id === 'annexe') {
    return (
      <>
        <Intro>
          Tableaux chiffrés du projet d’annexe des comptes {cy}, tels que présentés par la société, en euros. Cliquez sur une ligne pour afficher les soldes et les mouvements des comptes de la balance correspondants.
        </Intro>
        {tab.sections.length === 0 && <p className="px-3 py-4 text-sm text-muted">Le projet d’annexe ne comporte aucun tableau chiffré.</p>}
        {tab.sections.map((s) => (
          <section key={s.id} aria-labelledby={`etats-annexe-${s.id}`} className="pb-3">
            <h2 id={`etats-annexe-${s.id}`} className="px-3 pb-1 pt-3 text-sm font-semibold">
              {s.title}
            </h2>
            <div className="max-w-6xl">
              <TickTable section={s} labelHeader="Libellé" selectedRow={selectedRow(s)} onSelectRow={onSelectRow(s)} panelId={PANEL_ID} figureWidth="8.75rem" rowHint="Afficher les comptes de la balance correspondant à cette ligne" />
            </div>
            {s.notes && s.notes.length > 0 && (
              <ul aria-label={`Notes du tableau ${s.title}`} className="max-w-4xl px-3 pt-1.5 text-xs text-muted">
                {s.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {designer && <AnnexDiagnostics />}
      </>
    );
  }

  return (
    <>
      <header className="max-w-4xl px-3 pb-1 pt-3">
        <h2 className="text-sm font-semibold">{certifiedTitle(py)}</h2>
        <p className="mt-0.5 text-xs text-muted">
          Bilan et compte de résultat de l’exercice clos le {end(py)}, en euros, tels qu’ils ont été certifiés. Référence pour le pointage de la colonne {py} des états {cy} présentés.
        </p>
      </header>
      {tab.sections.map((s) => (
        <section key={s.id} aria-labelledby={`etats-certifies-${s.id}`} className="pb-3">
          <h3 id={`etats-certifies-${s.id}`} className="px-3 pb-1 pt-3 text-sm font-semibold">
            {s.title}
          </h3>
          <div className="max-w-3xl">
            <TickTable section={s} figureWidth="10rem" />
          </div>
        </section>
      ))}
    </>
  );
}
