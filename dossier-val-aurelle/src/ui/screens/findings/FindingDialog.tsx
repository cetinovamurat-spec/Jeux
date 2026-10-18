/**
 * Modal dialog of the finding form, opened in context from any screen
 * (native <dialog>: focus kept inside, Escape closes, background inert). It is
 * rendered in a portal on the body so that the form is never nested in the
 * host's table, panel or form; its events do not reach the host either.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../components/ui';

export function FindingDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `finding-dialog-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={stop}
      onSubmit={stop}
      onMouseDown={stop}
      onFocus={stop}
      onBlur={stop}
      className="m-auto max-h-[92vh] w-[min(58rem,96vw)] overflow-hidden rounded-lg border border-line bg-panel p-0 text-left text-sm font-normal text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[92vh] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button variant="ghost" onClick={onClose} aria-label="Fermer sans enregistrer" title="Fermer (Échap)">
            <span aria-hidden="true">✕</span>
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
