/**
 * Reads the workbook, checks every row, and writes what the app reads:
 *   data/store/snapshot.json and public/data/loan-rates.csv
 * Nothing is written if there's an error. Run with `npm run data:import`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { LicensedList } from "../../src/lib/data/schema";
import type { Offer } from "../../src/lib/recommend/offers";
import { Snapshot } from "../../src/lib/store/schema";
import { offersToCsv, SHEET_TITLES, sheetsToOffers } from "../../src/lib/store/workbook";
import { readSheets, WORKBOOK_PATH } from "./excel";

/** CLAUDE.md: a lender can only be listed if it appears on the SBV's published lists. */
export function licensingIssues(offers: readonly Offer[], list: LicensedList): string[] {
  const byId = new Map(list.institutions.map((i) => [i.id, i]));
  return offers.flatMap((o) => {
    const inst = byId.get(o.licensedInstitutionId);
    if (!inst) return [`${o.key}: "${o.licensedInstitutionId}" is not on the licensed list, so it can't be listed`];
    return inst.legalName === o.legalName ? [] : [`${o.key}: legal name differs from the licensed list ("${inst.legalName}")`];
  });
}

export function toSnapshot(offers: readonly Offer[]): Snapshot {
  const dates = offers.flatMap((o) => [o.retrievedAt, ...(o.rate ? [o.rate.retrievedAt] : [])]).sort();
  return Snapshot.parse({ schemaVersion: 1, dataAsOf: dates.at(-1), offers });
}

async function main() {
  const { offers, issues } = sheetsToOffers(await readSheets());
  const list = LicensedList.parse(JSON.parse(readFileSync("data/licensed-institutions.json", "utf8")));
  const licensing = licensingIssues(offers, list);
  for (const i of issues) console.log(`✗ ${i.sheet}, dòng ${i.row}: ${i.message}`);
  for (const m of licensing) console.log(`✗ ${SHEET_TITLES.products}: ${m}`);
  if (issues.length + licensing.length > 0) {
    console.log(`\nChưa nhập gì: ${issues.length + licensing.length} lỗi trong ${WORKBOOK_PATH}.`);
    process.exit(1);
  }
  writeFileSync("data/store/snapshot.json", JSON.stringify(toSnapshot(offers), null, 2) + "\n");
  mkdirSync("public/data", { recursive: true });
  writeFileSync("public/data/loan-rates.csv", "﻿" + offersToCsv(offers));
  const ranked = offers.filter((o) => !o.excludeFromRanking && o.rate !== null);
  const official = ranked.filter((o) => o.rate?.sourceType === "official").length;
  console.log(`Đã nhập ${offers.length} sản phẩm: ${ranked.length} được xếp hạng (${official} từ nguồn chính thức, ${ranked.length - official} từ nguồn khác).`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/store/import.ts")) void main();
