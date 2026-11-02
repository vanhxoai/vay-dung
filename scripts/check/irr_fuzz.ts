/**
 * Fuzzes monthlyIrr against an independent bisection (NPV of borrower flows RISES with r).
 * Run: npx tsx scripts/check/irr_fuzz.ts
 */
import { computeLoanCost, monthlyIrr } from "../../src/lib/finance";

function npv(f: number[], r: number) { let s = 0; for (let t = 0; t < f.length; t++) s += f[t] / Math.pow(1 + r, t); return s; }
function refIrr(f: number[]) {
  let lo = -0.999999, hi = 1;
  while (npv(f, hi) < 0) hi *= 2;
  for (let i = 0; i < 400; i++) { const m = (lo + hi) / 2; if (npv(f, m) < 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let bad = 0, n = 0; const worst: unknown[] = [];
for (let i = 0; i < 20000; i++) {
  const months = 1 + Math.floor(rnd() * 600);
  const principal = 1_000_000 + Math.floor(rnd() * 500) * 1_000_000;
  const pct = Math.round(rnd() * 1000) / 100; // 0–10 %/month
  const flat = rnd() < 0.3;
  const fee = rnd() < 0.5 ? Math.floor(principal * rnd() * 0.9) : 0;
  try {
    const c = computeLoanCost({ principalVnd: principal, termMonths: months, rate: { percent: pct, basis: flat ? "flat" : "reducing", period: "monthly" },
      charges: fee ? [{ label: "f", amountVnd: fee, timing: "deducted_from_payout" }] : [] });
    const flows = [c.amountReceivedVnd, ...c.schedule.map((r) => -r.total)];
    const ref = refIrr(flows); n++;
    if (Math.abs(c.monthlyIrr - ref) * 12 > 1e-4) { bad++; if (worst.length < 8) worst.push({ months, principal, pct, flat, fee, app: c.monthlyIrr, ref }); }
  } catch { /* invalid combos */ }
}
console.log(JSON.stringify({ checked: n, mismatches: bad, examples: worst }, null, 1));
// Cash-back style loan (repay less than received → negative IRR): Newton exits, bisection runs.
const cb = [10_000_000, ...Array(12).fill(-800_000)];
console.log(JSON.stringify({ cashback_12x800k_on_10M: { app: monthlyIrr(cb), ref: refIrr(cb) } }));
