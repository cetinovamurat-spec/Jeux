/**
 * External confirmations (plan J4 §9, J4-7): the unit is the third party.
 * The player prepares the requests (interim), they are sent automatically on
 * the sending date (params/requests.json → confirmations.sendingPeriod), after
 * which only alternative procedures remain; replies arrive at the dates of
 * the third parties' letters (derived, never stored); a third party that does
 * not reply stays « sans réponse », and the reminder is a player action. The
 * reconciliation of a reply with the books is the player's work. Section of
 * the game state owned by J4c.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';
import type { Cents } from '../engine/money';
import { outstandingAt } from '../engine/subledgers/loans';
import type { LoanScheduleLine } from '../engine/types';
import type { ScenarioDatasets } from '../scenario/datasets';
import { loadParams, type Params } from '../scenario/params';
import type { UpcomingContext, UpcomingEvent } from './advance';
import type { HoursCharge } from './budget';
import { addWorkingDays, workCalendar, type MemberId, type WorkCalendar } from './calendar';
import { lastReminder, readReminders } from './requests';

export interface ConfirmationItem {
  /** Third party (id of the confirmation populations). */
  thirdParty: string;
  preparedOn: IsoDate;
  /** Member who prepares the request (senior by default). */
  by?: MemberId;
  /** Execution of the programme the request was prepared in (its time is then part of the procedure). */
  executionId?: string;
  /** Dates of the reminders, oldest first (each one is charged). */
  reminders?: IsoDate[];
}

export interface ConfirmationsState {
  items: ConfirmationItem[];
}

export function initialConfirmations(): ConfirmationsState {
  return { items: [] };
}

export const confirmationsSchema = z.object({
  items: z.array(
    z
      .object({
        thirdParty: z.string(),
        preparedOn: z.string(),
        by: z.enum(['senior', 'lea', 'hugo', 'sofia']).optional(),
        executionId: z.string().optional(),
        reminders: z.array(z.string()).optional(),
        /** Saves made before the reminders were listed: the last one only. */
        remindedOn: z.string().optional(),
      })
      .transform(readReminders),
  ),
});

/** Date of the automatic sending of the confirmation requests (first day of the calendar period). */
export function sendingDate(params: Params): IsoDate {
  const id = params.requests.confirmations.sendingPeriod;
  return params.game.calendar.find((p) => p.id === id)?.from ?? params.documents.calendar['confirmationsSent'] ?? '2026-01-06';
}

/** The requests can still be prepared at the date (before the sending). */
export function canPrepare(params: Params, date: IsoDate): boolean {
  return date < sendingDate(params);
}

/**
 * Confirmation requests sent at the date: the third parties prepared before
 * the sending date, once it is reached (keys of the documents' `confirmation`
 * availability).
 */
export function sentConfirmations(s: ConfirmationsState, params: Params, date: IsoDate): ReadonlySet<string> {
  const sending = sendingDate(params);
  if (date < sending) return new Set();
  return new Set(s.items.filter((it) => it.preparedOn < sending).map((it) => it.thirdParty));
}

// ---------------------------------------------------------------------------
// populations of third parties (built from the presented data)
// ---------------------------------------------------------------------------

export type ConfirmationPopulation = 'lenders' | 'banks' | 'notaries' | 'lawyers' | 'funders' | 'suppliers' | 'debtors';

export const POPULATION_ORDER: readonly ConfirmationPopulation[] = ['lenders', 'banks', 'notaries', 'lawyers', 'funders', 'suppliers', 'debtors'];

/** Populations prepared by a confirmation procedure (params/requests.json → confirmations.procedurePopulations; all of them by default). */
export function populationsOfProcedure(params: Params, procedureId: string | null | undefined): readonly ConfirmationPopulation[] {
  const p = procedureId ? params.requests.confirmations.procedurePopulations[procedureId] : undefined;
  return p && p.length ? POPULATION_ORDER.filter((x) => p.includes(x)) : POPULATION_ORDER;
}

/**
 * Requests of an execution of a confirmation procedure: those prepared in it,
 * and those whose third party belongs to one of its populations
 * (`populationOf`: population of a third party, from the candidates).
 */
