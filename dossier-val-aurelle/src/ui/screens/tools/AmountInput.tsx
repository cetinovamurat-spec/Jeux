/**
 * Amount typed by the player in euros (fr-FR: spaces, comma), stored in
 * cents. The value is committed on blur or Enter; an empty field means none.
 */
import { useEffect, useState } from 'react';
import { formatAmount } from '../../../engine/format';
import { TextInput } from '../../components/ui';

/** Cents from a typed amount in euros, or null when the text is not a number. */
export function parseEuros(text: string): number | null {
  const clean = text.replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.');
  if (!clean) return null;
  if (!/^-?\d*(\.\d*)?$/.test(clean)) return null;
  const x = Number(clean);
  return Number.isFinite(x) ? Math.round(x * 100) : null;
}

export function AmountInput({ cents, onCommit, label, id, className, placeholder }: { cents: number | null; onCommit: (cents: number | null) => void; label: string; id?: string; className?: string; placeholder?: string }) {
  const shown = cents === null || cents === 0 ? '' : formatAmount(cents, 2);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const invalid = text.trim() !== '' && parseEuros(text) === null;
  const commit = () => {
    if (invalid) return;
    const v = parseEuros(text);
    if (v !== (cents === 0 ? null : cents)) onCommit(v);
  };
  return (
    <TextInput
      id={id}
      aria-label={label}
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      invalid={invalid}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setText(shown);
      }}
      className={className ?? 'w-32 text-right font-mono'}
    />
  );
}
