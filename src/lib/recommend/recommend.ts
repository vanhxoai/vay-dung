/**
 * Turns the borrower's need into an honest recommendation. Runs in the browser only.
 *
 * Ranking (DECISIONS #27): by the real APR at the HIGH end of the published range,
 * then the low end. It reads cost and fit only; no commercial field exists.
 * A product whose fees are entirely unknown can't take first place (compliance S6).
 *
 * Costs are computed at the low and high ends of the range: we can't know which
 * rate a lender would give this person.
 */
import { FINANCE_COMPANY_CONSUMER_LOAN_CAP_VND } from "@/config/regulatory";
import { ageInDaysFrom } from "./dates";
import {
  buildSchedule,
  checkAffordability,
  computeLoanCost,
  maxAffordablePrincipal,
  monthlyRate,
  premiumOnDecliningBalance,
  premiumOnInsuredAmount,
  premiumPercentOfPrincipal,
  type Affordability,
  type Charge,
  type LoanCost,
  type QuotedRate,
} from "@/lib/finance";
import type { Goods, Offer, OfferInsurance } from "./offers";

export type Purpose = "phone" | "motorbike" | "education" | "medical" | "debt" | "living" | "other";
export type Urgency = "now" | "soon" | "flexible";
export type IncomeProof = "bank_salary" | "cash_salary" | "self_employed" | "none";

export type Need = {
  purpose: Purpose;
  amountVnd: number;
  termMonths: number;
  urgency: Urgency;
  monthlyIncomeVnd: number;
  existingDebtVnd: number;
  age: number;
  incomeProof: IncomeProof;
};

export type IneligibleReason =
  | "amount_too_low"
  | "amount_too_high"
  | "over_finance_company_cap"
  | "term_too_short"
  | "term_too_long"
  | "too_young"
  | "too_old"
  | "income_too_low";

export type OfferFit = "fits" | "fits_only_low" | "too_much";

export type RankedOffer = {
  offer: Offer;
  low: LoanCost;
  high: LoanCost;
  fit: OfferFit;
  /** Premium if the borrower takes the insurance; null when no premium is published. */
  insuranceCosts: {
    nameVi: string;
    nameEn: string | null;
    mandatory: boolean | null;
    collectionKnown: boolean;
    minVnd: number;
    maxVnd: number;
    costHigh: LoanCost;
  }[];
  /** Mandatory insurance was assumed to be deducted from the payout because the source doesn't say. */
  mandatoryCollectionAssumed: boolean;
  /** Insurance products whose premium isn't published. */
  insuranceUnknownPremium: string[];
  needsIncomeProofNote: boolean;
  feesAllUnknown: boolean;
};

export type StaleLimit = { maxAgeDays: number };

export type Verdict = "ok" | "depends" | "too_much" | "no_income" | "no_data";

export type Recommendation = {
  verdict: Verdict;
  affordabilityOfBest: Affordability;
  headroomVnd: number;
  /** Principal per month, before any interest. */
  principalOnlyVnd: number;
  /** Only some of the ranked offers fit the guideline at their highest rate. */
  someDontFit: boolean;
  /** Estimate of a loan that would fit, or null if none does. */
  suggestedAmountVnd: number | null;
  ranked: RankedOffer[];
  ineligible: { offer: Offer; reasons: IneligibleReason[] }[];
  /** Licensed products we can't cost honestly, with the reason. */
  insufficientData: { offer: Offer; stale: boolean }[];
};

const STALE_AFTER_DAYS = 90;

function fitsPurpose(goods: Goods | null, purpose: Purpose): boolean {
  return goods === null || goods === purpose;
}

/** A product that needs a specific employer list or existing relationship is shown with its condition, not filtered. */
export function eligibilityProblems(offer: Offer, need: Need): IneligibleReason[] {
  const out: IneligibleReason[] = [];
  const { amountVnd: a, termMonths: t, age, monthlyIncomeVnd: inc } = need;
  if (offer.amountMinVnd !== null && a < offer.amountMinVnd) out.push("amount_too_low");
  // Compliance M8: until a lawyer confirms, amounts above the cap aren't shown as achievable, so the cap reason comes first.
  if (offer.category === "finance_company" && a > FINANCE_COMPANY_CONSUMER_LOAN_CAP_VND) out.push("over_finance_company_cap");
  else if (offer.amountMaxVnd !== null && a > offer.amountMaxVnd) out.push("amount_too_high");
  if (offer.termMinMonths !== null && t < offer.termMinMonths) out.push("term_too_short");
  if (offer.termMaxMonths !== null && t > offer.termMaxMonths) out.push("term_too_long");
  if (offer.minAge !== null && age < offer.minAge) out.push("too_young");
  if (offer.maxAge !== null) {
    const ageToCheck = offer.maxAgeAtLoanEnd ? age + t / 12 : age;
    if (ageToCheck > offer.maxAge) out.push("too_old");
  }
  if (offer.minMonthlyIncomeVnd !== null && inc < offer.minMonthlyIncomeVnd) out.push("income_too_low");
  return out;
}

