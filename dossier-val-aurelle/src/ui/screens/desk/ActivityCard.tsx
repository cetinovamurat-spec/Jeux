/** Desk: activity counters and the latest events of the mission journal. */
import { useMemo } from 'react';
import { useGedDocuments } from '../ged/replies';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Card, EmptyState } from '../../components/ui';
import { describeEvent, latestEvents } from './journal';

const LATEST = 12;

function Counter({ label, value, of, to }: { label: string; value: number; of?: number; to: string }) {
  return (
    <Link to={to} className="block rounded-md border border-line px-2.5 py-2 hover:bg-sunken">
      <span className="block text-xs text-muted">{label}</span>
      <span className="mt-0.5 block font-mono text-lg font-semibold leading-tight">
        {value}
        {of !== undefined && <span className="text-sm font-normal text-muted"> / {of}</span>}
      </span>
    </Link>
  );
}

export function ActivityCard() {
  const c = useCase();
  const available = useGedDocuments().available;
  const docs = useGame((s) => s.game.documents);
  const ticks = useGame((s) => s.game.ticks);
  const savedQueries = useGame((s) => s.game.savedQueries);
  const journal = useGame((s) => s.game.journal);

  const counts = useMemo(() => {
    let read = 0;
    for (const d of available) if (docs[d.id]?.readOn) read++;
    let evidence = 0;
    let annotations = 0;
    for (const d of Object.values(docs)) {
      if (d.evidence) evidence++;
      annotations += d.annotations.length;
    }
    return { read, available: available.length, evidence, annotations, ticks: Object.keys(ticks).length, queries: savedQueries.length };
  }, [available, docs, ticks, savedQueries]);

  const events = useMemo(() => {
    const ctx = { docTitle: (id: string) => c.documentsById.get(id)?.title, savedQueries };
    return latestEvents(journal, LATEST).map(({ event, index }) => ({ index, on: event.on, view: describeEvent(event, ctx) }));
  }, [c, journal, savedQueries]);

  return (
    <Card title="Activité" actions={journal.length > 0 ? <span className="text-xs text-muted">{journal.length} action{journal.length > 1 ? 's' : ''} au journal</span> : undefined}>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        <Counter label="Documents consultés" value={counts.read} of={counts.available} to="/ged" />
        <Counter label="Pièces probantes" value={counts.evidence} to="/ged" />
        <Counter label="Annotations" value={counts.annotations} to="/ged" />
        <Counter label="Cellules pointées" value={counts.ticks} to="/etats" />
        <Counter label="Requêtes FEC" value={counts.queries} to="/fec" />
      </div>
      <section aria-labelledby="desk-journal" className="border-t border-line">
        <h3 id="desk-journal" className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Journal de mission – dernières actions
        </h3>
        {events.length === 0 ? (
          <EmptyState>Aucune action enregistrée pour l’instant. Commencez par le dossier permanent dans la GED.</EmptyState>
        ) : (
          <ol className="divide-y divide-line pb-1">
            {events.map(({ index, on, view }) => (
              <li key={index} className="flex gap-3 px-3 py-1.5 text-sm">
                <span className="shrink-0 pt-px font-mono text-xs text-muted">{formatDateFr(on)}</span>
                <span className="min-w-0">
                  <span className="text-muted">{view.text}</span>{' '}
                  {view.subject !== undefined &&
                    (view.to ? (
                      <Link to={view.to} className="text-accent hover:underline">
                        {view.subject}
                      </Link>
                    ) : (
                      <span>{view.subject}</span>
                    ))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Card>
  );
}
