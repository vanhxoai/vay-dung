/**
 * Dumps what recommend() and the display helpers actually produce, on the REAL lender data,
 * for scripts/check/recommend_check.py (which derives everything itself from the JSON files).
 * Run: npx tsx scripts/check/recommend_dump.ts > out.json
 */
import { loadSnapshot } from "../../src/lib/store";
import { computeLoanCost, type LoanCost } from "../../src/lib/finance";
import { formatMillions, formatPercent } from "../../src/lib/format";
import type { Offer } from "../../src/lib/recommend/offers";
import { recommend, type Need, type Purpose, type RankedOffer } from "../../src/lib/recommend/recommend";

const today = new Date("2026-11-03T00:00:00Z");
const offers = loadSnapshot().offers;
const need = (o: Partial<Need> = {}): Need => ({
  purpose: "other",
  amountVnd: 20_000_000,
  termMonths: 24,
  urgency: "flexible",
  monthlyIncomeVnd: 20_000_000,
  existingDebtVnd: 0,
  age: 30,
  incomeProof: "bank_salary",
  ...o,
});
const c = (l: LoanCost) => ({
  received: l.amountReceivedVnd,
  first: l.firstPaymentVnd,
  last: l.lastPaymentVnd,
  max: l.maxPaymentVnd,
  totalPaid: l.totalPaidVnd,
  totalCost: l.totalCostVnd,
  irr: l.monthlyIrr,
  nominal: l.aprNominal,
  effective: l.aprEffective,
});
const r = (x: RankedOffer) => ({
  key: x.offer.key,
  low: c(x.low),
  high: c(x.high),
  fit: x.fit,
  feesAllUnknown: x.feesAllUnknown,
  ins: x.insuranceCosts.map((i) => ({ name: i.nameVi, mandatory: i.mandatory, min: i.minVnd, max: i.maxVnd, costHigh: c(i.costHigh) })),
  sentenceVi: `${formatMillions(x.low.totalPaidVnd, "vi")} - ${formatMillions(x.high.totalPaidVnd, "vi")}`,
  aprVi: `${formatPercent(x.low.aprNominal, "vi")} - ${formatPercent(x.high.aprNominal, "vi")}`,
});
const run = (n: Need, list: readonly Offer[] = offers) => {
  const x = recommend(n, list, today);
  return {
    verdict: x.verdict,
    headroom: x.headroomVnd,
    principalOnly: x.principalOnlyVnd,
    suggested: x.suggestedAmountVnd,
    someDontFit: x.someDontFit,
    ranked: x.ranked.map(r),
    ineligible: x.ineligible.map((i) => i.offer.key),
  };
};
const only = (k: string) => offers.filter((o) => o.key === k);
const HC = "home-credit/cash-loan";
const FE = "fe-credit/tien-mat-linh-hoat";

// Grid for verdict and suggested amount
const grid = [];
for (const amountVnd of [3_000_000, 5_000_000, 10_000_000, 15_000_000, 20_000_000, 20_050_000, 50_000_000, 150_000_000])
  for (const termMonths of [6, 12, 18, 24, 36])
    for (const monthlyIncomeVnd of [0, 3_000_000, 4_375_000, 5_000_000, 7_000_000, 8_000_000, 10_000_000, 12_345_678, 15_000_000, 20_000_000, 40_000_000])
      for (const existingDebtVnd of [0, 1_500_000, 5_000_000])
        for (const age of [22, 30])
          for (const purpose of ["other", "phone", "motorbike"] as Purpose[]) {
            const n = need({ amountVnd, termMonths, monthlyIncomeVnd, existingDebtVnd, age, purpose });
            const x = recommend(n, offers, today);
            grid.push({
              amountVnd,
              termMonths,
              monthlyIncomeVnd,
              existingDebtVnd,
              age,
              purpose,
              verdict: x.verdict,
              headroom: x.headroomVnd,
              suggested: x.suggestedAmountVnd,
              keys: x.ranked.map((q) => q.offer.key),
              fits: x.ranked.map((q) => q.fit),
            });
          }

