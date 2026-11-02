import { describe, expect, it } from "vitest";
import { loadLenders } from "@/lib/data/lenders";
import { toOffers, type Offer } from "./offers";
import { eligibilityProblems, premiumRange, rankOffers, recommend, type Need } from "./recommend";

const today = new Date("2026-11-02T12:00:00Z");
const offers = toOffers(loadLenders());

const need = (o: Partial<Need> = {}): Need => ({
  purpose: "other",
  amountVnd: 20_000_000,
  termMonths: 24,
  urgency: "soon",
  monthlyIncomeVnd: 15_000_000,
  existingDebtVnd: 0,
  age: 28,
  incomeProof: "bank_salary",
  ...o,
});

describe("banks that publish no comparable rate", () => {
  const find = (id: string) => offers.find((o) => o.key.endsWith(id)) as Offer;

  it("never costs a daily rate", () => {
    const acb = find("acb-thau-chi-tieu-dung-online");
    expect(acb.rate).toBeNull();
    expect(acb.rateNotes.find((n) => n.kind === "advertised_floor")?.period).toBe("daily");
  });

  it("gives the real reason when documents conflict or are undated", () => {
    expect(find("sacombank-vay-tieu-dung-tu-the-tin-dung").excludeCode).toBe("conflicting_sources");
    expect(find("hdbank-vay-tieu-dung-linh-hoat").excludeCode).toBe("undated_document");
  });

  it("keeps ACB, Sacombank, VIB and HDBank out of the ranking", () => {
    const ranked = recommend(need(), offers, today).ranked.map((r) => r.offer.lenderName);
    for (const name of ["ACB", "Sacombank", "VIB", "HDBank"]) expect(ranked).not.toContain(name);
  });
});

function offer(o: Partial<Offer> = {}): Offer {
  return {
    key: "acme/loan",
    lenderName: "Acme",
    legalName: "Acme",
    category: "bank",
    nameVi: "Vay",
    nameEn: null,
    productType: "cash_loan",
    goods: null,
    amountMinVnd: 1_000_000,
    amountMaxVnd: 500_000_000,
    termMinMonths: 6,
    termMaxMonths: 60,
    rate: {
      minPercent: 20,
      maxPercent: 40,
      basis: "reducing",
      period: "yearly",
      basisInferred: false,
      segment: null,
      sourceUrl: "https://example.com",
      retrievedAt: "2026-11-01",
      oldDocumentDate: null,
    },
    rateNotes: [],
    amortization: "annuity",
    amortizationInferred: false,
    monthlyFees: [],
    otherFees: [],
    uncostedFees: [],
    feesCompleteness: "partial",
    insurance: [],
    insuranceCompleteness: "unknown",
    minAge: 18,
    maxAge: 60,
    maxAgeAtLoanEnd: null,
    minMonthlyIncomeVnd: null,
    documents: null,
    existingCustomerRequired: null,
    employerRestriction: null,
    otherConditions: null,
    lateTextVi: null,
    lateTextEn: null,
    lateMultiplier: null,
    lateOverdueInterestPercentYear: null,
    conflictFields: [],
    sourceUrl: "https://example.com",
    sourceUrls: ["https://example.com"],
    retrievedAt: "2026-11-01",
    oldestRetrievedAt: "2026-11-01",
    confidence: "medium",
    excludeFromRanking: false,
    excludeCode: null,
    ...o,
  };
}

