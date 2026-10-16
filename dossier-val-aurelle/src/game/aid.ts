/**
 * « Demander conseil à Antoine » (plan J4 §14, §10.9): the manager points to
 * a cycle the player assessed at risk whose usual detailed procedures have
 * not been launched yet. Worded as method, never as an anomaly. Free at the
 * assistant level, costs the partner's trust at the senior level (gauge
 * event), unavailable at the manager level. Pure.
 */
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import { recordGaugeEvent } from './gauges';
import { maxRiskOfCycle, riskRank } from './planning';
import { executionOf } from './program';
import { log, type GameState } from './state';

export type AidMode = 'free' | 'partnerTrust' | 'unavailable';

export function aidMode(params: Params, difficulty: GameState['difficulty']): AidMode {
  return params.game.difficulty[difficulty].aid;
}

export interface Advice {
  /** Cycle pointed to, or null when the programme answers the risks assessed. */
  cycle: string | null;
  /** Procedures suggested (not launched yet). */
  procedures: string[];
  text: string;
}

export const AID_USED = 'aidUsed';

/** Phase order of the calendar, to prefer the procedures that can still be launched. */
function stillPossible(params: Params, phases: readonly string[], date: IsoDate): boolean {
  return params.game.calendar.some((p) => phases.includes(p.id) && p.to >= date);
}

/**
 * The advice at the date: among the cycles assessed at risk (most severe
 * level first), the first one with detailed procedures of the library that
 * have not been launched and can still be launched.
 */
export function antoineAdvice(s: Pick<GameState, 'planning' | 'program'>, params: Params, date: IsoDate): Advice {
  const levelLabel = (id: string) => params.planning.riskLevels.find((l) => l.id === id)?.label ?? id;
  const cycles = params.cycles.cycles
    .map((c, i) => ({ c, i, level: maxRiskOfCycle(s.planning, c.id) }))
    .filter((x) => riskRank(x.level) >= riskRank('moderate'))
    .sort((a, b) => riskRank(b.level) - riskRank(a.level) || a.i - b.i);
  for (const { c, level } of cycles) {
    const missing = params.procedures.procedures.filter((p) => p.cycle === c.id && p.effectiveFor.length > 0 && !executionOf(s.program, p.id) && stillPossible(params, p.phases, date));
    if (missing.length === 0) continue;
    // planned procedures first, then the library order
    const planned = new Set(s.program.planned.map((p) => p.procedureId));
    const pick = [...missing.filter((p) => planned.has(p.id)), ...missing.filter((p) => !planned.has(p.id))].slice(0, 2);
    const titles = pick.map((p) => `« ${p.title} »`).join(' et ');
    return {
      cycle: c.id,
      procedures: pick.map((p) => p.id),
      text: `Le cycle « ${c.label} », que vous avez évalué au niveau « ${levelLabel(level)} », n’a pas encore fait l’objet des procédures de détail habituelles. Pour un dossier de ce type, je commencerais par ${titles}. Vérifiez que votre programme y répond, et documentez votre conclusion sur la feuille maîtresse.`,
    };
  }
  return { cycle: null, procedures: [], text: 'Sur la méthode, je n’ai rien à ajouter : vos travaux couvrent les risques que vous avez évalués. Relisez vos feuilles maîtresses avant de conclure.' };
}

/** Records the use of the aid (journal; gauge event at the senior level). Unavailable at the manager level: the state is unchanged. */
export function askAntoine(s: GameState, params: Params): GameState {
  const mode = aidMode(params, s.difficulty);
  if (mode === 'unavailable') return s;
  const advice = antoineAdvice(s, params, s.clock.date);
  let next = log(s, 'aid', advice.cycle ?? '', { mode });
  if (mode === 'partnerTrust') next = { ...next, gauges: recordGaugeEvent(next.gauges, { on: s.clock.date, gauge: 'partnerTrust', reason: AID_USED, ...(advice.cycle ? { ref: advice.cycle } : {}) }) };
  return next;
}
