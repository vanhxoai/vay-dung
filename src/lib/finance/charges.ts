/**
 * Turning published fee and insurance rules into VND amounts.
 * These helpers mirror the data schema's rules (src/lib/data/schema.ts) but take
 * plain numbers, so the engine stays independent of the data format.
 * All VND results are computed exactly (integer arithmetic) and rounded once.
 */
import { assertVnd, divRound, percentOf, scaled, type Vnd } from "./money";

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
  let amount = percentOf(baseVnd, fee.percent);
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
  return Math.max(percentOf(outstandingPrincipal, percent), remainingInterest, minVnd);
}

/** One-off premium as a % of the loan. */
export function premiumPercentOfPrincipal(principal: Vnd, percent: number): Vnd {
  return percentOf(principal, percent);
}

/**
 * Premium at an annual rate on an insured amount = loan × multiplier
 * (TPFico: 2.5%/year × 140% of the loan if the term is ≤ 24 months, else 110%).
 * premium = principal × multiplier × percent/100 × months/12
 */
export function premiumOnInsuredAmount(
  principal: Vnd,
  annualPercent: number,
  months: number,
  multiplierTiers: readonly { termMonthsMax: number | null; multiplier: number }[],
): Vnd {
  assertVnd(principal, "principal");
  const tier = multiplierTiers.find((t) => t.termMonthsMax === null || months <= t.termMonthsMax);
  if (!tier) throw new Error(`no insured-amount tier for ${months} months`);
  const S = BigInt(1_000_000); // scale used by scaled()
  return divRound(
    BigInt(principal) * scaled(tier.multiplier) * scaled(annualPercent) * BigInt(months),
    S * S * BigInt(100) * BigInt(12),
  );
}

/**
 * Premium at an annual rate on the declining balance, summed over the term, rounded once
 * (VPBank: 1.3–1.8%/year, collected in full at disbursement).
 * `openingBalances[m]` is the principal outstanding at the start of month m+1.
 */
export function premiumOnDecliningBalance(openingBalances: readonly Vnd[], annualPercent: number): Vnd {
  const total = openingBalances.reduce((sum, b) => {
    assertVnd(b, "balance");
    return sum + BigInt(b);
  }, BigInt(0));
  return divRound(total * scaled(annualPercent), BigInt(1_000_000) * BigInt(100) * BigInt(12));
}
