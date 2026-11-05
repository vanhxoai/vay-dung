/**
 * Why an offer sits where it does, from this borrower's own answers. Pure data: the card turns
 * each line into plain Vietnamese. Must stay true to `rankOffers` and `eligibilityProblems`.
 */
import { checkAffordability } from "@/lib/finance";
import { hasBarrier, type Need, type RankedOffer } from "./recommend";

export type ExplainLine =
  | { kind: "purpose_any" }
  | { kind: "purpose_match" }
  | { kind: "amount"; known: boolean }
  | { kind: "term"; known: boolean }
  | { kind: "age"; known: boolean }
  | { kind: "income"; known: boolean }
  | { kind: "afford"; paymentVnd: number; debtVnd: number; ratio: number; isMinimum: boolean }
  | { kind: "proof_barrier" }
  | { kind: "condition_unasked" }
  | { kind: "floor_only" }
  | { kind: "cost_key"; apr: number };

export function explainRank(r: RankedOffer, need: Need): ExplainLine[] {
  const o = r.offer;
  const check = checkAffordability(need.monthlyIncomeVnd, need.existingDebtVnd, r.high.maxPaymentVnd);
  const lines: ExplainLine[] = [
    o.goods === null ? { kind: "purpose_any" } : { kind: "purpose_match" },
    { kind: "amount", known: o.amountMinVnd !== null || o.amountMaxVnd !== null },
    { kind: "term", known: o.termMinMonths !== null || o.termMaxMonths !== null },
    { kind: "age", known: o.minAge !== null || o.maxAge !== null },
    { kind: "income", known: o.minMonthlyIncomeVnd !== null },
    { kind: "afford", paymentVnd: r.high.maxPaymentVnd, debtVnd: need.existingDebtVnd, ratio: check.debtToIncome ?? 0, isMinimum: Boolean(o.rate?.floorOnly) },
  ];
  if (hasBarrier(r)) lines.push({ kind: "proof_barrier" });
  if (o.existingCustomerRequired === true || o.employerRestriction !== null) lines.push({ kind: "condition_unasked" });
  if (o.rate?.floorOnly) lines.push({ kind: "floor_only" });
  lines.push({ kind: "cost_key", apr: r.high.aprNominal });
  return lines;
}
