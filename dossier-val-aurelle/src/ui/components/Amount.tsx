import { formatAmount } from '../../engine/format';

/** Amount in euros (cents in, fr-FR out), tabular digits; negative amounts in parentheses. */
export function Amount({ cents, decimals = 0, parentheses = false }: { cents: number; decimals?: number; parentheses?: boolean }) {
  if (cents === 0) return <span className="num text-muted">–</span>;
  const text = formatAmount(Math.abs(cents), decimals);
  const negative = cents < 0;
  return <span className={`num ${negative ? 'text-ko' : ''}`}>{negative ? (parentheses ? `(${text})` : `−${text}`) : text}</span>;
}
