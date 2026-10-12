/**
 * Scenario-layer types: anomaly modules, clues, documents, characters,
 * procedures and the condition/effect mini-language shared with the game.
 *
 * J0 draft, subject to validation. Runtime JSON content is validated with Zod
 * schemas mirroring these types (src/scenario/schema/).
 */
import type { Cents, EntryId, FiscalYear, IsoDate, JournalEntry, JournalEntryDraft, ObjectRef, World } from '../engine/types';
import type { ScenarioDatasets } from './datasets';

type AnnexTableId = string;
type StatementLineId = string;
type Datasets = ScenarioDatasets;
type DatasetName = keyof ScenarioDatasets;

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type AnomalyId =
  | 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09' | 'A10' | 'A11'
  | 'A12' | 'A13' | 'A14' | 'A15' | 'A16' | 'A17' | 'A18' | 'A19' | 'A20' | 'A21' | 'A22';
export type FalseLeadId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';
export type TeamReviewId = 'T1' | 'T2' | 'T3' | 'T4';
export type EthicsEventId = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'EK';

export type DocumentId = string;
export type CharacterId = string;
export type ProcedureId = string;
export type DataViewId = string;
export type MailId = string;
export type EventId = string;
export type DialogueNodeId = string;

export type TeamMemberId = 'senior' | 'lea' | 'hugo' | 'sofia';
export type GaugeId = 'clientRelation' | 'partnerTrust' | 'karimTrust';
export type Phase =
  | 'acceptance'
  | 'understanding'
  | 'materiality'
  | 'riskAssessment'
  | 'planning'
  | 'interim'
  | 'final'
  | 'completion'
  | 'reporting'
  | 'debrief';

// ---------------------------------------------------------------------------
// Audit vocabulary
// ---------------------------------------------------------------------------

export type Cycle =
  | 'crossCycle' // transverse
  | 'rentReceivables' // loyers et créances
  | 'fixedAssets' // immobilisations et investissements
  | 'provisions'
  | 'debtTreasury' // dettes financières et trésorerie
  | 'purchases' // achats et charges
  | 'equitySubsidies' // capitaux propres et subventions
  | 'disclosures'; // annexe, hors bilan, rapport de gestion

/** Assertions (NEP 315 vocabulary). */
export type Assertion =
  | 'occurrence' // réalité
  | 'completeness' // exhaustivité
  | 'accuracy' // mesure
  | 'cutoff' // séparation des exercices
  | 'classification' // classification
  | 'existence'
  | 'rightsObligations' // droits et obligations
  | 'valuation' // évaluation
  | 'presentation'; // présentation et information

/** Nature of a finding (§10.6) — used for matching, never free text. */
export type Nature =
  | 'occurrence'
  | 'completeness'
  | 'cutoff'
  | 'valuation'
  | 'classification'
  | 'presentation'
  | 'compliance';

export type Classification = 'factual' | 'judgemental' | 'projected'; // factuelle / de jugement / extrapolée

// ---------------------------------------------------------------------------
// Scenario context given to modules
// ---------------------------------------------------------------------------

export interface ScenarioParams {
  regulatory: Record<string, unknown>; // params/regulatory.json (Zod-validated)
  calibration: Record<string, unknown>; // params/calibration.json
  scoring: Record<string, unknown>; // params/scoring.json
  game: Record<string, unknown>; // params/game.json
}

export interface ScenarioContext {
  /** Clean world (comptes propres) — read-only. */
  clean: World;
  params: ScenarioParams;
  /** Deterministic helpers (prorata, depreciation, ICNE, entry builders). */
  helpers: ScenarioHelpers;
}

export interface ScenarioHelpers {
  prorataDays(from: IsoDate, to: IsoDate, base?: 365 | 366): number;
  depreciation(componentId: string, from: IsoDate, to: IsoDate, world?: World): Cents;
  entry(draft: JournalEntryDraft, meta: { id: EntryId; validDate: IsoDate; enteredBy: string; sourceId: string }): JournalEntry;
}

// ---------------------------------------------------------------------------
// Patches: clean world → presented world
// ---------------------------------------------------------------------------

export type DatasetChange =
  | { kind: 'upsert'; records: readonly { id: string }[] }
  | { kind: 'remove'; ids: readonly string[] }
  | { kind: 'update'; id: string; fields: Readonly<Record<string, unknown>> };

export type PatchOp =
  | { op: 'removeEntries'; ids: readonly EntryId[] }
  | { op: 'addEntries'; entries: readonly JournalEntry[] }
  | { op: 'replaceEntry'; id: EntryId; entry: JournalEntry }
  | { op: 'dataset'; dataset: DatasetName; change: DatasetChange }
  | { op: 'reclassify'; account: string; to: StatementLineId; years: readonly FiscalYear[] }
  | { op: 'annexCell'; table: AnnexTableId; rowId: string; column: number; transform: { kind: 'transposeDigits'; positions: readonly [number, number] } | { kind: 'omit' } }
  | { op: 'document'; docId: DocumentId; change: DocumentChange };

export type DocumentChange =
  | { kind: 'omitSection'; sectionId: string }
  | { kind: 'overrideField'; fieldId: string; source: ValueSource };

