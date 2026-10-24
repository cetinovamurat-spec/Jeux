/** Mailbox (plan J5 §11): derived inbox, phase messages of J4 migrated unchanged, read marks, clock moved back, stops of the clock. Pure rules. */
import { describe, expect, it } from 'vitest';
import { addDays, formatDateFr, type IsoDate } from '../../src/engine/dates';
import { advanceTo, nextEventDate, upcomingEvents, type UpcomingContext } from '../../src/game/advance';
import { workCalendar } from '../../src/game/calendar';
import { cleanOrphans } from '../../src/game/persistence';
import { allMessages, inbox, isRead, knownMessageIds, markMessageRead, MESSAGE_PROVIDERS, messageStops, phaseMessages, unreadCount, type MessageContext } from '../../src/game/messages';
import { initialState, type GameState } from '../../src/game/state';
import { vintageDates } from '../../src/game/vintages';
import { loadParams, type Params } from '../../src/scenario/params';

const params = loadParams();
const cal = workCalendar(params);
const ctx = (date: IsoDate): MessageContext => ({ params, cal, date });
const at = (date: IsoDate): GameState => advanceTo(initialState(params), date);

/**
 * The message of the partner shown on the desk by J4 (DeskScreen →
 * usePhaseMessage), frozen copy: the reference the migrated messages are
 * compared with.
 */
