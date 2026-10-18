/**
 * GED – « Demandes et confirmations » (plan J4 §8, §9): the catalogue of the
 * document requests (family × object chosen in a list built from the data),
 * the requests sent (answer due, « pas encore établi », documents received,
 * reminders) and the external confirmations (preparation, then tracker).
 */
import { useId, useMemo, useState } from 'react';
import { formatDateFr } from '../../../engine/dates';
import { workCalendar } from '../../../game/calendar';
import { answerDate, delayDays, familyOf, interlocutorOf, remindRequest, requestKey, requestObjects, sendRequest } from '../../../game/requests';
import { fold } from '../../../game/text';
import { requestLabel } from '../../../scenario/documents';
import type { RequestFamily } from '../../../scenario/schemas/requests';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Button, Card, cx, Select, TextInput } from '../../components/ui';
import { entryIdsByNumber } from '../fec/entryKey';
import { ConfirmationsPanel } from '../tools/ConfirmationsPanel';
import { ReceivedLinks, REQUEST_STATE_TONE, requestStateText, useThirdPartyName } from '../tools/RequestControls';
import { useGedView } from './gedStore';
import { delayText, interlocutorText, plural } from './labels';
import { useRequestRows } from './replies';

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthText = (m: string) => `${MONTHS_FR[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;

function hours(h: number): string {
  return h.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

/** Object picker of a family: none, programme and month, FEC entry, or a filtered list. */
function ObjectPicker({ family, value, onChange, idPrefix }: { family: RequestFamily; value: string; onChange: (v: string) => void; idPrefix: string }) {
  const c = useCase();
  const [filter, setFilter] = useState('');
  const objects = useMemo(() => requestObjects(c.params, c.datasets, family.id), [c, family.id]);
  const label = family.objectLabel ?? 'Objet';

  if (family.parameter === 'none') return <p className="text-sm text-muted">Cette demande ne porte sur aucun objet particulier.</p>;

  if (family.parameter === 'programmeMonth') {
    const programmes = [...new Map(objects.map((o) => [o.id.split(':')[0]!, o.label.replace(/, [^,]+$/, '')])).entries()];
    const months = [...new Set(objects.map((o) => o.id.split(':')[1]!))].sort();
    const [p, m] = value.includes(':') ? (value.split(':') as [string, string]) : [programmes[0]?.[0] ?? '', months[months.length - 1] ?? ''];
    return (
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">
          <span className="block text-xs text-muted">Programme</span>
          <Select value={p} onChange={(e) => onChange(`${e.target.value}:${m}`)}>
            {programmes.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-muted">Mois</span>
          <Select value={m} onChange={(e) => onChange(`${p}:${e.target.value}`)}>
            {months.map((x) => (
              <option key={x} value={x}>
                {monthText(x)}
              </option>
            ))}
          </Select>
        </label>
      </div>
    );
  }

  if (family.parameter === 'fecEntry') {
    const [y, n] = value.includes(':') ? (value.split(':') as [string, string]) : ['2025', ''];
    return (
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block text-xs text-muted">Exercice</span>
          <Select value={y} onChange={(e) => onChange(`${e.target.value}:${n}`)}>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </Select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-muted">Numéro de l’écriture (FEC)</span>
          <TextInput value={n} onChange={(e) => onChange(`${y}:${e.target.value.trim().toUpperCase()}`)} placeholder="OD000123" spellCheck={false} autoComplete="off" className="w-36 font-mono" />
        </label>
        <p className="text-xs text-muted">Le bouton « Demander la pièce » est aussi proposé sur les éléments d’un échantillon.</p>
      </div>
    );
  }

  const words = fold(filter).split(/\s+/).filter(Boolean);
  const shown = words.length ? objects.filter((o) => words.every((w) => fold(o.label).includes(w))) : objects;
  const current = shown.some((o) => o.id === value) ? value : '';
  return (
    <div className="grid gap-1.5">
      {objects.length > 8 && (
        <label className="text-sm">
          <span className="block text-xs text-muted">Filtrer la liste</span>
          <TextInput type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nom, mois…" className="w-full max-w-sm" autoComplete="off" />
        </label>
      )}
      <label className="text-sm" htmlFor={`${idPrefix}-object`}>
        <span className="block text-xs text-muted">
          {label} ({plural(shown.length, 'choix', 'choix')})
        </span>
      </label>
      <select id={`${idPrefix}-object`} size={Math.min(8, Math.max(3, shown.length))} value={current} onChange={(e) => onChange(e.target.value)} className="w-full max-w-xl rounded-md border border-line bg-panel px-1 py-1 text-sm">
        {shown.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Catalogue() {
  const c = useCase();
  const params = c.params;
  const act = useGame((s) => s.act);
  const items = useGame((s) => s.game.requests.items);
  const date = useGame((s) => s.game.clock.date);
  const difficulty = useGame((s) => s.game.difficulty);
  const view = useGedView();
  const idPrefix = useId();
  const family = familyOf(params, view.family) ?? params.requests.families[0]!;
  const [objects, setObjects] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string | null>(null);
  const tpName = useThirdPartyName();
  const cal = useMemo(() => workCalendar(params), [params]);
  const isEntry = family.parameter === 'fecEntry';
  // the FEC indexes are built only when an entry is being typed
  const fecNumbers = useMemo(() => (isEntry ? { 2025: entryIdsByNumber(c.fecIndex(2025)), 2024: entryIdsByNumber(c.fecIndex(2024)) } : null), [c, isEntry]);

  const list = useMemo(() => requestObjects(params, c.datasets, family.id), [params, c, family.id]);
  const defaultObject = family.parameter === 'none' ? '' : family.parameter === 'fecEntry' ? '2025:' : family.parameter === 'programmeMonth' ? (list[list.length - 1]?.id ?? '') : (list[0]?.id ?? '');
  const object = objects[family.id] ?? defaultObject;
  const valid = (() => {
    if (family.parameter === 'none') return true;
    if (family.parameter === 'fecEntry') {
      const [y, n] = object.split(':');
      return !!n && !!fecNumbers && (y === '2024' ? fecNumbers[2024] : fecNumbers[2025]).has(n);
    }
    return list.some((o) => o.id === object);
  })();
  const previous = items.filter((x) => x.family === family.id && x.object === object);
  const who = interlocutorOf(params, family.id, object);
  const delay = delayDays(params, family.id, object, difficulty);

  const send = () => {
    act((s) => sendRequest(s, family.id, object, params));
    const due = answerDate(params, cal, { id: '', family: family.id, object, sentOn: date, difficulty });
    setSent(`Demande envoyée le ${formatDateFr(date)} à ${interlocutorText(params, who)} : « ${requestLabel(params, family.id, object, tpName)} ». Réponse attendue le ${formatDateFr(due)}.`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <h3 id={`${idPrefix}-families`} className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Types de demandes
        </h3>
        <ul aria-labelledby={`${idPrefix}-families`} className="divide-y divide-line rounded-md border border-line">
          {params.requests.families.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={f.id === family.id}
                onClick={() => {
                  view.update({ family: f.id });
                  setSent(null);
                }}
                className={cx('block w-full px-3 py-1.5 text-left text-sm hover:bg-sunken', f.id === family.id && 'bg-accent-soft font-semibold text-accent')}
              >
                {f.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{family.label}</h3>
          <p className="text-sm text-muted">{family.description}</p>
          <p className="mt-1 text-xs text-muted">
            Interlocuteur : {interlocutorText(params, who)} – réponse sous {delayText(delay)} ; coût : {hours(params.requests.costHours.request)} h de votre temps. Une pièce n’est jamais remise avant d’avoir été établie.
          </p>
        </div>
        <ObjectPicker key={family.id} family={family} value={object} idPrefix={`${idPrefix}-${family.id}`} onChange={(v) => setObjects((o) => ({ ...o, [family.id]: v }))} />
        {family.parameter === 'fecEntry' && object.split(':')[1] && !valid && <p className="text-sm text-warn">Aucune écriture de ce numéro dans le FEC disponible de l’exercice.</p>}
        {previous.length > 0 && (
          <p className="text-sm text-warn">
            Déjà demandée le {formatDateFr(previous[0]!.sentOn)} : une demande en double est mal perçue par le client.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={!valid} onClick={send}>
            Envoyer la demande
          </Button>
        </div>
        <p aria-live="polite" className="text-sm text-ok">
          {sent}
        </p>
      </div>
    </div>
  );
}

function Tracker() {
  const c = useCase();
  const params = c.params;
  const act = useGame((s) => s.act);
  const date = useGame((s) => s.game.clock.date);
  const rows = useRequestRows();
  const tpName = useThirdPartyName();
  if (!rows.length) return <p className="px-3 py-6 text-center text-sm text-muted">Aucune demande envoyée.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Demandes de pièces envoyées, de la plus récente à la plus ancienne</caption>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="px-3 py-1.5 text-left font-medium">
              Envoyée le
            </th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Demande
            </th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Interlocuteur
            </th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Statut
            </th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">
              <span className="sr-only">Relance</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = requestKey(r.item.family, r.item.object);
            return (
              <tr key={r.item.id} className="border-b border-line align-top last:border-b-0">
                <td className="px-3 py-1.5 font-mono text-xs">{formatDateFr(r.item.sentOn)}</td>
                <th scope="row" className="px-2 py-1.5 text-left font-normal">
                  {requestLabel(params, r.item.family, r.item.object, tpName)}
                  <ReceivedLinks row={r} className="mt-1 text-xs" />
                </th>
                <td className="px-2 py-1.5 text-xs text-muted">{interlocutorText(params, interlocutorOf(params, r.item.family, r.item.object))}</td>
                <td className="px-2 py-1.5">
                  <Badge tone={REQUEST_STATE_TONE[r.status.state]}>{{ waiting: 'En attente', notYetEstablished: 'Pas encore établi', partial: 'Reçue en partie', received: 'Reçue' }[r.status.state]}</Badge>
                  <span className="mt-0.5 block text-xs text-muted">{requestStateText(r.status)}</span>
                  {r.item.remindedOn && <span className="block text-xs text-muted">Relancée le {formatDateFr(r.item.remindedOn)}</span>}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {r.status.canRemind && (
                    <Button className="px-1.5 py-0 text-xs" disabled={r.item.remindedOn === date} onClick={() => act((s) => remindRequest(s, r.item.id, params))} title={`Relancer (${hours(params.requests.costHours.reminder)} h)`} aria-label={`Relancer la demande : ${requestLabel(params, r.item.family, r.item.object, tpName)}`} data-key={k}>
                      Relancer
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RequestsTab() {
  return (
    <div className="space-y-4">
      <Card title="Demander une pièce">
        <div className="p-3">
          <Catalogue />
        </div>
      </Card>
      <Card title="Demandes envoyées">
        <Tracker />
      </Card>
      <Card title="Demandes de confirmation des tiers">
        <div className="p-3">
          <ConfirmationsPanel idPrefix="ged-conf" />
        </div>
      </Card>
    </div>
  );
}
