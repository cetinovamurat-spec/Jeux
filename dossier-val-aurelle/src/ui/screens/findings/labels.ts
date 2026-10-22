/** French labels of the findings screen and form (statuses, natures, classifications, treatments, kinds of objects and evidence). */
import type { Evidence, FindingObjectKind, FindingStatus, FindingTreatment } from '../../../game/findings';
import type { Tone } from '../../../game/state';
import type { Classification, Nature } from '../../../scenario/anomalies/types';

export const STATUS_LABELS: Readonly<Record<FindingStatus, string>> = { question: 'Question', finding: 'Constat', dismissed: 'Écarté', closed: 'Clos' };
export const STATUS_TONES: Readonly<Record<FindingStatus, Tone>> = { question: 'warn', finding: 'accent', dismissed: 'muted', closed: 'ok' };
export const STATUS_HELP: Readonly<Record<FindingStatus, string>> = {
  question: 'Point à instruire : il n’entre pas dans le tableau des anomalies.',
  finding: 'Anomalie retenue : elle entre dans le tableau des anomalies.',
  dismissed: 'Point écarté après examen, pièces à l’appui : rien à reporter, il n’entre pas dans le tableau des anomalies.',
  closed: 'Point réglé (réponse obtenue, question sans objet) : rien à reporter, il n’entre pas dans le tableau des anomalies. Une anomalie retenue reste au statut « Constat », même si l’organisme accepte de la corriger.',
};

export const NATURE_LABELS: Readonly<Record<Nature, string>> = {
  occurrence: 'Réalité',
  completeness: 'Exhaustivité',
  cutoff: 'Séparation des exercices',
  valuation: 'Évaluation',
  classification: 'Classement',
  presentation: 'Présentation',
  compliance: 'Conformité',
};

export const CLASSIFICATION_LABELS: Readonly<Record<Classification, string>> = { factual: 'Factuelle', judgemental: 'De jugement', projected: 'Extrapolée' };

export const TREATMENT_LABELS: Readonly<Record<FindingTreatment, string>> = {
  adjust: 'Ajustement des comptes',
  reclassify: 'Reclassement',
  disclose: 'Information en annexe',
  report: 'Rapport de gestion',
  specialReport: 'Rapport spécial',
  governance: 'Irrégularité ou communication à la gouvernance',
  internalControl: 'Faiblesse de contrôle interne',
};

export const OBJECT_KIND_LABELS: Readonly<Record<FindingObjectKind, string>> = {
  programme: 'Programme',
  thirdParty: 'Tiers',
  account: 'Compte',
  document: 'Pièce',
  loan: 'Emprunt',
  subsidy: 'Subvention',
  disclosureItem: 'Information publiée',
};

export type EvidenceKind = Evidence['kind'];
export const EVIDENCE_KIND_LABELS: Readonly<Record<EvidenceKind, string>> = {
  doc: 'Pièce de la GED',
  fec: 'Écriture du FEC',
  sample: 'Échantillon',
  recalc: 'Recalcul',
  query: 'Requête FEC',
  execution: 'Feuille de travail',
  confirmation: 'Confirmation',
};

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('fr-FR')} ${n > 1 ? many : one}`;
}
