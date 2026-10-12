/** Generator state, levers and entry book. */
import { cleanLines } from '../../engine/ledger';
import { eurosToCents, type Cents } from '../../engine/money';
import type { Rng } from '../../engine/rng';
import type {
  AssetComponent,
  EntryLine,
  JournalEntry,
  Loan,
  LoanScheduleLine,
  Operation,
  Programme,
  Subsidy,
  ThirdParty,
} from '../../engine/types';
import type {
  Building,
  Caretaker,
  ChargesRegularisation,
  Dwelling,
  Invoice,
  Lease,
  MaintenancePlanItem,
  PayrollMonth,
  PgeMovements,
  Sale,
  TaxNotice,
  TenantAccount,
} from '../datasets';
import type { Params } from '../params';
import type { ProgrammeParams } from '../schema';

/** Global calibration levers (solved by scripts/calibration-report.ts, stored in params/levers.json). */
export interface Levers {
  constructionCostScale: number;
  subsidyScale: number;
  maintenance2024Euros: number;
  maintenance2025Euros: number;
  pgeDotation2024Euros: number;
  openingCashEuros: number;
  /** Years added in 2019–2020 to the remaining term of Banque des Territoires loans (solved; -1 = search). */
  loanExtensionYears: number;
}

export const DEFAULT_LEVERS: Levers = {
  constructionCostScale: 1,
  subsidyScale: 1,
  maintenance2024Euros: 3_600_000,
  maintenance2025Euros: 3_400_000,
  pgeDotation2024Euros: 1_500_000,
  openingCashEuros: 4_000_000,
  loanExtensionYears: -1,
};

export const eur = eurosToCents;

/** Piecewise-linear interpolation in a [[x, y], …] table. */
export function interp(table: readonly (readonly [number, number])[], x: number): number {
  const first = table[0]!;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!;
    const [x0, y0] = table[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return table[table.length - 1]![1];
}

export interface WipItem {
  operationId: string;
  programmeId: string;
  account: '2312' | '2313';
  date: string;
  amount: Cents;
  invoiceId?: string;
}

export interface EntryInput {
  journal: string;
  date: string;
  label: string;
  lines: readonly EntryLine[];
  validDate: string;
  enteredBy: string;
  stream: string;
  pieceRef?: string;
  pieceDate?: string;
  /** Closing accruals reversed at the opening of the next year. */
  reverseNextYear?: boolean;
}

export class Book {
  readonly entries: JournalEntry[] = [];
  readonly reversals: JournalEntry[] = [];
  private seq = new Map<string, number>();
  constructor(readonly year: number) {}

  add(input: EntryInput): JournalEntry | null {
    const lines = cleanLines(input.lines);
    if (lines.length === 0) return null;
    const n = (this.seq.get(input.stream) ?? 0) + 1;
    this.seq.set(input.stream, n);
    const entry: JournalEntry = {
      id: `${this.year}:${input.stream}:${String(n).padStart(5, '0')}`,
      journal: input.journal,
      date: input.date,
      label: input.label,
      lines,
      validDate: input.validDate < input.date ? input.date : input.validDate,
      enteredBy: input.enteredBy,
      origin: `gen:${input.stream}`,
    };
    if (input.pieceRef) entry.pieceRef = input.pieceRef;
    if (input.pieceDate) entry.pieceDate = input.pieceDate;
    this.entries.push(entry);
    if (input.reverseNextYear) this.reversals.push(entry);
    return entry;
  }
}

export interface GenState {
  params: Params;
  levers: Levers;
  rng: Rng;
  progParams: Map<string, ProgrammeParams>;
  programmes: Programme[];
  buildings: Building[];
  dwellings: Dwelling[];
  operations: Operation[];
  components: AssetComponent[];
  subsidies: Subsidy[];
  thirdParties: ThirdParty[];
  loans: Loan[];
  schedules: Map<string, LoanScheduleLine[]>;
  leases: Lease[];
  tenants: TenantAccount[];
  invoices: Invoice[];
  sales: Sale[];
  taxNotices: TaxNotice[];
  regularisations: ChargesRegularisation[];
  caretakers: Caretaker[];
  payroll: PayrollMonth[];
  maintenancePlan: MaintenancePlanItem[];
  pge: PgeMovements[];
  wip: WipItem[];
  /** Metrics computed during generation for calibration of the J2 anomalies. */
  metrics: Record<string, number>;
}

export function grantorAccounts(grantorId: string): { equity: string; receivable: string; released: string } {
  switch (grantorId) {
    case 'ETAT':
      return { equity: '1311', receivable: '4411', released: '13911' };
    case 'REGION':
      return { equity: '1312', receivable: '4412', released: '13912' };
    case 'DEPARTEMENT':
      return { equity: '1313', receivable: '4413', released: '13913' };
    case 'ACTION_LOGEMENT':
      return { equity: '1317', receivable: '4417', released: '13917' };
    case 'ANRU':
      return { equity: '1318', receivable: '4418', released: '13918' };
    default:
      return { equity: '1314', receivable: '4414', released: '13914' };
  }
}

export function sumBy<T>(items: readonly T[], f: (t: T) => number): number {
  let s = 0;
  for (const it of items) s += f(it);
  return s;
}
