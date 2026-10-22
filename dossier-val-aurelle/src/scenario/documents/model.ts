/**
 * Document model: structured content rendered by the UI (J3) as a realistic
 * document (header, references, signatures, « Reçu le » stamp). Every amount
 * and date comes from the generated world or from the parameters.
 */
import type { IsoDate } from '../../engine/dates';
import type { AnomalyId, PartKey } from '../anomalies/types';

export type FalseLeadId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';
export type ClueTarget = AnomalyId | FalseLeadId;

/** Where a clue comes from: two clues are independent when their documents and sources differ. */
export type ClueSource = 'governance' | 'accounting' | 'management' | 'contract' | 'thirdParty' | 'internal' | 'regulatory' | 'press';

export interface Clue {
  id: string;
  target: ClueTarget;
  /** Parts of the anomaly the clue points to (all parts when absent). */
  parts?: readonly PartKey[];
  documentId: string;
  source: ClueSource;
  /** What the clue shows, in one sentence (debrief, review pack, designer mode). */
  text: string;
}

export type Block =
  | { kind: 'heading'; text: string; clue?: string }
  | { kind: 'paragraph'; text: string; clue?: string }
  | { kind: 'fields'; rows: readonly { label: string; value: string; clue?: string }[] }
  | { kind: 'table'; title?: string; columns: readonly string[]; align?: readonly ('left' | 'right')[]; rows: readonly { cells: readonly string[]; clue?: string }[]; footer?: readonly string[] }
  | { kind: 'list'; items: readonly { text: string; clue?: string }[] }
  | { kind: 'signature'; name: string; role: string; date?: string }
  | { kind: 'stamp'; text: string; date: string; clue?: string }
  | { kind: 'note'; text: string; clue?: string };

export type DocumentCategory = 'permanent' | 'governance' | 'accounting' | 'contracts' | 'mail' | 'internal' | 'thirdParty';

/** People of the client who answer the requests of the auditor (params/documents.json → people, params/requests.json). */
export type Interlocutor = 'cfo' | 'chiefAccountant' | 'assetDirector' | 'rentManager' | 'ceo';

/**
 * Given only in reply to a request (plan J4 §8): a request of the family
 * `family` (params/requests.json) about the object `object` ('' when the
 * family has none); `also` lists other objects of the family the document
 * answers as well (a document shared by several third parties). The reply
 * reaches the auditor `from`'s delay after the request, and never before the
 * date of the document. `request` is the label of the request (designer
 * mode, review pack).
 *
 * A document without `family` is a legacy one (J3), answered by the label
 * `request`: buildDocuments maps every catalogue document to its family and
 * object.
 *
 * `rebuiltOnRequest` marks the reference version of a scenario reply that is
 * rebuilt on the date of each request (families dated on the request,
 * replies.ts → REQUEST_DATED_FAMILIES): it carries the clues (designer mode,
 * review pack, matching) and is never shown as such; the player receives the
 * version built for the request, under the same id. `asOf` is the date of
 * the request a reply dated on the request was built for: only the requests
 * sent that day serve it.
 */
export interface OnRequestAvailability {
  kind: 'onRequest';
  request: string;
  from: Interlocutor;
  family?: string;
  object?: string;
  also?: readonly string[];
  rebuiltOnRequest?: true;
  asOf?: IsoDate;
}

export type Availability =
  /** In the data room from the start of the engagement. */
  | { kind: 'initial' }
  | OnRequestAvailability
  /**
   * Reply of a third party to a confirmation request: `request` is the id of
   * the third party (key of the confirmations sent by the player), `label` its
   * name; the reply arrives on `arrives` if the request was sent.
   */
  | { kind: 'confirmation'; request: string; label?: string; arrives: IsoDate }
  /** Mail received after the year end, available from a date of the game calendar. */
  | { kind: 'afterDate'; from: IsoDate }
  /** Revealed only when a condition of the game is met (e.g. the chief accountant confides). */
  | { kind: 'conditional'; condition: 'chiefAccountantConfides' | 'tenantAssociationContact' };

export interface DocumentModel {
  id: string;
  title: string;
  category: DocumentCategory;
  date: IsoDate;
  issuer: string;
  recipient?: string;
  reference?: string;
  /** Realistic noise (no clue). */
  noise?: boolean;
  availability: Availability;
  blocks: readonly Block[];
  clues: readonly Clue[];
}

/** Separator of the request date in the id of an updated reply (`ventes-coquelicots~2026-02-23`); never used by a catalogue id. */
const VERSION_SEPARATOR = '~';

/** Id of the updated version of a reply, built for a later request of the same object sent on `asOf`. */
export function versionedId(id: string, asOf: IsoDate): string {
  return `${id}${VERSION_SEPARATOR}${asOf}`;
}

/** Id of the document an updated reply is a version of (the id itself otherwise): the object the matching knows. */
export function baseDocumentId(id: string): string {
  const i = id.indexOf(VERSION_SEPARATOR);
  return i < 0 ? id : id.slice(0, i);
}

/** Key of a request: 'family' or 'family:object'. */
export function requestKey(family: string, object: string): string {
  return object ? `${family}:${object}` : family;
}

/** Request keys a document answers (none for a document that is not given on request, or a legacy one). */
export function onRequestKeys(a: Availability): string[] {
  if (a.kind !== 'onRequest' || a.family === undefined) return [];
  return [requestKey(a.family, a.object ?? ''), ...(a.also ?? []).map((o) => requestKey(a.family!, o))];
}
