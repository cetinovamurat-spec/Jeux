/**
 * Registry of the sources of the command palette (Ctrl+K): screens,
 * documents, accounts, saved FEC queries, and the sources of J5 (people:
 * interviews lot; messages; memo entries: memo lot), each in its own module.
 */
import type { MessageContext } from '../../game/messages';
import type { GameState } from '../../game/state';
import type { DocumentModel } from '../../scenario/documents';
import { interviewPaletteItems } from '../screens/interviews/palette';
import { memoPaletteItems } from '../screens/memo/palette';
import { messagePaletteItems } from '../screens/messages/palette';
import type { CaseData } from './case';
import { NAV } from './routes';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  /** Address the item opens. */
  to: string;
}

export interface PaletteContext {
  c: CaseData;
  game: GameState;
  /** Documents the player can consult at the game date. */
  docs: readonly DocumentModel[];
  designer: boolean;
  messages: MessageContext;
}

export interface PaletteSource {
  id: string;
  /** Group shown in front of the items (French). */
  group: string;
  /** Shown when nothing is typed (the screens). */
  shownByDefault?: boolean;
  items: (ctx: PaletteContext) => PaletteItem[];
}

export const PALETTE_SOURCES: readonly PaletteSource[] = [
  {
    id: 'screens',
    group: 'Écrans',
    shownByDefault: true,
    items: ({ designer }) => NAV.filter((n) => designer || !n.designerOnly).map((n) => ({ id: `nav:${n.to}`, label: n.label, hint: n.description, to: n.to })),
  },
  { id: 'documents', group: 'Documents', items: ({ docs }) => docs.map((d) => ({ id: `doc:${d.id}`, label: d.title, hint: d.issuer, to: `/ged/${encodeURIComponent(d.id)}` })) },
  { id: 'accounts', group: 'Comptes', items: ({ c }) => c.balanceRows().map((r) => ({ id: `acc:${r.account}`, label: `${r.account} – ${r.label}`, to: `/grand-livre?compte=${encodeURIComponent(r.account)}` })) },
  { id: 'queries', group: 'Requêtes FEC', items: ({ game }) => game.savedQueries.map((s) => ({ id: `query:${s.id}`, label: s.name, to: `/fec?requete=${encodeURIComponent(s.id)}` })) },
  { id: 'people', group: 'Personnes', items: (ctx) => interviewPaletteItems(ctx) },
  { id: 'messages', group: 'Messages', items: (ctx) => messagePaletteItems(ctx) },
  { id: 'memo', group: 'Mémo', items: (ctx) => memoPaletteItems(ctx) },
];
