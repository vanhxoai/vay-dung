/**
 * Lender safety check: is this name on the State Bank of Vietnam's list? Runs in the browser.
 *
 * What it can and can't say (compliance M9, M10):
 * - "on the list" is a fact about a NAME, not proof that whoever contacted you really is that lender.
 * - "not found" means we didn't find this name. It NEVER means "unlicensed" or "a scam":
 *   apps and brands may belong to a licensed lender under another name.
 */
import type { LicensedInstitution } from "@/lib/data/schema";
import { SIGNS, type SignId } from "./signs";

export type SafetyInstitution = Pick<
  LicensedInstitution,
  "id" | "name" | "legalName" | "legalNameEn" | "category" | "subtype" | "aliases" | "licenseNumber" | "website" | "sourceUrl"
>;

export type NameResult =
  | { kind: "empty" }
  | { kind: "licensed"; institution: SafetyInstitution; matchedWebsite: boolean }
  | { kind: "similar"; institutions: SafetyInstitution[] }
  | { kind: "not_found" };

export type NameFlag = "generic_name" | "too_easy";

export type SafetyResult = {
  name: NameResult;
  /** Wording in the typed name that's common in ads for risky loans. Never shown for an exact licensed match. */
  nameFlags: NameFlag[];
  highSigns: SignId[];
  mediumSigns: SignId[];
  level: "stop" | "careful" | "neutral";
};

/** Lowercase, no Vietnamese diacritics, words separated by single spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .trim();
}

const compact = (normalized: string) => normalized.replace(/ /g, "");

/** Legal-form phrases: "Ngân hàng TMCP Hàng Hải" and "Hàng Hải" are the same name to a user. */
const LEGAL_PHRASES = /\b(ngan hang|tmcp|thuong mai co phan|cong ty tai chinh|tai chinh|cong ty|tnhh|mot thanh vien|mtv|co phan|joint stock|commercial|bank|finance|viet nam|vietnam)\b/g;
const MIN_DISTINCT_NAME_LENGTH = 5;

function withoutLegalWords(normalized: string): string {
  return normalized.replace(LEGAL_PHRASES, " ").replace(/ /g, "");
}

function namesOf(i: SafetyInstitution): string[] {
  return [i.name, i.legalName, i.legalNameEn ?? "", ...i.aliases].filter(Boolean);
}

/** The hostname if the input looks like a web address, else null. */
export function hostnameOf(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (!/^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/.test(text)) return null;
  return text.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function websiteHost(url: string | null | undefined): string | null {
  return url ? new URL(url).hostname.replace(/^www\./, "") : null;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Typos and look-alikes: one character off, or two for longer names. Short names only match exactly. */
function looksLike(input: string, name: string): boolean {
  if (name.length < MIN_DISTINCT_NAME_LENGTH || input.length < MIN_DISTINCT_NAME_LENGTH) return false;
  const allowed = name.length >= 9 ? 2 : 1;
  return editDistance(input, name) <= allowed;
}

export function checkName(input: string, institutions: readonly SafetyInstitution[]): NameResult {
  const text = input.trim();
  if (text === "") return { kind: "empty" };

  const host = hostnameOf(text);
  if (host) {
    const byHost = institutions.find((i) => websiteHost(i.website) === host);
    if (byHost) return { kind: "licensed", institution: byHost, matchedWebsite: true };
  }

  const typed = normalize(host ?? text);
  const typedCompact = compact(typed);
  if (typedCompact === "") return { kind: "not_found" };

  // 1. Exact match on any known name, ignoring case, accents and spaces.
  if (!host) {
    const exact = institutions.find((i) => namesOf(i).some((n) => compact(normalize(n)) === typedCompact));
    if (exact) return { kind: "licensed", institution: exact, matchedWebsite: false };

    // "ngân hàng Hàng Hải" = "Hàng Hải": only when what's left is a distinctive name.
    const typedCore = withoutLegalWords(typed);
    if (typedCore.length >= MIN_DISTINCT_NAME_LENGTH) {
      const core = institutions.find((i) => namesOf(i).some((n) => withoutLegalWords(normalize(n)) === typedCore));
      if (core) return { kind: "licensed", institution: core, matchedWebsite: false };
    }
  }

  // 2. Not exact, but it uses or resembles a licensed name: a possible typo or impersonation.
  const tokens = new Set(typed.split(" "));
  const similar = institutions.filter((i) =>
    namesOf(i).some((n) => {
      const c = compact(normalize(n));
      if (c.length >= MIN_DISTINCT_NAME_LENGTH && typedCompact.includes(c)) return true;
      if (c.length >= 2 && c.length < MIN_DISTINCT_NAME_LENGTH && tokens.has(c)) return true;
      return looksLike(typedCompact, c);
    }),
  );
  if (similar.length > 0) return { kind: "similar", institutions: similar.slice(0, 3) };

  return { kind: "not_found" };
}

/**
 * Phrases common in ads for risky loans, matched on whole words. A hint to look closer only,
 * so nothing here is "high": licensed lenders use loose marketing words too.
 */
const NAME_PATTERNS: readonly { flag: NameFlag; phrases: readonly string[] }[] = [
  { flag: "too_easy", phrases: ["vay nong", "vay sieu toc", "no xau van vay", "khong can tham dinh", "khong tham dinh", "bao dau", "duyet 5 phut", "giai ngan 5 phut", "apk"] },
  { flag: "generic_name", phrases: ["vay nhanh", "vay tien nhanh", "vay tien online", "tien mat nhanh", "vay 247", "vay 24 7", "vay online"] },
];

export function nameFlags(input: string): NameFlag[] {
  const padded = ` ${normalize(input)} `;
  return NAME_PATTERNS.filter((p) => p.phrases.some((phrase) => padded.includes(` ${phrase} `))).map((p) => p.flag);
}

export function checkSafety(input: string, ticked: readonly SignId[], institutions: readonly SafetyInstitution[]): SafetyResult {
  const name = checkName(input, institutions);
  const flags = name.kind === "licensed" ? [] : nameFlags(input);
  const has = (severity: "high" | "medium") => SIGNS.filter((s) => s.severity === severity && ticked.includes(s.id)).map((s) => s.id);
  const highSigns = has("high");
  const mediumSigns = has("medium");

  let level: SafetyResult["level"] = "neutral";
  if (highSigns.length > 0) level = "stop";
  else if (mediumSigns.length > 0 || flags.length > 0 || name.kind === "similar" || name.kind === "not_found") level = "careful";

  return { name, nameFlags: flags, highSigns, mediumSigns, level };
}
