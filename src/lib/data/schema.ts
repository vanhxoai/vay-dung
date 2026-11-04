/**
 * Data contract (v2) for lender data (data/lenders/*.json) and the SBV licensed list
 * (data/licensed-institutions.json).
 *
 * Core rules:
 * - Every figure is a `Sourced` value. A known value carries its own sourceUrl,
 *   retrievedAt and confidence. An unknown value is `null` and is shown as "chưa rõ".
 * - Every classification (rate basis, fee timing…) records whether the source STATED it
 *   or we INFERRED it, so the app can label assumptions.
 * - When official sources conflict, the stored value is the conservative one (higher
 *   cost to the borrower) or null, and the conflict is recorded in `conflicts`.
 * - Every object is strict: unknown keys are rejected. This also guarantees no
 *   commercial fields (sponsor, payout, affiliate…) can creep into the data.
 *
 * v2 changes follow docs/research/compliance-review-phase1.md (M1–M8, S1–S12).
 */
import { z } from "zod";

export const SCHEMA_VERSION = 2;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

const IsoDate = z.iso.date();

/**
 * A single figure with its provenance. `value: null` means unknown.
 * When the value is known, sourceUrl, retrievedAt and confidence are required.
 */
export function sourced<T extends z.ZodType>(valueSchema: T) {
  return z
    .strictObject({
      value: valueSchema.nullable(),
      sourceUrl: z.url().nullable(),
      retrievedAt: IsoDate.nullable(),
      confidence: Confidence.nullable(),
      /** Date printed on / effective date of the source document, when it shows one. */
      sourceDocumentDate: IsoDate.nullable().optional(),
      /** Exact wording from the source, or why the value is unknown. */
      note: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      // TS can't see `value` through the generic, so read it via a narrow cast.
      if ((v as unknown as { value: unknown }).value === null) return;
      for (const key of ["sourceUrl", "retrievedAt", "confidence"] as const) {
        if (v[key] === null) {
          ctx.addIssue({ code: "custom", path: [key], message: `A known value needs ${key}`, input: v });
        }
      }
    });
}

/** Whether a classification was stated by the source, inferred by us, or is unknown. */
export const Provenance = z.enum(["stated", "inferred", "none"]);

/**
 * A classification (enum value) with provenance. "unknown" must have provenance "none";
 * anything else needs a sourceUrl.
 */
export function classified<T extends z.ZodEnum>(values: T) {
  return z
    .strictObject({
      value: values,
      provenance: Provenance,
      sourceUrl: z.url().nullable(),
      note: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      const isUnknown = (v as unknown as { value: string }).value === "unknown";
      if (isUnknown !== (v.provenance === "none")) {
        ctx.addIssue({
          code: "custom",
          path: ["provenance"],
          message: 'Use provenance "none" exactly when the value is "unknown"',
          input: v,
        });
      }
      if (!isUnknown && v.sourceUrl === null) {
        ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "A known classification needs a sourceUrl", input: v });
      }
    });
}

/** Money is always whole VND. */
const Vnd = z.number().int().nonnegative();
/** Rates are stored as percentages, as lenders state them: 1.5 means 1.5%. */
const Percent = z.number().nonnegative().max(1000);
const Months = z.number().int().positive().max(600);

export const LicenseCategory = z.enum(["bank", "finance_company"]);
export type LicenseCategory = z.infer<typeof LicenseCategory>;

export const ProductType = z.enum([
  "cash_loan", // unsecured personal cash loan (vay tiền mặt / tín chấp)
  "installment", // point-of-sale installment for goods (trả góp)
  "credit_card",
  "bnpl", // buy now, pay later
  "overdraft", // thấu chi
  "other",
]);
export type ProductType = z.infer<typeof ProductType>;

export const ProductStatus = z.enum([
  "active", // currently offered, seen on an official product page
  "campaign", // time-limited campaign; see validUntil
  "unverified", // only seen indirectly (calculator data, old notice…)
  "expired",
]);

