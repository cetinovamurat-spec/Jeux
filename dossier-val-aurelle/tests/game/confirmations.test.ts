/** External confirmations (plan J4 §9, J4-7): preparation, automatic sending, status, reminders, populations of third parties. */
import { describe, expect, it } from 'vitest';
import {
  canPrepare,
  confirmationCandidates,
  confirmationsOfExecution,
  confirmationsSchema,
  confirmationStatus,
  hoursCharged,
  initialConfirmations,
  POPULATION_ORDER,
  populationsOfProcedure,
  prepareConfirmation,
  remindConfirmation,
  sendingDate,
  sentConfirmations,
  upcomingConfirmations,
  withdrawConfirmation,
} from '../../src/game/confirmations';
import { workCalendar } from '../../src/game/calendar';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { params, world } from '../helpers/world';

const p = params();

function host(date = '2025-11-18') {
  return { confirmations: initialConfirmations(), clock: { date }, journal: [] as { on: string; kind: string; ref?: string; data?: Record<string, string | number | boolean> }[] };
}

describe('calendar of the confirmations', () => {
  it('the requests are sent automatically on 06/01/2026; they can be prepared until then', () => {
    expect(sendingDate(p)).toBe('2026-01-06');
    expect(canPrepare(p, '2025-11-18')).toBe(true);
    expect(canPrepare(p, '2026-01-05')).toBe(true);
    expect(canPrepare(p, '2026-01-06')).toBe(false);
  });
  it('the requests prepared before the sending are sent on that date', () => {
    const s = prepareConfirmation(prepareConfirmation(host(), 'BDT', 'Banque des Territoires', 'senior', p), 'F0022', 'Entreprise', 'lea', p);
    expect(sentConfirmations(s.confirmations, p, '2026-01-05').size).toBe(0);
    expect([...sentConfirmations(s.confirmations, p, '2026-01-06')].sort()).toEqual(['BDT', 'F0022']);
  });
});

describe('actions', () => {
  it('prepares a request once per third party, with a journal entry', () => {
    let s = prepareConfirmation(host(), 'BDT', 'Banque des Territoires', 'senior', p);
    s = prepareConfirmation(s, 'BDT', 'Banque des Territoires', 'senior', p);
    expect(s.confirmations.items).toEqual([{ thirdParty: 'BDT', preparedOn: '2025-11-18' }]);
    expect(s.journal).toEqual([{ on: '2025-11-18', kind: 'confirmation', ref: 'BDT', data: { title: 'Demande de confirmation préparée – Banque des Territoires' } }]);
    expect(confirmationsSchema.parse(s.confirmations)).toEqual(s.confirmations);
  });
  it('after the sending date, nothing can be prepared nor withdrawn: only alternative procedures remain', () => {
    const late = prepareConfirmation(host('2026-01-06'), 'BDT', 'Banque des Territoires', 'senior', p);
    expect(late.confirmations.items).toEqual([]);
    const s = prepareConfirmation(host(), 'BDT', 'Banque des Territoires', 'senior', p);
    expect(withdrawConfirmation({ ...s, clock: { date: '2026-01-07' } }, 'BDT', p).confirmations.items).toHaveLength(1);
    expect(withdrawConfirmation(s, 'BDT', p).confirmations.items).toEqual([]);
  });
  it('the reminder is a player action after the sending (journal, cost); a third party that never replies stays silent', () => {
    const s = prepareConfirmation(host(), 'ACCUEIL_HORIZONS', 'Accueil Horizons', 'senior', p);
    expect(remindConfirmation(s, 'ACCUEIL_HORIZONS', 'Accueil Horizons', p)).toBe(s);
    const r = remindConfirmation({ ...s, clock: { date: '2026-02-10' } }, 'ACCUEIL_HORIZONS', 'Accueil Horizons', p);
    expect(r.confirmations.items[0]!.remindedOn).toBe('2026-02-10');
    expect(r.journal.at(-1)).toMatchObject({ kind: 'confirmationReminder', ref: 'ACCUEIL_HORIZONS' });
    expect(confirmationStatus(p, r.confirmations.items[0]!, null, '2026-03-02')).toBe('noReply');
    expect(hoursCharged(r.confirmations, p)).toEqual([
      { member: 'senior', hours: p.requests.confirmations.preparationHours, on: '2025-11-18' },
      { member: 'senior', hours: p.requests.confirmations.reminderHours, on: '2026-02-10' },
    ]);
  });
  it('the hours of the preparation are charged to the member who prepares it', () => {
    const s = prepareConfirmation(host(), 'F0027', 'GIE', 'lea', p);
    expect(hoursCharged(s.confirmations, p)).toEqual([{ member: 'lea', hours: p.requests.confirmations.preparationHours, on: '2025-11-18' }]);
  });
  it('a request prepared in a procedure is part of its hours: it is not charged a second time', () => {
    const s = prepareConfirmation(host(), 'BDT', 'Banque des Territoires', 'lea', p, 'X1');
    expect(s.confirmations.items).toEqual([{ thirdParty: 'BDT', preparedOn: '2025-11-18', by: 'lea', executionId: 'X1' }]);
    expect(confirmationsSchema.parse(s.confirmations)).toEqual(s.confirmations);
    expect(hoursCharged(s.confirmations, p)).toEqual([]);
  });
});

