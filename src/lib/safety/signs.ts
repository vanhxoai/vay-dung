/**
 * Warning signs the user can tick, from warnings reported in the press, mostly from police
 * (docs/research/scam-patterns.md). Text lives in messages/*.json. These are signs to
 * check, never a verdict that someone is a scam.
 */

export type SignSource = { outlet: string; authority: string; date: string; url: string };

const S: Record<string, SignSource> = {
  S1: { outlet: "Báo Lào Cai", authority: "Bộ Công an", date: "2023-04-30", url: "https://baolaocai.vn/canh-bao-lua-dao-mao-danh-ngan-hang-cho-vay-truc-tuyen-lai-suat-thap-post367840.html" },
  S2: { outlet: "Báo Lào Cai", authority: "Công an TP.HCM", date: "2023-11-28", url: "https://baolaocai.vn/cong-an-canh-bao-thu-doan-lua-dao-vay-tien-truc-tuyen-gan-no-post376519.html" },
  S3: { outlet: "VnExpress", authority: "Công an TP.HCM", date: "2023-11-29", url: "https://vnexpress.net/https-vnexpress-net-nhieu-nguoi-bi-dan-du-mat-tien-vi-app-gia-cho-vay-4682256-html-4682256.html" },
  S4: { outlet: "LSVN", authority: "Công an TP. Hà Nội", date: "2025-12-01", url: "https://lsvn.vn/canh-bao-lua-dao-khi-vay-tien-online-dip-cuoi-nam-a166524.html" },
  S5: { outlet: "Thương hiệu & Công luận", authority: "Trung tâm Giám sát an toàn không gian mạng quốc gia", date: "2023-07-12", url: "https://thuonghieucongluan.com.vn/dau-hieu-nhan-biet-thu-doan-cai-cam-ung-dung-link-quang-cao-co-bac-ca-do-tin-dung-den-a196989.html" },
  S6: { outlet: "Báo Văn Hóa", authority: "Bộ Công an", date: "2020-07-09", url: "https://baovanhoa.vn/phap-luat/bo-cong-an-canh-bao-ve-bien-tuong-ung-dung-vay-tien-truc-tuyen-64234.html" },
  S7: { outlet: "SGGP", authority: "Bộ Công an", date: "2019-11-01", url: "https://www.sggp.org.vn/bo-cong-an-thong-bao-pha-duong-day-tin-dung-den-lai-1600nam-o-tphcm-post536064.html" },
  S8: { outlet: "Báo Lào Cai", authority: "Công an TP. Hà Nội", date: "2024-06-01", url: "https://baolaocai.vn/canh-bao-cac-thu-doan-cua-toi-pham-tin-dung-den-post384680.html" },
  S10: { outlet: "Tạp chí Thị trường Tài chính Tiền tệ", authority: "Công an", date: "2026-10-27", url: "https://thitruongtaichinhtiente.vn/canh-giac-bay-vay-tien-tren-ung-dung-gia-mao-chua-nhan-duoc-tien-da-mat-hang-trieu-dong-86602.html" },
  S11: { outlet: "Tuổi Trẻ", authority: "dẫn Báo Pháp Luật TP.HCM", date: "2025-12-23", url: "https://tuoitre.vn/plo/canh-bao-bay-lua-dao-tu-cac-ung-dung-vay-tien-mao-danh-dip-cuoi-nam-post888058.html" },
};

export type SignId =
  | "pay_first"
  | "unlock_fee"
  | "prove_finance"
  | "otp"
  | "personal_account"
  | "contacts"
  | "harassment"
  | "hold_id"
  | "short_term"
  | "chat_only"
  | "no_company";

export type Sign = { id: SignId; severity: "high" | "medium"; sources: SignSource[] };

export const SIGNS: readonly Sign[] = [
  { id: "pay_first", severity: "high", sources: [S.S4, S.S10] },
  { id: "unlock_fee", severity: "high", sources: [S.S1, S.S3] },
  { id: "prove_finance", severity: "high", sources: [S.S10] },
  { id: "otp", severity: "high", sources: [S.S1, S.S10] },
  { id: "personal_account", severity: "high", sources: [S.S1, S.S11] },
  { id: "contacts", severity: "high", sources: [S.S2, S.S3] },
  { id: "harassment", severity: "high", sources: [S.S2, S.S8] },
  { id: "hold_id", severity: "medium", sources: [S.S8] },
  { id: "short_term", severity: "medium", sources: [S.S7, S.S8] },
  { id: "chat_only", severity: "medium", sources: [S.S4, S.S5] },
  { id: "no_company", severity: "medium", sources: [S.S6] },
];
