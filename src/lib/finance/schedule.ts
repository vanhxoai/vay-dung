/**
 * Repayment schedules in whole VND.
 *
 * Rounding rule: each month's interest is computed exactly and rounded to the
 * nearest đồng (half away from zero); principal parts are whole đồng; the LAST
 * instalment absorbs any remainder so the principal repaid always equals the
 * amount borrowed exactly, and on a flat loan the interest totals the exact
 * figure. The level annuity instalment is rounded once, so its last instalment
 * can differ by up to a few hundred đồng on long terms at high rates.
 */
import { assertVnd, percentOf, roundVnd, type Vnd } from "./money";
import { asFraction, type MonthlyRate } from "./rates";

export type Amortization = "annuity" | "equal_principal" | "flat";

/**
 * Consumer loans in scope run up to 60–72 months. Much longer terms with a rounded
 * level instalment can drift into an interest-only schedule with a large last
 * payment (finance-math-checker, 2026-11-02), so they are rejected.
 */
export const MAX_TERM_MONTHS = 120;

export type ScheduleRow = {
  month: number;
  /** Instalment for the loan itself (principal + interest), before monthly fees. */
  payment: Vnd;
  interest: Vnd;
  principal: Vnd;
  /** Outstanding principal after this payment. */
  balance: Vnd;
};

/** Equal monthly instalment for a reducing-balance loan, rounded to the đồng. */
export function annuityPayment(principal: Vnd, monthlyRateFraction: number, months: number): Vnd {
  if (monthlyRateFraction === 0) return roundVnd(principal / months);
  return roundVnd((principal * monthlyRateFraction) / (1 - Math.pow(1 + monthlyRateFraction, -months)));
}

function validate(principal: Vnd, rate: MonthlyRate, months: number) {
  assertVnd(principal, "principal");
  if (principal <= 0) throw new Error("principal must be positive");
  if (!Number.isInteger(months) || months < 1 || months > MAX_TERM_MONTHS) throw new Error(`invalid term ${months}`);
  if (!(rate.percent >= 0) || !Number.isFinite(rate.percent)) throw new Error(`invalid rate ${rate.percent}`);
}

/**
 * Builds the schedule.
 * - annuity: equal instalments; interest on the remaining balance.
 * - equal_principal: same principal each month; interest on the remaining balance (falling instalments).
 * - flat: same principal each month; interest on the ORIGINAL amount every month (`rate` is the flat rate).
 */
export function buildSchedule(principal: Vnd, rate: MonthlyRate, months: number, method: Amortization): ScheduleRow[] {
  validate(principal, rate, months);
  const interestOn = (amount: Vnd) => percentOf(amount, rate.percent, rate.divisor);
  const rows: ScheduleRow[] = [];
  let balance = principal;
  const level = method === "annuity" ? annuityPayment(principal, asFraction(rate), months) : 0;
  const evenPrincipal = Math.floor(principal / months);
  const flatInterest = interestOn(principal);

  for (let month = 1; month <= months; month++) {
    const last = month === months;
    let interest = method === "flat" ? flatInterest : interestOn(balance);
    if (last && method === "flat") interest = percentOf(principal, rate.percent * months, rate.divisor) - flatInterest * (months - 1);
    let principalPart: Vnd;
    if (last) principalPart = balance;
    else if (method === "annuity") principalPart = Math.min(balance, Math.max(0, level - interest));
    else principalPart = evenPrincipal;
    balance -= principalPart;
    rows.push({ month, payment: principalPart + interest, interest, principal: principalPart, balance });
  }
  return rows;
}
