import { useLocale, useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { AFFORDABILITY } from "@/config/affordability";
import { Link } from "@/i18n/navigation";
import { computeLoanCost } from "@/lib/finance";
import { formatDate, formatMillions, formatPercent, type AppLocale } from "@/lib/format";
import { loadSnapshot } from "@/lib/store";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-1 flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** What each answer does. "changesOrder" must stay true to rankOffers and eligibilityProblems. */
const INPUTS = ["purpose", "amount", "term", "urgency", "income", "debt", "age", "proof"] as const;
const ORDER = ["fit", "proof", "floor", "cost", "tie"] as const;
const SOURCES = ["official", "lender_partner", "aggregator", "press"] as const;
const ASSUMPTIONS = ["basisBank", "basisFinance", "top", "promo", "general", "fees"] as const;
const LIMITS = ["rate", "secondary", "fees", "personal", "stale"] as const;

export default function RankingPage() {
  const t = useTranslations("Ranking");
  const tHome = useTranslations("Home");
  const locale = useLocale() as AppLocale;
  const { offers, dataAsOf } = loadSnapshot();

  const ranked = offers.filter((o) => !o.excludeFromRanking && o.rate !== null);
  const count = (type: (typeof SOURCES)[number]) => ranked.filter((o) => o.rate?.sourceType === type).length;
  const m = (n: number) => formatMillions(n, locale);
  // An illustration worked out by the cost engine, so it can't drift from it.
  const example = computeLoanCost({
    principalVnd: 20_000_000,
    termMonths: 24,
    rate: { percent: 1.5, basis: "flat", period: "monthly" },
    charges: [{ label: "fee", amountVnd: 400_000, timing: "deducted_from_payout" }],
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center font-bold">
          {tHome("title")}
        </Link>
        <LanguageLink href="/cach-xep-hang" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
          {tHome("switchLanguage")}
        </LanguageLink>
      </header>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("intro")}</p>

      <Section title={t("steps.title")}>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("steps.filter")}</li>
          <li>{t("steps.cost")}</li>
          <li>{t("steps.order")}</li>
          <li>{t("steps.verdict")}</li>
        </ol>
      </Section>

      <Section title={t("order.title")}>
        <p>{t("order.intro")}</p>
        <ol className="list-decimal space-y-1 pl-5">
          {ORDER.map((k) => (
            <li key={k}>{t(`order.${k}`)}</li>
          ))}
        </ol>
        <p>{t("order.feesRule")}</p>
        <p>{t("order.otherSorts")}</p>
      </Section>

      <Section title={t("inputs.title")}>
        <p>{t("inputs.intro")}</p>
        <table data-testid="inputs-table" className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-current/40 text-left align-bottom">
              <th scope="col" className="py-1 pr-2 font-semibold">{t("inputs.colInput")}</th>
              <th scope="col" className="py-1 pr-2 font-semibold">{t("inputs.colUse")}</th>
              <th scope="col" className="py-1 font-semibold">{t("inputs.colOrder")}</th>
            </tr>
          </thead>
          <tbody>
            {INPUTS.map((k) => (
              <tr key={k} className="border-b border-current/20 align-top">
                <th scope="row" className="py-1 pr-2 text-left font-medium">{t(`inputs.${k}.name`)}</th>
                <td className="py-1 pr-2">{t(`inputs.${k}.use`, { limit: formatPercent(AFFORDABILITY.maxDebtToIncome, locale) })}</td>
                <td className="py-1">{t(`inputs.${k}.order`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{t("inputs.privacy")}</p>
      </Section>

      <Section title={t("formula.title")}>
        <p>{t("formula.body")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("formula.received")}</li>
          <li>{t("formula.payments")}</li>
          <li>{t("formula.irr")}</li>
          <li>{t("formula.apr")}</li>
          <li>{t("formula.effective")}</li>
          <li>{t("formula.total")}</li>
        </ul>
        <p className="rounded-lg border border-current/30 p-3">
          {t("formula.example", {
            amount: m(20_000_000),
            fee: m(400_000),
            received: m(example.amountReceivedVnd),
            total: m(example.totalPaidVnd),
            cost: m(example.totalCostVnd),
            apr: formatPercent(example.aprNominal, locale),
          })}
        </p>
      </Section>

      <Section title={t("sources.title")}>
        <p>{t("sources.intro", { ranked: ranked.length, total: offers.length, date: formatDate(dataAsOf) })}</p>
        <ul className="list-disc space-y-1 pl-5">
          {SOURCES.map((k) => (
            <li key={k}>{t(`sources.${k}`, { count: count(k) })}</li>
          ))}
        </ul>
        <p>{t("sources.licensed")}</p>
        <Link href="/du-lieu" className="inline-flex min-h-11 items-center self-start underline underline-offset-2">
          {t("sources.seeData")}
        </Link>
      </Section>

      <Section title={t("assumptions.title")}>
        <ul className="list-disc space-y-1 pl-5">
          {ASSUMPTIONS.map((k) => (
            <li key={k}>{t(`assumptions.${k}`)}</li>
          ))}
        </ul>
      </Section>

      <Section title={t("notUsed.title")}>
        <p>{t("notUsed.money")}</p>
        <p>{t("notUsed.approval")}</p>
      </Section>

      <Section title={t("limits.title")}>
        <ul className="list-disc space-y-1 pl-5">
          {LIMITS.map((k) => (
            <li key={k}>{t(`limits.${k}`)}</li>
          ))}
        </ul>
      </Section>

      <Link href="/vay" className="inline-flex min-h-11 items-center self-start underline underline-offset-2">
        {t("tryIt")}
      </Link>
    </main>
  );
}
