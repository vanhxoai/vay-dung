import { describe, expect, it } from "vitest";
import { ageInDays, validateLenderFile, validateLicensedList } from "./validate";
import type { LicensedList } from "./schema";

const today = new Date("2026-11-01T12:00:00Z");
const SRC = "https://example.com/source";
const unknown = { value: null, sourceUrl: null, retrievedAt: null, confidence: null };
const known = <T>(value: T, retrievedAt = "2026-11-01") => ({
  value,
  sourceUrl: SRC,
  retrievedAt,
  confidence: "high" as const,
});

const list: LicensedList = {
  sources: [{ title: "SBV list", publisher: "SBV", url: SRC, asOf: null, retrievedAt: "2026-11-01" }],
  institutions: [
    {
      id: "acme-finance",
      name: "Acme Finance",
      legalName: "Công ty Tài chính Acme",
      category: "finance_company",
      subtype: "Công ty tài chính",
      aliases: [],
      licenseNumber: null,
      website: null,
      sourceUrl: SRC,
    },
  ],
  notes: "",
  retrievedAt: "2026-11-01",
};

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "cash-loan",
    name: "Cash loan",
    productType: "cash_loan",
    online: true,
    amountMinVnd: known(10_000_000),
    amountMaxVnd: known(70_000_000),
    termMinMonths: known(6),
    termMaxMonths: known(36),
    rate: { minPercent: known(20), maxPercent: unknown, basis: "reducing", period: "yearly", promotional: false },
    fees: [],
    insurance: [],
    eligibility: { minAge: known(20), maxAge: unknown, minMonthlyIncomeVnd: unknown, documents: unknown },
    latePenalty: unknown,
    representativeExamples: [],
    sourceUrl: SRC,
    retrievedAt: "2026-11-01",
    confidence: "high",
    ...overrides,
  };
}

function lender(overrides: Record<string, unknown> = {}) {
  return {
    slug: "acme-finance",
    name: "Acme Finance",
    legalName: "Công ty Tài chính Acme",
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

describe("validateLenderFile", () => {
  it("passes a clean, licensed, fresh lender", () => {
    expect(run(lender()).issues).toEqual([]);
  });

  it("rejects a lender that is not on the licensed list", () => {
    expect(errors(run(lender({ licensedInstitutionId: "shady-app" })))).toEqual([
      '"shady-app" is not on the licensed institutions list',
    ]);
  });

  it("rejects when the licensed list itself is missing", () => {
    const r = validateLenderFile("acme-finance.json", "acme-finance", lender(), undefined, today);
    expect(errors(r)[0]).toMatch(/cannot check licensing/);
  });

  it("rejects a license category that contradicts the official list", () => {
    expect(errors(run(lender({ licenseCategory: "bank" })))[0]).toMatch(/licensed list says "finance_company"/);
  });

  it("rejects a slug that doesn't match the file name", () => {
    expect(errors(run(lender({ slug: "other" })))[0]).toMatch(/doesn't match file name/);
  });

  it("warns when a rate's basis or period is unknown", () => {
    const p = product({ rate: { minPercent: known(2), maxPercent: unknown, basis: "unknown", period: "monthly", promotional: null } });
    const r = run(lender({ products: [p] }));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ level: "warning" });
  });

  it("rejects min > max", () => {
    const p = product({ termMinMonths: known(36), termMaxMonths: known(6) });
    expect(errors(run(lender({ products: [p] })))).toEqual(["cash-loan: term min > max"]);
  });

  it("rejects data older than 90 days, using the oldest figure", () => {
    // 2026-07-01 → 2026-11-01 is 123 days
    const p = product({ amountMinVnd: known(10_000_000, "2026-07-01") });
    expect(errors(run(lender({ products: [p] })))[0]).toMatch(/123 days old/);
  });

  it("warns between 60 and 90 days", () => {
    // 2026-08-20 → 2026-11-01 is 73 days
    const r = run(lender({ retrievedAt: "2026-08-20" }));
    expect(r.issues).toEqual([expect.objectContaining({ level: "warning" })]);
  });

  it("reports schema errors with their path", () => {
    const r = run(lender({ website: "not a url" }));
    expect(errors(r)[0]).toMatch(/^website:/);
  });
});

describe("validateLicensedList", () => {
  it("rejects duplicate ids", () => {
    const dup = { ...list, institutions: [...list.institutions, ...list.institutions] };
    expect(validateLicensedList("l.json", dup).issues[0].message).toMatch(/duplicate/);
  });
});

describe("ageInDays", () => {
  it("counts whole days", () => {
    expect(ageInDays("2026-10-31", today)).toBe(1);
    expect(ageInDays("2026-11-01", today)).toBe(0);
  });
});
