/** Hooks shared by the screens: availability of documents, game state shortcuts. */
import { useMemo } from 'react';
import { availabilityContext, isAvailable, type AvailabilityContext } from '../../game/documents';
import type { DocumentModel } from '../../scenario/documents';
import { useCase } from './context';
import { useGame } from './store';

export function useAvailability(): AvailabilityContext {
  const c = useCase();
  const clock = useGame((s) => s.game.clock);
  const settings = useGame((s) => s.game.settings);
  const requests = useGame((s) => s.game.requests);
  const confirmations = useGame((s) => s.game.confirmations);
  return useMemo(() => availabilityContext({ clock, settings, requests, confirmations }, c.params), [c, clock, settings, requests, confirmations]);
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
