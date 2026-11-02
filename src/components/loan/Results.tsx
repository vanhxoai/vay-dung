"use client";

import { useMemo, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AFFORDABILITY } from "@/config/affordability";
import { Link as IntlLink } from "@/i18n/navigation";
import { formatDate, formatLoanAmount, formatMillions, formatPercent, formatRate, formatVnd, type AppLocale } from "@/lib/format";
import type { Offer, OfferRateNote } from "@/lib/recommend/offers";
import { recommend, type IneligibleReason, type Need } from "@/lib/recommend/recommend";
import { ChoiceGroup, SecondaryButton } from "./fields";
import { TERMS } from "./terms";
import { OfferCard } from "./OfferCard";

const VERDICT_STYLE = {
  ok: "border-emerald-700 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
  depends: "border-amber-700 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
  no_data: "border-amber-700 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
  too_much: "border-red-700 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
  no_income: "border-red-700 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
} as const;

const linkClass = "inline-flex min-h-11 items-center underline underline-offset-2";

export function Results({
  need,
  offers,
  today,
  headingRef,
  onChangeTerm,
  onEdit,
  licensedAsOf,
  licensedSources,
}: {
  need: Need;
  offers: Offer[];
  today: Date;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChangeTerm: (n: number) => void;
  onEdit: () => void;
  licensedAsOf: string;
  licensedSources: { title: string; url: string }[];
}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const rec = useMemo(() => recommend(need, offers, today), [need, offers, today]);
  const m = (n: number) => formatMillions(n, locale);

  const limit = formatPercent(AFFORDABILITY.maxDebtToIncome, locale);
  const maxTotal = rec.affordabilityOfBest.maxTotalPaymentVnd;
  const common = {
    limit,
    max: formatVnd(maxTotal),
    debt: formatVnd(need.existingDebtVnd),
    headroom: formatVnd(rec.headroomVnd),
  };
  const principalOnly = formatVnd(rec.principalOnlyVnd);
  const lowestPayment = rec.ranked.length > 0 ? Math.min(...rec.ranked.map((r) => r.low.maxPaymentVnd)) : null;

  let verdictBody: string;
  if (rec.verdict === "no_income") verdictBody = t("Verdict.no_income.body");
  else if (rec.verdict === "ok") verdictBody = t("Verdict.ok.body", common);
  else if (rec.verdict === "depends") verdictBody = t("Verdict.depends.body", common);
  else if (rec.verdict === "no_data") verdictBody = t("Verdict.no_data.body", { ...common, principalOnly });
  else if (rec.principalOnlyVnd + need.existingDebtVnd > maxTotal || lowestPayment === null)
    verdictBody = t("Verdict.too_much.body", { ...common, principalOnly });
  else verdictBody = t("Verdict.too_much_with_interest.body", { ...common, lowestPayment: formatVnd(lowestPayment) });

  const showAlternatives = rec.verdict === "depends" || rec.verdict === "too_much" || rec.verdict === "no_income" || rec.verdict === "no_data";
  const allTooYoung = rec.verdict === "no_data" && rec.ineligible.length > 0 && rec.ineligible.every((i) => i.reasons.includes("too_young"));
  const best = rec.ranked[0];
  const longestTerm = TERMS[TERMS.length - 1];
  // Only offer "repay longer" if it could actually bring the principal within reach.
  const longerCouldHelp = need.termMonths < longestTerm && Math.ceil(need.amountVnd / longestTerm) <= rec.headroomVnd;
  const verdictIsNegative = rec.verdict === "too_much" || rec.verdict === "no_income";

  const offerCards = rec.ranked.map((r, i) => (
    <OfferCard key={r.offer.key} ranked={r} rank={i + 1} need={need} showRank={!verdictIsNegative} />
  ));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {t("Results.title")}
        </h1>
        <p className="mt-1">{t("Results.summary", { amount: formatLoanAmount(need.amountVnd, locale), term: need.termMonths })}</p>
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={onEdit} className={linkClass}>
            {t("Flow.edit")}
          </button>
          {rec.ranked.length > 0 && rec.verdict !== "no_income" ? (
            <a href="#offers" className={linkClass}>
              {rec.verdict === "too_much" ? t("Results.showOffersNoIncome") : t("Results.jumpToOffers", { count: rec.ranked.length })}
            </a>
          ) : null}
        </div>
      </div>

      {/* The verdict always comes first and can't be dismissed. */}
      <section role="status" data-testid="verdict" data-verdict={rec.verdict} className={`rounded-lg border-2 p-4 ${VERDICT_STYLE[rec.verdict]}`}>
        <h2 className="text-lg font-bold">{t(`Verdict.${rec.verdict}.title`)}</h2>
        <p className="mt-2">{verdictBody}</p>
        {allTooYoung ? <p className="mt-2 font-medium">{t("Verdict.no_data.tooYoung")}</p> : null}
        {rec.verdict === "ok" && rec.someDontFit ? <p className="mt-2">{t("Verdict.ok.someOnly")}</p> : null}
        {rec.verdict !== "no_income" ? <p className="mt-2 text-sm">{t("Verdict.guidelineNote", { limit })}</p> : null}
      </section>

      <p data-testid="disclaimer-short" className="text-sm">
        {t("Results.disclaimerShort")}
      </p>

      {showAlternatives ? (
        <section>
          <h2 className="font-bold">{t("Alternatives.title")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {rec.suggestedAmountVnd !== null && best ? (
              <li>
                {t("Alternatives.smaller", { amount: m(rec.suggestedAmountVnd), term: need.termMonths, lender: best.offer.lenderName })}
              </li>
            ) : null}
            {longerCouldHelp && !allTooYoung ? <li>{t("Alternatives.longer")}</li> : null}
            {need.existingDebtVnd > 0 ? <li>{t("Alternatives.payDebt")}</li> : null}
            <li>{t("Alternatives.save")}</li>
            <li>{rec.verdict === "no_income" ? t("Alternatives.familyNoIncome") : t("Alternatives.family")}</li>
            <li>{t("Alternatives.avoid")}</li>
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-bold">{t("Guidance.title")}</h2>
        <p className="mt-2">{t(`Guidance.${need.purpose}`)}</p>
        {need.urgency === "now" ? <p className="mt-2 font-medium">{t("Guidance.urgent")}</p> : null}
      </section>

      <div>
        <ChoiceGroup
          inline
          label={t("Results.changeTerm")}
          options={TERMS.map((n) => ({ value: n as number, label: t("Flow.need.months", { n }) }))}
          value={need.termMonths}
          onChange={onChangeTerm}
        />
        {/* The verdict can change with the term, and it's off-screen here. */}
        <p className="mt-2 text-sm font-medium">{t(`Verdict.${rec.verdict}.title`)}</p>
      </div>

      <section id="offers" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="font-bold">{verdictIsNegative ? t("Results.offersTitleTooMuch") : t("Results.offersTitle")}</h2>
        {rec.ranked.length === 0 ? <p>{t("Results.noOffers")}</p> : null}
        {rec.verdict === "no_income" && rec.ranked.length > 0 ? (
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-2">{t("Results.showOffersNoIncome")}</summary>
            <div className="mt-2 flex flex-col gap-3">{offerCards}</div>
          </details>
        ) : (
          offerCards
        )}
      </section>

      <details className="rounded-lg border border-current/30 px-3 py-1">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold">{t("Results.whyTitle")}</summary>
        <div className="mt-1 flex flex-col gap-2 pb-2 text-sm">
          <p>{t("Results.why1")}</p>
          <p>{t("Results.why2")}</p>
          <p>{t("Results.why3")}</p>
          <p>{t("Results.why4", { date: formatDate(licensedAsOf) })}</p>
          <ul className="list-disc pl-5">
            {licensedSources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <section data-testid="disclaimer" className="rounded-lg border border-current/30 p-3 text-sm">
        <h2 className="font-bold">{t("Results.disclaimerTitle")}</h2>
        <p className="mt-1">{t("Results.disclaimer")}</p>
      </section>

      {rec.ineligible.length > 0 ? (
        <details className="rounded-lg border border-current/30 px-3 py-1">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold">{t("Results.ineligibleTitle", { count: rec.ineligible.length })}</summary>
          <ul className="mt-1 flex flex-col gap-3 pb-2 text-sm">
            {rec.ineligible.map(({ offer, reasons }) => (
              <li key={offer.key}>
                <p className="font-medium">
                  {offer.lenderName}: {locale === "en" && offer.nameEn ? offer.nameEn : offer.nameVi}
                </p>
                <ul className="list-disc pl-5">
                  {reasons.map((reason) => (
                    <li key={reason}>
                      {reason === "too_old" && offer.maxAgeAtLoanEnd
                        ? t("Results.reasons.too_old_at_end", { value: String(offer.maxAge ?? "") })
                        : t(`Results.reasons.${reason}`, { value: reasonValue(reason, offer, locale) })}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {rec.insufficientData.length > 0 ? (
        <details className="rounded-lg border border-current/30 px-3 py-1">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold">{t("Results.insufficientTitle", { count: rec.insufficientData.length })}</summary>
          <p className="mt-1 text-sm">{t("Results.insufficientIntro")}</p>
          <ul className="mt-2 flex flex-col gap-3 pb-2 text-sm">
            {rec.insufficientData.map(({ offer, stale }) => (
              <li key={offer.key}>
                <p className="font-medium">
                  {offer.lenderName}: {locale === "en" && offer.nameEn ? offer.nameEn : offer.nameVi}
                </p>
                <p>{stale || offer.excludeCode === null ? t("Results.staleReason") : t(`Results.exclude.${offer.excludeCode}`)}</p>
                {offer.rateNotes.map((n, i) => {
                  const text = rateNoteText(n, t, locale);
                  return text ? (
                    <p key={i}>
                      {text}
                      {n.oldDocumentDate ? <span className="block">{t("Offer.documentDate", { date: formatDate(n.oldDocumentDate) })}</span> : null}
                    </p>
                  ) : null;
                })}
                <p>
                  <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {t("Offer.source")}
                  </a>{" "}
                  · {t("Offer.checkedOn", { date: formatDate(offer.oldestRetrievedAt) })}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <IntlLink href="/kiem-tra" className={linkClass}>
        {t("Results.checkLender")}
      </IntlLink>

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

/** A published rate that isn't this user's cost. It always states its basis and period. */
export function rateNoteText(n: OfferRateNote, t: ReturnType<typeof useTranslations>, locale: AppLocale): string | null {
  const period = n.period === "monthly" ? t("Offer.perMonth") : n.period === "yearly" ? t("Offer.perYear") : "";
  const parts = [n.basis === "flat" ? t("Offer.basisFlat") : n.basis === "reducing" ? t("Offer.basisReducing") : t("Offer.basisUnknown")];
  if (n.period === "unknown") parts.push(t("Offer.periodUnknown"));
  const basis = parts.join(", ");
  const r = (x: number) => `${formatRate(x, locale)}%`;
  switch (n.kind) {
    case "advertised_floor":
      return n.minPercent === null ? null : t("Offer.floor", { rate: r(n.minPercent), period, basis });
    case "regulatory_ceiling":
      return n.maxPercent === null ? null : t("Offer.ceiling", { rate: r(n.maxPercent), period, basis });
    case "benchmark": {
      const lo = n.minPercent ?? n.maxPercent;
      const hi = n.maxPercent ?? n.minPercent;
      if (lo === null || hi === null) return null;
      return t("Offer.benchmark", { rate: lo === hi ? r(lo) : `${formatRate(lo, locale)}–${r(hi)}`, period, basis });
    }
    case "offered_range":
      if (n.minPercent === null || n.maxPercent === null) return null;
      return t("Offer.otherRate", {
        segment: n.segment ?? "",
        min: formatRate(n.minPercent, locale),
        max: formatRate(n.maxPercent, locale),
        period,
        basis,
      });
  }
}
