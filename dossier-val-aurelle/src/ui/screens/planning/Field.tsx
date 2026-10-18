/** Labelled form field of the planning and work screens (explicit `htmlFor`, so that the control's name is its label only). */
import type { ReactNode } from 'react';
import { cx } from '../../components/ui';

export function Field({ id, label, children, className }: { id: string; label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0 text-sm', className)}>
      <label htmlFor={id} className="mb-0.5 block text-xs text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
