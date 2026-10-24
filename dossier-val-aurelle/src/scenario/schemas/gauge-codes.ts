/**
 * Gauges and reason codes of the gauge events (plan J5 §10.2): one shared
 * enumeration, read by the rules (game/gauges.ts, game/gauge-values.ts) and by
 * the schema of the effects scale (params/gauges.json). Scenario layer, so
 * that the parameter schemas can import it.
 */

export const GAUGE_IDS = ['clientRelation', 'partnerTrust', 'karimTrust'] as const;
export type GaugeId = (typeof GAUGE_IDS)[number];

/**
 * Reason codes of the gauge events. The first five are recorded by J4
 * (requests, planning, budget, aid); the others are derived by the providers
 * of J5 (interviews, ethics, escalations, review).
 */
export const GAUGE_CODES = [
  // J4 (stored events)
  'duplicateRequest',
  'unrelatedRequest',
  'interimWithoutPlanning',
  'unjustifiedOverrun',
  'aidUsed',
  // interviews and confrontation
  'insist',
  'offTopicEvidence',
  'accusation',
  'unfoundedAccusation',
  'concessionObtained',
  'calmSession',
  'relationRecovery',
  'weakPartnerMeeting',
  // chief accountant
  'oneToOne',
  'karimCleared',
  'karimDuplicate',
  'publicBlame',
  'sourceProtected',
  'sourceExposed',
  // ethics
  'courtesyAccepted',
  'bluntRefusal',
  'ethicsReported',
  'needlessReport',
  // escalations and review
  'timelyEscalation',
  'weakEscalation',
  'lateSurprise',
  'reviewError',
] as const;
export type GaugeCode = (typeof GAUGE_CODES)[number];

export function isGaugeCode(code: string): code is GaugeCode {
  return (GAUGE_CODES as readonly string[]).includes(code);
}
