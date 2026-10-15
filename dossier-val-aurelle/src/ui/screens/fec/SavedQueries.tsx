/** Saved FEC queries (game state): save the current query, load or delete a saved one. */
import { useState, type FormEvent, type RefObject } from 'react';
import { formatDateFr } from '../../../engine/dates';
import { describeQuery, sameQuery, type FecQuery } from '../../../game/fec-query';
import { deleteQuery, saveQuery, type SavedQuery } from '../../../game/state';
import { useGame } from '../../app/store';
import { Badge, Button } from '../../components/ui';

export interface SavedQueriesProps {
  query: FecQuery;
  onLoad: (saved: SavedQuery) => void;
  nameRef: RefObject<HTMLInputElement | null>;
}

export function SavedQueries({ query, onLoad, nameRef }: SavedQueriesProps) {
  const saved = useGame((s) => s.game.savedQueries);
  const act = useGame((s) => s.act);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const current = describeQuery(query);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    act((s) => saveQuery(s, clean, query));
    setName('');
    setMessage(`Requête « ${clean} » enregistrée.`);
  };

  return (
    <div className="grid gap-x-5 gap-y-3 p-3 md:grid-cols-[17rem_minmax(0,1fr)]">
      <form onSubmit={submit} aria-label="Enregistrer la requête en cours" className="min-w-0 space-y-1.5">
        <label htmlFor="fec-query-name" className="block text-xs font-medium text-muted">
          Nom de la requête en cours
        </label>
        <input id="fec-query-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="Ex. : écritures du week-end" className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm placeholder:text-muted" />
        <p className="text-[11px] leading-snug text-muted">{current.length ? `Filtres : ${current.join(' · ')}.` : 'Aucun filtre : la requête porte sur tout le FEC.'}</p>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Enregistrer la requête
        </Button>
        <p aria-live="polite" className="min-h-4 text-[11px] text-ok">
          {message}
        </p>
      </form>

      <div className="min-w-0">
        <h3 className="mb-1 text-xs font-medium text-muted">Requêtes enregistrées ({saved.length})</h3>
        {saved.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-4 text-xs text-muted">
            Aucune requête enregistrée. Les requêtes sont conservées dans la sauvegarde de la partie et accessibles depuis la palette de commandes (Ctrl K).
          </p>
        ) : (
          <ul aria-label="Requêtes enregistrées" className="divide-y divide-line rounded-md border border-line">
            {saved.map((s) => {
              const parts = describeQuery(s.query);
              const summary = parts.length ? parts.join(' · ') : 'aucun filtre (FEC complet)';
              const active = sameQuery(s.query, query);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium" title={s.name}>
                        {s.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{formatDateFr(s.createdOn)}</span>
                    </p>
                    <p className="truncate text-[11px] text-muted" title={summary}>
                      {summary}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {active && <Badge tone="accent">Affichée</Badge>}
                    <Button
                      className="px-2 py-0.5 text-xs"
                      onClick={() => {
                        onLoad(s);
                        setMessage(`Requête « ${s.name} » chargée.`);
                      }}
                      aria-label={`Charger la requête « ${s.name} »`}
                    >
                      Charger
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-0.5 text-xs"
                      onClick={() => {
                        act((st) => deleteQuery(st, s.id));
                        setMessage(`Requête « ${s.name} » supprimée.`);
                      }}
                      aria-label={`Supprimer la requête « ${s.name} »`}
                    >
                      Supprimer
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