export function confirmationsOfExecution(
  items: readonly ConfirmationItem[],
  params: Params,
  executionId: string,
  procedureId: string,
  populationOf?: (thirdParty: string) => ConfirmationPopulation | undefined,
): ConfirmationItem[] {
  const pops = populationsOfProcedure(params, procedureId);
  return items.filter((it) => {
    if (it.executionId === executionId) return true;
    const pop = populationOf?.(it.thirdParty);
    return pop !== undefined && pops.includes(pop);
  });
}

/** Cycle of the work programme a population of third parties belongs to (findings created from the tracker). */
export const POPULATION_CYCLE: Readonly<Record<ConfirmationPopulation, string>> = {
  lenders: 'debtTreasury',
  banks: 'debtTreasury',
  notaries: 'fixedAssets',
  lawyers: 'provisions',
  funders: 'equitySubsidies',
  suppliers: 'purchases',
  debtors: 'rentReceivables',
};

export interface ConfirmationCandidate {
  thirdParty: string;
  name: string;
  population: ConfirmationPopulation;
  /** What the request asks the third party to confirm. */
  subject: string;
  /** Figure of the books or of the data that motivates the selection (outstanding capital, 2025 volume…), or null. */
  amount: Cents | null;
}

const YEAR_END = '2025-12-31';

/**
 * Third parties proposed for confirmation, by population, from the presented
 * data (plan J4 §9). The populations are those of the year; the selection
 * figures (`amount`) are taken as known at `asOf` (cutoff of the data vintage
 * the player consults: outstanding capital, invoices, receipts and decisions
 * up to that date), and are all null when no 2025 data is available yet
 * (`asOf` null).
 */
