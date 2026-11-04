/**
 * Cross-file checks for lender data. Pure functions (no file system), so they're
 * easy to test. scripts/validate-data.ts reads the files and calls these.
 */
import { FINANCE_COMPANY_CONSUMER_LOAN_CAP_VND } from "@/config/regulatory";
import { LenderFile, LicensedList } from "./schema";
import type { LenderFile as LenderFileT, LicensedList as LicensedListT, Product } from "./schema";

export type Issue = { level: "error" | "warning"; file: string; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Data older than this is an error (compliance rule: never show stale numbers). */
export const STALE_ERROR_DAYS = 90;
/** Data older than this gets a warning so /refresh-data can prioritize it. */
export const STALE_WARNING_DAYS = 60;
/** SBV publishes its lists quarterly, about 2–3 weeks after quarter end. */
export const LICENSED_LIST_AS_OF_WARNING_DAYS = 120;
/** A "monthly" rate above this, or a "yearly" one below the min, is probably mislabeled. */
const MAX_PLAUSIBLE_MONTHLY_PERCENT = 10;
const MIN_PLAUSIBLE_YEARLY_PERCENT = 1;

export function ageInDays(isoDate: string, today: Date): number {
  return Math.floor((today.getTime() - new Date(isoDate + "T00:00:00Z").getTime()) / DAY_MS);
}

function zodIssues(file: string, error: { issues: { path: PropertyKey[]; message: string }[] }): Issue[] {
  return error.issues.map((i) => ({
    level: "error" as const,
    file,
    message: `${i.path.map(String).join(".") || "(root)"}: ${i.message}`,
  }));
}

/** Collects every `retrievedAt` in an object tree, so we can check data age per figure. */
function collectDates(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => collectDates(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "retrievedAt" && typeof v === "string") out.push(v);
      else collectDates(v, out);
    }
  }
  return out;
}

/** A source document older than this caps confidence at "low" (data-entry rules §2). */
export const OLD_DOCUMENT_DAYS = 365;

/** Finds sourced values whose document is old but whose confidence is above "low". */
function checkDocumentAge(node: unknown, today: Date, err: (m: string) => void, path = ""): void {
  if (Array.isArray(node)) node.forEach((n, i) => checkDocumentAge(n, today, err, `${path}[${i}]`));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.sourceDocumentDate === "string" && (o.confidence === "high" || o.confidence === "medium")) {
      const age = ageInDays(o.sourceDocumentDate, today);
      if (age > OLD_DOCUMENT_DAYS)
        err(`${path}: source document dated ${o.sourceDocumentDate} is ${age} days old but confidence is "${o.confidence}"; use "low"`);
    }
    for (const [k, v] of Object.entries(o)) checkDocumentAge(v, today, err, path ? `${path}.${k}` : k);
  }
}

/** Monthly or yearly nominal rate → yearly nominal, for range comparisons only. */
function yearlyNominal(rate: number, period: string): number | null {
  if (period === "yearly") return rate;
  if (period === "monthly") return rate * 12;
  return null;
}

/** Checks the oldest and newest `retrievedAt` in a tree against today. */
function checkDates(node: unknown, fallback: string, today: Date, err: (m: string) => void, warn: (m: string) => void) {
  const dates = collectDates(node);
  if (dates.length === 0) dates.push(fallback);
  const sorted = [...dates].sort();
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  if (ageInDays(newest, today) < 0) err(`retrievedAt ${newest} is in the future`);
  const age = ageInDays(oldest, today);
  if (age > STALE_ERROR_DAYS) err(`oldest figure is ${age} days old (${oldest}); refresh it (limit ${STALE_ERROR_DAYS})`);
  else if (age > STALE_WARNING_DAYS) warn(`oldest figure is ${age} days old (${oldest}); due for refresh`);
}

export function validateLicensedList(
  file: string,
  raw: unknown,
  today: Date = new Date(),
): { list?: LicensedListT; issues: Issue[] } {
  const parsed = LicensedList.safeParse(raw);
  if (!parsed.success) return { issues: zodIssues(file, parsed.error) };

  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: "error", file, message });
  const warn = (message: string) => issues.push({ level: "warning", file, message });

  const seen = new Set<string>();
  for (const inst of parsed.data.institutions) {
    if (seen.has(inst.id)) err(`duplicate institution id "${inst.id}"`);
    seen.add(inst.id);
  }
  checkDates(parsed.data, parsed.data.retrievedAt, today, err, warn);
  for (const s of parsed.data.sources) {
    if (s.asOf && ageInDays(s.asOf, today) > LICENSED_LIST_AS_OF_WARNING_DAYS)
      warn(`"${s.title}" is as of ${s.asOf}; SBV has probably published a newer list`);
  }
  return { list: parsed.data, issues };
}

