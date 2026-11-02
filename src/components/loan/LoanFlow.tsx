"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { parseMoneyInput, type AppLocale } from "@/lib/format";
import type { Offer } from "@/lib/recommend/offers";
import type { IncomeProof, Need, Purpose, Urgency } from "@/lib/recommend/recommend";
import { ChoiceGroup, MoneyField, NumberField, PrimaryButton, SecondaryButton } from "./fields";
import { Results } from "./Results";

const PURPOSES: Purpose[] = ["phone", "motorbike", "education", "medical", "debt", "living", "other"];
const URGENCIES: Urgency[] = ["now", "soon", "flexible"];
const PROOFS: IncomeProof[] = ["bank_salary", "cash_salary", "self_employed", "none"];
export const TERMS = [6, 12, 18, 24, 36] as const;

const MIN_AMOUNT = 1_000_000;
const MAX_AMOUNT = 2_000_000_000;
const MAX_MONEY = 100_000_000_000;

type Form = {
  step: 1 | 2 | 3;
  purpose: Purpose | null;
  amount: string;
  term: number;
  urgency: Urgency | null;
  income: string;
  debt: string;
  age: string;
  proof: IncomeProof | null;
};

const EMPTY: Form = { step: 1, purpose: null, amount: "", term: 12, urgency: null, income: "", debt: "", age: "", proof: null };

/**
 * Switching language reloads the page, which would lose the answers. They're kept in
 * this tab's sessionStorage ONLY for that moment and removed as soon as they're read.
 * Nothing leaves the browser.
 */
const DRAFT_KEY = "vay-dung-language-switch";

