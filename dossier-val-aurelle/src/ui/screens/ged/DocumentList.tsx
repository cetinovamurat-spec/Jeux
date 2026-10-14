/**
 * GED list pane: full-text search, filters (category, status), sort, counter
 * and the documents (links: Enter opens; arrow keys move between them).
 */
import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { foldText, type DocumentSort, type DocumentStatusFilter, type ListedDocument } from '../../../game/documents';
import type { DocumentState } from '../../../game/state';
import type { DocumentCategory } from '../../../scenario/documents/model';
import { Badge, Button, cx, Kbd, Select } from '../../components/ui';
import { useGedView } from './gedStore';
import { AVAILABILITY_SHORT, CATEGORY_LABELS, CATEGORY_ORDER, plural, SORT_LABELS, STATUS_LABELS } from './labels';

/** Text with the (accent-insensitive) occurrences of the search words marked. */
export function Highlighted({ text, words }: { text: string; words: readonly string[] }) {
  if (!words.length) return <>{text}</>;
  const { text: folded, map } = foldText(text);
  const ranges: [number, number][] = [];
  for (const w of words) {
    for (let i = folded.indexOf(w); i >= 0; i = folded.indexOf(w, i + w.length)) {
      const last = map[i + w.length - 1]!;
      let k = i + w.length;
      while (k < map.length && map[k] === last) k++;
      ranges.push([map[i]!, k < map.length ? map[k]! : text.length]);
    }
  }
  if (!ranges.length) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], k) => {
    if (s < pos) return;
    out.push(text.slice(pos, s), <mark key={k} className="rounded-sm bg-warn/25 text-inherit">{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

export interface DocumentListProps {
  id: string;
  /** Changes with the search and the filters: the selected document is brought back into view. */
  listKey: string;
  items: readonly ListedDocument[];
  availableCount: number;
  selectedId: string | undefined;
  states: Readonly<Record<string, DocumentState>>;
  words: readonly string[];
  /** The deferred search has not caught up with the input yet. */
  pending: boolean;
  designer: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
}

export function DocumentList({ id, listKey, items, availableCount, selectedId, states, words, pending, designer, searchRef }: DocumentListProps) {
  const view = useGedView();
  const listRef = useRef<HTMLUListElement>(null);
  const searching = words.length > 0;
  const filtered = searching || view.category !== 'all' || view.status !== 'all';

  // Bring the selected document into view, scrolling the list only (never the page).
  useEffect(() => {
    const box = listRef.current;
    if (!selectedId || !box) return;
    const el = box.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(selectedId)}"]`);
    if (!el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop += r.top - b.top;
    else if (r.bottom > b.bottom) box.scrollTop += Math.min(r.bottom - b.bottom, r.top - b.top);
  }, [selectedId, listKey]);

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const links = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-doc-id]') ?? [])];
    if (!links.length) return;
    e.preventDefault();
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : e.key === 'ArrowDown' ? Math.min(links.length - 1, i + 1) : Math.max(0, i - 1);
    links[next]?.focus();
  };

  return (
    <section id={id} aria-label="Liste des documents" className="flex min-h-0 min-w-0 flex-col rounded-lg border border-line bg-panel">
      <div className="space-y-2 border-b border-line p-3">
        <div>
          <label htmlFor="ged-search" className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
            Recherche en texte intégral <Kbd>/</Kbd>
          </label>
          <input
            id="ged-search"
            ref={searchRef}
            type="search"
            value={view.query}
            onChange={(e) => view.update({ query: e.target.value })}
            placeholder="Mots du titre, de l’émetteur ou du contenu…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm placeholder:text-muted"
          />
        </div>
        <div>
          <label htmlFor="ged-category" className="mb-1 block text-xs font-medium text-muted">
            Catégorie
          </label>
          <Select id="ged-category" value={view.category} onChange={(e) => view.update({ category: e.target.value as DocumentCategory | 'all' })} className="w-full">
            <option value="all">Toutes les catégories</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label htmlFor="ged-status" className="mb-1 block text-xs font-medium text-muted">
              Statut
            </label>
            <Select id="ged-status" value={view.status} onChange={(e) => view.update({ status: e.target.value as DocumentStatusFilter })} className="w-full">
              {(Object.keys(STATUS_LABELS) as DocumentStatusFilter[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label htmlFor="ged-sort" className="mb-1 block text-xs font-medium text-muted">
              Tri
            </label>
            <Select id="ged-sort" value={view.sort} onChange={(e) => view.update({ sort: e.target.value as DocumentSort })} className="w-full">
              {(['dateDesc', 'dateAsc', 'title', 'relevance'] as const).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex min-h-6 items-center justify-between gap-2 text-xs text-muted">
          <p aria-live="polite" className={cx(pending && 'opacity-60')}>
            {plural(items.length, 'document', 'documents')}
            {filtered && items.length !== availableCount ? ` sur ${availableCount}` : ''}
            {pending ? ' – recherche…' : ''}
          </p>
          {filtered && (
            <Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={view.resetFilters}>
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted">
          <p>{searching ? 'Aucun document ne contient tous les mots recherchés.' : 'Aucun document ne correspond aux filtres.'}</p>
          <Button className="mt-3" onClick={view.resetFilters}>
            Réinitialiser la recherche et les filtres
          </Button>
        </div>
      ) : (
        <ul ref={listRef} aria-label="Documents" className="min-h-0 flex-1 overflow-y-auto" onKeyDown={onListKey}>
          {items.map(({ doc, hit }) => {
            const st = states[doc.id];
            const unread = !st?.readOn;
            const notes = st?.annotations.length ?? 0;
            const selected = doc.id === selectedId;
            return (
              <li key={doc.id} className="border-b border-line last:border-b-0">
                <Link
                  to={`/ged/${encodeURIComponent(doc.id)}`}
                  data-doc-id={doc.id}
                  aria-current={selected ? 'page' : undefined}
                  className={cx(
                    'flex gap-2 px-3 py-2 outline-offset-[-2px] hover:bg-sunken',
                    selected && 'bg-accent-soft hover:bg-accent-soft',
                  )}
                >
                  <span aria-hidden className={cx('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-accent' : 'bg-transparent')} />
                  <span className="block min-w-0 flex-1">
                    <span className={cx('block text-sm leading-snug', unread ? 'font-semibold' : 'font-medium', selected && 'text-accent')}>
                      <Highlighted text={doc.title} words={words} />
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted">
                      <span className="truncate" title={doc.issuer}>
                        <Highlighted text={doc.issuer} words={words} />
                      </span>
                      <span className="shrink-0 font-mono">{formatDateFr(doc.date)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[11px] text-muted">{CATEGORY_LABELS[doc.category]}</span>
                      {unread && <Badge tone="accent">Nouveau</Badge>}
                      {st?.evidence && <Badge tone="ok">Preuve</Badge>}
                      {notes > 0 && <Badge tone="muted">{plural(notes, 'annotation', 'annotations')}</Badge>}
                      {designer && doc.availability.kind !== 'initial' && <Badge tone="warn">{AVAILABILITY_SHORT[doc.availability.kind]}</Badge>}
                      {designer && (doc.clues.length > 0 ? <Badge tone="warn">{plural(doc.clues.length, 'indice', 'indices')}</Badge> : doc.noise ? <Badge tone="muted">Bruit</Badge> : null)}
                    </span>
                    {hit && (
                      <span className="mt-1 block border-l-2 border-line pl-2 text-xs leading-snug text-muted">
                        {hit.snippet ? <Highlighted text={hit.snippet} words={words} /> : <span className="italic">Trouvé dans le titre, l’émetteur ou les références.</span>}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
