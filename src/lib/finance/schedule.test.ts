import { describe, expect, it } from "vitest";
import { annuityPayment, buildSchedule } from "./schedule";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("annuityPayment", () => {
  it("12,000,000 over 12 months at 1%/month", () => {
    // P·r / (1 − (1+r)^−n) = 120,000 / (1 − 1.01^−12) = 120,000 / 0.1125508 = 1,066,185.46 → 1,066,185
    expect(annuityPayment(12_000_000, 0.01, 12)).toBe(1_066_185);
  });

  it("Shinhan's published example: 300M, 48 months, 18%/năm reducing → 8,812,500/month", () => {
    // r = 1.5%: 4,500,000 / (1 − 1.015^−48) = 4,500,000 / 0.5106383 = 8,812,499.88 → 8,812,500
    expect(annuityPayment(300_000_000, 0.015, 48)).toBe(8_812_500);
  });

  it("0% → principal ÷ months", () => {
    expect(annuityPayment(12_000_000, 0, 12)).toBe(1_000_000);
  });
});

describe("buildSchedule: annuity", () => {
  const rows = buildSchedule(12_000_000, 0.01, 12, "annuity");

  it("month 1: interest = 12,000,000 × 1% = 120,000; principal = 1,066,185 − 120,000 = 946,185", () => {
    expect(rows[0]).toEqual({ month: 1, payment: 1_066_185, interest: 120_000, principal: 946_185, balance: 11_053_815 });
  });

  it("every instalment but the last is equal; the last absorbs rounding (within a few đồng)", () => {
    expect(new Set(rows.slice(0, 11).map((r) => r.payment))).toEqual(new Set([1_066_185]));
    expect(Math.abs(rows[11].payment - 1_066_185)).toBeLessThanOrEqual(12);
  });

  it("principal repaid equals the amount borrowed exactly; balance ends at 0", () => {
    expect(sum(rows.map((r) => r.principal))).toBe(12_000_000);
    expect(rows[11].balance).toBe(0);
  });

  it("all amounts are whole đồng", () => {
    for (const r of rows) for (const v of [r.payment, r.interest, r.principal, r.balance]) expect(Number.isInteger(v)).toBe(true);
  });
});

describe("buildSchedule: flat (interest on the original amount)", () => {
  // FE Credit's published example: 10,000,000, 12 months, 1.41%/tháng flat
  const rows = buildSchedule(10_000_000, 0.0141, 12, "flat");

  it("interest is 10,000,000 × 1.41% = 141,000 every month, even as the balance falls", () => {
    expect(rows.every((r) => r.interest === 141_000)).toBe(true);
  });

  it("principal 10,000,000 ÷ 12 = 833,333 (last month 833,337); instalment 974,333", () => {
    expect(rows[0].payment).toBe(974_333);
    expect(rows[11].principal).toBe(833_337);
  });

  it("total repaid = 10,000,000 + 12 × 141,000 = 11,692,000 (matches FE's page)", () => {
    expect(sum(rows.map((r) => r.payment))).toBe(11_692_000);
  });
});

describe("buildSchedule: equal principal (falling instalments)", () => {
  // Home Credit's published example: 20,000,000, 12 months, 0.75%/tháng on the remaining balance
  const rows = buildSchedule(20_000_000, 0.0075, 12, "equal_principal");

  it("month 1: principal 1,666,666 + interest 150,000 = 1,816,666 (page shows ≈1,817,000)", () => {
    expect(rows[0]).toMatchObject({ principal: 1_666_666, interest: 150_000, payment: 1_816_666 });
  });

  it("instalments fall each month", () => {
    for (let i = 1; i < 12; i++) expect(rows[i].payment).toBeLessThan(rows[i - 1].payment);
  });

  it("total interest ≈ 20,000,000 × 0.75% × (12+1)/2 = 975,000 (matches the page's total 20,975,000)", () => {
    expect(sum(rows.map((r) => r.interest))).toBe(975_000);
    expect(sum(rows.map((r) => r.payment))).toBe(20_975_000);
  });
});

describe("buildSchedule: validation", () => {
  it("rejects non-integer money, zero/negative principal, bad terms and rates", () => {
    expect(() => buildSchedule(1000.5, 0.01, 12, "annuity")).toThrow();
    expect(() => buildSchedule(0, 0.01, 12, "annuity")).toThrow();
    expect(() => buildSchedule(1_000_000, 0.01, 0, "annuity")).toThrow();
    expect(() => buildSchedule(1_000_000, 0.01, 1.5, "annuity")).toThrow();
    expect(() => buildSchedule(1_000_000, -0.01, 12, "annuity")).toThrow();
  });

  it("a one-month loan repays everything at once", () => {
    expect(buildSchedule(1_000_000, 0.02, 1, "annuity")).toEqual([
      { month: 1, payment: 1_020_000, interest: 20_000, principal: 1_000_000, balance: 0 },
    ]);
  });
});
