/** Reads and writes data/store/loan-data.xlsx. The rules live in src/lib/store/workbook.ts. */
import ExcelJS from "exceljs";
import { EXCLUDE_CODES, RATE_SCOPES, SOURCE_TYPES } from "../../src/lib/store/schema";
import { COLUMNS, SHEET_TITLES, type Cell, type Row, type SheetName, type Sheets } from "../../src/lib/store/workbook";

export const WORKBOOK_PATH = "data/store/loan-data.xlsx";

const NAMES = Object.keys(SHEET_TITLES) as SheetName[];

const DROPDOWNS: Partial<Record<string, readonly string[]>> = {
  include_in_ranking: ["có", "không"],
  exclude_code: EXCLUDE_CODES,
  category: ["bank", "finance_company"],
  product_type: ["cash_loan", "installment", "bnpl", "overdraft", "other"],
  goods: ["phone", "motorbike", "education", "other_goods", "any_goods"],
  rate_basis: ["flat", "reducing"],
  rate_period: ["monthly", "yearly"],
  basis_assumed: ["có", "không"],
  rate_source_type: SOURCE_TYPES,
  rate_scope: RATE_SCOPES,
  amortization: ["annuity", "equal_principal"],
  confidence: ["high", "medium", "low"],
  fees_completeness: ["complete", "partial", "unknown"],
  insurance_completeness: ["complete", "partial", "unknown"],
  fee_group: ["monthly", "other", "uncosted"],
};

const GUIDE: readonly string[] = [
  "KHO DỮ LIỆU KHOẢN VAY, VAY ĐÚNG",
  "",
  "Đây là nơi duy nhất lưu dữ liệu dùng để xếp hạng. Sửa ở đây rồi chạy: npm run data:import",
  "Lệnh này kiểm tra toàn bộ file và báo đúng sheet, đúng dòng nếu có lỗi. App chỉ đọc kết quả sau khi kiểm tra xong.",
  "",
  "CÁCH CẬP NHẬT LÃI SUẤT",
  "1. Mở sheet Sản phẩm, tìm dòng theo cột key.",
  "2. Sửa rate_min, rate_max, rate_basis, rate_period.",
  "3. Ghi nguồn: rate_source_type, rate_source_name, rate_source_url, rate_retrieved_at. Thiếu nguồn thì không nhập được.",
  "4. Muốn đưa vào xếp hạng: include_in_ranking = có, xóa exclude_code.",
  "",
  "CÁCH THÊM SẢN PHẨM",
  "Thêm một dòng ở sheet Sản phẩm. Bên cho vay phải có trong data/licensed-institutions.json, nếu không lệnh nhập sẽ báo lỗi.",
  "",
  "QUY ƯỚC",
  "- Ô trống hoặc chưa rõ nghĩa là chưa biết. Đừng điền số đoán.",
  "- Lãi suất ghi đúng như nguồn công bố: 1,5 nghĩa là 1,5%.",
  "- official: tài liệu của bên cho vay. lender_partner: đối tác phân phối. aggregator: trang so sánh. press: báo chí.",
  "- Dòng tô vàng đang dùng lãi suất từ nguồn không chính thức.",
  "- Hai dòng đầu của mỗi sheet là tiêu đề: đừng đổi tên cột.",
];

function cellValue(c: ExcelJS.CellValue): Cell {
  if (c === null || c === undefined) return null;
  if (c instanceof Date || typeof c !== "object") return c as Cell;
  if ("result" in c) return (c.result ?? null) as Cell;
  if ("richText" in c) return c.richText.map((r) => r.text).join("");
  if ("text" in c) return c.text as string;
  return null;
}

export async function readSheets(path = WORKBOOK_PATH): Promise<Sheets> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const out = {} as Sheets;
  for (const name of NAMES) {
    const ws = wb.getWorksheet(SHEET_TITLES[name]);
    if (!ws) throw new Error(`Sheet "${SHEET_TITLES[name]}" is missing`);
    const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) => (v === null || v === undefined ? "" : String(v).trim()));
    const rows: Row[] = [];
    ws.eachRow((row, n) => {
      if (n < 3) return;
      const r: Row = {};
      header.forEach((h, i) => {
        if (h) r[h] = cellValue(row.getCell(i).value);
      });
      if (Object.values(r).some((v) => v !== null && v !== "")) rows.push(r);
    });
    out[name] = rows;
  }
  return out;
}

const NON_OFFICIAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4CC" } };

export async function writeSheets(sheets: Sheets, path = WORKBOOK_PATH): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const guide = wb.addWorksheet("Hướng dẫn");
  guide.getColumn(1).width = 110;
  GUIDE.forEach((line, i) => {
    const cell = guide.getCell(i + 1, 1);
    cell.value = line;
    if (line && line === line.toUpperCase()) cell.font = { bold: true };
  });
  for (const name of NAMES) {
    const ws = wb.addWorksheet(SHEET_TITLES[name], { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
    const cols = COLUMNS[name];
    ws.columns = cols.map(([key]) => ({ width: key === "key" ? 44 : Math.max(12, key.length + 2) }));
    ws.getRow(1).values = cols.map(([k]) => k);
    ws.getRow(2).values = cols.map(([, d]) => d);
    ws.getRow(1).font = { bold: true };
    ws.getRow(2).font = { italic: true, color: { argb: "FF555555" } };
    ws.getRow(2).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(2).height = 60;
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };
    for (const r of sheets[name]) {
      // Dates and codes stay text, so Excel doesn't reformat them.
      const row = ws.addRow(cols.map(([k]) => r[k] ?? null));
      row.alignment = { vertical: "top" };
      if (r.rate_source_type && r.rate_source_type !== "official") row.eachCell((c) => (c.fill = NON_OFFICIAL_FILL));
    }
    // New rows get the dropdowns too. Touching a cell grows rowCount, so fix the end first.
    const lastRow = ws.rowCount + 50;
    cols.forEach(([k], i) => {
      const options = DROPDOWNS[k];
      if (!options) return;
      for (let n = 3; n <= lastRow; n++) {
        ws.getCell(n, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`"${options.join(",")}"`] };
      }
    });
  }
  await wb.xlsx.writeFile(path);
}
