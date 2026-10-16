/**
 * « Demander conseil à Antoine » (plan J4 §14): free at the assistant level,
 * costs the partner's trust at the senior level (the player is told before),
 * unavailable at the manager level. The advice is worded as method.
 */
import { useState } from 'react';
import { aidMode, antoineAdvice, askAntoine, type Advice } from '../../../game/aid';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Button, Card } from '../../components/ui';

export function AidButton() {
  const c = useCase();
  const params = c.params;
  const difficulty = useGame((s) => s.game.difficulty);
  const act = useGame((s) => s.act);
  const [confirm, setConfirm] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const mode = aidMode(params, difficulty);
  const manager = params.game.firm.find((f) => f.id === 'manager')?.name ?? 'Antoine';
  const first = manager.split(/\s+/)[0] ?? manager;

  if (mode === 'unavailable')
    return (
      <Button disabled title="Aide indisponible au niveau manager">
        Demander conseil à {first}
      </Button>
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
  };

  return (
    <div className="contents">
      <Button onClick={ask} aria-expanded={advice !== null}>
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
        <div className="basis-full">
          <Card title={`Conseil de ${manager}`} actions={<Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={() => setAdvice(null)}>Fermer</Button>}>
            <p role="status" className="px-3 py-2 text-sm">
              {advice.text}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
