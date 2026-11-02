import { describe, expect, it } from "vitest";
import { computeLoanCost } from "./cost";

const yearly = (percent: number) => ({ percent, basis: "reducing" as const, period: "yearly" as const });
const flatMonthly = (percent: number) => ({ percent, basis: "flat" as const, period: "monthly" as const });

describe("computeLoanCost: reducing balance, no fees", () => {
  // 12M, 12 months, 12%/năm (1%/tháng): instalment 1,066,185; total 12,794,226 (schedule.test)
  const c = computeLoanCost({ principalVnd: 12_000_000, termMonths: 12, rate: yearly(12) });

  it("with no fees, the real APR equals the quoted rate (12%; effective 12.68%)", () => {
    expect(c.aprNominal).toBeCloseTo(0.12, 4);
    expect(c.aprEffective).toBeCloseTo(0.126825, 4);
  });

  it("you receive 12,000,000; repay 12,794,226; cost 794,226 = total interest", () => {
    expect(c.amountReceivedVnd).toBe(12_000_000);
    expect(c.totalRepaidVnd).toBe(12_794_226);
    expect(c.totalCostVnd).toBe(794_226);
    expect(c.totalInterestVnd).toBe(794_226);
    expect(c.firstPaymentVnd).toBe(1_066_185);
  });
});

describe("computeLoanCost: flat rate (the headline problem)", () => {
  it("FE Credit's example: 10M, 12 months, 1.41%/tháng flat → real APR ≈ 29.9%/năm, not 16.92%", () => {
    // Cash flows: +10,000,000 then −974,333 ×11, −974,337. IRR ≈ 2.4909%/month.
    // Cross-checked in Python (bisection): r = 0.0249088447 → ×12 = 29.89%; (1+r)^12−1 = 34.35%.
    const c = computeLoanCost({ principalVnd: 10_000_000, termMonths: 12, rate: flatMonthly(1.41) });
    expect(c.totalRepaidVnd).toBe(11_692_000);
    expect(c.totalCostVnd).toBe(1_692_000);
    expect(c.monthlyIrr).toBeCloseTo(0.0249088447, 9);
    expect(c.aprNominal).toBeCloseTo(0.298906, 5);
    expect(c.aprEffective).toBeCloseTo(0.343454, 5);
  });

  it("1.5%/tháng flat over 24 months ≈ 31.46%/năm real, about 1.75× the quoted 18%/năm (CLAUDE.md: '≈1.8×')", () => {
    // 24M: instalment = 1,000,000 + 360,000 = 1,360,000; IRR (Python) 2.62160%/month
    const c = computeLoanCost({ principalVnd: 24_000_000, termMonths: 24, rate: flatMonthly(1.5) });
    expect(c.firstPaymentVnd).toBe(1_360_000);
    expect(c.totalRepaidVnd).toBe(32_640_000);
    expect(c.aprNominal).toBeCloseTo(0.314592, 5);
    expect(c.aprNominal / 0.18).toBeGreaterThan(1.7);
    expect(c.aprNominal / 0.18).toBeLessThan(1.8);
  });

  it("a flat quote always uses the flat schedule, even if annuity is requested", () => {
    const c = computeLoanCost({ principalVnd: 10_000_000, termMonths: 12, rate: flatMonthly(1.41), amortization: "annuity" });
    expect(c.totalRepaidVnd).toBe(11_692_000);
  });
});

