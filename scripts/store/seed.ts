/**
 * ONE-TIME: builds data/store/loan-data.xlsx from the research archive (data/lenders/*.json)
 * and the secondary-source research (data/research/secondary/*.json).
 *
 * After this, the workbook is the master. Re-running overwrites every edit made in Excel,
 * so it needs --force. Each decision below is deliberate; DECISIONS #63 has the rules.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadLenders } from "../../src/lib/data/lenders";
import { OLD_DOCUMENT_DAYS } from "../../src/lib/data/validate";
import { toOffers, type Offer, type OfferRate } from "../../src/lib/recommend/offers";
import { offersToSheets } from "../../src/lib/store/workbook";
import { writeSheets } from "./excel";

const TODAY = "2026-11-05";

type Research = {
  key: string;
  minPercent: number | null;
  maxPercent: number | null;
  sourceType: OfferRate["sourceType"];
  sourceName: string | null;
  sourceUrl: string | null;
  sourceDate: string | null;
  scope: OfferRate["scope"];
  quote: string;
  amountMinVnd: number | null;
  amountMaxVnd: number | null;
  termMinMonths: number | null;
  termMaxMonths: number | null;
};

const dir = join("data", "research", "secondary");
const research = new Map<string, Research>(
  readdirSync(dir).flatMap((f) => (JSON.parse(readFileSync(join(dir, f), "utf8")) as Research[]).map((r) => [r.key, r] as const)),
);

// Topi's JACCS row is lender-wide, so it covers the furniture loan the batch didn't list.
research.set("jaccs/furniture-installment", research.get("jaccs/motorbike-installment") as Research);

const lenders = loadLenders();

/** What the official research says about a figure: where it's from, and how sure the basis is. */
function officialFigure(key: string, percent: number) {
  const [slug, id] = key.split("/");
  const p = lenders.find((l) => l.slug === slug)?.products.find((x) => x.id === id);
  for (const r of p?.rates ?? []) {
    for (const end of [r.maxPercent, r.minPercent]) {
      if (end.value === percent && end.sourceUrl && end.retrievedAt) {
        const doc = end.sourceDocumentDate ?? null;
        const isOld = doc !== null && (Date.parse(TODAY) - Date.parse(doc)) / 86_400_000 > OLD_DOCUMENT_DAYS;
        return { url: end.sourceUrl, retrievedAt: end.retrievedAt, basisStated: r.basis.provenance === "stated", oldDocumentDate: isOld ? doc : null };
      }
    }
  }
  throw new Error(`${key}: no official figure ${percent}`);
}

type Fill = Pick<OfferRate, "minPercent" | "maxPercent" | "basis" | "period" | "basisInferred"> &
  Partial<Pick<OfferRate, "minIsPromotional" | "minUnconfirmed" | "maxIsReference" | "minByTerm" | "floorOnly" | "oldDocumentDate">> & {
    /** Name of the research row to take the source from. Without it, the figure is the lender's own. */
    from?: "research";
    officialFigure?: number;
    /** The figure is on this product's page, not the one being filled. */
    officialFrom?: string;
    /** The figure speaks of the lender as a whole, not this product. Official sources default to this. */
    scope?: OfferRate["scope"];
    /** The research row's own label is wrong for this product. */
    sourceType?: OfferRate["sourceType"];
    sourceName?: string;
    sourceUrl?: string;
    note?: { vi: string; en: string };
  };

