/**
 * Dumps what recommend() produces on the store snapshot, for scripts/check/store_check.py
 * (which derives everything itself from data/store/snapshot.json, importing nothing from src).
 * Run: npx tsx scripts/check/store_dump.ts > out.json
 */
import { computeLoanCost, type LoanCost } from "../../src/lib/finance";
import { formatMillions, formatPercent } from "../../src/lib/format";
import type { Offer } from "../../src/lib/recommend/offers";
import { recommend, type IncomeProof, type Need, type Purpose, type RankedOffer } from "../../src/lib/recommend/recommend";
import { loadSnapshot } from "../../src/lib/store";

const today = new Date("2026-11-05T00:00:00Z");
const { offers, dataAsOf } = loadSnapshot();

const base: Need = {
  purpose: "other",
  amountVnd: 20_000_000,
  termMonths: 24,
  urgency: "flexible",
  monthlyIncomeVnd: 15_000_000,
  existingDebtVnd: 0,
  age: 28,
  incomeProof: "bank_salary",
};

const cost = (l: LoanCost) => ({
  received: l.amountReceivedVnd,
  upfront: l.upfrontPaidVnd,
  financed: l.financedPrincipalVnd,
  first: l.firstPaymentVnd,
  last: l.lastPaymentVnd,
  max: l.maxPaymentVnd,
  totalPaid: l.totalPaidVnd,
  totalCost: l.totalCostVnd,
  irr: l.monthlyIrr,
  apr: l.aprNominal,
  effective: l.aprEffective,
});

const row = (r: RankedOffer) => ({
  key: r.offer.key,
  fit: r.fit,
  needsIncomeProofNote: r.needsIncomeProofNote,
  feesAllUnknown: r.feesAllUnknown,
  mandatoryCollectionAssumed: r.mandatoryCollectionAssumed,
  low: cost(r.low),
  high: cost(r.high),
  insurance: r.insuranceCosts.map((i) => ({ name: i.nameVi, min: i.minVnd, max: i.maxVnd, costHigh: cost(i.costHigh) })),
});

const run = (name: string, need: Need, list: readonly Offer[] = offers) => {
  const x = recommend(need, list, today);
  return {
    name,
    need,
    verdict: x.verdict,
    headroom: x.headroomVnd,
    principalOnly: x.principalOnlyVnd,
    suggested: x.suggestedAmountVnd,
    someDontFit: x.someDontFit,
    ranked: x.ranked.map(row),
    ineligible: x.ineligible.map((i) => ({ key: i.offer.key, reasons: i.reasons })),
    insufficient: x.insufficientData.map((i) => ({ key: i.offer.key, stale: i.stale })),
  };
};

const cases = [
  run("main", base),
  run("proof_none", { ...base, incomeProof: "none" }),
  run("tight", { ...base, monthlyIncomeVnd: 10_000_000, existingDebtVnd: 3_100_000 }),
  run("tight_proof_none", { ...base, monthlyIncomeVnd: 10_000_000, existingDebtVnd: 3_100_000, incomeProof: "none" }),
];

// A wider sweep, to catch order and verdict rules that only show up at other incomes, terms and purposes.
const proofs: IncomeProof[] = ["bank_salary", "cash_salary", "self_employed", "none"];
const purposes: Purpose[] = ["other", "motorbike", "phone", "goods", "education"];
for (const purpose of purposes)
  for (const termMonths of [12, 24, 36])
    for (const monthlyIncomeVnd of [3_000_000, 5_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000, 12_000_000, 15_000_000, 30_000_000])
      for (const existingDebtVnd of [0, 1_500_000, 3_100_000])
        for (const incomeProof of proofs)
          cases.push(
            run(`sweep/${purpose}/${termMonths}/${monthlyIncomeVnd}/${existingDebtVnd}/${incomeProof}`, {
              ...base,
              purpose,
              termMonths,
              monthlyIncomeVnd,
              existingDebtVnd,
              incomeProof,
            }),
          );

