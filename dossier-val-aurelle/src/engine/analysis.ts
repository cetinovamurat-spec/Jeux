/**
 * Financial analysis: EBE (soldes intermédiaires de gestion), CAF (additive
 * method) and HLM net self-financing (autofinancement net). Account groupings
 * come from params (they are conventions to validate, not code).
 */
import { netResult, sumPrefixes } from './balance';
import type { Cents } from './money';

export interface PrefixRule {
  include: readonly string[];
  exclude?: readonly string[];
}

export interface AnalysisDefinitions {
  /** Net rents (loyers nets de RLS). */
  rents: PrefixRule;
  /** Charge recoveries (récupération des charges locatives). */
  chargeRecoveries: PrefixRule;
  ebe: { products: PrefixRule; charges: PrefixRule };
  caf: {
    /** Non-cash charges added back (dotations, valeur comptable des éléments cédés). */
    addBack: PrefixRule;
    /** Non-cash or non-operating income deducted (reprises, produits de cession, quote-part de subventions). */
    deduct: PrefixRule;
  };
  netSelfFinancing: {
    /** Denominator: activity income (excluding charge recoveries) + financial income. */
    activityIncome: PrefixRule;
    financialIncome: PrefixRule;
  };
  financialCharges: PrefixRule;
  disposalGains: { proceeds: PrefixRule; bookValue: PrefixRule };
}

/** Credit-positive sum (products). */
function credit(b: ReadonlyMap<string, Cents>, rule: PrefixRule): Cents {
  return -sumPrefixes(b, rule.include, rule.exclude ?? []);
}

/** Debit-positive sum (charges). */
function debit(b: ReadonlyMap<string, Cents>, rule: PrefixRule): Cents {
  return sumPrefixes(b, rule.include, rule.exclude ?? []);
}

export interface KeyFigures {
  netResult: Cents;
  rents: Cents;
  chargeRecoveries: Cents;
  ebe: Cents;
  ebeOnRents: number;
  financialCharges: Cents;
  disposalGains: Cents;
  caf: Cents;
  cafAddBack: Cents;
  cafDeduct: Cents;
  loanRepayments: Cents;
  netSelfFinancing: Cents;
  denominator: Cents;
  netSelfFinancingRatio: number;
}

export function keyFigures(balances: ReadonlyMap<string, Cents>, defs: AnalysisDefinitions, loanRepayments: Cents): KeyFigures {
  const result = netResult(balances);
  const rents = credit(balances, defs.rents);
  const ebe = credit(balances, defs.ebe.products) - debit(balances, defs.ebe.charges);
  const cafAddBack = debit(balances, defs.caf.addBack);
  const cafDeduct = credit(balances, defs.caf.deduct);
  const caf = result + cafAddBack - cafDeduct;
  const netSelfFinancing = caf - loanRepayments;
  const denominator = credit(balances, defs.netSelfFinancing.activityIncome) + credit(balances, defs.netSelfFinancing.financialIncome);
  return {
    netResult: result,
    rents,
    chargeRecoveries: credit(balances, defs.chargeRecoveries),
    ebe,
    ebeOnRents: rents === 0 ? 0 : ebe / rents,
    financialCharges: debit(balances, defs.financialCharges),
    disposalGains: credit(balances, defs.disposalGains.proceeds) - debit(balances, defs.disposalGains.bookValue),
    caf,
    cafAddBack,
    cafDeduct,
    loanRepayments,
    netSelfFinancing,
    denominator,
    netSelfFinancingRatio: denominator === 0 ? 0 : netSelfFinancing / denominator,
  };
}
