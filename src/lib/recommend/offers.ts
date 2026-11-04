/**
 * Slim, serializable view of a lender product for the browser. It keeps only what
 * the recommendation and the offer card need (no research notes), and carries the
 * provenance the UI must show: source URLs, dates, stated vs inferred.
 *
 * There are deliberately no commercial fields here, and ranking can only read these.
 */
import type { LenderFile, Product } from "@/lib/data/schema";
import { OLD_DOCUMENT_DAYS } from "@/lib/data/validate";
import { ageInDaysFrom } from "./dates";

export type Goods = "phone" | "motorbike";

/** Installment products tied to specific goods. Everything else is general purpose. */
const GOODS_BY_PRODUCT: Record<string, Goods> = {
  "fe-credit/vay-mua-xe-may": "motorbike",
  "fe-credit/vay-mua-dien-thoai-dien-may": "phone",
  "hd-saison/motorbike-installment": "motorbike",
  "hd-saison/electronics-installment": "phone",
  "home-credit/installment-motorbike": "motorbike",
  "home-credit/installment-electronics": "phone",
  "jaccs/motorbike-installment": "motorbike",
  "jaccs/electronics-installment": "phone",
  "mirae-asset/installment-motorbike": "motorbike",
  "mirae-asset/installment-electronics": "phone",
  "sfinance/tra-gop-dien-thoai": "phone",
  "sfinance/tra-gop-dien-may": "phone",
  "shinhan-finance/motorbike-installment-loan": "motorbike",
};

export type OfferRate = {
  minPercent: number;
  maxPercent: number;
  basis: "flat" | "reducing";
  period: "monthly" | "yearly";
  /** The basis was worked out by us, not stated by the lender. The UI labels it "giả định". */
  basisInferred: boolean;
  /** The minimum is a promotion on selected goods: costs use the maximum. */
  minIsPromotional?: boolean;
  /** The minimum disagrees with what the lender advertises: costs use the maximum. */
  minUnconfirmed?: boolean;
  /** Lowest rate by term, highest threshold first. */
  minByTerm?: { termMonthsMin: number; percent: number }[];
  /** The lender calls its maximum a reference rate: a borrower's rate could be higher. */
  maxIsReference?: boolean;
  segment: string | null;
  sourceUrl: string;
  retrievedAt: string;
  /** Set when the document behind this rate is old, however recently we read it. */
  oldDocumentDate: string | null;
};

/** A published rate that can't be used for a user's cost: "từ X%", a ceiling, or a benchmark. */
export type OfferRateNote = {
  kind: "advertised_floor" | "regulatory_ceiling" | "benchmark" | "offered_range";
  segment: string | null;
  minPercent: number | null;
  maxPercent: number | null;
  basis: "flat" | "reducing" | "unknown";
  period: "daily" | "monthly" | "yearly" | "unknown";
  oldDocumentDate: string | null;
};

export type OfferFee = {
  nameVi: string;
  nameEn: string | null;
  trigger: string;
  percent: number | null;
  fixedVnd: number | null;
  minVnd: number | null;
  maxVnd: number | null;
  /** Percent tiers, e.g. early repayment by year. */
  tiers: { from: number | null; to: number | null; unit: string; percent: number }[] | null;
  greaterOfRemainingInterest: boolean;
};

export type OfferInsurance = {
  nameVi: string;
  nameEn: string | null;
  mandatory: boolean | null;
  /** How the premium is collected. Unknown changes the cost, so the UI must say so. */
  collection: "deducted_from_payout" | "added_to_loan" | "paid_upfront" | "monthly" | "on_event" | "unknown";
  method: "percent_of_principal" | "annual_rate_on_declining_balance" | "annual_rate_on_insured_amount" | "fixed" | "unknown";
  ratePercentMin: number | null;
  ratePercentMax: number | null;
  insuredTiers: { termMonthsMax: number | null; multiplier: number }[] | null;
  fixedVnd: number | null;
};

/** Why a product isn't compared. Translated in the UI; research notes never reach users. */
export type ExcludeCode =
  | "secondary_sources"
  | "lender_unverified"
  | "unverified"
  | "rate_varies"
  | "conflicting_sources"
  | "range_basis_unknown"
  | "same_loan_other_channel"
  | "manual_check_pending"
  | "floor_and_range"
  | "undated_document"
  | "ceiling_only"
  | "floor_only"
  | "no_rate";

