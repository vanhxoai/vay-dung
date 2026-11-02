import { describe, expect, it } from "vitest";
import { checkAffordability, maxAffordablePrincipal } from "./affordability";
import { annuityPayment } from "./schedule";

describe("checkAffordability (guideline: total debt payments ≤ 40% of income)", () => {
  it("affordable: 15M income, no other debt, 2M new payment → 13.3%", () => {
    const a = checkAffordability(15_000_000, 0, 2_000_000);
    expect(a.verdict).toBe("ok");
    expect(a.debtToIncome).toBeCloseTo(2 / 15, 10);
    expect(a.maxTotalPaymentVnd).toBe(6_000_000);
    expect(a.headroomVnd).toBe(6_000_000);
  });

  it("over-borrowing (qa-tester persona): 8M income, 3M existing, 2.5M new → 68.75% → too much", () => {
    // limit 8M × 40% = 3,200,000; room for a new payment = 3,200,000 − 3,000,000 = 200,000
    const a = checkAffordability(8_000_000, 3_000_000, 2_500_000);
    expect(a.verdict).toBe("too_much");
    expect(a.debtToIncome).toBeCloseTo(0.6875, 10);
    expect(a.headroomVnd).toBe(200_000);
  });

  it("exactly at 40% is still within the guideline; 1đ over is not", () => {
    expect(checkAffordability(10_000_000, 1_000_000, 3_000_000).verdict).toBe("ok");
    expect(checkAffordability(10_000_000, 1_000_000, 3_000_001).verdict).toBe("too_much");
  });

  it("existing debt already above the limit → no headroom, any new loan is too much", () => {
    const a = checkAffordability(10_000_000, 5_000_000, 1);
    expect(a.headroomVnd).toBe(0);
    expect(a.verdict).toBe("too_much");
  });

  it("zero income → no_income (we never divide by zero or say it's fine)", () => {
    expect(checkAffordability(0, 0, 1_000_000)).toEqual({ verdict: "no_income", debtToIncome: null, maxTotalPaymentVnd: 0, headroomVnd: 0 });
  });

  it("rejects fractional money", () => {
    expect(() => checkAffordability(10_000_000.5, 0, 0)).toThrow();
  });
});

describe("maxAffordablePrincipal", () => {
  it("finds the true maximum in 100,000đ steps, using the ROUNDED instalment", () => {
    // Inverse of the unrounded formula: 1,066,185 × (1 − 1.01^−12) / 0.01 = 11,999,994.8 → floor 11,900,000,
    // but 12,000,000's rounded instalment is exactly 1,066,185, which fits, so the answer is 12,000,000.
    expect(maxAffordablePrincipal(1_066_185, 0.01, 12)).toBe(12_000_000);
    expect(maxAffordablePrincipal(1_066_184, 0.01, 12)).toBe(11_900_000);
  });

  it("the suggested amount's instalment never exceeds the limit", () => {
    for (const [pay, r, n] of [
      [3_000_000, 0.02, 24],
      [200_000, 0.03, 12],
      [6_000_000, 0.015, 36],
    ] as const) {
      const p = maxAffordablePrincipal(pay, r, n);
      expect(p % 100_000).toBe(0);
      if (p > 0) expect(annuityPayment(p, r, n)).toBeLessThanOrEqual(pay);
      expect(annuityPayment(p + 100_000, r, n)).toBeGreaterThan(pay);
    }
  });

  it("no room → 0; 0% rate → payment × months", () => {
    expect(maxAffordablePrincipal(0, 0.02, 12)).toBe(0);
    expect(maxAffordablePrincipal(1_000_000, 0, 12)).toBe(12_000_000);
  });
});
