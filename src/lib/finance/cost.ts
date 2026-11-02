/**
 * The real cost of a loan: what you receive, what you pay, and the true yearly
 * rate including fees and insurance (via IRR).
 *
 * Cash flows (borrower's view):
 *   t=0   +amountReceived − upfrontPaid
 *         amountReceived = principal − charges deducted from the payout (money in hand)
 *         upfrontPaid    = charges the borrower pays separately at the start
 *   t=1…n −instalment (principal + interest on the financed amount) − monthly charges
 * Charges "added to the loan" are financed: they raise the amount borrowed, so
 * they raise every instalment, but you never receive them in hand.
 *
 * totalCost = totalPaid − amountReceived, where totalPaid = instalments + upfrontPaid
 * (CLAUDE.md: "total repaid − amount received in hand").
 * Late-payment penalties are NOT included; see late.ts.
 */
import { monthlyIrr } from "./irr";
import { assertVnd, sumVnd, type Vnd } from "./money";
import { effectiveYearly, monthlyRate, nominalYearly, type QuotedRate } from "./rates";
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
  /** Money actually in your hand at the start (principal − deducted charges). */
  amountReceivedVnd: Vnd;
  /** Charges you pay separately at the start (not deducted from the payout). */
  upfrontPaidVnd: Vnd;
  /** Principal the schedule is calculated on (requested + financed charges). */
  financedPrincipalVnd: Vnd;
  /** Monthly totals (instalment + monthly charges). Show first AND last when they differ. */
  firstPaymentVnd: Vnd;
  lastPaymentVnd: Vnd;
  minPaymentVnd: Vnd;
  /** Highest monthly total; use this for affordability. */
  maxPaymentVnd: Vnd;
  /** Sum of all monthly totals. */
  totalRepaidVnd: Vnd;
  /** Everything you pay out of pocket: totalRepaid + upfrontPaid. */
  totalPaidVnd: Vnd;
  /** totalPaid − amountReceived: the real cost of borrowing. */
  totalCostVnd: Vnd;
  totalInterestVnd: Vnd;
  /** Face value of all fees and insurance (interest on financed charges is in totalInterest). */
  totalChargesVnd: Vnd;
  monthlyIrr: number;
  /** Real APR as shown in the app: monthly IRR × 12, a YEARLY rate including fees and insurance. */
  aprNominal: number;
  /** (1 + monthly IRR)^12 − 1 */
  aprEffective: number;
  /** `payment` excludes monthly charges; `total` (what you pay that month) includes them. */
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
  const upfrontPaidVnd = byTiming("paid_upfront");
  const monthly = byTiming("monthly");

  const financedPrincipalVnd = principalVnd + financed;
  const amountReceivedVnd = principalVnd - deducted;
  const netAtStart = amountReceivedVnd - upfrontPaidVnd;
  if (netAtStart <= 0) throw new Error("charges exceed the amount borrowed");

  const method: Amortization = rate.basis === "flat" ? "flat" : (input.amortization ?? "annuity");
  const base = buildSchedule(financedPrincipalVnd, monthlyRate(rate), termMonths, method);
  const schedule = base.map((row) => ({ ...row, charges: monthly, total: row.payment + monthly }));

  const totals = schedule.map((r) => r.total);
  const totalRepaidVnd = sumVnd(totals);
  const totalPaidVnd = totalRepaidVnd + upfrontPaidVnd;
  const r = monthlyIrr([netAtStart, ...totals.map((t) => -t)]);

  return {
    amountReceivedVnd,
    upfrontPaidVnd,
    financedPrincipalVnd,
    firstPaymentVnd: totals[0],
    lastPaymentVnd: totals[totals.length - 1],
    minPaymentVnd: Math.min(...totals),
    maxPaymentVnd: Math.max(...totals),
    totalRepaidVnd,
    totalPaidVnd,
    totalCostVnd: totalPaidVnd - amountReceivedVnd,
    totalInterestVnd: sumVnd(base.map((row) => row.interest)),
    totalChargesVnd: financed + deducted + upfrontPaidVnd + monthly * termMonths,
    monthlyIrr: r,
    aprNominal: nominalYearly(r),
    aprEffective: effectiveYearly(r),
    schedule,
  };
}
