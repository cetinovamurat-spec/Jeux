/**
 * Core accounting types — pure engine layer (no React, no game rules).
 *
 * J0 draft, subject to validation. Business vocabulary (French accounting
 * terms) is given in comments where it helps; identifiers stay in English.
 */

// ---------------------------------------------------------------------------
// Primitive value types
// ---------------------------------------------------------------------------

/**
 * Amount in euro cents (signed integer). All engine arithmetic is done in
 * cents; rounding happens once, when an entry line is built.
 * Only engine helpers may create Cents from a literal (lint rule in ui/ and
 * scenario/documents/: no hand-typed amounts).
 */
export type Cents = number & { readonly __brand: 'Cents' };

/** Calendar date 'YYYY-MM-DD', time-zone free. */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

export type FiscalYear = number;

/** Account number kept as a string (e.g. '213100', '4111'). */
export type AccountNumber = string;

export type EntryId = string;
export type JournalCode = string;

/** Internal entry user (not exported to the FEC), e.g. 'NFERRAND', 'MIGRATION'. */
export type UserId = string;

// ---------------------------------------------------------------------------
// Chart of accounts (plan de comptes)
// ---------------------------------------------------------------------------

export type AccountClass = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type NormalSide = 'debit' | 'credit';

export type StatementLineId = string;
export type AnnexTableId =
  | 'fixedAssets'
  | 'depreciation'
  | 'provisions'
  | 'subsidies'
  | 'debts'
  | 'receivables'
  | 'commitments'
  | 'relatedParties';
export type CafItemId = string;

export interface Account {
  number: AccountNumber;
  label: string;
  accountClass: AccountClass;
  normalSide: NormalSide;
  /** Line of the balance sheet / income statement, depending on the sign of the closing balance. */
  statementMapping: { ifDebit: StatementLineId; ifCredit: StatementLineId };
  annex?: { table: AnnexTableId; line: string };
  /** Item of the CAF computation (additive method); absent = not a CAF item. */
  cafItem?: CafItemId;
  /** true while the number/label is a proposal not validated by an expert. */
  toValidate: boolean;
  source: 'proposal' | 'import';
  comment?: string;
}

export interface ChartOfAccounts {
  /** e.g. 'OLS-2025 (ANC 2015-04, instruction pre-2026)' */
  framework: string;
  accounts: readonly Account[];
}

// ---------------------------------------------------------------------------
// Business objects referenced by entries (drill-down, findings, clues)
// ---------------------------------------------------------------------------

export type ObjectKind =
  | 'programme'
  | 'component'
  | 'subsidy'
  | 'loan'
  | 'lease'
  | 'tenant'
  | 'thirdParty'
  | 'invoice'
  | 'provision'
  | 'account'
  | 'document';

export interface ObjectRef {
  kind: ObjectKind;
  id: string;
}

// ---------------------------------------------------------------------------
// Journal entries and ledgers
// ---------------------------------------------------------------------------

export type JournalKind =
  | 'opening'
  | 'rentInterface'
  | 'purchases'
  | 'bank'
  | 'payroll'
  | 'misc'
  | 'inventory';

export interface Journal {
  code: JournalCode;
  label: string;
  kind: JournalKind;
}

export interface EntryLine {
  account: AccountNumber;
  /** Auxiliary account (CompAuxNum / CompAuxLib), e.g. supplier or lender. */
  aux?: { number: string; label: string };
  debit: Cents;
  credit: Cents;
  /** Overrides the entry label for this line. */
  label?: string;
  lettering?: { code: string; date: IsoDate };
  refs?: ObjectRef[];
}

/** Who produced the entry: the clean generator, an anomaly patch, a correction or the player. */
export type EntryOrigin =
  | { kind: 'generator'; stream: string }
  | { kind: 'anomaly'; sourceId: string }
  | { kind: 'correction'; sourceId: string; partId?: string }
  | { kind: 'player'; findingId: string };

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
  /** ValidDate — may be after year end for closing entries (clue for A05, A11). */
  validDate: IsoDate;
  /** Internal user, exploited by journal-entry testing tools, never exported. */
  enteredBy: UserId;
  origin: EntryOrigin;
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
// Derived views: trial balance, general ledger, FEC
// ---------------------------------------------------------------------------

/** Signed amounts: debit positive, credit negative. */
export interface TrialBalanceRow {
  account: AccountNumber;
  opening: Cents;
  debit: Cents;
  credit: Cents;
  closing: Cents;
}

