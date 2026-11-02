"use client";

import { useId } from "react";
import { formatMoneyInput, isPlainMoneyText, parseMoneyInput } from "@/lib/format";

/** Big tap targets (min 44px) for phones. */
const choiceBase =
  "flex min-h-11 w-full cursor-pointer items-center rounded-lg border px-3 py-2 text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-700";
const choiceOn = "border-emerald-700 bg-emerald-50 font-medium text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50 dark:border-emerald-400";
const choiceOff = "border-current/30";

export function ChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  error,
  inline = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string | null;
  inline?: boolean;
}) {
  const name = useId();
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 font-medium">{label}</legend>
      <div className={inline ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2"}>
        {options.map((o) => (
          <label key={String(o.value)} className={`${choiceBase} ${value === o.value ? choiceOn : choiceOff} ${inline ? "justify-center text-center" : ""}`}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function MoneyField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (raw: string) => void;
  error?: string | null;
}) {
  const id = useId();
  const parsed = parseMoneyInput(value);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mb-1 text-sm opacity-75">
          {hint}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          className="min-h-11 w-full rounded-lg border border-current/30 bg-transparent px-3 py-2 text-lg"
          // Digits are grouped as you type; anything else ("15tr") stays visible so the error makes sense.
          value={!isPlainMoneyText(value) || parsed === null ? value : formatMoneyInput(parsed)}
          onChange={(e) => onChange(e.target.value)}
        />
        <span aria-hidden="true">₫</span>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className="min-h-11 w-24 rounded-lg border border-current/30 bg-transparent px-3 py-2 text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PrimaryButton({ children, onClick, type = "button" }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="min-h-12 w-full rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-lg border border-current/30 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      {children}
    </button>
  );
}
