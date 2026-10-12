/** Hooks shared by the screens: availability of documents, game state shortcuts. */
import { useMemo } from 'react';
import { isAvailable, type AvailabilityContext } from '../../game/documents';
import type { DocumentModel } from '../../scenario/documents';
import { useCase } from './context';
import { useGame } from './store';

export function useAvailability(): AvailabilityContext {
  const date = useGame((s) => s.game.clock.date);
  const designer = useGame((s) => s.game.settings.designer);
  return useMemo(() => ({ date, designer, answeredRequests: new Set<string>(), sentConfirmations: new Set<string>(), conditions: new Set<string>() }), [date, designer]);
}

/** Documents the player can consult at the current game date (all of them in designer mode). */
export function useAvailableDocuments(): DocumentModel[] {
  const c = useCase();
  const ctx = useAvailability();
  return useMemo(() => c.documents.filter((d) => isAvailable(d, ctx)), [c, ctx]);
}

export function useDesigner(): boolean {
  return useGame((s) => s.game.settings.designer);
}
