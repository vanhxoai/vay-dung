import { formatRate, type AppLocale } from "@/lib/format";
import type { OfferRate } from "@/lib/recommend/offers";

type T = (key: string, values?: Record<string, string | number>) => string;

/** The published rate as a borrower reads it. `t` is scoped to the "Offer" messages. */
export function advertisedRate(rate: OfferRate, t: T, locale: AppLocale): string {
  const period = rate.period === "monthly" ? t("perMonth") : t("perYear");
  const max = `${formatRate(rate.maxPercent, locale)}%${period}`;
  if (rate.floorOnly) return t("fromRate", { rate: max });
  // A minimum we don't cost isn't shown as a price: the card says only "up to".
  if (rate.minUnconfirmed || rate.minIsPromotional) return t("upTo", { rate: max });
  if (rate.minPercent === rate.maxPercent) return max;
  return `${formatRate(rate.minPercent, locale)}–${max}`;
}
