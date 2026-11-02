import { useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { CONTROLLER, WAITLIST_RETENTION_MONTHS, isWaitlistEnabled } from "@/config/site";
import { Link } from "@/i18n/navigation";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-bold">{title}</h2>
      <div className="mt-1 flex flex-col gap-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const t = useTranslations("Privacy");
  const tHome = useTranslations("Home");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center font-bold">
          {tHome("title")}
        </Link>
        <LanguageLink href="/rieng-tu" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
          {tHome("switchLanguage")}
        </LanguageLink>
      </header>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm">{t("updated")}</p>
      <Section title={t("who.title")}>
        <p>{t("who.body", { name: CONTROLLER.name, email: CONTROLLER.contactEmail })}</p>
      </Section>
      <Section title={t("device.title")}>
        <p>{t("device.body")}</p>
        <p>{t("device.language")}</p>
      </Section>
      <Section title={t("analytics.title")}>
        <p>{t("analytics.body")}</p>
      </Section>
      <Section title={t("hosting.title")}>
        <p>{t("hosting.body")}</p>
      </Section>
      <Section title={t("waitlist.title")}>
        {isWaitlistEnabled() ? (
          <>
            <p>{t("waitlist.on", { months: WAITLIST_RETENTION_MONTHS })}</p>
            <p>{t("waitlist.processor")}</p>
          </>
        ) : (
          <p>{t("waitlist.off")}</p>
        )}
      </Section>
      <Section title={t("rights.title")}>
        <p>{t("rights.body", { email: CONTROLLER.contactEmail })}</p>
      </Section>
      <Section title={t("never.title")}>
        <p>{t("never.body")}</p>
      </Section>
    </main>
  );
}
