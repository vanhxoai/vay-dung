"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatLoanAmount, formatMillions, formatPercent, formatRate, formatVnd, type AppLocale } from "@/lib/format";
import type { OfferFee } from "@/lib/recommend/offers";
import type { Need, RankedOffer } from "@/lib/recommend/recommend";
import { rateNoteText } from "./Results";

const FIT_STYLE = {
  fits: "text-emerald-800 dark:text-emerald-300",
  fits_fees_unknown: "text-amber-800 dark:text-amber-300",
  fits_reference: "text-amber-800 dark:text-amber-300",
  too_much_at_max: "text-red-800 dark:text-red-300",
  fits_only_low: "text-amber-800 dark:text-amber-300",
  too_much: "text-red-800 dark:text-red-300",
} as const;

const notice = "rounded bg-amber-100 px-2 py-1 text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50";
const linkClass = "inline-flex min-h-11 items-center underline underline-offset-2";

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm opacity-75">{label}</dt>
      <dd className="font-semibold">
        {value}
        {note ? <span className="block text-sm font-normal opacity-75">({note})</span> : null}
      </dd>
    </div>
  );
}

function range(a: string, b: string): string {
  return a === b ? a : `${a} – ${b}`;
}

export function OfferCard({ ranked, rank, need, showRank }: { ranked: RankedOffer; rank: number; need: Need; showRank: boolean }) {
  const t = useTranslations("Offer");
  const tRoot = useTranslations();
  const locale = useLocale() as AppLocale;
  const { offer, low, high, fit } = ranked;
  const rate = offer.rate as NonNullable<typeof offer.rate>;
  const m = (n: number) => formatMillions(n, locale);
  const en = locale === "en";

  const period = rate.period === "monthly" ? t("perMonth") : t("perYear");
  // A minimum we don't cost isn't shown as a price: the card says only "up to".
  const advertised = rate.minUnconfirmed
    ? t("upTo", { rate: `${formatRate(rate.maxPercent, locale)}%${period}` })
    : rate.minPercent === rate.maxPercent
      ? `${formatRate(rate.minPercent, locale)}%${period}`
      : `${formatRate(rate.minPercent, locale)}–${formatRate(rate.maxPercent, locale)}%${period}`;
  const falling = high.firstPaymentVnd - high.lastPaymentVnd > need.termMonths * 10;
  const unknownLimits =
    offer.amountMinVnd === null || offer.amountMaxVnd === null || offer.termMinMonths === null || offer.termMaxMonths === null;
  // Costed at the top of a range: a statement about the published maximum, not about this borrower's rate.
  const atMax = rate.minIsPromotional || rate.minUnconfirmed;
  const fitLabel =
    fit === "fits" && rate.maxIsReference ? "fits_reference" : fit === "too_much" && atMax ? "too_much_at_max" : fit === "fits" && ranked.feesAllUnknown ? "fits_fees_unknown" : fit;
  // Different amounts can round to the same "x triệu"; a real range must still look like one.
  const totalPaid =
    low.totalPaidVnd !== high.totalPaidVnd && m(low.totalPaidVnd) === m(high.totalPaidVnd)
      ? range(formatVnd(low.totalPaidVnd), formatVnd(high.totalPaidVnd))
      : range(m(low.totalPaidVnd), m(high.totalPaidVnd));
  const repaymentAssumed = offer.rate?.basis === "reducing" && (offer.amortizationInferred || offer.amortization === null);

  const feeText = (f: OfferFee): string => {
    const parts: string[] = [];
    if (f.greaterOfRemainingInterest && f.percent !== null) parts.push(t("feeGreater", { percent: formatRate(f.percent, locale) }));
    else if (f.tiers) {
      parts.push(
        f.tiers
          .map((x) =>
            x.to === null
              ? t("feeTiersOpen", { percent: formatRate(x.percent, locale), from: x.from ?? 0, unit: t(`unit.${x.unit}`) })
              : t("feeTiers", { percent: formatRate(x.percent, locale), from: x.from ?? 0, to: x.to, unit: t(`unit.${x.unit}`) }),
          )
          .join("; "),
      );
    } else if (f.percent !== null) parts.push(`${formatRate(f.percent, locale)}%`);
    if (f.fixedVnd !== null) parts.push(t("feeFixed", { amount: formatVnd(f.fixedVnd) }));
    if (f.minVnd !== null) parts.push(t("feeMin", { amount: formatVnd(f.minVnd) }));
    if (f.maxVnd !== null) parts.push(t("feeMax", { amount: formatVnd(f.maxVnd) }));
    return `${en && f.nameEn ? f.nameEn : f.nameVi}: ${parts.join(", ")}`;
  };

  // The rate's own source first, then every other source behind the card's figures.
  const sources = [rate.sourceUrl, ...offer.sourceUrls.filter((u) => u !== rate.sourceUrl)];

  return (
    <article data-testid="offer" data-offer={offer.key} className="flex flex-col gap-3 rounded-lg border border-current/30 p-4">
      <header>
        {showRank ? <p className="text-sm opacity-75">{t("rank", { n: rank })}</p> : null}
        <h3 className="text-lg font-bold">{offer.lenderName}</h3>
        <p>{en && offer.nameEn ? offer.nameEn : offer.nameVi}</p>
        {rate.segment ? <p className="text-sm opacity-75">{t("segment", { segment: rate.segment })}</p> : null}
        <p className={`mt-1 font-medium ${FIT_STYLE[fitLabel]}`}>{t(`fit.${fitLabel}`)}</p>
      </header>

      {offer.confidence === "low" ? <p className={notice}>{t("lowConfidence")}</p> : null}
      {rate.minIsPromotional ? <p className={notice}>{t("promoLow")}</p> : null}
      {offer.borrowerNotes?.map((n) => <p key={n.vi} className={notice}>{en ? n.en : n.vi}</p>)}
      {ranked.feesAllUnknown ? <p className={notice}>{t("feesUnknown")}</p> : null}
      {ranked.needsIncomeProofNote ? <p className={notice}>{t("incomeProofNote")}</p> : null}
      {offer.conflictFields.length > 0 ? <p className={notice}>{t("conflict")}</p> : null}
      {offer.existingCustomerRequired ? <p className={notice}>{t("existingCustomer")}</p> : null}
      {offer.employerRestriction ? <p className={notice}>{t("employer", { value: offer.employerRestriction })}</p> : null}
      {unknownLimits ? <p className={notice}>{t("unknownLimits")}</p> : null}
      {offer.minAge === null && offer.maxAge === null ? <p className={notice}>{t("ageUnknown")}</p> : null}

      <p>{t(atMax ? "sentenceAtMax" : "sentence", { amount: formatLoanAmount(need.amountVnd, locale), total: totalPaid, term: need.termMonths })}</p>

      <dl className="flex flex-col gap-2">
        <Row label={offer.goods ? t("receivedGoods") : t("received")} value={range(formatVnd(low.amountReceivedVnd), formatVnd(high.amountReceivedVnd))} />
        <Row
          label={falling ? t("monthlyFalling") : t("monthly")}
          value={range(formatVnd(low.firstPaymentVnd), formatVnd(high.firstPaymentVnd))}
        />
        {falling ? <Row label={t("lastMonth")} value={range(formatVnd(low.lastPaymentVnd), formatVnd(high.lastPaymentVnd))} /> : null}
        <Row label={t("cost")} value={range(formatVnd(low.totalCostVnd), formatVnd(high.totalCostVnd))} />
        <Row
          label={t("realApr")}
          value={`${range(formatPercent(low.aprNominal, locale), formatPercent(high.aprNominal, locale))}${t("perYear")}`}
          note={atMax ? t("realAprNoteAtMax") : t("realAprNote")}
        />
        <div className="flex flex-col">
          <dt className="text-sm opacity-75">{t("advertised")}</dt>
          <dd>
            {advertised}, {rate.basis === "flat" ? t("basisFlat") : t("basisReducing")}
            {rate.basisInferred ? <span className="block text-sm opacity-75">({t("assumption")})</span> : null}
            {rate.oldDocumentDate ? <span className="block text-sm opacity-75">{t("documentDate", { date: formatDate(rate.oldDocumentDate) })}</span> : null}
            {repaymentAssumed ? <span className="block text-sm opacity-75">{t("repaymentAssumption")}</span> : null}
            <span className="block">
              <a href={rate.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${linkClass} text-sm`}>
                {t("rateSource")}
              </a>
            </span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1 text-sm">
        {offer.monthlyFees.map((f) => (
          <p key={f.nameVi}>{t("monthlyFeesIncluded", { name: en && f.nameEn ? f.nameEn : f.nameVi, amount: formatVnd(f.amountVnd) })}</p>
        ))}
        {offer.uncostedFees.length > 0 ? <p>{t("uncosted", { names: offer.uncostedFees.join(", ") })}</p> : null}
        {offer.feesCompleteness !== "complete" && !ranked.feesAllUnknown ? <p>{t("feesPartial")}</p> : null}
        {ranked.insuranceCosts.map((i) => {
          const key = i.mandatory === false ? (i.collectionKnown ? "insuranceOptional" : "insuranceOptionalUnknownCollection") : "insuranceUnclear";
          return (
            <p key={i.nameVi}>
              {t(key, {
                name: en && i.nameEn ? i.nameEn : i.nameVi,
                min: formatVnd(i.minVnd),
                max: formatVnd(i.maxVnd),
                cost: formatVnd(i.costHigh.totalCostVnd),
              })}
            </p>
          );
        })}
        {ranked.mandatoryCollectionAssumed ? <p>{t("insuranceMandatoryAssumed")}</p> : null}
        {ranked.insuranceUnknownPremium.length > 0 ? <p>{t("insuranceUnknown", { names: ranked.insuranceUnknownPremium.join(", ") })}</p> : null}
        {offer.insurance.length === 0 ? <p>{t("insuranceNone")}</p> : null}
      </div>

      <div className="rounded border border-current/30 p-2 text-sm">
        <h4 className="font-semibold">{t("lateTitle")}</h4>
        <p>{(en ? offer.lateTextEn : null) ?? offer.lateTextVi ?? t("lateUnknown")}</p>
      </div>

      <details>
        <summary className="flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-2">{t("detailsTitle")}</summary>
        <div className="mt-1 flex flex-col gap-2 text-sm">
          {en ? <p className="opacity-75">{t("viSourceNote")}</p> : null}
          <p>
            {t("effective")}: {range(formatPercent(low.aprEffective, locale), formatPercent(high.aprEffective, locale))}
            {t("perYear")}
          </p>
          {offer.rateNotes.map((n, i) => {
            // A bank-wide average or a reference rate would read as this product's price.
            const text = n.kind === "benchmark" ? null : rateNoteText(n, tRoot, locale);
            return text ? (
              <p key={i}>
                {text}
                {n.oldDocumentDate ? <span className="block">{t("documentDate", { date: formatDate(n.oldDocumentDate) })}</span> : null}
              </p>
            ) : null;
          })}
          {offer.otherFees.length > 0 ? (
            <div>
              <p className="font-medium">{t("otherFeesTitle")}</p>
              <ul className="list-disc pl-5">
                {offer.otherFees.map((f) => (
                  <li key={f.nameVi}>{feeText(f)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            {t("documents")}: {offer.documents?.join("; ") ?? t("documentsUnknown")}
          </p>
          {offer.otherConditions && offer.otherConditions.length > 0 ? (
            <div>
              <p className="font-medium">{t("conditions")}</p>
              <ul className="list-disc pl-5">
                {offer.otherConditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            {t("legalName")}: {offer.legalName}. {t("licensed")}.
          </p>
        </div>
      </details>

      <p className="flex flex-wrap items-center gap-x-3 text-sm">
        {sources.map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {i === 0 ? t("source") : t("sourceN", { n: i + 1 })}
          </a>
        ))}
        <span>{t("checkedOn", { date: formatDate(offer.oldestRetrievedAt) })}</span>
      </p>
    </article>
  );
}
