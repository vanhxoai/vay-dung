/** Formats an integer VND amount Vietnamese-style, e.g. 20000000 → "20.000.000 ₫". */
export function formatVnd(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`VND amounts must be integers, got ${amount}`);
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}
