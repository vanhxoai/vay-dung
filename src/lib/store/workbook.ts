/**
 * Converts offers to and from the workbook's rows. Pure, so it needs no Excel library and is
 * easy to test. scripts/store/ does the file reading and writing.
 *
 * Each sheet is a list of rows keyed by column name. A blank cell, or "chưa rõ", means unknown.
 */
import type { Offer, OfferFee, OfferInsurance, OfferRateNote } from "@/lib/recommend/offers";
import { StoreOffer } from "./schema";

export type Cell = string | number | boolean | Date | null | undefined;
export type Row = Record<string, Cell>;
export type SheetName = "products" | "fees" | "insurance" | "rateNotes" | "borrowerNotes";
export type Sheets = Record<SheetName, Row[]>;

export const SHEET_TITLES: Record<SheetName, string> = {
  products: "Sản phẩm",
  fees: "Phí",
  insurance: "Bảo hiểm",
  rateNotes: "Ghi chú lãi suất",
  borrowerNotes: "Ghi chú người vay",
};

export const COLUMNS: Record<SheetName, readonly (readonly [string, string])[]> = {
  products: [
    ["key", "Mã: bên-cho-vay/sản-phẩm. Không đổi"],
    ["include_in_ranking", "có / không"],
    ["exclude_code", "Lý do không xếp hạng, khi ghi không"],
    ["lender_name", "Tên bên cho vay"],
    ["legal_name", "Tên pháp lý, đúng theo danh sách NHNN"],
    ["licensed_id", "Mã trong data/licensed-institutions.json"],
    ["category", "bank / finance_company"],
    ["name_vi", "Tên sản phẩm"],
    ["name_en", "Tên tiếng Anh"],
    ["product_type", "cash_loan / installment / bnpl / overdraft / other"],
    ["goods", "phone / motorbike / education / other_goods / any_goods: chỉ cho mục đích này. Trống: mọi mục đích"],
    ["rate_min", "Lãi suất thấp nhất, %: 1,5 là 1,5%"],
    ["rate_max", "Lãi suất cao nhất, %"],
    ["rate_basis", "flat (lãi phẳng) / reducing (dư nợ giảm dần)"],
    ["rate_period", "monthly / yearly"],
    ["basis_assumed", "có: nguồn không nói cách tính lãi, ta giả định"],
    ["rate_source_type", "official / lender_partner / aggregator / press"],
    ["rate_source_name", "Tên nguồn"],
    ["rate_source_url", "Đường dẫn nguồn của lãi suất"],
    ["rate_retrieved_at", "Ngày đọc nguồn, YYYY-MM-DD"],
    ["rate_scope", "product / lender_general: số của sản phẩm, hay của cả bên cho vay"],
    ["rate_quote", "Câu trích ngắn có con số"],
    ["rate_old_doc_date", "Ngày đăng của nguồn, nếu biết"],
    ["segment", "Áp dụng cho nhóm khách nào"],
    ["min_is_promo", "có: mức thấp là khuyến mãi, chỉ tính mức cao"],
    ["min_unconfirmed", "có: mức thấp chưa xác nhận, chỉ tính mức cao"],
    ["floor_only", "có: chỉ biết mức thấp nhất, ghi cùng số vào rate_min và rate_max"],
    ["min_by_term", "Mức thấp theo kỳ hạn. Ví dụ 15:30;0:36.04"],
    ["max_is_reference", "có: mức cao chỉ là tham chiếu"],
    ["amortization", "annuity / equal_principal"],
    ["amortization_assumed", "có: cách trả gốc do ta giả định"],
    ["amount_min", "Vay ít nhất, đồng"],
    ["amount_max", "Vay nhiều nhất, đồng"],
    ["term_min", "Kỳ hạn ngắn nhất, tháng"],
    ["term_max", "Kỳ hạn dài nhất, tháng"],
    ["min_age", "Tuổi nhỏ nhất"],
    ["max_age", "Tuổi lớn nhất"],
    ["max_age_at_end", "có: tính tuổi lúc hết hợp đồng"],
    ["min_income", "Thu nhập tối thiểu mỗi tháng, đồng"],
    ["documents", "Giấy tờ, mỗi dòng một loại"],
    ["existing_customer", "có: chỉ dành cho khách hiện có"],
    ["employer_restriction", "Giới hạn về nơi làm việc"],
    ["other_conditions", "Điều kiện khác, mỗi dòng một điều"],
    ["fees_completeness", "complete / partial / unknown"],
    ["insurance_completeness", "complete / partial / unknown"],
    ["late_text_vi", "Phạt trả chậm"],
    ["late_text_en", "Phạt trả chậm, tiếng Anh"],
    ["late_multiplier", "Lãi quá hạn so với lãi trong hạn: 1,5 là 150%"],
    ["late_overdue_interest", "Lãi trên lãi quá hạn, %/năm"],
    ["conflict_fields", "Các mục mà nguồn mâu thuẫn, mỗi dòng một mục"],
    ["source_url", "Trang sản phẩm"],
    ["source_urls", "Mọi nguồn, mỗi dòng một link"],
    ["retrieved_at", "Ngày đọc trang sản phẩm"],
    ["oldest_retrieved_at", "Ngày cũ nhất của mọi con số. Quá 90 ngày thì ngừng xếp hạng"],
    ["confidence", "high / medium / low"],
  ],
  fees: [
    ["key", "Mã sản phẩm"],
    ["fee_group", "monthly: có trong chi phí / other: chỉ hiện ra / uncosted: chưa rõ số tiền"],
    ["name_vi", "Tên phí"],
    ["name_en", "Tên tiếng Anh"],
    ["trigger", "application / disbursement / periodic / prepayment / late_payment / per_transaction / on_request / other"],
    ["percent", "%"],
    ["fixed_vnd", "Số tiền cố định, đồng"],
    ["min_vnd", "Thấp nhất, đồng"],
    ["max_vnd", "Cao nhất, đồng"],
    ["tiers", "Bậc phí, JSON"],
    ["greater_of_remaining_interest", "có: lấy số lớn hơn giữa % và lãi còn lại"],
  ],
  insurance: [
    ["key", "Mã sản phẩm"],
    ["name_vi", "Tên bảo hiểm"],
    ["name_en", "Tên tiếng Anh"],
    ["mandatory", "có / không / trống nếu chưa rõ"],
    ["collection", "deducted_from_payout / added_to_loan / paid_upfront / monthly / on_event / unknown"],
    ["method", "percent_of_principal / annual_rate_on_declining_balance / annual_rate_on_insured_amount / fixed / unknown"],
    ["rate_min", "%"],
    ["rate_max", "%"],
    ["insured_tiers", "Hệ số số tiền bảo hiểm theo kỳ hạn, JSON"],
    ["fixed_vnd", "Số tiền cố định, đồng"],
  ],
  rateNotes: [
    ["key", "Mã sản phẩm"],
    ["kind", "advertised_floor / regulatory_ceiling / benchmark / offered_range"],
    ["segment", "Nhóm khách"],
    ["min", "%"],
    ["max", "%"],
    ["basis", "flat / reducing / unknown"],
    ["period", "daily / monthly / yearly / unknown"],
    ["old_doc_date", "Ngày tài liệu, nếu đã cũ"],
  ],
  borrowerNotes: [
    ["key", "Mã sản phẩm"],
    ["vi", "Ghi chú cho người vay"],
    ["en", "Bản tiếng Anh"],
  ],
};

