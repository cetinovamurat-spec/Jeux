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

/**
 * Measure on which the quantification of a finding is credited (plan J4
 * §13.2): the result impact (adjustments), the equity impact (A09), the
 * amount reclassified (sum of the debits of the correction entry: A01 for the
 * reclassification, A07.c, A18, A16.a for the debt) or the disclosure (no
 * amount: signature, treatment, expected fix and evidence).
 */
export type CreditBasis = 'result' | 'equity' | 'reclassified' | 'disclosure';

/** Object of a finding that has no counterpart in the engine's ObjectRef: an item of the annex or of the management report (params/disclosure-items.json). */
export interface DisclosureItemRef {
  kind: 'disclosureItem';
  id: string;
}
export type PartObject = ObjectRef | DisclosureItemRef;

export interface AnomalyPart {
  /** Full key ('A01', 'A07.a'). */
  id: PartKey;
  label: string;
  /** Matching signature of a finding (cycle, any-of objects, natures). */
  signature: { cycle: Cycle; objects: readonly ObjectRef[]; natures: readonly Nature[] };
  treatment: Treatment;
  /**
   * Cycles under which a finding about this part is accepted (J4-12): the
   * signature's cycle first, then the alternatives.
   */
  cycles: readonly Cycle[];
  /**
   * Discriminating objects: when sibling parts (or neighbouring anomalies)
   * share their objects, a finding must name or link at least one of them.
   * They also count as objects of the part.
   */
  keyObjects?: readonly PartObject[];
  /** Items of the annex or of the management report concerned (ids of params/disclosure-items.json → items); they count as objects. */
  disclosureItems?: readonly string[];
  /** Measures on which the quantification is credited: the first is the main one, the others are accepted alternatives. */
  creditBasis: readonly CreditBasis[];
  /**
   * Accepted range for the measure proposed by the player, as shares of the
   * computed measure of the part (estimates: A07.a). It widens the default
   * tolerance (max of ± params tolerance % and the reference clearly-trivial
   * threshold), never replaces it by euros.
   */
  toleranceShare?: { min: number; max: number };
  /**
   * @deprecated Euro range of J2, kept only for the J2 impact test and the
   * review pack; the matching reads `toleranceShare`.
   */
  tolerance?: { minEuros: number; maxEuros: number };
  /** Correction without accounting entry (annex, management report, special report). */
  disclosureFix?: string;
  /** Fixes of the findings form that answer the part (ids of params/disclosure-items.json → fixes). */
  expectedFixes?: readonly string[];
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
