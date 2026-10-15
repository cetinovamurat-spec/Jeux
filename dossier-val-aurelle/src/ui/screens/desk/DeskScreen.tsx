/**
 * Bureau (route '/'): home of the senior auditor — partner's welcome message,
 * engagement card, agenda, gauges, team and budget, activity, shortcuts.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { vintageDates } from '../../../game/vintages';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { NAV } from '../../app/routes';
import { takeLoadNotice, useGame } from '../../app/store';
import { Badge, Button, Card, Kbd, PageHeader } from '../../components/ui';
import { ActivityCard } from './ActivityCard';
import { AgendaCard } from './AgendaCard';
import { DesignerCard } from './DesignerCard';
import { GaugesCard } from './GaugesCard';
import { MissionCard } from './MissionCard';
import { TeamCard } from './TeamCard';

function navLabel(to: string): string {
  return NAV.find((n) => n.to === to)?.label ?? to;
}

type Step = { to: string; text: string };

interface PhaseMessage {
  /** Date of the message (start of the phase it opens). */
  on: string;
  intro: string;
  steps: Step[];
  outro: string;
}

/**
 * Message of the signing partner for the phase of the game date: it
 * prescribes the steps of the method, never a lead (no amount, no hint).
 */
function usePhaseMessage(): PhaseMessage {
  const c = useCase();
  const date = useGame((s) => s.game.clock.date);
  const { calendar, startDate } = c.params.game;
  const v = vintageDates(c.params);
  const at = (id: string) => calendar.find((p) => p.id === id);
  const interim = at('interim');
  const final = at('final');
  const sending = at('confirmations');
  const completion = at('completion');
  const d = (x: string | undefined) => (x ? formatDateFr(x) : '');
  const { years } = c.params.scenario;
  if (interim && date < interim.from) {
    return {
      on: startDate,
      intro: `Vous prenez en charge le dossier pour l’exercice clos le ${formatDateFr(`${years.current}-12-31`)}. Nous sommes en prise de connaissance et planification ; l’intérim commence le ${d(interim.from)}. Je vous propose :`,
      steps: [
        { to: '/ged', text: 'le dossier permanent, les procès-verbaux et les comptes certifiés de l’exercice précédent, pour reprendre connaissance de l’entité ;' },
        { to: '/ged', text: `une demande au chef comptable de l’extraction comptable au ${d(v.cutoff)}, pour la revue analytique préliminaire ;` },
        { to: '/planification', text: 'les seuils de signification, l’évaluation des risques et le programme de travail : partez du programme du cabinet et adaptez-le au dossier.' },
      ],
      outro: 'Je relirai seuils, risques et programme avant l’intérim.',
    };
  }
  if (interim && date <= interim.to) {
    return {
      on: interim.from,
      intro: `L’équipe vous rejoint pour l’intérim, jusqu’au ${d(interim.to)}. Au programme :`,
      steps: [
        { to: '/travaux', text: 'les prises de connaissance des procédures et les tests de contrôles, dont la revue de la migration du système d’information ;' },
        { to: '/ged', text: `la préparation des demandes de confirmation des tiers : elles partiront le ${d(sending?.from)} ;` },
        { to: '/balance', text: 'les premiers travaux sur l’extraction comptable.' },
      ],
      outro: 'Pensez à organiser le travail de l’équipe : chacun a ses heures et ses jours de présence.',
    };
  }
  if (final && date < final.from) {
    return {
      on: interim?.to ?? startDate,
      intro: `Nous sommes hors site jusqu’au final, qui commence le ${d(final.from)}. D’ici là :`,
      steps: [
        { to: '/ged', text: 'suivez vos demandes et les réponses des tiers ;' },
        { to: '/balance', text: `la balance et le FEC définitifs sont attendus le ${d(v.draftLedger)}, le projet d’états financiers le ${d(v.draftStatements)}.` },
      ],
      outro: 'Vous pouvez avancer d’événement en événement.',
    };
  }
  if (final && date <= final.to) {
    return {
      on: final.from,
      intro: `Le final se tient jusqu’au ${d(final.to)}. Le projet de comptes est remis :`,
      steps: [
        { to: '/planification', text: 'révisez vos seuils sur les chiffres définitifs ;' },
        { to: '/travaux', text: 'menez les travaux de substance prévus, avec l’équipe ;' },
        { to: '/etats', text: `pointez les états et l’annexe sur la balance, et le comparatif sur les comptes certifiés ${years.prior} ;` },
        { to: '/constats', text: 'documentez vos constats et concluez vos feuilles maîtresses.' },
      ],
      outro: 'Remontez-moi au fil de l’eau les sujets sensibles : je préfère une alerte précoce à une surprise en fin de mission.',
    };
  }
  return {
    on: final?.to ?? startDate,
    intro: `Le final est terminé. La synthèse ${completion ? `se tient à partir du ${d(completion.from)}` : 'suit'} ; jusqu’à la signature du rapport :`,
    steps: [
      { to: '/travaux', text: 'suivez les événements postérieurs à la clôture et mettez à jour vos travaux ;' },
      { to: '/constats', text: 'tenez à jour vos constats et le tableau des anomalies.' },
    ],
    outro: 'Seul le senior reste mobilisé sur le dossier après le final.',
  };
}

