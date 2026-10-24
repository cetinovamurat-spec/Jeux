/** Source « Messages » of the command palette: the messages received at the game date. */
import { inbox } from '../../../game/messages';
import type { PaletteContext, PaletteItem } from '../../app/palette-sources';
import { formatDateFr } from '../../../engine/dates';
import { senderOf } from './labels';

export function messagePaletteItems({ c, game, messages }: PaletteContext): PaletteItem[] {
  return inbox(game, messages).map((m) => ({ id: `msg:${m.id}`, label: m.subject, hint: `${senderOf(c.params, m.from).name}, ${formatDateFr(m.on)}`, to: `/messagerie/${encodeURIComponent(m.id)}` }));
}