function quoted(offer: Offer, percent: number): QuotedRate {
  const r = offer.rate as NonNullable<Offer["rate"]>;
  return { percent, basis: r.basis, period: r.period };
}

function costAt(offer: Offer, percent: number, need: Need, extra: readonly Charge[] = []): LoanCost {
  return computeLoanCost({
    principalVnd: need.amountVnd,
    termMonths: need.termMonths,
    rate: quoted(offer, percent),
    amortization: offer.amortization ?? "annuity",
    charges: [...offer.monthlyFees.map((f) => ({ label: f.nameVi, amountVnd: f.amountVnd, timing: "monthly" as const })), ...extra],
  });
}

/** Premium range in VND, or null when the lender doesn't publish enough to compute it. */
export function premiumRange(ins: OfferInsurance, offer: Offer, amountVnd: number, termMonths: number): [number, number] | null {
  const lo = ins.ratePercentMin;
  const hi = ins.ratePercentMax ?? ins.ratePercentMin;
  switch (ins.method) {
    case "percent_of_principal":
      return lo === null || hi === null ? null : [premiumPercentOfPrincipal(amountVnd, lo), premiumPercentOfPrincipal(amountVnd, hi)];
    case "annual_rate_on_insured_amount":
      if (lo === null || hi === null || !ins.insuredTiers) return null;
      return [premiumOnInsuredAmount(amountVnd, lo, termMonths, ins.insuredTiers), premiumOnInsuredAmount(amountVnd, hi, termMonths, ins.insuredTiers)];
    case "annual_rate_on_declining_balance": {
      if (lo === null || hi === null || offer.rate === null) return null;
      // Each end pairs its premium rate with the balances at the same end of the loan rate.
      const opening = (percent: number) =>
        buildSchedule(amountVnd, monthlyRate(quoted(offer, percent)), termMonths, offer.amortization ?? "annuity").map((r) => r.balance + r.principal);
      return [premiumOnDecliningBalance(opening(offer.rate.minPercent), lo), premiumOnDecliningBalance(opening(offer.rate.maxPercent), hi)];
    }
    case "fixed":
      return ins.fixedVnd === null ? null : [ins.fixedVnd, ins.fixedVnd];
    default:
      return null;
  }
}

/** Insurance the source says is mandatory, at the low and high ends of its premium. */
function mandatoryCharges(offer: Offer, need: Need): { low: Charge[]; high: Charge[] } {
  const low: Charge[] = [];
  const high: Charge[] = [];
  for (const ins of offer.insurance) {
    const range = ins.mandatory === true ? premiumRange(ins, offer, need.amountVnd, need.termMonths) : null;
    if (!range) continue;
    low.push({ label: ins.nameVi, amountVnd: range[0], timing: chargeTiming(ins) });
    high.push({ label: ins.nameVi, amountVnd: range[1], timing: chargeTiming(ins) });
  }
  return { low, high };
}

function rankOffer(offer: Offer, need: Need): RankedOffer {
  const r = offer.rate as NonNullable<Offer["rate"]>;
  const insuranceCosts: RankedOffer["insuranceCosts"] = [];
  const insuranceUnknownPremium: string[] = [];
  let mandatoryCollectionAssumed = false;

  for (const ins of offer.insurance) {
    const range = premiumRange(ins, offer, need.amountVnd, need.termMonths);
    if (!range) {
      insuranceUnknownPremium.push(ins.nameVi);
      continue;
    }
    const collectionKnown = ins.collection !== "unknown" && ins.collection !== "on_event";
    // Only insurance the source says is mandatory goes into the headline cost.
    if (ins.mandatory === true) {
      if (!collectionKnown) mandatoryCollectionAssumed = true;
    } else {
      insuranceCosts.push({
        nameVi: ins.nameVi,
        nameEn: ins.nameEn,
        mandatory: ins.mandatory,
        collectionKnown,
        minVnd: range[0],
        maxVnd: range[1],
        costHigh: costAt(offer, r.maxPercent, need, [{ label: ins.nameVi, amountVnd: range[1], timing: chargeTiming(ins) }]),
      });
    }
  }

  const charges = mandatoryCharges(offer, need);
  // A promotional or unconfirmed minimum isn't this borrower's rate, so it can't soften the cost or the verdict.
  const lowPercent = r.minByTerm?.find((m) => need.termMonths >= m.termMonthsMin)?.percent ?? r.minPercent;
  const low = r.minIsPromotional || r.minUnconfirmed ? costAt(offer, r.maxPercent, need, charges.high) : costAt(offer, lowPercent, need, charges.low);
  const high = costAt(offer, r.maxPercent, need, charges.high);
  const atLow = checkAffordability(need.monthlyIncomeVnd, need.existingDebtVnd, low.maxPaymentVnd);
  const atHigh = checkAffordability(need.monthlyIncomeVnd, need.existingDebtVnd, high.maxPaymentVnd);
  const fit: OfferFit = atHigh.verdict === "ok" ? "fits" : atLow.verdict === "ok" ? "fits_only_low" : "too_much";

  const docsMentionIncome = offer.documents?.some((d) => /thu nhập|lương/i.test(d)) ?? false;
  return {
    offer,
    low,
    high,
    fit,
    insuranceCosts,
    insuranceUnknownPremium,
    mandatoryCollectionAssumed,
    needsIncomeProofNote: docsMentionIncome && (need.incomeProof === "none" || need.incomeProof === "cash_salary"),
    feesAllUnknown: offer.feesCompleteness === "unknown",
  };
}

