/**
 * Cross-file checks for lender data. Pure functions (no file system), so they're
 * easy to test. scripts/validate-data.ts reads the files and calls these.
 */
import { LenderFile, LicensedList } from "./schema";
import type { LenderFile as LenderFileT, LicensedList as LicensedListT } from "./schema";

export type Issue = { level: "error" | "warning"; file: string; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Data older than this is an error (compliance rule: never show stale numbers). */
export const STALE_ERROR_DAYS = 90;
/** Data older than this gets a warning so /refresh-data can prioritize it. */
export const STALE_WARNING_DAYS = 60;

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

export function validateLicensedList(file: string, raw: unknown): { list?: LicensedListT; issues: Issue[] } {
  const parsed = LicensedList.safeParse(raw);
  if (!parsed.success) return { issues: zodIssues(file, parsed.error) };

  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const inst of parsed.data.institutions) {
    if (seen.has(inst.id)) issues.push({ level: "error", file, message: `duplicate institution id "${inst.id}"` });
    seen.add(inst.id);
  }
  return { list: parsed.data, issues };
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
    else if (inst.category !== lender.licenseCategory)
      err(`licenseCategory "${lender.licenseCategory}" but the licensed list says "${inst.category}"`);
  }

  const ids = new Set<string>();
  for (const p of lender.products) {
    if (ids.has(p.id)) err(`duplicate product id "${p.id}"`);
    ids.add(p.id);

    const { minPercent, maxPercent, basis, period } = p.rate;
    const hasRate = minPercent.value !== null || maxPercent.value !== null;
    if (hasRate && (basis === "unknown" || period === "unknown"))
      warn(`${p.id}: rate is known but its basis/period is "${basis}/${period}"; it can't be compared yet`);
    if (minPercent.value !== null && maxPercent.value !== null && minPercent.value > maxPercent.value)
      err(`${p.id}: rate min ${minPercent.value} > max ${maxPercent.value}`);
    if (p.amountMinVnd.value !== null && p.amountMaxVnd.value !== null && p.amountMinVnd.value > p.amountMaxVnd.value)
      err(`${p.id}: amount min > max`);
    if (p.termMinMonths.value !== null && p.termMaxMonths.value !== null && p.termMinMonths.value > p.termMaxMonths.value)
      err(`${p.id}: term min > max`);
  }

  const dates = collectDates(lender);
  const oldest = dates.reduce((a, b) => (a < b ? a : b), lender.retrievedAt);
  const age = ageInDays(oldest, today);
  if (age < 0) err(`retrievedAt ${oldest} is in the future`);
  else if (age > STALE_ERROR_DAYS) err(`oldest figure is ${age} days old (${oldest}); refresh it (limit ${STALE_ERROR_DAYS})`);
  else if (age > STALE_WARNING_DAYS) warn(`oldest figure is ${age} days old (${oldest}); due for refresh`);

  return { lender, issues };
}
