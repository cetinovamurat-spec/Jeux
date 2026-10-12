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

export type Availability =
  /** In the data room from the start of the engagement. */
  | { kind: 'initial' }
  /** Given only on a precise request (request label shown in the request list). */
  | { kind: 'onRequest'; request: string; from: 'cfo' | 'chiefAccountant' | 'assetDirector' | 'rentManager' | 'ceo' }
  /** Reply of a third party to a confirmation request sent by the player. */
  | { kind: 'confirmation'; request: string; arrives: IsoDate }
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
