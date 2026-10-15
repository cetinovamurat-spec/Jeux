/**
 * Case data on the main thread: the presented world (what the player
 * audits) and lazily computed, cached derivations. The clean world and the
 * correction key are only used by the designer mode and the control screens.
 *
 * A CaseData is a view of the case at a data vintage (game/vintages.ts):
 * `at(view)` returns the view (cached), with the same API; the 2025 ledger is
 * then empty, the extraction at the interim cutoff, or the final ledger. The
 * 2024 data, the documents and the indexes are shared by every view.
 */
import { keyFigures, type KeyFigures } from '../../engine/analysis';
import { closingBalances, trialBalance } from '../../engine/balance';
import { accountMap } from '../../engine/chart';
import { buildFec } from '../../engine/fec';
import type { Cents } from '../../engine/money';
import type { Account, FecLineInternal, FinancialStatements, Ledger, TrialBalance, World } from '../../engine/types';
import { buildFecIndex, type FecIndex } from '../../game/fec-query';
import { buildDocumentIndex, type DocumentIndex } from '../../game/documents';
import { emptyLedger, FULL_VIEW_KEY, ledgerAt, viewKey, type DataView } from '../../game/vintages';
import { buildAnnex, type AnnexTable } from '../../scenario/annex';
import { loanRepayments, type CorrectionKey } from '../../scenario/anomalies/presented';
import type { Synthesis } from '../../scenario/anomalies/synthesis';
import type { PresentationFacts } from '../../scenario/anomalies/draft';
import type { ScenarioDatasets } from '../../scenario/datasets';
import type { DocumentModel, FalseLead } from '../../scenario/documents';
import type { Params } from '../../scenario/params';
import type { CasePayload } from './dossier';

export type Year = 2025 | 2024;

export interface BalanceRow {
  account: string;
  label: string;
  /** Balance of the previous year at the same date as `closing` (31/12/2024, or the interim cutoff one year earlier), debit positive. */
  prior: Cents;
  /** Movements of the year (opening entry excluded). */
  debit: Cents;
  credit: Cents;
  opening: Cents;
  closing: Cents;
}

function lazy<T>(f: () => T): () => T {
  let done = false;
  let v: T;
  return () => {
    if (!done) {
      v = f();
      done = true;
    }
    return v;
  };
}

const FULL_VIEW: DataView = { ledger2025: 'draft', statements2025: true, cutoff: '2025-12-31', priorCutoff: '2024-12-31' };

/** Caches shared by every view of the case (2024 data, documents). */
interface Shared {
  views: Map<string, CaseData>;
  fec2024?: FecLineInternal[];
  fecIndex2024?: FecIndex;
  documentIndex?: DocumentIndex;
}

export class CaseData {
  readonly presented: World;
  readonly clean: World;
  readonly key: CorrectionKey;
  readonly synthesis: Synthesis;
  readonly facts: PresentationFacts;
  readonly documents: readonly DocumentModel[];
  readonly documentsById: ReadonlyMap<string, DocumentModel>;
  readonly falseLeads: readonly FalseLead[];
  readonly accounts: ReadonlyMap<string, Account>;

  /** Ledger of 2025 in this view (empty, extraction, or final). */
  readonly ledger2025: Ledger;

  constructor(
    readonly payload: CasePayload,
    readonly params: Params,
    readonly view: DataView = FULL_VIEW,
    private readonly shared: Shared = { views: new Map() },
  ) {
    this.key = payload.key;
    this.presented = payload.key.presented.world;
    this.clean = payload.clean;
    this.synthesis = payload.synthesis;
    this.facts = payload.key.presented.facts;
    this.documents = payload.documents;
    this.documentsById = new Map(payload.documents.map((d) => [d.id, d]));
    this.falseLeads = payload.falseLeads;
    this.accounts = accountMap(this.presented.chart);
    const current = this.presented.ledgers.current;
    this.ledger2025 = view.ledger2025 === 'draft' ? current : view.ledger2025 === 'interim' ? ledgerAt(current, view.cutoff) : emptyLedger(current);
    if (!shared.views.has(viewKey(view))) shared.views.set(viewKey(view), this);
  }

