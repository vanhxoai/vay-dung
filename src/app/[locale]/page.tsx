import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
  const t = useTranslations("Home");
  const otherLocale = useLocale() === "vi" ? "en" : "vi";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-lg">{t("tagline")}</p>
      <p className="text-sm opacity-70">{t("comingSoon")}</p>
      <Link
        href="/"
        locale={otherLocale}
        className="mt-4 inline-flex min-h-11 items-center self-start rounded-lg border px-4 underline-offset-4 hover:underline"
      >
        {t("switchLanguage")}
      </Link>
    </main>
  );
}
