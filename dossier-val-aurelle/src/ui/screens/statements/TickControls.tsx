/**
 * Tick cells: the button shown next to each figure, the popover menu of the
 * marks, and the context sharing the ticks between them.
 *
 * Keyboard on a cell: Entrée / Espace opens the menu (or applies the quick
 * mark), 1 to 9 applies the corresponding mark, Suppr / Retour arrière clears,
 * Maj + F10 or the context-menu key always opens the menu, arrows move to the
 * neighbouring cell of the table.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { setTick, type TickMark } from '../../../game/state';
import { markForDigit, type Ticks } from '../../../game/ticking';
import { useGame } from '../../app/store';
import { cx, Kbd, toneText } from '../../components/ui';

interface MenuState {
  cell: string;
  label: string;
  anchor: HTMLElement;
  /** « Créer un constat… » on the row of the cell, when the table offers it. */
  onFinding?: (() => void) | undefined;
}

interface TickingValue {
  ticks: Ticks;
  marks: readonly TickMark[];
  markById: ReadonlyMap<string, TickMark>;
  /** Mark applied by a plain click (null: a click opens the menu). */
  clickMark: string | null;
  menuCell: string | null;
  apply: (cell: string, markId: string | null) => void;
  openMenu: (cell: string, label: string, anchor: HTMLElement, onFinding?: () => void) => void;
}

const TickingCtx = createContext<TickingValue | null>(null);

function useTicking(): TickingValue {
  const v = useContext(TickingCtx);
  if (!v) throw new Error('TickingProvider missing');
  return v;
}

const DESC_PREFIX = 'etats-tick-desc-';

