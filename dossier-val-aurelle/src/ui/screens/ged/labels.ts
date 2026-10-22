/** French labels of the GED (categories, filters, availability modes, clue sources). */
import { formatDateFr } from '../../../engine/dates';
import type { DocumentSort, DocumentStatusFilter } from '../../../game/documents';
import type { ClueSource } from '../../../scenario/documents';
import type { Availability, DocumentCategory } from '../../../scenario/documents/model';
import type { Params } from '../../../scenario/params';
import { ofName } from '../../../scenario/documents/replies';

export const CATEGORY_ORDER: readonly DocumentCategory[] = ['permanent', 'governance', 'accounting', 'contracts', 'mail', 'internal', 'thirdParty'];

export const CATEGORY_LABELS: Readonly<Record<DocumentCategory, string>> = {
  permanent: 'Dossier permanent',
  governance: 'Gouvernance',
  accounting: 'Comptabilité',
  contracts: 'Contrats et pièces',
  mail: 'Courrier',
  internal: 'Échanges internes',
  thirdParty: 'Réponses de tiers',
};

export const STATUS_LABELS: Readonly<Record<DocumentStatusFilter, string>> = {
  all: 'Tous',
  unread: 'Non lus',
  evidence: 'Conservés comme preuves',
  annotated: 'Annotés',
};

export const SORT_LABELS: Readonly<Record<DocumentSort, string>> = {
  relevance: 'Pertinence (recherche)',
  dateDesc: 'Date décroissante',
  dateAsc: 'Date croissante',
  title: 'Titre',
};

export const CLUE_SOURCE_LABELS: Readonly<Record<ClueSource, string>> = {
  governance: 'Gouvernance',
  accounting: 'Comptabilité',
  management: 'Gestion',
  contract: 'Contrat',
  thirdParty: 'Tiers',
  internal: 'Interne',
  regulatory: 'Réglementaire',
  press: 'Presse',
};

const CONDITION_LABELS: Readonly<Record<Extract<Availability, { kind: 'conditional' }>['condition'], string>> = {
  chiefAccountantConfides: 'confidences du chef comptable',
  tenantAssociationContact: 'prise de contact avec l’association des locataires',
};

/** Short label of an availability mode (designer badges). */
export const AVAILABILITY_SHORT: Readonly<Record<Availability['kind'], string>> = {
  initial: 'Dès l’ouverture',
  onRequest: 'Sur demande',
  confirmation: 'Confirmation',
  afterDate: 'Reçu en cours de mission',
  conditional: 'Sous condition',
};

/** Full description of how a document reaches the auditor (designer panel). */
export function availabilityText(a: Availability, docDate: string, params: Params): string {
  switch (a.kind) {
    case 'initial':
      return `Remis dès l’ouverture de la mission (document daté du ${formatDateFr(docDate)}).`;
    case 'afterDate':
      return `Reçu en cours de mission, disponible à partir du ${formatDateFr(a.from)}.`;
    case 'onRequest': {
      const p = params.documents.people[a.from];
      const what = `« ${a.request} »${p ? `, auprès ${ofName(p.name)} (${p.role})` : ''}`;
      if (a.rebuiltOnRequest) return `Version de référence : la pièce est établie à la date de chaque demande ${what}, avec les données connues à cette date.`;
      return `Communiqué uniquement sur demande précise : ${what}${a.asOf ? ` (établi pour la demande du ${formatDateFr(a.asOf)})` : ''}.`;
    }
    case 'confirmation':
      return `Réponse à la demande de confirmation « ${a.request} » ; arrive le ${formatDateFr(a.arrives)} si la demande a été envoyée.`;
    case 'conditional':
      return `Révélé sous condition : ${CONDITION_LABELS[a.condition]}.`;
  }
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

// ---------------------------------------------------------------------------
// requests and confirmations (plan J4 §8, §9)
// ---------------------------------------------------------------------------

export type GedTab = 'documents' | 'courrier' | 'demandes';

export const GED_TABS: readonly GedTab[] = ['documents', 'courrier', 'demandes'];

export const POPULATION_LABELS: Readonly<Record<string, string>> = {
  lenders: 'Prêteurs',
  banks: 'Banques (comptes et engagements)',
  notaries: 'Notaires des ventes 2025-2026',
  lawyers: 'Avocats (litiges)',
  funders: 'Financeurs (subventions à recevoir)',
  suppliers: 'Fournisseurs',
  debtors: 'Débiteurs (gestionnaires, entités du groupe)',
};

export const CONFIRMATION_STATE_LABELS: Readonly<Record<string, string>> = {
  prepared: 'Préparée',
  notSent: 'Non envoyée',
  sent: 'Envoyée, en attente',
  replied: 'Réponse reçue',
  noReply: 'Sans réponse',
};

/** Person of the client who answers a request: « Karim Haddad (chef comptable) ». */
export function interlocutorText(params: Params, id: string): string {
  const p = params.documents.people[id];
  return p ? `${p.name} (${p.role.charAt(0).toLowerCase()}${p.role.slice(1)})` : id;
}

/** Delay of an interlocutor in working days, in words. */
export function delayText(days: number): string {
  return days <= 1 ? '1 jour ouvré' : `${days} jours ouvrés`;
}

/** Reminders of a request or a confirmation: « Relancée le 20/11/2025 », « Relancée 3 fois, en dernier le 24/11/2025 ». */
export function reminderText(count: number, last: string, verb: 'Relancé' | 'Relancée'): string {
  return count > 1 ? `${verb} ${count} fois, en dernier le ${formatDateFr(last)}` : `${verb} le ${formatDateFr(last)}`;
}
