/** Layout and keyboard hooks shared by the balance and the general ledger. */
import { useLayoutEffect, useState, type RefObject } from 'react';

const MIN_HEIGHT = 300;

/**
 * Height (px) that makes an element starting at `ref` fill the viewport,
 * keeping `reserve` pixels below it (table footer, bottom margin).
 */
export function useFillHeight(ref: RefObject<HTMLElement | null>, reserve: number): number | undefined {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(MIN_HEIGHT, Math.floor(window.innerHeight - top - reserve)));
    };
    update();
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [ref, reserve]);
  return height;
}

/** '/' focuses the given input (outside text fields), as in the GED. */
export function useSlashFocus(ref: RefObject<HTMLInputElement | null>): void {
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (!ref.current) return;
      e.preventDefault();
      ref.current.focus();
      ref.current.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref]);
}
