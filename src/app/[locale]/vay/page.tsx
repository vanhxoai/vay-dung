import { cacheLife } from "next/cache";
import { LoanFlow } from "@/components/loan/LoanFlow";
import licensedList from "../../../../data/licensed-institutions.json";
import { oldestListDate } from "@/lib/data/lenders";
import { LicensedList } from "@/lib/data/schema";
import { getLoanData, loadSnapshot, snapshotVersion } from "@/lib/store";

/**
 * The live rate feed, re-read every 5 minutes. The arguments are the cache key: Next keeps this
 * result across builds, so an Excel edit or a new feed address must not reuse the old one.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- part of the cache key
async function withLiveRates(feedUrl: string, _snapshot: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 86_400 });
  return getLoanData(feedUrl);
}

export default async function LoanPage() {
  // Runs on the server. The browser receives only slim offers; the user's answers never come back.
  const feedUrl = process.env.LOAN_RATES_CSV_URL;
  const { offers } = feedUrl ? await withLiveRates(feedUrl, snapshotVersion()) : loadSnapshot();
  const list = LicensedList.parse(licensedList);
  return (
    <LoanFlow
      offers={offers}
      licensedAsOf={oldestListDate(list.sources)}
      licensedSources={list.sources.map((s) => ({ title: s.title, url: s.url }))}
    />
  );
}