export type Offer = {
  key: string;
  lenderName: string;
  legalName: string;
  category: "bank" | "finance_company";
  nameVi: string;
  nameEn: string | null;
  productType: Product["productType"];
  goods: Goods | null;
  amountMinVnd: number | null;
  amountMaxVnd: number | null;
  termMinMonths: number | null;
  termMaxMonths: number | null;
  /** The offered range used for the user's cost; null if the lender publishes none. */
  rate: OfferRate | null;
  rateNotes: OfferRateNote[];
  amortization: "annuity" | "equal_principal" | null;
  amortizationInferred: boolean;
  /** Mandatory fees charged every month with a known amount: these ARE in the cost. */
  monthlyFees: { nameVi: string; nameEn: string | null; amountVnd: number }[];
  /** Fees with a known amount and rule that aren't part of the normal cost (early repayment, on request…). */
  otherFees: OfferFee[];
  /** Fee names we know exist but can't put a number on. */
  uncostedFees: string[];
  feesCompleteness: "complete" | "partial" | "unknown";
  insurance: OfferInsurance[];
  insuranceCompleteness: "complete" | "partial" | "unknown";
  minAge: number | null;
  maxAge: number | null;
  maxAgeAtLoanEnd: boolean | null;
  minMonthlyIncomeVnd: number | null;
  documents: string[] | null;
  existingCustomerRequired: boolean | null;
  employerRestriction: string | null;
  otherConditions: string[] | null;
  lateTextVi: string | null;
  lateTextEn: string | null;
  lateMultiplier: number | null;
  lateOverdueInterestPercentYear: number | null;
  /** Fields where official sources disagree. */
  conflictFields: string[];
  sourceUrl: string;
  /** Every distinct source behind the figures on the card. */
  sourceUrls: string[];
  retrievedAt: string;
  /** Oldest figure. Past the staleness limit, the app stops ranking this offer. */
  oldestRetrievedAt: string;
  confidence: "high" | "medium" | "low";
  excludeFromRanking: boolean;
  excludeCode: ExcludeCode | null;
  borrowerNotes?: { vi: string; en: string }[];
};

function collect(node: unknown, key: string, out: Set<string>) {
  if (Array.isArray(node)) node.forEach((n) => collect(n, key, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === key && typeof v === "string") out.add(v);
      else collect(v, key, out);
    }
  }
}

/** New customers' range first: our target user is on their first or second loan. */
function pickOfferedRate(p: Product): Product["rates"][number] | null {
  const offered = p.rates.filter(
    (r) =>
      r.kind === "offered_range" &&
      r.minPercent.value !== null &&
      r.maxPercent.value !== null &&
      r.basis.value !== "unknown" &&
      (r.period.value === "monthly" || r.period.value === "yearly"),
  );
  return offered.find((r) => r.segment?.toLowerCase().includes("mới")) ?? offered.find((r) => r.segment === null) ?? offered[0] ?? null;
}

function exclusionCode(p: Product, rate: Product["rates"][number] | null): ExcludeCode | null {
  if (!p.excludeFromRanking && rate !== null) return null;
  if (p.excludeCode) return p.excludeCode;
  const reason = (p.excludeReason ?? "").toLowerCase();
  if (reason.includes("blog")) return "secondary_sources";
  if (reason.includes("bên cho vay")) return "lender_unverified";
  if (p.status === "unverified") return "unverified";
  if (rate !== null) return "rate_varies";
  const hasRange = p.rates.some((r) => r.kind === "regulatory_ceiling");
  if (hasRange && p.rates.some((r) => r.kind === "advertised_floor")) return "floor_and_range";
  if (hasRange) return "ceiling_only";
  if (p.rates.some((r) => r.kind === "advertised_floor")) return "floor_only";
  return "no_rate";
}

/** The rate's source document date, if it was already old when we read it. */
function oldDocumentDate(r: Product["rates"][number]): string | null {
  const date = r.maxPercent.sourceDocumentDate ?? r.minPercent.sourceDocumentDate ?? null;
  const read = r.maxPercent.retrievedAt ?? r.minPercent.retrievedAt;
  if (date === null || !read) return null;
  return ageInDaysFrom(date, new Date(`${read}T12:00:00+07:00`)) > OLD_DOCUMENT_DAYS ? date : null;
}

function toFee(f: Product["fees"][number]): OfferFee {
  return {
    nameVi: f.nameVi,
    nameEn: f.nameEn ?? null,
    trigger: f.trigger,
    percent: f.percent.value,
    fixedVnd: f.fixedVnd.value,
    minVnd: f.minVnd.value,
    maxVnd: f.maxVnd.value,
    tiers: f.tiers.value,
    greaterOfRemainingInterest: f.rule === "greater_of_percent_and_remaining_interest",
  };
}

