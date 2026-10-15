/** Screens that need 2025 data not yet available at the game date (plan J4 §4). */
import type { ReactNode } from 'react';
import { formatDateFr } from '../../engine/dates';
import { vintageDates, type DataView } from '../../game/vintages';
import { useDataView, useFullCase } from './context';
import type { DataNeed } from './routes';

export function isDataAvailable(view: DataView, need: DataNeed | undefined): boolean {
  if (!need) return true;
  return need === 'ledger2025' ? view.ledger2025 !== 'none' : view.statements2025;
}

/** When the data a screen needs will be available (text of the notice and of the greyed navigation entry). */
export function useAvailabilityText(need: DataNeed | undefined): string | null {
  const c = useFullCase();
  const view = useDataView();
  if (isDataAvailable(view, need)) return null;
  const d = vintageDates(c.params);
  return need === 'ledger2025'
    ? `Disponible avec l’extraction comptable au ${formatDateFr(d.cutoff)} (sur demande au chef comptable, ou remise au début de l’intérim le ${formatDateFr(d.interimDelivered)})`
    : `Disponible avec le projet de comptes 2025, attendu le ${formatDateFr(d.draftStatements)}`;
}

export function DataGate({ need, title, children }: { need: DataNeed; title: string; children: ReactNode }) {
  const text = useAvailabilityText(need);
  if (!text) return <>{children}</>;
  return (
    <div role="status" className="mx-auto max-w-2xl rounded-lg border border-line bg-panel px-6 py-6 text-sm">
      <h1 className="text-base font-semibold">{title}</h1>
      <p className="mt-1 text-muted">Ces données ne sont pas encore disponibles à la date du dossier.</p>
      <p className="mt-2">{text}.</p>
    </div>
  );
}
