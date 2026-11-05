import { useLocale, useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { advertisedRate } from "@/components/loan/rateText";
import { Link } from "@/i18n/navigation";
import { formatDate, type AppLocale } from "@/lib/format";
import { loadSnapshot } from "@/lib/store";

const linkClass = "inline-flex min-h-11 items-center underline underline-offset-2";

export default function DataPage() {
  const t = useTranslations("Data");
  const tOffer = useTranslations("Offer");
  const tResults = useTranslations("Results");
  const tHome = useTranslations("Home");
  const tSummary = useTranslations("Summary");
  const locale = useLocale() as AppLocale;
  const en = locale === "en";
  const { offers, dataAsOf } = loadSnapshot();

  const isRanked = (o: (typeof offers)[number]) => !o.excludeFromRanking && o.rate !== null;
  const lenders = [...new Set(offers.map((o) => o.lenderName))].sort((a, b) => a.localeCompare(b, "vi"));
  const secondary = offers.filter((o) => isRanked(o) && o.rate?.sourceType !== "official").length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center font-bold">
          {tHome("title")}
        </Link>
        <LanguageLink href="/du-lieu" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
          {tHome("switchLanguage")}
        </LanguageLink>
      </header>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("intro", { total: offers.length, lenders: lenders.length, ranked: offers.filter(isRanked).length, secondary, date: formatDate(dataAsOf) })}</p>
      <p className="flex flex-wrap gap-x-4">
        {/* A plain link: a static file outside the locale routes. */}
        <a href="/data/loan-rates.csv" download className={linkClass}>
          {t("download")}
        </a>
        <Link href="/cach-xep-hang" className={linkClass}>
          {t("howRanked")}
        </Link>
      </p>

      {lenders.map((name) => (
        <section key={name}>
          <h2 className="font-bold">{name}</h2>
          <ul className="mt-1 flex flex-col gap-3 text-sm">
            {offers
              .filter((o) => o.lenderName === name)
              .map((o) => (
                <li key={o.key} data-data-row={o.key} className="border-b border-current/20 pb-2">
                  <p className="font-medium">{en && o.nameEn ? o.nameEn : o.nameVi}</p>
                  {o.rate ? (
                    <p>
                      {advertisedRate(o.rate, tOffer, locale)}, {o.rate.basis === "flat" ? tOffer("basisFlat") : tOffer("basisReducing")}
                      {o.rate.basisInferred ? ` (${t("basisAssumed")})` : ""}
                    </p>
                  ) : (
                    <p>{t("noRate")}</p>
                  )}
                  <p>{o.rate ? tSummary(`source.${o.rate.sourceType}`) : null}{o.rate?.scope === "lender_general" ? ` · ${t("lenderGeneral")}` : ""}</p>
                  {o.rate?.oldDocumentDate ? <p>{tOffer("documentDate", { date: formatDate(o.rate.oldDocumentDate) })}</p> : null}
                  {o.rate && o.rate.sourceType !== "official" && !o.rate.oldDocumentDate ? <p>{tOffer("sourceUndated")}</p> : null}
                  <p>{isRanked(o) ? t("ranked") : o.excludeCode ? tResults(`exclude.${o.excludeCode}`) : t("notRanked")}</p>
                  <p>
                    <a href={o.rate?.sourceUrl ?? o.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {o.rate ? o.rate.sourceName : tOffer("source")}
                    </a>{" "}
                    · {t("readOn", { date: formatDate(o.rate?.retrievedAt ?? o.oldestRetrievedAt) })}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
