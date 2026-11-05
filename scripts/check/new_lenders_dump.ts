/**
 * Dumps what the app produces for the lenders added in c8a8818 and the minUnconfirmed rule (c82869c),
 * for new_lenders_check.py (which derives everything itself and does NOT use this code).
 * Run from the repo root: npx tsx scripts/check/new_lenders_dump.ts > out.json
 */
import { readFileSync } from "node:fs";
import { loadLenders } from "../../src/lib/data/lenders";
import { toOffers } from "../../src/lib/recommend/offers";
import { computeLoanCost, type Charge, type LoanCost } from "../../src/lib/finance";
import type { Offer } from "../../src/lib/recommend/offers";
import { recommend, type Need, type Purpose, type RankedOffer } from "../../src/lib/recommend/recommend";

const today = new Date("2026-11-04T12:00:00+07:00");
// These checks compare the engine with the research archive, so they read the archive, not the store.
const offers = toOffers(loadLenders());
const need = (o: Partial<Need> = {}): Need => ({
  purpose: "other",
  amountVnd: 20_000_000,
  termMonths: 24,
  urgency: "flexible",
  monthlyIncomeVnd: 1_000_000_000,
  existingDebtVnd: 0,
  age: 30,
  incomeProof: "bank_salary",
  ...o,
});
const c = (l: LoanCost) => ({
  received: l.amountReceivedVnd,
  upfront: l.upfrontPaidVnd,
  first: l.firstPaymentVnd,
  last: l.lastPaymentVnd,
  max: l.maxPaymentVnd,
  totalRepaid: l.totalRepaidVnd,
  totalPaid: l.totalPaidVnd,
  totalCost: l.totalCostVnd,
  irr: l.monthlyIrr,
  nominal: l.aprNominal,
  effective: l.aprEffective,
  rows: l.schedule.map((r) => r.total),
  principalSum: l.schedule.reduce((a, r) => a + r.principal, 0),
  lastBalance: l.schedule[l.schedule.length - 1].balance,
});

// 1. Direct engine runs on the worked examples
type Case = {
  id: string;
  P: number;
  n: number;
  pct: number;
  basis: "flat" | "reducing";
  period: "monthly" | "yearly";
  amort?: "annuity" | "equal_principal";
  monthlyFee?: number;
  deducted?: number;
};
const cases: Case[] = JSON.parse(readFileSync("scripts/check/new_lenders_cases.json", "utf-8"));
const direct: Record<string, unknown> = {};
for (const k of cases) {
  const charges: Charge[] = [];
  if (k.monthlyFee) charges.push({ label: "fee", amountVnd: k.monthlyFee, timing: "monthly" });
  if (k.deducted) charges.push({ label: "fee", amountVnd: k.deducted, timing: "deducted_from_payout" });
  direct[k.id] = c(computeLoanCost({ principalVnd: k.P, termMonths: k.n, rate: { percent: k.pct, basis: k.basis, period: k.period }, amortization: k.amort, charges }));
}

// 2. 20M at 12, 24 and 36 months through recommend(), in the user's order
const r = (x: RankedOffer) => ({ key: x.offer.key, fit: x.fit, feesAllUnknown: x.feesAllUnknown, monthlyFees: x.offer.monthlyFees.map((f) => f.amountVnd), low: c(x.low), high: c(x.high) });
const twentyM: Record<string, unknown> = {};
for (const termMonths of [12, 24, 36])
  for (const purpose of ["other", "phone", "motorbike"] as Purpose[]) {
    const x = recommend(need({ termMonths, purpose }), offers, today);
    twentyM[`${purpose}/${termMonths}`] = {
      verdict: x.verdict,
      ranked: x.ranked.map(r),
      ineligible: x.ineligible.map((i) => [i.offer.key, i.reasons]),
      insufficient: x.insufficientData.map((i) => i.offer.key),
    };
  }

