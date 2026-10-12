import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { closingBalances } from '../../engine/balance';
import { buildStatements } from '../../engine/statements';
import type { FinancialStatements } from '../../engine/types';
import { buildAnnex, type AnnexTable } from '../../scenario/annex';
import { loadParams, type Params } from '../../scenario/params';
import type { DossierData } from './dossier';

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
