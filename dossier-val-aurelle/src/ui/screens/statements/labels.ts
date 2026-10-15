/** Labels and small formats of the statements and ticking screen. */
import { formatAmount } from '../../../engine/format';
import type { Tone } from '../../../game/state';

export type TabId = 'actif' | 'passif' | 'resultat' | 'annexe' | 'certifies';

export const TAB_IDS: readonly TabId[] = ['actif', 'passif', 'resultat', 'annexe', 'certifies'];

export function parseTab(v: string | null): TabId {
  return TAB_IDS.find((t) => t === v) ?? 'actif';
}

/** Tone of a mark, as offered to the player (colour and usual meaning). */
export const TONE_LABELS: Record<Tone, string> = {
  ok: 'Vert – concordance',
  accent: 'Bleu – référence',
  muted: 'Gris – neutre',
  warn: 'Orange – à revoir',
  ko: 'Rouge – écart',
};

export const TONES: readonly Tone[] = ['ok', 'accent', 'muted', 'warn', 'ko'];

/** GED document holding the source of each tab (opened from the header when available). */
export const SOURCE_DOCUMENT: Record<TabId, string> = {
  actif: 'etats-financiers-2025',
  passif: 'etats-financiers-2025',
  resultat: 'etats-financiers-2025',
  annexe: 'annexe-2025',
  certifies: 'comptes-certifies-2024',
};

/** Integer count with fr-FR digit grouping (through the engine formatter). */
export function formatCount(n: number): string {
  return formatAmount(n * 100, 0);
}

export function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n > 1 ? many : one}`;
}

/** Balance with its side, as in a trial balance: '1 234,56 D' / '1 234,56 C'; '–' when nil. */
export function sideAmount(cents: number, decimals = 2): string {
  if (cents === 0) return '–';
  return `${formatAmount(Math.abs(cents), decimals)} ${cents > 0 ? 'D' : 'C'}`;
}