// 3. minUnconfirmed: same results as a range whose minimum IS the maximum, and differs from the rule switched off
const flagged = offers.filter((o) => o.rate?.minUnconfirmed);
const collapsed = (o: Offer): Offer => ({ ...o, rate: { ...o.rate!, minPercent: o.rate!.maxPercent, minUnconfirmed: false } });
const unflagged = (o: Offer): Offer => ({ ...o, rate: { ...o.rate!, minUnconfirmed: false } });
const outcome = (n: Need, list: readonly Offer[]) => {
  const x = recommend(n, list, today);
  return {
    verdict: x.verdict,
    suggested: x.suggestedAmountVnd,
    someDontFit: x.someDontFit,
    ranked: x.ranked.map((q) => ({ key: q.offer.key, fit: q.fit, low: { ...q.low }, high: { ...q.high } })),
  };
};
const metamorphic = {
  checked: 0,
  lowNotHigh: 0,
  fitsOnlyLow: 0,
  differsFromCollapsed: 0,
  wholeSetChecked: 0,
  wholeSetDiffers: 0,
  ruleOffVerdictDiffers: 0,
  ruleOffFitsOnlyLow: 0,
  examples: [] as unknown[],
};
const swapped = offers.map((o) => (o.rate?.minUnconfirmed ? collapsed(o) : o));
for (const o of flagged)
  for (const amountVnd of [5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000])
    for (const termMonths of [6, 9, 12, 18, 21, 24, 36])
      for (const monthlyIncomeVnd of [0, 3_000_000, 4_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000, 20_000_000, 50_000_000])
        for (const existingDebtVnd of [0, 2_000_000]) {
          const n = need({ amountVnd, termMonths, monthlyIncomeVnd, existingDebtVnd });
          const a = outcome(n, [o]);
          if (a.ranked.length === 0) continue;
          metamorphic.checked++;
          const q = a.ranked[0];
          if (JSON.stringify(q.low) !== JSON.stringify(q.high)) metamorphic.lowNotHigh++;
          if (q.fit === "fits_only_low") metamorphic.fitsOnlyLow++;
          if (JSON.stringify(a) !== JSON.stringify(outcome(n, [collapsed(o)]))) metamorphic.differsFromCollapsed++;
          const off = outcome(n, [unflagged(o)]);
          if (off.verdict !== a.verdict) {
            metamorphic.ruleOffVerdictDiffers++;
            if (metamorphic.examples.length < 3) metamorphic.examples.push({ key: o.key, amountVnd, termMonths, monthlyIncomeVnd, existingDebtVnd, withRule: a.verdict, ruleOff: off.verdict });
          }
          if (off.ranked[0].fit === "fits_only_low") metamorphic.ruleOffFitsOnlyLow++;
        }
// The same with every lender in the list, so ranking and the whole-set verdict are covered too.
for (const amountVnd of [5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000])
  for (const termMonths of [6, 9, 12, 18, 21, 24, 36])
    for (const monthlyIncomeVnd of [0, 3_000_000, 4_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000, 20_000_000, 50_000_000])
      for (const existingDebtVnd of [0, 2_000_000]) {
        const n = need({ amountVnd, termMonths, monthlyIncomeVnd, existingDebtVnd });
        metamorphic.wholeSetChecked++;
        if (JSON.stringify(outcome(n, offers)) !== JSON.stringify(outcome(n, swapped))) metamorphic.wholeSetDiffers++;
      }

// 4. The top of the range across every allowed amount and term, with fit, verdict and suggested amount
const topOfRange: unknown[] = [];
for (const o of flagged)
  for (const amountVnd of [5_000_000, 7_777_777, 10_000_000, 20_000_000, 33_333_333, 50_000_000])
    for (let termMonths = o.termMinMonths ?? 6; termMonths <= (o.termMaxMonths ?? 36); termMonths++)
      for (const monthlyIncomeVnd of [4_000_000, 8_000_000, 20_000_000]) {
        const x = recommend(need({ amountVnd, termMonths, monthlyIncomeVnd }), [o], today);
        if (x.ranked.length !== 1) continue;
        const q = x.ranked[0];
        topOfRange.push({ key: o.key, amountVnd, termMonths, monthlyIncomeVnd, verdict: x.verdict, headroom: x.headroomVnd, suggested: x.suggestedAmountVnd, fit: q.fit, high: c(q.high) });
      }

// 5. Engine stress at and above the 89% rate, beyond any published term
const stress = [];
for (const percent of [89, 200])
  for (const termMonths of [36, 60, 120])
    for (const principalVnd of [5_000_000, 50_000_000]) {
      const l = computeLoanCost({ principalVnd, termMonths, rate: { percent, basis: "reducing", period: "yearly" } });
      stress.push({ percent, termMonths, principalVnd, first: l.firstPaymentVnd, last: l.lastPaymentVnd, nominal: l.aprNominal, effective: l.aprEffective, lastBalance: l.schedule[termMonths - 1].balance, total: l.totalPaidVnd });
    }

console.log(
  JSON.stringify({
    direct,
    twentyM,
    flaggedKeys: flagged.map((o) => o.key),
    rankable: offers.filter((o) => !o.excludeFromRanking && o.rate !== null).map((o) => o.key),
    metamorphic,
    topOfRange,
    stress,
  }),
);
