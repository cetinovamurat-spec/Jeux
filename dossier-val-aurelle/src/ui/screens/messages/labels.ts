/** Names of the senders of the messages and of the screens their links open (French). */
import type { MessageSender } from '../../../game/messages';
import type { Params } from '../../../scenario/params';
import { NAV } from '../../app/routes';

export interface SenderLabel {
  name: string;
  role: string;
  /** The firm, for the partner, the manager and the team (signature « rôle, cabinet »). */
  firm?: string;
}

/** Name and role of the sender of a message (parameters: firm, team, people of the client). */
export function senderOf(params: Params, from: MessageSender): SenderLabel {
  const g = params.game;
  const firm = g.firm.find((f) => f.id === from);
  if (firm) return { name: firm.name, role: firm.role, firm: g.firmName };
  const member = g.team.find((t) => t.id === from);
  if (member) return { name: member.name, role: member.role, firm: g.firmName };
  const person = params.documents.people[from];
  if (person) return { name: person.name, role: person.role };
  return { name: from, role: '' };
}

/** Label of the screen of a link (its query, e.g. a tab, is ignored). */
export function navLabel(to: string): string {
  const path = to.split('?')[0];
  return NAV.find((n) => n.to === path)?.label ?? to;
}