const yesNo = (b: boolean | null | undefined): Cell => (b === true ? "có" : b === false ? "không" : null);
const lines = (a: readonly string[] | null | undefined): Cell => (a && a.length > 0 ? a.join("\n") : null);
const json = (v: unknown): Cell => (v === null || v === undefined ? null : JSON.stringify(v));

export function offersToSheets(offers: readonly Offer[]): Sheets {
  const sheets: Sheets = { products: [], fees: [], insurance: [], rateNotes: [], borrowerNotes: [] };
  for (const o of offers) {
    const r = o.rate;
    sheets.products.push({
      key: o.key,
      include_in_ranking: yesNo(!o.excludeFromRanking),
      exclude_code: o.excludeCode,
      lender_name: o.lenderName,
      legal_name: o.legalName,
      licensed_id: o.licensedInstitutionId,
      category: o.category,
      name_vi: o.nameVi,
      name_en: o.nameEn,
      product_type: o.productType,
      goods: o.goods,
      rate_min: r?.minPercent,
      rate_max: r?.maxPercent,
      rate_basis: r?.basis,
      rate_period: r?.period,
      basis_assumed: r ? yesNo(r.basisInferred) : null,
      rate_source_type: r?.sourceType,
      rate_source_name: r?.sourceName,
      rate_source_url: r?.sourceUrl,
      rate_retrieved_at: r?.retrievedAt,
      rate_scope: r?.scope,
      rate_quote: r?.quote,
      rate_old_doc_date: r?.oldDocumentDate,
      segment: r?.segment,
      min_is_promo: r?.minIsPromotional ? "có" : null,
      min_unconfirmed: r?.minUnconfirmed ? "có" : null,
      floor_only: r?.floorOnly ? "có" : null,
      min_by_term: r?.minByTerm?.map((m) => `${m.termMonthsMin}:${m.percent}`).join(";"),
      max_is_reference: r?.maxIsReference ? "có" : null,
      amortization: o.amortization,
      amortization_assumed: yesNo(o.amortizationInferred),
      amount_min: o.amountMinVnd,
      amount_max: o.amountMaxVnd,
      term_min: o.termMinMonths,
      term_max: o.termMaxMonths,
      min_age: o.minAge,
      max_age: o.maxAge,
      max_age_at_end: yesNo(o.maxAgeAtLoanEnd),
      min_income: o.minMonthlyIncomeVnd,
      documents: lines(o.documents),
      existing_customer: yesNo(o.existingCustomerRequired),
      employer_restriction: o.employerRestriction,
      other_conditions: lines(o.otherConditions),
      fees_completeness: o.feesCompleteness,
      insurance_completeness: o.insuranceCompleteness,
      late_text_vi: o.lateTextVi,
      late_text_en: o.lateTextEn,
      late_multiplier: o.lateMultiplier,
      late_overdue_interest: o.lateOverdueInterestPercentYear,
      conflict_fields: lines(o.conflictFields),
      source_url: o.sourceUrl,
      source_urls: lines(o.sourceUrls),
      retrieved_at: o.retrievedAt,
      oldest_retrieved_at: o.oldestRetrievedAt,
      confidence: o.confidence,
    });
    for (const f of o.monthlyFees) sheets.fees.push({ key: o.key, fee_group: "monthly", name_vi: f.nameVi, name_en: f.nameEn, fixed_vnd: f.amountVnd });
    for (const f of o.otherFees) {
      sheets.fees.push({
        key: o.key,
        fee_group: "other",
        name_vi: f.nameVi,
        name_en: f.nameEn,
        trigger: f.trigger,
        percent: f.percent,
        fixed_vnd: f.fixedVnd,
        min_vnd: f.minVnd,
        max_vnd: f.maxVnd,
        tiers: json(f.tiers),
        greater_of_remaining_interest: f.greaterOfRemainingInterest ? "có" : null,
      });
    }
    for (const name of o.uncostedFees) sheets.fees.push({ key: o.key, fee_group: "uncosted", name_vi: name });
    for (const i of o.insurance) {
      sheets.insurance.push({
        key: o.key,
        name_vi: i.nameVi,
        name_en: i.nameEn,
        mandatory: yesNo(i.mandatory),
        collection: i.collection,
        method: i.method,
        rate_min: i.ratePercentMin,
        rate_max: i.ratePercentMax,
        insured_tiers: json(i.insuredTiers),
        fixed_vnd: i.fixedVnd,
      });
    }
    for (const n of o.rateNotes) {
      sheets.rateNotes.push({ key: o.key, kind: n.kind, segment: n.segment, min: n.minPercent, max: n.maxPercent, basis: n.basis, period: n.period, old_doc_date: n.oldDocumentDate });
    }
    for (const n of o.borrowerNotes ?? []) sheets.borrowerNotes.push({ key: o.key, vi: n.vi, en: n.en });
  }
  return sheets;
}

