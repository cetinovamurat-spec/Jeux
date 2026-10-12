/** Anomaly modules: metadata, parts, negotiation profile and debrief; patches act on a WorldDraft. */
import type { ObjectRef } from '../../engine/types';
import type { Params } from '../params';
import type { ScenarioDatasets } from '../datasets';
import type { World } from '../../engine/types';
import type { WorldDraft } from './draft';

export const ANOMALY_IDS = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'A21', 'A22'] as const;
export type AnomalyId = (typeof ANOMALY_IDS)[number];

/** Part key: 'A01' (single-part anomaly) or 'A07.a' (one part of a multi-part anomaly). */
export type PartKey = string;

export type Cycle = 'crossCycle' | 'rentReceivables' | 'fixedAssets' | 'provisions' | 'debtTreasury' | 'purchases' | 'equitySubsidies' | 'disclosures';
export type Nature = 'occurrence' | 'completeness' | 'cutoff' | 'valuation' | 'classification' | 'presentation' | 'compliance';
export type Classification = 'factual' | 'judgemental' | 'projected';
export type Treatment = 'adjust' | 'reclassify' | 'disclose' | 'report' | 'specialReport' | 'governance';

export interface AnomalyPart {
  /** Full key ('A01', 'A07.a'). */
  id: PartKey;
  label: string;
  /** Matching signature of a finding (cycle, any-of objects, natures). */
  signature: { cycle: Cycle; objects: readonly ObjectRef[]; natures: readonly Nature[] };
  treatment: Treatment;
  /**
   * Accepted range for the result impact proposed by the player (euros,
   * overstatement positive). Absent: the computed impact ± 3 % (± 10 % for A08).
   */
  tolerance?: { minEuros: number; maxEuros: number };
  /** Correction without accounting entry (annex, management report, special report). */
  disclosureFix?: string;
}

export interface NegotiationStance {
  partId: PartKey;
  stance: 'accepts' | 'contests' | 'yieldsOnEvidence' | 'refuses';
  /** Who answers in the closing meeting. */
  character: 'cfo' | 'ceo' | 'chiefAccountant' | 'assetDirector';
  argument?: string;
  /** Evidence (document ids, see scenario/documents) that makes the client yield. */
  requiredEvidence?: readonly string[];
  /** The partner must take part in the meeting. */
  requiresPartner?: boolean;
}

export interface Debrief {
  explanation: string;
  /** Ids of params/references.json. */
  references: readonly string[];
  goodPractice: string;
  /** Effective procedures (ids of the procedure library, J4) described in words for now. */
  procedures: readonly string[];
}

export interface AnomalyContext {
  params: Params;
  clean: World;
  data: ScenarioDatasets;
  isActive(key: PartKey): boolean;
}

export interface AnomalyModule {
  id: AnomalyId;
  title: string;
  cycle: Cycle;
  assertions: readonly string[];
  classification: Classification;
  severity: 1 | 2 | 3;
  difficulty: 1 | 2 | 3;
  individuallySignificant?: boolean;
  parts: readonly AnomalyPart[];
  /** Transformation of the clean world into the presented world for the active parts (copy-on-write draft). */
  apply(draft: WorldDraft, ctx: AnomalyContext): void;
  stance: readonly NegotiationStance[];
  debrief: Debrief;
}
