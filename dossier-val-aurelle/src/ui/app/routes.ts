/** Navigation entries of the game shell (also used by the command palette). */
export interface NavItem {
  to: string;
  label: string;
  short: string;
  description: string;
  designerOnly?: boolean;
}

export const NAV: readonly NavItem[] = [
  { to: '/', label: 'Bureau', short: 'Bureau', description: 'Agenda, équipe, budget, jauges et messages' },
  { to: '/ged', label: 'Gestion documentaire', short: 'GED', description: 'Documents reçus : recherche, lecture, annotations, preuves' },
  { to: '/balance', label: 'Balance N / N-1', short: 'Balance', description: 'Balance générale 2025 et 2024, variations' },
  { to: '/grand-livre', label: 'Grand livre', short: 'Grand livre', description: 'Mouvements d’un compte, écritures et contreparties' },
  { to: '/fec', label: 'FEC – tests d’écritures', short: 'FEC', description: 'Filtres combinables, requêtes enregistrées, export' },
  { to: '/etats', label: 'États financiers et pointage', short: 'États', description: 'Bilan, compte de résultat, annexe ; pointage' },
  { to: '/analyse', label: 'Revue analytique', short: 'Analyse', description: 'Variations, ratios HLM, graphiques' },
  { to: '/controle', label: 'Contrôle (concepteur)', short: 'Contrôle', description: 'Comptes propres, cibles de calibrage, clé de correction', designerOnly: true },
];
