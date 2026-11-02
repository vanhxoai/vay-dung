import { describe, expect, it } from "vitest";
import { lateWarning } from "./late";

describe("lateWarning", () => {
  it("150% of a 45%/năm contract rate = 67.5%/năm on overdue principal", () => {
    // 30 days late on 1,000,000 principal: 1,000,000 × 0.675 × 30/365 = 55,479.45 → 55,479
    const w = lateWarning({ overduePrincipalRateMultiplier: 1.5, overdueInterestRatePercentYear: 10 }, 0.45, 1_000_000);
    expect(w.overduePrincipalYearlyRate).toBeCloseTo(0.675, 12);
    expect(w.overdueInterestYearlyRate).toBeCloseTo(0.1, 12);
    expect(w.extraCostFor30DaysVnd).toBe(55_479);
  });

  it("includes interest on the overdue interest (10%/năm)", () => {
    // + 375,000 × 0.10 × 30/365 = 3,082.19 → total 55,479.45 + 3,082.19 = 58,561.64 → 58,562
    const w = lateWarning({ overduePrincipalRateMultiplier: 1.5, overdueInterestRatePercentYear: 10 }, 0.45, 1_000_000, 375_000);
    expect(w.extraCostFor30DaysVnd).toBe(58_562);
  });

  it("unknown multiplier → unknown (never guessed)", () => {
    expect(lateWarning({ overduePrincipalRateMultiplier: null, overdueInterestRatePercentYear: null }, 0.3, 1_000_000)).toEqual({
      overduePrincipalYearlyRate: null,
      overdueInterestYearlyRate: null,
      extraCostFor30DaysVnd: null,
    });
  });

  it("unknown overdue-interest rate with interest overdue → total unknown, principal part still shown", () => {
    const w = lateWarning({ overduePrincipalRateMultiplier: 1.5, overdueInterestRatePercentYear: null }, 0.45, 1_000_000, 375_000);
    expect(w.overduePrincipalYearlyRate).toBeCloseTo(0.675, 12);
    expect(w.extraCostFor30DaysVnd).toBeNull();
  });
});