const range = (minPercent: number, maxPercent: number, basis: "flat" | "reducing", period: "monthly" | "yearly", basisInferred = true) => ({ minPercent, maxPercent, basis, period, basisInferred });
/** A published ceiling with no minimum we'd trust: costed at the top. */
const top = (min: number, max: number, basis: "flat" | "reducing", period: "monthly" | "yearly", basisInferred = false): Fill => ({
  ...range(min, max, basis, period, basisInferred),
  minUnconfirmed: true,
  officialFigure: max,
});
/** A top range whose minimum is a promotion on selected goods. */
const promoTop = (max: number, basis: "flat" | "reducing", period: "monthly" | "yearly"): Fill => ({
  ...range(0, max, basis, period, false),
  minIsPromotional: true,
  officialFigure: max,
});
/** Only "from X%" is known. Ranked after everything with a known maximum. */
const floor = (x: number, basis: "flat" | "reducing", period: "monthly" | "yearly", basisInferred = true, from?: "research"): Fill => ({
  ...range(x, x, basis, period, basisInferred),
  floorOnly: true,
  ...(from ? { from } : { officialFigure: x }),
});

const SACOMBANK_NOTE = {
  vi: "Con số này có vẻ đã cũ: cùng câu chữ xuất hiện từ năm 2019, và nó thấp hơn lãi suất cơ sở của chính Sacombank. Lãi suất thật của bạn nhiều khả năng cao hơn.",
  en: "This figure looks out of date: the same wording appeared in 2019, and it's below Sacombank's own base rate. Your real rate is likely higher.",
};

