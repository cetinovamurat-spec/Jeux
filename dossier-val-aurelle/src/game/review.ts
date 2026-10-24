/**
 * Team: delegated work, review and briefings (plan J5 §8). The review rounds
 * (`Execution.reviewRounds`), the frozen inputs of a delegated launch
 * (`Execution.member`) and the briefings (`ProgramState.briefings`) are
 * stored in the programme section (game/program.ts); the status of a review
 * is derived there (reviewStatus).
 *
 * The rules (variantOf, memberWork, memberFlags, acceptWorksheet,
 * returnWorksheet, briefMember, reviewNotes, leaHints) and the bodies of the
 * providers below come with the team lot (J5c).
 */
import type { Params } from '../scenario/params';
import type { HoursCharge } from './budget';
import type { GaugeContext, GaugeHost, ProvidedGaugeEvent } from './gauge-values';
import type { Message, MessageContext } from './messages';
import type { ProgramState } from './program';
import type { GameState } from './state';

/** Hours charged by the review decisions and the briefings (time of the senior) and by the rework of the members. Body: J5c. */
export function hoursCharged(_s: ProgramState, _params: Params): HoursCharge[] {
  return [];
}

/** Gauge events of the partner's review notes of 16/03 (reviewError). Body: J5c. */
export function reviewGaugeEvents(_s: GaugeHost, _ctx: GaugeContext): ProvidedGaugeEvent[] {
  return [];
}

/** Messages of the team: deliveries, rework, review notes, hints of Léa. Body: J5c. */
export function teamMessages(_s: GameState, _ctx: MessageContext): Message[] {
  return [];
}
