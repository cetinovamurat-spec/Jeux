/**
 * Escalations to the partner (plan J5 §10.3, J5-19): timely or weak
 * escalations, late surprises at the partner's review of the file, and her
 * answers (acknowledgement; the answer of §6.6 for a suspicion or a
 * governance treatment). Derived from the findings and their frozen
 * escalation snapshots (game/findings.ts → Finding.escalation).
 *
 * The bodies of the providers below come with the interviews lot (J5b).
 */
import type { GaugeContext, GaugeHost, ProvidedGaugeEvent } from './gauge-values';
import type { Message, MessageContext } from './messages';
import type { GameState } from './state';

/** Gauge events of the escalations (timelyEscalation, weakEscalation, lateSurprise). Body: J5b. */
export function escalationGaugeEvents(_s: GaugeHost, _ctx: GaugeContext): ProvidedGaugeEvent[] {
  return [];
}

/** Answers of the partner to the escalations. Body: J5b. */
export function escalationMessages(_s: GameState, _ctx: MessageContext): Message[] {
  return [];
}
