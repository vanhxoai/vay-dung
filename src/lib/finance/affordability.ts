/**
 * Affordability: total monthly debt payments ÷ monthly income.
 * Thresholds live in src/config/affordability.ts (a Vay Đúng guideline, not a law).
 */
import { AFFORDABILITY } from "@/config/affordability";
import { assertVnd, type Vnd } from "./money";
import { annuityPayment } from "./schedule";

export type AffordabilityVerdict = "ok" | "too_much" | "no_income";

export type Affordability = {
  verdict: AffordabilityVerdict;
  /** (existing + new) ÷ income; null when income is 0. */
  debtToIncome: number | null;
  /** The most you could pay each month for ALL debts within the guideline. */
  maxTotalPaymentVnd: Vnd;
  /** Room left for a NEW payment within the guideline (0 if none). */
  headroomVnd: Vnd;
};

export function checkAffordability(
  monthlyIncomeVnd: Vnd,
  existingMonthlyDebtVnd: Vnd,
  newMonthlyPaymentVnd: Vnd,
  limits: { maxDebtToIncome: number } = AFFORDABILITY,
): Affordability {
  assertVnd(monthlyIncomeVnd, "income");
  assertVnd(existingMonthlyDebtVnd, "existing debt");
  assertVnd(newMonthlyPaymentVnd, "new payment");
  if (monthlyIncomeVnd <= 0) return { verdict: "no_income", debtToIncome: null, maxTotalPaymentVnd: 0, headroomVnd: 0 };

  // Floor, so the headroom never rounds above the guideline.
  const maxTotalPaymentVnd = Math.floor(monthlyIncomeVnd * limits.maxDebtToIncome);
  const headroomVnd = Math.max(0, maxTotalPaymentVnd - existingMonthlyDebtVnd);
  const total = existingMonthlyDebtVnd + newMonthlyPaymentVnd;
  const debtToIncome = total / monthlyIncomeVnd;

  const verdict: AffordabilityVerdict = total > maxTotalPaymentVnd ? "too_much" : "ok";
  return { verdict, debtToIncome, maxTotalPaymentVnd, headroomVnd };
}

/**
 * ESTIMATE of the largest amount you could borrow with an equal-instalment
 * (reducing) loan whose instalment fits within `maxPaymentVnd`, in steps of
 * 100,000đ. It ignores fees, insurance and flat pricing, so the app must
 * re-check a suggested amount with `computeLoanCost(...).maxPaymentVnd` for the
 * actual product before presenting it.
 */
export function maxAffordablePrincipal(maxPaymentVnd: Vnd, monthlyRateFraction: number, months: number): Vnd {
  assertVnd(maxPaymentVnd, "max payment");
  if (maxPaymentVnd <= 0) return 0;
  const fits = (p: Vnd) => annuityPayment(p, monthlyRateFraction, months) <= maxPaymentVnd;
  const raw =
    monthlyRateFraction === 0
      ? maxPaymentVnd * months
      : (maxPaymentVnd * (1 - Math.pow(1 + monthlyRateFraction, -months))) / monthlyRateFraction;
  let p = Math.floor(raw / 100_000) * 100_000;
  // The inverse uses the unrounded instalment, so the true answer may be one step either way.
  if (fits(p + 100_000)) p += 100_000;
  while (p > 0 && !fits(p)) p -= 100_000;
  return p;
}
