/**
 * Data vintages (plan J4 §4): which accounting data of 2025 the player can
 * consult at a game date.
 *
 * - certified 2024 accounts: from the start;
 * - extraction at 31/10/2025 (interim): on request to the chief accountant,
 *   and handed over anyway at the start of the interim visit;
 * - final trial balance and FEC: from `draftLedger.from`;
 * - draft statements, annex and management report: from `draftStatements.from`.
 *
 * The extraction is the ledger restricted to the entries validated on or
 * before the cutoff (opening entries included), without the letterings made
 * after it: its FEC is therefore a prefix of the final FEC, with the same
 * entry numbers. Pure.
 */
import { OPENING_JOURNAL } from '../engine/balance';
import type { IsoDate } from '../engine/dates';
import type { JournalEntry, Ledger } from '../engine/types';
import type { Params } from '../scenario/params';

export type Ledger2025 = 'none' | 'interim' | 'draft';

export interface DataView {
  /** 2025 ledger available: none, the extraction at the interim cutoff, or the final ledger. */
  ledger2025: Ledger2025;
  /** Draft statements, annex and management report of 2025 available. */
  statements2025: boolean;
  /** Last date covered by the 2025 data shown (cutoff of the extraction, or 31/12/2025). */
  cutoff: IsoDate;
  /** Same date one year earlier (comparison of the extraction with 2024). */
  priorCutoff: IsoDate;
}

export const FULL_VIEW_KEY = 'draft:statements';

export function viewKey(v: DataView): string {
  return `${v.ledger2025}:${v.statements2025 ? 'statements' : 'ledger'}`;
}

export interface DataViewContext {
  date: IsoDate;
  /** The extraction requested to the chief accountant has been received. */
  interimObtained: boolean;
  /** Designer mode: everything is available. */
  designer: boolean;
}

/** First day of a calendar period (game.json → calendar). */
function periodStart(params: Params, id: string): IsoDate {
  return params.game.calendar.find((p) => p.id === id)?.from ?? '9999-12-31';
}

export function dataViewAt(params: Params, ctx: DataViewContext): DataView {
  const v = params.game.dataVintages;
  const { current } = params.scenario.years;
  const yearEnd = `${current}-12-31`;
  if (ctx.designer || ctx.date >= v.draftLedger.from) {
    return { ledger2025: 'draft', statements2025: ctx.designer || ctx.date >= v.draftStatements.from, cutoff: yearEnd, priorCutoff: `${current - 1}-12-31` };
  }
  const interim = ctx.interimObtained || ctx.date >= periodStart(params, v.interim.deliveredAtPeriod);
  const cutoff = v.interim.cutoff;
  const priorCutoff = `${Number(cutoff.slice(0, 4)) - 1}${cutoff.slice(4)}`;
  return { ledger2025: interim ? 'interim' : 'none', statements2025: false, cutoff, priorCutoff };
}

/** Dates at which the vintages become available (agenda, « attendu le … » notices). */
export function vintageDates(params: Params): { interimDelivered: IsoDate; draftLedger: IsoDate; draftStatements: IsoDate; cutoff: IsoDate } {
  const v = params.game.dataVintages;
  return { interimDelivered: periodStart(params, v.interim.deliveredAtPeriod), draftLedger: v.draftLedger.from, draftStatements: v.draftStatements.from, cutoff: v.interim.cutoff };
}

/** The entry is part of an extraction at the cutoff (opening entries always are). */
export function inExtraction(e: Pick<JournalEntry, 'journal' | 'validDate'>, cutoff: IsoDate): boolean {
  return e.journal === OPENING_JOURNAL || e.validDate <= cutoff;
}

/**
 * Ledger as extracted at the cutoff: entries validated on or before it, and
 * the letterings dated after it removed (the lines are copied only when
 * needed).
 */
export function ledgerAt(ledger: Ledger, cutoff: IsoDate): Ledger {
  const entries: JournalEntry[] = [];
  for (const e of ledger.entries) {
    if (!inExtraction(e, cutoff)) continue;
    const late = e.lines.some((l) => l.letteringDate !== undefined && l.letteringDate > cutoff);
    entries.push(
      late
        ? {
            ...e,
            lines: e.lines.map((l) => {
              if (l.letteringDate === undefined || l.letteringDate <= cutoff) return l;
              const { lettering: _l, letteringDate: _d, ...rest } = l;
              return rest;
            }),
          }
        : e,
    );
  }
  return { ...ledger, entries };
}

/** Ledger with no entry (2025 data not yet available). */
export function emptyLedger(ledger: Ledger): Ledger {
  return { ...ledger, entries: [] };
}
