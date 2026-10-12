/**
 * Core accounting types — pure engine layer (no React, no game rules).
 * Business vocabulary (French accounting terms) is given in comments;
 * identifiers stay in English.
 */
import type { Cents } from './money';
import type { IsoDate } from './dates';

export type { Cents } from './money';
export type { IsoDate } from './dates';

export type FiscalYear = number;
export type AccountNumber = string;
export type EntryId = string;
export type JournalCode = string;
/** Internal entry user (not exported to the FEC), e.g. 'NFERRAND', 'MIGRATION'. */
export type UserId = string;

// ---------------------------------------------------------------------------
// Chart of accounts (plan de comptes)
// ---------------------------------------------------------------------------

export type AccountClass = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Account {
  number: AccountNumber;
  label: string;
  accountClass: AccountClass;
  normalSide: 'debit' | 'credit';
  /** Statement line used when the closing balance is a debit (resp. credit). */
  rubriqueDebit: string;
  rubriqueCredit: string;
  /** Line of an annex table, e.g. 'provisions:pge'. */
  annex?: string;
  /** CAF item (additive method), e.g. 'depreciationCharge'. */
  cafItem?: string;
  /** true while the number/label is a proposal not validated by an expert. */
  toValidate: boolean;
  source: 'proposal' | 'import';
  comment?: string;
}

export interface ChartOfAccounts {
  framework: string;
  accounts: readonly Account[];
}

// ---------------------------------------------------------------------------
// Journal entries and ledgers
// ---------------------------------------------------------------------------

export type JournalKind = 'opening' | 'rentInterface' | 'purchases' | 'bank' | 'payroll' | 'misc' | 'inventory';

export interface Journal {
  code: JournalCode;
  label: string;
  kind: JournalKind;
}

/**
 * Object references carried by entry lines, as compact strings:
 * 'prog:TIL', 'comp:TIL-B1-STR', 'loan:L042', 'tp:F0012', 'inv:FA-2025-0001', 'sub:S014'.
 */
export type ObjectRefString = string;

/** Structured object reference used by findings and clues. */
export interface ObjectRef {
  kind: 'programme' | 'component' | 'subsidy' | 'loan' | 'lease' | 'tenant' | 'thirdParty' | 'invoice' | 'provision' | 'account' | 'document';
  id: string;
}

export interface EntryLine {
  account: AccountNumber;
  debit: Cents;
  credit: Cents;
  /** Auxiliary account (CompAuxNum); its label comes from World.auxiliaries. */
  aux?: string;
  /** Overrides the entry label for this line. */
  label?: string;
  lettering?: string;
  letteringDate?: IsoDate;
  refs?: readonly ObjectRefString[];
}

export interface JournalEntry {
  /** Stable id, unique across clean entries, patches and corrections. */
  id: EntryId;
  journal: JournalCode;
  /** EcritureDate */
  date: IsoDate;
  pieceRef?: string;
  pieceDate?: IsoDate;
  label: string;
  lines: readonly EntryLine[];
  /** ValidDate — closing entries are validated after year end. */
  validDate: IsoDate;
  /** Internal user, exploited by journal-entry testing tools, never exported. */
  enteredBy: UserId;
  /** 'gen:<stream>' | 'anomaly:<id>' | 'correction:<id>' | 'player:<findingId>' */
  origin: string;
}

/** Entry before id/validation metadata are assigned (corrections, player proposals). */
export type JournalEntryDraft = Omit<JournalEntry, 'id' | 'validDate' | 'enteredBy' | 'origin'>;

