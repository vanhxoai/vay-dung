"use client";

import { useMemo, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AFFORDABILITY } from "@/config/affordability";
import { formatDate, formatMillions, formatPercent, formatRate, formatVnd, type AppLocale } from "@/lib/format";
import type { Offer, OfferRateNote } from "@/lib/recommend/offers";
import { recommend, type IneligibleReason, type Need } from "@/lib/recommend/recommend";
import { ChoiceGroup, SecondaryButton } from "./fields";
import { TERMS } from "./LoanFlow";
import { OfferCard } from "./OfferCard";

const VERDICT_STYLE = {
  ok: "border-emerald-700 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
  depends: "border-amber-700 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
  too_much: "border-red-700 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
  no_income: "border-red-700 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
} as const;

export function Results({
  need,
  offers,
  today,
  headingRef,
  onChangeTerm,
  onEdit,
  licensedAsOf,
  licensedUrl,
}: {
  need: Need;
  offers: Offer[];
  today: Date;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChangeTerm: (n: number) => void;
  onEdit: () => void;
  licensedAsOf: string;
  licensedUrl: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const rec = useMemo(() => recommend(need, offers, today), [need, offers, today]);
  const m = (n: number) => formatMillions(n, locale);

  const limit = formatPercent(AFFORDABILITY.maxDebtToIncome, locale);
  const common = {
    limit,
    max: formatVnd(rec.affordabilityOfBest.maxTotalPaymentVnd),
    debt: formatVnd(need.existingDebtVnd),
    headroom: formatVnd(rec.headroomVnd),
  };
  const principalOnly = Math.ceil(need.amountVnd / need.termMonths);
  const lowestPayment = rec.ranked.length > 0 ? Math.min(...rec.ranked.map((r) => r.low.maxPaymentVnd)) : null;

  let verdictBody: string;
  if (rec.verdict === "no_income") verdictBody = t("Verdict.no_income.body");
  else if (rec.verdict === "ok") verdictBody = t("Verdict.ok.body", common);
  else if (rec.verdict === "depends")
    verdictBody = rec.ranked.length > 0 ? t("Verdict.depends.body", common) : t("Verdict.depends.noOffers", common);
  else if (principalOnly + need.existingDebtVnd > rec.affordabilityOfBest.maxTotalPaymentVnd || lowestPayment === null)
    verdictBody = t("Verdict.too_much.body", { ...common, principalOnly: formatVnd(principalOnly) });
  else verdictBody = t("Verdict.too_much_with_interest.body", { ...common, lowestPayment: formatVnd(lowestPayment) });

  const showAlternatives = rec.verdict !== "ok";
  const best = rec.ranked[0];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {t("Results.title")}
        </h1>
        <p className="mt-1">{t("Results.summary", { amount: m(need.amountVnd), term: need.termMonths })}</p>
      </div>

      {/* The verdict always comes first and can't be dismissed. */}
      <section data-testid="verdict" data-verdict={rec.verdict} className={`rounded-lg border-2 p-4 ${VERDICT_STYLE[rec.verdict]}`}>
        <h2 className="text-lg font-bold">{t(`Verdict.${rec.verdict}.title`)}</h2>
        <p className="mt-2">{verdictBody}</p>
        {rec.verdict !== "no_income" ? <p className="mt-2 text-sm">{t("Verdict.guidelineNote", { limit })}</p> : null}
      </section>

      {showAlternatives ? (
        <section>
          <h2 className="font-bold">{t("Alternatives.title")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {rec.suggestedAmountVnd !== null && best ? (
              <li>
                {t("Alternatives.smaller", { amount: m(rec.suggestedAmountVnd), term: need.termMonths, lender: best.offer.lenderName })}
              </li>
            ) : null}
            {rec.verdict !== "no_income" ? <li>{t("Alternatives.longer")}</li> : null}
            {need.existingDebtVnd > 0 ? <li>{t("Alternatives.payDebt")}</li> : null}
            <li>{t("Alternatives.save")}</li>
            <li>{t("Alternatives.family")}</li>
            <li>{t("Alternatives.avoid")}</li>
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-bold">{t("Guidance.title")}</h2>
        <p className="mt-2">{t(`Guidance.${need.purpose}`)}</p>
        {need.urgency === "now" ? <p className="mt-2 font-medium">{t("Guidance.urgent")}</p> : null}
      </section>

      <ChoiceGroup
        inline
        label={t("Results.changeTerm")}
        options={TERMS.map((n) => ({ value: n as number, label: t("Flow.need.months", { n }) }))}
        value={need.termMonths}
        onChange={onChangeTerm}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">
          {rec.verdict === "too_much" || rec.verdict === "no_income" ? t("Results.offersTitleTooMuch") : t("Results.offersTitle")}
        </h2>
        {rec.ranked.length === 0 ? <p>{t("Results.noOffers")}</p> : null}
        {rec.ranked.map((r, i) => (
          <OfferCard key={r.offer.key} ranked={r} rank={i + 1} need={need} />
        ))}
      </section>

      <details className="rounded-lg border border-current/30 p-3" open>
        <summary className="min-h-8 cursor-pointer font-bold">{t("Results.whyTitle")}</summary>
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <p>{t("Results.why1")}</p>
          <p>{t("Results.why2")}</p>
          <p>{t("Results.why3")}</p>
          <p>
            {t("Results.why4", { date: formatDate(licensedAsOf) })}{" "}
            <a href={licensedUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {t("Results.whyLink")}
            </a>
          </p>
        </div>
      </details>

      <section data-testid="disclaimer" className="rounded-lg border border-current/30 p-3 text-sm">
        <h2 className="font-bold">{t("Results.disclaimerTitle")}</h2>
        <p className="mt-1">{t("Results.disclaimer")}</p>
      </section>

      {rec.ineligible.length > 0 ? (
        <details className="rounded-lg border border-current/30 p-3">
          <summary className="min-h-8 cursor-pointer font-bold">{t("Results.ineligibleTitle", { count: rec.ineligible.length })}</summary>
          <ul className="mt-2 flex flex-col gap-3 text-sm">
            {rec.ineligible.map(({ offer, reasons }) => (
              <li key={offer.key}>
                <p className="font-medium">
                  {offer.lenderName}: {locale === "en" && offer.nameEn ? offer.nameEn : offer.nameVi}
                </p>
                <ul className="list-disc pl-5">
                  {reasons.map((reason) => (
                    <li key={reason}>{t(`Results.reasons.${reason}`, { value: reasonValue(reason, offer, locale) })}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {rec.insufficientData.length > 0 ? (
        <details className="rounded-lg border border-current/30 p-3">
          <summary className="min-h-8 cursor-pointer font-bold">{t("Results.insufficientTitle", { count: rec.insufficientData.length })}</summary>
          <p className="mt-2 text-sm">{t("Results.insufficientIntro")}</p>
          <ul className="mt-2 flex flex-col gap-3 text-sm">
            {rec.insufficientData.map(({ offer, stale }) => (
              <li key={offer.key}>
                <p className="font-medium">
                  {offer.lenderName}: {locale === "en" && offer.nameEn ? offer.nameEn : offer.nameVi}
                </p>
                <p>{stale ? t("Results.staleReason") : (offer.excludeReason ?? t("Results.noRateReason"))}</p>
                {offer.rateNotes.map((n, i) => {
                  const text = rateNoteText(n, t, locale);
                  return text ? <p key={i}>{text}</p> : null;
                })}
                <p>
                  <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {t("Offer.source")}
                  </a>{" "}
                  · {t("Offer.checkedOn", { date: formatDate(offer.retrievedAt) })}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <SecondaryButton onClick={onEdit}>{t("Flow.edit")}</SecondaryButton>
    </div>
  );
}

function reasonValue(reason: IneligibleReason, o: Offer, locale: AppLocale): string {
  const money = (n: number | null) => (n === null ? "" : formatMillions(n, locale));
  switch (reason) {
    case "amount_too_low":
      return money(o.amountMinVnd);
    case "amount_too_high":
      return money(o.amountMaxVnd);
    case "term_too_short":
      return String(o.termMinMonths ?? "");
    case "term_too_long":
      return String(o.termMaxMonths ?? "");
    case "too_young":
      return String(o.minAge ?? "");
    case "too_old":
      return String(o.maxAge ?? "");
    case "income_too_low":
      return money(o.minMonthlyIncomeVnd);
    default:
      return "";
  }
}

export function rateNoteText(n: OfferRateNote, t: ReturnType<typeof useTranslations>, locale: AppLocale): string | null {
  const period = n.period === "monthly" ? t("Offer.perMonth") : n.period === "yearly" ? t("Offer.perYear") : "";
  const r = (x: number) => `${formatRate(x, locale)}%`;
  switch (n.kind) {
    case "advertised_floor":
      return n.minPercent === null ? null : t("Offer.floor", { rate: r(n.minPercent), period });
    case "regulatory_ceiling":
      return n.maxPercent === null ? null : t("Offer.ceiling", { rate: r(n.maxPercent), period });
    case "benchmark": {
      const lo = n.minPercent ?? n.maxPercent;
      const hi = n.maxPercent ?? n.minPercent;
      if (lo === null || hi === null) return null;
      return t("Offer.benchmark", { rate: lo === hi ? r(lo) : `${formatRate(lo, locale)}–${r(hi)}`, period });
    }
    case "offered_range":
      if (n.minPercent === null || n.maxPercent === null) return null;
      return t("Offer.otherRate", {
        segment: n.segment ?? "",
        min: formatRate(n.minPercent, locale),
        max: formatRate(n.maxPercent, locale),
        period,
      });
  }
}
