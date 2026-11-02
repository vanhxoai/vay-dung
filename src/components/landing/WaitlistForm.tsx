"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PrimaryButton } from "@/components/loan/fields";
import { CONSENT_VERSION, CONTROLLER, WAITLIST_RETENTION_MONTHS } from "@/config/site";
import { SignupRequest } from "@/lib/waitlist/signup";

type Status = "idle" | "sending" | "done" | "failed";

/** Email only, with an unticked consent box. The consent text is the record people agree to. */
export function WaitlistForm() {
  const t = useTranslations("Waitlist");
  const locale = useLocale() as "vi" | "en";
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const request = { email: email.trim(), consent, consentVersion: CONSENT_VERSION, locale, ...(website ? { website } : {}) };
    const parsed = SignupRequest.safeParse(request);
    const badEmail = parsed.success ? false : parsed.error.issues.some((i) => i.path[0] === "email");
    setEmailError(badEmail);
    setConsentError(!consent);
    if (badEmail || !consent) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      setStatus(res.ok ? "done" : "failed");
    } catch {
      setStatus("failed");
    }
  };

  if (status === "done") {
    return (
      <p role="status" data-testid="waitlist-done" className="rounded-lg border border-current/30 p-3">
        {t("done")}
      </p>
    );
  }

  return (
    <form data-testid="waitlist-form" className="flex flex-col gap-3" noValidate onSubmit={submit}>
      <div>
        <label htmlFor={id} className="mb-1 block font-medium">
          {t("emailLabel")}
        </label>
        <input
          id={id}
          type="email"
          autoComplete="email"
          aria-invalid={emailError || undefined}
          className="min-h-11 w-full rounded-lg border border-current/30 bg-transparent px-3 py-2 text-lg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {emailError ? (
          <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
            {t("emailError")}
          </p>
        ) : null}
      </div>

      {/* Hidden from people; bots tend to fill it in. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span className="text-sm">
          {t("consent", { name: CONTROLLER.name, email: CONTROLLER.contactEmail, months: WAITLIST_RETENTION_MONTHS })}{" "}
          <Link href="/rieng-tu" className="underline underline-offset-2">
            {t("privacyLink")}
          </Link>
        </span>
      </label>
      {consentError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t("consentError")}
        </p>
      ) : null}
      {status === "failed" ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t("failed")}
        </p>
      ) : null}
      <PrimaryButton type="submit">{status === "sending" ? t("sending") : t("submit")}</PrimaryButton>
    </form>
  );
}