export function TickingProvider({ clickMark, onManageMarks, children }: { clickMark: string | null; onManageMarks: () => void; children: ReactNode }) {
  const ticks = useGame((s) => s.game.ticks);
  const marks = useGame((s) => s.game.tickMarks);
  const act = useGame((s) => s.act);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const markById = useMemo(() => new Map(marks.map((m) => [m.id, m])), [marks]);
  const apply = useCallback((cell: string, markId: string | null) => act((s) => setTick(s, cell, markId)), [act]);
  const openMenu = useCallback((cell: string, label: string, anchor: HTMLElement, onFinding?: () => void) => setMenu((m) => (m?.cell === cell ? null : { cell, label, anchor, onFinding })), []);
  const close = useCallback(
    (refocus: boolean) => {
      if (refocus && menu?.anchor.isConnected) menu.anchor.focus();
      setMenu(null);
    },
    [menu],
  );
  const value = useMemo<TickingValue>(() => ({ ticks, marks, markById, clickMark, menuCell: menu?.cell ?? null, apply, openMenu }), [ticks, marks, markById, clickMark, menu, apply, openMenu]);

  return (
    <TickingCtx.Provider value={value}>
      {children}
      {/* descriptions of the cell states, referenced by aria-describedby */}
      <div hidden>
        <span id={`${DESC_PREFIX}none`}>Non pointé</span>
        {marks.map((m) => (
          <span key={m.id} id={`${DESC_PREFIX}${m.id}`}>
            Pointé : {m.label}
          </span>
        ))}
      </div>
      {menu &&
        createPortal(
          <TickMenu
            key={menu.cell}
            menu={menu}
            current={ticks[menu.cell] ?? null}
            marks={marks}
            onChoose={(markId) => {
              apply(menu.cell, markId);
              close(true);
            }}
            onClose={close}
            onManage={() => {
              close(true);
              onManageMarks();
            }}
            {...(menu.onFinding
              ? {
                  onFinding: () => {
                    close(false);
                    menu.onFinding?.();
                  },
                }
              : {})}
          />,
          document.body,
        )}
    </TickingCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// cell button
// ---------------------------------------------------------------------------

const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/** Moves the focus to the nearest tick button of the same table in a direction. */
function moveFocus(from: HTMLElement, [dr, dc]: [number, number]): void {
  const grid = from.closest('[data-tick-grid]');
  if (!grid) return;
  const r = Number(from.dataset['tickR']);
  const c = Number(from.dataset['tickC']);
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const b of grid.querySelectorAll<HTMLElement>('[data-tick-r]')) {
    const br = Number(b.dataset['tickR']);
    const bc = Number(b.dataset['tickC']);
    const dist = dr !== 0 ? (bc === c && Math.sign(br - r) === dr ? Math.abs(br - r) : Infinity) : br === r && Math.sign(bc - c) === dc ? Math.abs(bc - c) : Infinity;
    if (dist < bestDist) {
      best = b;
      bestDist = dist;
    }
  }
  best?.focus();
}

export function TickButton({ cell, label, row, col, onFinding }: { cell: string; label: string; row: number; col: number; onFinding?: (() => void) | undefined }) {
  const t = useTicking();
  const markId = t.ticks[cell];
  const mark = markId !== undefined ? t.markById.get(markId) : undefined;
  const brush = t.clickMark ? t.markById.get(t.clickMark) : undefined;
  const open = t.menuCell === cell;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const m = markForDigit(t.marks, e.key);
    if (m) {
      e.preventDefault();
      t.apply(cell, m.id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      t.apply(cell, null);
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      t.openMenu(cell, label, e.currentTarget, onFinding);
    } else if (ARROWS[e.key]) {
      e.preventDefault();
      moveFocus(e.currentTarget, ARROWS[e.key]!);
    }
  };

  return (
    <button
      type="button"
      data-tick-r={row}
      data-tick-c={col}
      aria-label={`Pointer ${label}`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-describedby={`${DESC_PREFIX}${mark ? mark.id : 'none'}`}
      title={mark ? `${mark.symbol} ${mark.label}` : brush ? `Non pointé – cliquer pour appliquer « ${brush.label} »` : 'Non pointé – cliquer pour choisir une marque'}
      onClick={(e) => {
        if (brush && !e.shiftKey) t.apply(cell, markId === brush.id ? null : brush.id);
        else t.openMenu(cell, label, e.currentTarget, onFinding);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        t.openMenu(cell, label, e.currentTarget, onFinding);
      }}
      onKeyDown={onKeyDown}
      className={cx(
        'inline-flex h-5 min-w-5 shrink-0 scroll-mt-20 scroll-mb-4 items-center justify-center rounded border px-0.5 font-sans text-xs font-semibold leading-none',
        mark ? cx('border-line bg-sunken', toneText(mark.tone)) : 'border-dashed border-muted/50 text-muted hover:border-accent hover:text-accent',
        open && 'ring-2 ring-accent/60',
      )}
    >
      {mark ? mark.symbol : <span aria-hidden="true" className="opacity-0">·</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// popover menu
// ---------------------------------------------------------------------------

function TickMenu({
  menu,
  current,
  marks,
  onChoose,
  onClose,
  onManage,
  onFinding,
}: {
  menu: MenuState;
  current: string | null;
  marks: readonly TickMark[];
  onChoose: (markId: string | null) => void;
  onClose: (refocus: boolean) => void;
  onManage: () => void;
  onFinding?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (!menu.anchor.isConnected) {
      onClose(false);
      return;
    }
    const a = menu.anchor.getBoundingClientRect();
    const m = el.getBoundingClientRect();
    let top = a.bottom + 4;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, a.top - m.height - 4);
    const left = Math.max(8, Math.min(a.right - m.width, window.innerWidth - m.width - 8));
    setPos({ top, left });
  }, [menu, onClose]);

  useLayoutEffect(() => place(), [place]);

  // initial focus: the current mark, otherwise the first item
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>('[aria-checked="true"]') ?? el.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])');
    target?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onMove = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menu.anchor.contains(t)) return;
      onClose(false);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('mousedown', onDown);
    };
  }, [place, menu, onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (k: number) => items[(k + items.length) % items.length]?.focus();
    const m = markForDigit(marks, e.key);
    if (e.key === 'ArrowDown') focusAt(i + 1);
    else if (e.key === 'ArrowUp') focusAt(i < 0 ? items.length - 1 : i - 1);
    else if (e.key === 'Home') focusAt(0);
    else if (e.key === 'End') focusAt(items.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') onClose(true);
    else if (m) onChoose(m.id);
    else if (e.key === 'Delete' || e.key === 'Backspace') onChoose(null);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const item = 'flex w-full items-center gap-2 px-3 py-1 text-left text-sm hover:bg-sunken focus:bg-accent-soft focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Marques de pointage – ${menu.label}`}
      onKeyDown={onKeyDown}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="fixed z-50 w-80 max-w-[calc(100vw-1rem)] rounded-md border border-line bg-panel py-1 text-ink shadow-xl"
    >
      <p aria-hidden="true" className="truncate px-3 pb-1 pt-0.5 text-xs text-muted">
        {menu.label}
      </p>
      {marks.length === 0 && <p className="px-3 py-1 text-xs text-muted">Aucune marque définie.</p>}
      {marks.map((m, i) => (
        <button key={m.id} type="button" role="menuitemradio" aria-checked={current === m.id} tabIndex={-1} onClick={() => onChoose(m.id)} className={item}>
          <span aria-hidden="true" className={cx('w-6 shrink-0 text-center font-semibold', toneText(m.tone))}>
            {m.symbol}
          </span>
          <span className={cx('min-w-0 flex-1 truncate', current === m.id && 'font-semibold')}>{m.label}</span>
          {current === m.id && <span className="sr-only">(marque actuelle)</span>}
          {i < 9 && <Kbd>{i + 1}</Kbd>}
        </button>
      ))}
      <div role="separator" className="my-1 border-t border-line" />
      <button type="button" role="menuitem" tabIndex={-1} disabled={current === null} onClick={() => onChoose(null)} className={item}>
        <span aria-hidden="true" className="w-6 shrink-0 text-center text-muted">
          ✕
        </span>
        <span className="flex-1">Effacer</span>
        <Kbd>Suppr</Kbd>
      </button>
      <button type="button" role="menuitem" tabIndex={-1} onClick={onManage} className={item}>
        <span aria-hidden="true" className="w-6 shrink-0" />
        <span className="flex-1">Gérer les marques…</span>
      </button>
      {onFinding && (
        <button type="button" role="menuitem" tabIndex={-1} onClick={onFinding} className={item}>
          <span aria-hidden="true" className="w-6 shrink-0" />
          <span className="flex-1">Créer un constat sur la rubrique…</span>
        </button>
      )}
    </div>
  );
}