export function confirmationCandidates(params: Params, ds: ScenarioDatasets, asOf: IsoDate | null = YEAR_END): ConfirmationCandidate[] {
  const cfg = params.requests.confirmations;
  const name = (id: string) => ds.thirdParties.find((t) => t.id === id)?.name ?? id;
  const out: ConfirmationCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: ConfirmationCandidate) => {
    if (seen.has(c.thirdParty)) return;
    seen.add(c.thirdParty);
    out.push(c);
  };
  const known = (d: IsoDate) => asOf !== null && d <= asOf;
  // order of a population: by the selection figure shown, by name when there is none yet
  const ranked = (ids: Iterable<string>, at: ReadonlyMap<string, Cents>) => [...ids].sort((a, b) => (asOf ? (at.get(b) ?? 0) - (at.get(a) ?? 0) : 0) || name(a).localeCompare(name(b), 'fr'));
  // lenders: outstanding loans at the year end
  const schedules = new Map<string, LoanScheduleLine[]>();
  for (const l of ds.loanSchedules) schedules.set(l.loanId, [...(schedules.get(l.loanId) ?? []), l]);
  const byLender = new Map<string, Cents>();
  const lentAt = new Map<string, Cents>();
  for (const l of ds.loans) {
    if (l.refDate > YEAR_END) continue;
    const sched = schedules.get(l.id) ?? [];
    byLender.set(l.lenderId, (byLender.get(l.lenderId) ?? 0) + outstandingAt(l, sched, YEAR_END));
    if (asOf) lentAt.set(l.lenderId, (lentAt.get(l.lenderId) ?? 0) + outstandingAt(l, sched, asOf));
  }
  for (const id of ranked(byLender.keys(), lentAt)) add({ thirdParty: id, name: name(id), population: 'lenders', subject: 'Emprunts : capital restant dû, intérêts courus, garanties et engagements', amount: asOf ? (lentAt.get(id) ?? 0) : null });
  // banks without loans: accounts
  for (const t of ds.thirdParties) if (t.kind === 'lender' && !byLender.has(t.id)) add({ thirdParty: t.id, name: t.name, population: 'banks', subject: 'Comptes bancaires, placements et engagements', amount: null });
  // notaries of the sales of 2025 and 2026
  const notaries = new Map<string, number>();
  for (const s of ds.sales) if (s.deedDate >= '2025-01-01' || s.promiseDate >= '2025-01-01') notaries.set(s.notaryId, (notaries.get(s.notaryId) ?? 0) + 1);
  for (const [id] of [...notaries.entries()].sort((a, b) => b[1] - a[1])) add({ thirdParty: id, name: name(id), population: 'notaries', subject: 'Ventes en cours : sommes détenues ou dues, actes signés', amount: null });
  // lawyers paid in 2025 (all lawyers when none was paid)
  const lawyers = ds.thirdParties.filter((t) => t.kind === 'lawyer');
  const paid = lawyers.filter((t) => ds.invoices.some((i) => i.supplierId === t.id && i.invoiceDate.startsWith('2025')));
  for (const t of paid.length ? paid : lawyers) add({ thirdParty: t.id, name: t.name, population: 'lawyers', subject: 'Litiges et contentieux en cours, honoraires dus', amount: ds.invoices.filter((i) => i.supplierId === t.id && i.invoiceDate.startsWith('2025') && known(i.invoiceDate)).reduce((s, i) => s + i.total, 0) || null });
  // funders with subsidies receivable at the year end
  const restAt = (s: ScenarioDatasets['subsidies'][number], d: IsoDate) => (s.decisionDate > d || (s.cancelledOn && s.cancelledOn <= d) ? 0 : s.amount - s.receipts.filter((r) => r.date <= d).reduce((a, r) => a + r.amount, 0));
  const receivable = new Map<string, Cents>();
  const receivableAt = new Map<string, Cents>();
  for (const s of ds.subsidies) {
    const rest = restAt(s, YEAR_END);
    if (rest <= 0) continue;
    receivable.set(s.grantorId, (receivable.get(s.grantorId) ?? 0) + rest);
    if (asOf) receivableAt.set(s.grantorId, (receivableAt.get(s.grantorId) ?? 0) + Math.max(0, restAt(s, asOf)));
  }
  for (const id of ranked(receivable.keys(), receivableAt)) add({ thirdParty: id, name: name(id), population: 'funders', subject: 'Subventions accordées et restant à verser', amount: asOf ? (receivableAt.get(id) ?? 0) : null });
  // suppliers by volume, and the suppliers always proposed (group entities, disputes, major contracts)
  const volume = new Map<string, Cents>();
  for (const i of ds.invoices) if (i.invoiceDate.startsWith('2025')) volume.set(i.supplierId, (volume.get(i.supplierId) ?? 0) + i.total);
  const minVolume = Math.round(cfg.supplierMinVolumeEuros * 100);
  const supplierIds = new Set([...cfg.suppliersAlways, ...[...volume.entries()].filter(([, v]) => v >= minVolume).map(([id]) => id)]);
  const supplierKinds = new Set(['supplier', 'groupEntity']);
  const volumeAt = new Map<string, Cents>();
  if (asOf) for (const i of ds.invoices) if (i.invoiceDate.startsWith('2025') && known(i.invoiceDate)) volumeAt.set(i.supplierId, (volumeAt.get(i.supplierId) ?? 0) + i.total);
  for (const id of ranked(supplierIds, volumeAt)) {
    const t = ds.thirdParties.find((x) => x.id === id);
    if (!t || !supplierKinds.has(t.kind)) continue;
    add({ thirdParty: id, name: t.name, population: 'suppliers', subject: 'Solde fournisseur, factures non réglées et litiges', amount: asOf ? (volumeAt.get(id) ?? 0) : null });
  }
  // debtors: residence managers and group entities financed by the entity (accounts without invoices)
  for (const t of ds.thirdParties) if (t.kind === 'residenceManager') add({ thirdParty: t.id, name: t.name, population: 'debtors', subject: 'Redevances et sommes dues à l’organisme', amount: null });
  for (const t of ds.thirdParties) if (t.kind === 'groupEntity' && t.aux && !volume.has(t.id)) add({ thirdParty: t.id, name: t.name, population: 'debtors', subject: 'Avances et comptes courants', amount: null });
  return out;
}

// ---------------------------------------------------------------------------
// status of a confirmation (tracker)
// ---------------------------------------------------------------------------

export type ConfirmationState = 'prepared' | 'notSent' | 'sent' | 'replied' | 'noReply';

/**
 * Status at the date: prepared (before the sending), sent (awaiting the
 * reply), replied (reply arrived on `replyOn`), no reply (the reply date
 * passed, or the usual delay of the third parties for one that never
 * replies, in working days of the game calendar). `replyOn` is the date of
 * the third party's letter, or null when it never replies.
 */