describe("computeLoanCost: fees and insurance", () => {
  it("an upfront fee deducted from the payout lowers the money received and raises the APR", () => {
    // 20M, 24 months, 24%/năm reducing, 3% fee (600,000) deducted.
    // Instalment = 400,000 / (1 − 1.02^−24) = 1,057,421.95 → 1,057,422
    // You receive 19,400,000 but repay on 20,000,000. Python IRR on +19.4M / −1,057,422×24: 2.2707%/month → 27.25%/năm
    const c = computeLoanCost({
      principalVnd: 20_000_000,
      termMonths: 24,
      rate: yearly(24),
      charges: [{ label: "Phí hồ sơ", amountVnd: 600_000, timing: "deducted_from_payout" }],
    });
    expect(c.amountReceivedVnd).toBe(19_400_000);
    expect(c.firstPaymentVnd).toBe(1_057_422);
    expect(c.totalCostVnd).toBe(c.totalRepaidVnd - 19_400_000);
    expect(c.aprNominal).toBeCloseTo(0.27248, 4);
    expect(c.aprNominal).toBeGreaterThan(0.24);
  });

  it("a fee paid upfront out of pocket costs the same as one deducted from the payout", () => {
    const base = { principalVnd: 20_000_000, termMonths: 24, rate: yearly(24) };
    const deducted = computeLoanCost({ ...base, charges: [{ label: "fee", amountVnd: 600_000, timing: "deducted_from_payout" }] });
    const paid = computeLoanCost({ ...base, charges: [{ label: "fee", amountVnd: 600_000, timing: "paid_upfront" }] });
    expect(paid.aprNominal).toBe(deducted.aprNominal);
    expect(paid.totalCostVnd).toBe(deducted.totalCostVnd);
  });

  it("insurance added to the loan raises every instalment, but you never receive it (TPFico-style premium)", () => {
    // 10M, 24 months, 30%/năm reducing; premium 10M × 140% × 2.5% × 24/12 = 700,000 financed → schedule on 10,700,000
    const c = computeLoanCost({
      principalVnd: 10_000_000,
      termMonths: 24,
      rate: yearly(30),
      charges: [{ label: "Bảo hiểm khoản vay", amountVnd: 700_000, timing: "added_to_loan" }],
    });
    expect(c.amountReceivedVnd).toBe(10_000_000);
    expect(c.financedPrincipalVnd).toBe(10_700_000);
    // 10,700,000 × 0.025 / (1 − 1.025^−24) = 598,267.3 → 598,267
    expect(c.firstPaymentVnd).toBe(598_267);
    expect(c.aprNominal).toBeGreaterThan(0.3);
    expect(c.aprNominal).toBeCloseTo(0.374651, 5);
  });

  it("a monthly fee (e.g. 12,000đ collection fee) is added to each payment and to the APR", () => {
    const base = { principalVnd: 100_000_000, termMonths: 60, rate: yearly(20) };
    const without = computeLoanCost(base);
    const withFee = computeLoanCost({ ...base, charges: [{ label: "Phí thu hộ", amountVnd: 12_000, timing: "monthly" }] });
    expect(withFee.firstPaymentVnd).toBe(without.firstPaymentVnd + 12_000);
    expect(withFee.totalRepaidVnd).toBe(without.totalRepaidVnd + 60 * 12_000);
    expect(withFee.totalChargesVnd).toBe(720_000);
    expect(withFee.aprNominal).toBeGreaterThan(without.aprNominal);
  });

  it("rejects charges that exceed the loan, negative or fractional charges", () => {
    const base = { principalVnd: 1_000_000, termMonths: 12, rate: yearly(20) };
    expect(() => computeLoanCost({ ...base, charges: [{ label: "x", amountVnd: 1_000_000, timing: "deducted_from_payout" }] })).toThrow();
    expect(() => computeLoanCost({ ...base, charges: [{ label: "x", amountVnd: -1, timing: "monthly" }] })).toThrow();
    expect(() => computeLoanCost({ ...base, charges: [{ label: "x", amountVnd: 0.5, timing: "monthly" }] })).toThrow();
  });
});

describe("computeLoanCost: very short and very long terms", () => {
  it("3 months, 2%/tháng reducing: APR ≈ 24%", () => {
    // 100,000 / (1 − 1.02^−3) = 100,000 / 0.0576776 = 1,733,773.36 → 1,733,773 (×2), last 1,733,775 absorbs rounding
    // Interest: 100,000 + 67,325 + 33,996 = 201,321
    const c = computeLoanCost({ principalVnd: 5_000_000, termMonths: 3, rate: { percent: 2, basis: "reducing", period: "monthly" } });
    expect(c.schedule.map((r) => r.total)).toEqual([1_733_773, 1_733_773, 1_733_775]);
    expect(c.aprNominal).toBeCloseTo(0.24, 4);
    expect(c.totalRepaidVnd).toBe(5_201_321);
  });

  it("60 months, 20%/năm reducing: APR ≈ 20%; total interest ≈ 59M on 100M", () => {
    const c = computeLoanCost({ principalVnd: 100_000_000, termMonths: 60, rate: yearly(20) });
    expect(c.schedule).toHaveLength(60);
    expect(c.aprNominal).toBeCloseTo(0.2, 4);
    // 100M × (0.2/12) / (1 − (1+0.2/12)^−60) = 2,649,388 → total ≈ 158.96M
    expect(c.firstPaymentVnd).toBe(2_649_388);
    expect(c.totalInterestVnd).toBeGreaterThan(58_900_000);
    expect(c.totalInterestVnd).toBeLessThan(59_000_000);
  });
});

describe("computeLoanCost: integer money everywhere", () => {
  it("every VND output is a whole number", () => {
    const c = computeLoanCost({
      principalVnd: 33_333_333,
      termMonths: 37,
      rate: yearly(37.7),
      charges: [
        { label: "a", amountVnd: 333_333, timing: "deducted_from_payout" },
        { label: "b", amountVnd: 12_345, timing: "monthly" },
      ],
    });
    const vnd = [c.amountReceivedVnd, c.firstPaymentVnd, c.maxPaymentVnd, c.totalRepaidVnd, c.totalCostVnd, c.totalInterestVnd, c.totalChargesVnd];
    for (const v of vnd) expect(Number.isInteger(v)).toBe(true);
    for (const r of c.schedule) expect(Number.isInteger(r.total)).toBe(true);
  });
});
