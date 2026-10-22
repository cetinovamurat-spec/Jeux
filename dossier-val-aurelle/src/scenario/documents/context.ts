/**
 * Context shared by the document templates: presented and clean worlds,
 * correction key, parameters, fr-FR formatters. Templates never type an
 * amount: they format values of the worlds or of the parameters.
 */
import { closingBalances, sumPrefixes } from '../../engine/balance';
import { formatDateFr, type IsoDate } from '../../engine/dates';
import { formatAmount, formatEuro, formatKEuro, formatMEuro, formatPercent } from '../../engine/format';
import type { Cents } from '../../engine/money';
import type { World } from '../../engine/types';
import type { PresentationFacts } from '../anomalies/draft';
import { loanRepayments, type CorrectionKey } from '../anomalies/presented';
import { keyFigures, type KeyFigures } from '../../engine/analysis';
import type { FinancialStatements } from '../../engine/types';
import type { ScenarioDatasets } from '../datasets';
import type { Params } from '../params';
import type { DocumentsParams } from '../schema';
import { requestKey, type Availability, type Block, type Clue, type ClueSource, type ClueTarget, type DocumentCategory, type DocumentModel, type Interlocutor } from './model';
import type { PartKey } from '../anomalies/types';

export interface DocContext {
  params: Params;
  d: DocumentsParams;
  clean: World;
  cd: ScenarioDatasets;
  presented: World;
  pd: ScenarioDatasets;
  facts: PresentationFacts;
  key: CorrectionKey;
  /** Closing balances 2025 (presented, clean) and 2024 (certified), debit positive. */
  pb: Map<string, Cents>;
  cb: Map<string, Cents>;
  b24: Map<string, Cents>;
  /** Statements (current and prior columns) of the presented and clean worlds; key figures 2024 (certified). */
  ps: FinancialStatements;
  cs: FinancialStatements;
  f24: KeyFigures;
}

export function makeContext(params: Params, clean: World, key: CorrectionKey): DocContext {
  const presented = key.presented.world;
  return {
    params,
    d: params.documents,
    clean,
    cd: clean.datasets as unknown as ScenarioDatasets,
    presented,
    pd: presented.datasets as unknown as ScenarioDatasets,
    facts: key.presented.facts,
    key,
    pb: closingBalances(presented.ledgers.current),
    cb: closingBalances(clean.ledgers.current),
    b24: closingBalances(clean.ledgers.prior),
    ps: key.presentedFigures.statements,
    cs: key.cleanFigures.statements,
    f24: keyFigures(closingBalances(clean.ledgers.prior), params.analysis, loanRepayments(clean, 2024)),
  };
}

// ---------------------------------------------------------------------------
// formatting and lookups
// ---------------------------------------------------------------------------

export const euro = (c: Cents) => formatEuro(c);
export const euro0 = (c: Cents) => formatEuro(c, 0);
export const keuro = (c: Cents, decimals = 1) => formatKEuro(c, decimals);
export const meuro = (c: Cents, decimals = 2) => formatMEuro(c, decimals);
export const amount = (c: Cents) => formatAmount(c);
export const amount0 = (c: Cents) => formatAmount(c, 0);
export const pct = (ratio: number, decimals = 1) => formatPercent(ratio, decimals);
/** Percentage given in points (e.g. 3.26 → « 3,26 % »). */
export const pts = (value: number, decimals = 2) => formatPercent(value / 100, decimals);
export const date = (d: IsoDate) => formatDateFr(d);
/** Parameter amounts are in euros; documents work in cents. */
export const fromEuros = (value: number): Cents => Math.round(value * 100);

export function person(c: DocContext, role: string): { name: string; role: string } {
  const p = c.d.people[role];
  if (!p) throw new Error(`personne inconnue : ${role}`);
  return p;
}

export function progName(c: DocContext, id: string): string {
  return c.params.programmes.find((p) => p.id === id)?.name ?? c.params.scenario.operationsInProgress.find((o) => o.id === id)?.name ?? (id === 'SIE' ? 'Siège et moyens généraux' : id);
}

