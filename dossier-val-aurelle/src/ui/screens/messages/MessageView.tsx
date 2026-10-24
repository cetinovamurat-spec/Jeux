/** Body of a message: paragraphs, steps linked to the screens, closing, signature of the sender. */
import { Link } from 'react-router';
import type { Message } from '../../../game/messages';
import { useCase } from '../../app/context';
import { navLabel, senderOf } from './labels';

export function MessageView({ message: m }: { message: Message }) {
  const c = useCase();
  const sender = senderOf(c.params, m.from);
  return (
    <article className="space-y-2 px-4 py-3 text-sm leading-relaxed">
      {m.body.map((p, i) => (
        <p key={`b${i}`}>{p}</p>
      ))}
      {m.links.length > 0 && (
        <ol className="list-decimal space-y-1 pl-6">
          {m.links.map((l, i) => (
            <li key={i} {...(l.tutorial ? { 'data-tutorial': l.tutorial } : {})}>
              <Link to={l.to} className="font-medium text-accent hover:underline">
                {navLabel(l.to)}
              </Link>
              {l.text ? <> – {l.text}</> : null}
            </li>
          ))}
        </ol>
      )}
      {(m.closing ?? []).map((p, i) => (
        <p key={`c${i}`}>{p}</p>
      ))}
      <p className="pt-1">
        <span className="font-semibold">{sender.name}</span>
        {sender.role && (
          <span className="text-muted">
            {' '}
            – {sender.role}
            {sender.firm ? `, ${sender.firm}` : ''}
          </span>
        )}
      </p>
    </article>
  );
}