const FILLS: Record<string, Fill> = {
  // Banks. Source silent on the basis → reducing balance, the banks' usual way (DECISIONS #64).
  // A bank article calling it a reference figure, so it can't support an "OK" verdict.
  "hdbank/hdbank-vay-tieu-dung-khong-tai-san-bao-dam": { ...range(13, 24, "reducing", "yearly"), maxIsReference: true, officialFigure: 24, scope: "lender_general", oldDocumentDate: "2025-02-26" },
  "hdbank/hdbank-vay-tieu-dung-linh-hoat": { ...range(1.5, 1.7, "flat", "monthly", false), minByTerm: [{ termMonthsMin: 24, percent: 1.7 }, { termMonthsMin: 0, percent: 1.5 }], officialFigure: 1.7, scope: "product", oldDocumentDate: "2024-04-02" },
  "mb-bank/mb-unsecured-consumer-app": { ...range(12.5, 20, "reducing", "yearly"), maxIsReference: true, officialFigure: 20, scope: "lender_general" },
  // Sacombank's 9.6% looks recycled from 2019 and sits below its own base rate: a floor at best, and it says so.
  "sacombank/sacombank-vay-tin-chap-tu-luong-online": { ...floor(9.6, "reducing", "yearly", true, "research"), note: SACOMBANK_NOTE },
  "sacombank/sacombank-vay-tieu-dung-tu-luong": { ...floor(9.6, "reducing", "yearly", true, "research"), note: SACOMBANK_NOTE },
  // Viettel Money's range; the bank's own page states the basis.
  "techcombank/vay-tieu-dung-tin-chap-tra-gop": {
    ...range(13.78, 16, "reducing", "yearly"),
    from: "research",
    note: { vi: "Trang của Techcombank ghi từ 12,9%/năm và chưa có mức tối đa. Khoảng 13,78–16% lấy từ Viettel Money.", en: "Techcombank's page says from 12.9% a year with no maximum. The 13.78–16% range comes from Viettel Money." },
  },
  "tpbank/vay-tieu-dung-tin-chap-theo-luong": {
    ...range(0.6, 1.5, "reducing", "monthly"),
    // The floor looks like a promotion, and it would decide whether a tight budget "fits".
    minUnconfirmed: true,
    from: "research",
    scope: "lender_general",
    sourceName: "Tạp chí Công Thương",
    note: { vi: "Bài báo này từ năm 2023 và nói về vay tín chấp TPBank nói chung, không nhắc đến sản phẩm này. Mức 0,6%/tháng có thể là ưu đãi, nên con số có thể đã cũ hoặc thấp hơn thực tế nhiều.", en: "This 2023 article is about TPBank's unsecured loans in general and doesn't name this product. The 0.6% a month may be a promotion, so the figure may be out of date or well below reality." },
  },
  "tpbank/cho-vay-tien-mat-tin-chap-tpfico": { ...floor(1.6, "reducing", "monthly", true, "research"), sourceName: "Blog của VPBank, một ngân hàng khác" },
  // The product page says "from 1.9%" and the calculator goes above it, so that's a floor too.
  "vib/vib-vay-tin-chap-nhan-luong-qua-vib": {
    ...floor(1.9, "reducing", "monthly", false),
    note: { vi: "Máy tính trên trang VIB cho kết quả khoảng 23–24%/năm, cao hơn khoảng này một chút.", en: "VIB's calculator gives about 23–24% a year, slightly above this range." },
  },
  // Its own published floor is 2%, above the landing page's 1.9% "maximum". The floor wins.
  "vib/vib-vay-tin-chap-luong-chuyen-khoan-the-tin-dung": {
    ...floor(2, "reducing", "monthly", false),
    note: { vi: "Máy tính trên trang VIB cho kết quả khoảng 24–25%/năm.", en: "VIB's calculator gives about 24–25% a year." },
  },
  "vib/vib-super-cash": { ...range(1.63, 2.5, "reducing", "monthly"), from: "research", sourceName: "VIB" },
  "vpbank/vpbank-vay-tin-chap-khach-hang-hien-huu": floor(16, "reducing", "yearly"),
  // The source's row reads "teachers or VPBank staff", so 17% is a floor, not this borrower's rate.
  "vpbank/vpbank-vay-tin-chap-giao-vien": {
    ...floor(17, "reducing", "yearly", true, "research"),
    sourceName: "Blog muaban.net",
    note: { vi: "Bài viết từ năm 2024 ghi 17% cho \"giáo viên hoặc cán bộ VPBank\", nên chưa chắc đúng với giáo viên.", en: "A 2024 article gives 17% for \"teachers or VPBank staff\", so it may not be right for teachers." },
  },

  // Finance companies. Source silent on the basis → flat, the costlier reading (DECISIONS #64),
  // unless the lender's other documents say otherwise.
  "aeon-finance/cash-loan-lump-sum": top(1.51, 4.58, "reducing", "monthly"),
  "aeon-finance/cash-loan-credit-limit": top(1.51, 4.58, "reducing", "monthly"),
  "aeon-finance/installment-loan": promoTop(55, "reducing", "yearly"),
  "fe-credit/tien-mat-chu-dong": floor(20, "flat", "yearly"),
  // The app listing's 34.78% is only for 6–12 months and sits below the lender's own ceiling (DECISIONS #16).
  "hd-saison/cash-loan": {
    ...top(2.94, 2.94, "flat", "monthly"),
    note: { vi: "Ứng dụng của HD SAISON ghi 20,41–34,78%/năm cho kỳ hạn 6–12 tháng. Chúng tôi tính theo mức trần công bố, 2,94%/tháng, vì nó áp dụng cho mọi kỳ hạn.", en: "HD SAISON's app says 20.41–34.78% a year for 6–12 month terms. We use the published ceiling, 2.94% a month, as it covers every term." },
  },
  "hd-saison/motorbike-installment": top(2.9, 2.9, "flat", "monthly"),
  "hd-saison/electronics-installment": top(2.82, 2.82, "flat", "monthly"),
  // The app's text covers cash and goods together and reads as an advert, so the top is only a reference.
  "home-credit/installment-motorbike": { ...range(8.99, 33.94, "flat", "yearly", false), maxIsReference: true, from: "research", sourceName: "Home Credit (mô tả ứng dụng trên App Store)", sourceUrl: "https://apps.apple.com/vn/app/id1553761073" },
  // The lender's own rate table, not Topi's lower row. Its 0% is a promotion on selected goods.
  "jaccs/motorbike-installment": promoTop(50.1266, "reducing", "yearly"),
  "jaccs/electronics-installment": promoTop(50.1266, "reducing", "yearly"),
  "jaccs/furniture-installment": promoTop(50.1266, "reducing", "yearly"),
  // The floor is quoted reducing and the ceiling flat, so they can't share a range: costed at the ceiling.
  "mcredit/mcredit-vay-mon-tien-mat": top(6.25, 6.25, "flat", "monthly"),
  "mcredit/mcredit-vay-han-muc-tien-mat": top(6.25, 6.25, "flat", "monthly"),
  "mcredit/mcredit-vay-nhanh-app": top(6.25, 6.25, "flat", "monthly"),
  "mcredit/mcredit-vay-tra-gop": promoTop(6.25, "flat", "monthly"),
  "mirae-asset/salary-cash-loan": top(15, 65, "reducing", "yearly"),
  "mirae-asset/my-finance-quick-loan": top(26, 65, "reducing", "yearly"),
  "mirae-asset/cash-loan-credit-card-statement": top(52, 58, "reducing", "yearly"),
  "mirae-asset/cash-loan-existing-credit-contract": top(42, 58, "reducing", "yearly"),
  "mirae-asset/cash-loan-electricity-bill": floor(50, "reducing", "yearly", false),
  "mirae-asset/cash-loan-women": top(55, 55, "reducing", "yearly"),
  "mirae-asset/cash-loan-life-insurance-contract": floor(58, "reducing", "yearly", false),
  "mirae-asset/installment-motorbike": promoTop(59, "reducing", "yearly"),
  "mirae-asset/installment-electronics": promoTop(55, "reducing", "yearly"),
  "mirae-asset/installment-beauty": promoTop(39, "reducing", "yearly"),
  "mirae-asset/installment-education": promoTop(39, "reducing", "yearly"),
  // Topi's 1.37–1.86% is SFinance's direct rate, not this channel's. The lender's own ceiling is used.
  "sfinance/vay-qua-doi-tac-momo-zalopay": top(70, 70, "reducing", "yearly"),
  "sfinance/tra-gop-dien-thoai": promoTop(59, "reducing", "yearly"),
  "sfinance/tra-gop-dien-may": promoTop(59, "reducing", "yearly"),
  "shinhan-finance/tai-toc-express-loan": {
    ...floor(30, "reducing", "yearly", false),
    note: { vi: "Nguồn ghi từ 30% nhưng không nói theo năm hay tháng. Chúng tôi đọc là theo năm, vì 30% mỗi tháng là không hợp lý.", en: "The source says from 30% without saying per year or month. We read it as yearly, since 30% a month isn't plausible." },
  },
  "shinhan-finance/consumer-installment-loan": promoTop(59, "reducing", "yearly"),
  "shinhan-finance/motorbike-installment-loan": promoTop(59, "reducing", "yearly"),
  "tnex-finance/vay-tieu-dung-co-luong": floor(3.75, "reducing", "monthly"),
  "vietcredit/tin-vay-viettel-money": floor(3.5, "reducing", "monthly", false),
  "vietcredit/tin-vay-vnpt-money": {
    ...range(36.5, 36.5, "reducing", "yearly", false),
    floorOnly: true,
    officialFigure: 0.1,
    note: { vi: "Nguồn ghi từ 0,1% mỗi ngày. Chúng tôi đổi thành 36,5%/năm (nhân 365 ngày).", en: "The source says from 0.1% a day. We converted it to 36.5% a year (× 365 days)." },
  },
  // A row in Topi's comparison table, and its minimum sits far below the 2.08% a month Topi quotes for this channel.
  "vietcredit/tin-vay-topi": { ...range(11.09, 51.12, "reducing", "yearly", false), minUnconfirmed: true, from: "research", sourceType: "aggregator", sourceName: "Topi" },
  "vietcredit/tin-vay-fiza-zalo": floor(1.42, "reducing", "monthly"),
  // MoMo's table covers four lenders and tops out above VietCredit's own 89% ceiling, so the ceiling is used.
  "vietcredit/tin-vay-momo": {
    ...top(89, 89, "reducing", "yearly"),
    officialFrom: "vietcredit/tin-vay-personal-loan",
    note: { vi: "Trang của MoMo ghi 1,91–5,92%/tháng, nhưng cho nhiều bên cho vay chứ không riêng VietCredit. Chúng tôi tính theo mức trần VietCredit công bố cho Tin Vay, 89%/năm. Lãi suất thật của bạn có thể thấp hơn nhiều.", en: "MoMo's page says 1.91–5.92% a month, but across several lenders, not VietCredit alone. We use the ceiling VietCredit publishes for Tin Vay, 89% a year. Your real rate may be much lower." },
  },
};