/** « de » + programme name with the French contraction: des Tilleuls, du Belvédère, de La Roseraie, du FJT Le Phare. */
export function ofProg(c: DocContext, id: string): string {
  const name = progName(c, id);
  if (name.startsWith('Les ')) return `des ${name.slice(4)}`;
  if (name.startsWith('Le ')) return `du ${name.slice(3)}`;
  if (name.startsWith('FJT ')) return `du ${name}`;
  if (/^(Résidence|Pension) /.test(name)) return `de la ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  if (/^L[’']/.test(name)) return `de ${name}`;
  return `de ${name}`;
}

export function tpName(c: DocContext, id: string): string {
  return c.cd.thirdParties.find((t) => t.id === id)?.name ?? id;
}

/** Credit-positive sum of balances (liabilities, income). */
export function creditOf(b: ReadonlyMap<string, Cents>, prefixes: readonly string[], exclude: readonly string[] = []): Cents {
  return 0 - sumPrefixes(b, prefixes, exclude) + 0;
}

export function debitOf(b: ReadonlyMap<string, Cents>, prefixes: readonly string[], exclude: readonly string[] = []): Cents {
  return sumPrefixes(b, prefixes, exclude) + 0;
}

export const ENTITY_HEADER = (c: DocContext) => `${c.params.scenario.entity.name} – ${c.params.scenario.entity.registeredOffice}`;

// ---------------------------------------------------------------------------
// builder
// ---------------------------------------------------------------------------

/**
 * Availability given by a template: a request reply names its family and
 * object (params/requests.json); buildDocuments fills the label of the request.
 */
export type AvailabilityInput = Availability | { kind: 'onRequest'; family: string; object: string; also?: readonly string[]; from: Interlocutor; request?: string };

export interface DocMeta {
  id: string;
  title: string;
  category: DocumentCategory;
  date: IsoDate;
  issuer: string;
  recipient?: string;
  reference?: string;
  noise?: boolean;
  availability?: AvailabilityInput;
}

export class DocBuilder {
  private readonly blocks: Block[] = [];
  private readonly clues: Clue[] = [];
  private n = 0;

  constructor(private readonly meta: DocMeta) {}

  /** Registers a clue carried by this document and returns its id (to tag the block). */
  clue(target: ClueTarget, source: ClueSource, text: string, parts?: readonly PartKey[]): string {
    this.n++;
    const id = `${this.meta.id}#${this.n}`;
    this.clues.push({ id, target, documentId: this.meta.id, source, text, ...(parts ? { parts } : {}) });
    return id;
  }

  /**
   * A clue registered the first time a block is tagged with it: for the
   * replies built on the date of a request, whose tagged rows may not exist
   * yet at that date.
   */
  clueOnUse(target: ClueTarget, source: ClueSource, text: string, parts?: readonly PartKey[]): () => string {
    let id: string | undefined;
    return () => (id ??= this.clue(target, source, text, parts));
  }

  h(text: string, clue?: string): this {
    this.blocks.push({ kind: 'heading', text, ...(clue ? { clue } : {}) });
    return this;
  }

  p(text: string, clue?: string): this {
    this.blocks.push({ kind: 'paragraph', text, ...(clue ? { clue } : {}) });
    return this;
  }

  fields(rows: readonly ([string, string] | [string, string, string | undefined])[]): this {
    this.blocks.push({ kind: 'fields', rows: rows.map(([label, value, clue]) => ({ label, value, ...(clue ? { clue } : {}) })) });
    return this;
  }

  table(columns: readonly string[], rows: readonly (readonly string[] | { cells: readonly string[]; clue?: string })[], options: { title?: string; footer?: readonly string[]; align?: readonly ('left' | 'right')[] } = {}): this {
    this.blocks.push({
      kind: 'table',
      columns,
      rows: rows.map((r) => (Array.isArray(r) ? { cells: r as readonly string[] } : (r as { cells: readonly string[]; clue?: string }))),
      ...(options.title ? { title: options.title } : {}),
      ...(options.footer ? { footer: options.footer } : {}),
      align: options.align ?? columns.map((_, i) => (i === 0 ? 'left' : 'right')),
    });
    return this;
  }

  list(items: readonly (string | { text: string; clue?: string })[]): this {
    this.blocks.push({ kind: 'list', items: items.map((x) => (typeof x === 'string' ? { text: x } : x)) });
    return this;
  }

  sign(name: string, role: string, on?: IsoDate): this {
    this.blocks.push({ kind: 'signature', name, role, ...(on ? { date: date(on) } : {}) });
    return this;
  }

  stamp(text: string, on: IsoDate, clue?: string): this {
    this.blocks.push({ kind: 'stamp', text, date: date(on), ...(clue ? { clue } : {}) });
    return this;
  }

  note(text: string, clue?: string): this {
    this.blocks.push({ kind: 'note', text, ...(clue ? { clue } : {}) });
    return this;
  }

  build(): DocumentModel {
    const { availability, ...rest } = this.meta;
    const a: Availability = !availability
      ? { kind: 'initial' }
      : availability.kind === 'onRequest' && 'family' in availability && availability.family !== undefined
        ? { ...availability, request: availability.request ?? requestKey(availability.family, availability.object ?? '') }
        : (availability as Availability);
    return { ...rest, availability: a, blocks: this.blocks, clues: this.clues };
  }
}
