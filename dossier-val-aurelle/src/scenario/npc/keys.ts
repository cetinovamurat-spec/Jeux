/**
 * Keys of the interviews (plan J5 §5, §6, §14): who is asked, about what, and
 * the id of the record of the answer. Contracts shared by the scenario
 * content (questions, answers, records built by buildDocuments) and the
 * rules (game/interviews.ts, orphans of a save).
 *
 * - `QuestionKey` = 'person:family' or 'person:family:object'. The object
 *   may itself contain ':' (a FEC entry '2025:OD000189'): parseQuestionKey
 *   splits on the first two ':' only.
 * - `TopicKey` = 'family' or 'family:object': the subject of a confrontation,
 *   common to the chain of people.
 * - The record of an answer is a working paper whose id is the encoded base
 *   object, the version (date of the session) last:
 *   `entretien-<person>-<family>[-<object>]~<date>`, so that
 *   baseDocumentId gives the record of the question and versionedId the
 *   record of a session.
 */
import type { IsoDate } from '../../engine/dates';
import { baseDocumentId, versionedId, type Interlocutor } from '../documents/model';

/** People of the client who can be interviewed: the interlocutors of the requests and the chairman of the board. */
export type PersonId = Interlocutor | 'chairman';
export const PERSON_IDS: readonly PersonId[] = ['ceo', 'cfo', 'chiefAccountant', 'assetDirector', 'rentManager', 'chairman'];

export function isPersonId(id: string): id is PersonId {
  return (PERSON_IDS as readonly string[]).includes(id);
}

/** 'person:family' or 'person:family:object'. */
export type QuestionKey = string;
/** 'family' or 'family:object'. */
export type TopicKey = string;

export interface ParsedQuestion {
  person: string;
  family: string;
  /** Object of the question, absent for a family without object. */
  object?: string;
}

/** Key of a question (an empty object is no object). */
export function questionKey(person: PersonId, family: string, object?: string): QuestionKey {
  return object ? `${person}:${family}:${object}` : `${person}:${family}`;
}

/** Splits a question key on its first two ':' (the object keeps its own). Null when the key has no family. */
export function parseQuestionKey(key: QuestionKey): ParsedQuestion | null {
  const i = key.indexOf(':');
  if (i <= 0) return null;
  const j = key.indexOf(':', i + 1);
  const person = key.slice(0, i);
  const family = j < 0 ? key.slice(i + 1) : key.slice(i + 1, j);
  if (!family) return null;
  const object = j < 0 ? '' : key.slice(j + 1);
  return object ? { person, family, object } : { person, family };
}

/** Key of a topic (an empty object is no object). */
export function topicKey(family: string, object?: string): TopicKey {
  return object ? `${family}:${object}` : family;
}

/** Topic of a question: its family and object, without the person. */
export function questionTopic(key: QuestionKey): TopicKey | null {
  const q = parseQuestionKey(key);
  return q ? topicKey(q.family, q.object) : null;
}

// ---------------------------------------------------------------------------
// records of the answers
// ---------------------------------------------------------------------------

/** Prefix of the ids of the interview records. */
export const INTERVIEW_NOTE_PREFIX = 'entretien-';

/**
 * Object of a question encoded for a document id: without ':' (key
 * separator) nor '~' (version separator). '_' escapes: '_' → '__',
 * ':' → '_c', '~' → '_t'. Reversible (decodeNoteObject).
 */
export function encodeNoteObject(object: string): string {
  return object.replace(/[_:~]/g, (ch) => (ch === '_' ? '__' : ch === ':' ? '_c' : '_t'));
}

export function decodeNoteObject(encoded: string): string {
  return encoded.replace(/_(.)/g, (_m, ch: string) => (ch === '_' ? '_' : ch === 'c' ? ':' : ch === 't' ? '~' : `_${ch}`));
}

/**
 * Id of the record of the answer to a question in a session on `on`: the
 * object reduced to its base (a later version of a document is the document
 * itself, `baseDocumentId`) and encoded, the date last (`versionedId`).
 */
export function interviewNoteId(question: QuestionKey, on: IsoDate): string {
  const q = parseQuestionKey(question);
  if (!q) throw new Error(`clé de question invalide : ${question}`);
  const object = q.object === undefined ? undefined : q.family === 'document' ? baseDocumentId(q.object) : q.object;
  const base = `${INTERVIEW_NOTE_PREFIX}${q.person}-${q.family}${object ? `-${encodeNoteObject(object)}` : ''}`;
  return versionedId(base, on);
}

/** The id is the record of an interview (any person, question and date). */
export function isInterviewNoteId(id: string): boolean {
  return id.startsWith(INTERVIEW_NOTE_PREFIX) && id.includes('~');
}
