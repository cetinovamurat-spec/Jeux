/**
 * Desk, designer mode only: document availability for the player at the game
 * date and coverage of the clues by the documents read so far.
 */
import { useMemo } from 'react';
import { isAvailable, type AvailabilityContext } from '../../../game/documents';
import type { DocumentModel } from '../../../scenario/documents';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Card } from '../../components/ui';

type AvailabilityKind = DocumentModel['availability']['kind'];

const AVAILABILITY_LABEL: Record<AvailabilityKind, string> = {
  initial: 'base documentaire initiale',
  afterDate: 'courrier daté',
  onRequest: 'sur demande',
  confirmation: 'réponses de confirmation',
  conditional: 'conditionnels',
};

interface TargetCoverage {
  target: string;
  total: number;
  read: number;
}

function targetOrder(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { numeric: true });
}

export function DesignerCard() {
  const c = useCase();
  const date = useGame((s) => s.game.clock.date);
  const docs = useGame((s) => s.game.documents);

  const stats = useMemo(() => {
    const ctx: AvailabilityContext = { date, designer: false, answeredRequests: new Set(), sentConfirmations: new Set(), conditions: new Set() };
    const byKind = new Map<AvailabilityKind, { total: number; available: number }>();
    let available = 0;
    let read = 0;
    let cluesTotal = 0;
    let cluesRead = 0;
    const targets = new Map<string, TargetCoverage>();
    for (const d of c.documents) {
      const k = byKind.get(d.availability.kind) ?? { total: 0, available: 0 };
      k.total++;
      if (isAvailable(d, ctx)) {
        k.available++;
        available++;
      }
      byKind.set(d.availability.kind, k);
      const isRead = Boolean(docs[d.id]?.readOn);
      if (isRead) read++;
      for (const clue of d.clues) {
        cluesTotal++;
        const t = targets.get(clue.target) ?? { target: clue.target, total: 0, read: 0 };
        t.total++;
        if (isRead) {
          t.read++;
          cluesRead++;
        }
        targets.set(clue.target, t);
      }
    }
    const all = [...targets.values()].sort((a, b) => targetOrder(a.target, b.target));
    return {
      available,
      read,
      cluesTotal,
      cluesRead,
      byKind: [...byKind.entries()],
      anomalies: all.filter((t) => t.target.startsWith('A')),
      falseLeads: all.filter((t) => t.target.startsWith('F')),
    };
  }, [c, date, docs]);

  const touched = (list: TargetCoverage[]) => list.filter((t) => t.read > 0).length;

  return (
    <Card title="Diagnostic concepteur" actions={<Badge tone="warn">Concepteur</Badge>}>
      <div className="space-y-3 px-3 py-2.5 text-sm">
        <dl className="space-y-1">
          <div className="flex justify-between gap-3">
            <dt>Documents du dossier</dt>
            <dd className="font-mono">{c.documents.length}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Disponibles pour le joueur à cette date</dt>
            <dd className="font-mono">{stats.available}</dd>
          </div>
          {stats.byKind.map(([kind, k]) => (
            <div key={kind} className="flex justify-between gap-3 pl-3 text-xs text-muted">
              <dt>dont {AVAILABILITY_LABEL[kind]}</dt>
              <dd className="font-mono">
                {k.available} / {k.total}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-3">
            <dt>Documents consultés</dt>
            <dd className="font-mono">{stats.read}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Indices dans les documents consultés</dt>
            <dd className="font-mono">
              {stats.cluesRead} / {stats.cluesTotal}
            </dd>
          </div>
        </dl>
        <div>
          <p className="mb-1 text-xs text-muted">
            Anomalies dont au moins un indice a été consulté : {touched(stats.anomalies)} / {stats.anomalies.length}
          </p>
          <ul className="flex flex-wrap gap-1" aria-label="Couverture des anomalies par les indices consultés">
            {stats.anomalies.map((t) => (
              <li key={t.target}>
                <Badge tone={t.read > 0 ? 'ok' : 'muted'} title={`${t.target} : ${t.read} indice(s) consulté(s) sur ${t.total}`}>
                  {t.target} {t.read}/{t.total}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">
            Fausses pistes rencontrées : {touched(stats.falseLeads)} / {stats.falseLeads.length}
          </p>
          <ul className="flex flex-wrap gap-1" aria-label="Fausses pistes rencontrées">
            {stats.falseLeads.map((t) => (
              <li key={t.target}>
                <Badge tone={t.read > 0 ? 'warn' : 'muted'} title={`${t.target} : ${t.read} indice(s) consulté(s) sur ${t.total}`}>
                  {t.target} {t.read}/{t.total}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
