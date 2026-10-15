import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { closingBalances } from '../../engine/balance';
import { buildStatements } from '../../engine/statements';
import type { FinancialStatements } from '../../engine/types';
import { buildAnnex, type AnnexTable } from '../../scenario/annex';
import { loadParams, type Params } from '../../scenario/params';
import type { DossierData } from './dossier';
import { answeredRequests } from '../../game/requests';
import { dataViewAt, type DataView } from '../../game/vintages';
import type { CaseData } from './case';
import { useGame } from './store';

export interface Dossier extends DossierData {
  params: Params;
  balances: { current: Map<string, number>; prior: Map<string, number> };
  statements: FinancialStatements;
  annex: { current: AnnexTable[]; prior: AnnexTable[] };
}

const Ctx = createContext<Dossier | null>(null);

export function DossierProvider({ data, children }: { data: DossierData; children: ReactNode }) {
  const value = useMemo<Dossier>(() => {
    const params = loadParams();
    const current = closingBalances(data.world.ledgers.current);
    const prior = closingBalances(data.world.ledgers.prior);
    const statements = buildStatements({ defs: params.statements, chart: data.world.chart, current, prior, currentYear: 2025, priorYear: 2024, presentation: data.world.presentation });
    return { ...data, params, balances: { current, prior }, statements, annex: { current: buildAnnex(data.world, params, 'current'), prior: buildAnnex(data.world, params, 'prior') } };
  }, [data]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDossierData(): Dossier {
  const d = useContext(Ctx);
  if (!d) throw new Error('DossierProvider missing');
  return d;
}

const CaseCtx = createContext<CaseData | null>(null);

export function CaseProvider({ value, children }: { value: CaseData; children: ReactNode }) {
  return <CaseCtx.Provider value={value}>{children}</CaseCtx.Provider>;
}

/** The whole case, every data vintage included (designer mode, control screens). */
export function useFullCase(): CaseData {
  const c = useContext(CaseCtx);
  if (!c) throw new Error('CaseProvider missing');
  return c;
}

/** Data vintage at the game date (game/vintages.ts). */
export function useDataView(): DataView {
  const c = useFullCase();
  const date = useGame((s) => s.game.clock.date);
  const designer = useGame((s) => s.game.settings.designer);
  const requests = useGame((s) => s.game.requests);
  const vintage = c.params.game.dataVintages.interim;
  const interimObtained = useMemo(() => answeredRequests(requests, c.params, date).has(vintage.request), [requests, c, date, vintage]);
  const view = dataViewAt(c.params, { date, interimObtained, designer });
  // stable identity while the vintage does not change
  return useMemo(() => view, [view.ledger2025, view.statements2025, view.cutoff, view.priorCutoff]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The case being audited, as available at the game date (presented world, documents, derivations). */
export function useCase(): CaseData {
  const c = useFullCase();
  const view = useDataView();
  return useMemo(() => c.at(view), [c, view]);
}
