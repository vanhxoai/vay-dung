import { describe, expect, it } from "vitest";
import {
  feeAmount,
  greaterOfPercentAndRemainingInterest,
  premiumOnDecliningBalance,
  premiumOnInsuredAmount,
  premiumPercentOfPrincipal,
} from "./charges";

describe("feeAmount", () => {
  it("percent with a minimum (VPBank early repayment: 4%, min 1,000,000đ)", () => {
    expect(feeAmount({ rule: "percent", percent: 4, minVnd: 1_000_000 }, 10_000_000)).toBe(1_000_000); // 4% = 400,000 < min
    expect(feeAmount({ rule: "percent", percent: 4, minVnd: 1_000_000 }, 50_000_000)).toBe(2_000_000); // 4% = 2,000,000
  });

  it("percent with a maximum (TPBank overdraft: 1% of the limit, min 200,000, max 2,000,000)", () => {
    const fee = { rule: "percent" as const, percent: 1, minVnd: 200_000, maxVnd: 2_000_000 };
    expect(feeAmount(fee, 10_000_000)).toBe(200_000); // 100,000 → min
    expect(feeAmount(fee, 100_000_000)).toBe(1_000_000);
    expect(feeAmount(fee, 500_000_000)).toBe(2_000_000); // 5,000,000 → max
  });

  it("fixed fees ignore the base", () => {
    expect(feeAmount({ rule: "fixed", amountVnd: 11_000 }, 99_000_000)).toBe(11_000);
  });

  it("rounds percent fees to the đồng", () => {
    expect(feeAmount({ rule: "percent", percent: 1.5 }, 1_000_001)).toBe(15_000); // 15,000.015
  });
});

describe("greaterOfPercentAndRemainingInterest (HD Saison early repayment)", () => {
  it("takes the higher of 6% of the outstanding principal and the remaining interest, with a minimum", () => {
    expect(greaterOfPercentAndRemainingInterest(6, 50_000_000, 2_000_000, 1_500_000)).toBe(3_000_000); // 6% wins
    expect(greaterOfPercentAndRemainingInterest(6, 50_000_000, 7_000_000, 1_500_000)).toBe(7_000_000); // interest wins
    expect(greaterOfPercentAndRemainingInterest(6, 10_000_000, 300_000, 1_500_000)).toBe(1_500_000); // minimum wins
  });
});

describe("insurance premiums", () => {
  it("TPFico's published examples: 2.5%/năm × insured amount × months/12", () => {
    const tiers = [
      { termMonthsMax: 24, multiplier: 1.4 },
      { termMonthsMax: null, multiplier: 1.1 },
    ];
    // 10,000,000 × 1.4 × 2.5% × 24/12 = 700,000
    expect(premiumOnInsuredAmount(10_000_000, 2.5, 24, tiers)).toBe(700_000);
    // 10,000,000 × 1.1 × 2.5% × 25/12 = 572,916.67 → 572,917
    expect(premiumOnInsuredAmount(10_000_000, 2.5, 25, tiers)).toBe(572_917);
  });

  it("percent of principal", () => {
    expect(premiumPercentOfPrincipal(20_000_000, 5.5)).toBe(1_100_000);
  });

  it("annual rate on the declining balance, summed (VPBank-style)", () => {
    // Opening balances 12M, 8M, 4M; 1.8%/năm → monthly 0.15%: 18,000 + 12,000 + 6,000 = 36,000
    expect(premiumOnDecliningBalance([12_000_000, 8_000_000, 4_000_000], 1.8)).toBe(36_000);
  });

  it("throws when no tier fits", () => {
    expect(() => premiumOnInsuredAmount(1_000_000, 2.5, 36, [{ termMonthsMax: 24, multiplier: 1.4 }])).toThrow();
  });
});
