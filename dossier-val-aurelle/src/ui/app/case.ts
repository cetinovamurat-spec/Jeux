/**
 * Case data on the main thread: the presented world (what the player
 * audits) and lazily computed, cached derivations. The clean world and the
 * correction key are only used by the designer mode and the control screens.
 */
import { keyFigures, type KeyFigures } from '../../engine/analysis';
import { closingBalances, trialBalance } from '../../engine/balance';
import { accountMap } from '../../engine/chart';
import { buildFec } from '../../engine/fec';
import type { Cents } from '../../engine/money';
import type { Account, FecLineInternal, FinancialStatements, TrialBalance, World } from '../../engine/types';
import { buildFecIndex, type FecIndex } from '../../game/fec-query';
import { buildDocumentIndex, type DocumentIndex } from '../../game/documents';
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
  /** Closing balance of the previous year (debit positive). */
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

  constructor(
    readonly payload: CasePayload,
    readonly params: Params,
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
  }

  get datasets(): ScenarioDatasets {
    return this.presented.datasets as unknown as ScenarioDatasets;
  }

  accountLabel(account: string): string {
    return this.accounts.get(account)?.label ?? '(compte inconnu)';
  }

  /** Closing balances of the presented world (debit positive). */
  readonly balances = lazy(() => ({ current: closingBalances(this.presented.ledgers.current), prior: closingBalances(this.presented.ledgers.prior) }));

  readonly trialBalances = lazy((): { current: TrialBalance; prior: TrialBalance } => ({
    current: trialBalance(this.presented.ledgers.current, this.presented.chart),
    prior: trialBalance(this.presented.ledgers.prior, this.presented.chart),
  }));

  /** Balance N / N-1 rows: every account with a balance or a movement in either year. */
  readonly balanceRows = lazy((): BalanceRow[] => {
    const cur = new Map(this.trialBalances().current.rows.map((r) => [r.account, r]));
    const prior = this.balances().prior;
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

  private readonly fecCache = new Map<Year, FecLineInternal[]>();
  fec(year: Year): FecLineInternal[] {
    let f = this.fecCache.get(year);
    if (!f) {
      const w = this.presented;
      f = buildFec(year === 2025 ? w.ledgers.current : w.ledgers.prior, w.chart, w.journals, w.auxiliaries);
      this.fecCache.set(year, f);
    }
    return f;
  }

  private readonly fecIndexCache = new Map<Year, FecIndex>();
  fecIndex(year: Year): FecIndex {
    let i = this.fecIndexCache.get(year);
    if (!i) {
      i = buildFecIndex(this.fec(year), { closingDate: `${year}-12-31`, maxLinesForPairs: 20 });
      this.fecIndexCache.set(year, i);
    }
    return i;
  }

  readonly documentIndex = lazy((): DocumentIndex => buildDocumentIndex(this.documents));
}
