/**
 * Dumps the app engine's results for the independent-check cases as JSON.
 * Run: npx tsx scripts/check/engine_dump.ts > out.json
 * Compared against scripts/check/finance_check.py (which does NOT use this code).
 */
import {
  checkAffordability,
  computeLoanCost,
  maxAffordablePrincipal,
  monthlyIrr,
  premiumOnInsuredAmount,
  type LoanInput,
} from "../../src/lib/finance";

const yearly = (percent: number) => ({ percent, basis: "reducing" as const, period: "yearly" as const });
const monthly = (percent: number) => ({ percent, basis: "reducing" as const, period: "monthly" as const });

const tpficoPremium = premiumOnInsuredAmount(10_000_000, 2.5, 24, [
  { termMonthsMax: 24, multiplier: 1.4 },
  { termMonthsMax: null, multiplier: 1.1 },
]);

const loans: Record<string, LoanInput> = {
  "1_flat_fe": { principalVnd: 10_000_000, termMonths: 12, rate: { percent: 1.41, basis: "flat", period: "monthly" } },
  "2_reducing_nofee": { principalVnd: 12_000_000, termMonths: 12, rate: yearly(12) },
  "3_fee_deducted": {
    principalVnd: 20_000_000,
    termMonths: 24,
    rate: yearly(24),
    charges: [{ label: "fee", amountVnd: 600_000, timing: "deducted_from_payout" }],
  },
  "4_insurance_financed": {
    principalVnd: 10_000_000,
    termMonths: 24,
    rate: yearly(30),
    charges: [{ label: "insurance", amountVnd: tpficoPremium, timing: "added_to_loan" }],
  },
  "5_short_3m": { principalVnd: 5_000_000, termMonths: 3, rate: monthly(2) },
  "6_long_60m_monthly_fee": {
    principalVnd: 100_000_000,
    termMonths: 60,
    rate: yearly(20),
    charges: [{ label: "collection", amountVnd: 12_000, timing: "monthly" }],
  },
  "7_equal_principal_hc": { principalVnd: 20_000_000, termMonths: 12, rate: monthly(0.75), amortization: "equal_principal" },
  // Extra stress cases
  "x1_zero_rate": { principalVnd: 12_000_000, termMonths: 12, rate: yearly(0) },
  "x2_zero_rate_fee": {
    principalVnd: 12_000_000,
    termMonths: 12,
    rate: yearly(0),
    charges: [{ label: "fee", amountVnd: 500_000, timing: "deducted_from_payout" }],
  },
  "x3_very_high_flat": {
    principalVnd: 3_000_000,
    termMonths: 6,
    rate: { percent: 5, basis: "flat", period: "monthly" },
    charges: [{ label: "fee", amountVnd: 1_500_000, timing: "deducted_from_payout" }],
  },
  "x4_paid_upfront": {
    principalVnd: 20_000_000,
    termMonths: 24,
    rate: yearly(24),
    charges: [{ label: "fee", amountVnd: 600_000, timing: "paid_upfront" }],
  },
  "x5_120m_3pct": { principalVnd: 10_000_000, termMonths: 120, rate: monthly(3) },
  "x6_120m_zero": { principalVnd: 600_000_000, termMonths: 120, rate: yearly(0) },
  "x7_flat_yearly_quote": { principalVnd: 10_000_000, termMonths: 12, rate: { percent: 16.92, basis: "flat", period: "yearly" } },
};

const out: Record<string, unknown> = { tpficoPremium };
for (const [k, input] of Object.entries(loans)) {
  try {
    const c = computeLoanCost(input);
    out[k] = {
      amountReceived: c.amountReceivedVnd,
      financedPrincipal: c.financedPrincipalVnd,
      instalments: c.schedule.map((r) => r.total),
      totalRepaid: c.totalRepaidVnd,
      totalCost: c.totalCostVnd,
      totalInterest: c.totalInterestVnd,
      totalCharges: c.totalChargesVnd,
      monthlyIrr: c.monthlyIrr,
      aprNominal: c.aprNominal,
      aprEffective: c.aprEffective,
      lastBalance: c.schedule[c.schedule.length - 1].balance,
    };
  } catch (e) {
    out[k] = { error: String(e) };
  }
}

const a = checkAffordability(8_000_000, 3_000_000, 2_500_000);
out["8_affordability"] = { ...a, maxAffordablePrincipal: maxAffordablePrincipal(1_066_185, 0.01, 12) };

// Raw IRR probes: flows chosen so Newton cannot converge and the bisection fallback runs.
const probes: Record<string, number[]> = {
  // root ≈ −0.999 (repay much less than received): Newton steps below −0.99 and bails out
  p1_negative_root: [1000, -1],
  // receive 1, repay 1,000,000 a month later: root 999,999
  p2_huge_rate: [1, -1_000_000],
  // ordinary loan, for reference (Newton converges)
  p3_ordinary: [100, -110],
};
const irrOut: Record<string, unknown> = {};
for (const [k, f] of Object.entries(probes)) {
  try {
    irrOut[k] = monthlyIrr(f);
  } catch (e) {
    irrOut[k] = { error: String(e) };
  }
}
out["irr_probes"] = irrOut;

console.log(JSON.stringify(out, null, 2));