export interface TrialBalance {
  fiscalYear: FiscalYear;
  rows: readonly TrialBalanceRow[];
  totals: { debit: Cents; credit: Cents };
}

/** One line of the FEC — 18 fields of the LPF format, all serialised as text. */
export interface FecLine {
  JournalCode: string;
  JournalLib: string;
  /** Continuous sequence assigned in validation order (late entries get late numbers). */
  EcritureNum: string;
  /** AAAAMMJJ */
  EcritureDate: string;
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  /** Decimal comma, no thousands separator, e.g. '300000,00'. */
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
  readonly _entryId: EntryId;
  readonly _enteredBy: UserId;
}

// ---------------------------------------------------------------------------
// Financial statements and notes (états financiers, annexe)
// ---------------------------------------------------------------------------

export type StatementId = 'assets' | 'liabilities' | 'incomeStatement' | 'offBalanceSheet';

export interface StatementLineDef {
  id: StatementLineId;
  statement: StatementId;
  label: string;
  parent?: StatementLineId;
  order: number;
  kind: 'detail' | 'subtotal' | 'total';
  /** Assets only: show gross / depreciation / net columns. */
  grossAndDepreciation?: boolean;
}

export interface StatementLineValue {
  lineId: StatementLineId;
  current: Cents;
  prior: Cents;
  /** Assets: gross amount and accumulated depreciation of the current year. */
  gross?: Cents;
  depreciation?: Cents;
}

export interface FinancialStatements {
  fiscalYear: FiscalYear;
  lines: readonly StatementLineValue[];
  /** Integrity facts checked by tests (assets = liabilities, P&L result = balance-sheet result). */
  checks: { assetsTotal: Cents; liabilitiesTotal: Cents; resultFromIncomeStatement: Cents; resultInLiabilities: Cents };
}

export interface AnnexTable {
  id: AnnexTableId;
  title: string;
  columns: readonly string[];
  rows: readonly { id: string; label: string; cells: readonly Cents[] }[];
}

// ---------------------------------------------------------------------------
// Financial analysis: CAF, HLM net self-financing, ratios
// ---------------------------------------------------------------------------

export interface CafComputation {
  netResult: Cents;
  /** Additive method: non-cash charges added back, non-cash income and disposal results deducted. */
  adjustments: readonly { item: CafItemId; label: string; amount: Cents }[];
  caf: Cents;
}

/** Autofinancement net HLM — convention parameterised in params/regulatory.json (to be validated). */
export interface NetSelfFinancing {
  caf: Cents;
  /** Principal repayments of rental-activity loans, excluding early repayments. */
  loanRepayments: Cents;
  earlyRepaymentsExcluded: Cents;
  netSelfFinancing: Cents;
  denominator: { activityIncome: Cents; chargeRecoveriesExcluded: Cents; financialIncome: Cents; total: Cents };
  /** ratio = netSelfFinancing / denominator.total */
  ratio: number;
}

// ---------------------------------------------------------------------------
// Sub-ledger datasets (patrimoine, immobilisations, dette, locataires, achats)
// ---------------------------------------------------------------------------

export type FinancingType = 'PLAI' | 'PLUS' | 'PLS' | 'PLA' | 'HLMO' | 'PALULOS' | 'PAM' | 'none';