describe("verdicts (qa-tester personas)", () => {
  it("can afford: 15M income, 20M for a laptop → ok", () => {
    const r = recommend(need({ purpose: "phone", amountVnd: 20_000_000, termMonths: 12 }), offers, today);
    expect(r.verdict).toBe("ok");
    expect(r.ranked.length).toBeGreaterThan(0);
  });

  it("over-borrowing: 8M income, 3M debt, 50M → too much, and it can't be hidden", () => {
    // Limit 8M × 40% = 3.2M; room 200,000. Principal alone: 50M ÷ 24 = 2,083,334 > 200,000.
    const r = recommend(need({ amountVnd: 50_000_000, monthlyIncomeVnd: 8_000_000, existingDebtVnd: 3_000_000 }), offers, today);
    expect(r.verdict).toBe("too_much");
    expect(r.headroomVnd).toBe(200_000);
    expect(r.ranked.every((x) => x.fit === "too_much")).toBe(true);
  });

  it("zero income → no_income, whatever the amount", () => {
    expect(recommend(need({ monthlyIncomeVnd: 0, amountVnd: 1_000_000 }), offers, today).verdict).toBe("no_income");
  });

  it("existing debt alone already over the limit → too much", () => {
    const r = recommend(need({ monthlyIncomeVnd: 10_000_000, existingDebtVnd: 5_000_000, amountVnd: 3_000_000 }), offers, today);
    expect(r.verdict).toBe("too_much");
    expect(r.headroomVnd).toBe(0);
    expect(r.suggestedAmountVnd).toBeNull();
  });

  it("fits only at the low end of the range → depends", () => {
    // 20M, 12 months: 20%/yr → 1,852,679/month; 60%/yr → 2,256,571/month. Room 2,000,000.
    const wide = offer({ rate: { ...offer().rate!, minPercent: 20, maxPercent: 60 } });
    const r = recommend(need({ termMonths: 12, monthlyIncomeVnd: 5_000_000 }), [wide], today);
    expect(r.ranked[0].fit).toBe("fits_only_low");
    expect(r.verdict).toBe("depends");
  });

  it("a green ok can't rest on a product whose fees are entirely unknown", () => {
    const unknownFees = offer({ key: "u", feesCompleteness: "unknown", rate: { ...offer().rate!, minPercent: 18, maxPercent: 20 } });
    const pricey = offer({ key: "p", rate: { ...offer().rate!, minPercent: 80, maxPercent: 90 } });
    const r = recommend(need({ termMonths: 12, monthlyIncomeVnd: 5_400_000 }), [unknownFees, pricey], today);
    expect(r.ranked.find((x) => x.offer.key === "u")!.fit).toBe("fits");
    expect(r.verdict).toBe("depends");
  });

  it("nor on a product limited to existing customers or an employer list", () => {
    const own = offer({ existingCustomerRequired: true });
    const employer = offer({ key: "e", employerRestriction: "Danh sách của ngân hàng" });
    expect(recommend(need(), [own], today).verdict).toBe("depends");
    expect(recommend(need(), [employer], today).verdict).toBe("depends");
  });

  it("no product to compare → no_data, not 'may exceed'", () => {
    // Age 18 is below every minimum age; the principal alone comfortably fits.
    const r = recommend(need({ age: 18 }), [offer({ minAge: 20 })], today);
    expect(r.verdict).toBe("no_data");
    expect(r.ineligible).toHaveLength(1);
    expect(recommend(need(), [offer({ oldestRetrievedAt: "2026-07-01" })], today).verdict).toBe("no_data");
  });

  it("reports when only some offers fit", () => {
    const cheap = offer({ key: "c", rate: { ...offer().rate!, minPercent: 18, maxPercent: 20 } });
    const pricey = offer({ key: "p", rate: { ...offer().rate!, minPercent: 80, maxPercent: 90 } });
    const r = recommend(need({ termMonths: 12, monthlyIncomeVnd: 5_400_000 }), [cheap, pricey], today);
    expect(r.verdict).toBe("ok");
    expect(r.someDontFit).toBe(true);
  });

  it("suggests a smaller amount that really fits at the offer's high rate", () => {
    const r = recommend(need({ termMonths: 12, amountVnd: 30_000_000, monthlyIncomeVnd: 5_000_000 }), [offer()], today);
    expect(r.suggestedAmountVnd).not.toBeNull();
    const check = recommend(need({ termMonths: 12, amountVnd: r.suggestedAmountVnd!, monthlyIncomeVnd: 5_000_000 }), [offer()], today);
    expect(check.ranked[0].fit).toBe("fits");
  });
});