/** How a premium enters the cash flows. When unknown we assume deducted, and the UI says so. */
function chargeTiming(ins: OfferInsurance): Charge["timing"] {
  if (ins.collection === "added_to_loan" || ins.collection === "paid_upfront") return ins.collection;
  return "deducted_from_payout";
}

/** A verdict of "ok" can't rest on a product we can't fully cost or that many people can't get. */
function isReliableForVerdict(r: RankedOffer): boolean {
  const ageKnown = r.offer.minAge !== null && r.offer.maxAge !== null;
  return !r.feesAllUnknown && ageKnown && !r.offer.rate?.maxIsReference && r.offer.existingCustomerRequired !== true && r.offer.employerRestriction === null;
}

/** Real cost order, high end first; a product with entirely unknown fees can't be first. */
export function rankOffers(ranked: RankedOffer[]): RankedOffer[] {
  const sorted = [...ranked].sort(
    (a, b) =>
      a.high.aprNominal - b.high.aprNominal ||
      a.low.aprNominal - b.low.aprNominal ||
      a.offer.key.localeCompare(b.offer.key),
  );
  // Move the cheapest product with known fees to the front; everything else keeps its cost order.
  if (sorted[0]?.feesAllUnknown) {
    const i = sorted.findIndex((x) => !x.feesAllUnknown);
    if (i > 0) sorted.unshift(...sorted.splice(i, 1));
  }
  return sorted;
}

/** Largest loan at this offer's HIGH rate that fits the headroom, checked with the real cost. */
function suggestAmount(best: RankedOffer, need: Need, headroomVnd: number): number | null {
  const estimate = maxAffordablePrincipal(headroomVnd, best.high.monthlyIrr, need.termMonths);
  for (let p = estimate; p >= 1_000_000; p -= 100_000) {
    if (best.offer.amountMinVnd !== null && p < best.offer.amountMinVnd) return null;
    const smaller = { ...need, amountVnd: p };
    const cost = costAt(best.offer, (best.offer.rate as NonNullable<Offer["rate"]>).maxPercent, smaller, mandatoryCharges(best.offer, smaller).high);
    if (cost.maxPaymentVnd <= headroomVnd) return p;
  }
  return null;
}

export function recommend(need: Need, offers: readonly Offer[], today: Date): Recommendation {
  const insufficientData: Recommendation["insufficientData"] = [];
  const ineligible: Recommendation["ineligible"] = [];
  const candidates: RankedOffer[] = [];

  for (const offer of offers) {
    if (!fitsPurpose(offer.goods, need.purpose)) continue;
    const stale = ageInDaysFrom(offer.oldestRetrievedAt, today) > STALE_AFTER_DAYS;
    if (offer.excludeFromRanking || offer.rate === null || stale) {
      insufficientData.push({ offer, stale });
      continue;
    }
    const reasons = eligibilityProblems(offer, need);
    if (reasons.length > 0) ineligible.push({ offer, reasons });
    else candidates.push(rankOffer(offer, need));
  }

  const ranked = rankOffers(candidates);
  const baseline = checkAffordability(need.monthlyIncomeVnd, need.existingDebtVnd, 0);
  const headroomVnd = baseline.headroomVnd;

  // Principal alone, ignoring all interest: if even this doesn't fit, no rate could help.
  const principalOnly = Math.ceil(need.amountVnd / need.termMonths);
  const principalCheck = checkAffordability(need.monthlyIncomeVnd, need.existingDebtVnd, principalOnly);

  let verdict: Verdict;
  if (baseline.verdict === "no_income") verdict = "no_income";
  else if (principalCheck.verdict === "too_much") verdict = "too_much";
  else if (ranked.length === 0) verdict = "no_data";
  else if (ranked.every((r) => r.fit === "too_much")) verdict = "too_much";
  else if (ranked.some((r) => r.fit === "fits" && isReliableForVerdict(r))) verdict = "ok";
  else verdict = "depends";

  const best = ranked[0];
  const suggestedAmountVnd =
    verdict !== "ok" && verdict !== "no_income" && best && headroomVnd > 0 ? suggestAmount(best, need, headroomVnd) : null;

  return {
    verdict,
    affordabilityOfBest: best
      ? checkAffordability(need.monthlyIncomeVnd, need.existingDebtVnd, best.high.maxPaymentVnd)
      : principalCheck,
    headroomVnd,
    principalOnlyVnd: principalOnly,
    someDontFit: ranked.some((r) => r.fit !== "fits"),
    suggestedAmountVnd: suggestedAmountVnd !== null && suggestedAmountVnd < need.amountVnd ? suggestedAmountVnd : null,
    ranked,
    ineligible,
    insufficientData,
  };
}
