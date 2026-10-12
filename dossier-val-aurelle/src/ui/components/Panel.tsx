import type { ReactNode } from 'react';

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted';
export const td = 'px-3 py-1.5 text-sm border-t border-line';
