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
 *   The UI must always label it "/năm, đã gồm phí và bảo hiểm".
 */

export type RateBasis = "flat" | "reducing";
export type RatePeriod = "monthly" | "yearly";

/** A rate as a lender quotes it. `percent` is e.g. 1.5 for 1.5%. */
export type QuotedRate = { percent: number; basis: RateBasis; period: RatePeriod };

/**
 * A monthly rate kept as an exact percent over a whole divisor, so interest in VND
 * can be computed exactly: 30%/năm → { percent: 30, divisor: 12 }.
 */
export type MonthlyRate = { percent: number; divisor: number };

export function monthlyRate(rate: QuotedRate): MonthlyRate {
  if (!(rate.percent >= 0) || !Number.isFinite(rate.percent)) throw new Error(`invalid rate ${rate.percent}`);
  return { percent: rate.percent, divisor: rate.period === "monthly" ? 1 : 12 };
}

/** Monthly rate as a fraction, for IRR-style maths (not for VND amounts). */
export function asFraction(rate: MonthlyRate): number {
  return rate.percent / 100 / rate.divisor;
}

/** Quoted percent → monthly fraction (1.5%/tháng → 0.015; 18%/năm → 0.015). */
export function monthlyFraction(rate: QuotedRate): number {
  return asFraction(monthlyRate(rate));
}

/** Nominal yearly rate from a monthly periodic rate (r × 12). */
export function nominalYearly(monthlyRateFraction: number): number {
  return monthlyRateFraction * 12;
}

/** Effective yearly rate from a monthly periodic rate ((1 + r)^12 − 1). */
export function effectiveYearly(monthlyRateFraction: number): number {
  return Math.pow(1 + monthlyRateFraction, 12) - 1;
}
