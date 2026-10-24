/**
 * Budget in hours (§4.6, §10.2): hours charged by every section, by member,
 * through the registry `HOURS_PROVIDERS` (procedures, requests,
 * confirmations, samples, recalculations; sessions of the interviews, ethics
 * options, review decisions, briefings and rework of J5). Sofia's hours are
 * a separate envelope (plan J4, J4-4). Pure.
 */
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { MemberId } from './calendar';
import { hoursCharged as confirmationHours } from './confirmations';
import { hoursCharged as ethicsHours } from './ethics';
import { hoursCharged as interviewHours } from './interviews';
import { hoursCharged as programHours } from './program';
import { hoursCharged as recalcHours } from './recalcs';
import { hoursCharged as requestHours } from './requests';
import { hoursCharged as reviewHours } from './review';
import { hoursCharged as sampleHours } from './samples';
import type { GameState } from './state';

export interface HoursCharge {
  member: MemberId;
  hours: number;
  on: IsoDate;
}

export interface HoursUsed {
  byMember: Record<MemberId, number>;
  /** Senior, Léa and Hugo: the budget of the engagement. */
  team: number;
  /** Sofia (IT auditor): separate envelope. */
  itAuditor: number;
}

/** Sections of the game state the providers read (the UI selects them, so that the hours are recomputed only when they change). */
export const HOURS_SECTIONS = ['program', 'requests', 'confirmations', 'samples', 'recalcs', 'interviews', 'ethics'] as const satisfies readonly (keyof GameState)[];
export type HoursSection = (typeof HOURS_SECTIONS)[number];
export type HoursHost = Pick<GameState, HoursSection>;

export interface HoursProvider {
  id: string;
  charges: (s: HoursHost, params: Params) => readonly HoursCharge[];
}

/** Providers of the hours charged to the budget. */
export const HOURS_PROVIDERS: readonly HoursProvider[] = [
  { id: 'program', charges: (s, p) => programHours(s.program, p) },
  { id: 'requests', charges: (s, p) => requestHours(s.requests, p) },
  { id: 'confirmations', charges: (s, p) => confirmationHours(s.confirmations, p) },
  { id: 'samples', charges: (s, p) => sampleHours(s.samples, p) },
  { id: 'recalcs', charges: (s, p) => recalcHours(s.recalcs, p) },
  { id: 'interviews', charges: (s, p) => interviewHours(s.interviews, p) },
  { id: 'ethics', charges: (s, p) => ethicsHours(s.ethics, p) },
  { id: 'review', charges: (s, p) => reviewHours(s.program, p) },
];

/** Hours charged by every provider, by member. */
export function hoursUsed(s: HoursHost, params: Params): HoursUsed {
  const byMember: Record<MemberId, number> = { senior: 0, lea: 0, hugo: 0, sofia: 0 };
  for (const p of HOURS_PROVIDERS) for (const c of p.charges(s, params)) byMember[c.member] += c.hours;
  return { byMember, team: byMember.senior + byMember.lea + byMember.hugo, itAuditor: byMember.sofia };
}
