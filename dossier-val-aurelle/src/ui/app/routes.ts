/** Navigation entries of the game shell (also used by the command palette). */
export interface NavItem {
  to: string;
  label: string;
  short: string;
  description: string;
  designerOnly?: boolean;
  /** 2025 data the screen needs (game/vintages.ts): the entry is greyed and the screen explains when it will be available. */
  needs?: DataNeed;
}

export type DataNeed = 'ledger2025' | 'statements2025';

export const NAV: readonly NavItem[] = [
  { to: '/', label: 'Bureau', short: 'Bureau', description: 'Agenda, équipe, budget, jauges et messages' },
  { to: '/messagerie', label: 'Messagerie', short: 'Messagerie', description: 'Messages de l’associée, du manager, de l’équipe et du client' },
  { to: '/planification', label: 'Planification', short: 'Planification', description: 'Seuils de signification, évaluation des risques, programme de travail' },
  { to: '/travaux', label: 'Travaux', short: 'Travaux', description: 'Procédures lancées, feuilles de travail, feuilles maîtresses par cycle' },
  { to: '/equipe', label: 'Revue de l’équipe', short: 'Équipe', description: 'Feuilles de travail de l’équipe à revoir, consignes aux membres' },
  { to: '/entretiens', label: 'Entretiens', short: 'Entretiens', description: 'Entretiens avec la direction et les services du client, confrontations' },
  { to: '/ged', label: 'Gestion documentaire', short: 'GED', description: 'Documents reçus : recherche, lecture, annotations, preuves' },
  { to: '/balance', label: 'Balance N / N-1', short: 'Balance', description: 'Balance générale 2025 et 2024, variations', needs: 'ledger2025' },
  { to: '/grand-livre', label: 'Grand livre', short: 'Grand livre', description: 'Mouvements d’un compte, écritures et contreparties' },
  { to: '/fec', label: 'FEC – tests d’écritures', short: 'FEC', description: 'Filtres combinables, requêtes enregistrées, export' },
  { to: '/etats', label: 'États financiers et pointage', short: 'États', description: 'Bilan, compte de résultat, annexe ; pointage' },
  { to: '/analyse', label: 'Revue analytique', short: 'Analyse', description: 'Variations, ratios HLM, graphiques', needs: 'statements2025' },
  { to: '/constats', label: 'Constats', short: 'Constats', description: 'Constats, questions, tableau des anomalies' },
  { to: '/memo', label: 'Mémo réglementaire', short: 'Mémo', description: 'Normes, textes et méthodes de référence du cabinet' },
  { to: '/controle', label: 'Contrôle (concepteur)', short: 'Contrôle', description: 'Comptes propres, cibles de calibrage, clé de correction', designerOnly: true },
];