/** How a rate is quoted. Never assumed: "unknown" when the source doesn't say. */
export const RateBasis = z.enum(["flat", "reducing", "unknown"]);
export const RatePeriod = z.enum(["daily", "monthly", "yearly", "unknown"]);

/**
 * What a published rate figure actually is (compliance M1). Only `offered_range`
 * may be used to compute the cost for a specific borrower.
 */
export const RateKind = z.enum([
  "offered_range", // the range the lender actually offers for this product
  "advertised_floor", // "từ X%" / "chỉ từ X%": the lowest rate, not necessarily yours
  "regulatory_ceiling", // the lender's published rate framework / cap (khung lãi suất)
  "benchmark", // base rate, average lending rate… not this product's rate
]);
export type RateKind = z.infer<typeof RateKind>;

export const Rate = z.strictObject({
  kind: RateKind,
  /** Who this rate applies to, e.g. "khách hàng mới" (new customers). null = all. */
  segment: z.string().nullable(),
  minPercent: sourced(Percent),
  maxPercent: sourced(Percent),
  basis: classified(RateBasis),
  period: classified(RatePeriod),
  /** True if the rate is a limited-time promotion. */
  promotional: z.boolean().nullable(),
  /** The minimum is a promotion on selected goods, so it is never used for a borrower's cost or verdict. */
  minIsPromotional: z.boolean().optional(),
});
export type Rate = z.infer<typeof Rate>;

/** How the principal is repaid. Decides the payment schedule. */
export const Amortization = z.enum([
  "annuity", // equal instalments (reducing balance)
  "equal_principal", // equal principal, falling instalments
  "flat", // interest on the original amount every month
  "revolving", // overdraft / card / BNPL: no fixed schedule
  "unknown",
]);

/**
 * When a charge is paid. Decides where it goes in the IRR cash flows:
 * - deducted_from_payout: lowers the money received at t=0
 * - added_to_loan: financed, so it raises the payments
 * - paid_upfront: paid separately at t=0 (same effect as deducted)
 * - monthly: added to each instalment
 * - on_event: only when something happens (prepayment, late payment, a request)
 */
export const ChargeTiming = z.enum([
  "deducted_from_payout",
  "added_to_loan",
  "paid_upfront",
  "monthly",
  "on_event",
  "unknown",
]);

export const FeeTrigger = z.enum([
  "application",
  "disbursement",
  "periodic", // monthly / annual account or management fee
  "prepayment",
  "late_payment",
  "per_transaction", // collection / transfer fee per payment
  "on_request", // statements, contract copies…
  "other",
]);

/** What a percentage fee is calculated on. */
export const FeeBase = z.enum([
  "original_principal",
  "outstanding_principal",
  "prepaid_amount",
  "credit_limit",
  "transaction_amount",
  "not_applicable", // fixed fees
  "unknown",
]);

/** How the parts of a fee combine (compliance M3). */
export const FeeRule = z.enum([
  "percent_only",
  "fixed_only",
  "percent_with_min_max", // percent of base, clamped to minVnd / maxVnd
  "greater_of_percent_and_remaining_interest",
  "other", // see note
]);

export const FeeTier = z.strictObject({
  /** Tier boundaries; null = open-ended. */
  from: z.number().int().nonnegative().nullable(),
  to: z.number().int().positive().nullable(),
  unit: z.enum(["month", "instalment", "year"]),
  percent: Percent,
  note: z.string().optional(),
});

export const Fee = z.strictObject({
  nameVi: z.string().min(1),
  nameEn: z.string().optional(),
  trigger: FeeTrigger,
  timing: classified(ChargeTiming),
  /** Whether the borrower must pay it to get the loan. */
  mandatory: sourced(z.boolean()),
  base: FeeBase,
  rule: FeeRule,
  percent: sourced(Percent),
  fixedVnd: sourced(Vnd),
  minVnd: sourced(Vnd),
  maxVnd: sourced(Vnd),
  /** Percent tiers (e.g. early repayment by year). When set, `percent` is null. */
  tiers: sourced(z.array(FeeTier).min(1)),
  /** Who receives it. Third-party fees (collection points) are still a cost. */
  payee: z.enum(["lender", "third_party", "unknown"]),
});
export type Fee = z.infer<typeof Fee>;