const UNKNOWN = /^(chưa rõ|unknown|n\/a|-)?$/i;

function blank(c: Cell): boolean {
  return c === null || c === undefined || (typeof c === "string" && UNKNOWN.test(c.trim()));
}
function text(c: Cell): string | null {
  return blank(c) ? null : String(c).trim();
}
function num(c: Cell): number | null {
  if (blank(c)) return null;
  // Vietnamese Excel may hand back "1,5" as text.
  const n = typeof c === "number" ? c : Number(String(c).trim().replace(",", "."));
  if (Number.isNaN(n)) throw new Error(`"${String(c)}" is not a number`);
  return n;
}
function bool(c: Cell): boolean | null {
  if (blank(c)) return null;
  if (typeof c === "boolean") return c;
  const s = String(c).trim().toLowerCase();
  if (["có", "co", "yes", "true"].includes(s)) return true;
  if (["không", "khong", "no", "false"].includes(s)) return false;
  throw new Error(`"${String(c)}" should be "có" or "không"`);
}
function date(c: Cell): string | null {
  if (blank(c)) return null;
  // A date typed in Excel arrives as a Date, not as the text we wrote.
  return c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim();
}
function list(c: Cell): string[] | null {
  const s = text(c);
  return s === null ? null : s.split(/\r?\n/).filter(Boolean);
}
function parseJson<T>(c: Cell): T | null {
  const s = text(c);
  if (s === null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    throw new Error(`"${s}" is not valid JSON`);
  }
}
function minByTerm(c: Cell): { termMonthsMin: number; percent: number }[] | undefined {
  const s = text(c);
  if (s === null) return undefined;
  return s.split(";").map((part) => {
    const [a, b] = part.split(":").map((x) => Number(x.trim().replace(",", ".")));
    if (Number.isNaN(a) || b === undefined || Number.isNaN(b)) throw new Error(`"${s}" should look like 15:30;0:36.04`);
    return { termMonthsMin: a, percent: b };
  });
}

