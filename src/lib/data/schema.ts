/**
 * Data contract for lender data (data/lenders/*.json) and the SBV licensed list
 * (data/licensed-institutions.json).
 *
 * Core rule: every figure is a `Sourced` value. A known value must carry its own
 * sourceUrl, retrievedAt and confidence. An unknown value is `null` and is shown
 * to users as "chưa rõ". We never guess.
 */
import { z } from "zod";

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

const IsoDate = z.iso.date();

/**
 * A single figure with its provenance. `value: null` means unknown.
 * When the value is known, sourceUrl, retrievedAt and confidence are required.
 */
export function sourced<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      value: valueSchema.nullable(),
      sourceUrl: z.url().nullable(),
      retrievedAt: IsoDate.nullable(),
      confidence: Confidence.nullable(),
      /** Exact wording from the source, or why the value is unknown. */
      note: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      if (v.value === null) return;
      for (const key of ["sourceUrl", "retrievedAt", "confidence"] as const) {
        if (v[key] === null) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `A known value needs ${key}`,
            input: v,
          });
        }
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

/** How a rate is quoted. Never assumed: "unknown" when the source doesn't say. */
export const RateBasis = z.enum(["flat", "reducing", "unknown"]);
export const RatePeriod = z.enum(["monthly", "yearly", "unknown"]);

/**
 * When a fee or insurance premium is paid. This decides where it goes in the IRR cash flows:
 * - deducted_from_payout: lowers the money received at t=0
 * - added_to_loan: financed, so it raises the payments
 * - paid_upfront: paid separately by the borrower at t=0 (same effect as deducted)
 * - monthly: added to each instalment
 */
export const ChargeTiming = z.enum([
  "deducted_from_payout",
  "added_to_loan",
  "paid_upfront",
  "monthly",
  "unknown",
]);

export const Fee = z.object({
  name: z.string().min(1),
  nameVi: z.string().optional(),
  timing: ChargeTiming,
  /** Whether the borrower must pay it to get the loan. */
  mandatory: z.boolean().nullable(),
  percentOfPrincipal: sourced(Percent),
  fixedVnd: sourced(Vnd),
});
export type Fee = z.infer<typeof Fee>;

export const Insurance = z.object({
  name: z.string().min(1),
  mandatory: sourced(z.boolean()),
  timing: ChargeTiming,
  percentOfPrincipal: sourced(Percent),
  fixedVnd: sourced(Vnd),
});
export type Insurance = z.infer<typeof Insurance>;

/** A worked example published by the lender. Useful as a cost-engine test case. */
export const RepresentativeExample = z.object({
  principalVnd: Vnd,
  termMonths: Months,
  ratePercent: Percent.nullable(),
  rateBasis: RateBasis,
  ratePeriod: RatePeriod,
  monthlyPaymentVnd: Vnd.nullable(),
  totalRepaidVnd: Vnd.nullable(),
  statedApr: Percent.nullable(),
  sourceUrl: z.url(),
  retrievedAt: IsoDate,
  confidence: Confidence,
  note: z.string().optional(),
});

export const Product = z.object({
  /** Unique within the lender file, kebab-case. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  productType: ProductType,
  /** Online (app/web) application available. */
  online: z.boolean().nullable(),
  amountMinVnd: sourced(Vnd),
  amountMaxVnd: sourced(Vnd),
  termMinMonths: sourced(Months),
  termMaxMonths: sourced(Months),
  rate: z.object({
    minPercent: sourced(Percent),
    maxPercent: sourced(Percent),
    basis: RateBasis,
    period: RatePeriod,
    /** True if the rate is a limited-time promotion. */
    promotional: z.boolean().nullable(),
  }),
  fees: z.array(Fee),
  insurance: z.array(Insurance),
  eligibility: z.object({
    minAge: sourced(z.number().int().min(16).max(100)),
    maxAge: sourced(z.number().int().min(16).max(100)),
    minMonthlyIncomeVnd: sourced(Vnd),
    documents: sourced(z.array(z.string())),
    notes: z.string().optional(),
  }),
  latePenalty: sourced(z.string()),
  representativeExamples: z.array(RepresentativeExample),
  /** Main product page. */
  sourceUrl: z.url(),
  retrievedAt: IsoDate,
  /** Overall confidence for this product's data. */
  confidence: Confidence,
  notes: z.string().optional(),
});
export type Product = z.infer<typeof Product>;

export const LenderFile = z.object({
  /** Matches the file name: data/lenders/<slug>.json */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
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

export const LicensedInstitution = z.object({
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
  /** Other names people use, including app names: "FE", "FECredit", "$NAP". */
  aliases: z.array(z.string()),
  licenseNumber: z.string().nullable(),
  website: z.url().nullable(),
  /** The official list this entry came from. */
  sourceUrl: z.url(),
});
export type LicensedInstitution = z.infer<typeof LicensedInstitution>;

export const LicensedList = z.object({
  sources: z
    .array(
      z.object({
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
