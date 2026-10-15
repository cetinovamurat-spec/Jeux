/**
 * French labels, ratio definitions and small display formats of the
 * analytical review. Account numbers quoted in the definitions are read from
 * the conventions (game rules and params), never typed here.
 */
import type { PrefixRule } from '../../../engine/analysis';
import { formatAmount, formatKEuro, formatMEuro, formatPercent } from '../../../engine/format';
import type { AnalysisParams } from '../../../scenario/params';

export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const;
export const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] as const;

/** 'a', 'a et b', 'a, b et c' */
export function listFr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Accounts of a prefix rule in words, e.g. '641 et 645 (hors 6459)'. */
export function ruleText(rule: PrefixRule): string {
  const ex = rule.exclude?.length ? ` (hors ${listFr(rule.exclude)})` : '';
  return `${listFr(rule.include)}${ex}`;
}

/** Signed relative variation, '—' when it cannot be computed. */
export function formatSignedPercent(ratio: number | null, decimals = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  const text = formatPercent(Math.abs(ratio), decimals);
  return ratio < 0 ? `−${text}` : ratio > 0 ? `+${text}` : text;
}

/** Signed difference of two ratios in percentage points. */
export function formatPoints(diff: number, decimals = 1): string {
  // formatAmount divides by 100: a ratio × 10 000 prints as percentage points.
  const text = formatAmount(Math.round(Math.abs(diff) * 10 ** (4 + decimals)) / 10 ** decimals, decimals);
  const zero = Math.round(Math.abs(diff) * 10 ** (2 + decimals)) === 0;
  return `${zero ? '' : diff < 0 ? '−' : '+'}${text} pt`;
}

/** Smallest number of decimals (0 to 2) that prints a value exactly. */
function decimalsFor(value: number): number {
  for (let d = 0; d < 2; d++) if (Math.abs(value * 10 ** d - Math.round(value * 10 ** d)) < 1e-6) return d;
  return 2;
}

/** Compact euro value (cents in) for axis ticks: millions or thousands, decimals only when needed. */
export function axisEuro(cents: number): string {
  if (cents === 0) return '0';
  if (Math.abs(cents) >= 100_000_000) return formatMEuro(cents, decimalsFor(cents / 100_000_000));
  return formatKEuro(cents, decimalsFor(cents / 100_000));
}

/** Round axis ticks covering [min, max] in about `count` intervals (steps of 1, 2, 2.5 or 5 × 10^n). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  let lo0 = Math.min(min, max);
  let hi0 = Math.max(min, max);
  if (lo0 === hi0) {
    const pad = Math.abs(lo0) * 0.1 || 1;
    lo0 -= pad;
    hi0 += pad;
  }
  const raw = (hi0 - lo0) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw * (1 - 1e-9)) ?? 10 * mag;
  const lo = Math.floor(lo0 / step + 1e-9) * step;
  const hi = Math.ceil(hi0 / step - 1e-9) * step;
  const out: number[] = [];
  for (let i = 0; lo + i * step <= hi + step * 1e-9; i++) out.push(Math.round((lo + i * step) * 1e6) / 1e6);
  return out;
}

/** Formatter of euro ticks (cents in): one unit for the whole axis and the decimals its step needs. */
export function euroTickFormat(ticks: readonly number[]): (cents: number) => string {
  const maxAbs = Math.max(0, ...ticks.map((t) => Math.abs(t)));
  const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : maxAbs;
  const mega = maxAbs >= 100_000_000;
  const d = decimalsFor(step / (mega ? 100_000_000 : 100_000));
  return (cents) => (cents === 0 ? '0' : mega ? formatMEuro(cents, d) : formatKEuro(cents, d));
}

/** Percentage tick (ratio in), decimals only when needed. */
export function axisPercent(ratio: number): string {
  return formatPercent(ratio, decimalsFor(ratio * 100));
}

/** A reference rate given in percent ('3 %', '2,5 %'). */
export function formatRatePct(pct: number): string {
  return formatPercent(pct / 100, decimalsFor(pct));
}

/** Truncates a long label for an axis (the full label stays in the tooltip and the table). */
export function shorten(label: string, max: number): string {
  return label.length <= max ? label : `${label.slice(0, max - 1).trimEnd()}…`;
}

export interface RatioText {
  label: string;
  definition: string;
}

/** Labels and definitions of the HLM ratios (conventions proposed, to be validated). */
export function ratioTexts(a: AnalysisParams): Record<'netSelfFinancing' | 'mean3' | 'ebeOnRents' | 'debtService' | 'financialCharges' | 'vacancy' | 'arrears' | 'managementCost', RatioText> {
  const conv = a.review.hlmRatios;
  const rents = `loyers nets de RLS (comptes ${ruleText(a.rents)})`;
  const leftOut = listFr(conv.managementCost.leftOut.map((l) => `${l.prefix} (${l.reason})`));
  return {
    netSelfFinancing: {
      label: 'Ratio d’autofinancement net HLM',
      definition: `Autofinancement net (CAF − remboursements en capital des emprunts locatifs, hors remboursements anticipés) / (produits des activités, comptes ${ruleText(a.netSelfFinancing.activityIncome)}, + produits financiers, comptes ${ruleText(a.netSelfFinancing.financialIncome)}). 2021 à 2023 : ratios communiqués par la société (agrégats).`,
    },
    mean3: {
      label: 'Moyenne sur trois exercices',
      definition: 'Moyenne arithmétique des ratios de l’exercice et des deux exercices précédents, comparée au taux de référence sur trois exercices.',
    },
    ebeOnRents: {
      label: 'EBE / loyers',
      definition: `Excédent brut d’exploitation (produits des comptes ${ruleText(a.ebe.products)} − charges des comptes ${ruleText(a.ebe.charges)}) / ${rents}.`,
    },
    debtService: {
      label: 'Annuités / loyers',
      definition: `(Remboursements en capital des emprunts locatifs, hors anticipés, + intérêts des emprunts, comptes ${ruleText(conv.loanInterest)}) / ${rents}.`,
    },
    financialCharges: {
      label: 'Frais financiers / loyers',
      definition: `Charges financières (comptes ${ruleText(a.financialCharges)}) / ${rents}.`,
    },
    vacancy: {
      label: 'Taux de vacance au 31/12',
      definition: 'Logements familiaux sans bail en cours au 31/12 / logements familiaux en service à cette date (logements vendus exclus), vacance technique comprise.',
    },
    arrears: {
      label: 'Impayés : créances locatives / loyers et charges quittancés',
      definition: `Créances locatives brutes, avant dépréciation (comptes ${ruleText(conv.rentReceivables)}) / loyers et charges quittancés de l’exercice, nets de RLS (solde créditeur net des comptes ${ruleText(conv.billedRentsAndCharges)} : loyers, déduction faite de la RLS, provisions et régularisation des charges). Les deux termes portent sur ce qui est facturé aux locataires.`,
    },
    managementCost: {
      label: 'Coût de gestion par logement',
      definition: `Charges de personnel, services extérieurs non récupérables autres que l’entretien, autres services extérieurs, impôts et taxes autres que la taxe foncière et la taxe d’enlèvement des ordures ménagères (comptes ${ruleText(conv.managementCost)}) / logements familiaux en service au 31/12.${leftOut ? ` Non retenus : ${leftOut}.` : ''}`,
    },
  };
}
