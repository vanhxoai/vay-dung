import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLenders, oldestListDate } from "./lenders";

describe("loadLenders", () => {
  it("includes every file in data/lenders and they all parse", () => {
    const files = readdirSync(join(process.cwd(), "data", "lenders")).filter((f) => f.endsWith(".json"));
    const slugs = loadLenders().map((l) => `${l.slug}.json`);
    expect(slugs.sort()).toEqual(files.sort());
  });
});

describe("oldestListDate", () => {
  it("uses the oldest list, not the first, and falls back to the retrieval date", () => {
    const sources = [
      { asOf: "2026-09-30", retrievedAt: "2026-11-01" },
      { asOf: null, retrievedAt: "2026-08-15" },
      { asOf: "2026-10-01", retrievedAt: "2026-11-01" },
    ];
    expect(oldestListDate(sources)).toBe("2026-08-15");
  });
});
