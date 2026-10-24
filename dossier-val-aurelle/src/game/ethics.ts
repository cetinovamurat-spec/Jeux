/**
 * Ethics and independence (plan J5 §9): the player's choices on the events
 * E1 to E5, B1 and B2, and the notes to the partner attached to their
 * messages, dated and numbered. The default option never changes the state:
 * no choice is stored for it.
 *
 * Section of the game state: types, initial value, save schema. The rules
 * (ethicsEvents, answerEthics, noteToPartner) and the bodies of the
 * providers below come with the ethics lot (J5b).
 */
import { z } from 'zod';
import type { Params } from '../scenario/params';
import { ETHICS_EVENT_IDS, type EthicsEventId } from '../scenario/schemas/ethics-events';
import type { UpcomingContext, UpcomingEvent } from './advance';
import type { HoursCharge } from './budget';
import type { GaugeContext, GaugeHost, ProvidedGaugeEvent } from './gauge-values';
import type { DatedOption, DatedText } from './interviews';
import type { Message, MessageContext } from './messages';
import type { GameState } from './state';

export { ETHICS_EVENT_IDS, isEthicsEventId, type EthicsEventId } from '../scenario/schemas/ethics-events';

export interface EthicsState {
  choices: Partial<Record<EthicsEventId, DatedOption>>;
  notes: Partial<Record<EthicsEventId, DatedText>>;
}

export function initialEthics(): EthicsState {
  return { choices: {}, notes: {} };
}

const eventId = z.enum(ETHICS_EVENT_IDS);
export const ethicsSchema = z.object({
  choices: z.partialRecord(eventId, z.object({ on: z.string(), seq: z.number().int(), option: z.string() })),
  notes: z.partialRecord(eventId, z.object({ on: z.string(), seq: z.number().int(), text: z.string() })),
});

// ---------------------------------------------------------------------------
// providers (registries of game/budget.ts, game/gauge-values.ts, game/messages.ts, game/advance.ts)
// ---------------------------------------------------------------------------

/** Hours charged by the options that take time (E2: tables prepared, B1: site visit). Body: J5b. */
export function hoursCharged(_s: EthicsState, _params: Params): HoursCharge[] {
  return [];
}

/** Gauge events of the choices and of the notes to the partner (§9, §10.2). Body: J5b. */
export function ethicsGaugeEvents(_s: GaugeHost, _ctx: GaugeContext): ProvidedGaugeEvent[] {
  return [];
}

/** Messages of the events (and of the confidences of the chief accountant). Body: J5b. */
export function ethicsMessages(_s: GameState, _ctx: MessageContext): Message[] {
  return [];
}

/** Deadlines of the events received and not answered, listed in the upcoming events (kind 'deadline'). Body: J5b. */
export function ethicsDeadlines(_s: GameState, _ctx: UpcomingContext): UpcomingEvent[] {
  return [];
}