function PartnerMessage() {
  const c = useCase();
  const { firm, firmName } = c.params.game;
  const partner = firm.find((f) => f.id === 'partner') ?? firm[0];
  const manager = firm.find((f) => f.id === 'manager');
  const m = usePhaseMessage();
  return (
    <Card title={partner ? `Message de ${partner.name}` : 'Message de l’associée'} actions={<span className="text-xs text-muted">Reçu le {formatDateFr(m.on)}</span>}>
      <article className="space-y-2 px-4 py-3 text-sm leading-relaxed">
        <p>Bonjour,</p>
        <p>{m.intro}</p>
        <ol className="list-decimal space-y-1 pl-6">
          {m.steps.map((s, i) => (
            <li key={i}>
              <Link to={s.to} className="font-medium text-accent hover:underline">
                {navLabel(s.to)}
              </Link>{' '}
              – {s.text}
            </li>
          ))}
        </ol>
        <p>
          {manager ? `${manager.name} reste disponible pour les questions de méthode et le suivi du budget. ` : ''}
          {m.outro}
        </p>
        {partner && (
          <p className="pt-1">
            <span className="font-semibold">{partner.name}</span>
            <span className="text-muted"> – {partner.role}, {firmName}</span>
          </p>
        )}
      </article>
    </Card>
  );
}

/** Steps of the method validated by the player (prescriptive, never a lead). */
function MethodChecklist() {
  const validated = useGame((s) => s.game.planning.validated);
  const items: { label: string; on: string | undefined }[] = [
    { label: 'Seuils de signification', on: validated.materiality },
    { label: 'Évaluation des risques', on: validated.risks },
    { label: 'Programme de travail', on: validated.program },
  ];
  return (
    <Card title="Méthode" actions={<Link to="/planification" className="text-xs text-accent hover:underline">Planification</Link>}>
      <ul className="space-y-1 px-3 py-2 text-sm">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span aria-hidden className={it.on ? 'text-ok' : 'text-muted'}>
              {it.on ? '☑' : '☐'}
            </span>
            <span>{it.label}</span>
            <span className="ml-auto text-xs text-muted">{it.on ? `validé le ${formatDateFr(it.on)}` : 'à faire'}</span>
          </li>
        ))}
      </ul>
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
  const [notice, setNotice] = useState(() => takeLoadNotice());

  return (
    <div className="@container">
      <PageHeader title="Bureau" description={`${entity.name} – commissariat aux comptes, exercice clos le ${formatDateFr(`${years.current}-12-31`)}`} />
      {notice && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-warn/40 bg-warn/10 px-4 py-2 text-sm">
          <p className="flex-1">
            {notice === 'restarted'
              ? 'Votre partie précédente a été enregistrée dans un format antérieur : la mission reprend au début de la planification. Vos réglages, vos marques de pointage et vos requêtes enregistrées sont conservés.'
              : 'Le dossier a changé depuis votre dernière sauvegarde : certaines références de vos travaux peuvent ne plus exister.'}
          </p>
          <Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={() => setNotice(null)}>
            Fermer
          </Button>
        </div>
      )}
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-4">
          <PartnerMessage />
          <MissionCard />
          <AgendaCard />
        </div>
        <div className="grid min-w-0 content-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-1">
          <MethodChecklist />
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
