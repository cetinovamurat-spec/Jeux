/**
 * « Demander conseil à Antoine » (plan J4 §14): free at the assistant level,
 * costs the partner's trust at the senior level (the player is told before
 * and confirms), unavailable at the manager level. The advice, worded as
 * method, opens in a panel at the top right of the screen, under the top bar
 * (Escape or « Fermer » closes it), wherever the button is.
 */
import { useEffect, useRef, useState } from 'react';
import { aidMode, antoineAdvice, askAntoine, type Advice } from '../../../game/aid';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Button } from '../../components/ui';

export function AidButton() {
  const c = useCase();
  const params = c.params;
  const difficulty = useGame((s) => s.game.difficulty);
  const act = useGame((s) => s.act);
  const [confirm, setConfirm] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mode = aidMode(params, difficulty);
  const manager = params.game.firm.find((f) => f.id === 'manager')?.name ?? 'Antoine';
  const first = manager.split(/\s+/)[0] ?? manager;

  useEffect(() => {
    if (!advice && !confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (advice) buttonRef.current?.focus();
      setAdvice(null);
      setConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advice, confirm]);

  if (mode === 'unavailable')
    return (
      <span className="inline-flex items-center gap-2">
        <Button disabled aria-describedby="aid-unavailable">
          Demander conseil à {first}
        </Button>
        <span id="aid-unavailable" className="text-xs text-muted">
          Indisponible au niveau manager
        </span>
      </span>
    );

  const ask = () => {
    if (mode === 'partnerTrust' && !confirm) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    const g = useGame.getState().game;
    setAdvice(antoineAdvice(g, params, g.clock.date));
    act((s) => askAntoine(s, params));
    // the panel takes the focus, the button gets it back when it closes
    requestAnimationFrame(() => closeRef.current?.focus());
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <Button ref={buttonRef} onClick={ask} aria-expanded={advice !== null} aria-controls={advice ? 'aid-advice' : undefined}>
        {confirm ? 'Confirmer la demande de conseil' : `Demander conseil à ${first}`}
      </Button>
      {confirm && (
        <span className="text-xs text-warn">
          {first} en parlera à l’associée : une demande de conseil entame sa confiance.{' '}
          <button type="button" className="underline" onClick={() => setConfirm(false)}>
            Annuler
          </button>
        </span>
      )}
      {advice && (
        <section id="aid-advice" aria-labelledby="aid-advice-title" className="fixed right-4 top-28 z-40 w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-line bg-panel text-left shadow-xl">
          <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <h2 id="aid-advice-title" className="text-sm font-semibold">
              Conseil de {manager}
            </h2>
            <Button
              ref={closeRef}
              variant="ghost"
              className="px-1.5 py-0 text-xs"
              onClick={() => {
                setAdvice(null);
                buttonRef.current?.focus();
              }}
            >
              Fermer
            </Button>
          </header>
          <p role="status" className="px-3 py-2 text-sm">
            {advice.text}
          </p>
        </section>
      )}
    </div>
  );
}
