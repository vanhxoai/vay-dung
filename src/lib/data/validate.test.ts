import { describe, expect, it } from "vitest";
import { ageInDays, validateLenderFile, validateLicensedList } from "./validate";
import type { LicensedList } from "./schema";

const today = new Date("2026-11-01T12:00:00Z");
const SRC = "https://example.com/source";
const unknown = { value: null, sourceUrl: null, retrievedAt: null, confidence: null };
const known = <T>(value: T, retrievedAt = "2026-11-01", confidence = "medium") => ({
  value,
  sourceUrl: SRC,
  retrievedAt,
  confidence,
});
const stated = <T extends string>(value: T) => ({ value, provenance: "stated", sourceUrl: SRC });
const none = { value: "unknown", provenance: "none", sourceUrl: null };

function institution(id: string, category: "bank" | "finance_company") {
  return {
    id,
    name: id,
    legalName: `Legal ${id}`,
    category,
    subtype: category,
    aliases: [],
    licenseNumber: null,
    website: null,
    sourceUrl: SRC,
  };
}

const list: LicensedList = {
  sources: [{ title: "SBV list", publisher: "SBV", url: SRC, asOf: "2026-09-30", retrievedAt: "2026-11-01" }],
  institutions: [institution("acme-finance", "finance_company"), institution("acme-bank", "bank")],
  notes: "",
  retrievedAt: "2026-11-01",
};

function rate(overrides: Record<string, unknown> = {}) {
  return {
    kind: "offered_range",
    segment: null,
    minPercent: known(20),
    maxPercent: known(40),
    basis: stated("reducing"),
    period: stated("yearly"),
    promotional: false,
    ...overrides,
  };
}

function fee(overrides: Record<string, unknown> = {}) {
  return {
    nameVi: "Phí trả nợ trước hạn",
    trigger: "prepayment",
    timing: stated("on_event"),
    mandatory: known(true),
    base: "prepaid_amount",
    rule: "percent_with_min_max",
    percent: known(4),
    fixedVnd: unknown,
    minVnd: known(1_000_000),
    maxVnd: unknown,
    tiers: unknown,
    payee: "lender",
    ...overrides,
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "cash-loan",
    nameVi: "Vay tiền mặt",
    productType: "cash_loan",
    status: "active",
    validUntil: null,
    lenderOfRecord: "acme-finance",
    brandOrChannel: null,
    online: true,
    amountMinVnd: known(10_000_000),
    amountMaxVnd: known(70_000_000),
    termMinMonths: known(6),
    termMaxMonths: known(36),
    rates: [rate()],
    amortization: stated("annuity"),
    fees: [fee()],
    feesCompleteness: "partial",
    insurance: [],
    insuranceCompleteness: "unknown",
    eligibility: {
      minAge: known(20),
      maxAge: unknown,
      maxAgeAtLoanEnd: null,
      minMonthlyIncomeVnd: unknown,
      incomeBasis: "unknown",
      documents: unknown,
      existingCustomerRequired: unknown,
      employerRestriction: unknown,
      otherConditions: unknown,
    },
    latePenalty: { textVi: unknown, overduePrincipalRateMultiplier: unknown, overdueInterestRatePercentYear: unknown },
    representativeExamples: [],
    conflicts: [],
    sourceUrl: SRC,
    retrievedAt: "2026-11-01",
    confidence: "medium",
    excludeFromRanking: false,
    ...overrides,
  };
}

function lender(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    slug: "acme-finance",
    name: "Acme Finance",
    legalName: "Legal acme-finance",
    licenseCategory: "finance_company",
    licensedInstitutionId: "acme-finance",
    website: SRC,
    products: [product()],
    researchNotes: "",
    retrievedAt: "2026-11-01",
    ...overrides,
  };
}

const run = (raw: unknown, l: LicensedList | undefined = list) =>
  validateLenderFile("acme-finance.json", "acme-finance", raw, l, today);
const errors = (r: ReturnType<typeof run>) => r.issues.filter((i) => i.level === "error").map((i) => i.message);
const warnings = (r: ReturnType<typeof run>) => r.issues.filter((i) => i.level === "warning").map((i) => i.message);
const withProduct = (o: Record<string, unknown>) => run(lender({ products: [product(o)] }));