export function confirmationStatus(params: Params, item: ConfirmationItem, replyOn: IsoDate | null, date: IsoDate, cal: WorkCalendar = workCalendar(params)): ConfirmationState {
  const sending = sendingDate(params);
  if (item.preparedOn >= sending) return 'notSent';
  if (date < sending) return 'prepared';
  if (replyOn && replyOn <= date) return 'replied';
  if (replyOn) return 'sent';
  const max = params.game.responseDelaysBusinessDays['thirdPartyMax'] ?? 15;
  return date > addWorkingDays(cal, sending, max) ? 'noReply' : 'sent';
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export interface ConfirmationHost {
  confirmations: ConfirmationsState;
  clock: { date: IsoDate };
  journal?: readonly { on: IsoDate; kind: string; ref?: string; data?: Record<string, string | number | boolean> }[];
}

function withJournal<S extends ConfirmationHost>(s: S, kind: string, ref: string, title: string): S {
  return s.journal ? { ...s, journal: [...s.journal, { on: s.clock.date, kind, ref, data: { title } }] } : s;
}

/**
 * Prepares the confirmation request of a third party (before the sending date
 * only). Prepared in an execution of the programme, its time is part of the
 * procedure's hours; prepared from the GED, it is charged on its own.
 */
export function prepareConfirmation<S extends ConfirmationHost>(s: S, thirdParty: string, label: string, by: MemberId = 'senior', params: Params = loadParams(), executionId?: string): S {
  if (!canPrepare(params, s.clock.date) || s.confirmations.items.some((it) => it.thirdParty === thirdParty)) return s;
  const item: ConfirmationItem = { thirdParty, preparedOn: s.clock.date, ...(by !== 'senior' ? { by } : {}), ...(executionId !== undefined ? { executionId } : {}) };
  const next: S = { ...s, confirmations: { items: [...s.confirmations.items, item] } };
  return withJournal(next, 'confirmation', thirdParty, `Demande de confirmation préparée – ${label}`);
}

/** Withdraws a prepared request (before the sending date only). */
export function withdrawConfirmation<S extends ConfirmationHost>(s: S, thirdParty: string, params: Params = loadParams()): S {
  if (!canPrepare(params, s.clock.date)) return s;
  return { ...s, confirmations: { items: s.confirmations.items.filter((it) => it.thirdParty !== thirdParty) } };
}

/** Reminds a third party after the sending, once a day at most (journal, cost; a third party that never replies stays silent). */
export function remindConfirmation<S extends ConfirmationHost>(s: S, thirdParty: string, label: string, params: Params = loadParams()): S {
  if (s.clock.date < sendingDate(params)) return s;
  const it = s.confirmations.items.find((x) => x.thirdParty === thirdParty);
  if (!it || it.preparedOn >= sendingDate(params) || lastReminder(it) === s.clock.date) return s;
  const next: S = { ...s, confirmations: { items: s.confirmations.items.map((x) => (x.thirdParty === thirdParty ? { ...x, reminders: [...(x.reminders ?? []), s.clock.date] } : x)) } };
  return withJournal(next, 'confirmationReminder', thirdParty, `Relance de la demande de confirmation – ${label}`);
}

// ---------------------------------------------------------------------------
// clock and budget
// ---------------------------------------------------------------------------

/** Upcoming events of the confirmations: the automatic sending (replies are not announced: they arrive as mail). */
export function upcomingConfirmations(s: ConfirmationsState, ctx: UpcomingContext): UpcomingEvent[] {
  const sending = sendingDate(ctx.params);
  if (ctx.date >= sending) return [];
  const n = s.items.filter((it) => it.preparedOn < sending).length;
  return [
    n
      ? { date: sending, kind: 'confirmation', label: `Envoi automatique de ${n} demande${n > 1 ? 's' : ''} de confirmation`, to: '/ged?onglet=demandes' }
      : { date: sending, kind: 'deadline', label: 'Envoi des demandes de confirmation : aucune demande préparée', to: '/ged?onglet=demandes' },
  ];
}

/** Hours charged by the preparation of the confirmation requests (outside a procedure) and each reminder. */
export function hoursCharged(s: ConfirmationsState, params: Params): HoursCharge[] {
  const cfg = params.requests.confirmations;
  const out: HoursCharge[] = [];
  for (const it of s.items) {
    if (it.executionId === undefined) out.push({ member: it.by ?? 'senior', hours: cfg.preparationHours, on: it.preparedOn });
    for (const on of it.reminders ?? []) out.push({ member: 'senior', hours: cfg.reminderHours, on });
  }
  return out;
}
