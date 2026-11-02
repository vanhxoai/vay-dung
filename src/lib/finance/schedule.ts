/**
 * Repayment schedules in whole VND.
 *
 * Rounding rule: each month's interest is rounded to the nearest đồng; principal
 * parts are whole đồng; the LAST instalment absorbs any remainder so the
 * principal repaid always equals the amount borrowed exactly.
 */
import { assertVnd, roundVnd, type Vnd } from "./money";

export type Amortization = "annuity" | "equal_principal" | "flat";

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
export function annuityPayment(principal: Vnd, monthlyRate: number, months: number): Vnd {
  if (monthlyRate === 0) return roundVnd(principal / months);
  return roundVnd((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months)));
}

function validate(principal: Vnd, monthlyRate: number, months: number) {
  assertVnd(principal, "principal");
  if (principal <= 0) throw new Error("principal must be positive");
  if (!Number.isInteger(months) || months < 1 || months > 600) throw new Error(`invalid term ${months}`);
  if (!(monthlyRate >= 0) || !Number.isFinite(monthlyRate)) throw new Error(`invalid rate ${monthlyRate}`);
}

/**
 * Builds the schedule.
 * - annuity: equal instalments; interest on the remaining balance.
 * - equal_principal: same principal each month; interest on the remaining balance (falling instalments).
 * - flat: same principal each month; interest on the ORIGINAL amount every month (`monthlyRate` is the flat rate).
 */
export function buildSchedule(
  principal: Vnd,
  monthlyRate: number,
  months: number,
  method: Amortization,
): ScheduleRow[] {
  validate(principal, monthlyRate, months);
  const rows: ScheduleRow[] = [];
  let balance = principal;
  const level = method === "annuity" ? annuityPayment(principal, monthlyRate, months) : 0;
  const evenPrincipal = Math.floor(principal / months);
  const flatInterest = roundVnd(principal * monthlyRate);

  for (let month = 1; month <= months; month++) {
    const last = month === months;
    const interest = method === "flat" ? flatInterest : roundVnd(balance * monthlyRate);
    let principalPart: Vnd;
    if (last) principalPart = balance;
    else if (method === "annuity") principalPart = Math.min(balance, level - interest);
    else principalPart = evenPrincipal;
    balance -= principalPart;
    rows.push({ month, payment: principalPart + interest, interest, principal: principalPart, balance });
  }
  return rows;
}
