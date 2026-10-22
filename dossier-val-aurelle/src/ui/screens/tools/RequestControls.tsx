/**
 * Small controls of the document requests (plan J4 §8), shared by the GED, the
 * tools and the other screens: status of a request in words, « Demander la
 * pièce » button (sends the request, then shows its status and the documents
 * received), list of the requests of a procedure.
 */
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { delayDays, familyOf, interlocutorOf, notYetEstablishedText, requestKey, sendRequest, type RequestStatus } from '../../../game/requests';
import { requestLabel, requestObjectLabel } from '../../../scenario/documents';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Button, cx } from '../../components/ui';
import { delayText, interlocutorText } from '../ged/labels';
import { useRequestRows, type RequestRow } from '../ged/replies';

/** Name of a third party of the presented data (labels of the requests about a third party). */
export function useThirdPartyName(): (id: string) => string | undefined {
  const c = useCase();
  return (id: string) => c.datasets.thirdParties.find((t) => t.id === id)?.name;
}

/** Status of a request in words (never says whether a document carries anything). */
export function requestStateText(st: RequestStatus): string {
  switch (st.state) {
    case 'waiting':
      return `En attente – réponse attendue le ${formatDateFr(st.due)}`;
    case 'notYetEstablished': {
      const p = st.pending[0]!;
      return `${notYetEstablishedText(p.establishedOn)} Remise prévue le ${formatDateFr(p.servedOn)}.`;
    }
    case 'partial': {
      const next = st.pending.reduce((m, p) => (p.servedOn < m ? p.servedOn : m), st.pending[0]!.servedOn);
      return `Reçue en partie (${st.received.length} sur ${st.received.length + st.pending.length}) ; complément attendu le ${formatDateFr(next)}`;
    }
    case 'received': {
      const last = st.received.reduce((m, r) => (r.on > m ? r.on : m), st.received[0]?.on ?? st.due);
      return `Reçue le ${formatDateFr(last)}`;
    }
  }
}

export const REQUEST_STATE_TONE: Readonly<Record<RequestStatus['state'], 'muted' | 'warn' | 'accent' | 'ok'>> = { waiting: 'muted', notYetEstablished: 'warn', partial: 'accent', received: 'ok' };

/**
 * Row of a key that was requested: the latest request whose documents were
 * received (the most recent version of a reply dated on the request), else
 * the first request (the earliest answer).
 */
export function rowOfKey(rows: readonly RequestRow[], key: string): RequestRow | undefined {
  let first: RequestRow | undefined;
  let received: RequestRow | undefined;
  for (const r of rows) {
    if (requestKey(r.item.family, r.item.object) !== key) continue;
    if (!first || r.item.sentOn < first.item.sentOn) first = r;
    if (r.status.received.length > 0 && (!received || r.item.sentOn > received.item.sentOn)) received = r;
  }
  return received ?? first;
}

/** Links to the documents of a request received at the game date. */
export function ReceivedLinks({ row, className }: { row: RequestRow; className?: string }) {
  const received = new Set(row.status.received.map((r) => r.id));
  const docs = row.docs.filter((d) => received.has(d.id));
  if (!docs.length) return null;
  return (
    <ul className={cx('space-y-0.5', className)}>
      {docs.map((d) => (
        <li key={d.id}>
          <Link to={`/ged/${encodeURIComponent(d.id)}?onglet=documents`} className="text-accent underline-offset-2 hover:underline">
            {d.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * « Demander la pièce »: sends the request (family × object) at the game
 * date, a quarter of an hour of the senior; once sent, shows its status and
 * the documents received.
 */
export function RequestButton({ family, object, label = 'Demander la pièce', compact = false }: { family: string; object: string; label?: string; compact?: boolean }) {
  const c = useCase();
  const act = useGame((s) => s.act);
  const rows = useRequestRows();
  const difficulty = useGame((s) => s.game.difficulty);
  const key = requestKey(family, object);
  const row = rowOfKey(rows, key);
  const tpName = useThirdPartyName();
  const what = requestLabel(c.params, family, object, tpName);
  if (!familyOf(c.params, family)) return null;
  if (row) {
    const received = row.status.received.length > 0;
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-xs">
        <Badge tone={REQUEST_STATE_TONE[row.status.state]} title={requestStateText(row.status)}>
          {received ? 'Reçue' : row.status.state === 'notYetEstablished' ? 'Pas encore établie' : 'Demandée'}
        </Badge>
        {received && !compact && <ReceivedLinks row={row} className="text-xs" />}
        {received && compact && (
          <Link to={`/ged/${encodeURIComponent(row.docs.find((d) => row.status.received.some((r) => r.id === d.id))!.id)}?onglet=documents`} className="text-accent underline-offset-2 hover:underline" aria-label={`Lire la pièce reçue : ${what}`}>
            Lire
          </Link>
        )}
      </span>
    );
  }
  const who = interlocutorText(c.params, interlocutorOf(c.params, family, object));
  return (
    <Button
      className={compact ? 'px-1.5 py-0 text-xs' : undefined}
      title={`${what} – auprès de ${who}, réponse sous ${delayText(delayDays(c.params, family, object, difficulty))} (${c.params.requests.costHours.request.toLocaleString('fr-FR')} h)`}
      aria-label={`${label} : ${what}`}
      onClick={() => act((s) => sendRequest(s, family, object, c.params))}
    >
      {label}
    </Button>
  );
}

/** Requests of a procedure (output « demandes de pièces »): one line each, with its status. */
export function RequestList({ requests }: { requests: readonly { family: string; object?: string }[] }) {
  const c = useCase();
  const rows = useRequestRows();
  const tpName = useThirdPartyName();
  return (
    <ul className="divide-y divide-line rounded-md border border-line text-sm">
      {requests.map((r) => {
        const object = r.object ?? '';
        const row = rowOfKey(rows, requestKey(r.family, object));
        const f = familyOf(c.params, r.family);
        return (
          <li key={requestKey(r.family, object)} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="font-medium">{f?.label ?? r.family}</p>
              {object && <p className="text-xs text-muted">{requestObjectLabel(c.params, r.family, object, tpName)}</p>}
              <p className="text-xs text-muted">Auprès de {interlocutorText(c.params, interlocutorOf(c.params, r.family, object))}</p>
              {row && <p className="mt-0.5 text-xs">{requestStateText(row.status)}</p>}
              {row && <ReceivedLinks row={row} className="mt-1 text-xs" />}
            </div>
            {!row && <RequestButton family={r.family} object={object} label="Envoyer la demande" />}
          </li>
        );
      })}
    </ul>
  );
}
