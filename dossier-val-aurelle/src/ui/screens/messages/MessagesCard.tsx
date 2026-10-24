/** Desk: the latest message received (the partner's message of the phase, from J4), with its date of receipt. */
import { formatDateFr } from '../../../engine/dates';
import { useCase } from '../../app/context';
import { useInbox } from '../../app/hooks';
import { Card, EmptyState } from '../../components/ui';
import { senderOf } from './labels';
import { MessageView } from './MessageView';

export function MessagesCard() {
  const c = useCase();
  const latest = useInbox()[0];
  if (!latest)
    return (
      <Card title="Messages">
        <EmptyState>Aucun message reçu à cette date.</EmptyState>
      </Card>
    );
  const sender = senderOf(c.params, latest.from);
  return (
    <Card title={`Message de ${sender.name}`} actions={<span className="text-xs text-muted">Reçu le {formatDateFr(latest.on)}</span>}>
      <MessageView message={latest} />
    </Card>
  );
}
