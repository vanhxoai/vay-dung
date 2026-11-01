import { describe, expect, it } from "vitest";
import { formatVnd } from "./format";

// Intl uses a non-breaking space before "₫"; normalize it for readable assertions.
const plain = (s: string) => s.replace(/ /g, " ");

describe("formatVnd", () => {
  it("uses dots as thousands separators and the ₫ sign", () => {
    expect(plain(formatVnd(20_000_000))).toBe("20.000.000 ₫");
  });

  it("formats zero", () => {
    expect(plain(formatVnd(0))).toBe("0 ₫");
  });

  it("rejects non-integer money", () => {
    expect(() => formatVnd(1000.5)).toThrow();
  });
});
