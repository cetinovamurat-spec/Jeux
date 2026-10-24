/** Screen or tab announced but not open yet in this version of the game (French). */
import type { ReactNode } from 'react';

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-lg border border-dashed border-line bg-panel px-6 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}
