/**
 * Internal rate of return for monthly cash flows.
 * flows[0] is at t=0 (money received: positive), flows[t] at month t (payments: negative).
 * Returns the monthly rate r such that Σ flows[t] / (1 + r)^t = 0.
 *
 * Newton's method from a sensible start, with a bisection fallback that always
 * converges for loan-shaped flows (one sign change ⇒ exactly one root above −1).
 */

const TOLERANCE = 1e-12;
const MAX_ITER = 200;

function npv(flows: readonly number[], r: number): number {
  let total = 0;
  for (let t = 0; t < flows.length; t++) total += flows[t] / Math.pow(1 + r, t);
  return total;
}

function dNpv(flows: readonly number[], r: number): number {
  let total = 0;
  for (let t = 1; t < flows.length; t++) total -= (t * flows[t]) / Math.pow(1 + r, t + 1);
  return total;
}

function assertLoanShaped(flows: readonly number[]) {
  if (flows.length < 2) throw new Error("need at least two cash flows");
  if (!(flows[0] > 0)) throw new Error("flows[0] must be the (positive) amount received");
  const paid = flows.slice(1).reduce((a, b) => a - b, 0);
  if (!(paid > 0) || flows.slice(1).some((f) => f > 0)) throw new Error("payments must be negative");
}

/**
 * Bisection. For loan-shaped flows (+received, then −payments) the NPV RISES as r
 * rises (payments are discounted more), so the root has NPV < 0 below it and > 0 above.
 */
export function monthlyIrrBisection(flows: readonly number[]): number {
  assertLoanShaped(flows);
  let lo = -0.999999;
  let hi = 1;
  while (npv(flows, hi) < 0 && hi < 1e9) hi *= 2;
  for (let i = 0; i < 2000 && hi - lo > TOLERANCE * Math.max(1, Math.abs(lo)); i++) {
    const mid = (lo + hi) / 2;
    if (npv(flows, mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function monthlyIrr(flows: readonly number[]): number {
  assertLoanShaped(flows);
  let r = 0.02;
  for (let i = 0; i < MAX_ITER; i++) {
    const f = npv(flows, r);
    const d = dNpv(flows, r);
    if (!Number.isFinite(f) || !Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (!Number.isFinite(next) || next <= -0.99) break;
    if (Math.abs(next - r) < TOLERANCE) return next;
    r = next;
  }
  return monthlyIrrBisection(flows);
}
