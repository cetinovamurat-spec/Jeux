/**
 * GED — document management (routes '/ged' and '/ged/:docId'): list of the
 * documents available at the game date (search, filters, sort) on the left,
 * the selected document on the right (reading, annotations, evidence).
 */
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router';
import { listDocuments, searchWords } from '../../../game/documents';
import { markRead, type GameState } from '../../../game/state';
import { useCase } from '../../app/context';
import { useAvailableDocuments, useDesigner } from '../../app/hooks';
import { useGame } from '../../app/store';
import { Button, cx, Kbd, PageHeader } from '../../components/ui';
import { DocumentList } from './DocumentList';
import { DocumentViewer } from './DocumentViewer';
import { useGedView } from './gedStore';
import { plural } from './labels';

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

export function GedScreen() {
  const { docId } = useParams();
  const c = useCase();
  const available = useAvailableDocuments();
  const designer = useDesigner();
  const states = useGame((s) => s.game.documents);
  const act = useGame((s) => s.act);
  const view = useGedView();
  const query = useDeferredValue(view.query);
  const pending = query !== view.query;
  const words = useMemo(() => searchWords(query), [query]);
  const availableIds = useMemo(() => new Set(available.map((d) => d.id)), [available]);
  const hits = useMemo(() => (words.length ? c.documentIndex().search(query, availableIds) : null), [c, query, words, availableIds]);

  const requested = docId !== undefined ? c.documentsById.get(docId) : undefined;
  const open = requested && availableIds.has(requested.id) ? requested : undefined;

  const filter = useMemo(() => ({ category: view.category, status: view.status, sort: view.sort }), [view.category, view.status, view.sort]);
  const items = useMemo(() => listDocuments(available, states, filter, hits, open?.id), [available, states, filter, hits, open]);
  const position = open ? items.findIndex((x) => x.doc.id === open.id) : -1;
  const prevId = position > 0 ? items[position - 1]!.doc.id : null;
  const nextId = position >= 0 ? (items[position + 1]?.doc.id ?? null) : (items.find((x) => x.doc.id !== open?.id)?.doc.id ?? null);
  const hit = open && hits ? (hits.find((h) => h.docId === open.id) ?? null) : null;

  // Opening a document marks it as read (once: markRead keeps the first date).
  const readOn = open ? states[open.id]?.readOn : undefined;
  useEffect(() => {
    if (open && !readOn) act((s) => markRead(s, open.id));
  }, [open, readOn, act]);

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

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        title="Gestion documentaire"
        description="Documents remis par le client et réponses des tiers reçues à la date du dossier : recherche en texte intégral, lecture, annotations et éléments probants."
        actions={
          <Button onClick={() => view.update({ listHidden: !listHidden })} aria-expanded={!listHidden} aria-controls="ged-list">
            {listHidden ? 'Afficher la liste' : 'Masquer la liste'}
          </Button>
        }
      />
      <div
        ref={fillRef}
        data-ged-fill
        style={{ height: height ?? `calc(100vh - ${FALLBACK_OFFSET})` }}
        className={cx('grid grid-rows-[minmax(0,1fr)] gap-4', listHidden ? 'grid-cols-1' : 'grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]')}
      >
        {!listHidden && (
          <DocumentList id="ged-list" listKey={`${words.join(' ')}|${filter.category}|${filter.status}|${filter.sort}`} items={items} availableCount={available.length} selectedId={open?.id} states={states} words={words} pending={pending} designer={designer} searchRef={searchRef} />
        )}
        <section aria-label="Lecture du document" className="flex min-h-0 min-w-0 flex-col">
          {open ? (
            <DocumentViewer key={open.id} doc={open} state={states[open.id]} prevId={prevId} nextId={nextId} position={position} total={items.length} hit={hit} words={words} designer={designer} />
          ) : docId !== undefined ? (
            <div role="alert" className="rounded-lg border border-line bg-panel px-6 py-8">
              <p className="font-semibold">Ce document n’est pas disponible à la date du dossier.</p>
              <p className="mt-1 text-sm text-muted">Il n’a pas encore été reçu, il n’est communiqué que sur demande, ou la référence est inconnue. Choisissez un document dans la liste.</p>
              <Link to="/ged" className="mt-3 inline-block text-sm text-accent underline-offset-2 hover:underline">
                Revenir à la gestion documentaire
              </Link>
            </div>
          ) : (
            <Welcome total={available.length} states={states} ids={availableIds} firstUnread={items.find((x) => !states[x.doc.id]?.readOn)?.doc.id ?? null} />
          )}
        </section>
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
