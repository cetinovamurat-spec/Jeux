/**
 * Budget in hours (§4.6, §10.2): hours charged by every section (procedures,
 * requests, confirmations, samples, recalculations), by member. Sofia's hours
 * are a separate envelope (plan J4, J4-4). Pure.
 */
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { MemberId } from './calendar';
import { hoursCharged as confirmationHours } from './confirmations';
import { hoursCharged as programHours } from './program';
import { hoursCharged as recalcHours } from './recalcs';
import { hoursCharged as requestHours } from './requests';
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

export function hoursUsed(s: Pick<GameState, 'program' | 'requests' | 'confirmations' | 'samples' | 'recalcs'>, params: Params): HoursUsed {
  const byMember: Record<MemberId, number> = { senior: 0, lea: 0, hugo: 0, sofia: 0 };
  const all = [...programHours(s.program, params), ...requestHours(s.requests, params), ...confirmationHours(s.confirmations, params), ...sampleHours(s.samples, params), ...recalcHours(s.recalcs, params)];
  for (const c of all) byMember[c.member] += c.hours;
  return { byMember, team: byMember.senior + byMember.lea + byMember.hugo, itAuditor: byMember.sofia };
}
