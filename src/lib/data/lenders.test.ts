import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLenders } from "./lenders";

describe("loadLenders", () => {
  it("includes every file in data/lenders and they all parse", () => {
    const files = readdirSync(join(process.cwd(), "data", "lenders")).filter((f) => f.endsWith(".json"));
    const slugs = loadLenders().map((l) => `${l.slug}.json`);
    expect(slugs.sort()).toEqual(files.sort());
  });
});
