/**
 * Turning published fee and insurance rules into VND amounts.
 * These helpers mirror the data schema's rules (src/lib/data/schema.ts) but take
 * plain numbers, so the engine stays independent of the data format.
 */
import { assertVnd, roundVnd, type Vnd } from "./money";

export type FeeRule =
  | { rule: "fixed"; amountVnd: Vnd }
  | { rule: "percent"; percent: number; minVnd?: Vnd | null; maxVnd?: Vnd | null };

/** Fee in VND on a base amount, e.g. 4% of the prepaid amount with a 1,000,000đ minimum. */
export function feeAmount(fee: FeeRule, baseVnd: Vnd): Vnd {
  assertVnd(baseVnd, "base");
  if (fee.rule === "fixed") {
    assertVnd(fee.amountVnd, "fee");
    return fee.amountVnd;
  }
  let amount = roundVnd((baseVnd * fee.percent) / 100);
  if (fee.minVnd != null) amount = Math.max(amount, fee.minVnd);
  if (fee.maxVnd != null) amount = Math.min(amount, fee.maxVnd);
  return amount;
}

/**
 * "The higher of X% of the outstanding principal or all remaining interest",
 * with a minimum (HD Saison early repayment).
 */
export function greaterOfPercentAndRemainingInterest(
  percent: number,
  outstandingPrincipal: Vnd,
  remainingInterest: Vnd,
  minVnd: Vnd = 0,
): Vnd {
  return Math.max(roundVnd((outstandingPrincipal * percent) / 100), remainingInterest, minVnd);
}

/** One-off premium as a % of the loan. */
export function premiumPercentOfPrincipal(principal: Vnd, percent: number): Vnd {
  return roundVnd((principal * percent) / 100);
}

/**
 * Premium at an annual rate on an insured amount = loan × multiplier
 * (TPFico: 2.5%/year × 140% of the loan if the term is ≤ 24 months, else 110%).
 */
export function premiumOnInsuredAmount(
  principal: Vnd,
  annualPercent: number,
  months: number,
  multiplierTiers: readonly { termMonthsMax: number | null; multiplier: number }[],
): Vnd {
  const tier = multiplierTiers.find((t) => t.termMonthsMax === null || months <= t.termMonthsMax);
  if (!tier) throw new Error(`no insured-amount tier for ${months} months`);
  return roundVnd((principal * tier.multiplier * annualPercent * months) / 100 / 12);
}

/**
 * Premium at an annual rate on the declining balance, summed over the term
 * (VPBank: 1.3–1.8%/year, collected in full at disbursement).
 * `openingBalances[m]` is the principal outstanding at the start of month m+1.
 */
export function premiumOnDecliningBalance(openingBalances: readonly Vnd[], annualPercent: number): Vnd {
  return roundVnd(openingBalances.reduce((sum, b) => sum + (b * annualPercent) / 100 / 12, 0));
}
