/**
 * Mailbox (plan J5 §11): the inbox is derived from the state and the date;
 * only the read marks are stored. Every message comes from a provider of the
 * registry `MESSAGE_PROVIDERS` (phase messages of the partner, ethics events,
 * answers to the escalations, team messages…). A provider returns every
 * message the state implies, past and future, each dated: the inbox keeps
 * those received at the game date, so a clock moved back hides the later
 * ones, and the dates of the next ones are stops of the clock (advance.ts,
 * not listed: a message is not known in advance).
 *
 * A message never quotes an amount typed by hand: its text is built from the
 * parameters and the generated data.
 */
import { z } from 'zod';
import { addDays, formatDateFr, type IsoDate } from '../engine/dates';
import type { PersonId } from '../scenario/npc/keys';
import type { Params } from '../scenario/params';
import type { EthicsEventId } from '../scenario/schemas/ethics-events';
import { workingDayOnOrAfter, type MemberId, type WorkCalendar } from './calendar';
import { escalationMessages } from './escalations';
import { ethicsMessages } from './ethics';
import { teamMessages } from './review';
import type { Difficulty, GameState } from './state';
import { vintageDates } from './vintages';

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

/** Who sends a message: a person of the client, the president of the tenants' association, the firm or a member of the team. */
export type MessageSender = PersonId | 'tenantAssociation' | 'partner' | 'manager' | MemberId;

/** Link of a message to a screen (react-router path, with its query). */
export interface MessageLink {
  to: string;
  /** Object to focus on the screen (e.g. a procedure, a document). */
  focus?: string;
  /** Stable anchor of the tutorial (`data-tutorial`, J7). */
  tutorial?: string;
  /** Step the link introduces, shown after the name of the screen (« Planification – les seuils… »). */
  text?: string;
}

export interface Message {
  /** Stable id (read marks). */
  id: string;
  /** Date of the message (« Reçu le »). */
  on: IsoDate;
  /** Number of the action the message answers, when it comes from one (order of the messages of a same day). */
  seq?: number;
  from: MessageSender;
  subject: string;
  /** Paragraphs before the links. */
  body: string[];
  links: MessageLink[];
  /** Paragraphs after the links. */
  closing?: string[];
  /** Ethics event the message carries (choices, deadline, note to the partner). */
  ethics?: EthicsEventId;
  /** Step of the tutorial the message opens (J7). */
  tutorial?: string;
  /** Difficulty levels the message is sent at (all when absent). */
  levels?: readonly Difficulty[];
  /**
   * Date from which the message is in the inbox, when it is later than its
   * date: a message written on the last day of a visit for the period that
   * follows it is read the next day (the phase messages of J4).
   */
  visibleOn?: IsoDate;
}

export interface MessageContext {
  params: Params;
  cal: WorkCalendar;
  /** Game date: the inbox keeps the messages received at this date. */
  date: IsoDate;
}

export interface MessageProvider {
  id: string;
  /** Every message the state implies, past and future, each dated (the inbox filters on the date). */
  messages: (s: GameState, ctx: MessageContext) => readonly Message[];
}

export interface MessagesState {
  /** Date each message was first read, by id. */
  read: Record<string, IsoDate>;
}

export function initialMessages(): MessagesState {
  return { read: {} };
}

export const messagesSchema = z.object({ read: z.record(z.string(), z.string()) });

// ---------------------------------------------------------------------------
// phase messages of the partner (J4, DeskScreen → usePhaseMessage)
// ---------------------------------------------------------------------------

/** Tab « Demandes et confirmations » of the GED. */
const GED_REQUESTS = '/ged?onglet=demandes';

export interface PhaseMessage {
  id: string;
  /** Date of the message (start of the phase it opens). */
  on: IsoDate;
  intro: string;
  steps: { to: string; text: string }[];
  outro: string;
}

const PHASE_SUBJECTS: Readonly<Record<string, string>> = {
  'partner-planning': 'Prise en charge du dossier',
  'partner-interim': 'Intérim',
  'partner-offsite': 'Hors site',
  'partner-final': 'Final',
  'partner-after-final': 'Après le final',
};

/**
 * Message of the signing partner for the phase of a date (the rules of J4,
 * unchanged): it prescribes the steps of the method, never a lead (no
 * amount, no hint).
 */