// Floor of income x 0.4 against exact integer arithmetic
let floorMismatch = 0;
let floorChecked = 0;
for (let i = 1; i <= 3_000_000; i++) {
  const inc = i * 37 + (i % 5);
  floorChecked++;
  if (Math.floor(inc * 0.4) !== Number((BigInt(inc) * BigInt(2)) / BigInt(5))) floorMismatch++;
}

// Hypothetical mandatory insurance (no real product has one today) to exercise the suggestion path
const vp = only("vpbank/vpbank-vay-tin-chap-online")[0];
const mandatory = (collection: "added_to_loan" | "deducted_from_payout"): Offer[] => [
  {
    ...vp,
    feesCompleteness: "complete",
    insurance: [
      { ...vp.insurance[0], mandatory: true, collection, method: "percent_of_principal", ratePercentMin: 5, ratePercentMax: 10, insuredTiers: null, fixedVnd: null },
    ],
  },
];

const ex = computeLoanCost({ principalVnd: 24_000_000, termMonths: 24, rate: { percent: 1.5, basis: "flat", period: "monthly" } });

const probes = [999_999, 1_000_000, 1_049_999, 1_050_000, 20_040_000, 25_958_336, 27_449_999, 32_640_000, 999_950_000, 999_999_999, 1_000_000_000, 1_049_000_000];

console.log(
  JSON.stringify({
    t24: run(need()),
    t12: run(need({ termMonths: 12 })),
    t36: run(need({ termMonths: 36 })),
    boundaries: {
      exact40: run(need({ monthlyIncomeVnd: 4_375_000 }), only(HC)),
      oneBelow40: run(need({ monthlyIncomeVnd: 4_374_999 }), only(HC)),
      ep_avgFitsFirstNot: run(need({ monthlyIncomeVnd: 3_500_000 }), only(HC)),
      principalFits: run(need({ monthlyIncomeVnd: 2_083_335 })),
      principalFails: run(need({ monthlyIncomeVnd: 2_083_334 })),
      principalFailsWithDebt: run(need({ monthlyIncomeVnd: 4_000_000, existingDebtVnd: 800_000 })),
      feFee_income: run(need({ monthlyIncomeVnd: 4_043_353 }), only(FE)),
      feFee_below: run(need({ monthlyIncomeVnd: 4_043_352 }), only(FE)),
      noOffersPrincipalFits: run(need({ monthlyIncomeVnd: 2_083_335 }), []),
      noOffersPrincipalFails: run(need({ monthlyIncomeVnd: 2_083_334 }), []),
      shinhanOnly: run(need(), only("shinhan-finance/personal-unsecured-loan")),
      allDebt: run(need({ monthlyIncomeVnd: 10_000_000, existingDebtVnd: 4_000_000 })),
    },
    synthetic: {
      added: run(need({ monthlyIncomeVnd: 5_000_000, existingDebtVnd: 1_000_000 }), mandatory("added_to_loan")),
      deducted: run(need({ monthlyIncomeVnd: 5_000_000, existingDebtVnd: 1_000_000 }), mandatory("deducted_from_payout")),
    },
    collapse: run(need({ amountVnd: 3_050_000, termMonths: 6 }), only(HC)),
    grid,
    floorChecked,
    floorMismatch,
    landing: {
      totalPaid: ex.totalPaidVnd,
      nominal: ex.aprNominal,
      effective: ex.aprEffective,
      first: ex.firstPaymentVnd,
      last: ex.lastPaymentVnd,
      amountVi: formatMillions(ex.amountReceivedVnd, "vi"),
      totalVi: formatMillions(ex.totalPaidVnd, "vi"),
      aprVi: formatPercent(ex.aprNominal, "vi"),
      term: ex.schedule.length,
    },
    probes: probes.map((p) => [p, formatMillions(p, "vi"), formatMillions(p, "en")]),
  }),
);
