/**
 * Registry of the tabs of the designer control screen ('/controle'): the
 * navigation of ControlScreen and the routes of App.tsx read it. The tabs of
 * J5 point to the modules of their lots (characters, ethics and gauges:
 * interviews lot; team: team lot).
 */
import type { ComponentType } from 'react';
import { AnalysisScreen } from './Analysis';
import { AnnexScreen } from './Annex';
import { BalanceScreen } from './Balance';
import { CharactersTab } from './CharactersTab';
import { EthicsTab } from './EthicsTab';
import { FecScreen } from './Fec';
import { GaugesTab } from './GaugesTab';
import { StatementsScreen } from './Statements';
import { Targets } from './Targets';
import { TeamTab } from './TeamTab';

export interface ControlTab {
  /** Path under '/controle' ('' for the index). */
  path: string;
  label: string;
  Component: ComponentType;
}

export const CONTROL_TABS: readonly ControlTab[] = [
  { path: '', label: 'Cibles de calibrage', Component: Targets },
  { path: 'balance', label: 'Balance (comptes propres)', Component: BalanceScreen },
  { path: 'etats', label: 'États (comptes propres)', Component: StatementsScreen },
  { path: 'annexe', label: 'Annexe (comptes propres)', Component: AnnexScreen },
  { path: 'analyse', label: 'CAF et autofinancement', Component: AnalysisScreen },
  { path: 'fec', label: 'FEC (comptes propres)', Component: FecScreen },
  { path: 'personnages', label: 'Personnages', Component: CharactersTab },
  { path: 'equipe', label: 'Équipe', Component: TeamTab },
  { path: 'ethique', label: 'Éthique', Component: EthicsTab },
  { path: 'jauges', label: 'Jauges', Component: GaugesTab },
];

/** Address of a tab. */
export function controlTabTo(t: ControlTab): string {
  return t.path ? `/controle/${t.path}` : '/controle';
}
