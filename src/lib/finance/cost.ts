/**
 * The real cost of a loan: what you receive, what you repay, and the true yearly
 * rate including fees and insurance (via IRR).
 *
 * Cash flows (borrower's view):
 *   t=0   +amountReceived = principal − charges deducted from the payout − charges paid upfront
 *   t=1…n −instalment (principal + interest on the financed amount) − monthly charges
 * Charges "added to the loan" are financed: they raise the amount borrowed, so
 * they raise every instalment, but you never receive them in hand.
 *
 * totalCost = totalRepaid − amountReceived (CLAUDE.md).
 * Late-payment penalties are NOT included; see late.ts.
 */
import { monthlyIrr } from "./irr";
import { assertVnd, sumVnd, type Vnd } from "./money";
import { effectiveYearly, monthlyFraction, nominalYearly, type QuotedRate } from "./rates";
import { buildSchedule, type Amortization, type ScheduleRow } from "./schedule";

export type Charge = {
  label: string;
  amountVnd: Vnd;
  timing: "deducted_from_payout" | "paid_upfront" | "added_to_loan" | "monthly";
};

export type LoanInput = {
  /** The amount the borrower asks for (before charges). */
  principalVnd: Vnd;
  termMonths: number;
  rate: QuotedRate;
  /** How the principal is repaid. Flat-quoted rates are always repaid "flat". */
  amortization?: Exclude<Amortization, "flat">;
  charges?: readonly Charge[];
};

export type LoanCost = {
  /** Money actually in your hand at the start. */
  amountReceivedVnd: Vnd;
  /** Principal the schedule is calculated on (requested + financed charges). */
  financedPrincipalVnd: Vnd;
  /** First month's total payment (incl. monthly charges). Equal every month except possibly the last, unless equal_principal. */
  firstPaymentVnd: Vnd;
  /** Highest monthly payment (use this for affordability). */
  maxPaymentVnd: Vnd;
  totalRepaidVnd: Vnd;
  /** totalRepaid − amountReceived */
  totalCostVnd: Vnd;
  totalInterestVnd: Vnd;
  totalChargesVnd: Vnd;
  monthlyIrr: number;
  /** Real APR as shown in the app: monthly IRR × 12. */
  aprNominal: number;
  /** (1 + monthly IRR)^12 − 1 */
  aprEffective: number;
  schedule: (ScheduleRow & { charges: Vnd; total: Vnd })[];
};

export function computeLoanCost(input: LoanInput): LoanCost {
  const { principalVnd, termMonths, rate } = input;
  assertVnd(principalVnd, "principal");
  const charges = input.charges ?? [];
  for (const c of charges) {
    assertVnd(c.amountVnd, c.label);
    if (c.amountVnd < 0) throw new Error(`${c.label}: negative charge`);
  }
  const byTiming = (t: Charge["timing"]) => sumVnd(charges.filter((c) => c.timing === t).map((c) => c.amountVnd));

  const financed = byTiming("added_to_loan");
  const deducted = byTiming("deducted_from_payout");
  const upfront = byTiming("paid_upfront");
  const monthly = byTiming("monthly");

  const financedPrincipalVnd = principalVnd + financed;
  const amountReceivedVnd = principalVnd - deducted - upfront;
  if (amountReceivedVnd <= 0) throw new Error("charges exceed the amount borrowed");

  const method: Amortization = rate.basis === "flat" ? "flat" : (input.amortization ?? "annuity");
  const base = buildSchedule(financedPrincipalVnd, monthlyFraction(rate), termMonths, method);
  const schedule = base.map((row) => ({ ...row, charges: monthly, total: row.payment + monthly }));

  const totals = schedule.map((r) => r.total);
  const totalRepaidVnd = sumVnd(totals);
  const r = monthlyIrr([amountReceivedVnd, ...totals.map((t) => -t)]);

  return {
    amountReceivedVnd,
    financedPrincipalVnd,
    firstPaymentVnd: totals[0],
    maxPaymentVnd: Math.max(...totals),
    totalRepaidVnd,
    totalCostVnd: totalRepaidVnd - amountReceivedVnd,
    totalInterestVnd: sumVnd(base.map((row) => row.interest)),
    totalChargesVnd: financed + deducted + upfront + monthly * termMonths,
    monthlyIrr: r,
    aprNominal: nominalYearly(r),
    aprEffective: effectiveYearly(r),
    schedule,
  };
}
