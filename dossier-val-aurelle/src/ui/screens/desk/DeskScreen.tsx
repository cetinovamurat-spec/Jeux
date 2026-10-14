/**
 * Bureau (route '/'): home of the senior auditor — partner's welcome message,
 * engagement card, agenda, gauges, team and budget, activity, shortcuts.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { periodAt } from '../../../game/clock';
import { useCase } from '../../app/context';
import { useAvailableDocuments, useDesigner } from '../../app/hooks';
import { NAV } from '../../app/routes';
import { Badge, Card, Kbd, PageHeader } from '../../components/ui';
import { ActivityCard } from './ActivityCard';
import { AgendaCard } from './AgendaCard';
import { DesignerCard } from './DesignerCard';
import { GaugesCard } from './GaugesCard';
import { MissionCard } from './MissionCard';
import { TeamCard } from './TeamCard';

function navLabel(to: string): string {
  return NAV.find((n) => n.to === to)?.label ?? to;
}

/** Static welcome message of the signing partner (no amount, no hint). */
function PartnerMessage() {
  const c = useCase();
  const available = useAvailableDocuments();
  const { firm, calendar, startDate } = c.params.game;
  const partner = firm.find((f) => f.id === 'partner') ?? firm[0];
  const manager = firm.find((f) => f.id === 'manager');
  const { entity, years } = c.params.scenario;
  const permanent = available.filter((d) => d.category === 'permanent').length;
  // The message is dated at the start of the game: phase of that date.
  const period = useMemo(() => periodAt(calendar, startDate).current, [calendar, startDate]);

  const steps: { to: string; text: string }[] = [
    {
      to: '/ged',
      text: `le dossier permanent${permanent > 0 ? ` (${permanent} pièce${permanent > 1 ? 's' : ''} disponible${permanent > 1 ? 's' : ''})` : ''}, pour reprendre connaissance de l’entité et de son environnement ;`,
    },
    { to: '/balance', text: 'la balance générale N / N-1, pour repérer les variations à expliquer ;' },
    { to: '/fec', text: 'le fichier des écritures comptables, pour préparer les tests d’écritures ;' },
    { to: '/etats', text: `le projet d’états financiers, à pointer sur la balance et, pour le comparatif, sur les comptes certifiés ${years.prior}.` },
  ];

  return (
    <Card
      title={partner ? `Message de ${partner.name}` : 'Message de l’associée'}
      actions={<span className="text-xs text-muted">Reçu le {formatDateFr(startDate)}</span>}
    >
      <article className="space-y-2 px-4 py-3 text-sm leading-relaxed">
        <p>Bonjour,</p>
        <p>
          Vous prenez en charge le dossier <span className="font-semibold">{entity.name}</span> pour l’exercice clos le {formatDateFr(`${years.current}-12-31`)}
          {period ? (
            <>
              {' '}
              ; nous sommes en phase « {period.label} »
            </>
          ) : null}
          . Avant d’engager les contrôles, je vous propose de commencer par :
        </p>
        <ol className="list-decimal space-y-1 pl-6">
          {steps.map((s) => (
            <li key={s.to}>
              <Link to={s.to} className="font-medium text-accent hover:underline">
                {navLabel(s.to)}
              </Link>{' '}
              – {s.text}
            </li>
          ))}
        </ol>
        <p>
          {manager ? `${manager.name} reste disponible pour les questions de méthode et le suivi du budget. ` : ''}
          Remontez-moi au fil de l’eau les sujets sensibles : je préfère une alerte précoce à une surprise en fin de mission.
        </p>
        {partner && (
          <p className="pt-1">
            <span className="font-semibold">{partner.name}</span>
            <span className="text-muted"> – {partner.role}, Sequana Audit</span>
          </p>
        )}
      </article>
    </Card>
  );
}

function Shortcuts({ designer }: { designer: boolean }) {
  const items = NAV.filter((n) => n.to !== '/' && (designer || !n.designerOnly));
  return (
    <Card
      title="Accès rapides"
      className="@container"
      actions={
        <span className="text-xs text-muted">
          Palette de commandes : <Kbd>Ctrl K</Kbd>
        </span>
      }
    >
      <ul className="grid gap-2 p-3 @lg:grid-cols-2">
        {items.map((n) => (
          <li key={n.to}>
            <Link to={n.to} className="flex h-full flex-col rounded-md border border-line px-3 py-2 hover:border-accent/60 hover:bg-accent-soft">
              <span className="flex items-center gap-2 text-sm font-semibold text-accent">
                {n.label}
                {n.designerOnly && <Badge tone="warn">Concepteur</Badge>}
              </span>
              <span className="mt-0.5 text-xs text-muted">{n.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DeskScreen() {
  const c = useCase();
  const designer = useDesigner();
  const { entity, years } = c.params.scenario;

  return (
    <div className="@container">
      <PageHeader title="Bureau" description={`${entity.name} – commissariat aux comptes, exercice clos le ${formatDateFr(`${years.current}-12-31`)}`} />
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-4">
          <PartnerMessage />
          <MissionCard />
          <AgendaCard />
        </div>
        <div className="grid min-w-0 content-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-1">
          <GaugesCard />
          <TeamCard />
          <ActivityCard />
          <Shortcuts designer={designer} />
          {designer && <DesignerCard />}
        </div>
      </div>
    </div>
  );
}
