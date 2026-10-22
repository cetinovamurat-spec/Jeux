/**
 * GED — document management (routes '/ged' and '/ged/:docId'), in three
 * tabs: the documents available at the game date (search, filters, sort) with
 * the selected document on the right (reading, annotations, evidence); the
 * mail received during the engagement (« Courrier reçu », most recent first,
 * unread marked); the requests and confirmations (plan J4 §8, §9). The
 * replies built on demand (generic replies, « sans écart » confirmations) are
 * listed with the scenario documents. `?onglet=courrier|demandes` opens a tab.
 */
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { buildDocumentIndex, listDocuments, searchWords } from '../../../game/documents';
import { markRead, type GameState } from '../../../game/state';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { useGame } from '../../app/store';
import { Badge, Button, cx, Kbd, PageHeader, tabPanelId, Tabs } from '../../components/ui';
import { DocumentList } from './DocumentList';
import { DocumentViewer } from './DocumentViewer';
import { useGedView } from './gedStore';
import { InboxList } from './InboxList';
import { GED_TABS, plural, type GedTab } from './labels';
import { useGedDocuments, useReceivedMail } from './replies';
import { RequestsTab } from './RequestsTab';

/** Print only the document sheet (the rest of the application is hidden). */
const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body { background: white !important; }
  body *:not([data-ged-print]):not([data-ged-print] *):not(:has([data-ged-print])) { display: none !important; }
  [data-ged-print] { position: absolute; left: 0; top: 0; width: 100%; }
  [data-ged-print] .paper { box-shadow: none !important; background: white !important; color: black !important; max-width: none !important; padding: 0 !important; }
  [data-ged-print] [data-block] { box-shadow: none !important; background: none !important; }
  [data-ged-print] [title="Annotations"] { display: none !important; }
  [data-ged-fill] { position: static !important; height: auto !important; overflow: visible !important; }
}`;

const MIN_HEIGHT = 440;
/** Height of the shell header and page title, until the real offset is measured. */
const FALLBACK_OFFSET = '11rem';
const BOTTOM_GAP = 16;

/** Height that makes the element fill the viewport down to the bottom of the page (both panes scroll inside). */
function useFillHeight(ref: RefObject<HTMLElement | null>): number | undefined {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(MIN_HEIGHT, Math.floor(window.innerHeight - top - BOTTOM_GAP)));
    };
    update();
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [ref]);
  return height;
}

function isTab(v: string | null): v is GedTab {
  return v !== null && (GED_TABS as readonly string[]).includes(v);
}

export function GedScreen() {
  const { docId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const c = useCase();
  const { available, replies, byId } = useGedDocuments();
  const mail = useReceivedMail();
  const designer = useDesigner();
  const states = useGame((s) => s.game.documents);
  const act = useGame((s) => s.act);
  const view = useGedView();
  const urlTab = searchParams.get('onglet');
  // a link to a document (no ?onglet=) shows the document, even if the requests tab was the last one used
  const tab: GedTab = isTab(urlTab) ? urlTab : docId !== undefined && view.tab === 'demandes' ? 'documents' : view.tab;
  const [unreadOnly, setUnreadOnly] = useState(false);
  useEffect(() => {
    if (isTab(urlTab) && urlTab !== view.tab) view.update({ tab: urlTab });
    else if (!isTab(urlTab) && docId !== undefined && view.tab === 'demandes') view.update({ tab: 'documents' });
  }, [urlTab, docId]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectTab = (t: GedTab) => {
    view.update({ tab: t });
    setSearchParams(t === 'documents' ? {} : { onglet: t }, { replace: true });
  };

  const query = useDeferredValue(view.query);
  const pending = query !== view.query;
  const words = useMemo(() => searchWords(query), [query]);
  const availableIds = useMemo(() => new Set(available.map((d) => d.id)), [available]);
  // catalogue documents are searched in the case's index, replies built on demand in their own (a reply may share the id of a reference version)
  const catalogueIds = useMemo(() => new Set(available.filter((d) => c.documentsById.get(d.id) === d).map((d) => d.id)), [c, available]);
  const replyIndex = useMemo(() => buildDocumentIndex(replies), [replies]);
  const hits = useMemo(() => {
    if (!words.length) return null;
    return [...c.documentIndex().search(query, catalogueIds), ...replyIndex.search(query)].sort((a, b) => b.score - a.score || (a.docId < b.docId ? -1 : 1));
  }, [c, query, words, catalogueIds, replyIndex]);

  // '?bloc=N' (1-based) selects and shows block N of the document (links from the risk factors)
  const blocParam = Number(searchParams.get('bloc'));
  const initialBlock = Number.isInteger(blocParam) && blocParam >= 1 ? blocParam - 1 : null;
  const requested = docId !== undefined ? byId(docId) : undefined;
  const open = requested && availableIds.has(requested.id) ? requested : undefined;

  const filter = useMemo(() => ({ category: view.category, status: view.status, sort: view.sort }), [view.category, view.status, view.sort]);
  const items = useMemo(() => listDocuments(available, states, filter, hits, open?.id), [available, states, filter, hits, open]);
  const inboxShown = useMemo(() => (unreadOnly ? mail.filter((x) => !states[x.doc.id]?.readOn || x.doc.id === open?.id) : mail), [mail, unreadOnly, states, open]);
  const order = tab === 'courrier' ? inboxShown.map((x) => x.doc.id) : items.map((x) => x.doc.id);
  const position = open ? order.indexOf(open.id) : -1;
  const prevId = position > 0 ? order[position - 1]! : null;
  const nextId = position >= 0 ? (order[position + 1] ?? null) : (order.find((id) => id !== open?.id) ?? null);
  const hit = open && hits && tab === 'documents' ? (hits.find((h) => h.docId === open.id) ?? null) : null;
  const unreadMail = mail.filter((x) => !states[x.doc.id]?.readOn).length;

  // Opening a document marks it as read (once: markRead keeps the first date).
  const readOn = open ? states[open.id]?.readOn : undefined;
  useEffect(() => {
    // a document hidden behind the requests tab is not read
    if (open && tab !== 'demandes' && !readOn) act((s) => markRead(s, open.id));
  }, [open, tab, readOn, act]);

  // '/' focuses the search box (outside text fields).
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
      searchRef.current.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fillRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(fillRef);
  const listHidden = view.listHidden;
  const tabs = [
    { id: 'documents' as const, label: <>Documents <span className="text-xs font-normal text-muted">({available.length})</span></> },
    { id: 'courrier' as const, label: <span className="inline-flex items-center gap-1.5">Courrier reçu {unreadMail > 0 && <Badge tone="accent" title={plural(unreadMail, 'pièce non lue', 'pièces non lues')}>{unreadMail}<span className="sr-only"> non lues</span></Badge>}</span> },
    { id: 'demandes' as const, label: 'Demandes et confirmations' },
  ];

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        title="Gestion documentaire"
        description="Documents remis par le client et réponses des tiers reçues à la date du dossier : recherche en texte intégral, lecture, annotations et éléments probants ; demandes de pièces et confirmations."
        actions={
          tab !== 'demandes' ? (
            <Button onClick={() => view.update({ listHidden: !listHidden })} aria-expanded={!listHidden} aria-controls="ged-list">
              {listHidden ? 'Afficher la liste' : 'Masquer la liste'}
            </Button>
          ) : undefined
        }
      />
      <Tabs value={tab} onChange={selectTab} items={tabs} label="Gestion documentaire" idPrefix="ged" />
      <div id={tabPanelId('ged')} role="tabpanel" aria-labelledby={`ged-tab-${tab}`} className="pt-3">
        {tab === 'demandes' ? (
          <RequestsTab />
        ) : (
          <div
            ref={fillRef}
            data-ged-fill
            style={{ height: height ?? `calc(100vh - ${FALLBACK_OFFSET})` }}
            className={cx('grid grid-rows-[minmax(0,1fr)] gap-4', listHidden ? 'grid-cols-1' : 'grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]')}
          >
            {!listHidden &&
              (tab === 'courrier' ? (
                <InboxList id="ged-list" items={mail} selectedId={open?.id} states={states} unreadOnly={unreadOnly} onUnreadOnly={setUnreadOnly} />
              ) : (
                <DocumentList id="ged-list" listKey={`${words.join(' ')}|${filter.category}|${filter.status}|${filter.sort}`} items={items} availableCount={available.length} selectedId={open?.id} states={states} words={words} pending={pending} designer={designer} searchRef={searchRef} />
              ))}
            <section aria-label="Lecture du document" className="flex min-h-0 min-w-0 flex-col">
              {open ? (
                <DocumentViewer key={open.id} doc={open} state={states[open.id]} prevId={prevId} nextId={nextId} position={position} total={order.length} hit={hit} words={tab === 'documents' ? words : []} designer={designer} initialBlock={initialBlock} />
              ) : docId !== undefined ? (
                <div role="alert" className="rounded-lg border border-line bg-panel px-6 py-8">
                  <p className="font-semibold">Ce document n’est pas disponible à la date du dossier.</p>
                  <p className="mt-1 text-sm text-muted">Il n’a pas encore été reçu, il n’est communiqué que sur demande, ou la référence est inconnue. Choisissez un document dans la liste.</p>
                  <Link to="/ged" className="mt-3 inline-block text-sm text-accent underline-offset-2 hover:underline">
                    Revenir à la gestion documentaire
                  </Link>
                </div>
              ) : (
                <Welcome total={available.length} states={states} ids={availableIds} firstUnread={(tab === 'courrier' ? inboxShown.find((x) => !states[x.doc.id]?.readOn)?.doc.id : items.find((x) => !states[x.doc.id]?.readOn)?.doc.id) ?? null} />
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Welcome({ total, states, ids, firstUnread }: { total: number; states: GameState['documents']; ids: ReadonlySet<string>; firstUnread: string | null }) {
  let read = 0;
  let evidence = 0;
  let notes = 0;
  for (const id of ids) {
    const s = states[id];
    if (!s) continue;
    if (s.readOn) read++;
    if (s.evidence) evidence++;
    notes += s.annotations.length;
  }
  return (
    <div className="rounded-lg border border-line bg-panel px-6 py-6 text-sm">
      <h2 className="text-base font-semibold">Aucun document sélectionné</h2>
      <p className="mt-1 max-w-2xl text-muted">
        Choisissez un document dans la liste (ou parcourez-la avec les flèches <Kbd>↑</Kbd> <Kbd>↓</Kbd> puis <Kbd>Entrée</Kbd>). La recherche porte sur le texte intégral des documents reçus, sans tenir compte des accents ; tous les mots saisis doivent figurer dans le document.
        Cliquez sur un passage pour l’annoter et conservez les pièces utiles comme éléments probants.
      </p>
      <dl className="mt-4 grid max-w-xl grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Documents reçus</dt>
          <dd className="font-mono text-lg">{total}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Non lus</dt>
          <dd className="font-mono text-lg">{total - read}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Preuves</dt>
          <dd className="font-mono text-lg">{evidence}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Annotations</dt>
          <dd className="font-mono text-lg">{notes}</dd>
        </div>
      </dl>
      {firstUnread && (
        <Link to={`/ged/${encodeURIComponent(firstUnread)}`} className="mt-4 inline-flex rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-panel hover:opacity-90">
          Lire le premier document non lu de la liste
        </Link>
      )}
      {total - read > 0 && !firstUnread && <p className="mt-4 text-xs text-muted">{plural(total - read, 'document non lu', 'documents non lus')} hors des filtres actuels.</p>}
    </div>
  );
}