export function phaseMessageAt(params: Params, date: IsoDate): PhaseMessage {
  const { calendar, startDate } = params.game;
  const v = vintageDates(params);
  const at = (id: string) => calendar.find((p) => p.id === id);
  const interim = at('interim');
  const final = at('final');
  const sending = at('confirmations');
  const completion = at('completion');
  const d = (x: string | undefined) => (x ? formatDateFr(x) : '');
  const { years } = params.scenario;
  if (interim && date < interim.from) {
    return {
      id: 'partner-planning',
      on: startDate,
      intro: `Vous prenez en charge le dossier pour l’exercice clos le ${formatDateFr(`${years.current}-12-31`)}. Nous sommes en prise de connaissance et planification ; l’intérim commence le ${d(interim.from)}. Je vous propose :`,
      steps: [
        { to: '/ged', text: 'le dossier permanent, les procès-verbaux et les comptes certifiés de l’exercice précédent, pour reprendre connaissance de l’entité ;' },
        { to: GED_REQUESTS, text: `une demande au chef comptable de l’extraction comptable au ${d(v.cutoff)}, pour la revue analytique préliminaire ;` },
        { to: '/planification', text: 'les seuils de signification, l’évaluation des risques et le programme de travail : partez du programme du cabinet et adaptez-le au dossier.' },
      ],
      outro: 'Je relirai seuils, risques et programme avant l’intérim.',
    };
  }
  if (interim && date <= interim.to) {
    return {
      id: 'partner-interim',
      on: interim.from,
      intro: `L’équipe vous rejoint pour l’intérim, jusqu’au ${d(interim.to)}. Au programme :`,
      steps: [
        { to: '/travaux', text: 'les prises de connaissance des procédures et les tests de contrôles, dont la revue de la migration du système d’information ;' },
        { to: GED_REQUESTS, text: `la préparation des demandes de confirmation des tiers : elles partiront le ${d(sending?.from)} ;` },
        { to: '/balance', text: 'les premiers travaux sur l’extraction comptable.' },
      ],
      outro: 'Pensez à organiser le travail de l’équipe : chacun a ses heures et ses jours de présence.',
    };
  }
  if (final && date < final.from) {
    return {
      id: 'partner-offsite',
      on: interim?.to ?? startDate,
      intro: `Nous sommes hors site jusqu’au final, qui commence le ${d(final.from)}. D’ici là :`,
      steps: [
        { to: GED_REQUESTS, text: 'suivez vos demandes et les réponses des tiers ;' },
        { to: '/balance', text: `la balance et le FEC définitifs sont attendus le ${d(v.draftLedger)}, le projet d’états financiers le ${d(v.draftStatements)}.` },
      ],
      outro: 'Vous pouvez avancer d’événement en événement.',
    };
  }
  if (final && date <= final.to) {
    return {
      id: 'partner-final',
      on: final.from,
      intro: `Le final se tient jusqu’au ${d(final.to)}. Le projet de comptes est remis :`,
      steps: [
        { to: '/planification', text: 'révisez vos seuils sur les chiffres définitifs ;' },
        { to: '/travaux', text: 'menez les travaux de substance prévus, avec l’équipe ;' },
        { to: '/etats', text: `pointez les états et l’annexe sur la balance, et le comparatif sur les comptes certifiés ${years.prior} ;` },
        { to: '/constats', text: 'documentez vos constats et concluez vos feuilles maîtresses.' },
      ],
      outro: 'Remontez-moi au fil de l’eau les sujets sensibles : je préfère une alerte précoce à une surprise en fin de mission.',
    };
  }
  return {
    id: 'partner-after-final',
    on: final?.to ?? startDate,
    intro: `Le final est terminé. La synthèse ${completion ? `se tient à partir du ${d(completion.from)}` : 'suit'} ; jusqu’à la signature du rapport :`,
    steps: [
      { to: '/travaux', text: 'suivez les événements postérieurs à la clôture et mettez à jour vos travaux ;' },
      { to: '/constats', text: 'tenez à jour vos constats et le tableau des anomalies.' },
    ],
    outro: 'Seul le senior reste mobilisé sur le dossier après le final.',
  };
}

/** A phase message as a message of the mailbox, received from `visibleFrom`. */
function phaseAsMessage(params: Params, m: PhaseMessage, visibleFrom: IsoDate): Message {
  const manager = params.game.firm.find((f) => f.id === 'manager');
  return {
    id: m.id,
    on: m.on,
    from: 'partner',
    subject: PHASE_SUBJECTS[m.id] ?? m.id,
    body: ['Bonjour,', m.intro],
    links: m.steps.map((s) => ({ to: s.to, text: s.text })),
    closing: [`${manager ? `${manager.name} reste disponible pour les questions de méthode et le suivi du budget. ` : ''}${m.outro}`],
    ...(visibleFrom > m.on ? { visibleOn: visibleFrom } : {}),
  };
}

