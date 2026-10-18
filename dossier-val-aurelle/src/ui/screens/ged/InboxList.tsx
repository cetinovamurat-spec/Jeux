/**
 * « Courrier reçu » (plan J4 §8.5): the documents that reached the auditor
 * during the engagement (replies to requests and confirmations, mail, pieces
 * added to the data room), most recent first, with the unread ones marked.
 * Links: Enter opens; arrow keys move between them.
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import type { DocumentState } from '../../../game/state';
import { Badge, cx } from '../../components/ui';
import { CATEGORY_LABELS, plural } from './labels';
import type { ReceivedDocument } from './replies';

export interface InboxListProps {
  id: string;
  items: readonly ReceivedDocument[];
  selectedId: string | undefined;
  states: Readonly<Record<string, DocumentState>>;
  unreadOnly: boolean;
  onUnreadOnly: (v: boolean) => void;
}

export function InboxList({ id, items, selectedId, states, unreadOnly, onUnreadOnly }: InboxListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const unread = items.filter((x) => !states[x.doc.id]?.readOn).length;
  const shown = unreadOnly ? items.filter((x) => !states[x.doc.id]?.readOn || x.doc.id === selectedId) : items;

  useEffect(() => {
    const box = listRef.current;
    if (!selectedId || !box) return;
    const el = box.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(selectedId)}"]`);
    if (!el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop += r.top - b.top;
    else if (r.bottom > b.bottom) box.scrollTop += Math.min(r.bottom - b.bottom, r.top - b.top);
  }, [selectedId]);

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
    <section id={id} aria-label="Courrier reçu" className="flex min-h-0 min-w-0 flex-col rounded-lg border border-line bg-panel">
      <div className="space-y-2 border-b border-line p-3">
        <p className="text-sm">
          <span className="font-semibold">Courrier reçu</span>
          <span className="text-muted"> – réponses aux demandes et aux confirmations, courrier et pièces versées en cours de mission</span>
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <p aria-live="polite">
            {plural(items.length, 'pièce reçue', 'pièces reçues')}, {plural(unread, 'non lue', 'non lues')}
          </p>
          <label htmlFor={`${id}-unread`} className="inline-flex cursor-pointer items-center gap-1.5">
            <input id={`${id}-unread`} type="checkbox" checked={unreadOnly} onChange={(e) => onUnreadOnly(e.target.checked)} className="accent-[var(--accent)]" />
            Non lues seulement
          </label>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">{items.length === 0 ? 'Rien n’a encore été reçu depuis le début de la mission.' : 'Toutes les pièces reçues ont été lues.'}</p>
      ) : (
        <ul ref={listRef} aria-label="Pièces reçues, de la plus récente à la plus ancienne" className="min-h-0 flex-1 overflow-y-auto" onKeyDown={onListKey}>
          {shown.map(({ doc, on }) => {
            const isUnread = !states[doc.id]?.readOn;
            const selected = doc.id === selectedId;
            return (
              <li key={doc.id} className="border-b border-line last:border-b-0">
                <Link
                  to={`/ged/${encodeURIComponent(doc.id)}?onglet=courrier`}
                  data-doc-id={doc.id}
                  aria-current={selected ? 'page' : undefined}
                  className={cx('flex gap-2 px-3 py-2 outline-offset-[-2px] hover:bg-sunken', selected && 'bg-accent-soft hover:bg-accent-soft')}
                >
                  <span aria-hidden className={cx('mt-1.5 size-2 shrink-0 rounded-full', isUnread ? 'bg-accent' : 'bg-transparent')} />
                  <span className="block min-w-0 flex-1">
                    <span className={cx('block text-sm leading-snug', isUnread ? 'font-semibold' : 'font-medium', selected && 'text-accent')}>{doc.title}</span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted">
                      <span className="truncate" title={doc.issuer}>
                        {doc.issuer}
                      </span>
                      <span className="shrink-0 font-mono">Reçu le {formatDateFr(on)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[11px] text-muted">{CATEGORY_LABELS[doc.category]}</span>
                      {isUnread && <Badge tone="accent">Nouveau</Badge>}
                    </span>
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
