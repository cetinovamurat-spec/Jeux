/** Labels and small formatters shared by the planning and work screens (French). */
import type { MemberId } from '../../../game/calendar';
import type { RiskLevel } from '../../../game/planning';
import type { Tone } from '../../../game/state';
import type { Params } from '../../../scenario/params';
import type { ProcedureDef } from '../../../scenario/schemas/procedures';

export function formatHours(h: number): string {
  return h.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

export function formatPct(x: number): string {
  return `${x.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}

export function cycleLabel(params: Params, id: string): string {
  return params.cycles.cycles.find((c) => c.id === id)?.label ?? id;
}

export function assertionLabel(params: Params, id: string): string {
  return params.planning.assertions.find((a) => a.id === id)?.label ?? id;
}

export function riskLevelLabel(params: Params, level: RiskLevel): string {
  return params.planning.riskLevels.find((l) => l.id === level)?.label ?? level;
}

export const RISK_TONE: Record<RiskLevel, Tone> = { low: 'muted', moderate: 'accent', high: 'warn', significant: 'ko' };

export function memberLabel(params: Params, m: MemberId): string {
  return params.game.team.find((t) => t.id === m)?.name ?? m;
}

/** Short name of a member for compact tables (« Vous », « Léa », « Hugo », « Sofia »). */
export function memberShort(params: Params, m: MemberId): string {
  const name = memberLabel(params, m);
  return m === 'senior' ? name : (name.split(/\s+/)[0] ?? name);
}

export function phaseLabel(params: Params, id: string): string {
  return params.game.calendar.find((c) => c.id === id)?.label ?? id;
}

/** Short labels of the phases of a procedure. */
export function phasesText(params: Params, def: ProcedureDef): string {
  const short: Record<string, string> = { planning: 'Planification', interim: 'Intérim', final: 'Final', completion: 'Synthèse', reporting: 'Rapport' };
  return def.phases.map((p) => short[p] ?? phaseLabel(params, p)).join(', ');
}

/** What the output of a procedure produces (shown on the library and the worksheet; never a lead). */
export function outputText(def: ProcedureDef): string {
  const o = def.output;
  switch (o.kind) {
    case 'view':
      return `Travail sur l’écran ${{ '/fec': 'FEC', '/etats': 'États et pointage', '/ged': 'GED', '/analyse': 'Revue analytique', '/balance': 'Balance', '/grand-livre': 'Grand livre' }[o.screen]}`;
    case 'requests':
      return o.requests.length > 1 ? `${o.requests.length} demandes de pièces` : 'Demande de pièces';
    case 'confirmations':
      return 'Préparation des demandes de confirmation';
    case 'sample':
      return 'Échantillonnage';
    case 'recalc':
      return 'Recalcul';
    case 'memo':
      return 'Note de travail';
  }
}

export const MANDATORY_LABEL = 'Diligence obligatoire';
export const OVERRIDE_LABEL = 'Réponse au contournement des contrôles';
