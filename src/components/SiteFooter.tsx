import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CONTROLLER } from "@/config/site";

export function SiteFooter() {
  const t = useTranslations("Footer");
  return (
    <footer className="mx-auto w-full max-w-md px-4 pb-6 text-sm">
      <p className="border-t border-current/20 pt-3 opacity-80">{t("notAdvice")}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-4">
        <Link href="/rieng-tu" className="inline-flex min-h-11 items-center underline underline-offset-2">
          {t("privacy")}
        </Link>
        <Link href="/cach-xep-hang" className="inline-flex min-h-11 items-center underline underline-offset-2">
          {t("ranking")}
        </Link>
        <Link href="/du-lieu" className="inline-flex min-h-11 items-center underline underline-offset-2">
          {t("data")}
        </Link>
        <a href={`mailto:${CONTROLLER.contactEmail}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
          {t("contact")}
        </a>
      </p>
    </footer>
  );
}
