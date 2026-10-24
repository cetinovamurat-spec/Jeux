/**
 * Command palette (Ctrl+K / Cmd+K): go to a screen, open a document, jump to
 * an account in the general ledger, run a saved FEC query, open a message…
 * The items come from the registry of sources (palette-sources.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGedDocuments } from '../screens/ged/replies';
import { useNavigate } from 'react-router';
import { normalize } from '../../game/fec-query';
import { cx, Kbd } from '../components/ui';
import { useCase } from './context';
import { useDesigner, useMessageContext } from './hooks';
import { PALETTE_SOURCES } from './palette-sources';
import { useGame } from './store';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

function optionId(i: number): string {
  return `palette-option-${i}`;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCase();
  const navigate = useNavigate();
  const docs = useGedDocuments().available;
  const designer = useDesigner();
  const game = useGame((s) => s.game);
  const messages = useMessageContext();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  }, [open, active, q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<(Item & { byDefault: boolean })[]>(() => {
    if (!open) return [];
    const go = (to: string) => () => {
      navigate(to);
      onClose();
    };
    const ctx = { c, game, docs, designer, messages };
    return PALETTE_SOURCES.flatMap((src) => src.items(ctx).map((it) => ({ id: it.id, group: src.group, label: it.label, ...(it.hint !== undefined ? { hint: it.hint } : {}), run: go(it.to), byDefault: src.shownByDefault === true })));
  }, [open, c, game, docs, designer, messages, navigate, onClose]);

  const shown = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean);
    const list = words.length ? items.filter((it) => words.every((w) => normalize(`${it.label} ${it.hint ?? ''}`).includes(w))) : items.filter((it) => it.byDefault);
    return list.slice(0, 40);
  }, [items, q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Palette de commandes" className="w-[min(640px,92vw)] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              // handled here only: an entry panel open under the palette must stay open
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(shown.length - 1, a + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            }
            if (e.key === 'Enter') shown[active]?.run();
          }}
          placeholder="Écran, document, compte (ex. 4687), requête…"
          aria-label="Rechercher une commande"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={shown[active] ? optionId(active) : undefined}
          aria-autocomplete="list"
          className="w-full border-b border-line bg-panel px-4 py-3 text-base outline-none"
        />
        <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-auto py-1">
          {shown.map((it, i) => (
            <li
              key={it.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={it.run}
              className={cx('flex cursor-pointer items-baseline gap-3 px-4 py-1.5 text-sm', i === active && 'bg-accent-soft')}
            >
              <span className="w-24 shrink-0 text-xs text-muted">{it.group}</span>
              <span className="truncate">{it.label}</span>
              {it.hint && <span className="ml-auto truncate text-xs text-muted">{it.hint}</span>}
            </li>
          ))}
          {!shown.length && <li className="px-4 py-3 text-sm text-muted">Aucun résultat.</li>}
        </ul>
        <p className="border-t border-line px-4 py-1.5 text-xs text-muted">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> pour choisir, <Kbd>Entrée</Kbd> pour ouvrir, <Kbd>Échap</Kbd> pour fermer
        </p>
      </div>
    </div>
  );
}
