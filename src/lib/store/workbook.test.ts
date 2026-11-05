import { describe, expect, it } from "vitest";
import { loadLenders } from "@/lib/data/lenders";
import { toOffers } from "@/lib/recommend/offers";
import { offersToCsv, offersToSheets, sheetsToOffers, type Sheets } from "./workbook";

const offers = toOffers(loadLenders());

describe("the workbook rows", () => {
  it("carry every field of every offer there and back", () => {
    const { offers: back, issues } = sheetsToOffers(offersToSheets(offers));
    expect(issues).toEqual([]);
    // An empty list and "unknown" are both a blank cell, and the UI treats them alike.
    const emptyToNull = offers.map((o) => ({ ...o, documents: o.documents?.length ? o.documents : null, otherConditions: o.otherConditions?.length ? o.otherConditions : null }));
    expect(back).toEqual(emptyToNull);
  });

  const sheets = (): Sheets => offersToSheets(offers);
  const firstRanked = (s: Sheets) => s.products.findIndex((r) => r.include_in_ranking === "có");

  it("treat blank and 'chưa rõ' as unknown", () => {
    const s = sheets();
    s.products[0].amount_min = "chưa rõ";
    s.products[0].amount_max = null;
    const { offers: back } = sheetsToOffers(s);
    expect(back[0].amountMinVnd).toBeNull();
    expect(back[0].amountMaxVnd).toBeNull();
  });

  it("accept a Vietnamese decimal comma and a date typed in Excel", () => {
    const s = sheets();
    const i = firstRanked(s);
    s.products[i].rate_min = "1,5";
    s.products[i].rate_max = 2;
    s.products[i].rate_retrieved_at = new Date("2026-11-05T00:00:00Z");
    const back = sheetsToOffers(s).offers.find((o) => o.key === s.products[i].key);
    expect(back?.rate?.minPercent).toBe(1.5);
    expect(back?.rate?.retrievedAt).toBe("2026-11-05");
  });

  it("refuse a rate with no source, naming the sheet and line", () => {
    const s = sheets();
    const i = firstRanked(s);
    s.products[i].rate_source_url = null;
    const { issues, offers: back } = sheetsToOffers(s);
    expect(issues[0]).toMatchObject({ sheet: "Sản phẩm", row: i + 3 });
    expect(issues[0].message).toContain("rate_source_url");
    expect(back).toHaveLength(offers.length - 1);
  });

  it("refuse a minimum above the maximum, a bad source type and a ranked row with no rate", () => {
    const s = sheets();
    const i = firstRanked(s);
    s.products[i].rate_min = 99;
    s.products[i].rate_max = 1;
    expect(sheetsToOffers(s).issues.length).toBeGreaterThan(0);

    const s2 = sheets();
    s2.products[i].rate_source_type = "friend told me";
    expect(sheetsToOffers(s2).issues.length).toBeGreaterThan(0);

    const s3 = sheets();
    s3.products[i].rate_min = null;
    s3.products[i].rate_max = null;
    expect(sheetsToOffers(s3).issues[0].message).toContain("no rate");
  });

  it("refuse a duplicate key and a fee for a product that doesn't exist", () => {
    const s = sheets();
    s.products.push({ ...s.products[0] });
    s.fees.push({ key: "nobody/nothing", fee_group: "other", name_vi: "Phí" });
    const messages = sheetsToOffers(s).issues.map((i) => i.message).join(" | ");
    expect(messages).toContain("appears twice");
    expect(messages).toContain("nobody/nothing");
  });

  it("can't carry a commercial field into an offer", () => {
    const s = sheets();
    s.products[0].sponsor = "Bên A trả tiền";
    const { offers: back } = sheetsToOffers(s);
    expect(JSON.stringify(back)).not.toContain("Bên A trả tiền");
  });
});

describe("the CSV download", () => {
  it("quotes commas and has one line per product", () => {
    const csv = offersToCsv(offers);
    expect(offersToCsv([{ ...offers[0], nameVi: 'a,"b"' }])).toContain('"a,""b"""');
    expect(csv.trim().split("\n").length).toBeGreaterThanOrEqual(offers.length + 1);
  });
});
