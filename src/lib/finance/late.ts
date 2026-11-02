/**
 * Late-payment warning, kept SEPARATE from the APR (CLAUDE.md).
 * Overdue principal is typically charged a multiple of the in-term rate
 * (e.g. 150%); overdue interest a capped yearly rate (e.g. 10%/year).
 */
import { roundVnd, type Vnd } from "./money";

export type LatePenaltyTerms = {
  /** e.g. 1.5 for 150% of the in-term rate; null if unknown. */
  overduePrincipalRateMultiplier: number | null;
  /** e.g. 10 for 10%/year on overdue interest; null if unknown. */
  overdueInterestRatePercentYear: number | null;
};

export type LateWarning = {
  /** Yearly rate on overdue principal (nominal), null if unknown. */
  overduePrincipalYearlyRate: number | null;
  /** Extra cost of paying ONE instalment's principal 30 days late, null if unknown. */
  extraCostFor30DaysVnd: Vnd | null;
};

/**
 * @param inTermYearlyRate nominal yearly in-term rate as a fraction (e.g. 0.45)
 * @param overduePrincipalVnd principal of the late instalment
 */
export function lateWarning(terms: LatePenaltyTerms, inTermYearlyRate: number, overduePrincipalVnd: Vnd): LateWarning {
  if (terms.overduePrincipalRateMultiplier === null) return { overduePrincipalYearlyRate: null, extraCostFor30DaysVnd: null };
  const rate = inTermYearlyRate * terms.overduePrincipalRateMultiplier;
  // Days/365, the convention in Vietnamese loan contracts.
  return { overduePrincipalYearlyRate: rate, extraCostFor30DaysVnd: roundVnd((overduePrincipalVnd * rate * 30) / 365) };
}