describe("validateLenderFile: licensing", () => {
  it("passes a clean, licensed, fresh lender", () => {
    expect(run(lender()).issues).toEqual([]);
  });

  it("rejects a lender that is not on the licensed list", () => {
    expect(errors(run(lender({ licensedInstitutionId: "shady-app" })))).toContain(
      '"shady-app" is not on the licensed institutions list',
    );
  });

  it("rejects when the licensed list itself is missing", () => {
    const r = validateLenderFile("acme-finance.json", "acme-finance", lender(), undefined, today);
    expect(errors(r)[0]).toMatch(/cannot check licensing/);
  });

  it("rejects a license category that contradicts the official list", () => {
    expect(errors(run(lender({ licenseCategory: "bank" })))[0]).toMatch(/licensed list says "finance_company"/);
  });

  it("rejects a legal name that differs from the SBV list", () => {
    expect(errors(run(lender({ legalName: "Acme (old name)" })))[0]).toMatch(/differs from the SBV list/);
  });

  it("rejects a product whose lender of record isn't licensed", () => {
    expect(errors(withProduct({ lenderOfRecord: "partner-app" }))[0]).toMatch(/lenderOfRecord "partner-app"/);
  });

  it("rejects a slug that doesn't match the file name", () => {
    expect(errors(run(lender({ slug: "other" })))[0]).toMatch(/doesn't match file name/);
  });
});

describe("validateLenderFile: schema strictness", () => {
  it("rejects unknown fields, so no commercial fields can be added", () => {
    expect(errors(withProduct({ sponsored: true }))[0]).toMatch(/Unrecognized key/);
    expect(errors(run(lender({ affiliatePayout: 100 })))[0]).toMatch(/Unrecognized key/);
  });

  it("rejects a known classification with provenance none", () => {
    expect(errors(withProduct({ amortization: { value: "annuity", provenance: "none", sourceUrl: SRC } })).length).toBeGreaterThan(0);
  });

  it("rejects an unknown classification that claims to be stated", () => {
    expect(errors(withProduct({ amortization: { value: "unknown", provenance: "stated", sourceUrl: SRC } })).length).toBeGreaterThan(0);
  });

  it("reports schema errors with their path", () => {
    expect(errors(run(lender({ website: "not a url" })))[0]).toMatch(/^website:/);
  });
});

describe("validateLenderFile: rates", () => {
  it("warns when an offered rate can't be costed (unknown basis)", () => {
    const r = withProduct({ rates: [rate({ basis: none })] });
    expect(warnings(r)).toEqual([expect.stringMatching(/can't be costed/)]);
  });

  it("does not warn about unknown basis on an advertised floor", () => {
    const r = withProduct({ rates: [rate({ kind: "advertised_floor", basis: none }), rate()] });
    expect(r.issues).toEqual([]);
  });

  it("warns when there is no offered range at all", () => {
    const r = withProduct({ rates: [rate({ kind: "regulatory_ceiling" })] });
    expect(warnings(r)[0]).toMatch(/chưa đủ dữ liệu/);
  });

  it("flags implausible periods", () => {
    expect(warnings(withProduct({ rates: [rate({ period: stated("monthly"), minPercent: known(18), maxPercent: known(30) })] }))).toHaveLength(2);
    expect(warnings(withProduct({ rates: [rate({ minPercent: known(0.9), maxPercent: known(2) })] }))).toHaveLength(1);
  });

  it("warns about 0% with unknown promotional status", () => {
    const r = withProduct({ rates: [rate({ minPercent: known(0), promotional: null })] });
    expect(warnings(r)[0]).toMatch(/0% rate/);
  });

  it("rejects min > max", () => {
    const r = withProduct({ rates: [rate({ minPercent: known(50), maxPercent: known(40) })] });
    expect(errors(r)[0]).toMatch(/min 50 > max 40/);
  });
});

describe("validateLenderFile: fees", () => {
  it("rejects a fixed amount next to a percent (minimums go in minVnd)", () => {
    const r = withProduct({ fees: [fee({ minVnd: unknown, fixedVnd: known(1_000_000) })] });
    expect(errors(r)[0]).toMatch(/use minVnd\/maxVnd/);
  });

  it("rejects tiers together with a single percent", () => {
    const tiers = known([{ from: 0, to: 12, unit: "month", percent: 4 }]);
    expect(errors(withProduct({ fees: [fee({ tiers })] }))[0]).toMatch(/both tiers/);
  });

  it("rejects a min/max on a percent_only fee", () => {
    expect(errors(withProduct({ fees: [fee({ rule: "percent_only" })] }))[0]).toMatch(/percent_only/);
  });
});

describe("validateLenderFile: conflicts and caps", () => {
  it("requires a conflict entry when a finance company advertises more than 100M", () => {
    expect(errors(withProduct({ amountMaxVnd: known(250_000_000) }))[0]).toMatch(/100M finance-company cap/);
    const ok = withProduct({
      amountMaxVnd: known(250_000_000),
      conflicts: [{ field: "amountMaxVnd", values: [{ value: "250000000", sourceUrl: SRC }], resolution: "lawyer to confirm" }],
    });
    expect(ok.issues).toEqual([]);
  });

  it("doesn't apply the finance-company cap to banks", () => {
    const r = run(
      lender({
        legalName: "Legal acme-bank",
        licenseCategory: "bank",
        licensedInstitutionId: "acme-bank",
        products: [product({ lenderOfRecord: "acme-bank", amountMaxVnd: known(500_000_000) })],
      }),
    );
    expect(r.issues).toEqual([]);
  });

  it("warns when a conflicting field is marked high confidence", () => {
    const r = withProduct({
      amountMaxVnd: known(70_000_000, "2026-11-01", "high"),
      conflicts: [{ field: "amountMaxVnd", values: [{ value: "50000000", sourceUrl: SRC }], resolution: "kept lower" }],
    });
    expect(warnings(r)[0]).toMatch(/high confidence but has a recorded conflict/);
  });

  it("rejects a conflict pointing at a field that doesn't exist", () => {
    const r = withProduct({ conflicts: [{ field: "nope", values: [{ value: "1", sourceUrl: SRC }], resolution: "x" }] });
    expect(errors(r)[0]).toMatch(/unknown field "nope"/);
  });
});

describe("validateLenderFile: status, examples, ranking", () => {
  it("rejects a product past its validUntil that isn't marked expired", () => {
    expect(errors(withProduct({ status: "campaign", validUntil: "2026-02-01" }))[0]).toMatch(/has passed/);
  });

  it("requires a reason to exclude from ranking", () => {
    expect(errors(withProduct({ excludeFromRanking: true }))[0]).toMatch(/excludeReason/);
  });

  it("warns when a worked example doesn't add up", () => {
    const ex = {
      principalVnd: 20_000_000,
      termMonths: 12,
      ratePercent: 25, // inside the fixture's 20–40% range, so only the arithmetic is tested
      rateBasis: "reducing",
      ratePeriod: "yearly",
      amortization: "annuity",
      monthlyPaymentVnd: 1_785_407,
      totalRepaidVnd: 21_324_807, // 12 × 1,785,407 = 21,424,884
      statedAnnualRatePercent: null,
      statedAnnualRateKind: null,
      includesInsurance: null,
      internallyConsistent: null,
      sourceUrl: SRC,
      retrievedAt: "2026-11-01",
      confidence: "low",
    };
    expect(warnings(withProduct({ representativeExamples: [ex] }))[0]).toMatch(/≠ total/);
    expect(withProduct({ representativeExamples: [{ ...ex, internallyConsistent: false }] }).issues).toEqual([]);
  });
});

describe("validateLenderFile: example rates", () => {
  const ex = (ratePercent: number, ratePeriod: string) => ({
    principalVnd: 20_000_000,
    termMonths: 12,
    ratePercent,
    rateBasis: "reducing",
    ratePeriod,
    amortization: "equal_principal",
    monthlyPaymentVnd: null,
    totalRepaidVnd: null,
    statedAnnualRatePercent: null,
    statedAnnualRateKind: null,
    includesInsurance: null,
    internallyConsistent: true,
    sourceUrl: SRC,
    retrievedAt: "2026-11-01",
    confidence: "low",
  });

  it("warns when an example sits outside the offered range (Home Credit 0.75%/month vs 45–55%/year)", () => {
    const r = withProduct({ rates: [rate({ minPercent: known(45), maxPercent: known(55) })], representativeExamples: [ex(0.75, "monthly")] });
    expect(warnings(r)[0]).toMatch(/outside every offered range/);
  });

  it("accepts an example inside the range, comparing monthly × 12 with yearly", () => {
    const r = withProduct({ representativeExamples: [ex(2.5, "monthly")] }); // 30%/yr within 20–40
    expect(r.issues).toEqual([]);
  });
});

describe("validateLenderFile: dates", () => {
  it("rejects medium/high confidence on a source document older than a year", () => {
    const old = { ...known(10_000_000), sourceDocumentDate: "2025-03-19" };
    expect(errors(withProduct({ amountMinVnd: old }))[0]).toMatch(/source document dated 2025-03-19/);
    expect(withProduct({ amountMinVnd: { ...old, confidence: "low" } }).issues).toEqual([]);
  });

  it("rejects data older than 90 days, using the oldest figure", () => {
    // 2026-07-01 → 2026-11-01 is 123 days
    expect(errors(withProduct({ amountMinVnd: known(10_000_000, "2026-07-01") }))[0]).toMatch(/123 days old/);
  });

  it("warns between 60 and 90 days", () => {
    // 2026-08-20 → 2026-11-01 is 73 days
    expect(run(lender({ retrievedAt: "2026-08-20" })).issues).toEqual([expect.objectContaining({ level: "warning" })]);
  });

  it("rejects a future date anywhere, not just the oldest", () => {
    expect(errors(withProduct({ amountMinVnd: known(10_000_000, "2027-01-01") }))[0]).toMatch(/in the future/);
  });
});

describe("validateLicensedList", () => {
  it("passes a fresh list", () => {
    expect(validateLicensedList("l.json", list, today).issues).toEqual([]);
  });

  it("rejects duplicate ids", () => {
    const dup = { ...list, institutions: [...list.institutions, ...list.institutions] };
    expect(validateLicensedList("l.json", dup, today).issues[0].message).toMatch(/duplicate/);
  });

  it("warns when the SBV as-of date is old", () => {
    const old = { ...list, sources: [{ ...list.sources[0], asOf: "2026-03-31" }] };
    expect(validateLicensedList("l.json", old, today).issues[0].message).toMatch(/newer list/);
  });
});

describe("ageInDays", () => {
  it("counts whole days", () => {
    expect(ageInDays("2026-10-31", today)).toBe(1);
    expect(ageInDays("2026-11-01", today)).toBe(0);
  });
});
