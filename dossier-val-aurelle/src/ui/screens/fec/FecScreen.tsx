/**
 * FEC explorer (route '/fec'): journal-entry testing on the FEC presented by
 * the client — usual tests, combinable filters, saved queries, journal summary,
 * exports, entry detail with the rare account pairs. Search params:
 * ?exercice=2024|2025, ?requete=<savedQueryId> (loads a saved query),
 * ?ecriture=<EcritureNum> (opens the detail of an entry; with ?exercice).
 *
 * Generic tools only: nothing points at a particular entry outside the
 * designer mode (origin column and comparison with the clean world).
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { fecToText } from '../../../engine/fec';
import { formatDateFr } from '../../../engine/dates';
import { formatEuro } from '../../../engine/format';
import { describeQuery, fecToCsv, isEmptyQuery, journalSummary, runQuery, sameQuery, standardTests, type FecQuery } from '../../../game/fec-query';
import { fecEntryConsultedKey, markConsulted } from '../../../game/consulted';
import type { SavedQuery } from '../../../game/state';
import type { Year } from '../../app/case';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { useGame } from '../../app/store';
import { download } from '../../components/download';
import { Badge, Button, cx, PageHeader } from '../../components/ui';
import { CriteriaPanel } from './CriteriaPanel';
import { buildDiagnostics, isTouched } from './diagnostics';
import { EntryDetail } from './EntryDetail';
import { entryIdsByNumber, entryNumber } from './entryKey';
import { rareThreshold, useFecView, type PanelTab } from './fecStore';
import { FilterPanel } from './FilterPanel';
import { JournalSummary } from './JournalSummary';
import { formatCount, plural, technicalUsers, userRoles } from './labels';
import { useFillHeight } from './layout';
import { ResultsTable } from './ResultsTable';
import { SavedQueries } from './SavedQueries';

const FALLBACK_OFFSET = '16rem';

type Notice = { tone: 'ok' | 'warn'; text: string } | null;

export function FecScreen() {
  const c = useCase();
  const designer = useDesigner();
  const view = useFecView();
  const savedCount = useGame((s) => s.game.savedQueries.length);
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState<Notice>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // --- year and index -------------------------------------------------------
  const { current, prior } = c.params.scenario.years;
  // before the extraction of 2025, only the FEC of the certified 2024 accounts
  const years = useMemo(() => (c.view.ledger2025 === 'none' ? [prior] : [current, prior]) as Year[], [c, current, prior]);
  const yearParam = params.get('exercice');
  const entryParam = params.get('ecriture');
  const year = useMemo<Year>(() => {
    const n = Number(yearParam) as Year;
    if (years.includes(n)) return n;
    if (c.view.ledger2025 === 'none') return prior as Year;
    // A link to an entry of the prior year without ?exercice opens that year.
    if (entryParam && !entryIdsByNumber(c.fecIndex(current as Year)).has(entryParam) && entryIdsByNumber(c.fecIndex(prior as Year)).has(entryParam)) return prior as Year;
    return current as Year;
  }, [c, yearParam, entryParam, years, current, prior]);
  const index = useMemo(() => c.fecIndex(year), [c, year]);

  // --- labels and usual tests -----------------------------------------------
  const gp = c.params.game;
  const roles = useMemo(() => userRoles(c.params), [c]);
  const journalLabels = useMemo(() => new Map(c.presented.journals.map((j) => [j.code, j.label])), [c]);
  const roundMultiples = useMemo(() => [...gp.roundAmountMultiplesEuros].sort((a, b) => a - b).map((x) => Math.round(x * 100)), [gp]);
  const tests = useMemo(() => {
    const technical = technicalUsers(c.params);
    return standardTests({
      closingDate: index.closingDate,
      roundMultiple: roundMultiples[0] ?? 0,
      rarePairsMax: gp.rarePairMaxOccurrences,
      miscJournals: c.presented.journals.filter((j) => j.kind === 'misc').map((j) => j.code),
      manualUsers: index.users.filter((u) => !technical.has(u)),
    });
  }, [c, index, roundMultiples, gp]);

  // --- query (deferred: typing stays fluid while the FEC is filtered) -------
  const query = useDeferredValue(view.query);
  const pending = query !== view.query;
  const result = useMemo(() => runQuery(index, query), [index, query]);
  const chips = useMemo(() => describeQuery(query), [query]);
  const yearSummary = useMemo(() => journalSummary(index), [index]);
  const selectionSummary = useMemo(() => journalSummary(index, result.lines), [index, result]);
  const diagnostics = useMemo(() => (designer ? buildDiagnostics(c, year) : null), [designer, c, year]);
  const touched = useMemo(() => {
    if (!diagnostics) return 0;
    const ids = new Set<string>();
    for (const i of result.lines) {
      const id = index.lines[i]!.entryId;
      if (isTouched(diagnostics.entries.get(id))) ids.add(id);
    }
    return ids.size;
  }, [diagnostics, result, index]);

  // --- search params --------------------------------------------------------
  const editParams = useCallback(
    (f: (p: URLSearchParams) => void) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          f(next);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  // The detail takes the focus; closing it gives the focus back to the row that opened it.
  const opener = useRef<HTMLElement | null>(null);
  const selectEntry = useCallback(
    (id: string | null) => {
      const num = id === null ? undefined : entryNumber(index, id);
      if (num !== undefined) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      editParams((p) => (num !== undefined ? p.set('ecriture', num) : p.delete('ecriture')));
    },
    [editParams, index],
  );
  const closeEntry = useCallback(() => {
    selectEntry(null);
    const el = opener.current;
    requestAnimationFrame(() => {
      if (el?.isConnected) el.focus();
    });
  }, [selectEntry]);
  const setYear = (y: Year) =>
    editParams((p) => {
      p.set('exercice', String(y));
      p.delete('ecriture');
    });

  // ?requete=<id>: load the saved query once, then drop the parameter (the query can then be edited freely).
  const requested = params.get('requete');
  useEffect(() => {
    if (!requested) return;
    const saved = useGame.getState().game.savedQueries.find((q) => q.id === requested);
    if (saved) {
      useFecView.getState().load(saved.query);
      setNotice({ tone: 'ok', text: `Requête « ${saved.name} » chargée.` });
    } else setNotice({ tone: 'warn', text: 'La requête demandée n’existe pas ou a été supprimée.' });
    editParams((p) => p.delete('requete'));
  }, [requested, editParams]);

  const loadSaved = useCallback((s: SavedQuery) => {
    useFecView.getState().load(s.query);
    setNotice(null);
  }, []);
  const applyTest = (q: FecQuery) => {
    view.load(q);
    setNotice(null);
  };
  const requestSave = () => {
    view.setPanel({ panelTab: 'saved', panelOpen: true });
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  // --- exports --------------------------------------------------------------
  const selectedLines = () => result.lines.map((i) => index.lines[i]!);
  const exportCsv = () => download(`FEC${year}1231-selection.csv`, fecToCsv(selectedLines()), 'text/csv;charset=utf-8');
  const exportFec = () => download(`FEC${year}1231-selection.txt`, fecToText(selectedLines()));
  const exportFull = () => download(`FEC${year}1231.txt`, fecToText(c.fec(year)));

  // --- layout ---------------------------------------------------------------
  const fillRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(fillRef);
  const entryId = entryParam === null ? null : (entryIdsByNumber(index).get(entryParam) ?? null);
  const entryFound = entryId !== null;
  // first opening of the entry (questions of the interviews on what was looked at), by its FEC number
  const openedNumber = entryId === null ? undefined : entryNumber(index, entryId);
  useEffect(() => {
    if (openedNumber !== undefined) useGame.getState().act((s) => markConsulted(s, fecEntryConsultedKey(year, openedNumber)));
  }, [year, openedNumber]);
  const threshold = view.rareOn ? rareThreshold(view.rareText) : gp.rarePairMaxOccurrences;
  const blank = isEmptyQuery(view.query) && !view.accountsText.trim() && !view.minText.trim() && !view.maxText.trim();
  const activeFilters = describeQuery(view.query).length;
  const panelTabs: { id: PanelTab; label: ReactNode }[] = [
    { id: 'filters', label: <>Filtres{activeFilters > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-panel">{activeFilters}</span>}</> },
    { id: 'saved', label: `Requêtes enregistrées (${savedCount})` },
    { id: 'journals', label: 'Synthèse par journal' },
  ];

  return (
    <>
      <PageHeader
        title="FEC – tests d’écritures"
        description={`${year === current && c.view.ledger2025 === 'interim' ? `Extraction du FEC ${year} au ${formatDateFr(c.view.cutoff)} (écritures validées à cette date)` : `FEC ${year} remis par le client`} : ${plural(index.lines.length, 'ligne', 'lignes')}, ${plural(index.entryLines.size, 'écriture', 'écritures')}.`}
        actions={
          <>
            <div role="group" aria-label="Exercice" className="inline-flex rounded-md border border-line bg-panel p-0.5">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={y === year}
                  onClick={() => setYear(y)}
                  className={cx('rounded px-2.5 py-0.5 text-sm', y === year ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:text-ink')}
                >
                  Exercice {y}
                </button>
              ))}
            </div>
            <Button onClick={exportFull} title={`Télécharger le FEC complet de l’exercice ${year} (texte, séparateur barre verticale)`}>
              Télécharger le FEC {year}
            </Button>
          </>
        }
      />

      <div role="group" aria-labelledby="fec-tests-label" className="mb-2 flex flex-wrap items-center gap-1.5">
        <span id="fec-tests-label" className="mr-1 text-xs font-medium text-muted">
          Tests courants :
        </span>
        {tests.map((t) => {
          const active = sameQuery(view.query, t.query);
          return (
            <Button key={t.id} aria-pressed={active} title={t.description} onClick={() => applyTest(t.query)} className={cx('px-2 py-0.5 text-xs', active && 'border-accent/50 bg-accent-soft font-medium text-accent hover:bg-accent-soft')}>
              {t.label}
            </Button>
          );
        })}
        {notice && (
          <p role="status" className={cx('ml-auto flex items-center gap-1 text-xs', notice.tone === 'ok' ? 'text-ok' : 'text-warn')}>
            {notice.text}
            <Button variant="ghost" className="px-1 py-0 text-xs" onClick={() => setNotice(null)} aria-label="Masquer le message">
              ✕
            </Button>
          </p>
        )}
      </div>

      <CriteriaPanel
        tab={view.panelTab}
        open={view.panelOpen}
        onChange={view.setPanel}
        tabs={panelTabs}
        actions={
          <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={view.reset} disabled={blank}>
            Réinitialiser les filtres
          </Button>
        }
      >
        {view.panelTab === 'filters' && <FilterPanel index={index} journalLabels={journalLabels} roles={roles} roundMultiples={roundMultiples} onSaveRequest={requestSave} />}
        {view.panelTab === 'saved' && <SavedQueries query={view.query} onLoad={loadSaved} nameRef={nameRef} />}
        {view.panelTab === 'journals' && <JournalSummary year={year} rows={yearSummary} selection={selectionSummary} pending={pending} onSelectJournal={(j) => view.patch({ journals: [j] })} />}
      </CriteriaPanel>

      <div ref={fillRef} style={{ height: height ?? `calc(100vh - ${FALLBACK_OFFSET})` }} className="flex min-h-0 flex-col gap-3">
        <section aria-labelledby="fec-results-title" className="flex min-h-[16rem] min-w-0 flex-1 flex-col overflow-clip rounded-lg border border-line bg-panel">
          <div className="shrink-0 border-b border-line px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <h2 id="fec-results-title" className="text-sm font-semibold">
                Résultats
              </h2>
              <p aria-live="polite" className={cx('text-sm', pending && 'opacity-60')}>
                <span className="font-semibold">{plural(result.lines.length, 'ligne', 'lignes')}</span>
                <span className="text-muted"> · </span>
                <span className="font-semibold">{plural(result.entries, 'écriture', 'écritures')}</span>
                {!isEmptyQuery(query) && <span className="text-muted"> sur {formatCount(index.entryLines.size)}</span>}
                {pending && <span className="text-muted"> – calcul…</span>}
              </p>
              <p className={cx('text-xs text-muted', pending && 'opacity-60')}>
                Débit <span className="num text-ink">{formatEuro(result.debit)}</span>
                <span className="mx-1.5">·</span>
                Crédit <span className="num text-ink">{formatEuro(result.credit)}</span>
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button onClick={exportCsv} disabled={pending || result.lines.length === 0} title="Lignes retenues : champs du FEC et utilisateur (« Saisi par »), séparateur point-virgule">
                  Exporter en CSV
                </Button>
                <Button onClick={exportFec} disabled={pending || result.lines.length === 0} title="Lignes retenues au format du FEC (champs réglementaires uniquement)">
                  Exporter au format FEC
                </Button>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Filtres actifs">
              {chips.length === 0 ? (
                <span className="text-xs text-muted">Aucun filtre : toutes les lignes du FEC {year}. Lancez un test courant ou composez une requête dans les filtres ; cliquez sur une ligne pour afficher son écriture.</span>
              ) : (
                chips.map((t) => (
                  <Badge key={t} tone="accent">
                    {t}
                  </Badge>
                ))
              )}
              {diagnostics && (
                <Badge tone="warn" title="Concepteur : écritures créées ou modifiées par une anomalie parmi les écritures retenues">
                  Concepteur : {plural(touched, 'écriture touchée', 'écritures touchées')} par une anomalie
                  {diagnostics.removed > 0 ? ` · ${plural(diagnostics.removed, 'écriture propre absente', 'écritures propres absentes')} du FEC` : ''}
                </Badge>
              )}
            </div>
          </div>
          {result.lines.length === 0 && !pending ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-sm text-muted">
              <p>Aucune ligne ne répond à l’ensemble des filtres.</p>
              <Button onClick={view.reset}>Réinitialiser les filtres</Button>
            </div>
          ) : (
            <ResultsTable index={index} lines={result.lines} selectedEntry={entryId} onSelect={selectEntry} roles={roles} diagnostics={diagnostics} />
          )}
        </section>

        {entryParam !== null &&
          (entryId !== null ? (
            <div className="flex max-h-[45%] min-h-0 shrink-0 flex-col">
              <EntryDetail key={entryId} index={index} entryId={entryId} threshold={threshold} roles={roles} diagnostic={diagnostics?.entries.get(entryId)} designer={designer} onClose={closeEntry} />
            </div>
          ) : (
            <div role="alert" className="flex shrink-0 items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-sm">
              <p>
                Cette écriture ne figure pas dans le FEC {year}.<span className="text-muted"> Vérifiez l’exercice sélectionné ou choisissez une ligne dans les résultats.</span>
              </p>
              <Button className="ml-auto" onClick={() => selectEntry(null)}>
                Fermer
              </Button>
            </div>
          ))}
      </div>
    </>
  );
}
