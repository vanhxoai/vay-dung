/** Display formatting. Rounding here is for display only; calculations stay in whole VND. */

export type AppLocale = "vi" | "en";

/** Formats an integer VND amount Vietnamese-style, e.g. 20000000 → "20.000.000 ₫". */
export function formatVnd(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`VND amounts must be integers, got ${amount}`);
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

const LOCALE_TAG: Record<AppLocale, string> = { vi: "vi-VN", en: "en-GB" };

function oneDecimal(x: number, locale: AppLocale): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], { maximumFractionDigits: 1 }).format(x);
}

/** Plain words: 27_400_000 → "27,4 triệu" / "27.4 million"; below 1 million, the exact amount. */
export function formatMillions(amount: number, locale: AppLocale): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${oneDecimal(amount / 1_000_000_000, locale)} ${locale === "vi" ? "tỷ" : "billion"}`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${oneDecimal(amount / 1_000_000, locale)} ${locale === "vi" ? "triệu" : "million"}`;
  }
  return formatVnd(amount);
}

/** "x triệu" only when that's exact, so a loan amount never disagrees with the full figure next to it. */
export function formatLoanAmount(amount: number, locale: AppLocale): string {
  const step = Math.abs(amount) >= 1_000_000_000 ? 100_000_000 : 100_000;
  return amount % step === 0 ? formatMillions(amount, locale) : formatVnd(amount);
}

/** 0.309 → "30,9%" / "30.9%". */
export function formatPercent(fraction: number, locale: AppLocale): string {
  return `${oneDecimal(fraction * 100, locale)}%`;
}

/** A published rate as printed by the lender: 1.41 → "1,41" (keeps its decimals). */
export function formatRate(percent: number, locale: AppLocale): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], { maximumFractionDigits: 4 }).format(percent);
}

/** "2026-11-01" → "01/11/2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * What the user typed → a whole number, or null if it isn't clearly one.
 * Accepts "20.000.000" and "20,000,000". Anything else ("15tr", "-5") is null, so the form
 * can ask again rather than silently misread it.
 */
export function parseMoneyInput(text: string): number | null {
  if (!isPlainMoneyText(text)) return null;
  const digits = text.replace(/\D/g, "");
  if (digits === "") return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Only digits and separators, so it can safely be reformatted while typing. */
export function isPlainMoneyText(text: string): boolean {
  return /^[\d.,\s]*$/.test(text);
}

/** 20000000 → "20.000.000", for inputs. */
export function formatMoneyInput(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}
