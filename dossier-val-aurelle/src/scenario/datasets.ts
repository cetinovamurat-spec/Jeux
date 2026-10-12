/**
 * Scenario datasets: sub-ledgers and management data of Val d'Aurelle Habitat.
 * Everything here is produced by the generator; amounts are integer cents.
 */
import type {
  AssetComponent,
  Cents,
  IsoDate,
  Loan,
  LoanScheduleLine,
  Operation,
  Programme,
  Subsidy,
  ThirdParty,
} from '../engine/types';

export interface Building {
  id: string;
  programmeId: string;
  label: string;
  units: number;
  /** Pavilions are individual houses (one building per house). */
  pavilion: boolean;
}

export type Typology = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export interface Dwelling {
  id: string;
  programmeId: string;
  buildingId: string;
  typology: Typology;
  surface: number;
  /** Rent in force for leases running on 01/01/2024 (after the 2024 revision). */
  rent2024: Cents;
  chargeProvision: Cents;
  regulated: boolean;
  energyClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  /** Technical vacancy (neutralised for demolition, works, heavy repairs): not re-let. */
  technicalVacancy?: { from: IsoDate; reason: 'demolition' | 'works' | 'heavyRepairs' };
}

export interface Lease {
  id: string;
  dwellingId: string;
  programmeId: string;
  tenantId: string;
  tenantName: string;
  /** First day of occupation and last day (inclusive); open-ended when absent. */
  start: IsoDate;
  end?: IsoDate;
  endReason?: 'departure' | 'sale' | 'relocation';
  /** Monthly rent by year (loyer principal hors charges). */
  rent: { y2024: Cents; y2025: Cents };
  chargeProvision: { y2024: Cents; y2025: Cents };
  rls: { y2024: Cents; y2025: Cents };
  apl: { y2024: Cents; y2025: Cents };
  deposit: Cents;
  regulated: boolean;
}

export type TenantCategory = 'present' | 'presentOver6m' | 'procedure' | 'debtDischarge' | 'former';

/** Tenant account in the property-management software (auxiliaire LOGIGES). */
export interface TenantAccount {
  id: string;
  name: string;
  leaseId?: string;
  programmeId: string;
  /** Balance at year end (debit = owed by the tenant), category and deposit kept. */
  byYear: Record<'y2023' | 'y2024' | 'y2025', {
    balance: Cents;
    category: TenantCategory;
    /** Arrears ageing in months (0 when the balance is not a debt). */
    ageMonths: number;
    depositHeld: Cents;
  } | null>;
  departure?: { date: IsoDate; balance: Cents; depositHeld: Cents };
  writeOff?: { date: IsoDate; amount: Cents; reason: 'irrecoverable' | 'debtDischarge' };
  recoveries?: readonly { year: number; amount: Cents }[];
}

export interface Invoice {
  id: string;
  supplierId: string;
  number: string;
  invoiceDate: IsoDate;
  receivedDate: IsoDate;
  dueDate: IsoDate;
  paidDate?: IsoDate;
  /** Expense lines (account, programme, amount, recoverable nature). */
  lines: readonly { account: string; programmeId?: string; amount: Cents; nature?: string; componentId?: string; operationId?: string }[];
  total: Cents;
  description: string;
  orderRef?: string;
  /** Services of the year booked as an accrual when the invoice is received the next year. */
  serviceYear: number;
  category: string;
}

export interface Sale {
  id: string;
  programmeId: string;
  dwellingIds: readonly string[];
  componentIds: readonly string[];
  buyer: string;
  promiseDate: IsoDate;
  deedDate: IsoDate;
  paymentDate: IsoDate;
  notaryId: string;
  price: Cents;
}

export interface TaxNotice {
  programmeId: string;
  year: number;
  tfpb: Cents;
  teom: Cents;
  exemptUntil?: number;
}

export interface ChargesRegularisation {
  programmeId: string;
  year: number;
  /** Provisions for charges invoiced to tenants over the year. */
  provisionsCalled: Cents;
  /** Recoverable expenses by nature (eau, chauffage, gardiennage…). */
  expenses: Readonly<Record<string, Cents>>;
  /** Recoverable amount (expenses × occupancy). */
  recoverable: Cents;
  /** recoverable − provisionsCalled (positive = receivable from tenants). */
  regularisation: Cents;
}

export interface Caretaker {
  id: string;
  name: string;
  role: 'gardien' | 'employeImmeuble';
  programmeIds: readonly string[];
  tasks: readonly ('partiesCommunes' | 'rejets')[];
  annualCost: { y2024: Cents; y2025: Cents };
}

export interface PayrollMonth {
  year: number;
  month: number;
  headcount: number;
  gross: Cents;
  bonuses: Cents;
  employerUrssaf: Cents;
  employerPension: Cents;
  employerOther: Cents;
  employeeContributions: Cents;
  net: Cents;
}

export interface MaintenancePlanItem {
  id: string;
  programmeId: string;
  nature: string;
  plannedYear: number;
  amount: Cents;
  /** Year from which the provision is constituted. */
  provisionFrom: number;
  /** Year the works were actually carried out (if any). */
  realisedYear?: number;
  /** Provision balance at each year end. */
  provision: { y2023: Cents; y2024: Cents; y2025: Cents };
  /** Listed in the official multi-year maintenance plan of the asset department. */
  inOfficialPlan: boolean;
}

export interface PgeMovements {
  year: number;
  opening: Cents;
  dotation: Cents;
  reprise: Cents;
  closing: Cents;
}

export interface HistoryYear {
  year: number;
  netResult: Cents;
  rents: Cents;
  netSelfFinancingRatioPct: number;
  capital: Cents;
}

export interface ScenarioDatasets {
  programmes: readonly Programme[];
  buildings: readonly Building[];
  dwellings: readonly Dwelling[];
  components: readonly AssetComponent[];
  operations: readonly Operation[];
  subsidies: readonly Subsidy[];
  loans: readonly Loan[];
  loanSchedules: readonly LoanScheduleLine[];
  thirdParties: readonly ThirdParty[];
  leases: readonly Lease[];
  tenants: readonly TenantAccount[];
  invoices: readonly Invoice[];
  sales: readonly Sale[];
  taxNotices: readonly TaxNotice[];
  regularisations: readonly ChargesRegularisation[];
  caretakers: readonly Caretaker[];
  payroll: readonly PayrollMonth[];
  maintenancePlan: readonly MaintenancePlanItem[];
  pge: readonly PgeMovements[];
  history: readonly HistoryYear[];
}
