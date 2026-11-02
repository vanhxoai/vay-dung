import { describe, expect, it } from "vitest";
import { monthlyIrr, monthlyIrrBisection } from "./irr";

describe("monthlyIrr", () => {
  it("one period: receive 100, repay 110 → 10%", () => {
    expect(monthlyIrr([100, -110])).toBeCloseTo(0.1, 12);
  });

  it("two periods: receive 100, repay 60 and 60 → r solves 100 = 60/(1+r) + 60/(1+r)²", () => {
    // 100(1+r)² − 60(1+r) − 60 = 0 → 1+r = (60 + √(3600 + 24000)) / 200 = (60 + 166.1325…) / 200
    const expected = (60 + Math.sqrt(27600)) / 200 - 1; // 0.130662…
    expect(monthlyIrr([100, -60, -60])).toBeCloseTo(expected, 12);
  });

  it("recovers the rate of an exact annuity (2%/month, 24 months)", () => {
    const p = (1000 * 0.02) / (1 - Math.pow(1.02, -24));
    expect(monthlyIrr([1000, ...Array(24).fill(-p)])).toBeCloseTo(0.02, 12);
  });

  it("zero interest → 0%", () => {
    expect(monthlyIrr([1200, ...Array(12).fill(-100)])).toBeCloseTo(0, 12);
  });

  it("handles very expensive loans (Newton may fail; bisection must not)", () => {
    // Receive 1,428,000, repay 2,040,000 one month later → 42.857…% per month
    expect(monthlyIrr([1_428_000, -2_040_000])).toBeCloseTo(2_040_000 / 1_428_000 - 1, 10);
    // Receive 100, repay 1,000 → 900% per month
    expect(monthlyIrr([100, -1000])).toBeCloseTo(9, 8);
  });

  it("the bisection fallback (called directly) agrees with Newton", () => {
    // Regression: the fallback once had its bracket inverted and returned ~1,048,576.
    const cases: number[][] = [
      [100, -110],
      [100, -60, -60],
      [1_428_000, -2_040_000],
      [10_000_000, ...Array(11).fill(-974_333), -974_337],
      [1200, ...Array(12).fill(-100)],
    ];
    for (const flows of cases) expect(monthlyIrrBisection(flows)).toBeCloseTo(monthlyIrr(flows), 9);
  });

  it("bisection handles a deeply negative IRR (repay far less than received)", () => {
    // 1000 received, 1 repaid: 1000 = 1/(1+r) → r = −0.999
    expect(monthlyIrrBisection([1000, -1])).toBeCloseTo(-0.999, 6);
    expect(monthlyIrr([1000, -1])).toBeCloseTo(-0.999, 6);
  });

  it("rejects flows that aren't loan-shaped", () => {
    expect(() => monthlyIrr([100])).toThrow();
    expect(() => monthlyIrr([-100, 110])).toThrow();
    expect(() => monthlyIrr([100, 50])).toThrow();
  });
});
