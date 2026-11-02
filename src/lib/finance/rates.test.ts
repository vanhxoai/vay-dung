import { describe, expect, it } from "vitest";
import { effectiveYearly, monthlyFraction, nominalYearly } from "./rates";

describe("monthlyFraction", () => {
  it("monthly quotes: 1.5%/tháng → 0.015", () => {
    expect(monthlyFraction({ percent: 1.5, basis: "reducing", period: "monthly" })).toBeCloseTo(0.015, 12);
  });

  it("yearly quotes are divided by 12: 18%/năm → 0.015", () => {
    expect(monthlyFraction({ percent: 18, basis: "reducing", period: "yearly" })).toBeCloseTo(0.015, 12);
  });

  it("rejects negative or non-numeric rates", () => {
    expect(() => monthlyFraction({ percent: -1, basis: "flat", period: "monthly" })).toThrow();
    expect(() => monthlyFraction({ percent: NaN, basis: "flat", period: "monthly" })).toThrow();
  });
});

describe("nominal vs effective yearly rate", () => {
  // 1%/month: nominal 12 × 1% = 12%; effective 1.01^12 − 1 = 12.6825%
  it("1%/month", () => {
    expect(nominalYearly(0.01)).toBeCloseTo(0.12, 12);
    expect(effectiveYearly(0.01)).toBeCloseTo(0.126825030131970, 12);
  });

  it("0% stays 0%", () => {
    expect(nominalYearly(0)).toBe(0);
    expect(effectiveYearly(0)).toBe(0);
  });
});
