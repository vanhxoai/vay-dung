/**
 * Checks data/licensed-institutions.json and every data/lenders/*.json file:
 * the Zod schema, licensing, internal consistency and data age.
 * Exits with code 1 if there is any error. Run with `npm run validate-data`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { validateLenderFile, validateLicensedList, type Issue } from "../src/lib/data/validate";

const root = process.cwd();
const listPath = join("data", "licensed-institutions.json");
const lendersDir = join("data", "lenders");
// Data dates are Vietnam calendar dates (UTC+7, no DST). Use Vietnam's "today" at noon UTC
// so a figure retrieved this morning in Hanoi isn't "in the future" by UTC.
const vietnamDate = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const today = new Date(`${vietnamDate}T12:00:00Z`);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

const issues: Issue[] = [];

let list;
if (!existsSync(join(root, listPath))) {
  issues.push({ level: "error", file: listPath, message: "file is missing" });
} else {
  const r = validateLicensedList(listPath, readJson(listPath), today);
  list = r.list;
  issues.push(...r.issues);
}

const files = readdirSync(join(root, lendersDir)).filter((f) => f.endsWith(".json"));
let products = 0;
for (const f of files) {
  const path = join(lendersDir, f);
  let raw: unknown;
  try {
    raw = readJson(path);
  } catch (e) {
    issues.push({ level: "error", file: path, message: `invalid JSON: ${(e as Error).message}` });
    continue;
  }
  const r = validateLenderFile(path, basename(f, ".json"), raw, list, today);
  products += r.lender?.products.length ?? 0;
  issues.push(...r.issues);
}

for (const i of issues) console.log(`${i.level === "error" ? "✗ ERROR" : "! warn "}  ${i.file}: ${i.message}`);

const errors = issues.filter((i) => i.level === "error").length;
const warnings = issues.length - errors;
console.log(
  `\nvalidate-data: ${list?.institutions.length ?? 0} licensed institutions, ${files.length} lender files, ` +
    `${products} products — ${errors} error(s), ${warnings} warning(s).`,
);
process.exit(errors > 0 ? 1 : 0);
