/** Document set of the case: every template, its clues, and the false leads. */
import type { World } from '../../engine/types';
import type { CorrectionKey } from '../anomalies/presented';
import type { Params } from '../params';
import { operationDocuments } from './catalog/accounting-operations';
import { statementDocuments } from './catalog/accounting-statements';
import { contractDocuments } from './catalog/contracts';
import { correspondenceDocuments } from './catalog/correspondence';
import { governanceDocuments } from './catalog/governance';
import { noiseDocuments } from './catalog/noise';
import { permanentDocuments } from './catalog/permanent';
import { makeContext } from './context';
import { FALSE_LEADS, supportDocuments, type FalseLead } from './false-leads';
import { requestLabel } from './request-labels';
import { onRequestKeys, type Clue, type ClueTarget, type DocumentModel, type OnRequestAvailability } from './model';

export interface DocumentSet {
  documents: readonly DocumentModel[];
  clues: readonly Clue[];
  falseLeads: readonly FalseLead[];
  byId: ReadonlyMap<string, DocumentModel>;
  cluesOf(target: ClueTarget): Clue[];
}

/**
 * Documents still declared with the label of their request (templates not yet
 * migrated to the request families): family and object they answer.
 */
const LEGACY_REQUESTS: Readonly<Record<string, { family: string; object: string }>> = {
  'rapprochement-reprise-soldes': { family: 'closing-file', object: 'migration' },
};

/** Request family and object of every document given on request; label of the request. */
function normaliseAvailability(params: Params, clean: World, d: DocumentModel): DocumentModel {
  const a = d.availability;
  if (a.kind !== 'onRequest') return d;
  const legacy = a.family === undefined ? LEGACY_REQUESTS[d.id] : undefined;
  if (a.family === undefined && !legacy) throw new Error(`document sur demande sans famille de demande : ${d.id}`);
  const family = a.family ?? legacy!.family;
  const object = a.object ?? legacy!.object;
  const next: OnRequestAvailability = { kind: 'onRequest', from: a.from, family, object, ...(a.also ? { also: a.also } : {}), request: requestLabel(params, family, object, (id) => (clean.datasets as { thirdParties?: { id: string; name: string }[] }).thirdParties?.find((t) => t.id === id)?.name) };
  return { ...d, availability: next };
}

export function buildDocuments(params: Params, clean: World, key: CorrectionKey): DocumentSet {
  const c = makeContext(params, clean, key);
  const documents = [
    ...permanentDocuments(c),
    ...governanceDocuments(c),
    ...statementDocuments(c),
    ...operationDocuments(c),
    ...contractDocuments(c),
    ...correspondenceDocuments(c),
    ...supportDocuments(c),
    ...noiseDocuments(c),
  ].map((d) => normaliseAvailability(params, clean, d));
  const byId = new Map<string, DocumentModel>();
  for (const d of documents) {
    if (byId.has(d.id)) throw new Error(`document en double : ${d.id}`);
    byId.set(d.id, d);
  }
  const clues = documents.flatMap((d) => d.clues);
  return { documents, clues, falseLeads: FALSE_LEADS, byId, cluesOf: (t) => clues.filter((x) => x.target === t) };
}

/** Request keys ('family' or 'family:object') answered by scenario documents: the others get generic replies. */
export function scenarioRequestKeys(documents: readonly DocumentModel[]): ReadonlyMap<string, readonly DocumentModel[]> {
  const m = new Map<string, DocumentModel[]>();
  for (const d of documents) for (const k of onRequestKeys(d.availability)) m.set(k, [...(m.get(k) ?? []), d]);
  return m;
}

/** Third parties whose confirmation reply is a scenario document. */
export function scenarioConfirmations(documents: readonly DocumentModel[]): ReadonlyMap<string, DocumentModel> {
  const m = new Map<string, DocumentModel>();
  for (const d of documents) if (d.availability.kind === 'confirmation') m.set(d.availability.request, d);
  return m;
}

export { makeContext, type DocContext } from './context';
export { genericConfirmationReply, genericReplies } from './replies';
export { onRequestKeys, requestKey } from './model';
export { programmeLabel, requestLabel, requestObjectLabel } from './request-labels';
export type { Block, Clue, ClueSource, ClueTarget, DocumentModel, FalseLeadId } from './model';
export type { FalseLead } from './false-leads';
