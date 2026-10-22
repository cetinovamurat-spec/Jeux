/**
 * Gauge events and partner arbitrations (§10.2): J4 records the events
 * (reason and reference); J5 gives them their effect on the gauges.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';

export type GaugeId = 'clientRelation' | 'partnerTrust' | 'karimTrust';

export interface GaugeEvent {
  on: IsoDate;
  gauge: GaugeId;
  /** Reason code (e.g. 'interimWithoutPlanning', 'duplicateRequest', 'unjustifiedOverrun'). */
  reason: string;
  ref?: string;
  /** Launch of a procedure the event comes from (cancelling the launch withdraws it). */
  executionId?: string;
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
  events: z.array(z.object({ on: z.string(), gauge: z.enum(['clientRelation', 'partnerTrust', 'karimTrust']), reason: z.string(), ref: z.string().optional(), executionId: z.string().optional() })),
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
