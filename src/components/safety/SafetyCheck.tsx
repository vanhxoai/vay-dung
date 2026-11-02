"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PrimaryButton } from "@/components/loan/fields";
import { formatDate } from "@/lib/format";
import { checkSafety, type SafetyInstitution, type SafetyResult } from "@/lib/safety/check";
import { SIGNS, type SignId } from "@/lib/safety/signs";

const linkClass = "inline-flex min-h-11 items-center underline underline-offset-2";

const subscribeNever = () => () => {};

export function SafetyCheck({
  institutions,
  asOf,
  sources,
}: {
  institutions: SafetyInstitution[];
  asOf: string;
  sources: { title: string; url: string }[];
}) {
  const t = useTranslations("Safety");
  const tHome = useTranslations("Home");
  const locale = useLocale();
  const otherLocale = locale === "vi" ? "en" : "vi";
  // On a slow connection, the form stays disabled until it can work.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);

  const [name, setName] = useState("");
  const [ticked, setTicked] = useState<SignId[]>([]);
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [checkedName, setCheckedName] = useState("");
  const [error, setError] = useState(false);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const nameId = useId();

  const toggle = (id: SignId) => setTicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === "" && ticked.length === 0) {
      setError(true);
      setResult(null);
      return;
    }
    setError(false);
    setCheckedName(name.trim());
    setResult(checkSafety(name, ticked, institutions));
    requestAnimationFrame(() => resultRef.current?.focus());
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center font-bold">
          {tHome("title")}
        </Link>
        <Link href="/kiem-tra" locale={otherLocale} className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
          {tHome("switchLanguage")}
        </Link>
      </header>

      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2">{t("intro")}</p>
        <p className="mt-2 text-sm">{t("privacy")}</p>
      </div>

      <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
        <fieldset disabled={!hydrated} className="flex min-w-0 flex-col gap-5">
          <div>
            <label htmlFor={nameId} className="mb-1 block font-medium">
              {t("nameLabel")}
            </label>
            <p id={`${nameId}-hint`} className="mb-1 text-sm opacity-75">
              {t("nameHint")}
            </p>
            <input
              id={nameId}
              autoComplete="off"
              maxLength={120}
              aria-describedby={`${nameId}-hint`}
              className="min-h-11 w-full rounded-lg border border-current/30 bg-transparent px-3 py-2 text-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <fieldset>
            <legend className="mb-1 font-medium">{t("signsLabel")}</legend>
            <p className="mb-2 text-sm opacity-75">{t("signsHint")}</p>
            <div className="flex flex-col gap-2">
              {SIGNS.map((s) => {
                const on = ticked.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-700 ${
                      on ? "border-emerald-700 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-50" : "border-current/30"
                    }`}
                  >
                    <input type="checkbox" className="mt-1 size-4 shrink-0" checked={on} onChange={() => toggle(s.id)} />
                    <span>{t(`sign.${s.id}`)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {t("errorEmpty")}
            </p>
          ) : null}
          <PrimaryButton type="submit">{hydrated ? t("submit") : t("loading")}</PrimaryButton>
        </fieldset>
      </form>

      {result ? (
        <section role="status" className="flex flex-col gap-4" data-testid="safety-result" data-name-kind={result.name.kind} data-level={result.level}>
          <h2 ref={resultRef} tabIndex={-1} className="text-xl font-bold outline-none">
            {t("resultTitle")}
          </h2>

          {result.level === "stop" ? (
            <div data-testid="safety-stop" className="rounded-lg border-2 border-red-700 bg-red-50 p-4 text-red-950 dark:bg-red-950 dark:text-red-50">
              <h3 className="text-lg font-bold">{t("stop.title")}</h3>
              <p className="mt-2">{t("stop.body")}</p>
            </div>
          ) : null}

          <NameCard result={result} checkedName={checkedName} asOf={asOf} />

          {result.nameFlags.length > 0 ? (
            <div className="rounded-lg border border-amber-700 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
              {result.nameFlags.map((f) => (
                <p key={f}>{t(`flag.${f}`)}</p>
              ))}
            </div>
          ) : null}

          {result.highSigns.length + result.mediumSigns.length > 0 ? <TickedSigns result={result} /> : null}

          <div>
            <h3 className="font-bold">{t("todo.title")}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("todo.official")}</li>
              <li>{t("todo.noPayment")}</li>
              <li>{t("todo.noOtp")}</li>
              <li>{t("todo.apps")}</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold">{t("paid.title")}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("paid.stop")}</li>
              <li>{t("paid.evidence")}</li>
              <li>{t("paid.police")}</li>
            </ul>
          </div>

          {result.highSigns.includes("harassment") ? (
            <div>
              <h3 className="font-bold">{t("harassment.title")}</h3>
              <p className="mt-2">{t("harassment.body")}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-current/30 p-3 text-sm">
            <p>{t("disclaimer")}</p>
            <p className="mt-2">{t("listSources", { date: formatDate(asOf) })}</p>
            <ul className="list-disc pl-5">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Link href="/vay" className={linkClass}>
            {t("toFlow")}
          </Link>
        </section>
      ) : null}
    </main>
  );
}

function NameCard({ result, checkedName, asOf }: { result: SafetyResult; checkedName: string; asOf: string }) {
  const t = useTranslations("Safety");
  const date = formatDate(asOf);
  const { name } = result;

  if (name.kind === "empty") return null;

  if (name.kind === "licensed") {
    const i = name.institution;
    return (
      <div className="rounded-lg border-2 border-emerald-700 p-4">
        <h3 className="text-lg font-bold">{t("licensed.title")}</h3>
        <p className="mt-2 font-medium">{i.legalName}</p>
        <p className="text-sm">{t(`licensed.${i.category}`)}</p>
        {i.licenseNumber ? <p className="text-sm">{i.licenseNumber}</p> : null}
        <p className="mt-1 text-sm">{t("asOf", { date })}</p>
        <p className="text-sm">
          <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("seeOnList")}
          </a>
        </p>
        {name.matchedWebsite ? <p className="mt-1 text-sm">{t("licensed.websiteMatch")}</p> : null}
        <p className="mt-2 font-medium">{t("licensed.caution")}</p>
        {i.website ? (
          <p className="mt-1 text-sm">
            {t("licensed.website")}{" "}
            <a href={i.website} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {i.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (name.kind === "similar") {
    return (
      <div className="rounded-lg border-2 border-amber-700 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
        <h3 className="text-lg font-bold">{t("similar.title")}</h3>
        <p className="mt-2">{t("similar.body", { name: checkedName })}</p>
        <ul className="mt-2 list-disc pl-5">
          {name.institutions.map((i) => (
            <li key={i.id}>
              {i.name}: {i.legalName}
              {i.website ? ` (${i.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")})` : ""}
            </li>
          ))}
        </ul>
        <p className="mt-2">{t("similar.advice")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-700 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
      <h3 className="text-lg font-bold">{t("notFound.title", { date })}</h3>
      <p className="mt-2">{t("notFound.body")}</p>
      <p className="mt-2">{t("notFound.advice")}</p>
    </div>
  );
}

function TickedSigns({ result }: { result: SafetyResult }) {
  const t = useTranslations("Safety");
  const ids = [...result.highSigns, ...result.mediumSigns];
  return (
    <div>
      <h3 className="font-bold">{t("signsTitle")}</h3>
      <p className="mt-1 text-sm">{t("signsIntro")}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {ids.map((id) => {
          const sign = SIGNS.find((s) => s.id === id)!;
          return (
            <li key={id} className="rounded-lg border border-current/30 p-3">
              <p className="font-medium">{t(`sign.${id}`)}</p>
              <p className="mt-1 text-sm">{t(`why.${id}`)}</p>
              <p className="text-sm">
                {sign.sources.map((s, n) => (
                  <span key={s.url}>
                    {n > 0 ? " · " : null}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {s.outlet} ({s.authority}), {formatDate(s.date)}
                    </a>
                  </span>
                ))}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
