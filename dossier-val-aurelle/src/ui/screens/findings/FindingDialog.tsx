/**
 * Modal dialog of the finding form, opened in context from any screen
 * (native <dialog>: focus kept inside, Escape closes, background inert). It is
 * rendered in a portal on the body so that the form is never nested in the
 * host's table, panel or form; its events do not reach the host either.
 * With unsaved input (`dirty`), Escape, the ✕ button and a click on the
 * backdrop ask before closing; a press that starts inside the dialog and is
 * released on the backdrop (text selection) does not close it.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../components/ui';

export function FindingDialog({ title, onClose, dirty, children }: { title: string; onClose: () => void; dirty?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `finding-dialog-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [confirming, setConfirming] = useState(false);
  /** The press of the current click started on the backdrop (not inside the dialog). */
  const pressedOnBackdrop = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      // closed by the browser despite the cancelled request (Escape pressed twice in a row): the player insisted.
      // Not when unmounted (no ref) or already reopened (development double effect).
      onClose={() => {
        if (ref.current && !ref.current.open) onClose();
      }}
      onClick={(e) => {
        e.stopPropagation();
        const backdrop = e.target === e.currentTarget && pressedOnBackdrop.current;
        pressedOnBackdrop.current = false;
        if (backdrop) requestClose();
      }}
      onKeyDown={stop}
      onSubmit={stop}
      onMouseDown={(e) => {
        e.stopPropagation();
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onFocus={stop}
      onBlur={stop}
      className="m-auto max-h-[92vh] w-[min(58rem,96vw)] overflow-hidden rounded-lg border border-line bg-panel p-0 text-left text-sm font-normal text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[92vh] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button variant="ghost" onClick={requestClose} aria-label="Fermer sans enregistrer" title="Fermer (Échap)">
            <span aria-hidden="true">✕</span>
          </Button>
        </header>
        {confirming && (
          <div role="alert" className="flex flex-wrap items-center justify-end gap-2 border-b border-warn/40 bg-warn/10 px-4 py-2">
            <p className="mr-auto text-warn">Fermer sans enregistrer ? Les informations saisies seront perdues.</p>
            <Button autoFocus onClick={() => setConfirming(false)}>
              Reprendre la saisie
            </Button>
            <Button variant="danger" onClick={onClose}>
              Fermer sans enregistrer
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
