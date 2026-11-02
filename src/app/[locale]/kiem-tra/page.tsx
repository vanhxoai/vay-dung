import { SafetyCheck } from "@/components/safety/SafetyCheck";
import licensedList from "../../../../data/licensed-institutions.json";
import { LicensedList } from "@/lib/data/schema";

export default function SafetyPage() {
  const list = LicensedList.parse(licensedList);
  const first = list.sources[0];
  return (
    <SafetyCheck
      institutions={list.institutions.map((i) => ({
        id: i.id,
        name: i.name,
        legalName: i.legalName,
        legalNameEn: i.legalNameEn,
        category: i.category,
        subtype: i.subtype,
        aliases: i.aliases,
        licenseNumber: i.licenseNumber,
        website: i.website,
        sourceUrl: i.sourceUrl,
      }))}
      asOf={first.asOf ?? first.retrievedAt}
      sources={list.sources.map((s) => ({ title: s.title, url: s.url }))}
    />
  );
}
