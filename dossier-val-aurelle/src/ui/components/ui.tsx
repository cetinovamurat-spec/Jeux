/** Small shared UI primitives (sober professional style, keyboard accessible). */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { Tone } from '../../game/state';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

export function Button({ variant = 'default', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent font-medium text-panel hover:opacity-90',
        variant === 'default' && 'border border-line bg-panel hover:bg-sunken',
        variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
        variant === 'danger' && 'border border-ko/40 text-ko hover:bg-ko/10',
        className,
      )}
    />
  );
}

export function TextInput({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx('rounded-md border border-line bg-panel px-2 py-1 text-sm placeholder:text-muted', className)} />;
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx('rounded-md border border-line bg-panel px-2 py-1 text-sm', className)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, id }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--accent)]" />
      {label}
    </label>
  );
}

const toneClass: Record<Tone, string> = {
  ok: 'border-ok/40 bg-ok/10 text-ok',
  ko: 'border-ko/40 bg-ko/10 text-ko',
  accent: 'border-accent/40 bg-accent-soft text-accent',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  muted: 'border-line bg-sunken text-muted',
};

export function Badge({ tone = 'muted', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center rounded border px-1.5 text-xs leading-5', toneClass[tone])}>
      {children}
    </span>
  );
}

export function toneText(tone: Tone): string {
  return { ok: 'text-ok', ko: 'text-ko', accent: 'text-accent', warn: 'text-warn', muted: 'text-muted' }[tone];
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-sunken px-1 font-mono text-[11px] text-muted">{children}</kbd>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && <p className="mt-0.5 max-w-4xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-panel', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

/** Accessible tabs (role=tablist); content is rendered by the caller. */
export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: readonly { id: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={it.id === value}
          onClick={() => onChange(it.id)}
          onKeyDown={(e) => {
            const i = items.findIndex((x) => x.id === value);
            if (e.key === 'ArrowRight') onChange(items[(i + 1) % items.length]!.id);
            if (e.key === 'ArrowLeft') onChange(items[(i - 1 + items.length) % items.length]!.id);
          }}
          className={cx('-mb-px rounded-t-md border px-3 py-1.5 text-sm', it.id === value ? 'border-line border-b-panel bg-panel font-semibold text-accent' : 'border-transparent text-muted hover:text-ink')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Horizontal meter for a 0–100 gauge. */
export function Gauge({ label, value, low }: { label: string; value: number; low: number }) {
  const tone = value <= low ? 'bg-ko' : value < 50 ? 'bg-warn' : 'bg-ok';
  return (
    <div className="w-44" title={`${label} : ${value}/100`}>
      <div className="flex justify-between gap-2 text-[11px] text-muted">
        <span className="truncate">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="mt-0.5 h-1.5 rounded bg-sunken" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className={cx('h-1.5 rounded', tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