export const PremiumMethod = z.enum([
  "percent_of_principal", // one-off % of the loan
  "annual_rate_on_declining_balance", // %/year on outstanding principal
  "annual_rate_on_insured_amount", // %/year × insured amount (loan × multiplier)
  "fixed",
  "unknown",
]);

export const Insurance = z.strictObject({
  nameVi: z.string().min(1),
  nameEn: z.string().optional(),
  mandatory: sourced(z.boolean()),
  /** How the premium is collected: deducted / financed (added_to_loan) / monthly… */
  collection: classified(ChargeTiming),
  premium: z.strictObject({
    method: classified(PremiumMethod),
    ratePercentMin: sourced(Percent),
    ratePercentMax: sourced(Percent),
    /** Insured amount as a multiple of the loan, by term (TPFico: 1.4 up to 24 months). */
    insuredMultiplierTiers: sourced(
      z.array(z.strictObject({ termMonthsMax: Months.nullable(), multiplier: z.number().positive() })).min(1),
    ),
    fixedVnd: sourced(Vnd),
  }),
  beneficiary: z.string().nullable(),
  covers: z.string().optional(),
});
export type Insurance = z.infer<typeof Insurance>;

/** Whether a list (fees, insurance) is known to be complete (compliance S6). */
export const Completeness = z.enum(["complete", "partial", "unknown"]);

/** A worked example published by the lender. Useful as a cost-engine test case. */
export const RepresentativeExample = z.strictObject({
  principalVnd: Vnd,
  termMonths: Months,
  ratePercent: Percent.nullable(),
  rateBasis: RateBasis,
  ratePeriod: RatePeriod,
  amortization: Amortization,
  /** Instalment as published. For equal_principal, the FIRST instalment. */
  monthlyPaymentVnd: Vnd.nullable(),
  totalRepaidVnd: Vnd.nullable(),
  /** A yearly rate the lender prints next to the example, and what kind it is. */
  statedAnnualRatePercent: Percent.nullable(),
  statedAnnualRateKind: z.enum(["nominal", "effective", "unknown"]).nullable(),
  includesInsurance: z.boolean().nullable(),
  /** false when the lender's own numbers don't add up. Never use those as test fixtures. */
  internallyConsistent: z.boolean().nullable(),
  sourceUrl: z.url(),
  retrievedAt: IsoDate,
  sourceDocumentDate: IsoDate.nullable().optional(),
  confidence: Confidence,
  note: z.string().optional(),
});

/** Two or more official figures that disagree (compliance M6, M8). */
export const Conflict = z.strictObject({
  /** Dotted path of the affected field, e.g. "amountMaxVnd" or "rates[0].maxPercent". */
  field: z.string().min(1),
  values: z
    .array(z.strictObject({ value: z.string(), sourceUrl: z.url().nullable(), note: z.string().optional() }))
    .min(1),
  /** What we stored and why (conservative value or null). */
  resolution: z.string().min(1),
});

export const LatePenalty = z.strictObject({
  /** The penalty in plain Vietnamese, as the user will read it. */
  textVi: sourced(z.string()),
  textEn: z.string().optional(),
  /** Overdue principal interest as a multiple of the in-term rate, e.g. 1.5 = 150%. */
  overduePrincipalRateMultiplier: sourced(z.number().positive().max(10)),
  /** Interest on overdue interest, %/year. */
  overdueInterestRatePercentYear: sourced(Percent),
});

export const Eligibility = z.strictObject({
  minAge: sourced(z.number().int().min(16).max(100)),
  maxAge: sourced(z.number().int().min(16).max(100)),
  /** true if maxAge is checked at the END of the loan, not at application. */
  maxAgeAtLoanEnd: z.boolean().nullable(),
  minMonthlyIncomeVnd: sourced(Vnd),
  incomeBasis: z.enum(["gross", "net", "unknown"]),
  documents: sourced(z.array(z.string())),
  existingCustomerRequired: sourced(z.boolean()),
  /** e.g. TPBank: employer must be on the bank's list. */
  employerRestriction: sourced(z.string()),
  /** Other conditions in plain Vietnamese (credit history, months in job…). */
  otherConditions: sourced(z.array(z.string())),
  notes: z.string().optional(),
});

