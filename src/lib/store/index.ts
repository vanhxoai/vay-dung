/**
 * The only place the app reads loan data from. Everything else depends on `getLoanData`, so
 * swapping the store later (a database, an API) means changing this file and nothing else.
 *
 *   data/store/loan-data.xlsx  →  npm run data:import  →  data/store/snapshot.json  →  here
 *                                                 LOAN_RATES_CSV_URL (optional)  ↗
 */
import type { Offer } from "@/lib/recommend/offers";
import raw from "../../../data/store/snapshot.json";
import { applyRateFeed } from "./feed";
import { Snapshot } from "./schema";

export type LoanData = { offers: Offer[]; dataAsOf: string };

export function loadSnapshot(): LoanData {
  const s = Snapshot.parse(raw);
  return { offers: s.offers as Offer[], dataAsOf: s.dataAsOf };
}

export async function getLoanData(feedUrl = process.env.LOAN_RATES_CSV_URL): Promise<LoanData> {
  const data = loadSnapshot();
  if (!feedUrl) return data;
  try {
    const res = await fetch(feedUrl);
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
