import { cacheLife } from "next/cache";
import { LoanFlow } from "@/components/loan/LoanFlow";
import licensedList from "../../../../data/licensed-institutions.json";
import { oldestListDate } from "@/lib/data/lenders";
import { LicensedList } from "@/lib/data/schema";
import { getLoanData } from "@/lib/store";

/** Only matters when LOAN_RATES_CSV_URL is set: the live rate feed is re-read every 5 minutes. */
async function cachedLoanData() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 86_400 });
  return getLoanData();
}

export default async function LoanPage() {
  // Runs on the server. The browser receives only slim offers; the user's answers never come back.
  const { offers } = await cachedLoanData();
  const list = LicensedList.parse(licensedList);
  return (
    <LoanFlow
      offers={offers}
      licensedAsOf={oldestListDate(list.sources)}
      licensedSources={list.sources.map((s) => ({ title: s.title, url: s.url }))}
    />
  );
}
