import { useTranslations } from "next-intl";

/** Visible on every page: a student project, not a service for real borrowers (DECISIONS #63). */
export function SiteBanner() {
  const t = useTranslations("Banner");
  return (
    <p data-testid="project-banner" role="note" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50">
      {t("text")}
    </p>
  );
}