export function toOffer(lender: LenderFile, p: Product): Offer {
  const rate = pickOfferedRate(p);
  const monthlyFees: Offer["monthlyFees"] = [];
  const otherFees: OfferFee[] = [];
  const uncostedFees: string[] = [];
  for (const f of p.fees) {
    const free = f.fixedVnd.value === 0 || (f.percent.value === 0 && f.tiers.value === null);
    if (free) continue;
    const fixed = f.fixedVnd.value;
    if (fixed !== null && f.timing.value === "monthly" && f.mandatory.value === true) {
      monthlyFees.push({ nameVi: f.nameVi, nameEn: f.nameEn ?? null, amountVnd: fixed });
    } else if (fixed !== null || f.percent.value !== null || f.tiers.value !== null) {
      otherFees.push(toFee(f));
    } else {
      uncostedFees.push(f.nameVi);
    }
  }

  const urls = new Set<string>([p.sourceUrl]);
  // Only sources behind what the card shows, not rejected conflict values or worked examples.
  collect({ ...p, conflicts: [], representativeExamples: [] }, "sourceUrl", urls);
  const dates = new Set<string>();
  collect(p, "retrievedAt", dates);

  return {
    key: `${lender.slug}/${p.id}`,
    lenderName: lender.name,
    legalName: lender.legalName,
    category: lender.licenseCategory,
    nameVi: p.nameVi,
    nameEn: p.nameEn ?? null,
    productType: p.productType,
    goods: GOODS_BY_PRODUCT[`${lender.slug}/${p.id}`] ?? null,
    amountMinVnd: p.amountMinVnd.value,
    amountMaxVnd: p.amountMaxVnd.value,
    termMinMonths: p.termMinMonths.value,
    termMaxMonths: p.termMaxMonths.value,
    rate:
      rate === null
        ? null
        : {
            minPercent: rate.minPercent.value as number,
            maxPercent: rate.maxPercent.value as number,
            basis: rate.basis.value as "flat" | "reducing",
            period: rate.period.value as "monthly" | "yearly",
            basisInferred: rate.basis.provenance === "inferred",
            minIsPromotional: rate.minIsPromotional,
            minUnconfirmed: rate.minUnconfirmed,
            minByTerm: rate.minByTerm,
            maxIsReference: rate.maxIsReference,
            segment: rate.segment,
            sourceUrl: (rate.maxPercent.sourceUrl ?? rate.minPercent.sourceUrl ?? p.sourceUrl) as string,
            retrievedAt: (rate.maxPercent.retrievedAt ?? rate.minPercent.retrievedAt ?? p.retrievedAt) as string,
            oldDocumentDate: oldDocumentDate(rate),
          },
    rateNotes: p.rates
      .filter((r) => r !== rate)
      .map((r) => ({
        kind: r.kind,
        segment: r.segment,
        minPercent: r.minPercent.value,
        maxPercent: r.maxPercent.value,
        basis: r.basis.value,
        period: r.period.value,
        oldDocumentDate: oldDocumentDate(r),
      })),
    amortization: p.amortization.value === "annuity" || p.amortization.value === "equal_principal" ? p.amortization.value : null,
    amortizationInferred: p.amortization.provenance !== "stated",
    monthlyFees,
    otherFees,
    uncostedFees,
    feesCompleteness: p.feesCompleteness,
    insurance: p.insurance.map((i) => ({
      nameVi: i.nameVi,
      nameEn: i.nameEn ?? null,
      mandatory: i.mandatory.value,
      collection: i.collection.value,
      method: i.premium.method.value,
      ratePercentMin: i.premium.ratePercentMin.value,
      ratePercentMax: i.premium.ratePercentMax.value,
      insuredTiers: i.premium.insuredMultiplierTiers.value,
      fixedVnd: i.premium.fixedVnd.value,
    })),
    insuranceCompleteness: p.insuranceCompleteness,
    minAge: p.eligibility.minAge.value,
    maxAge: p.eligibility.maxAge.value,
    maxAgeAtLoanEnd: p.eligibility.maxAgeAtLoanEnd,
    minMonthlyIncomeVnd: p.eligibility.minMonthlyIncomeVnd.value,
    documents: p.eligibility.documents.value,
    existingCustomerRequired: p.eligibility.existingCustomerRequired.value,
    employerRestriction: p.eligibility.employerRestriction.value,
    otherConditions: p.eligibility.otherConditions.value,
    lateTextVi: p.latePenalty.textVi.value,
    lateTextEn: p.latePenalty.textEn ?? null,
    lateMultiplier: p.latePenalty.overduePrincipalRateMultiplier.value,
    lateOverdueInterestPercentYear: p.latePenalty.overdueInterestRatePercentYear.value,
    conflictFields: p.conflicts.map((c) => c.field),
    sourceUrl: p.sourceUrl,
    sourceUrls: [...urls],
    retrievedAt: p.retrievedAt,
    oldestRetrievedAt: [...dates].sort()[0] ?? p.retrievedAt,
    confidence: p.confidence,
    borrowerNotes: p.borrowerNotes,
    excludeFromRanking: p.excludeFromRanking || p.status === "expired",
    excludeCode: exclusionCode(p, rate),
  };
}

/** Consumer products to show; credit cards are out of the MVP's scope (CLAUDE.md target user). */
export function toOffers(lenders: readonly LenderFile[]): Offer[] {
  return lenders.flatMap((l) =>
    l.products.filter((p) => p.productType !== "credit_card" && p.status !== "expired" && !p.hidden).map((p) => toOffer(l, p)),
  );
}
