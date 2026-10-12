/** Zod schemas of the editable scenario parameters (validated at load time). */
import { z } from 'zod';

const year = z.number().int().min(1900).max(2100);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const euros = z.number();
const table = z.array(z.tuple([z.number(), z.number()])).min(1);
const byYear = z.record(z.string().regex(/^\d{4}$/), z.number());

export const programmeSchema = z.object({
  id: z.string().regex(/^[A-Z]{3}$/),
  name: z.string(),
  commune: z.string(),
  kind: z.enum(['family', 'collective']),
  units: z.number().int().positive(),
  constructionYear: year,
  inServiceMonth: z.number().int().min(1).max(12),
  financing: z.string(),
  regulated: z.boolean(),
  commercialUnits: z.number().int().min(0),
  parkingSpaces: z.number().int().min(0),
  energyClassGUnits: z.number().int().min(0),
  buildings: z.number().int().positive(),
  pavilions: z.boolean(),
  heating: z.enum(['collective', 'individual']),
  managerId: z.string().optional(),
  monthlyFeeEuros: z.number().optional(),
  coOwnership: z.boolean().optional(),
});
export type ProgrammeParams = z.infer<typeof programmeSchema>;

export const programmesFileSchema = z.object({ programmes: z.array(programmeSchema).length(40) });

export const componentsSchema = z.object({
  toVerify: z.boolean(),
  families: z.record(
    z.string(),
    z.object({ label: z.string(), account: z.string(), lifeYears: z.number().min(0), inNomenclature: z.boolean().optional() }),
  ),
  newConstructionShares: z.record(z.string(), z.number()),
  retrospectiveShares: z.record(z.string(), z.union([z.number(), z.string()])),
  retrospectiveBefore: z.number().int(),
  rehabilitationShares: z.record(z.string(), z.number()),
});
export type ComponentsParams = z.infer<typeof componentsSchema>;

export const loanProductsSchema = z.object({
  toVerify: z.boolean(),
  products: z.record(
    z.string(),
    z.object({
      label: z.string(),
      lender: z.enum(['BDT', 'BANK', 'AL']),
      account: z.string(),
      marginPct: z.number().optional(),
      zeroYears: z.number().optional(),
      years: z.number().int().positive(),
    }),
  ),
});
export type LoanProductsParams = z.infer<typeof loanProductsSchema>;

export const regulatorySchema = z.object({
  livretA: z.object({ toVerify: z.boolean(), ref: z.string(), history: z.array(z.object({ from: isoDate, ratePct: z.number() })).min(1) }),
  irl: z.object({
    toVerify: z.boolean(),
    ref: z.string(),
    values: z.array(z.object({ quarter: z.string(), index: z.number(), annualChangePct: z.number() })),
    capPct: z.number(),
    capPeriod: z.string(),
  }),
  rentRevision: z.object({
    toVerify: z.boolean(),
    ref: z.string(),
    byYear: z.record(z.string(), z.object({ legalCapPct: z.number(), appliedPct: z.number(), votedByBoardPct: z.number().optional() })),
  }),
  netSelfFinancing: z.object({
    toVerify: z.boolean(),
    ref: z.string(),
    referenceRateYearPct: z.number(),
    referenceRate3YearsPct: z.number(),
    threeYearMethod: z.enum(['meanOfRatios', 'ratioOfSums']),
  }),
  recoverableShares: z.object({
    toVerify: z.boolean(),
    ref: z.string(),
    caretakerBothTasks: z.number(),
    caretakerOneTask: z.number(),
    buildingEmployee: z.number(),
  }),
  corporateIncomeTax: z.object({ rate: z.number(), comment: z.string() }),
  materiality: z.object({
    reference: z.object({ overallEuros: euros, performanceEuros: euros, trivialEuros: euros }),
    acceptableOverallRangeEuros: z.tuple([euros, euros]),
    benchmark: z.string(),
    benchmarkRangePct: z.tuple([z.number(), z.number()]),
  }),
});
export type RegulatoryParams = z.infer<typeof regulatorySchema>;

const prefixRule = z.object({ include: z.array(z.string()), exclude: z.array(z.string()).optional() });
export const analysisSchema = z.object({
  toValidate: z.boolean(),
  rents: prefixRule,
  chargeRecoveries: prefixRule,
  ebe: z.object({ products: prefixRule, charges: prefixRule }),
  caf: z.object({ addBack: prefixRule, deduct: prefixRule }),
  netSelfFinancing: z.object({ activityIncome: prefixRule, financialIncome: prefixRule }),
  financialCharges: prefixRule,
  disposalGains: z.object({ proceeds: prefixRule, bookValue: prefixRule }),
});