describe("ranking", () => {
  it("is by the real APR at the HIGH end of the range", () => {
    const a = offer({ key: "a", rate: { ...offer().rate!, minPercent: 10, maxPercent: 60 } });
    const b = offer({ key: "b", rate: { ...offer().rate!, minPercent: 30, maxPercent: 40 } });
    expect(recommend(need(), [a, b], today).ranked.map((x) => x.offer.key)).toEqual(["b", "a"]);
  });

  it("compares flat and reducing quotes on real cost, not the headline", () => {
    // 2%/month flat over 24 months is about 40.9%/yr real, costlier than 36%/yr reducing.
    const flat = offer({ key: "flat", rate: { ...offer().rate!, minPercent: 2, maxPercent: 2, basis: "flat", period: "monthly" } });
    const reducing = offer({ key: "reducing", rate: { ...offer().rate!, minPercent: 36, maxPercent: 36 } });
    expect(recommend(need(), [flat, reducing], today).ranked.map((x) => x.offer.key)).toEqual(["reducing", "flat"]);
  });

  it("a product with entirely unknown fees never takes first place (compliance S6)", () => {
    const unknown = offer({ key: "unknown", feesCompleteness: "unknown", rate: { ...offer().rate!, maxPercent: 30 } });
    const known = offer({ key: "known", rate: { ...offer().rate!, maxPercent: 50 } });
    expect(recommend(need(), [unknown, known], today).ranked.map((x) => x.offer.key)).toEqual(["known", "unknown"]);
  });

  it("moving a known-fee product first keeps the others in cost order", () => {
    const u1 = offer({ key: "u1", feesCompleteness: "unknown", rate: { ...offer().rate!, maxPercent: 25 } });
    const u2 = offer({ key: "u2", feesCompleteness: "unknown", rate: { ...offer().rate!, maxPercent: 30 } });
    const k = offer({ key: "k", rate: { ...offer().rate!, maxPercent: 50 } });
    expect(recommend(need(), [k, u2, u1], today).ranked.map((x) => x.offer.key)).toEqual(["k", "u1", "u2"]);
  });

  it("if every product has unknown fees, order stays by cost", () => {
    const a = offer({ key: "a", feesCompleteness: "unknown", rate: { ...offer().rate!, maxPercent: 30 } });
    const b = offer({ key: "b", feesCompleteness: "unknown", rate: { ...offer().rate!, maxPercent: 50 } });
    expect(recommend(need(), [b, a], today).ranked.map((x) => x.offer.key)).toEqual(["a", "b"]);
  });

  it("depends only on cost and fit: lender name and order of input don't matter", () => {
    const a = offer({ key: "a", lenderName: "Z", rate: { ...offer().rate!, maxPercent: 30 } });
    const b = offer({ key: "b", lenderName: "A", rate: { ...offer().rate!, maxPercent: 50 } });
    const r1 = rankOffers(recommend(need(), [a, b], today).ranked).map((x) => x.offer.key);
    const r2 = rankOffers(recommend(need(), [b, a], today).ranked).map((x) => x.offer.key);
    expect(r1).toEqual(["a", "b"]);
    expect(r2).toEqual(r1);
  });
});

describe("eligibility", () => {
  it("names each problem", () => {
    const o = offer({ minAge: 23, maxAge: 60, amountMinVnd: 30_000_000, termMinMonths: 36, minMonthlyIncomeVnd: 20_000_000 });
    expect(eligibilityProblems(o, need({ age: 20 })).sort()).toEqual(["amount_too_low", "income_too_low", "term_too_short", "too_young"]);
  });

  it("checks max age at the end of the loan when the lender says so", () => {
    const o = offer({ maxAge: 60, maxAgeAtLoanEnd: true });
    expect(eligibilityProblems(o, need({ age: 59, termMonths: 24 }))).toEqual(["too_old"]);
    expect(eligibilityProblems(offer({ maxAge: 60, maxAgeAtLoanEnd: false }), need({ age: 59, termMonths: 24 }))).toEqual([]);
  });

  it("finance companies: above 100M isn't shown as achievable, whatever they advertise (compliance M8)", () => {
    const fc = offer({ category: "finance_company", amountMaxVnd: 300_000_000 });
    expect(eligibilityProblems(fc, need({ amountVnd: 100_000_000 }))).toEqual([]);
    expect(eligibilityProblems(fc, need({ amountVnd: 100_000_001 }))).toEqual(["over_finance_company_cap"]);
    expect(eligibilityProblems(offer(), need({ amountVnd: 300_000_000 }))).toEqual([]);
  });

  it("unknown limits don't exclude anyone (unknown isn't a no)", () => {
    const o = offer({ amountMinVnd: null, amountMaxVnd: null, termMinMonths: null, termMaxMonths: null, minAge: null, maxAge: null });
    expect(eligibilityProblems(o, need({ age: 19, amountVnd: 1_000_000_000 }))).toEqual([]);
  });
});

describe("old source documents", () => {
  it("a rate read recently from an old document says so", () => {
    const notes = offers.filter((o) => o.lenderName.startsWith("Shinhan")).flatMap((o) => o.rateNotes);
    expect(notes.some((n) => n.oldDocumentDate === "2025-03-03")).toBe(true);
  });
});

