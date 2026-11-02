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
 * The largest amount you could borrow with an equal-instalment (reducing) loan
 * whose payment fits within `maxPaymentVnd`. Used to suggest a smaller loan.
 * Rounded DOWN to the nearest 100,000đ so the suggestion is always affordable.
 */
export function maxAffordablePrincipal(maxPaymentVnd: Vnd, monthlyRate: number, months: number): Vnd {
  assertVnd(maxPaymentVnd, "max payment");
  if (maxPaymentVnd <= 0) return 0;
  const raw = monthlyRate === 0 ? maxPaymentVnd * months : (maxPaymentVnd * (1 - Math.pow(1 + monthlyRate, -months))) / monthlyRate;
  let p = Math.floor(raw / 100_000) * 100_000;
  // Guard against payment rounding pushing just over the limit.
  while (p > 0 && annuityPayment(p, monthlyRate, months) > maxPaymentVnd) p -= 100_000;
  return p;
}
