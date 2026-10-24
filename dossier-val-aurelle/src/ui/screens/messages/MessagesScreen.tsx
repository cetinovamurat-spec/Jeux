/**
 * Messagerie (route '/messagerie', '/messagerie/:id', plan J5 §11, §17): the
 * messages received at the game date, most recent first, with their read
 * marks; opening a message marks it read. The inbox is derived
 * (game/messages.ts): a clock moved back hides the later messages.
 */
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { isRead, markMessageRead } from '../../../game/messages';
import { useCase } from '../../app/context';
import { useInbox } from '../../app/hooks';
import { useGame } from '../../app/store';
import { Card, cx, EmptyState, PageHeader } from '../../components/ui';
import { senderOf } from './labels';
import { MessageView } from './MessageView';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

export function MessagesScreen() {
  const c = useCase();
  const { id } = useParams();
  const messages = useInbox();
  const act = useGame((s) => s.act);
  const date = useGame((s) => s.game.clock.date);
  const read = useGame((s) => s.game.messages);
  const selected = id ? messages.find((m) => m.id === id) : undefined;
  const unread = messages.filter((m) => !isRead({ messages: read }, m.id, date)).length;

  useEffect(() => {
    if (selected) act((s) => markMessageRead(s, selected.id));
  }, [selected, act]);

  return (
    <div>
      <PageHeader
        title="Messagerie"
        description={messages.length === 0 ? 'Aucun message reçu à cette date.' : `${plural(messages.length, 'message reçu', 'messages reçus')} à la date du dossier, dont ${plural(unread, 'non lu', 'non lus')}.`}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,2fr)_minmax(0,3fr)]">
        <Card title="Boîte de réception">
          {messages.length === 0 ? (
            <EmptyState>Aucun message.</EmptyState>
          ) : (
            <ul className="divide-y divide-line" aria-label="Messages reçus">
              {messages.map((m) => {
                const isUnread = !isRead({ messages: read }, m.id, date);
                const active = selected?.id === m.id;
                return (
                  <li key={m.id}>
                    <Link
                      to={`/messagerie/${encodeURIComponent(m.id)}`}
                      aria-current={active ? 'true' : undefined}
                      className={cx('block px-3 py-2 text-sm hover:bg-sunken', active && 'bg-accent-soft')}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cx('truncate', isUnread && 'font-semibold')}>
                          {isUnread && (
                            <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-accent align-middle" />
                          )}
                          {senderOf(c.params, m.from).name}
                          {isUnread && <span className="sr-only"> (non lu)</span>}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted">{formatDateFr(m.on)}</span>
                      </span>
                      <span className={cx('block truncate text-xs', isUnread ? 'text-ink' : 'text-muted')}>{m.subject}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {selected ? (
          <Card title={selected.subject} actions={<span className="text-xs text-muted">Reçu le {formatDateFr(selected.on)}</span>}>
            <MessageView message={selected} />
          </Card>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{id ? 'Ce message n’est pas dans la boîte de réception à la date du dossier.' : 'Choisissez un message pour le lire.'}</p>
        )}
      </div>
    </div>
  );
}
