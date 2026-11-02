"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { Link } from "@/i18n/navigation";
import { trackStep } from "@/lib/analytics";
import { parseMoneyInput } from "@/lib/format";
import type { Offer } from "@/lib/recommend/offers";
import type { IncomeProof, Need, Purpose, Urgency } from "@/lib/recommend/recommend";
import { saveDraft, takeDraft } from "./draft";
import { ChoiceGroup, MoneyField, NumberField, PrimaryButton, SecondaryButton } from "./fields";
import { Results } from "./Results";
import { TERMS } from "./terms";

const PURPOSES: Purpose[] = ["phone", "motorbike", "education", "medical", "debt", "living", "other"];
const URGENCIES: Urgency[] = ["now", "soon", "flexible"];
const PROOFS: IncomeProof[] = ["bank_salary", "cash_salary", "self_employed", "none"];

const MIN_AMOUNT = 1_000_000;
const MAX_AMOUNT = 2_000_000_000;
const MAX_MONEY = 100_000_000_000;
/** Below these, someone almost certainly typed "15" or "3tr" rather than the full amount. */
const MIN_PLAUSIBLE_INCOME = 100_000;
const MIN_PLAUSIBLE_DEBT = 10_000;
const MAX_AGE = 100;

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

function isForm(x: unknown): x is Form {
  if (!x || typeof x !== "object") return false;
  const f = x as Partial<Form>;
  return (
    (f.step === 1 || f.step === 2 || f.step === 3) &&
    (f.purpose === null || PURPOSES.includes(f.purpose as Purpose)) &&
    typeof f.amount === "string" &&
    TERMS.includes(f.term as (typeof TERMS)[number]) &&
    (f.urgency === null || URGENCIES.includes(f.urgency as Urgency)) &&
    typeof f.income === "string" &&
    typeof f.debt === "string" &&
    typeof f.age === "string" &&
    (f.proof === null || PROOFS.includes(f.proof as IncomeProof))
  );
}

const subscribeNever = () => () => {};
/** False in the pre-rendered HTML, true once the page's JavaScript is running. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

type Errors = Partial<Record<"purpose" | "amount" | "urgency" | "income" | "debt" | "age" | "proof", string>>;

export function LoanFlow({
  offers,
  licensedAsOf,
  licensedSources,
}: {
  offers: Offer[];
  licensedAsOf: string;
  licensedSources: { title: string; url: string }[];
}) {
  const t = useTranslations();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  // On a slow connection, the form stays disabled until it can work. Otherwise a tap
  // would reload the page and lose what was typed.
  const hydrated = useHydrated();
  // Set when the results open (not during pre-rendering): used to check how old the data is.
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    const saved = takeDraft();
    if (!isForm(saved)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after a language switch
    setForm(saved);
    setToday(new Date());
    window.history.replaceState({ loanStep: saved.step }, "");
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const showStep = (step: Form["step"]) => {
    setForm((f) => ({ ...f, step }));
    setErrors({});
    window.scrollTo(0, 0);
    // Someone who has already tapped a field keeps it; otherwise their typing would be lost.
    requestAnimationFrame(() => {
      if (!(document.activeElement instanceof HTMLInputElement)) headingRef.current?.focus();
    });
  };

  const goTo = (step: Form["step"]) => {
    window.history.pushState({ loanStep: step }, "");
    showStep(step);
  };

  // The phone's Back button moves between steps, rather than leaving the questionnaire.
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const step = e.state?.loanStep;
      showStep(step === 2 || step === 3 ? step : 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** Brings the first problem into view and puts the cursor there. */
  const showFirstError = () => {
    requestAnimationFrame(() => {
      const alert = document.querySelector('form [role="alert"]');
      const group = alert?.closest("fieldset") ?? alert?.parentElement;
      group?.scrollIntoView({ block: "center" });
      group?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    });
  };

  const checkStep1 = (): boolean => {
    const e: Errors = {};
    if (!form.purpose) e.purpose = t("Flow.errors.purpose");
    const amount = parseMoneyInput(form.amount);
    if (amount === null || amount < MIN_AMOUNT) e.amount = t("Flow.errors.amount");
    else if (amount > MAX_AMOUNT) e.amount = t("Flow.errors.amountTooBig");
    if (!form.urgency) e.urgency = t("Flow.errors.urgency");
    setErrors(e);
    if (Object.keys(e).length > 0) showFirstError();
    return Object.keys(e).length === 0;
  };

  const checkStep2 = (): boolean => {
    const e: Errors = {};
    const income = parseMoneyInput(form.income);
    if (income === null) e.income = t("Flow.errors.income");
    else if (income > 0 && income < MIN_PLAUSIBLE_INCOME) e.income = t("Flow.errors.fullAmount");
    else if (income > MAX_MONEY) e.income = t("Flow.errors.debtTooBig");
    const debt = parseMoneyInput(form.debt);
    if (form.debt !== "") {
      if (debt === null || (debt > 0 && debt < MIN_PLAUSIBLE_DEBT)) e.debt = t("Flow.errors.fullAmount");
      else if (debt > MAX_MONEY) e.debt = t("Flow.errors.debtTooBig");
    }
    const age = Number(form.age);
    if (form.age === "" || !Number.isInteger(age) || age > MAX_AGE) e.age = t("Flow.errors.age");
    else if (age < 18) e.age = t("Flow.errors.underage");
    if (!form.proof) e.proof = t("Flow.errors.proof");
    setErrors(e);
    if (Object.keys(e).length > 0) showFirstError();
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

  const rememberForLanguageSwitch = (e: React.MouseEvent) => {
    // Ctrl/Cmd-click opens another tab; nothing should be left behind in this one.
    if (form === EMPTY || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    saveDraft(form);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center font-bold">
          {t("Home.title")}
        </Link>
        <LanguageLink href="/vay" onClick={rememberForLanguageSwitch} className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
          {t("Home.switchLanguage")}
        </LanguageLink>
      </header>

      {form.step === 1 ? (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (checkStep1()) {
              trackStep("buoc-2");
              goTo(2);
            }
          }}
        >
          <fieldset disabled={!hydrated} className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="text-sm opacity-75">{t("Flow.stepOf", { step: 1, total: 3 })}</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
              {t("Flow.need.title")}
            </h1>
            <p className="mt-2 text-sm">{t("Home.privacy")}</p>
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
          <PrimaryButton type="submit">{hydrated ? t("Flow.next") : t("Flow.loading")}</PrimaryButton>
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
              trackStep("ket-qua");
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
            hint={form.purpose === "debt" ? `${t("Flow.finances.debtHint")} ${t("Flow.finances.debtRefinanceHint")}` : t("Flow.finances.debtHint")}
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
          licensedSources={licensedSources}
        />
      ) : null}
    </main>
  );
}