export const statementsSchema = z.object({
  toValidate: z.boolean(),
  lines: z.array(
    z.object({
      id: z.string(),
      statement: z.enum(['assets', 'liabilities', 'income']),
      label: z.string(),
      kind: z.enum(['detail', 'subtotal', 'total']),
      parent: z.string().optional(),
      nature: z.enum(['charge', 'product']).optional(),
      isResult: z.boolean().optional(),
      formula: z.array(z.string()).optional(),
    }),
  ),
});

const target = z.object({
  value: z.number().optional(),
  tol: z.number().optional(),
  tolPct: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type Target = z.infer<typeof target>;

export const calibrationSchema = z.object({
  presented: z.record(z.string(), z.record(z.string(), target)),
  clean: z.record(z.string(), z.record(z.string(), target)),
  anomalyMetrics: z.record(z.string(), z.union([target, z.string()])),
});
export type CalibrationParams = z.infer<typeof calibrationSchema>;

const charge = z.object({ account: z.string(), '2024': euros, '2025': euros, collectiveOnly: z.boolean().optional(), lever: z.boolean().optional() });

export const scenarioSchema = z.object({
  seed: z.string(),
  entity: z.object({
    name: z.string(),
    legalForm: z.string(),
    registeredOffice: z.string(),
    capitalEuros: euros,
    referenceShareholder: z.string(),
    group: z.string(),
  }),
  years: z.object({ prior: year, current: year }),
  users: z.object({
    cfoBefore: z.object({ id: z.string(), until: isoDate }),
    cfo: z.object({ id: z.string(), from: isoDate }),
    chiefAccountant: z.string(),
    payablesAccountant: z.string(),
    treasuryAccountant: z.string(),
    rentInterfaceBefore: z.string(),
    rentInterfaceAfter: z.string(),
    payrollInterface: z.string(),
    migration: z.string(),
    migrationDate: isoDate,
    migrationWeekend: z.array(isoDate),
  }),
  assets: z.object({
    costPerUnitByYear: table,
    collectivePlaceFactor: z.number(),
    landShareByYear: table,
    pavilionFactor: z.number(),
    rehab: z.object({ builtBefore: year, minAge: z.number(), maxAge: z.number(), costPerUnitByYear: table, secondWaveAfterYears: z.number() }),
    subsidyRateByYear: table,
    rehabSubsidyRate: z.number(),
    headOffice: z.object({ costEuros: euros, landEuros: euros, inService: isoDate, lifeYears: z.number() }),
    itEquipmentPerYearEuros: euros,
    furniturePerYearEuros: euros,
    newSoftware: z.object({ costEuros: euros, inService: isoDate, lifeYears: z.number() }),
  }),
  specific: z.object({
    tilleuls: z.object({
      costEuros: euros,
      landEuros: euros,
      os7Euros: euros,
      penaltiesEuros: euros,
      workStart: isoDate,
      receptionDate: isoDate,
      inServiceDate: isoDate,
      spentBefore2024Euros: euros,
      spent2024Euros: euros,
      subsidies: z.array(z.object({ grantor: z.string(), amountEuros: euros })),
    }),
    erables: z.object({ boilerCostEuros: euros, boilerInService: isoDate, heatPumpCostEuros: euros, heatPumpInService: isoDate, disposalDate: isoDate }),
    glycinesB: z.object({
      rehabInService: isoDate,
      rehabCostEuros: euros,
      rehabStructureShare: z.number(),
      rehabSubsidyEuros: euros,
      boardDecision: isoDate,
      anruAmendment: isoDate,
      relocationStart: isoDate,
      revisedFrom: isoDate,
      demolitionPlannedEnd: isoDate,
      relocatedBy2025End: z.number().int(),
    }),
    peupliers: z.object({ inService: isoDate, doorsEuros: euros, maintenanceItems: z.array(z.object({ label: z.string(), euros })) }),
    charmes: z.object({
      subsidyEuros: euros,
      decisionDate: isoDate,
      lapseYears: z.number(),
      prorogationRequest: isoDate,
      worksOrderDate: isoDate,
      lapseNoticeDate: isoDate,
      works2025Euros: euros,
    }),
    closFleuri2026: z.object({
      units: z.number().int(),
      promiseDate: isoDate,
      deedDate: isoDate,
      notaryPaymentDate: isoDate,
      priceEuros: euros,
      nbvTargetEuros: euros,
    }),
    sisterAdvance: z.object({ conventionDate: isoDate, date: isoDate, euros, ceilingEuros: euros }),
    phb: z.object({ date: isoDate, euros }),
  }),
  operationsInProgress: z.array(
    z.object({
      id: z.string().regex(/^[A-Z]{3}$/),
      name: z.string(),
      commune: z.string(),
      units: z.number().int(),
      landEuros: euros,
      costEuros: euros,
      landDate: isoDate,
      worksStart: isoDate,
      spent2024Euros: euros,
      spent2025Euros: euros,
      delivery: isoDate,
      subsidyRate: z.number(),
      subsidyDecision: isoDate,
    }),
  ),
  sales: z.record(z.string(), z.array(z.object({ programme: z.string(), units: z.number().int() }))),
  rents: z.object({
    perM2ByYear: table,
    commercialMonthlyEuros: euros,
    parkingMonthlyEuros: euros,
    parkingOccupancy: z.number(),
    chargeProvisionPerM2: z.number(),
    rlsShare: z.number(),
    rlsMonthlyEuros: z.array(z.number()).length(5),
    aplShare: z.number(),
    aplMonthlyMeanEuros: euros,
    turnoverPerYear: z.number(),
    vacancyMonthsMean: z.number(),
    departuresWithDebtShare: z.number(),
  }),
  tenants: z.object({
    y2023: z.object({ presentEuros: euros, over6mEuros: euros, procedureEuros: euros, creditEuros: euros, formerNetEuros: euros, formerDepositsEuros: euros }),
    y2024: z.object({
      presentEuros: euros,
      over6mEuros: euros,
      debtDischargeEuros: euros,
      procedureEuros: euros,
      creditEuros: euros,
      formerNetEuros: euros,
      formerDepositsEuros: euros,
    }),
    y2025: z.object({ presentEuros: euros, over6mEuros: euros, procedureEuros: euros, creditEuros: euros, formerNetEuros: euros, formerDepositsEuros: euros }),
    writeOffsEuros: byYear,
    recoveryRate: z.number(),
    debtDischargeWriteOffDate: isoDate,
    presentedMethod: z.object({ formerRate: z.number(), debtDischargeAsOver6m: z.boolean(), residenceManagerRate: z.number() }),
    cleanMethod: z.object({ formerRate: z.number(), over6mRate: z.number(), procedureRate: z.number(), residenceManagerRate: z.number() }),
  }),
  residenceManagers: z.record(z.string(), z.object({ stopsPayingFrom: isoDate })),
  charges: z.object({
    recoverable: z.record(z.string(), charge),
    coOwnership: z.object({ currentChargesEuros: byYear, recoverableShare: z.number(), syndicFeesEuros: byYear }),
    nonRecoverable: z.record(z.string(), charge),
    gieYearEndComplementEuros: byYear,
    overdueUnpaidAtYearEnd: z.record(z.string(), z.object({ count: z.number().int(), euros })),
  }),
  taxes: z.object({
    tfpbEuros: byYear,
    teomEuros: byYear,
    otherEuros: byYear,
    reliefEuros: byYear,
    reliefClaim2025: z.object({ claimDate: isoDate, notifiedDate: isoDate, acceptedShare: z.number() }),
  }),
  payroll: z.object({
    totalEuros: byYear,
    headcount: byYear,
    valueSharingBonusEuros: byYear,
    caretakers: z.object({ count: z.number().int(), costEuros: byYear }),
    buildingEmployees: z.object({ count: z.number().int(), costEuros: byYear }),
    paidLeaveProvisionEuros: byYear,
  }),
  otherIncome: z.object({ ancillaryEuros: byYear, operatingSubsidiesEuros: byYear, miscEuros: byYear, insuranceIndemnitiesEuros: byYear }),
  otherCharges: z.object({ penaltiesEuros: byYear, relocationEuros: byYear, miscManagementEuros: byYear }),
  treasury: z.object({ termDepositsEuros: byYear, financialIncomeEuros: byYear }),
  provisions: z.object({
    pge: z.object({
      reprise2024Euros: euros,
      y2025: z.object({ opening: euros, dotation: euros, reprise: euros, closing: euros }),
      acaciasRavalement2026Euros: euros,
      belvedereEtancheite2027Euros: euros,
    }),
    risks: z.object({ '2023': euros, dotation: byYear, reprise: byYear }),
  }),
  openingBalances2023: z.record(z.string(), euros),
  commitments: z.object({ retirementEuros: byYear, actuarialReportDate: isoDate, guaranteedLoansShare: z.number() }),
  history: z.array(z.object({ year, netResultEuros: euros, rentsEuros: euros, netSelfFinancingRatioPct: z.number() })),
  loans: z.object({
    count: z.number().int(),
    refDate: isoDate,
    bankRatePctRange: z.tuple([z.number(), z.number()]),
    actionLogementRatePctRange: z.tuple([z.number(), z.number()]),
    new: z.array(z.object({ id: z.string(), product: z.string(), programme: z.string().optional(), date: isoDate, euros, ratePct: z.number().optional() })),
  }),
});
export type ScenarioParams = z.infer<typeof scenarioSchema>;
