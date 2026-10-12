/** fr-FR display formats (pure; shared by UI and document templates). */
import type { Cents } from './money';

const euroFormatters = new Map<number, Intl.NumberFormat>();

function euroFormatter(decimals: number): Intl.NumberFormat {
  let f = euroFormatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    euroFormatters.set(decimals, f);
  }
  return f;
}

/** 1 234 567,89 (no currency sign). */
export function formatAmount(cents: Cents, decimals = 2): string {
  return euroFormatter(decimals).format(cents / 100);
}

/** 1 234 567,89 € */
export function formatEuro(cents: Cents, decimals = 2): string {
  return `${formatAmount(cents, decimals)} €`;
}

/** Thousands of euros, e.g. 1 234,6 k€ */
export function formatKEuro(cents: Cents, decimals = 1): string {
  return `${euroFormatter(decimals).format(cents / 100_000)} k€`;
}

/** Millions of euros, e.g. 9,20 M€ */
export function formatMEuro(cents: Cents, decimals = 2): string {
  return `${euroFormatter(decimals).format(cents / 100_000_000)} M€`;
}

export function formatPercent(ratio: number, decimals = 1): string {
  return `${euroFormatter(decimals).format(ratio * 100)} %`;
}

/** FEC amount: decimal comma, no thousands separator, e.g. '300000,00'. */
export function formatFecAmount(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}