function j4PhaseMessage(p: Params, date: IsoDate): { on: string; intro: string; steps: { to: string; text: string }[]; outro: string } {
  const GED_REQUESTS = '/ged?onglet=demandes';
  const { calendar, startDate } = p.game;
  const v = vintageDates(p);
  const find = (id: string) => calendar.find((x) => x.id === id);
  const interim = find('interim');
  const final = find('final');
  const sending = find('confirmations');
  const completion = find('completion');
  const d = (x: string | undefined) => (x ? formatDateFr(x) : '');
  const { years } = p.scenario;
  if (interim && date < interim.from) {
    return {
      on: startDate,
      intro: `Vous prenez en charge le dossier pour l’exercice clos le ${formatDateFr(`${years.current}-12-31`)}. Nous sommes en prise de connaissance et planification ; l’intérim commence le ${d(interim.from)}. Je vous propose :`,
      steps: [
        { to: '/ged', text: 'le dossier permanent, les procès-verbaux et les comptes certifiés de l’exercice précédent, pour reprendre connaissance de l’entité ;' },
        { to: GED_REQUESTS, text: `une demande au chef comptable de l’extraction comptable au ${d(v.cutoff)}, pour la revue analytique préliminaire ;` },
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
        { to: GED_REQUESTS, text: `la préparation des demandes de confirmation des tiers : elles partiront le ${d(sending?.from)} ;` },
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
        { to: GED_REQUESTS, text: 'suivez vos demandes et les réponses des tiers ;' },
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

describe('phase messages of the partner (J4, migrated)', () => {
  it('are, every day of the engagement, the message J4 showed on the desk: same date, text and links', () => {
    const manager = params.game.firm.find((f) => f.id === 'manager')!;
    const end = addDays(params.game.calendar.find((p) => p.id === 'reporting')!.to, 10);
    let days = 0;
    for (let d = params.game.startDate; d <= end; d = addDays(d, 1)) {
      const latest = inbox(initialState(params), ctx(d))[0]!;
      const j4 = j4PhaseMessage(params, d);
      expect(latest.on, d).toBe(j4.on);
      expect(latest.from).toBe('partner');
      expect(latest.body).toEqual(['Bonjour,', j4.intro]);
      expect(latest.links).toEqual(j4.steps);
      expect(latest.closing).toEqual([`${manager.name} reste disponible pour les questions de méthode et le suivi du budget. ${j4.outro}`]);
      days++;
    }
    expect(days).toBeGreaterThan(150);
  });

  it('keep the dates of J4 (the message after a visit is dated its last day and read the next day)', () => {
    const list = phaseMessages(params);
    const period = (id: string) => params.game.calendar.find((p) => p.id === id)!;
    expect(list.map((m) => [m.id, m.on, m.visibleOn])).toEqual([
      ['partner-planning', params.game.startDate, undefined],
      ['partner-interim', period('interim').from, undefined],
      ['partner-offsite', period('interim').to, addDays(period('interim').to, 1)],
      ['partner-final', period('final').from, undefined],
      ['partner-after-final', period('final').to, addDays(period('final').to, 1)],
    ]);
    expect(new Set(list.map((m) => m.subject)).size).toBe(list.length);
    // no amount in a message
    for (const m of list) expect([...m.body, ...(m.closing ?? []), ...m.links.map((l) => l.text ?? '')].join(' ')).not.toMatch(/€|\d{1,3}( \d{3})+/);
  });
});

describe('inbox', () => {
  it('holds the messages received at the date, most recent first; a clock moved back hides the later ones', () => {
    const final = params.game.calendar.find((p) => p.id === 'final')!;
    const s = at(final.from);
    expect(inbox(s, ctx(final.from)).map((m) => m.id)).toEqual(['partner-final', 'partner-offsite', 'partner-interim', 'partner-planning']);
    const back = advanceTo(s, '2025-11-18');
    expect(inbox(back, ctx(back.clock.date)).map((m) => m.id)).toEqual(['partner-interim', 'partner-planning']);
    expect(inbox(back, ctx('2025-11-01'))).toEqual([]);
    // every message of the state, past and future, in chronological order
    expect(allMessages(s, ctx(s.clock.date)).map((m) => m.id)).toEqual(['partner-planning', 'partner-interim', 'partner-offsite', 'partner-final', 'partner-after-final']);
  });

  it('stores only the read marks: read once, at the game date; unread counted at the date', () => {
    let s = at('2025-11-18');
    expect(unreadCount(s, ctx(s.clock.date))).toBe(2);
    s = markMessageRead(s, 'partner-interim');
    expect(s.messages.read).toEqual({ 'partner-interim': '2025-11-18' });
    expect(markMessageRead(s, 'partner-interim')).toBe(s);
    expect(unreadCount(s, ctx(s.clock.date))).toBe(1);
    expect(isRead(s, 'partner-interim', '2025-11-18')).toBe(true);
    // before the date it was read, it was not
    expect(isRead(s, 'partner-interim', '2025-11-17')).toBe(false);
  });

  it('lists the providers of the registry; those of J5 give no message yet', () => {
    expect(MESSAGE_PROVIDERS.map((p) => p.id)).toEqual(['phase', 'ethics', 'escalations', 'team']);
    const s = at('2026-03-02');
    for (const p of MESSAGE_PROVIDERS.slice(1)) expect(p.messages(s, ctx(s.clock.date))).toEqual([]);
  });
});

describe('stops of the clock', () => {
  const uctx = (s: GameState): UpcomingContext => ({ params, cal, date: s.clock.date });

  it('stop at the arrival of a new message, read on a working day, without listing it', () => {
    const interim = params.game.calendar.find((p) => p.id === 'interim')!;
    const final = params.game.calendar.find((p) => p.id === 'final')!;
    const s = at(interim.to);
    expect(messageStops(s, ctx(s.clock.date))[0]).toBe(addDays(interim.to, 1));
    expect(nextEventDate(s, uctx(s))).toBe(addDays(interim.to, 1));
    expect(upcomingEvents(s, uctx(s)).some((e) => e.date === addDays(interim.to, 1))).toBe(false);
    // the message after the final (13/03, a Friday) is read on the next working day
    const last = at(final.to);
    expect(messageStops(last, ctx(last.clock.date))).toEqual(['2026-03-16']);
    // nothing after the last message
    const late = at('2026-05-01');
    expect(messageStops(late, ctx(late.clock.date))).toEqual([]);
  });
});

describe('read marks of unknown messages', () => {
  it('are orphans removed at load; the known ones are kept', () => {
    const s = markMessageRead(markMessageRead(at('2025-11-18'), 'partner-interim'), 'message-disparu');
    expect(knownMessageIds(s, { params, cal }).has('partner-after-final')).toBe(true);
    const r = cleanOrphans(s, params, () => true);
    expect(r.state.messages.read).toEqual({ 'partner-interim': '2025-11-18' });
    expect(r.removed).toEqual(['Messagerie : 1 marque de lecture d’un message qui n’existe plus retirée.']);
    expect(cleanOrphans(r.state, params, () => true)).toEqual({ state: r.state, removed: [] });
  });
});