describe("costs and insurance", () => {
  it("uses the flat schedule for a flat quote and adds known mandatory monthly fees", () => {
    const o = offer({
      rate: { ...offer().rate!, minPercent: 1.41, maxPercent: 3.86, basis: "flat", period: "monthly" },
      monthlyFees: [{ nameVi: "Phí thu hộ", nameEn: null, amountVnd: 12_000 }],
    });
    const r = recommend(need(), [o], today).ranked[0];
    // Low end: 20M/24 + 20M × 1.41% + 12,000 = 833,333 + 282,000 + 12,000
    expect(r.low.firstPaymentVnd).toBe(1_127_333);
    expect(r.low.totalPaidVnd).toBe(27_056_000);
  });

  it("insurance not known to be mandatory stays out of the headline but is shown separately", () => {
    const o = offer({
      insurance: [
        {
          nameVi: "Bảo hiểm",
          nameEn: null,
          mandatory: null,
          collection: "unknown",
          method: "annual_rate_on_declining_balance",
          ratePercentMin: 1.3,
          ratePercentMax: 1.8,
          insuredTiers: null,
          fixedVnd: null,
        },
      ],
    });
    const r = recommend(need(), [o], today).ranked[0];
    expect(r.high.amountReceivedVnd).toBe(20_000_000);
    expect(r.insuranceCosts).toHaveLength(1);
    expect(r.insuranceCosts[0].minVnd).toBeLessThan(r.insuranceCosts[0].maxVnd);
    expect(r.insuranceCosts[0].costHigh.aprNominal).toBeGreaterThan(r.high.aprNominal);
  });

  it("the low end of a declining-balance premium uses the balances at the low loan rate", () => {
    const ins = { nameVi: "BH", nameEn: null, mandatory: false, collection: "unknown" as const, method: "annual_rate_on_declining_balance" as const, ratePercentMin: 1, ratePercentMax: 2, insuredTiers: null, fixedVnd: null };
    const o = offer({ rate: { ...offer().rate!, minPercent: 12, maxPercent: 60 } });
    const [lo, hi] = premiumRange(ins, o, 20_000_000, 24)!;
    const sameRate = offer({ rate: { ...offer().rate!, minPercent: 60, maxPercent: 60 } });
    const [loAtHighBalances, hiAtHighBalances] = premiumRange(ins, sameRate, 20_000_000, 24)!;
    expect(lo).toBeLessThan(loAtHighBalances);
    expect(hi).toBe(hiAtHighBalances);
  });

  it("a suggested smaller amount still fits once mandatory insurance is counted", () => {
    const o = offer({
      insurance: [{ nameVi: "BH", nameEn: null, mandatory: true, collection: "added_to_loan", method: "fixed", ratePercentMin: null, ratePercentMax: null, insuredTiers: null, fixedVnd: 1_000_000 }],
    });
    const n = need({ amountVnd: 100_000_000, monthlyIncomeVnd: 2_500_000 }); // 1,000,000 a month of room
    const rec = recommend(n, [o], today);
    expect(rec.suggestedAmountVnd).not.toBeNull();
    const again = recommend({ ...n, amountVnd: rec.suggestedAmountVnd! }, [o], today).ranked[0];
    expect(again.high.maxPaymentVnd).toBeLessThanOrEqual(1_000_000);
  });

  it("mandatory insurance uses its lowest premium at the low end and its highest at the high end", () => {
    const o = offer({
      insurance: [{ nameVi: "BH", nameEn: null, mandatory: true, collection: "deducted_from_payout", method: "percent_of_principal", ratePercentMin: 5, ratePercentMax: 10, insuredTiers: null, fixedVnd: null }],
    });
    const r = recommend(need(), [o], today).ranked[0];
    expect(r.low.amountReceivedVnd).toBe(19_000_000);
    expect(r.high.amountReceivedVnd).toBe(18_000_000);
  });

  it("mandatory insurance IS in the headline cost and lowers the money in hand", () => {
    const o = offer({
      insurance: [{ nameVi: "BH", nameEn: null, mandatory: true, collection: "deducted_from_payout", method: "percent_of_principal", ratePercentMin: 5, ratePercentMax: 5, insuredTiers: null, fixedVnd: null }],
    });
    const r = recommend(need(), [o], today).ranked[0];
    expect(r.high.amountReceivedVnd).toBe(19_000_000);
    expect(r.insuranceCosts).toEqual([]);
  });

  it("financed mandatory insurance raises the payment instead of lowering the money in hand", () => {
    const o = offer({
      insurance: [{ nameVi: "BH", nameEn: null, mandatory: true, collection: "added_to_loan", method: "percent_of_principal", ratePercentMin: 5, ratePercentMax: 5, insuredTiers: null, fixedVnd: null }],
    });
    const r = recommend(need(), [o], today).ranked[0];
    expect(r.high.amountReceivedVnd).toBe(20_000_000);
    expect(r.high.financedPrincipalVnd).toBe(21_000_000);
    expect(r.mandatoryCollectionAssumed).toBe(false);
  });

  it("an unknown insurance collection method is flagged, not hidden", () => {
    const o = offer({
      insurance: [{ nameVi: "BH", nameEn: null, mandatory: null, collection: "unknown", method: "percent_of_principal", ratePercentMin: 5, ratePercentMax: 5, insuredTiers: null, fixedVnd: null }],
    });
    expect(recommend(need(), [o], today).ranked[0].insuranceCosts[0].collectionKnown).toBe(false);
  });

  it("an unpublished premium is reported as unknown, never as zero", () => {
    const o = offer({
      insurance: [{ nameVi: "BH", nameEn: null, mandatory: false, collection: "unknown", method: "unknown", ratePercentMin: null, ratePercentMax: null, insuredTiers: null, fixedVnd: null }],
    });
    expect(recommend(need(), [o], today).ranked[0].insuranceUnknownPremium).toEqual(["BH"]);
  });

  it("flags a likely document problem without excluding the offer", () => {
    const o = offer({ documents: ["CCCD", "Giấy tờ chứng minh thu nhập"] });
    expect(recommend(need({ incomeProof: "none" }), [o], today).ranked[0].needsIncomeProofNote).toBe(true);
    expect(recommend(need({ incomeProof: "bank_salary" }), [o], today).ranked[0].needsIncomeProofNote).toBe(false);
  });
});

