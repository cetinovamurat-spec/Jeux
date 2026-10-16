/**
 * Evaluator of the conditions of the game (plan J4 §16): data vintage
 * available, date, calendar period, document available, request answered,
 * procedure launched, delivered or documented; combined with all / any / not.
 * Used by the prerequisites of the procedures (J4) and by the unlocking of
 * the dialogues (J5). Pure: everything it reads is in the context.
 */
import { formatDateFr, type IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { Condition } from '../scenario/schemas/procedures';
import { answeredRequests } from './requests';
import type { GameState } from './state';
import { dataViewAt, vintageDates, type DataView } from './vintages';

export type { Condition };

/** Progress of the execution of a procedure, as the conditions see it. */
export type ProcedureProgress = 'none' | 'launched' | 'delivered' | 'documented';

export interface ConditionContext {
  params: Params;
  date: IsoDate;
  /** Data of 2025 available at the date (game/vintages.ts). */
  view: DataView;
  /** Requests answered at the date ('family' and 'family:object' keys). */
  answered: ReadonlySet<string>;
  /** Availability of a document at the date (unknown documents are unavailable). Absent: documents are not known (pure tests). */
  isDocumentAvailable?: (docId: string) => boolean;
  /** Title of a document, for the reasons shown to the player. */
  documentTitle?: (docId: string) => string | undefined;
  /** Progress of the procedures of the programme. Absent: no procedure has been launched. */
  procedureProgress?: (procedureId: string) => ProcedureProgress;
}

export interface ConditionResult {
  ok: boolean;
  /** Why the condition is not met (French, shown to the player); never names an anomaly. */
  reasons: string[];
}

const PROGRESS_RANK: Record<ProcedureProgress, number> = { none: 0, launched: 1, delivered: 2, documented: 3 };

/** Context of the conditions at a date, from the game state (requests answered, data vintage). */
export function conditionContext(s: Pick<GameState, 'requests' | 'settings' | 'clock'>, params: Params, date: IsoDate = s.clock.date, extra: Pick<ConditionContext, 'isDocumentAvailable' | 'documentTitle' | 'procedureProgress'> = {}): ConditionContext {
  const answered = answeredRequests(s.requests, params, date);
  const view = dataViewAt(params, { date, interimObtained: answered.has(params.game.dataVintages.interim.request), designer: s.settings.designer });
  return { params, date, view, answered, ...extra };
}

function familyLabel(params: Params, family: string): string {
  const f = (params.requests.families as { id: string; label: string }[]).find((x) => x.id === family);
  return f?.label ?? family;
}

function procedureTitle(params: Params, id: string): string {
  return params.procedures.procedures.find((p) => p.id === id)?.title ?? id;
}

/** Evaluates one condition. */
export function evaluate(c: Condition, ctx: ConditionContext): ConditionResult {
  const ok: ConditionResult = { ok: true, reasons: [] };
  const ko = (reason: string): ConditionResult => ({ ok: false, reasons: [reason] });
  const { params } = ctx;
  switch (c.kind) {
    case 'vintage': {
      const d = vintageDates(params);
      if (c.vintage === 'interim') return ctx.view.ledger2025 !== 'none' ? ok : ko(`Nécessite l’extraction comptable au ${formatDateFr(d.cutoff)} (à demander au chef comptable).`);
      if (c.vintage === 'draftLedger') return ctx.view.ledger2025 === 'draft' ? ok : ko(`Nécessite la balance et le FEC définitifs, attendus le ${formatDateFr(d.draftLedger)}.`);
      return ctx.view.statements2025 ? ok : ko(`Nécessite le projet d’états financiers et d’annexe, attendu le ${formatDateFr(d.draftStatements)}.`);
    }
    case 'dateFrom':
      return ctx.date >= c.date ? ok : ko(`Possible à partir du ${formatDateFr(c.date)}.`);
    case 'period': {
      const current = params.game.calendar.find((p) => p.from <= ctx.date && ctx.date <= p.to);
      if (current && c.ids.includes(current.id)) return ok;
      const labels = params.game.calendar.filter((p) => c.ids.includes(p.id)).map((p) => p.label.toLowerCase());
      return ko(`Possible pendant : ${labels.join(', ')}.`);
    }
    case 'document': {
      if (ctx.isDocumentAvailable?.(c.docId)) return ok;
      const title = ctx.documentTitle?.(c.docId);
      return ko(title ? `Nécessite la pièce « ${title} », pas encore disponible.` : 'Nécessite une pièce qui n’est pas encore disponible.');
    }
    case 'request': {
      const key = c.object ? `${c.family}:${c.object}` : c.family;
      return ctx.answered.has(key) ? ok : ko(`Nécessite la réponse à la demande « ${familyLabel(params, c.family)} ».`);
    }
    case 'procedure': {
      const progress = ctx.procedureProgress?.(c.procedureId) ?? 'none';
      if (PROGRESS_RANK[progress] >= PROGRESS_RANK[c.state]) return ok;
      const what = c.state === 'launched' ? 'lancée' : c.state === 'delivered' ? 'livrée' : 'documentée';
      return ko(`Nécessite la procédure « ${procedureTitle(params, c.procedureId)} » ${what}.`);
    }
    case 'all':
      return evaluateAll(c.of, ctx);
    case 'any': {
      const results = c.of.map((x) => evaluate(x, ctx));
      if (results.length === 0 || results.some((r) => r.ok)) return ok;
      return { ok: false, reasons: [`Une des conditions suivantes : ${results.flatMap((r) => r.reasons).join(' Ou : ')}`] };
    }
    case 'not': {
      const r = evaluate(c.of, ctx);
      return r.ok ? ko('Condition non remplie.') : ok;
    }
  }
}

/** Evaluates a list of conditions (all must be met); the reasons of every unmet condition are kept. */
export function evaluateAll(conditions: readonly Condition[], ctx: ConditionContext): ConditionResult {
  const reasons = conditions.flatMap((c) => evaluate(c, ctx).reasons);
  return { ok: reasons.length === 0, reasons };
}