/** A value shown in a document always comes from a selector over a world, never from a literal. */
export type ValueSource =
  | { kind: 'presented'; selector: string }
  | { kind: 'clean'; selector: string }
  | { kind: 'dataset'; dataset: keyof Datasets; id: string; field: string }
  | { kind: 'constantCount'; value: number }; // counts (e.g. "0 facture échue"), never amounts

// ---------------------------------------------------------------------------
// Anomaly modules (clé de correction)
// ---------------------------------------------------------------------------

export interface Signature {
  cycle: Cycle;
  /** Any-of: the finding must reference at least one of these objects. */
  objects: readonly ObjectRef[];
  natures: readonly Nature[];
}

/** Sub-item of an anomaly that is matched and scored separately (e.g. A07 a/b, A14 i/ii/iii). */
export interface AnomalyPart {
  id: string;
  label: string;
  signature: Signature;
  expectedTreatment: 'adjust' | 'reclassify' | 'disclose' | 'report' | 'specialReport' | 'governanceCommunication';
  /** Acceptable range for the proposed result impact, computed from the engine (null = no amount expected). */
  tolerance(ctx: ScenarioContext): { min: Cents; max: Cents } | null;
}

export type StanceKind = 'accepts' | 'contests' | 'yieldsOnEvidence' | 'refuses';

export interface NegotiationProfile {
  /** One stance per part when parts differ (A07: accepts b, contests a). */
  byPart: Readonly<Record<string, {
    stance: StanceKind;
    argument?: string;
    /** Evidence that must be linked to the finding for the client to yield. */
    requiredEvidence?: readonly DocumentId[];
    requiresPartnerEscalation?: boolean;
  }>>;
}

export interface Debrief {
  explanation: string;
  /** Free-form references; precise article/paragraph numbers only if listed in params/regulatory.json. */
  references: readonly string[];
  goodPractice: string;
  effectiveProcedures: readonly ProcedureId[];
}

export interface AnomalyModule {
  id: AnomalyId;
  title: string;
  cycle: Cycle;
  assertions: readonly Assertion[];
  classification: Classification;
  severity: 1 | 2 | 3;
  difficulty: 1 | 2 | 3;
  /** Canonical correction order: corrections of these anomalies are posted first (A16 after A01). */
  after?: readonly AnomalyId[];
  /**
   * Pure: returns the ops turning the clean world into the presented world.
   * `active` = set of anomalies applied together (designer mode, negotiation
   * outcomes), so that interacting anomalies stay consistent.
   */
  patch(ctx: ScenarioContext, active: ReadonlySet<AnomalyId>): readonly PatchOp[];
  /** Expected correcting entries on the presented world (canonical order). */
  correctingEntries(ctx: ScenarioContext): readonly JournalEntryDraft[];
  parts: readonly AnomalyPart[];
  clues: readonly ClueRef[];
  clientStance: NegotiationProfile;
  debrief: Debrief;
  // Impacts (result, equity, CAF, balance sheet) are COMPUTED by the engine, never declared here.
}

export interface FalseLeadModule {
  id: FalseLeadId;
  title: string;
  cycle: Cycle;
  signature: Signature;
  /** Evidence that justifies dismissing the lead (rewarded when linked). */
  dismissalEvidence: readonly ClueRef[];
  /** F4: an unfounded accusation hurts the client relationship badly. */
  accusationSensitivity: 'normal' | 'high';
  debrief: Debrief;
}

// ---------------------------------------------------------------------------
// Clues (indices)
// ---------------------------------------------------------------------------

export type ClueSource =
  | { kind: 'document'; docId: DocumentId; anchor: string }
  | { kind: 'data'; view: DataViewId; selector: string };

export interface ClueRef {
  id: string; // e.g. 'A01-c1'
  targetId: AnomalyId | FalseLeadId;
  source: ClueSource;
  /** Two clues of the same anomaly must belong to different groups ("indices indépendants"). */
  independenceGroup: string;
  revealedBy: readonly ProcedureId[];
  availability?: Condition;
}

// ---------------------------------------------------------------------------
// Documents: data-driven templates rendering a structured content model
// ---------------------------------------------------------------------------

export type DocumentCategory =
  | 'permanent'
  | 'governance'
  | 'accounting'
  | 'contracts'
  | 'mail'
  | 'internalEmails'
  | 'thirdPartyReplies';

export type Availability =
  | { kind: 'initial' }
  | { kind: 'onRequest'; requestKey: string; from: CharacterId; delayDays?: number }
  | { kind: 'thirdPartyReply'; confirmationKey: string; delayDays: number; noReply?: boolean }
  | { kind: 'conditional'; condition: Condition };

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'money'; value: Cents }
  | { kind: 'date'; value: IsoDate }
  | { kind: 'count'; value: number }
  | { kind: 'percent'; value: number; decimals: number }
  | { kind: 'anchor'; id: string; children: readonly Inline[] }
  | { kind: 'emphasis'; children: readonly Inline[] };

