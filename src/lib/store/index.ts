/**
 * The only place the app reads loan data from. Everything else depends on `getLoanData`, so
 * swapping the store later (a database, an API) means changing this file and nothing else.
 *
 *   data/store/loan-data.xlsx  →  npm run data:import  →  data/store/snapshot.json  →  here
 *                                                 LOAN_RATES_CSV_URL (optional)  ↗
 */
import { createHash } from "node:crypto";
import type { Offer } from "@/lib/recommend/offers";
import raw from "../../../data/store/snapshot.json";
import { applyRateFeed } from "./feed";
import { Snapshot } from "./schema";

const FEED_TIMEOUT_MS = 10_000;

export type LoanData = { offers: Offer[]; dataAsOf: string };

/** Changes whenever the imported data does. */
export function snapshotVersion(): string {
  return createHash("sha256").update(JSON.stringify(raw)).digest("hex");
}

export function loadSnapshot(): LoanData {
  const s = Snapshot.parse(raw);
  return { offers: s.offers as Offer[], dataAsOf: s.dataAsOf };
}

export async function getLoanData(feedUrl = process.env.LOAN_RATES_CSV_URL): Promise<LoanData> {
  const data = loadSnapshot();
  if (!feedUrl) return data;
  try {
    // A feed that hangs must not hang the page, or the build.
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { offers, applied, skipped } = applyRateFeed(data.offers, await res.text());
    if (skipped.length > 0) console.warn(`Rate feed skipped ${skipped.length} row(s): ${skipped.slice(0, 5).join("; ")}`);
    if (applied === 0) return data;
    const dates = offers.flatMap((o) => (o.rate ? [o.rate.retrievedAt] : []));
    return { offers, dataAsOf: [data.dataAsOf, ...dates].sort().at(-1) as string };
  } catch (e) {
    // The site must keep working on the last good data if the feed is down.
    console.warn(`Rate feed unavailable, using the snapshot: ${(e as Error).message}`);
    return data;
  }
}