export type ImportIssue = { sheet: string; row: number; message: string };

/** Header rows take the first two lines of each sheet, so the first data row is line 3. */
const FIRST_DATA_LINE = 3;

function rateFrom(r: Row): Offer["rate"] {
  const min = num(r.rate_min);
  const max = num(r.rate_max);
  if (min === null && max === null) return null;
  if (min === null || max === null) throw new Error("rate_min and rate_max must both be filled, or both empty");
  const basis = text(r.rate_basis);
  const period = text(r.rate_period);
  const type = text(r.rate_source_type);
  const name = text(r.rate_source_name);
  const url = text(r.rate_source_url);
  const retrieved = date(r.rate_retrieved_at);
  if (!basis || !period || !type || !name || !url || !retrieved) {
    throw new Error("a rate needs rate_basis, rate_period, rate_source_type, rate_source_name, rate_source_url and rate_retrieved_at");
  }
  return {
    minPercent: min,
    maxPercent: max,
    basis: basis as "flat" | "reducing",
    period: period as "monthly" | "yearly",
    basisInferred: bool(r.basis_assumed) === true,
    minIsPromotional: bool(r.min_is_promo) === true ? true : undefined,
    minUnconfirmed: bool(r.min_unconfirmed) === true ? true : undefined,
    floorOnly: bool(r.floor_only) === true ? true : undefined,
    minByTerm: minByTerm(r.min_by_term),
    maxIsReference: bool(r.max_is_reference) === true ? true : undefined,
    segment: text(r.segment),
    sourceType: type as NonNullable<Offer["rate"]>["sourceType"],
    sourceName: name,
    scope: (text(r.rate_scope) ?? "product") as NonNullable<Offer["rate"]>["scope"],
    quote: text(r.rate_quote),
    sourceUrl: url,
    retrievedAt: retrieved,
    oldDocumentDate: date(r.rate_old_doc_date),
  };
}