export type DocBlock =
  | { kind: 'letterhead'; organisation: string; reference?: string }
  | { kind: 'heading'; level: 1 | 2 | 3; inlines: readonly Inline[] }
  | { kind: 'paragraph'; inlines: readonly Inline[]; sectionId?: string }
  | { kind: 'list'; ordered: boolean; items: readonly (readonly Inline[])[] }
  | { kind: 'table'; anchor?: string; columns: readonly string[]; rows: readonly (readonly Inline[])[] }
  | { kind: 'signature'; name: string; title: string }
  | { kind: 'stamp'; label: string; date: IsoDate }
  | { kind: 'pageBreak' };

export interface DocContent {
  blocks: readonly DocBlock[];
}

/** Read-only view of the presented world (+ clean world for third-party replies). */
export interface WorldView {
  presented: World;
  clean: World;
  select(selector: string): Cents;
}

export interface DocumentDef {
  id: DocumentId;
  title: string;
  category: DocumentCategory;
  noise: boolean;
  availability: Availability;
  build(view: WorldView): DocContent;
}

// ---------------------------------------------------------------------------
// Conditions and effects (serialisable mini-language)
// ---------------------------------------------------------------------------

export type Condition =
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { not: Condition }
  | { flag: string }
  | { docRead: DocumentId }
  | { procedureDone: ProcedureId }
  | { findingOn: AnomalyId | FalseLeadId }
  | { evidenceLinked: { docId: DocumentId; to: AnomalyId | FalseLeadId } }
  | { dateFrom: IsoDate }
  | { phase: Phase }
  | { gauge: GaugeId; gte?: number; lte?: number };

export type Effect =
  | { setFlag: string }
  | { gauge: GaugeId; delta: number }
  | { unlockDocument: DocumentId; delayDays?: number }
  | { sendMail: MailId; delayDays?: number }
  | { scheduleEvent: EventId; delayDays?: number }
  | { spendHours: { member: TeamMemberId; hours: number } };

// ---------------------------------------------------------------------------
// Characters and dialogues
// ---------------------------------------------------------------------------

export interface CharacterSheet {
  id: CharacterId;
  name: string;
  role: string;
  organisation: 'sequana' | 'valAurelle' | 'thirdParty';
  personality: string;
  knowledge: readonly string[];
  secrets: readonly { id: string; description: string; revealCondition: Condition; effects: readonly Effect[] }[];
  /** Effects on the client relationship of the player's tone (aggressive, insistent…). */
  sensitivity: { insistenceCost: number; accusationCost: number };
  replyDelayDays: number;
  portrait: { seed: number; palette: string };
}

export interface DialogueOption {
  id: string;
  label: string;
  condition?: Condition;
  effects?: readonly Effect[];
  next?: DialogueNodeId;
}

export interface DialogueNode {
  id: DialogueNodeId;
  speaker: CharacterId;
  /** Text template; amounts are inserted through {{selector}} placeholders resolved on the world. */
  text: string;
  mood?: 'neutral' | 'friendly' | 'tense' | 'defensive' | 'relieved';
  options: readonly DialogueOption[];
}

export interface ConfrontationRule {
  characterId: CharacterId;
  topic: AnomalyId | FalseLeadId;
  evidence: { docId: DocumentId; anchor?: string } | { fecEntryOf: AnomalyId };
  reaction: 'concede' | 'nuance' | 'reveal';
  line: string;
  effects: readonly Effect[];
}

// ---------------------------------------------------------------------------
// Procedures, team reviews, ethics
// ---------------------------------------------------------------------------

export type ProcedureOutput =
  | { kind: 'unlockDocument'; docId: DocumentId }
  | { kind: 'dataView'; view: DataViewId }
  | { kind: 'worksheet'; templateId: string }
  | { kind: 'tool'; tool: 'sampling' | 'recalcDepreciation' | 'recalcIcne' | 'recalcAllowance' | 'recalcPge' | 'prorata' | 'fecExplorer' | 'tickMarks' }
  | { kind: 'effect'; effect: Effect };

export interface ProcedureDef {
  id: ProcedureId;
  cycle: Cycle;
  title: string;
  objective: string;
  assertions: readonly Assertion[];
  /** Hours by profile; absent profile = cannot perform. */
  cost: Partial<Record<TeamMemberId, number>>;
  phases: readonly Phase[];
  prerequisites?: Condition;
  outputs: readonly ProcedureOutput[];
  /** Mandatory diligence (subsequent events, representation letter, JET, prior-year comparatives…). */
  mandatory?: boolean;
  /** Delegated execution produces a worksheet to review; T1–T4 are scripted flawed outputs. */
  teamReview?: TeamReviewId;
}

export interface TeamReviewScenario {
  id: TeamReviewId;
  author: 'lea' | 'hugo';
  procedureId: ProcedureId;
  flaw: string;
  linkedAnomaly: AnomalyId;
  acceptableReturnReasons: readonly string[];
}

export interface EthicsEvent {
  id: EthicsEventId;
  trigger: Condition;
  channel: { mail: MailId } | { dialogue: DialogueNodeId };
  choices: readonly { id: string; label: string; expected: boolean; effects: readonly Effect[] }[];
}
