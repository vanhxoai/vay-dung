import { useLocale, useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { WaitlistForm } from "@/components/landing/WaitlistForm";
import { isWaitlistEnabled } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { computeLoanCost } from "@/lib/finance";
import { formatMillions, formatPercent, type AppLocale } from "@/lib/format";

export default function HomePage() {
  const t = useTranslations("Home");
  const locale = useLocale() as AppLocale;
  const waitlistOn = isWaitlistEnabled();

  // An illustration, not a lender's offer: worked out by the cost engine, so it can't drift from it.
  const example = computeLoanCost({ principalVnd: 24_000_000, termMonths: 24, rate: { percent: 1.5, basis: "flat", period: "monthly" } });
  const m = (n: number) => formatMillions(n, locale);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <p className="font-bold">{t("title")}</p>
        <LanguageLink href="/" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
          {t("switchLanguage")}
        </LanguageLink>
      </header>

      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">{t("headline")}</h1>
        <p className="text-lg">{t("tagline")}</p>
        <Link
          href="/vay"
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900"
        >
          {t("start")}
        </Link>
        <Link href="/kiem-tra" className="inline-flex min-h-11 items-center justify-center underline underline-offset-4">
          {t("checkLender")}
        </Link>
        <p className="text-sm">{t("privacy")}</p>
      </section>

      <section className="rounded-lg border border-current/30 p-4">
        <h2 className="font-bold">{t("exampleTitle")}</h2>
        <p className="mt-2">
          {t("exampleBody", {
            amount: m(example.amountReceivedVnd),
            term: example.schedule.length,
            total: m(example.totalPaidVnd),
            apr: formatPercent(example.aprNominal, locale),
          })}
        </p>
        <p className="mt-2 text-sm opacity-80">{t("exampleNote")}</p>
      </section>

      <section>
        <h2 className="font-bold">{t("whatTitle")}</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>{t("points.cost")}</li>
          <li>{t("points.licensed")}</li>
          <li>{t("points.honest")}</li>
          <li>{t("points.independent")}</li>
        </ul>
      </section>

      <section data-testid="waitlist" className="flex flex-col gap-3">
        <h2 className="font-bold">{waitlistOn ? t("waitlistTitle") : t("waitlistClosedTitle")}</h2>
        {waitlistOn ? (
          <>
            <p>{t("waitlistBody")}</p>
            <WaitlistForm />
          </>
        ) : (
          <p>{t("waitlistClosed")}</p>
        )}
      </section>
    </main>
  );
}
