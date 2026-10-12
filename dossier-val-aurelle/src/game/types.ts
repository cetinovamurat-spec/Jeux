/**
 * Game-state types: everything the player does and that is saved.
 * Generated scenario data is never saved (it is deterministic).
 *
 * J0 draft, subject to validation.
 */
import type { Cents, IsoDate, JournalEntryDraft, ObjectRef } from '../engine/types';
import type {
  AnomalyId,
  Assertion,
  CharacterId,
  Classification,
  Cycle,
  DocumentId,
  EthicsEventId,
  FalseLeadId,
  GaugeId,
  MailId,
  Nature,
  Phase,
  ProcedureId,
  TeamMemberId,
  TeamReviewId,
} from '../scenario/types';

export type Difficulty = 'assistant' | 'senior' | 'manager';

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface MaterialityDecision {
  benchmark: 'rents' | 'revenue' | 'equity' | 'totalAssets' | 'netResult';
  overall: Cents; // seuil de signification
  performance: Cents; // seuil de planification
  clearlyTrivial: Cents; // seuil des anomalies manifestement insignifiantes
  specificThresholds: readonly { topic: string; amount: Cents }[];
  justification: string; // mandatory written justification (free text, not scored automatically)
  decidedOn: IsoDate;
}

export interface RiskAssessment {
  cycle: Cycle;
  assertion: Assertion;
  level: 'low' | 'moderate' | 'significant';
  fraudRisk: boolean;
  rationale: string;
}

export interface PlannedProcedure {
  procedureId: ProcedureId;
  assignee: TeamMemberId;
  plannedHours: number;
  phase: Phase;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ProcedureRun {
  id: string;
  procedureId: ProcedureId;
  assignee: TeamMemberId;
  startedOn: IsoDate;
  completedOn?: IsoDate;
  hoursSpent: number;
  /** Delegated work to review (T1–T4 or correct work). */
  review?: { teamReviewId?: TeamReviewId; decision?: 'accepted' | 'returned'; comment?: string };
}

export interface DocumentRequest {
  id: string;
  requestKey: string;
  to: CharacterId;
  sentOn: IsoDate;
  dueOn: IsoDate;
  reminders: readonly IsoDate[];
  receivedOn?: IsoDate;
}

export interface ConfirmationRequest {
  id: string;
  confirmationKey: string;
  thirdPartyId: string;
  content: 'balance' | 'loans' | 'litigation' | 'commitments' | 'transactions';
  preparedOn: IsoDate;
  sentOn?: IsoDate;
  reminders: readonly IsoDate[];
  replyOn?: IsoDate;
  alternativeProcedureRunId?: string;
}

export interface DocumentState {
  receivedOn: IsoDate;
  read: boolean;
  annotations: readonly { anchor?: string; text: string; createdOn: IsoDate }[];
}

export interface Worksheet {
  id: string;
  cycle: Cycle;
  /** Lead schedule (feuille maîtresse): figures are pulled from the engine, never typed. */
  workReferences: readonly string[];
  conclusion?: string;
}

// ---------------------------------------------------------------------------
// Findings and matching
// ---------------------------------------------------------------------------

export type EvidenceRef =
  | { kind: 'document'; docId: DocumentId; anchor?: string }
  | { kind: 'fecEntry'; entryId: string }
  | { kind: 'computation'; runId: string }
  | { kind: 'dataView'; view: string; selector: string };

export type FindingStatus =
  | 'question' // open question: never counted as a false positive
  | 'open'
  | 'submitted' // presented to the client
  | 'corrected'
  | 'uncorrected'
  | 'withdrawn';

export interface Finding {
  id: string;
  createdOn: IsoDate;
  cycle: Cycle;
  objects: readonly ObjectRef[];
  nature: Nature;
  classification: Classification;
  proposedImpacts: { result?: Cents; equity?: Cents; balanceSheet?: Cents };
  proposedEntry?: JournalEntryDraft;
  evidence: readonly EvidenceRef[];
  status: FindingStatus;
}

/** Computed by game/matching.ts; hidden from the player until the debrief. */
export interface MatchResult {
  findingId: string;
  target:
    | { kind: 'anomaly'; id: AnomalyId; partId: string }
    | { kind: 'falseLead'; id: FalseLeadId }
    | { kind: 'none' };
  amountCredit: 'full' | 'partial' | 'none' | 'notApplicable';
}

// ---------------------------------------------------------------------------
// Completion: negotiation, opinion, communications
// ---------------------------------------------------------------------------

export interface NegotiationRound {
  findingId: string;
  with: CharacterId;
  on: IsoDate;
  outcome: 'accepted' | 'contested' | 'yielded' | 'refused';
  escalatedToPartner: boolean;
}

export type Opinion =
  | { kind: 'unmodified' }
  | { kind: 'qualified'; basis: readonly ('disagreement' | 'limitation')[] }
  | { kind: 'disclaimer'; basis: 'disagreement' | 'limitation' | 'multipleUncertainties' };

export interface ReportingDraft {
  opinion: Opinion;
  emphasisOfMatter: readonly string[]; // observations
  keyAssessments: readonly string[]; // justification des appréciations (2–3 topics)
  specificVerifications: readonly string[]; // rapport de gestion, délais de paiement…
  specialReportItems: readonly string[]; // conventions réglementées
  representationLetterPoints: readonly string[];
  governanceCommunications: readonly string[]; // NEP 260
  internalControlLetterItems: readonly string[]; // NEP 265
  irregularitiesReported: readonly string[];
  signedOn?: IsoDate;
}

// ---------------------------------------------------------------------------
// Messaging, events, state
// ---------------------------------------------------------------------------

export interface MailState {
  mailId: MailId;
  deliveredOn: IsoDate;
  read: boolean;
}

/** Append-only journal used for the debrief chronology and for replays. */
export interface GameEvent {
  on: IsoDate;
  type: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface GameState {
  schemaVersion: number;
  scenarioId: string;
  /** Hash of the generated scenario: a save made on another scenario build triggers a warning. */
  scenarioHash: string;
  difficulty: Difficulty;
  clock: { date: IsoDate; phase: Phase };
  hours: Record<TeamMemberId, { budget: number; spent: number }>;
  gauges: Record<GaugeId, number>;
  materiality?: MaterialityDecision;
  risks: readonly RiskAssessment[];
  program: readonly PlannedProcedure[];
  runs: readonly ProcedureRun[];
  requests: readonly DocumentRequest[];
  confirmations: readonly ConfirmationRequest[];
  documents: Readonly<Record<DocumentId, DocumentState>>;
  worksheets: readonly Worksheet[];
  findings: readonly Finding[];
  negotiation: readonly NegotiationRound[];
  ethics: Readonly<Partial<Record<EthicsEventId, string>>>; // choice id
  reporting?: ReportingDraft;
  mails: readonly MailState[];
  flags: Readonly<Record<string, boolean>>;
  journal: readonly GameEvent[];
  designer: { enabled: boolean; activeAnomalies?: readonly AnomalyId[] };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export type SaveSlot = 'auto' | 1 | 2 | 3;

export interface SaveFile {
  format: 'dossier-val-aurelle/save';
  schemaVersion: number;
  savedAt: string; // ISO timestamp
  slot: SaveSlot;
  state: GameState;
}

export interface Migration {
  from: number;
  to: number;
  migrate(state: unknown): unknown;
}
