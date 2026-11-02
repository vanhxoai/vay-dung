import { describe, expect, it } from "vitest";
import { formatDate, formatMillions, formatMoneyInput, formatPercent, formatRate, formatVnd, parseMoneyInput } from "./format";

describe("plain-language amounts", () => {
  it("formatMillions", () => {
    expect(formatMillions(27_400_000, "vi")).toBe("27,4 triệu");
    expect(formatMillions(27_400_000, "en")).toBe("27.4 million");
    expect(formatMillions(20_000_000, "vi")).toBe("20 triệu");
    expect(formatMillions(1_500_000_000, "vi")).toBe("1,5 tỷ");
    expect(formatMillions(200_000, "vi").replace(/ /g, " ")).toBe("200.000 ₫");
  });

  it("formatPercent and formatRate", () => {
    expect(formatPercent(0.309, "vi")).toBe("30,9%");
    expect(formatPercent(0.309, "en")).toBe("30.9%");
    expect(formatRate(1.41, "vi")).toBe("1,41");
  });

  it("formatDate", () => {
    expect(formatDate("2026-11-01")).toBe("01/11/2026");
  });
});

describe("money inputs", () => {
  it("parses what people type", () => {
    expect(parseMoneyInput("20.000.000")).toBe(20_000_000);
    expect(parseMoneyInput("20,000,000")).toBe(20_000_000);
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("15tr")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("3 triệu")).toBeNull();
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("99999999999999999999")).toBeNull();
  });

  it("formats for display", () => {
    expect(formatMoneyInput(20_000_000)).toBe("20.000.000");
  });
});

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
