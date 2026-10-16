/** Labels of the requests of the auditor (family × object), shared by the documents and the game rules. */
import type { Params } from '../params';

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function month(m: string): string {
  return `${MONTHS_FR[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;
}

/** Name of a programme, or of an operation in progress. */
export function programmeLabel(params: Params, id: string): string {
  return params.programmes.find((p) => p.id === id)?.name ?? params.scenario.operationsInProgress.find((o) => o.id === id)?.name ?? (id === 'SIE' ? 'Siège et moyens généraux' : id);
}

/**
 * Label of the object of a request: programme name, month, entry number,
 * fixed object; `thirdPartyName` resolves third-party ids (generated data).
 */
export function requestObjectLabel(params: Params, family: string, object: string, thirdPartyName?: (id: string) => string | undefined): string {
  const f = params.requests.families.find((x) => x.id === family);
  if (!object) return '';
  switch (f?.parameter) {
    case 'programme':
      return programmeLabel(params, object);
    case 'programmeMonth': {
      const [p, m] = object.split(':');
      return `${programmeLabel(params, p ?? '')}, ${month(m ?? '')}`;
    }
    case 'month':
      return month(object);
    case 'fecEntry': {
      const [y, n] = object.split(':');
      return `écriture ${n ?? ''} (${y ?? ''})`;
    }
    case 'closingDoc':
      return f.objects?.find((o) => o.id === object)?.label ?? object;
    case 'thirdParty':
      return thirdPartyName?.(object) ?? object;
    default:
      return object;
  }
}

/** Label of a request as written in the request list: « Registre des composants d’un programme – Les Érables ». */
export function requestLabel(params: Params, family: string, object: string, thirdPartyName?: (id: string) => string | undefined): string {
  const f = params.requests.families.find((x) => x.id === family);
  const o = requestObjectLabel(params, family, object, thirdPartyName);
  if (!f) return o ? `${family} – ${o}` : family;
  return o ? `${f.label} – ${o}` : f.label;
}