export const Product = z.strictObject({
  /** Unique within the lender file, kebab-case. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  nameVi: z.string().min(1),
  nameEn: z.string().optional(),
  productType: ProductType,
  status: ProductStatus,
  validUntil: IsoDate.nullable(),
  /** The licensed institution that actually lends (compliance S1). Usually the file's lender. */
  lenderOfRecord: z.string().min(1),
  /** App or brand name the borrower sees, if different (e.g. "TPFico", "FE ONLINE"). */
  brandOrChannel: z.string().nullable(),
  /** Online (app/web) application available. */
  online: z.boolean().nullable(),
  amountMinVnd: sourced(Vnd),
  amountMaxVnd: sourced(Vnd),
  termMinMonths: sourced(Months),
  termMaxMonths: sourced(Months),
  rates: z.array(Rate),
  amortization: classified(Amortization),
  fees: z.array(Fee),
  feesCompleteness: Completeness,
  insurance: z.array(Insurance),
  insuranceCompleteness: Completeness,
  eligibility: Eligibility,
  latePenalty: LatePenalty,
  representativeExamples: z.array(RepresentativeExample),
  conflicts: z.array(Conflict),
  /** Main product page. */
  sourceUrl: z.url(),
  retrievedAt: IsoDate,
  /** Overall confidence for this product's data. */
  confidence: Confidence,
  /** If true, keep out of rankings (e.g. only secondary sources). Shown as "chưa đủ dữ liệu". */
  excludeFromRanking: z.boolean(),
  excludeReason: z.string().optional(),
  /** Set when the general reasons in src/lib/recommend/offers.ts wouldn't be true of this product. */
  excludeCode: z.enum(["conflicting_sources", "undated_document", "unverified", "range_basis_unknown", "same_loan_other_channel"]).optional(),
  /** Things a borrower should know about this product, shown on its card or list item. */
  borrowerNotes: z.array(z.strictObject({ vi: z.string(), en: z.string() })).optional(),
  notes: z.string().optional(),
});
export type Product = z.infer<typeof Product>;

export const LenderFile = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Matches the file name: data/lenders/<slug>.json */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Must equal the legal name on data/licensed-institutions.json. */
  legalName: z.string().min(1),
  licenseCategory: LicenseCategory,
  /** Must match an `id` in data/licensed-institutions.json. */
  licensedInstitutionId: z.string().min(1),
  website: z.url(),
  products: z.array(Product),
  /** Gaps, contradictions between sources, anything surprising. */
  researchNotes: z.string(),
  retrievedAt: IsoDate,
});
export type LenderFile = z.infer<typeof LenderFile>;

export const LicensedInstitution = z.strictObject({
  /** kebab-case, e.g. "fe-credit". */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Short common name, e.g. "FE Credit". */
  name: z.string().min(1),
  /** Full legal name as on the official list. */
  legalName: z.string().min(1),
  legalNameEn: z.string().optional(),
  category: LicenseCategory,
  /** Finer type as the official list states it, e.g. "joint-stock commercial bank". */
  subtype: z.string().min(1),
  /** Other names people use, including app/brand names, only when verified. */
  aliases: z.array(z.string()),
  licenseNumber: z.string().nullable(),
  website: z.url().nullable(),
  /** The official list this entry came from. */
  sourceUrl: z.url(),
});
export type LicensedInstitution = z.infer<typeof LicensedInstitution>;

export const LicensedList = z.strictObject({
  sources: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        publisher: z.string().min(1),
        url: z.url(),
        /** Date the list states it's current as of, if any. */
        asOf: IsoDate.nullable(),
        retrievedAt: IsoDate,
      }),
    )
    .min(1),
  institutions: z.array(LicensedInstitution).min(1),
  notes: z.string(),
  retrievedAt: IsoDate,
});
export type LicensedList = z.infer<typeof LicensedList>;