describe("what's shown where", () => {
  it("goods loans only appear for the matching purpose", () => {
    const keys = (p: Need["purpose"]) => recommend(need({ purpose: p, termMonths: 12 }), offers, today).ranked.map((x) => x.offer.key);
    expect(keys("phone")).toContain("fe-credit/vay-mua-dien-thoai-dien-may");
    expect(keys("phone")).not.toContain("fe-credit/vay-mua-xe-may");
    expect(keys("motorbike")).toContain("fe-credit/vay-mua-xe-may");
    expect(keys("other")).not.toContain("fe-credit/vay-mua-xe-may");
  });

  it("products without an offered rate go to 'not enough data', never into the ranking", () => {
    const r = recommend(need(), offers, today);
    const ranked = r.ranked.map((x) => x.offer.key);
    expect(ranked).not.toContain("mb-bank/mb-unsecured-consumer-app");
    expect(r.insufficientData.map((x) => x.offer.key)).toContain("mb-bank/mb-unsecured-consumer-app");
  });

  it("data older than 90 days stops being ranked, even on a static site", () => {
    const r = recommend(need(), [offer({ oldestRetrievedAt: "2026-07-01" })], today);
    expect(r.ranked).toEqual([]);
    expect(r.insufficientData[0].stale).toBe(true);
  });

  it("uses the new-customer range when a lender publishes several (Home Credit: 45–55%)", () => {
    const hc = offers.find((o) => o.key === "home-credit/cash-loan")!;
    expect(hc.rate).toMatchObject({ minPercent: 45, maxPercent: 55, segment: "Khách hàng mới" });
    expect(hc.rateNotes.some((n) => n.segment === "Khách hàng hiện hữu")).toBe(true);
  });

  it("every product not compared has a translated reason code, never raw research text", () => {
    const r = recommend(need(), offers, today);
    for (const x of r.insufficientData) expect(x.stale || x.offer.excludeCode !== null).toBe(true);
    expect(JSON.stringify(offers)).not.toContain("excludeReason");
  });

  it("every rankable installment is tied to specific goods (a missed one would rank as general purpose)", () => {
    const bad = offers.filter((o) => o.productType === "installment" && !o.excludeFromRanking && o.rate !== null && o.goods === null);
    expect(bad.map((o) => o.key)).toEqual([]);
  });

  it("credit cards and expired products aren't offered", () => {
    expect(offers.some((o) => o.productType === "credit_card")).toBe(false);
    expect(offers.some((o) => o.key === "hd-saison/union-worker-loan")).toBe(false);
  });

  it("offers contain no research notes or commercial fields", () => {
    const json = JSON.stringify(offers);
    expect(json).not.toMatch(/researchNotes|sponsor|affiliate|payout|commission/i);
  });
});
