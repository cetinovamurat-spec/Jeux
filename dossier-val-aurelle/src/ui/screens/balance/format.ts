/** Labels and text formats shared by the balance and the general ledger. */
import { formatDateFr } from '../../../engine/dates';
import { formatAmount, formatFecAmount } from '../../../engine/format';

/** Account classes of the chart (filter of the balance, ledger header). */
export const ACCOUNT_CLASSES: readonly { id: string; label: string }[] = [
  { id: '1', label: 'Capitaux' },
  { id: '2', label: 'Immobilisations' },
  { id: '3', label: 'Stocks' },
  { id: '4', label: 'Tiers' },
  { id: '5', label: 'Financiers' },
  { id: '6', label: 'Charges' },
  { id: '7', label: 'Produits' },
];

export function classLabel(account: string): string | undefined {
  return ACCOUNT_CLASSES.find((k) => account.startsWith(k.id))?.label;
}

/** CSV amount (FEC format: decimal comma, no thousands separator). */
export const csvAmount = formatFecAmount;

/** Integer count with fr-FR digit grouping (through the engine formatter). */
export function formatCount(n: number): string {
  return formatAmount(n * 100, 0);
}

export function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n > 1 ? many : one}`;
}

/** UTF-8 BOM, so that spreadsheet software reads the accents of the CSV exports. */
export const CSV_BOM = '﻿';

/** FEC date (YYYYMMDD) in fr-FR; '' stays ''. */
export function fecDateFr(d: string): string {
  return d.length === 8 ? formatDateFr(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`) : d;
}
