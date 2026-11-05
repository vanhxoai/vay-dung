import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LicensedList } from "../../src/lib/data/schema";
import { loadSnapshot } from "../../src/lib/store";
import { sheetsToOffers } from "../../src/lib/store/workbook";
import { readSheets } from "./excel";
import { licensingIssues, toSnapshot } from "./import";

const list = LicensedList.parse(JSON.parse(readFileSync("data/licensed-institutions.json", "utf8")));

describe("the workbook on disk", () => {
  it("has no errors, and the app's snapshot matches it (run npm run data:import if not)", async () => {
    const { offers, issues } = sheetsToOffers(await readSheets());
    expect(issues).toEqual([]);
    expect(toSnapshot(offers).offers).toEqual(loadSnapshot().offers);
  });
});

describe("licensing", () => {
  const offers = loadSnapshot().offers;
  it("passes for every listed product", () => {
    expect(licensingIssues(offers, list)).toEqual([]);
  });
  it("refuses a lender that isn't on the State Bank's list", () => {
    const issues = licensingIssues([{ ...offers[0], licensedInstitutionId: "tin-dung-den" }], list);
    expect(issues[0]).toContain("licensed list");
  });
  it("refuses a legal name that differs from the list", () => {
    expect(licensingIssues([{ ...offers[0], legalName: "Công ty khác" }], list)).toHaveLength(1);
  });
});
