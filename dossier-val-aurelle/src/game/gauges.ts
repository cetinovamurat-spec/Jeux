/**
 * Gauge events and partner arbitrations (§10.2): J4 records the events
 * (reason and reference); their effect on the gauges is derived by
 * game/gauge-values.ts. Leaf module: types, save schema, recordGaugeEvent.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';
import { GAUGE_IDS, type GaugeId } from '../scenario/schemas/gauge-codes';

export { GAUGE_CODES, GAUGE_IDS, isGaugeCode, type GaugeCode, type GaugeId } from '../scenario/schemas/gauge-codes';

export interface GaugeEvent {
  on: IsoDate;
  gauge: GaugeId;
  /** Reason code (scenario/schemas/gauge-codes.ts: 'interimWithoutPlanning', 'duplicateRequest', 'unjustifiedOverrun'…). */
  reason: string;
  ref?: string;
  /** Launch of a procedure the event comes from (cancelling the launch withdraws it). */
  executionId?: string;
  /** Number of the action the event comes from (state counter): order of the events of a same day. Numbered at the migration of the saves of J4. */
  seq?: number;
}

export interface Arbitration {
  on: IsoDate;
  overrunHours: number;
  justified: boolean;
  /** Launch arbitrated (cancelling the launch withdraws the arbitration). */
  executionId?: string;
}

export interface GaugesState {
  events: GaugeEvent[];
  arbitrations: Arbitration[];
}

export function initialGauges(): GaugesState {
  return { events: [], arbitrations: [] };
}

export const gaugesSchema = z.object({
  events: z.array(z.object({ on: z.string(), gauge: z.enum(GAUGE_IDS), reason: z.string(), ref: z.string().optional(), executionId: z.string().optional(), seq: z.number().int().optional() })),
  arbitrations: z.array(z.object({ on: z.string(), overrunHours: z.number(), justified: z.boolean(), executionId: z.string().optional() })),
});

export function recordGaugeEvent(s: GaugesState, e: GaugeEvent): GaugesState {
  return { ...s, events: [...s.events, e] };
}

/** Withdraws the arbitration and the gauge events of a launch that was cancelled before its work started. */
export function withdrawExecution(s: GaugesState, executionId: string): GaugesState {
  if (!s.events.some((e) => e.executionId === executionId) && !s.arbitrations.some((a) => a.executionId === executionId)) return s;
  return { events: s.events.filter((e) => e.executionId !== executionId), arbitrations: s.arbitrations.filter((a) => a.executionId !== executionId) };
}