export interface Programme {
  id: string;
  name: string;
  commune: string;
  kind: 'family' | 'collectiveResidence' | 'commercial' | 'parking' | 'mixed';
  housingUnits: number;
  constructionYear: number;
  inServiceDate?: IsoDate;
  financing: readonly FinancingType[];
  /** Number of dwellings rated G (DPE) — Glycines context. */
  energyClassGUnits: number;
  status: 'inService' | 'underConstruction' | 'demolitionDecided' | 'partlySold';
  managerThirdPartyId?: string;
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
  | 'other';

export interface AssetComponent {
  id: string;
  programmeId: string;
  family: ComponentFamily;
  label: string;
  cost: Cents;
  inServiceDate: IsoDate;
  /** 0 for land (not depreciated). */
  usefulLifeYears: number;
  acquisitionKind: 'initial' | 'replacement' | 'improvement';
  replacesComponentId?: string;
  disposal?: { date: IsoDate; reason: 'sale' | 'demolition' | 'replacement'; proceeds?: Cents };
  /** Revised plan (e.g. demolition decided): remaining value depreciated until this date. */
  revisedEndDate?: IsoDate;
}

/** Work in progress (immobilisations en cours) per programme/operation. */
export interface ConstructionOperation {
  id: string;
  programmeId: string;
  budget: Cents;
  receptionDate?: IsoDate;
  /** Fiche de situation financière et comptable status. */
  fsfcStatus: 'inProgress' | 'delivered' | 'closed';
}

export interface Subsidy {
  id: string;
  programmeId: string;
  grantorThirdPartyId: string;
  amount: Cents;
  decisionDate: IsoDate;
  /** Lapse clause (caducité) — A09. */
  lapse?: { worksMustStartBefore: IsoDate; lapsedOn?: IsoDate };
  receivedToDate: Cents;
}

export type LoanRate =
  | { kind: 'fixed'; ratePct: number }
  | { kind: 'livretA'; marginPct: number; floorPct?: number }
  | { kind: 'zeroThenLivretA'; zeroUntil: IsoDate; marginPct: number };

export interface Loan {
  id: string;
  lenderThirdPartyId: string;
  /** Product key in params/loan-products.json (PLUS, PLAI, PAM, PHB…). */
  product: string;
  programmeId?: string;
  /** Rental activity loans enter the HLM net self-financing computation. */
  activity: 'rental' | 'other';
  principal: Cents;
  startDate: IsoDate;
  maturityDate: IsoDate;
  periodicity: 'annual' | 'semiannual' | 'quarterly';
  firstDueDate: IsoDate;
  rate: LoanRate;
  amortisation: 'constant' | 'progressive' | 'inFine';
  progressivityPct?: number;
}

export interface LoanScheduleLine {
  loanId: string;
  dueDate: IsoDate;
  /** Rate applied over the period ending at dueDate (revised at the previous due date). */
  ratePct: number;
  interest: Cents;
  principal: Cents;
  early: boolean;
  outstandingAfter: Cents;
}

export interface Lease {
  id: string;
  programmeId: string;
  tenantId: string;
  startDate: IsoDate;
  endDate?: IsoDate;
  regulated: boolean; // logement conventionné
  /** Monthly amounts (loyer principal, provisions pour charges, RLS, APL). */
  monthlyRent: { y2024: Cents; y2025: Cents };
  monthlyChargeProvision: Cents;
  monthlyRls: Cents;
  monthlyApl: Cents;
  deposit: Cents;
}

export type TenantProcedure = 'none' | 'amicable' | 'litigation' | 'overindebtedness' | 'debtDischarge';

/** Tenant account in the property-management auxiliary (LOGIGES). */
export interface TenantAccount {
  tenantId: string;
  status: 'present' | 'former';
  balance: Cents; // signed: debit = owed by the tenant
  ageing: { lt3m: Cents; m3to6: Cents; m6to12: Cents; gt12m: Cents };
  procedure: TenantProcedure;
  depositHeld: Cents;
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
    | 'receiver';
  relatedParty: boolean;
}

export interface Invoice {
  id: string;
  supplierThirdPartyId: string;
  number: string;
  invoiceDate: IsoDate;
  receivedDate: IsoDate;
  dueDate: IsoDate;
  /** Recorded incl. non-recoverable VAT (simplification, see CLAUDE.md). */
  amount: Cents;
  account: AccountNumber;
  programmeId?: string;
  description: string;
  purchaseOrderRef?: string;
  paidDate?: IsoDate;
}

export interface Datasets {
  programmes: readonly Programme[];
  components: readonly AssetComponent[];
  operations: readonly ConstructionOperation[];
  subsidies: readonly Subsidy[];
  loans: readonly Loan[];
  loanSchedules: readonly LoanScheduleLine[];
  leases: readonly Lease[];
  tenants: readonly TenantAccount[];
  thirdParties: readonly ThirdParty[];
  invoices: readonly Invoice[];
}

export type DatasetName = keyof Datasets;

// ---------------------------------------------------------------------------
// World: everything the engine derives views from
// ---------------------------------------------------------------------------

/** Presentation-only choices applied when building statements and notes (A21, A22). */
export interface PresentationOverrides {
  reclassifications: readonly {
    account: AccountNumber;
    to: StatementLineId;
    years: readonly FiscalYear[];
  }[];
  annexCells: readonly {
    table: AnnexTableId;
    rowId: string;
    column: number;
    transform: { kind: 'transposeDigits'; positions: readonly [number, number] } | { kind: 'omit' };
  }[];
}

export interface World {
  chart: ChartOfAccounts;
  journals: readonly Journal[];
  /** 2024 is simulated with the same generator (certified accounts); 2025 is the audited year. */
  ledgers: { prior: Ledger; current: Ledger };
  datasets: Datasets;
  presentation: PresentationOverrides;
}
