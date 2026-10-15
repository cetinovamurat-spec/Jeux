/**
 * « Créer un constat » from the object being looked at (owned by J4d): opens
 * the finding form pre-filled with the seed (cycle, objects, evidence,
 * amount). Also offers the one-click capture of a question.
 */
import type { FindingSeed } from '../../../game/findings';
import { Button } from '../../components/ui';

export function NewFindingButton({ seed, compact }: { seed: FindingSeed; compact?: boolean }) {
  return (
    <Button disabled title={seed.label ?? 'Créer un constat'} className={compact ? 'px-1.5 py-0 text-xs' : undefined}>
      Constat…
    </Button>
  );
}