/** Reads the rows back, collecting every problem so one run reports them all. */
export function sheetsToOffers(sheets: Sheets): { offers: Offer[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const known = new Set(sheets.products.map((r) => text(r.key)));
  const byKey = (rows: Row[], title: string) => {
    const map = new Map<string, Row[]>();
    rows.forEach((row, i) => {
      const k = text(row.key);
      if (k === null || !known.has(k)) {
        issues.push({ sheet: title, row: i + FIRST_DATA_LINE, message: `key "${k ?? ""}" is not on the ${SHEET_TITLES.products} sheet` });
        return;
      }
      map.set(k, [...(map.get(k) ?? []), row]);
    });
    return map;
  };
  const fees = byKey(sheets.fees, SHEET_TITLES.fees);
  const insurance = byKey(sheets.insurance, SHEET_TITLES.insurance);
  const rateNotes = byKey(sheets.rateNotes, SHEET_TITLES.rateNotes);
  const borrowerNotes = byKey(sheets.borrowerNotes, SHEET_TITLES.borrowerNotes);

  const seen = new Set<string>();
  const offers: Offer[] = [];
  sheets.products.forEach((r, i) => {
    const line = i + FIRST_DATA_LINE;
    try {
      const key = text(r.key) ?? "";
      if (seen.has(key)) throw new Error(`key "${key}" appears twice`);
      seen.add(key);
      const f = fees.get(key) ?? [];
      const notes = (borrowerNotes.get(key) ?? []).map((n) => ({ vi: text(n.vi) ?? "", en: text(n.en) ?? "" }));
      const include = bool(r.include_in_ranking);
      if (include === null) throw new Error('include_in_ranking must be "có" or "không"');
      const offer = {
        key,
        licensedInstitutionId: text(r.licensed_id) ?? "",
        lenderName: text(r.lender_name) ?? "",
        legalName: text(r.legal_name) ?? "",
        category: text(r.category) as Offer["category"],
        nameVi: text(r.name_vi) ?? "",
        nameEn: text(r.name_en),
        productType: text(r.product_type) as Offer["productType"],
        goods: text(r.goods) as Offer["goods"],
        amountMinVnd: num(r.amount_min),
        amountMaxVnd: num(r.amount_max),
        termMinMonths: num(r.term_min),
        termMaxMonths: num(r.term_max),
        rate: rateFrom(r),
        rateNotes: (rateNotes.get(key) ?? []).map(
          (n): OfferRateNote => ({
            kind: text(n.kind) as OfferRateNote["kind"],
            segment: text(n.segment),
            minPercent: num(n.min),
            maxPercent: num(n.max),
            basis: (text(n.basis) ?? "unknown") as OfferRateNote["basis"],
            period: (text(n.period) ?? "unknown") as OfferRateNote["period"],
            oldDocumentDate: date(n.old_doc_date),
          }),
        ),
        amortization: text(r.amortization) as Offer["amortization"],
        amortizationInferred: bool(r.amortization_assumed) === true,
        monthlyFees: f
          .filter((x) => text(x.fee_group) === "monthly")
          .map((x) => ({ nameVi: text(x.name_vi) ?? "", nameEn: text(x.name_en), amountVnd: num(x.fixed_vnd) ?? 0 })),
        otherFees: f
          .filter((x) => text(x.fee_group) === "other")
          .map(
            (x): OfferFee => ({
              nameVi: text(x.name_vi) ?? "",
              nameEn: text(x.name_en),
              trigger: text(x.trigger) ?? "other",
              percent: num(x.percent),
              fixedVnd: num(x.fixed_vnd),
              minVnd: num(x.min_vnd),
              maxVnd: num(x.max_vnd),
              tiers: parseJson(x.tiers),
              greaterOfRemainingInterest: bool(x.greater_of_remaining_interest) === true,
            }),
          ),
        uncostedFees: f.filter((x) => text(x.fee_group) === "uncosted").map((x) => text(x.name_vi) ?? ""),
        feesCompleteness: (text(r.fees_completeness) ?? "unknown") as Offer["feesCompleteness"],
        insurance: (insurance.get(key) ?? []).map(
          (x): OfferInsurance => ({
            nameVi: text(x.name_vi) ?? "",
            nameEn: text(x.name_en),
            mandatory: bool(x.mandatory),
            collection: (text(x.collection) ?? "unknown") as OfferInsurance["collection"],
            method: (text(x.method) ?? "unknown") as OfferInsurance["method"],
            ratePercentMin: num(x.rate_min),
            ratePercentMax: num(x.rate_max),
            insuredTiers: parseJson(x.insured_tiers),
            fixedVnd: num(x.fixed_vnd),
          }),
        ),
        insuranceCompleteness: (text(r.insurance_completeness) ?? "unknown") as Offer["insuranceCompleteness"],
        minAge: num(r.min_age),
        maxAge: num(r.max_age),
        maxAgeAtLoanEnd: bool(r.max_age_at_end),
        minMonthlyIncomeVnd: num(r.min_income),
        documents: list(r.documents),
        existingCustomerRequired: bool(r.existing_customer),
        employerRestriction: text(r.employer_restriction),
        otherConditions: list(r.other_conditions),
        lateTextVi: text(r.late_text_vi),
        lateTextEn: text(r.late_text_en),
        lateMultiplier: num(r.late_multiplier),
        lateOverdueInterestPercentYear: num(r.late_overdue_interest),
        conflictFields: list(r.conflict_fields) ?? [],
        sourceUrl: text(r.source_url) ?? "",
        sourceUrls: list(r.source_urls) ?? [],
        retrievedAt: date(r.retrieved_at) ?? "",
        oldestRetrievedAt: date(r.oldest_retrieved_at) ?? "",
        confidence: text(r.confidence) as Offer["confidence"],
        excludeFromRanking: !include,
        excludeCode: text(r.exclude_code) as Offer["excludeCode"],
        borrowerNotes: notes.length > 0 ? notes : undefined,
      } satisfies Offer;
      const parsed = StoreOffer.safeParse(offer);
      if (!parsed.success) {
        for (const e of parsed.error.issues) issues.push({ sheet: SHEET_TITLES.products, row: line, message: `${key}: ${e.path.join(".")}: ${e.message}` });
        return;
      }
      if (offer.rate === null && !offer.excludeFromRanking) throw new Error(`${key}: ranked, but has no rate`);
      if (offer.excludeFromRanking && offer.excludeCode === null) throw new Error(`${key}: not ranked, so it needs exclude_code`);
      offers.push(offer);
    } catch (e) {
      issues.push({ sheet: SHEET_TITLES.products, row: line, message: (e as Error).message });
    }
  });
  return { offers, issues };
}

/** One flat line per product, for the download on the data page. */
export function offersToCsv(offers: readonly Offer[]): string {
  const header = ["key", "lender", "product", "ranked", "rate_min", "rate_max", "only_lowest_known", "lowest_unconfirmed", "basis", "period", "basis_assumed", "source_type", "source_name", "source_url", "source_date", "retrieved_at", "scope", "confidence"];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = offers.map((o) => {
    const r = o.rate;
    return [o.key, o.lenderName, o.nameVi, !o.excludeFromRanking, r?.minPercent, r?.maxPercent, r?.floorOnly ?? false, Boolean(r?.minUnconfirmed || r?.minIsPromotional), r?.basis, r?.period, r?.basisInferred, r?.sourceType, r?.sourceName, r?.sourceUrl, r?.oldDocumentDate, r?.retrievedAt, r?.scope, o.confidence].map(esc).join(",");
  });
  return [header.join(","), ...rows].join("\n") + "\n";
}
