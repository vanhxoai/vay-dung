/**
 * Checks every lender file in data/lenders against the Zod schema and the
 * licensed-institutions list. Placeholder until Phase 1 adds the schema.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

const lendersDir = join(process.cwd(), "data", "lenders");
const files = readdirSync(lendersDir).filter((f) => f.endsWith(".json"));

console.log(`validate-data: found ${files.length} lender file(s). Schema checks arrive in Phase 1.`);
