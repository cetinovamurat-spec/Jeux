/**
 * Work programme and executions (plan J4 §6.3 and §7): procedures planned and
 * assigned, then launched (scheduled on the member's working days) and
 * documented. The worksheet of a procedure is its execution. Section of the
 * game state owned by J4b.
 */
import { z } from 'zod';
import type { HoursCharge } from './budget';
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { UpcomingContext, UpcomingEvent } from './advance';
import type { MemberId } from './calendar';

export interface PlannedProcedure {
  procedureId: string;
  assignee: MemberId;
}

export interface Execution {
  id: string;
  procedureId: string;
  assignee: MemberId;
  /** Hours charged (cost of the procedure for the assignee). */
  hours: number;
  launchedOn: IsoDate;
  /** Conclusion of the worksheet (null until documented). */
  conclusion: string | null;
  comment: string;
  /** Review by the senior (J5): accepted or returned with a comment. */
  review: { status: 'pending' | 'accepted' | 'returned'; on?: IsoDate; comment?: string };
}

export interface ProgramState {
  planned: PlannedProcedure[];
  /** In launch order (scheduling order). */
  executions: Execution[];
}

export function initialProgram(): ProgramState {
  return { planned: [], executions: [] };
}

const member = z.enum(['senior', 'lea', 'hugo', 'sofia']);
export const programSchema = z.object({
  planned: z.array(z.object({ procedureId: z.string(), assignee: member })),
  executions: z.array(
    z.object({
      id: z.string(),
      procedureId: z.string(),
      assignee: member,
      hours: z.number(),
      launchedOn: z.string(),
      conclusion: z.string().nullable(),
      comment: z.string(),
      review: z.object({ status: z.enum(['pending', 'accepted', 'returned']), on: z.string().optional(), comment: z.string().optional() }),
    }),
  ),
});

/** Upcoming events of the programme (worksheets delivered at the end of their scheduling). J4b implements it. */
export function upcomingProgram(_s: ProgramState, _ctx: UpcomingContext): UpcomingEvent[] {
  return [];
}

/** Hours charged to the budget by the executions of the procedures (cost of the procedure for the assignee). */
export function hoursCharged(s: ProgramState, _params: Params): HoursCharge[] {
  return s.executions.map((e) => ({ member: e.assignee, hours: e.hours, on: e.launchedOn }));
}
