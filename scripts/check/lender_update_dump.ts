/**
 * Dumps the app's results for the lender data update, for lender_update_check.py
 * (which derives everything itself from the JSON files and does NOT use this code).
 * Run from the repo root: npx tsx scripts/check/lender_update_dump.ts > out.json
 */
import { readFileSync } from "node:fs";
import { loadLenders } from "../../src/lib/data/lenders";
import { toOffers } from "../../src/lib/recommend/offers";
import { computeLoanCost, type Charge, type LoanCost } from "../../src/lib/finance";
import { formatMillions, formatPercent } from "../../src/lib/format";
import type { Offer } from "../../src/lib/recommend/offers";
import { recommend, type Need, type Purpose, type RankedOffer } from "../../src/lib/recommend/recommend";

const today = new Date("2026-11-03T00:00:00Z");
// These checks compare the engine with the research archive, so they read the archive, not the store.
const offers = toOffers(loadLenders());
const rankable = offers.filter((o) => !o.excludeFromRanking && o.rate !== null);
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
const purposeOf = (o: Offer): Purpose => (o.goods === "other_goods" || o.goods === "any_goods" ? "goods" : (o.goods ?? "other"));
const c = (l: LoanCost) => ({
  received: l.amountReceivedVnd,
  first: l.firstPaymentVnd,
  last: l.lastPaymentVnd,
  max: l.maxPaymentVnd,
  totalRepaid: l.totalRepaidVnd,
  totalPaid: l.totalPaidVnd,
  totalCost: l.totalCostVnd,
  irr: l.monthlyIrr,
  nominal: l.aprNominal,
  effective: l.aprEffective,
  allIntegers: [
    l.amountReceivedVnd,
    l.firstPaymentVnd,
    l.lastPaymentVnd,
    l.maxPaymentVnd,
    l.totalRepaidVnd,
    l.totalPaidVnd,
    l.totalCostVnd,
    ...l.schedule.map((row) => row.total),
  ].every(Number.isSafeInteger),
  lastBalance: l.schedule[l.schedule.length - 1].balance,
});
const r = (x: RankedOffer) => ({
  key: x.offer.key,
  low: c(x.low),
  high: c(x.high),
  fit: x.fit,
  monthlyFees: x.offer.monthlyFees.map((f) => f.amountVnd),
  rate: x.offer.rate,
  ins: x.insuranceCosts.map((i) => ({
    name: i.nameVi,
    mandatory: i.mandatory,
    collectionKnown: i.collectionKnown,
    min: i.minVnd,
    max: i.maxVnd,
    costHigh: c(i.costHigh),
  })),
  insUnknown: x.insuranceUnknownPremium,
  aprVi: `${formatPercent(x.low.aprNominal, "vi")} - ${formatPercent(x.high.aprNominal, "vi")}`,
  effVi: `${formatPercent(x.low.aprEffective, "vi")} - ${formatPercent(x.high.aprEffective, "vi")}`,
  totalVi: `${formatMillions(x.low.totalPaidVnd, "vi")} - ${formatMillions(x.high.totalPaidVnd, "vi")}`,
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
};
const cases: Case[] = JSON.parse(readFileSync("scripts/check/lender_update_cases.json", "utf-8"));
const direct: Record<string, unknown> = {};
for (const k of cases) {
  const charges: Charge[] = k.monthlyFee ? [{ label: "fee", amountVnd: k.monthlyFee, timing: "monthly" }] : [];
  direct[k.id] = c(
    computeLoanCost({ principalVnd: k.P, termMonths: k.n, rate: { percent: k.pct, basis: k.basis, period: k.period }, amortization: k.amort, charges }),
  );
}

// 2. Every rankable offer through recommend(), on a wide grid
const AMOUNTS = [1_000_000, 3_000_000, 5_000_000, 10_000_000, 20_000_000, 40_000_000, 50_000_000, 100_000_000, 200_000_000, 500_000_000];
const TERMS = [3, 4, 6, 9, 12, 15, 18, 24, 36, 48, 57, 60];
const grid: unknown[] = [];
const notEligible: unknown[] = [];
for (const o of rankable)
  for (const amountVnd of AMOUNTS)
    for (const termMonths of TERMS) {
      const x = recommend(need({ amountVnd, termMonths, purpose: purposeOf(o) }), [o], today);
      if (x.ranked.length === 1) grid.push({ amountVnd, termMonths, ...r(x.ranked[0]) });
      else notEligible.push({ key: o.key, amountVnd, termMonths, reasons: x.ineligible[0]?.reasons ?? null, insufficient: x.insufficientData.length });
    }

// 3. The 0% low end: raw IRR and the text a user would see, for every term and awkward amounts
const zero: unknown[] = [];
for (const o of rankable.filter((q) => q.rate?.minPercent === 0)) {
  for (let termMonths = o.termMinMonths ?? 1; termMonths <= (o.termMaxMonths ?? 36); termMonths++)
    for (const amountVnd of [o.amountMinVnd ?? 1_000_000, 1_234_567, 7_777_777, 10_000_000, 12_345_678, 20_000_000, 33_333_333, 40_000_000, 99_999_999]) {
      const x = recommend(need({ amountVnd, termMonths, purpose: purposeOf(o) }), [o], today);
      if (x.ranked.length !== 1) continue;
      const { low } = x.ranked[0];
      zero.push({
        key: o.key,
        amountVnd,
        termMonths,
        irr: low.monthlyIrr,
        nominal: low.aprNominal,
        effective: low.aprEffective,
        nominalVi: formatPercent(low.aprNominal, "vi"),
        effectiveVi: formatPercent(low.aprEffective, "vi"),
        totalCost: low.totalCostVnd,
        totalPaid: low.totalPaidVnd,
        first: low.firstPaymentVnd,
        last: low.lastPaymentVnd,
      });
    }
}

// 4. Whole-app verdicts for goods purchases, around the affordability line
const verdicts: unknown[] = [];
for (const purpose of ["phone", "motorbike", "other"] as Purpose[])
  for (const [amountVnd, termMonths] of [
    [20_000_000, 12],
    [20_000_000, 24],
    [10_000_000, 12],
  ] as const)
    for (const monthlyIncomeVnd of [3_000_000, 3_500_000, 4_200_000, 4_500_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 10_000_000]) {
      const n = need({ purpose, amountVnd, termMonths, monthlyIncomeVnd });
      const x = recommend(n, offers, today);
      const y = recommend(n, offers.filter((o) => o.rate?.minPercent !== 0), today);
      verdicts.push({
        purpose,
        amountVnd,
        termMonths,
        monthlyIncomeVnd,
        verdict: x.verdict,
        verdictWithoutZeroOffers: y.verdict,
        headroom: x.headroomVnd,
        ranked: x.ranked.map((q) => [q.offer.key, q.fit, q.low.maxPaymentVnd, q.high.maxPaymentVnd]),
      });
    }

// 5. The default 20M at 12, 24 and 36 months, all offers together, in the user's order
const twentyM: Record<string, unknown> = {};
for (const termMonths of [12, 24, 36])
  for (const purpose of ["other", "phone", "motorbike"] as Purpose[]) {
    const x = recommend(need({ termMonths, purpose }), offers, today);
    twentyM[`${purpose}/${termMonths}`] = {
      ranked: x.ranked.map(r),
      ineligible: x.ineligible.map((i) => [i.offer.key, i.reasons]),
      verdict: x.verdict,
    };
  }

console.log(JSON.stringify({ rankable: rankable.map((o) => o.key), direct, grid, notEligible, zero, verdicts, twentyM }));