describe('status in the tracker', () => {
  const it0 = { thirdParty: 'BDT', preparedOn: '2025-11-18' };
  it('prepared, sent, replied, without reply', () => {
    expect(confirmationStatus(p, it0, '2026-01-26', '2025-12-01')).toBe('prepared');
    expect(confirmationStatus(p, it0, '2026-01-26', '2026-01-06')).toBe('sent');
    expect(confirmationStatus(p, it0, '2026-01-26', '2026-01-26')).toBe('replied');
    expect(confirmationStatus(p, it0, null, '2026-01-15')).toBe('sent');
    expect(confirmationStatus(p, it0, null, '2026-02-23')).toBe('noReply');
    expect(confirmationStatus(p, { ...it0, preparedOn: '2026-01-06' }, '2026-01-26', '2026-02-23')).toBe('notSent');
  });
});

describe('upcoming events', () => {
  const ctx = { params: p, cal: workCalendar(p), date: '2025-11-18' };
  it('announces the automatic sending, or warns that nothing is prepared', () => {
    expect(upcomingConfirmations(initialConfirmations(), ctx)).toEqual([{ date: '2026-01-06', kind: 'deadline', label: expect.stringContaining('aucune demande préparée'), to: '/ged?onglet=demandes' }]);
    const s = prepareConfirmation(host(), 'BDT', 'Banque des Territoires', 'senior', p);
    expect(upcomingConfirmations(s.confirmations, ctx)).toEqual([{ date: '2026-01-06', kind: 'confirmation', label: 'Envoi automatique de 1 demande de confirmation', to: '/ged?onglet=demandes' }]);
    expect(upcomingConfirmations(s.confirmations, { ...ctx, date: '2026-01-06' })).toEqual([]);
  });
});

describe('third parties proposed (populations built from the data)', () => {
  const ds = world().world.datasets as unknown as ScenarioDatasets;
  const cands = confirmationCandidates(p, ds);
  const of = (pop: string) => cands.filter((c) => c.population === pop).map((c) => c.thirdParty);
  it('lenders by outstanding capital, banks, notaries of the sales, lawyers, funders, suppliers, debtors', () => {
    expect(of('lenders')[0]).toBe('BDT');
    expect(of('lenders')).toEqual(expect.arrayContaining(['BDT', 'AL']));
    expect(of('notaries')).toContain('NOTAIRE_GIRARD');
    expect(of('lawyers')).toContain('F0033');
    expect(of('funders')).toContain('DEPARTEMENT');
    expect(of('suppliers')).toEqual(expect.arrayContaining(['F0027', 'F0022', 'F0015']));
    expect(of('debtors')).toEqual(expect.arrayContaining(['ACCUEIL_HORIZONS', 'HABITAT_INSERTION', 'CCAS_AURELLE', 'COTEAUX_SEREIN']));
  });
  it('one candidate per third party, in the order of the populations', () => {
    expect(new Set(cands.map((c) => c.thirdParty)).size).toBe(cands.length);
    const order = cands.map((c) => POPULATION_ORDER.indexOf(c.population));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const c of cands) expect(c.name, c.thirdParty).not.toBe(c.thirdParty);
  });
  it('a procedure counts the requests of its own populations, and those prepared in it', () => {
    const popOf = (id: string) => cands.find((c) => c.thirdParty === id)?.population;
    let s = prepareConfirmation(host(), 'BDT', 'Banque des Territoires', 'senior', p);
    expect(confirmationsOfExecution(s.confirmations.items, p, 'X1', 'litigation', popOf)).toEqual([]);
    expect(confirmationsOfExecution(s.confirmations.items, p, 'X2', 'lender-confirmations', popOf).map((x) => x.thirdParty)).toEqual(['BDT']);
    s = prepareConfirmation(s, 'F0033', 'Avocat', 'senior', p, 'X1');
    expect(confirmationsOfExecution(s.confirmations.items, p, 'X1', 'litigation', popOf).map((x) => x.thirdParty)).toEqual(['F0033']);
    expect(confirmationsOfExecution(s.confirmations.items, p, 'X1', 'litigation').map((x) => x.thirdParty)).toEqual(['F0033']);
  });
  it('the procedures prepare their own populations', () => {
    expect(populationsOfProcedure(p, 'lender-confirmations')).toEqual(['lenders', 'banks']);
    expect(populationsOfProcedure(p, 'debtor-confirmations')).toEqual(['debtors']);
    expect(populationsOfProcedure(p, null)).toEqual(POPULATION_ORDER);
    const procs = p.procedures.procedures.filter((x) => x.output.kind === 'confirmations').map((x) => x.id);
    for (const id of procs) expect(p.requests.confirmations.procedurePopulations[id], id).toBeDefined();
  });
});
