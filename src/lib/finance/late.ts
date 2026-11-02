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
  /** Yearly rate on overdue principal, null if unknown. */
  overduePrincipalYearlyRate: number | null;
  /** Yearly rate on overdue interest, null if unknown. */
  overdueInterestYearlyRate: number | null;
  /** Extra cost of paying ONE instalment 30 days late, null if any part is unknown. */
  extraCostFor30DaysVnd: Vnd | null;
};

/**
 * @param contractYearlyRate the contract's in-term rate on the REDUCING balance, nominal
 *   yearly, as a fraction (e.g. 0.45). For a flat-quoted loan pass its real APR
 *   (`computeLoanCost().aprNominal`), not the flat headline, or the penalty comes out too low.
 * @param overduePrincipalVnd principal part of the late instalment
 * @param overdueInterestVnd interest part of the late instalment
 */
export function lateWarning(
  terms: LatePenaltyTerms,
  contractYearlyRate: number,
  overduePrincipalVnd: Vnd,
  overdueInterestVnd: Vnd = 0,
): LateWarning {
  const principalRate =
    terms.overduePrincipalRateMultiplier === null ? null : contractYearlyRate * terms.overduePrincipalRateMultiplier;
  const interestRate = terms.overdueInterestRatePercentYear === null ? null : terms.overdueInterestRatePercentYear / 100;
  // Days/365, the convention in Vietnamese loan contracts.
  const days = 30 / 365;
  let extra: Vnd | null = null;
  if (principalRate !== null && (interestRate !== null || overdueInterestVnd === 0)) {
    extra = roundVnd(overduePrincipalVnd * principalRate * days + overdueInterestVnd * (interestRate ?? 0) * days);
  }
  return { overduePrincipalYearlyRate: principalRate, overdueInterestYearlyRate: interestRate, extraCostFor30DaysVnd: extra };
}
