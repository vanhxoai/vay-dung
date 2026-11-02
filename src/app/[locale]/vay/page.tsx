import { LoanFlow } from "@/components/loan/LoanFlow";
import licensedList from "../../../../data/licensed-institutions.json";
import { loadLenders } from "@/lib/data/lenders";
import { LicensedList } from "@/lib/data/schema";
import { toOffers } from "@/lib/recommend/offers";

export default function LoanPage() {
  // Runs at build time. The browser receives only slim offers; the user's answers never come back.
  const offers = toOffers(loadLenders());
  const list = LicensedList.parse(licensedList);
  const first = list.sources[0];
  return (
    <LoanFlow
      offers={offers}
      licensedAsOf={first.asOf ?? first.retrievedAt}
      licensedSources={list.sources.map((s) => ({ title: s.title, url: s.url }))}
    />
  );
}