  /** The case at another data vintage (cached; the full view is the case itself when it was built without a view). */
  at(view: DataView): CaseData {
    const key = viewKey(view);
    const found = this.shared.views.get(key);
    if (found && found.view.cutoff === view.cutoff) return found;
    const v = new CaseData(this.payload, this.params, view, this.shared);
    this.shared.views.set(key, v);
    return v;
  }

  /** All the data (designer mode, control screens). */
  get full(): CaseData {
    return this.shared.views.get(FULL_VIEW_KEY) ?? this.at(FULL_VIEW);
  }

  get datasets(): ScenarioDatasets {
    return this.presented.datasets as unknown as ScenarioDatasets;
  }

  accountLabel(account: string): string {
    return this.accounts.get(account)?.label ?? '(compte inconnu)';
  }

  /** Closing balances of the presented world (debit positive). */
  readonly balances = lazy(() => ({ current: closingBalances(this.ledger2025), prior: closingBalances(this.presented.ledgers.prior) }));

  readonly trialBalances = lazy((): { current: TrialBalance; prior: TrialBalance } => ({
    current: trialBalance(this.ledger2025, this.presented.chart),
    prior: trialBalance(this.presented.ledgers.prior, this.presented.chart),
  }));

  /** Balances of 2024 at the same date as the 2025 data of the view (the interim cutoff one year earlier, or 31/12/2024). */
  readonly comparisonPrior = lazy(() => (this.view.ledger2025 === 'interim' ? closingBalances(ledgerAt(this.presented.ledgers.prior, this.view.priorCutoff)) : this.balances().prior));

  /** Balance N / N-1 rows: every account with a balance or a movement in either year. */
  readonly balanceRows = lazy((): BalanceRow[] => {
    const cur = new Map(this.trialBalances().current.rows.map((r) => [r.account, r]));
    const prior = this.comparisonPrior();
    const accounts = [...new Set([...cur.keys(), ...prior.keys()])].sort();
    return accounts.map((account) => {
      const r = cur.get(account);
      return { account, label: this.accountLabel(account), prior: prior.get(account) ?? 0, opening: r?.opening ?? 0, debit: r?.debit ?? 0, credit: r?.credit ?? 0, closing: r?.closing ?? 0 };
    });
  });

  /** Presented statements (current year and comparative as presented by the client). */
  get statements(): FinancialStatements {
    return this.key.presentedFigures.statements;
  }

  /** Statements of the certified 2024 accounts (comparative column of the clean world). */
  get certified2024(): FinancialStatements {
    return this.key.cleanFigures.statements;
  }

  readonly annex = lazy((): { current: AnnexTable[]; prior: AnnexTable[] } => ({ current: buildAnnex(this.presented, this.params, 'current'), prior: buildAnnex(this.presented, this.params, 'prior') }));

  readonly figures = lazy((): { y2025: KeyFigures; y2024: KeyFigures } => ({
    y2025: this.key.presentedFigures.figures,
    y2024: keyFigures(this.balances().prior, this.params.analysis, loanRepayments(this.presented, 2024)),
  }));

  private fec2025?: FecLineInternal[];
  fec(year: Year): FecLineInternal[] {
    const w = this.presented;
    if (year === 2024) return (this.shared.fec2024 ??= buildFec(w.ledgers.prior, w.chart, w.journals, w.auxiliaries));
    return (this.fec2025 ??= buildFec(this.ledger2025, w.chart, w.journals, w.auxiliaries));
  }

  private fecIndex2025?: FecIndex;
  fecIndex(year: Year): FecIndex {
    if (year === 2024) return (this.shared.fecIndex2024 ??= buildFecIndex(this.fec(2024), { closingDate: '2024-12-31', maxLinesForPairs: 20 }));
    return (this.fecIndex2025 ??= buildFecIndex(this.fec(2025), { closingDate: '2025-12-31', maxLinesForPairs: 20 }));
  }

  documentIndex(): DocumentIndex {
    return (this.shared.documentIndex ??= buildDocumentIndex(this.documents));
  }
}
