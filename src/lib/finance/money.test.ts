import { describe, expect, it } from "vitest";
import { divRound, percentOf, scaled } from "./money";

describe("percentOf (exact integer arithmetic)", () => {
  it("rounds an exact half đồng UP, even when float maths says x.4999…", () => {
    // 8,961,380 × 30% / 12 = 224,034.5 exactly. In floating point 30/100/12 = 0.024999999999999998,
    // giving 224,034.49999999997 → 224,034. The documented rule (half away from zero) says 224,035.
    expect(8_961_380 * (30 / 100 / 12)).toBeLessThan(224_034.5);
    expect(percentOf(8_961_380, 30, 12)).toBe(224_035);
  });

  it("handles rates with decimals exactly: 10,000,000 × 1.41% = 141,000", () => {
    expect(percentOf(10_000_000, 1.41)).toBe(141_000);
    expect(percentOf(20_000_000, 16.22, 12)).toBe(270_333); // 270,333.33…
  });

  it("rounds below half down", () => {
    expect(percentOf(1_000_001, 1.5)).toBe(15_000); // 15,000.015
  });

  it("rejects fractional money and rates with more than 6 decimals", () => {
    expect(() => percentOf(1.5, 10)).toThrow();
    expect(() => scaled(1.1234567)).toThrow();
  });
});

describe("divRound", () => {
  it("half away from zero, both signs", () => {
    expect(divRound(BigInt(5), BigInt(2))).toBe(3);
    expect(divRound(BigInt(-5), BigInt(2))).toBe(-3);
    expect(divRound(BigInt(7), BigInt(3))).toBe(2);
  });
});
