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
import type { Clue, ClueTarget, DocumentModel } from './model';

export interface DocumentSet {
  documents: readonly DocumentModel[];
  clues: readonly Clue[];
  falseLeads: readonly FalseLead[];
  byId: ReadonlyMap<string, DocumentModel>;
  cluesOf(target: ClueTarget): Clue[];
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
  ];
  const byId = new Map<string, DocumentModel>();
  for (const d of documents) {
    if (byId.has(d.id)) throw new Error(`document en double : ${d.id}`);
    byId.set(d.id, d);
  }
  const clues = documents.flatMap((d) => d.clues);
  return { documents, clues, falseLeads: FALSE_LEADS, byId, cluesOf: (t) => clues.filter((x) => x.target === t) };
}

export type { Block, Clue, ClueSource, ClueTarget, DocumentModel, FalseLeadId } from './model';
export type { FalseLead } from './false-leads';
