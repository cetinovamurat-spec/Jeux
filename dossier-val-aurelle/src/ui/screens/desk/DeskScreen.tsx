/**
 * Bureau (route '/'): home of the senior auditor — latest message (the
 * partner's message of the phase), engagement card, agenda, method, gauges,
 * team and budget, activity, shortcuts. The cards come from the registry
 * cards.ts.
 */
import { formatDateFr } from '../../../engine/dates';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { dismissLoadNotice, useLoadNotice } from '../../app/store';
import { Button, PageHeader } from '../../components/ui';
import { DESK_CARDS } from './cards';

export function DeskScreen() {
  const c = useCase();
  const designer = useDesigner();
  const { entity, years } = c.params.scenario;
  const notice = useLoadNotice((s) => s.notice);
  const cards = DESK_CARDS.filter((k) => designer || !k.designerOnly);

  return (
    <div className="@container">
      <PageHeader title="Bureau" description={`${entity.name} – commissariat aux comptes, exercice clos le ${formatDateFr(`${years.current}-12-31`)}`} />
      {notice && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-warn/40 bg-warn/10 px-4 py-2 text-sm">
          <div className="flex-1">
            {notice.restarted && <p>Votre partie précédente a été enregistrée dans un format antérieur : la mission reprend au début de la planification. Vos réglages, vos marques de pointage et vos requêtes enregistrées sont conservés.</p>}
            {notice.contentChanged && (
              <p className={notice.restarted ? 'mt-1' : undefined}>
                {notice.removed.length > 0
                  ? 'Le dossier a changé depuis votre dernière sauvegarde : les références de vos travaux qui n’existent plus ont été retirées.'
                  : 'Le dossier a changé depuis votre dernière sauvegarde : vos travaux ne contenaient aucune référence devenue sans objet.'}
              </p>
            )}
            {notice.removed.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {notice.removed.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
          <Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={dismissLoadNotice}>
            Fermer
          </Button>
        </div>
      )}
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-4">
          {cards.filter((k) => k.column === 'main').map(({ id, Component }) => (
            <Component key={id} />
          ))}
        </div>
        <div className="grid min-w-0 content-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-1">
          {cards.filter((k) => k.column === 'side').map(({ id, Component }) => (
            <Component key={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