const subscribeNever = () => () => {};
/** False in the pre-rendered HTML, true once the page's JavaScript is running. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

type Errors = Partial<Record<"purpose" | "amount" | "urgency" | "income" | "debt" | "age" | "proof", string>>;

export function LoanFlow({ offers, licensedAsOf, licensedUrl }: { offers: Offer[]; licensedAsOf: string; licensedUrl: string }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  // On a slow connection, the form stays disabled until it can work. Otherwise a tap
  // would reload the page and lose what was typed.
  const hydrated = useHydrated();
  // Set when the results open (not during pre-rendering): used to check how old the data is.
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      sessionStorage.removeItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after a language switch
      setForm(JSON.parse(saved) as Form);
      setToday(new Date());
    } catch {
      // Storage can be blocked; the flow still works, it just starts again.
    }
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const goTo = (step: Form["step"]) => {
    setForm((f) => ({ ...f, step }));
    setErrors({});
    window.scrollTo(0, 0);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const checkStep1 = (): boolean => {
    const e: Errors = {};
    if (!form.purpose) e.purpose = t("Flow.errors.purpose");
    const amount = parseMoneyInput(form.amount);
    if (amount === null || amount < MIN_AMOUNT) e.amount = t("Flow.errors.amount");
    else if (amount > MAX_AMOUNT) e.amount = t("Flow.errors.amountTooBig");
    if (!form.urgency) e.urgency = t("Flow.errors.urgency");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const checkStep2 = (): boolean => {
    const e: Errors = {};
    const income = parseMoneyInput(form.income);
    if (income === null) e.income = t("Flow.errors.income");
    else if (income > MAX_MONEY) e.income = t("Flow.errors.debtTooBig");
    const debt = parseMoneyInput(form.debt);
    if (form.debt !== "" && (debt === null || debt > MAX_MONEY)) e.debt = t("Flow.errors.debtTooBig");
    const age = Number(form.age);
    if (form.age === "" || !Number.isInteger(age) || age > 120) e.age = t("Flow.errors.age");
    else if (age < 18) e.age = t("Flow.errors.underage");
    if (!form.proof) e.proof = t("Flow.errors.proof");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const need: Need | null =
    form.step === 3
      ? {
          purpose: form.purpose as Purpose,
          amountVnd: parseMoneyInput(form.amount) as number,
          termMonths: form.term,
          urgency: form.urgency as Urgency,
          monthlyIncomeVnd: parseMoneyInput(form.income) as number,
          existingDebtVnd: parseMoneyInput(form.debt) ?? 0,
          age: Number(form.age),
          incomeProof: form.proof as IncomeProof,
        }
      : null;

  const otherLocale = locale === "vi" ? "en" : "vi";
  const rememberForLanguageSwitch = () => {
    try {
      if (form !== EMPTY) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // Storage can be blocked; the flow simply starts again.
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="font-bold">
          {t("Home.title")}
        </Link>
        <Link href="/vay" locale={otherLocale} onClick={rememberForLanguageSwitch} className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
          {t("Home.switchLanguage")}
        </Link>
      </header>

      {form.step === 1 ? (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (checkStep1()) goTo(2);
          }}
        >
          <fieldset disabled={!hydrated} className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="text-sm opacity-75">{t("Flow.stepOf", { step: 1, total: 3 })}</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
              {t("Flow.need.title")}
            </h1>
          </div>
          <ChoiceGroup
            label={t("Flow.need.purposeLabel")}
            options={PURPOSES.map((p) => ({ value: p, label: t(`Purpose.${p}`) }))}
            value={form.purpose}
            onChange={(v) => set("purpose", v)}
            error={errors.purpose}
          />
          <MoneyField
            label={t("Flow.need.amountLabel")}
            hint={t("Flow.need.amountHint")}
            value={form.amount}
            onChange={(v) => set("amount", v)}
            error={errors.amount}
          />
          <ChoiceGroup
            inline
            label={t("Flow.need.termLabel")}
            options={TERMS.map((n) => ({ value: n as number, label: t("Flow.need.months", { n }) }))}
            value={form.term}
            onChange={(v) => set("term", v)}
          />
          <ChoiceGroup
            label={t("Flow.need.urgencyLabel")}
            options={URGENCIES.map((u) => ({ value: u, label: t(`Urgency.${u}`) }))}
            value={form.urgency}
            onChange={(v) => set("urgency", v)}
            error={errors.urgency}
          />
          <PrimaryButton type="submit">{t("Flow.next")}</PrimaryButton>
          </fieldset>
        </form>
      ) : null}

      {form.step === 2 ? (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (checkStep2()) {
              setToday(new Date());
              goTo(3);
            }
          }}
        >
          <fieldset disabled={!hydrated} className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="text-sm opacity-75">{t("Flow.stepOf", { step: 2, total: 3 })}</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
              {t("Flow.finances.title")}
            </h1>
            <p className="mt-2 text-sm">{t("Flow.finances.privacy")}</p>
          </div>
          <MoneyField
            label={t("Flow.finances.incomeLabel")}
            hint={t("Flow.finances.incomeHint")}
            value={form.income}
            onChange={(v) => set("income", v)}
            error={errors.income}
          />
          <MoneyField
            label={t("Flow.finances.debtLabel")}
            hint={t("Flow.finances.debtHint")}
            value={form.debt}
            onChange={(v) => set("debt", v)}
            error={errors.debt}
          />
          <NumberField label={t("Flow.finances.ageLabel")} value={form.age} onChange={(v) => set("age", v)} error={errors.age} />
          <ChoiceGroup
            label={t("Flow.finances.proofLabel")}
            options={PROOFS.map((p) => ({ value: p, label: t(`Proof.${p}`) }))}
            value={form.proof}
            onChange={(v) => set("proof", v)}
            error={errors.proof}
          />
          <PrimaryButton type="submit">{t("Flow.seeResults")}</PrimaryButton>
          <SecondaryButton onClick={() => goTo(1)}>{t("Flow.back")}</SecondaryButton>
          </fieldset>
        </form>
      ) : null}

      {form.step === 3 && need && today ? (
        <Results
          need={need}
          offers={offers}
          today={today}
          headingRef={headingRef}
          onChangeTerm={(n) => set("term", n)}
          onEdit={() => goTo(1)}
          licensedAsOf={licensedAsOf}
          licensedUrl={licensedUrl}
        />
      ) : null}
    </main>
  );
}
