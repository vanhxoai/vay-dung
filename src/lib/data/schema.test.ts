import { describe, expect, it } from "vitest";
import { sourced } from "./schema";
import { z } from "zod";

const SourcedVnd = sourced(z.number().int());

describe("sourced()", () => {
  it("accepts an unknown value with no source", () => {
    const r = SourcedVnd.safeParse({
      value: null,
      sourceUrl: null,
      retrievedAt: null,
      confidence: null,
      note: "not published",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a known value with full provenance", () => {
    const r = SourcedVnd.safeParse({
      value: 20_000_000,
      sourceUrl: "https://example.com/loan",
      retrievedAt: "2026-11-01",
      confidence: "high",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a known value without a source URL", () => {
    const r = SourcedVnd.safeParse({
      value: 20_000_000,
      sourceUrl: null,
      retrievedAt: "2026-11-01",
      confidence: "high",
    });
    expect(r.success).toBe(false);
  });

  it("rejects floating-point money", () => {
    const r = SourcedVnd.safeParse({
      value: 1000.5,
      sourceUrl: "https://example.com",
      retrievedAt: "2026-11-01",
      confidence: "high",
    });
    expect(r.success).toBe(false);
  });
});
