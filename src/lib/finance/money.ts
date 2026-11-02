/**
 * Money is always whole VND (integers). Rates are plain numbers (fractions, e.g.
 * 0.015 = 1.5%) and may be fractional. Rounding happens once per instalment, never
 * on intermediate rates.
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
