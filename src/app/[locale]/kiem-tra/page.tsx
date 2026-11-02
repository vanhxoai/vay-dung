import { SafetyCheck } from "@/components/safety/SafetyCheck";
import licensedList from "../../../../data/licensed-institutions.json";
import { oldestListDate } from "@/lib/data/lenders";
import { LicensedList } from "@/lib/data/schema";

export default function SafetyPage() {
  const list = LicensedList.parse(licensedList);
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
      asOf={oldestListDate(list.sources)}
      sources={list.sources.map((s) => ({ title: s.title, url: s.url }))}
    />
  );
}
