/**
 * Money is always whole VND (integers). Rates are plain numbers (fractions, e.g.
 * 0.015 = 1.5%) for IRR/APR, but every VND amount derived from a rate is
 * computed EXACTLY with integer arithmetic (see `percentOf`), so a value that is
 * exactly half a đồng always rounds the documented way (half away from zero).
 */

export type Vnd = number;

export function assertVnd(amount: number, label = "amount"): asserts amount is Vnd {
  if (!Number.isSafeInteger(amount)) throw new Error(`${label} must be a whole number of VND, got ${amount}`);
}

/** Rounds a fractional VND value to the nearest đồng (half away from zero). */
export function roundVnd(x: number): Vnd {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

export function sumVnd(xs: readonly Vnd[]): Vnd {
  return xs.reduce((a, b) => a + b, 0);
}

/** Decimal places kept when turning a percent like 1.41 or 16.22 into an exact integer. */
const PERCENT_SCALE = 1_000_000;

/**
 * Converts a decimal (e.g. a percent such as 1.41, or a multiplier such as 1.4) to an
 * exact integer numerator over PERCENT_SCALE. Throws if it has more than 6 decimals,
 * so nothing is silently rounded.
 */
export function scaled(x: number): bigint {
  const s = Math.round(x * PERCENT_SCALE);
  if (Math.abs(s - x * PERCENT_SCALE) > 1e-6 * Math.max(1, Math.abs(x))) throw new Error(`${x} has more than 6 decimal places`);
  return BigInt(s);
}

/** round(numerator / denominator), half away from zero, exactly. */
export function divRound(numerator: bigint, denominator: bigint): Vnd {
  if (denominator <= BigInt(0)) throw new Error("denominator must be positive");
  const negative = numerator < BigInt(0);
  const n = negative ? -numerator : numerator;
  const q = n / denominator;
  const r = n % denominator;
  const rounded = BigInt(2) * r >= denominator ? q + BigInt(1) : q;
  return Number(negative ? -rounded : rounded);
}

/**
 * amount × percent% ÷ divisor, rounded exactly to the đồng.
 * e.g. percentOf(8_961_380, 30, 12) = monthly interest at 30%/năm = 224,034.5 → 224,035.
 */
export function percentOf(amount: Vnd, percent: number, divisor = 1): Vnd {
  assertVnd(amount, "amount");
  if (!Number.isInteger(divisor) || divisor <= 0) throw new Error("divisor must be a positive integer");
  return divRound(BigInt(amount) * scaled(percent), BigInt(100 * PERCENT_SCALE) * BigInt(divisor));
}
