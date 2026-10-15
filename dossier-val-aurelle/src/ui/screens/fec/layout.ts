/** Layout hooks of the FEC explorer: the workspace fills the viewport, the table fills its box. */
import { useLayoutEffect, useState, type RefObject } from 'react';

const MIN_HEIGHT = 360;
const BOTTOM_GAP = 16;

/** Height that makes the element fill the viewport down to the bottom of the page (the panes scroll inside). */
export function useFillHeight(ref: RefObject<HTMLElement | null>): number | undefined {
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
    // The elements above (header, usual tests, criteria panel) move the top when they grow or collapse.
    for (let s = ref.current?.previousElementSibling; s; s = s.previousElementSibling) ro?.observe(s);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [ref]);
  return height;
}

/** Current height of an element (for components that need an explicit height, such as the virtualised table). */
export function useElementHeight(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(Math.max(120, Math.floor(el.clientHeight)));
    update();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return height;
}
