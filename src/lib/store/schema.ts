/**
 * The contract of the loan data store: what data/store/snapshot.json must look like after
 * `npm run data:import` reads data/store/loan-data.xlsx. Strict, so no commercial field can
 * enter the data, and a rate must always say where it came from (DECISIONS #63).
 */
import { z } from "zod";

const IsoDate = z.iso.date();
const Vnd = z.number().int().nonnegative();
const Percent = z.number().nonnegative().max(1000);
const Months = z.number().int().positive().max(600);

export const SOURCE_TYPES = ["official", "lender_partner", "aggregator", "press"] as const;
export const RATE_SCOPES = ["product", "lender_general"] as const;
export const EXCLUDE_CODES = [
  "secondary_sources",
  "lender_unverified",
  "unverified",
  "rate_varies",
  "conflicting_sources",
  "range_basis_unknown",
  "same_loan_other_channel",
  "manual_check_pending",
  "floor_and_range",
  "undated_document",
  "ceiling_only",
  "floor_only",
  "no_rate",
  "revolving",
] as const;

export const StoreRate = z
  .strictObject({
    minPercent: Percent,
    maxPercent: Percent,
    basis: z.enum(["flat", "reducing"]),
    period: z.enum(["monthly", "yearly"]),
    basisInferred: z.boolean(),
    minIsPromotional: z.boolean().optional(),
    minUnconfirmed: z.boolean().optional(),
    floorOnly: z.boolean().optional(),
    minByTerm: z.array(z.strictObject({ termMonthsMin: z.number().int().nonnegative(), percent: Percent })).optional(),
    maxIsReference: z.boolean().optional(),
    segment: z.string().nullable(),
    sourceType: z.enum(SOURCE_TYPES),
    sourceName: z.string().min(1),
    scope: z.enum(RATE_SCOPES),
    quote: z.string().nullable(),
    sourceUrl: z.url(),
    retrievedAt: IsoDate,
    oldDocumentDate: IsoDate.nullable(),
  })
  .refine((r) => r.minPercent <= r.maxPercent, { message: "rate_min is above rate_max", path: ["minPercent"] });

const RateNote = z.strictObject({
  kind: z.enum(["advertised_floor", "regulatory_ceiling", "benchmark", "offered_range"]),
  segment: z.string().nullable(),
  minPercent: Percent.nullable(),
  maxPercent: Percent.nullable(),
  basis: z.enum(["flat", "reducing", "unknown"]),
  period: z.enum(["daily", "monthly", "yearly", "unknown"]),
  oldDocumentDate: IsoDate.nullable(),
});

const OtherFee = z.strictObject({
  nameVi: z.string().min(1),
  nameEn: z.string().nullable(),
  trigger: z.string().min(1),
  percent: Percent.nullable(),
  fixedVnd: Vnd.nullable(),
  minVnd: Vnd.nullable(),
  maxVnd: Vnd.nullable(),
  tiers: z.array(z.looseObject({ from: z.number().nullable(), to: z.number().nullable(), unit: z.string(), percent: Percent })).nullable(),
  greaterOfRemainingInterest: z.boolean(),
});

const InsuranceRow = z.strictObject({
  nameVi: z.string().min(1),
  nameEn: z.string().nullable(),
  mandatory: z.boolean().nullable(),
  collection: z.enum(["deducted_from_payout", "added_to_loan", "paid_upfront", "monthly", "on_event", "unknown"]),
  method: z.enum(["percent_of_principal", "annual_rate_on_declining_balance", "annual_rate_on_insured_amount", "fixed", "unknown"]),
  ratePercentMin: Percent.nullable(),
  ratePercentMax: Percent.nullable(),
  insuredTiers: z.array(z.strictObject({ termMonthsMax: z.number().nullable(), multiplier: z.number().positive() })).nullable(),
  fixedVnd: Vnd.nullable(),
});

const Completeness = z.enum(["complete", "partial", "unknown"]);

export const StoreOffer = z.strictObject({
  key: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  licensedInstitutionId: z.string().min(1),
  lenderName: z.string().min(1),
  legalName: z.string().min(1),
  category: z.enum(["bank", "finance_company"]),
  nameVi: z.string().min(1),
  nameEn: z.string().nullable(),
  productType: z.enum(["cash_loan", "installment", "credit_card", "bnpl", "overdraft", "other"]),
  goods: z.enum(["phone", "motorbike", "education", "other_goods", "any_goods"]).nullable(),
  amountMinVnd: Vnd.nullable(),
  amountMaxVnd: Vnd.nullable(),
  termMinMonths: Months.nullable(),
  termMaxMonths: Months.nullable(),
  rate: StoreRate.nullable(),
  rateNotes: z.array(RateNote),
  amortization: z.enum(["annuity", "equal_principal"]).nullable(),
  amortizationInferred: z.boolean(),
  monthlyFees: z.array(z.strictObject({ nameVi: z.string().min(1), nameEn: z.string().nullable(), amountVnd: Vnd })),
  otherFees: z.array(OtherFee),
  uncostedFees: z.array(z.string()),
  feesCompleteness: Completeness,
  insurance: z.array(InsuranceRow),
  insuranceCompleteness: Completeness,
  minAge: z.number().int().nullable(),
  maxAge: z.number().int().nullable(),
  maxAgeAtLoanEnd: z.boolean().nullable(),
  minMonthlyIncomeVnd: Vnd.nullable(),
  documents: z.array(z.string()).nullable(),
  existingCustomerRequired: z.boolean().nullable(),
  employerRestriction: z.string().nullable(),
  otherConditions: z.array(z.string()).nullable(),
  lateTextVi: z.string().nullable(),
  lateTextEn: z.string().nullable(),
  lateMultiplier: z.number().positive().nullable(),
  lateOverdueInterestPercentYear: Percent.nullable(),
  conflictFields: z.array(z.string()),
  sourceUrl: z.url(),
  sourceUrls: z.array(z.url()),
  retrievedAt: IsoDate,
  oldestRetrievedAt: IsoDate,
  confidence: z.enum(["high", "medium", "low"]),
  excludeFromRanking: z.boolean(),
  excludeCode: z.enum(EXCLUDE_CODES).nullable(),
  borrowerNotes: z.array(z.strictObject({ vi: z.string().min(1), en: z.string().min(1) })).optional(),
});

export const Snapshot = z.strictObject({
  schemaVersion: z.literal(1),
  /** Newest date a figure was checked. */
  dataAsOf: IsoDate,
  offers: z.array(StoreOffer),
});
export type Snapshot = z.infer<typeof Snapshot>;