export interface Ledger {
  fiscalYear: FiscalYear;
  openingDate: IsoDate;
  closingDate: IsoDate;
  entries: readonly JournalEntry[];
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

/** Signed amounts: debit positive, credit negative. */
export interface TrialBalanceRow {
  account: AccountNumber;
  label: string;
  opening: Cents;
  debit: Cents;
  credit: Cents;
  closing: Cents;
}

export interface TrialBalance {
  fiscalYear: FiscalYear;
  rows: readonly TrialBalanceRow[];
  totals: { opening: Cents; debit: Cents; credit: Cents; closing: Cents };
}

/** One FEC line — 18 fields of the LPF format, serialised as text. */
export interface FecLine {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string;
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  Debit: string;
  Credit: string;
  EcritureLet: string;
  DateLet: string;
  ValidDate: string;
  Montantdevise: string;
  Idevise: string;
}

/** In-app FEC line: exported fields plus internal fields for the analysis tools. */
export interface FecLineInternal extends FecLine {
  readonly entryId: EntryId;
  readonly enteredBy: UserId;
  readonly debitCents: Cents;
  readonly creditCents: Cents;
  readonly date: IsoDate;
  readonly validDate: IsoDate;
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export type StatementId = 'assets' | 'liabilities' | 'income';

export interface StatementLineDef {
  id: string;
  statement: StatementId;
  label: string;
  /** Parent subtotal line. */
  parent?: string;
  kind: 'detail' | 'subtotal' | 'total';
  /** For income-statement detail lines: charges are debit-positive, products credit-positive. */
  nature?: 'charge' | 'product';
  /** Liabilities line computed as the result of the income statement. */
  isResult?: boolean;
  /** Explicit formula for totals: ['+PRODUITS_EXPL', '-CHARGES_EXPL']. Without formula, a subtotal sums its children. */
  formula?: readonly string[];
}

export interface StatementLineValue {
  id: string;
  /** Net amount for the year (assets: net of depreciation). */
  current: Cents;
  prior: Cents;
  /** Assets only. */
  currentGross?: Cents;
  currentDepreciation?: Cents;
}

export interface FinancialStatements {
  lines: Readonly<Record<string, StatementLineValue>>;
  checks: {
    assetsTotal: Cents;
    liabilitiesTotal: Cents;
    incomeStatementResult: Cents;
    balanceSheetResult: Cents;
    priorAssetsTotal: Cents;
    priorLiabilitiesTotal: Cents;
  };
}

// ---------------------------------------------------------------------------
// Sub-ledger datasets
// ---------------------------------------------------------------------------

export type ProgrammeKind = 'family' | 'collective';

export interface Programme {
  id: string;
  name: string;
  commune: string;
  kind: ProgrammeKind;
  /** Dwellings (family) or places (collective residences) at 01/01/2024. */
  units: number;
  constructionYear: number;
  inServiceDate: IsoDate;
  financing: string;
  regulated: boolean;
  commercialUnits: number;
  parkingSpaces: number;
  energyClassGUnits: number;
  buildings: number;
  /** Collective residences: managing association (third-party id). */
  managerId?: string;
  /** Lots held in a co-ownership managed by a syndic. */
  coOwnership?: boolean;
}

export type ComponentFamily =
  | 'land'
  | 'structure'
  | 'windows'
  | 'heating'
  | 'roofing'
  | 'facade'
  | 'electricity'
  | 'plumbing'
  | 'lifts'
  | 'fittings'
  | 'other';

export interface AssetComponent {
  id: string;
  programmeId: string;
  building: string;
  family: ComponentFamily;
  label: string;
  /** Operation that financed it (construction, rehabilitation, replacement). */
  operationId: string;
  account: AccountNumber;
  cost: Cents;
  inServiceDate: IsoDate;
  /** 0 = not depreciated (land). */
  usefulLifeYears: number;
  replacesComponentId?: string;
  /** Last day of depreciation and exit reason. */
  disposal?: { date: IsoDate; reason: 'sale' | 'demolition' | 'replacement' | 'scrapped'; saleId?: string };
  /** Revised plan (demolition decided): from `from`, the net book value is depreciated until `until`. */
  revisedPlan?: { from: IsoDate; until: IsoDate };
}

export interface Operation {
  id: string;
  programmeId: string;
  kind: 'construction' | 'rehabilitation' | 'replacement' | 'improvement' | 'acquisition';
  label: string;
  year: number;
}

export interface Subsidy {
  id: string;
  operationId: string;
  programmeId: string;
  grantorId: string;
  account: AccountNumber;
  amount: Cents;
  decisionDate: IsoDate;
  /** Lapse clause (caducité). */
  lapse?: { worksMustStartBefore: IsoDate; noticeDate?: IsoDate };
  /** Cash received schedule. */
  receipts: readonly { date: IsoDate; amount: Cents }[];
  /** Cancelled (caducité notified) — no longer recognised from this date. */
  cancelledOn?: IsoDate;
}

export type LoanRate =
  | { kind: 'fixed'; ratePct: number }
  | { kind: 'livretA'; marginPct: number; floorPct?: number }
  | { kind: 'zeroThenLivretA'; zeroUntil: IsoDate; marginPct: number };

export interface Loan {
  id: string;
  lenderId: string;
  product: string;
  programmeId?: string;
  activity: 'rental' | 'other';
  account: AccountNumber;
  contractNumber: string;
  /** Original principal (display) and signature date. */
  principal: Cents;
  startDate: IsoDate;
  /** Schedule anchor: outstanding capital right after `refDate` (a due date or the drawdown date). */
  refDate: IsoDate;
  refOutstanding: Cents;
  /** Number of remaining periods after refDate. */
  remainingPeriods: number;
  periodMonths: 12 | 6 | 3;
  /** First due date after refDate. */
  nextDueDate: IsoDate;
  rate: LoanRate;
  amortisation: 'annuity' | 'constant' | 'deferred';
  /** Deferred amortisation: number of interest-only (or zero) periods first. */
  deferredPeriods?: number;
}

export interface LoanScheduleLine {
  loanId: string;
  dueDate: IsoDate;
  periodStart: IsoDate;
  ratePct: number;
  interest: Cents;
  principal: Cents;
  early: boolean;
  outstandingAfter: Cents;
}

export interface ThirdParty {
  id: string;
  name: string;
  kind:
    | 'supplier'
    | 'lender'
    | 'notary'
    | 'lawyer'
    | 'publicBody'
    | 'groupEntity'
    | 'residenceManager'
    | 'tenantAssociation'
    | 'receiver'
    | 'socialBody'
    | 'other';
  relatedParty: boolean;
  /** Auxiliary account number (CompAuxNum) when it has one. */
  aux?: string;
}

export interface World {
  meta: {
    scenarioId: string;
    seed: string;
    generatorVersion: string;
    entityName: string;
    currentYear: FiscalYear;
    priorYear: FiscalYear;
  };
  chart: ChartOfAccounts;
  journals: readonly Journal[];
  auxiliaries: Readonly<Record<string, string>>;
  ledgers: { prior: Ledger; current: Ledger };
  /** Scenario-specific datasets (sub-ledgers, management data) — see scenario/types. */
  datasets: Readonly<Record<string, unknown>>;
  presentation: PresentationOverrides;
}

/** Presentation-only choices applied when building statements and notes (A21, A22). */
export interface PresentationOverrides {
  reclassifications: readonly { account: AccountNumber; to: string; years: readonly FiscalYear[] }[];
  annexCells: readonly { table: string; rowId: string; column: string; transform: 'transposeDigits23' | 'omit' }[];
}