// What-if data, so the paths no real row reaches today still get checked. Never written back.
const clone = (key: string, changes: Partial<Offer>, rate: Partial<NonNullable<Offer["rate"]>> = {}): Offer => {
  const o = offers.find((x) => x.key === key) as Offer;
  return { ...o, ...changes, rate: { ...(o.rate as NonNullable<Offer["rate"]>), ...rate } };
};
const declining = (collection: Offer["insurance"][number]["collection"]): Offer["insurance"][number] => ({
  nameVi: "bảo hiểm giả định",
  nameEn: null,
  mandatory: true,
  collection,
  method: "annual_rate_on_declining_balance",
  ratePercentMin: 1.3,
  ratePercentMax: 1.8,
  insuredTiers: null,
  fixedVnd: null,
});
const insured: Offer["insurance"][number] = {
  ...declining("deducted_from_payout"),
  method: "annual_rate_on_insured_amount",
  ratePercentMin: 2.5,
  ratePercentMax: 2.5,
  insuredTiers: [{ termMonthsMax: 24, multiplier: 1.4 }, { termMonthsMax: null, multiplier: 1.1 }],
};
const percent: Offer["insurance"][number] = { ...insured, method: "percent_of_principal", ratePercentMin: 3, ratePercentMax: 5, insuredTiers: null };
const fixed: Offer["insurance"][number] = { ...percent, method: "fixed", fixedVnd: 250_000, ratePercentMin: null, ratePercentMax: null, collection: "paid_upfront" };

const forced = offers
  .filter((o) => o.rate !== null && !o.excludeFromRanking)
  .map((o) => ({ ...o, key: `forced/${o.key.replace("/", "-")}`, insurance: o.insurance.map((i) => ({ ...i, mandatory: true })) }));
const synthetic = {
  forcedMandatory: forced,
  paths: [
    clone("vib/vib-super-cash", { key: "t/reducing-declining-deducted", insurance: [declining("deducted_from_payout")] }),
    clone("vib/vib-super-cash", { key: "t/reducing-declining-added", insurance: [declining("added_to_loan")] }),
    clone("vib/vib-super-cash", { key: "t/reducing-insured", insurance: [insured] }),
    clone("vib/vib-super-cash", { key: "t/reducing-percent-monthly", insurance: [{ ...percent, collection: "monthly" }] }),
    clone("vib/vib-super-cash", { key: "t/reducing-fixed-upfront", insurance: [fixed] }),
    clone("fe-credit/tien-mat-linh-hoat", { key: "t/flat-percent-added", insurance: [{ ...percent, collection: "added_to_loan" }] }),
    clone("fe-credit/tien-mat-linh-hoat", { key: "t/flat-declining", insurance: [declining("deducted_from_payout")] }),
    clone("jaccs/cash-loan", { key: "t/minbyterm-declining", insurance: [declining("deducted_from_payout")] }),
    clone("hdbank/hdbank-vay-tieu-dung-linh-hoat", { key: "t/flat-minbyterm-declining", insurance: [declining("deducted_from_payout")] }),
  ],
  // Two loans equal in every way but the source: official must win though its key sorts later.
  tie: [
    clone("vib/vib-super-cash", { key: "a/aggregator" }, { sourceType: "aggregator" }),
    clone("vib/vib-super-cash", { key: "z/official" }),
  ],
  // The cheapest loan has unknown fees and fits; the only known-fee loan is too much.
  feeJump: [
    clone("vib/vib-super-cash", { key: "a/unknown-fees-fits", feesCompleteness: "unknown" }, { minPercent: 1, maxPercent: 1 }),
    clone("vib/vib-super-cash", { key: "b/known-fees-too-much" }, { minPercent: 15, maxPercent: 15 }),
  ],
};
for (const [name, list] of Object.entries(synthetic)) cases.push(run(`synthetic/${name}`, name === "feeJump" ? { ...base, monthlyIncomeVnd: 5_000_000 } : base, list));

const ex = computeLoanCost({
  principalVnd: 20_000_000,
  termMonths: 24,
  rate: { percent: 1.5, basis: "flat", period: "monthly" },
  charges: [{ label: "fee", amountVnd: 400_000, timing: "deducted_from_payout" }],
});

console.log(
  JSON.stringify({
    dataAsOf,
    cases,
    synthetic,
    example: {
      ...cost(ex),
      shownVi: {
        amount: formatMillions(20_000_000, "vi"),
        fee: formatMillions(400_000, "vi"),
        received: formatMillions(ex.amountReceivedVnd, "vi"),
        total: formatMillions(ex.totalPaidVnd, "vi"),
        cost: formatMillions(ex.totalCostVnd, "vi"),
        apr: formatPercent(ex.aprNominal, "vi"),
      },
    },
  }),
);