/** The rate is in the lender's own document; its other pages disagree, which the card says. */
const UNEXCLUDE = new Set(["tnex-finance/vay-tieu-dung-tung-lan-app", "sacombank/sacombank-vay-tieu-dung-tu-the-tin-dung"]);

/** The research labels are notes to ourselves; borrowers see a plain name. */
function cleanName(name: string): string {
  if (name.startsWith("Viettel Money")) return "Viettel Money";
  if (name.startsWith("Topi")) return "Topi";
  return name;
}

function apply(o: Offer): Offer {
  if (o.productType === "overdraft" || o.productType === "bnpl") {
    return { ...o, rate: null, excludeFromRanking: true, excludeCode: "revolving" };
  }
  if (UNEXCLUDE.has(o.key)) return { ...o, excludeFromRanking: false, excludeCode: null };
  const fill = FILLS[o.key];
  if (!fill) return o;

  const row = research.get(o.key);
  if (fill.from && (!row?.sourceUrl || !row.sourceName)) throw new Error(`${o.key}: no research row to use`);
  const useRow = fill.from === "research" && row;
  const official = useRow ? null : officialFigure(fill.officialFrom ?? o.key, fill.officialFigure as number);
  const sourceUrl = useRow ? (row.sourceUrl as string) : (official as NonNullable<typeof official>).url;
  const { note, scope, sourceType, sourceName, sourceUrl: urlOverride, ...rest } = fill;
  const rate = { ...rest };
  delete rate.from;
  delete rate.officialFigure;
  delete rate.officialFrom;
  return {
    ...o,
    rate: {
      ...rate,
      segment: null,
      sourceType: sourceType ?? (useRow ? row.sourceType : "official"),
      sourceName: sourceName ?? (useRow ? cleanName(row.sourceName as string) : o.lenderName),
      scope: scope ?? (useRow ? row.scope : "lender_general"),
      quote: useRow ? row.quote : null,
      sourceUrl: urlOverride ?? sourceUrl,
      basisInferred: rest.basisInferred || (official !== null && !official.basisStated),
      retrievedAt: official?.retrievedAt ?? TODAY,
      oldDocumentDate: fill.oldDocumentDate ?? (useRow ? row.sourceDate : (official?.oldDocumentDate ?? null)),
    },
    amountMinVnd: o.amountMinVnd ?? (useRow ? row.amountMinVnd : null),
    amountMaxVnd: o.amountMaxVnd ?? (useRow ? row.amountMaxVnd : null),
    termMinMonths: o.termMinMonths ?? (useRow ? row.termMinMonths : null),
    termMaxMonths: o.termMaxMonths ?? (useRow ? row.termMaxMonths : null),
    sourceUrls: [...new Set([...o.sourceUrls, urlOverride ?? sourceUrl])],
    confidence: "low",
    excludeFromRanking: false,
    excludeCode: null,
    borrowerNotes: note ? [...(o.borrowerNotes ?? []), note] : o.borrowerNotes,
  };
}

if (!process.argv.includes("--force")) {
  console.log("This overwrites data/store/loan-data.xlsx and every edit made in it. Re-run with --force to go ahead.");
  process.exit(1);
}
const offers = toOffers(lenders).map(apply);
void writeSheets(offersToSheets(offers));
console.log(`${offers.length} products, ${offers.filter((o) => !o.excludeFromRanking && o.rate).length} ranked.`);
for (const o of offers.filter((x) => x.excludeFromRanking || !x.rate)) console.log(`  not ranked: ${o.key} (${o.excludeCode})`);
