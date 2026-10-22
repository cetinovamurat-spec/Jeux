/**
 * « Demander conseil à Antoine » (plan J4 §14, §10.9): the manager points to
 * a cycle the player assessed at risk whose effective procedures have not
 * been launched yet, worded as method (the kinds of work, never a procedure
 * title nor an anomaly). The answer never depends on the procedures planned:
 * planning one is free and must not tell which procedures are productive.
 * Free at the assistant level, costs the partner's trust at the senior level
 * (gauge event), unavailable at the manager level. Pure.
 */
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { ProcedureOutput } from '../scenario/schemas/procedures';
import { recordGaugeEvent } from './gauges';
import { riskRank, type RiskLevel } from './planning';
import { executionOf } from './program';
import { log, type GameState } from './state';

export type AidMode = 'free' | 'partnerTrust' | 'unavailable';

export function aidMode(params: Params, difficulty: GameState['difficulty']): AidMode {
  return params.game.difficulty[difficulty].aid;
}

export interface Advice {
  /** Cycle pointed to, or null when the programme answers the risks assessed (or none is assessed). */
  cycle: string | null;
  text: string;
}

export const AID_USED = 'aidUsed';

/** Phase order of the calendar, to prefer the procedures that can still be launched. */
function stillPossible(params: Params, phases: readonly string[], date: IsoDate): boolean {
  return params.game.calendar.some((p) => phases.includes(p.id) && p.to >= date);
}

/** Kinds of work, in the order of the advice (method, never a procedure). */
const METHOD: Readonly<Record<ProcedureOutput['kind'], string>> = {
  requests: 'l’obtention des pièces justificatives auprès de l’entité',
  confirmations: 'des confirmations directes auprès des tiers',
  sample: 'des tests de détail sur un échantillon',
  recalc: 'des recalculs indépendants',
  view: 'un rapprochement des comptes avec les pièces et les données sources',
  memo: 'une analyse documentée dans une note de travail',
};
const METHOD_ORDER = Object.keys(METHOD) as ProcedureOutput['kind'][];

/** Highest level the player assessed on a cycle (the cycle or one of its assertions), null when none was assessed. */
function assessedLevel(s: Pick<GameState, 'planning'>, cycle: string): RiskLevel | null {
  let level: RiskLevel | null = null;
  for (const [k, e] of Object.entries(s.planning.risks)) if ((k === cycle || k.startsWith(`${cycle}:`)) && (level === null || riskRank(e.level) > riskRank(level))) level = e.level;
  return level;
}

/**
 * The advice at the date: among the cycles the player assessed at risk (an
 * explicit assessment, most severe level first, then the order of the
 * cycles), the first one with effective procedures of the library that have
 * not been launched and can still be launched; the method follows the kinds
 * of work of those procedures.
 */
export function antoineAdvice(s: Pick<GameState, 'planning' | 'program'>, params: Params, date: IsoDate): Advice {
  const levelLabel = (id: string) => params.planning.riskLevels.find((l) => l.id === id)?.label ?? id;
  const assessed = params.cycles.cycles.flatMap((c, i) => {
    const level = assessedLevel(s, c.id);
    return level === null ? [] : [{ c, i, level }];
  });
  if (assessed.length === 0) return { cycle: null, text: 'Commencez par évaluer les risques par cycle et par assertion : c’est ce qui oriente le programme de travail. Je vous dirai ensuite où porter l’effort.' };
  const cycles = assessed.filter((x) => riskRank(x.level) >= riskRank('moderate')).sort((a, b) => riskRank(b.level) - riskRank(a.level) || a.i - b.i);
  for (const { c, level } of cycles) {
    const missing = params.procedures.procedures.filter((p) => p.cycle === c.id && p.effectiveFor.length > 0 && !executionOf(s.program, p.id) && stillPossible(params, p.phases, date));
    if (missing.length === 0) continue;
    const kinds = METHOD_ORDER.filter((k) => missing.some((p) => p.output.kind === k)).slice(0, 2);
    return {
      cycle: c.id,
      text: `Le cycle « ${c.label} », que vous avez évalué au niveau « ${levelLabel(level)} », n’a pas encore fait l’objet des procédures de détail habituelles. Pour un dossier de ce type, je m’appuierais sur ${kinds.map((k) => METHOD[k]).join(' et sur ')}. Vérifiez que votre programme y répond, et documentez votre conclusion sur la feuille maîtresse.`,
    };
  }
  return { cycle: null, text: 'Sur la méthode, je n’ai rien à ajouter : vos travaux couvrent les risques que vous avez évalués. Relisez vos feuilles maîtresses avant de conclure.' };
}

/** Records the use of the aid (journal; gauge event at the senior level). Unavailable at the manager level: the state is unchanged. */
export function askAntoine(s: GameState, params: Params): GameState {
  const mode = aidMode(params, s.difficulty);
  if (mode === 'unavailable') return s;
  const advice = antoineAdvice(s, params, s.clock.date);
  const manager = params.game.firm.find((f) => f.id === 'manager')?.name ?? 'le manager';
  let next = log(s, 'aid', advice.cycle ?? '', { mode, title: `conseil de méthode demandé à ${manager}` });
  if (mode === 'partnerTrust') next = { ...next, gauges: recordGaugeEvent(next.gauges, { on: s.clock.date, gauge: 'partnerTrust', reason: AID_USED, ...(advice.cycle ? { ref: advice.cycle } : {}) }) };
  return next;
}