/** Reads a dotted path like "rates[0].maxPercent" from a product. */
function getPath(obj: unknown, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function checkProduct(
  p: Product,
  lender: LenderFileT,
  list: LicensedListT | undefined,
  today: Date,
  err: (m: string) => void,
  warn: (m: string) => void,
) {
  const id = p.id;
  const v = <T>(s: { value: T | null }) => s.value;

  // Licensing of the actual lender (may differ from the file's lender for partner products).
  if (list && !list.institutions.some((i) => i.id === p.lenderOfRecord))
    err(`${id}: lenderOfRecord "${p.lenderOfRecord}" is not on the licensed institutions list`);

  // Ranges
  for (const [a, b, label] of [
    [v(p.amountMinVnd), v(p.amountMaxVnd), "amount"],
    [v(p.termMinMonths), v(p.termMaxMonths), "term"],
  ] as const) {
    if (a !== null && b !== null && a > b) err(`${id}: ${label} min > max`);
  }

  // Rates
  p.rates.forEach((r, i) => {
    const where = `${id}: rates[${i}] (${r.kind})`;
    const lo = v(r.minPercent);
    const hi = v(r.maxPercent);
    if (lo !== null && hi !== null && lo > hi) err(`${where}: min ${lo} > max ${hi}`);
    for (const x of [lo, hi]) {
      if (x === null) continue;
      if (r.period.value === "monthly" && x > MAX_PLAUSIBLE_MONTHLY_PERCENT)
        warn(`${where}: ${x}%/month is implausible; is the period yearly?`);
      if (r.period.value === "yearly" && x > 0 && x < MIN_PLAUSIBLE_YEARLY_PERCENT)
        warn(`${where}: ${x}%/year is implausible; is the period monthly?`);
    }
    if (r.kind === "offered_range" && (lo !== null || hi !== null) && (r.basis.value === "unknown" || r.period.value === "unknown"))
      warn(`${where}: basis/period is "${r.basis.value}/${r.period.value}"; it can't be costed yet`);
    if (lo === 0 && r.promotional === null) warn(`${where}: a 0% rate with promotional = null; is it a promotion?`);
  });
  if (!p.excludeFromRanking && !p.rates.some((r) => r.kind === "offered_range"))
    warn(`${id}: no offered_range rate; it will show as "chưa đủ dữ liệu để so sánh"`);
  if (p.excludeFromRanking && !p.excludeReason) err(`${id}: excludeFromRanking needs an excludeReason`);
  if (p.rates.some((r) => r.minUnconfirmed) && !p.borrowerNotes?.length) err(`${id}: minUnconfirmed needs a borrower note saying why`);

  // Fees
  p.fees.forEach((f, i) => {
    const where = `${id}: fees[${i}] "${f.nameVi}"`;
    if (f.tiers.value !== null && f.percent.value !== null) err(`${where}: has both tiers and a single percent`);
    if (f.rule === "percent_with_min_max" && f.percent.value === null && f.tiers.value === null)
      warn(`${where}: rule is percent_with_min_max but the percent is unknown`);
    if (f.rule === "percent_only" && (f.minVnd.value !== null || f.maxVnd.value !== null))
      err(`${where}: has a min/max but rule is percent_only`);
    if (f.fixedVnd.value !== null && (f.percent.value !== null || f.tiers.value !== null) && f.rule !== "other")
      err(`${where}: has both a fixed amount and a percent; use minVnd/maxVnd for minimums, or rule "other" with a note`);
  });

  // Status
  if (p.status === "campaign" && p.validUntil === null) warn(`${id}: campaign without validUntil`);
  if (p.validUntil && ageInDays(p.validUntil, today) > 0 && p.status !== "expired")
    err(`${id}: validUntil ${p.validUntil} has passed; mark it expired`);

  // Worked examples
  p.representativeExamples.forEach((ex, i) => {
    const where = `${id}: representativeExamples[${i}]`;
    const tMin = v(p.termMinMonths), tMax = v(p.termMaxMonths), aMin = v(p.amountMinVnd), aMax = v(p.amountMaxVnd);
    if ((tMin !== null && ex.termMonths < tMin) || (tMax !== null && ex.termMonths > tMax))
      warn(`${where}: term ${ex.termMonths} is outside the product's term range`);
    if ((aMin !== null && ex.principalVnd < aMin) || (aMax !== null && ex.principalVnd > aMax))
      warn(`${where}: amount is outside the product's amount range`);
    // An example far outside the offered range (e.g. at an advertised floor) must not be shown as typical.
    const exYearly = ex.ratePercent === null ? null : yearlyNominal(ex.ratePercent, ex.ratePeriod);
    const offered = p.rates.filter((r) => r.kind === "offered_range" && r.basis.value === ex.rateBasis);
    if (exYearly !== null && offered.length > 0) {
      const inside = offered.some((r) => {
        const lo = r.minPercent.value === null ? null : yearlyNominal(r.minPercent.value, r.period.value);
        const hi = r.maxPercent.value === null ? null : yearlyNominal(r.maxPercent.value, r.period.value);
        return (lo === null || exYearly >= lo - 1e-9) && (hi === null || exYearly <= hi + 1e-9);
      });
      if (!inside) warn(`${where}: rate ${ex.ratePercent}% (${ex.ratePeriod}) is outside every offered range; don't present it as typical`);
    }
    if (ex.monthlyPaymentVnd !== null && ex.totalRepaidVnd !== null && ex.amortization === "annuity" && ex.internallyConsistent !== false) {
      const implied = ex.monthlyPaymentVnd * ex.termMonths;
      if (Math.abs(implied - ex.totalRepaidVnd) > ex.termMonths * 1000)
        warn(`${where}: ${ex.termMonths} × ${ex.monthlyPaymentVnd} ≠ total ${ex.totalRepaidVnd}; set internallyConsistent=false?`);
    }
  });

  // Conflicts: the affected field can't be "high" confidence.
  for (const c of p.conflicts) {
    const target = getPath(p, c.field);
    if (target === undefined) err(`${id}: conflict refers to unknown field "${c.field}"`);
    else if (target && typeof target === "object" && (target as { confidence?: unknown }).confidence === "high")
      warn(`${id}: "${c.field}" is high confidence but has a recorded conflict`);
  }
  if (p.confidence === "high" && p.conflicts.length > 0) warn(`${id}: high overall confidence despite conflicts`);

  // Finance-company cap (compliance M8): amounts above it must be recorded as a conflict.
  const max = v(p.amountMaxVnd);
  if (
    lender.licenseCategory === "finance_company" &&
    p.productType !== "credit_card" &&
    max !== null &&
    max > FINANCE_COMPANY_CONSUMER_LOAN_CAP_VND &&
    !p.conflicts.some((c) => c.field === "amountMaxVnd")
  )
    err(`${id}: max ${max} VND exceeds the 100M finance-company cap; record it in conflicts (see compliance M8)`);
}

export function validateLenderFile(
  file: string,
  expectedSlug: string,
  raw: unknown,
  list: LicensedListT | undefined,
  today: Date,
): { lender?: LenderFileT; issues: Issue[] } {
  const parsed = LenderFile.safeParse(raw);
  if (!parsed.success) return { issues: zodIssues(file, parsed.error) };
  const lender = parsed.data;
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: "error", file, message });
  const warn = (message: string) => issues.push({ level: "warning", file, message });

  if (lender.slug !== expectedSlug) err(`slug "${lender.slug}" doesn't match file name "${expectedSlug}"`);

  // Licensing: only institutions on the SBV list may be shown.
  if (!list) {
    err("cannot check licensing: data/licensed-institutions.json is missing or invalid");
  } else {
    const inst = list.institutions.find((i) => i.id === lender.licensedInstitutionId);
    if (!inst) err(`"${lender.licensedInstitutionId}" is not on the licensed institutions list`);
    else {
      if (inst.category !== lender.licenseCategory)
        err(`licenseCategory "${lender.licenseCategory}" but the licensed list says "${inst.category}"`);
      if (inst.legalName !== lender.legalName)
        err(`legalName "${lender.legalName}" differs from the SBV list: "${inst.legalName}"`);
    }
  }

  const ids = new Set<string>();
  for (const p of lender.products) {
    if (ids.has(p.id)) err(`duplicate product id "${p.id}"`);
    ids.add(p.id);
    checkProduct(p, lender, list, today, err, warn);
  }

  checkDates(lender, lender.retrievedAt, today, err, warn);
  checkDocumentAge(lender, today, err);
  return { lender, issues };
}
