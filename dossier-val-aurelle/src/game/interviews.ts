/**
 * Interviews and confrontation (plan J5 §5, §6, §7): sessions with the people
 * of the client, their dated and numbered actions (questions, pieces
 * presented, insistence, accusations) and the arc of the chief accountant.
 * Only the actions are stored, with the outcome fixed at the action; moods,
 * availability, answers, concessions and gauge effects are derived.
 *
 * Section of the game state: types, initial value, save schema. The rules
 * (availableQuestions, openSession, ask, present, insist, accuse,
 * closeSession, respondToConfidence, noteConfidence, concessions) and the
 * bodies of the providers below come with the interviews lot (J5b).
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';
import { interviewNoteId, PERSON_IDS, type PersonId, type QuestionKey, type TopicKey } from '../scenario/npc/keys';
import type { Params } from '../scenario/params';
import type { HoursCharge } from './budget';
import { evidenceSchema, type Evidence } from './evidence';
import type { GaugeContext, GaugeHost, ProvidedGaugeEvent } from './gauge-values';

export {
  decodeNoteObject,
  encodeNoteObject,
  interviewNoteId,
  isInterviewNoteId,
  isPersonId,
  parseQuestionKey,
  PERSON_IDS,
  questionKey,
  questionTopic,
  topicKey,
  type ParsedQuestion,
  type PersonId,
  type QuestionKey,
  type TopicKey,
} from '../scenario/npc/keys';

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type AnswerVariant = 'full' | 'partial' | 'redirect';
export type PresentOutcome = 'position' | 'defer' | 'concede' | 'reveal' | 'offTopic' | 'already';
export type SessionAudience = 'alone' | 'withCfo' | 'withPartner';

/** Action of a session; `seq` is the state counter at the action (order of the actions of a same day). */
export type InterviewAction =
  | { kind: 'ask'; seq: number; question: QuestionKey; variant: AnswerVariant }
  | { kind: 'present'; seq: number; topic: TopicKey; evidence: Evidence; outcome: PresentOutcome; exposes?: true }
  | { kind: 'insist'; seq: number; topic: TopicKey; outcome: 'moved' | 'holds' }
  | { kind: 'accuse'; seq: number; topic: TopicKey; founded: boolean };

export interface Session {
  id: string;
  seq: number;
  person: PersonId;
  on: IsoDate;
  audience: SessionAudience;
  actions: InterviewAction[];
  closed: boolean;
}

/** Choice or note of the player, dated and numbered. */
export interface DatedOption {
  on: IsoDate;
  seq: number;
  option: string;
}
export interface DatedText {
  on: IsoDate;
  seq: number;
  text: string;
}

export interface InterviewsState {
  sessions: Session[];
  /** Confidences of the chief accountant (§7.2), the treatment of the source (§7.3) and the note to the partner (§9). */
  karim?: { confidedOn: IsoDate; seq: number; response?: DatedOption; note?: DatedText };
}

export function initialInterviews(): InterviewsState {
  return { sessions: [] };
}

const person = z.enum(PERSON_IDS as unknown as [PersonId, ...PersonId[]]);
const action = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ask'), seq: z.number().int(), question: z.string(), variant: z.enum(['full', 'partial', 'redirect']) }),
  z.object({ kind: z.literal('present'), seq: z.number().int(), topic: z.string(), evidence: evidenceSchema, outcome: z.enum(['position', 'defer', 'concede', 'reveal', 'offTopic', 'already']), exposes: z.literal(true).optional() }),
  z.object({ kind: z.literal('insist'), seq: z.number().int(), topic: z.string(), outcome: z.enum(['moved', 'holds']) }),
  z.object({ kind: z.literal('accuse'), seq: z.number().int(), topic: z.string(), founded: z.boolean() }),
]);
const datedOption = z.object({ on: z.string(), seq: z.number().int(), option: z.string() });
const datedText = z.object({ on: z.string(), seq: z.number().int(), text: z.string() });

export const interviewsSchema = z.object({
  sessions: z.array(z.object({ id: z.string(), seq: z.number().int(), person, on: z.string(), audience: z.enum(['alone', 'withCfo', 'withPartner']), actions: z.array(action), closed: z.boolean() })),
  karim: z.object({ confidedOn: z.string(), seq: z.number().int(), response: datedOption.optional(), note: datedText.optional() }).optional(),
});

// ---------------------------------------------------------------------------
// derived
// ---------------------------------------------------------------------------

/**
 * Ids of the records of the answers derivable from the sessions (questions
 * answered, pieces that obtained a concession or revealed a fact): kept by
 * the cleaning of the orphans of a save (ui/app/orphans.ts → knownDocuments).
 */
export function interviewNoteIds(s: InterviewsState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const session of s.sessions)
    for (const a of session.actions) {
      if (a.kind === 'ask' && a.variant !== 'redirect') ids.add(interviewNoteId(a.question, session.on));
      else if (a.kind === 'present' && (a.outcome === 'concede' || a.outcome === 'reveal')) ids.add(interviewNoteId(`${session.person}:${a.topic}`, session.on));
    }
  return ids;
}

// ---------------------------------------------------------------------------
// providers (registries of game/budget.ts and game/gauge-values.ts)
// ---------------------------------------------------------------------------

/** Hours charged by the sessions (time of the senior per action, §5.1). Body: J5b. */
export function hoursCharged(_s: InterviewsState, _params: Params): HoursCharge[] {
  return [];
}

/** Gauge events of the sessions, the chief accountant's included (§7.1, §10.2). Body: J5b. */
export function interviewGaugeEvents(_s: GaugeHost, _ctx: GaugeContext): ProvidedGaugeEvent[] {
  return [];
}
