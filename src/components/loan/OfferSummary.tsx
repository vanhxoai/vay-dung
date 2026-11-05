"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMillions, formatPercent, type AppLocale } from "@/lib/format";
import type { RankedOffer } from "@/lib/recommend/recommend";

/** The whole ranking at a glance. Figures are at the high end, the number the order is built on. */
export function OfferSummary({ ranked, onPick }: { ranked: RankedOffer[]; onPick: (key: string) => void }) {
  const t = useTranslations("Summary");
  const locale = useLocale() as AppLocale;
  const en = locale === "en";
  const firstFloor = ranked.findIndex((r) => r.offer.rate?.floorOnly);
  return (
    <table data-testid="summary-table" className="w-full border-collapse text-sm">
      <caption className="pb-2 text-left">{t("caption")}</caption>
      <thead>
        <tr className="border-b border-current/40 text-left align-bottom">
          <th scope="col" className="w-7 py-1 pr-1 font-semibold">{t("rank")}</th>
          <th scope="col" className="py-1 pr-2 font-semibold">{t("loan")}</th>
          <th scope="col" className="py-1 pr-2 text-right font-semibold">{t("monthly")}</th>
          <th scope="col" className="py-1 text-right font-semibold">{t("apr")}</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((r, i) => {
          const floor = r.offer.rate?.floorOnly;
          const from = (s: string) => (floor ? t("from", { value: s }) : s);
          return [
            i === firstFloor && i > 0 ? (
              <tr key="floor-note">
                <td colSpan={4} className="border-b border-current/20 pt-3 pb-1 font-medium">{t("floorDivider")}</td>
              </tr>
            ) : null,
            <tr key={r.offer.key} data-summary={r.offer.key} className="border-b border-current/20 align-top">
              <td className="py-1 pr-1">{i + 1}</td>
              <td className="py-1 pr-2">
                <button type="button" onClick={() => onPick(r.offer.key)} className="min-h-11 text-left underline underline-offset-2">
                  <span className="font-medium">{r.offer.lenderName}</span>
                  <span className="block">{en && r.offer.nameEn ? r.offer.nameEn : r.offer.nameVi}</span>
                </button>
                <span className="block opacity-75">{t(`source.${r.offer.rate?.sourceType ?? "official"}`)}</span>
              </td>
              <td className="py-1 pr-2 text-right">{from(formatMillions(r.high.maxPaymentVnd, locale))}</td>
              <td className="py-1 text-right">{from(formatPercent(r.high.aprNominal, locale))}</td>
            </tr>,
          ];
        })}
      </tbody>
    </table>
  );
}
