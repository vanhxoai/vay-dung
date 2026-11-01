/**
 * One-off migration of data/lenders/*.json from schema v1 to v2 (2026-11-01).
 * Mechanical only: anything it can't know is set to unknown/"none", and every
 * classification it fills in is marked provenance "inferred" so a reviewer
 * must confirm or correct it from the source. Run: npx tsx scripts/migrations/v1-to-v2.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;

const dir = join(process.cwd(), "data", "lenders");
const licensed: J = JSON.parse(readFileSync(join(process.cwd(), "data", "licensed-institutions.json"), "utf8"));

const UNKNOWN = { value: null, sourceUrl: null, retrievedAt: null, confidence: null };
const unknownClass = { value: "unknown", provenance: "none", sourceUrl: null };
const inferred = (value: string, sourceUrl: string, note: string) =>
  value === "unknown" ? unknownClass : { value, provenance: "inferred", sourceUrl, note };
const NEEDS_REVIEW = "Set by the v1→v2 migration; confirm against the source.";

function triggerFor(name: string): string {
  const n = name.toLowerCase();
  if (/trước hạn|early|prepay|tất toán/.test(n)) return "prepayment";
  if (/chậm|quá hạn|late|overdue/.test(n)) return "late_payment";
  if (/hồ sơ|application|thẩm định/.test(n)) return "application";
  if (/giải ngân|disburs/.test(n)) return "disbursement";
  if (/thu hộ|collection|chuyển|transfer|thanh toán/.test(n)) return "per_transaction";
  if (/thường niên|annual|quản lý|management/.test(n)) return "periodic";
  return "other";
}

function migrateFee(f: J, productUrl: string): J {
  const hasPct = f.percentOfPrincipal?.value != null;
  const hasFixed = f.fixedVnd?.value != null;
  const trigger = triggerFor(`${f.nameVi ?? ""} ${f.name ?? ""}`);
  let timing = f.timing ?? "unknown";
  if (timing === "unknown" && (trigger === "prepayment" || trigger === "late_payment")) timing = "on_event";
  const src = f.percentOfPrincipal?.sourceUrl ?? f.fixedVnd?.sourceUrl ?? productUrl;
  return {
    nameVi: f.nameVi ?? f.name,
    ...(f.nameVi && f.name !== f.nameVi ? { nameEn: f.name } : {}),
    trigger,
    timing: inferred(timing, src, NEEDS_REVIEW),
    mandatory:
      f.mandatory == null
        ? { ...UNKNOWN, note: "v1 had no source for this." }
        : { value: f.mandatory, sourceUrl: src, retrievedAt: f.percentOfPrincipal?.retrievedAt ?? f.fixedVnd?.retrievedAt ?? "2026-11-01", confidence: "low", note: NEEDS_REVIEW },
    base: "unknown",
    // v1 often stored minimums in fixedVnd; "other" forces a reviewer to decide.
    rule: hasPct && hasFixed ? "other" : hasPct ? "percent_only" : hasFixed ? "fixed_only" : "other",
    percent: f.percentOfPrincipal ?? UNKNOWN,
    fixedVnd: f.fixedVnd ?? UNKNOWN,
    minVnd: UNKNOWN,
    maxVnd: UNKNOWN,
    tiers: UNKNOWN,
    payee: "unknown",
  };
}

function migrateInsurance(i: J, productUrl: string): J {
  const pct = i.percentOfPrincipal;
  return {
    nameVi: i.name,
    mandatory: i.mandatory,
    collection: inferred(i.timing ?? "unknown", productUrl, NEEDS_REVIEW),
    premium: {
      method: pct?.value != null ? inferred("percent_of_principal", pct.sourceUrl, NEEDS_REVIEW) : unknownClass,
      ratePercentMin: pct ?? UNKNOWN,
      ratePercentMax: UNKNOWN,
      insuredMultiplierTiers: UNKNOWN,
      fixedVnd: i.fixedVnd ?? UNKNOWN,
    },
    beneficiary: null,
  };
}

function migrateProduct(p: J, lenderId: string): J {
  const r = p.rate;
  const hasMin = r.minPercent.value != null;
  const hasMax = r.maxPercent.value != null;
  const rateSrc = r.minPercent.sourceUrl ?? r.maxPercent.sourceUrl ?? p.sourceUrl;
  const rates =
    hasMin || hasMax
      ? [
          {
            // Only-min is usually "từ X%"; a reviewer must confirm every kind.
            kind: hasMin && !hasMax ? "advertised_floor" : "offered_range",
            segment: null,
            minPercent: r.minPercent,
            maxPercent: r.maxPercent,
            basis: inferred(r.basis, rateSrc, NEEDS_REVIEW),
            period: inferred(r.period, rateSrc, NEEDS_REVIEW),
            promotional: r.promotional,
          },
        ]
      : [];
  const revolving = ["overdraft", "credit_card", "bnpl"].includes(p.productType);
  const amort = revolving ? "revolving" : r.basis === "flat" ? "flat" : "unknown";
  return {
    id: p.id,
    nameVi: p.name,
    productType: p.productType,
    status: "active",
    validUntil: null,
    lenderOfRecord: lenderId,
    brandOrChannel: null,
    online: p.online,
    amountMinVnd: p.amountMinVnd,
    amountMaxVnd: p.amountMaxVnd,
    termMinMonths: p.termMinMonths,
    termMaxMonths: p.termMaxMonths,
    rates,
    amortization: inferred(amort, rateSrc, NEEDS_REVIEW),
    fees: p.fees.map((f: J) => migrateFee(f, p.sourceUrl)),
    feesCompleteness: p.fees.length ? "partial" : "unknown",
    insurance: p.insurance.map((i: J) => migrateInsurance(i, p.sourceUrl)),
    insuranceCompleteness: p.insurance.length ? "partial" : "unknown",
    eligibility: {
      minAge: p.eligibility.minAge,
      maxAge: p.eligibility.maxAge,
      maxAgeAtLoanEnd: null,
      minMonthlyIncomeVnd: p.eligibility.minMonthlyIncomeVnd,
      incomeBasis: "unknown",
      documents: p.eligibility.documents,
      existingCustomerRequired: UNKNOWN,
      employerRestriction: UNKNOWN,
      otherConditions: UNKNOWN,
      ...(p.eligibility.notes ? { notes: p.eligibility.notes } : {}),
    },
    latePenalty: {
      textVi: p.latePenalty,
      overduePrincipalRateMultiplier: UNKNOWN,
      overdueInterestRatePercentYear: UNKNOWN,
    },
    representativeExamples: p.representativeExamples.map((e: J) => {
      const { statedApr, ...rest } = e;
      return {
        ...rest,
        amortization: e.rateBasis === "flat" ? "flat" : "unknown",
        statedAnnualRatePercent: statedApr,
        statedAnnualRateKind: statedApr == null ? null : "unknown",
        includesInsurance: null,
        internallyConsistent: null,
      };
    }),
    conflicts: [],
    sourceUrl: p.sourceUrl,
    retrievedAt: p.retrievedAt,
    confidence: p.confidence,
    excludeFromRanking: false,
    ...(p.notes ? { notes: p.notes } : {}),
  };
}

for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const path = join(dir, f);
  const v1: J = JSON.parse(readFileSync(path, "utf8"));
  if (v1.schemaVersion === 2) continue;
  const inst = licensed.institutions.find((i: J) => i.id === v1.licensedInstitutionId);
  const v2 = {
    schemaVersion: 2,
    slug: v1.slug,
    name: v1.name,
    legalName: inst?.legalName ?? v1.legalName,
    licenseCategory: v1.licenseCategory,
    licensedInstitutionId: v1.licensedInstitutionId,
    website: v1.website,
    products: v1.products.map((p: J) => migrateProduct(p, v1.licensedInstitutionId)),
    researchNotes: v1.researchNotes,
    retrievedAt: v1.retrievedAt,
  };
  writeFileSync(path, JSON.stringify(v2, null, 2) + "\n");
  console.log(`migrated ${f}`);
}
