/**
 * Rate conventions.
 *
 * - Loans are modelled in monthly periods. A yearly reducing-balance rate R%/năm
 *   becomes a monthly periodic rate R/12 (how Vietnamese lenders convert it).
 *   Lenders accrue daily (actual/365); the monthly model differs by a few đồng
 *   per instalment and is the standard basis for comparison.
 * - A flat rate charges interest on the ORIGINAL amount every month.
 * - "Real APR" shown in the app = nominal yearly rate = monthly IRR × 12, the
 *   same convention lenders use, so it is directly comparable to their quotes.
 *   The effective rate (1 + r)^12 − 1 is shown in the details. (DECISIONS #3)
 */

export type RateBasis = "flat" | "reducing";
export type RatePeriod = "monthly" | "yearly";

/** A rate as a lender quotes it. `percent` is e.g. 1.5 for 1.5%. */
export type QuotedRate = { percent: number; basis: RateBasis; period: RatePeriod };

/** Quoted percent → monthly fraction (1.5%/tháng → 0.015; 18%/năm → 0.015). */
export function monthlyFraction(rate: QuotedRate): number {
  if (!(rate.percent >= 0) || !Number.isFinite(rate.percent)) throw new Error(`invalid rate ${rate.percent}`);
  return rate.period === "monthly" ? rate.percent / 100 : rate.percent / 100 / 12;
}

/** Nominal yearly rate from a monthly periodic rate (r × 12). */
export function nominalYearly(monthlyRate: number): number {
  return monthlyRate * 12;
}

/** Effective yearly rate from a monthly periodic rate ((1 + r)^12 − 1). */
export function effectiveYearly(monthlyRate: number): number {
  return Math.pow(1 + monthlyRate, 12) - 1;
}
