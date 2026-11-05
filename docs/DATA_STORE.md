# Kho dữ liệu khoản vay

Mọi con số dùng để xếp hạng nằm ở một file Excel: [`data/store/loan-data.xlsx`](../data/store/loan-data.xlsx). App không đọc trực tiếp file này. App đọc bản đã kiểm tra.

```
data/store/loan-data.xlsx        bạn sửa ở đây
        │  npm run data:import   kiểm tra mọi dòng, báo lỗi theo sheet và dòng
        ▼
data/store/snapshot.json         app đọc file này
public/data/loan-rates.csv       bản tải về trên trang /du-lieu
        │
        ▼
src/lib/store/index.ts           nơi duy nhất app lấy dữ liệu
        ▲
        │  LOAN_RATES_CSV_URL    tùy chọn: nguồn lãi suất trực tiếp, xem bên dưới
```

`npm run build` tự chạy bước nhập, nên file Excel luôn là bản gốc. Một bài test sẽ báo lỗi nếu bạn sửa Excel mà quên nhập lại.

## Cập nhật một lãi suất

1. Mở `data/store/loan-data.xlsx`, sheet **Sản phẩm**. Tìm dòng theo cột `key`.
2. Sửa `rate_min`, `rate_max`, `rate_basis`, `rate_period`.
3. Ghi nguồn: `rate_source_type`, `rate_source_name`, `rate_source_url`, `rate_retrieved_at`. Thiếu nguồn thì không nhập được.
4. Muốn đưa vào xếp hạng: `include_in_ranking` = `có`, và xóa `exclude_code`.
5. Chạy lệnh:

```bash
npm run data:import
```

6. Chạy `npm run dev` để xem kết quả.

Sheet **Hướng dẫn** trong file có các quy ước. Hàng thứ hai của mỗi sheet giải thích từng cột. Dòng tô vàng đang dùng nguồn không chính thức.

## Các loại nguồn

| `rate_source_type` | Nghĩa | Được dùng cho kết luận "vừa sức"? |
|---|---|---|
| `official` | Tài liệu của chính bên cho vay | Có |
| `lender_partner` | Đối tác phân phối của bên cho vay | Không |
| `aggregator` | Trang so sánh lãi suất | Không |
| `press` | Báo chí | Không |

Chúng đều được xếp hạng theo cùng một cách, và thẻ sản phẩm ghi rõ nguồn. Người dùng có thể ẩn những gì không phải `official`.

## Khi chỉ có một phần số liệu

| Tình huống | Cách ghi | Kết quả |
|---|---|---|
| Có khoảng thấp–cao | `rate_min`, `rate_max` | Tính ở cả hai đầu, xếp theo đầu cao |
| Chỉ có "từ X%" | Ghi X vào cả hai ô, `floor_only` = `có` | Xếp sau mọi khoản đã biết mức cao nhất |
| Mức thấp không khớp quảng cáo, hoặc chỉ có khung chung | `min_unconfirmed` = `có` | Chỉ tính ở mức cao |
| Mức thấp là khuyến mãi 0% | `min_is_promo` = `có` | Chỉ tính ở mức cao |
| Không có số nào | Để trống, `include_in_ranking` = `không`, chọn `exclude_code` | Liệt kê riêng, kèm lý do |

Đừng điền số đoán. Ô trống hiện là "chưa rõ".

## Cập nhật theo thời gian thực

Khi sẵn sàng, đặt biến môi trường `LOAN_RATES_CSV_URL` là đường dẫn đến một file CSV có các cột:

```
key,rate_min,rate_max,rate_basis,rate_period,rate_source_type,rate_source_name,rate_source_url,rate_retrieved_at,rate_scope
```

Trang `/vay` đọc lại nguồn này mỗi 5 phút, không cần triển khai lại. Nguồn này chỉ thay lãi suất, các thông tin khác vẫn lấy từ Excel. Dòng lỗi bị bỏ qua, và nếu nguồn hỏng thì app dùng lại bản đã nhập.

Hai cách đơn giản để có đường dẫn đó:

- **Google Sheets:** tạo một sheet với các cột trên, chọn File → Share → Publish to web → CSV. Sửa sheet là web đổi theo.
- **Hệ thống của ngân hàng hoặc API riêng:** chỉ cần xuất ra CSV đúng các cột trên.

Muốn đổi hẳn sang cơ sở dữ liệu thì chỉ cần sửa `src/lib/store/index.ts`. Phần còn lại của app không biết dữ liệu đến từ đâu.

## Các file khác

- `data/lenders/*.json`: hồ sơ nghiên cứu từ nguồn chính thức, với từng con số và ghi chú. Đây là tài liệu gốc để đối chiếu. Sửa file này **không** đổi kết quả trên web.
- `data/research/secondary/*.json`: kết quả tìm từ nguồn không chính thức, kèm câu trích dẫn.
- `scripts/store/seed.ts`: chỉ chạy một lần để tạo file Excel. Chạy lại với `--force` sẽ xóa mọi chỉnh sửa trong Excel.
