/** French labels of the FEC explorer: users of the accounting software, dates with the weekday, counts. */
import { formatDateFr, weekday, type IsoDate } from '../../../engine/dates';
import { formatAmount } from '../../../engine/format';
import type { Params } from '../../../scenario/params';

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

/** 'samedi 27/09/2025' */
export function dateWithWeekday(date: IsoDate): string {
  return `${WEEKDAYS[weekday(date)]} ${formatDateFr(date)}`;
}

/** Integer count with fr-FR digit grouping (through the engine formatter). */
export function formatCount(n: number): string {
  return formatAmount(n * 100, 0);
}

export function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n > 1 ? many : one}`;
}

/** Users that are interfaces or technical accounts, not people entering entries by hand. */
export function technicalUsers(params: Params): Set<string> {
  const u = params.scenario.users;
  return new Set([u.rentInterfaceBefore, u.rentInterfaceAfter, u.payrollInterface, u.migration]);
}

/** Function of each user of the accounting software (user access list of the client). */
export function userRoles(params: Params): Map<string, string> {
  const u = params.scenario.users;
  return new Map([
    [u.cfoBefore.id, `Direction financière (jusqu’au ${formatDateFr(u.cfoBefore.until)})`],
    [u.cfo.id, `Direction administrative et financière (depuis le ${formatDateFr(u.cfo.from)})`],
    [u.chiefAccountant, 'Chef comptable'],
    [u.payablesAccountant, 'Comptabilité fournisseurs'],
    [u.treasuryAccountant, 'Comptabilité trésorerie'],
    [u.rentInterfaceBefore, 'Interface de gestion locative (ancien logiciel)'],
    [u.rentInterfaceAfter, `Interface de gestion locative (nouveau logiciel, depuis le ${formatDateFr(u.migrationDate)})`],
    [u.payrollInterface, 'Interface de paie'],
    [u.migration, 'Utilisateur technique de reprise des données'],
  ]);
}

/** FEC date 'AAAAMMJJ' → 'JJ/MM/AAAA' (empty when absent). */
export function formatFecDate(fecDate: string): string {
  return fecDate.length === 8 ? formatDateFr(`${fecDate.slice(0, 4)}-${fecDate.slice(4, 6)}-${fecDate.slice(6, 8)}`) : '';
}