/**
 * The phase messages of the engagement, each received from the first date
 * its phase is reached (the days the rules of J4 change message): the latest
 * one received at a date is the message J4 showed on the desk at that date.
 */
export function phaseMessages(params: Params): readonly Message[] {
  let list = phaseCache.get(params);
  if (!list) {
    list = buildPhaseMessages(params);
    phaseCache.set(params, list);
  }
  return list;
}

const phaseCache = new WeakMap<Params, readonly Message[]>();

function buildPhaseMessages(params: Params): Message[] {
  const at = (id: string) => params.game.calendar.find((p) => p.id === id);
  const interim = at('interim');
  const final = at('final');
  const starts = [params.game.startDate, interim?.from, interim && addDays(interim.to, 1), final?.from, final && addDays(final.to, 1)].filter((d): d is IsoDate => d !== undefined).sort();
  const out: Message[] = [];
  for (const d of starts) {
    const m = phaseMessageAt(params, d);
    if (!out.some((x) => x.id === m.id)) out.push(phaseAsMessage(params, m, d));
  }
  return out;
}

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

/** Providers of the messages, in rank order (order of the messages of a same day and number). */
export const MESSAGE_PROVIDERS: readonly MessageProvider[] = [
  { id: 'phase', messages: (_s, ctx) => phaseMessages(ctx.params) },
  { id: 'ethics', messages: (s, ctx) => ethicsMessages(s, ctx) },
  { id: 'escalations', messages: (s, ctx) => escalationMessages(s, ctx) },
  { id: 'team', messages: (s, ctx) => teamMessages(s, ctx) },
];

/** Date the message reaches the inbox. */
export function receivedOn(m: Message): IsoDate {
  return m.visibleOn !== undefined && m.visibleOn > m.on ? m.visibleOn : m.on;
}

function sentAtLevel(m: Message, level: Difficulty): boolean {
  return m.levels === undefined || m.levels.includes(level);
}

interface Ranked {
  m: Message;
  rank: number;
  index: number;
}

function compare(a: Ranked, b: Ranked): number {
  if (a.m.on !== b.m.on) return a.m.on < b.m.on ? -1 : 1;
  const sa = a.m.seq ?? 0;
  const sb = b.m.seq ?? 0;
  if (sa !== sb) return sa - sb;
  return a.rank - b.rank || a.index - b.index;
}

/** Every message the state implies at the player's level, past and future, in chronological order (date, number, rank of the provider). */
export function allMessages(s: GameState, ctx: MessageContext): Message[] {
  const ranked: Ranked[] = [];
  MESSAGE_PROVIDERS.forEach((p, rank) => p.messages(s, ctx).forEach((m, index) => ranked.push({ m, rank, index })));
  return ranked
    .filter((r) => sentAtLevel(r.m, s.difficulty))
    .sort(compare)
    .map((r) => r.m);
}

/** Messages received at the game date, most recent first. */
export function inbox(s: GameState, ctx: MessageContext): Message[] {
  return allMessages(s, ctx)
    .filter((m) => receivedOn(m) <= ctx.date)
    .reverse();
}

/** The message was read at or before the date. */
export function isRead(s: Pick<GameState, 'messages'>, id: string, date: IsoDate): boolean {
  const on = s.messages.read[id];
  return on !== undefined && on <= date;
}

export function unreadCount(s: GameState, ctx: MessageContext): number {
  return inbox(s, ctx).filter((m) => !isRead(s, m.id, ctx.date)).length;
}

/** Marks a message read at the game date; the same state when it already is. */
export function markMessageRead(s: GameState, id: string): GameState {
  if (s.messages.read[id] !== undefined) return s;
  return { ...s, messages: { ...s.messages, read: { ...s.messages.read, [id]: s.clock.date } } };
}

/**
 * Dates after the game date at which new messages arrive, in order: stops of
 * the clock, not listed in the upcoming events. A message received on a day
 * off is read on the next working day.
 */
export function messageStops(s: GameState, ctx: MessageContext): IsoDate[] {
  const dates = new Set<IsoDate>();
  for (const m of allMessages(s, ctx)) {
    const on = receivedOn(m);
    if (on > ctx.date) dates.add(workingDayOnOrAfter(ctx.cal, on));
  }
  return [...dates].sort();
}

/** Ids of every message the state implies, at any date and level (read marks of unknown messages are orphans). */
export function knownMessageIds(s: GameState, ctx: Omit<MessageContext, 'date'>): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const p of MESSAGE_PROVIDERS) for (const m of p.messages(s, { ...ctx, date: '9999-12-31' })) ids.add(m.id);
  return ids;
}
