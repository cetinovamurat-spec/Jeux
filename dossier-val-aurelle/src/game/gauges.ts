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
}

export interface Arbitration {
  on: IsoDate;
  overrunHours: number;
  justified: boolean;
}

export interface GaugesState {
  events: GaugeEvent[];
  arbitrations: Arbitration[];
}

export function initialGauges(): GaugesState {
  return { events: [], arbitrations: [] };
}

export const gaugesSchema = z.object({
  events: z.array(z.object({ on: z.string(), gauge: z.enum(['clientRelation', 'partnerTrust', 'karimTrust']), reason: z.string(), ref: z.string().optional() })),
  arbitrations: z.array(z.object({ on: z.string(), overrunHours: z.number(), justified: z.boolean() })),
});

export function recordGaugeEvent(s: GaugesState, e: GaugeEvent): GaugesState {
  return { ...s, events: [...s.events, e] };
}
