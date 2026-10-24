/**
 * Registry of the cards of the desk ('/'): main column (messages, engagement,
 * agenda) and side column (method, gauges, worksheets to review, team,
 * activity, shortcuts, designer). DeskScreen reads it; a card of a lot of J5
 * lives in the module of its lot.
 */
import type { ComponentType } from 'react';
import { MessagesCard } from '../messages/MessagesCard';
import { ReviewCard } from '../team/ReviewCard';
import { ActivityCard } from './ActivityCard';
import { AgendaCard } from './AgendaCard';
import { DesignerCard } from './DesignerCard';
import { GaugesCard } from './GaugesCard';
import { MethodCard } from './MethodCard';
import { MissionCard } from './MissionCard';
import { ShortcutsCard } from './ShortcutsCard';
import { TeamCard } from './TeamCard';

export interface DeskCard {
  id: string;
  column: 'main' | 'side';
  Component: ComponentType;
  designerOnly?: boolean;
}

export const DESK_CARDS: readonly DeskCard[] = [
  { id: 'messages', column: 'main', Component: MessagesCard },
  { id: 'mission', column: 'main', Component: MissionCard },
  { id: 'agenda', column: 'main', Component: AgendaCard },
  { id: 'method', column: 'side', Component: MethodCard },
  { id: 'gauges', column: 'side', Component: GaugesCard },
  { id: 'review', column: 'side', Component: ReviewCard },
  { id: 'team', column: 'side', Component: TeamCard },
  { id: 'activity', column: 'side', Component: ActivityCard },
  { id: 'shortcuts', column: 'side', Component: ShortcutsCard },
  { id: 'designer', column: 'side', Component: DesignerCard, designerOnly: true },
];
