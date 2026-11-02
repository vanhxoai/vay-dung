"use client";

import { useTranslations } from "next-intl";

/** A crash must never silently remove the verdict: say so plainly. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("Error");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("body")}</p>
      <button type="button" onClick={reset} className="min-h-12 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900">
        {t("retry")}
      </button>
    </main>
  );
}
