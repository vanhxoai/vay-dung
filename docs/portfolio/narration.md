# Walkthrough narration

The script read by the voiceover in `vay-dung-walkthrough-vi.mp4` and `vay-dung-walkthrough-en.mp4`, one line per scene. The voices are Microsoft's neural voices through edge-tts: HoaiMy for Vietnamese and Ava (Multilingual) for English.

To change a line or the voice, edit `scripts/portfolio/narration.json`, then:

```bash
pip install edge-tts
python scripts/portfolio/tts_edge.py <workDir>        # one clip per scene; VI_VOICE / EN_VOICE / RATE change the voice
node scripts/portfolio/record.mjs vi <workDir>        # records the live site, paced to the clips
node scripts/portfolio/record.mjs en <workDir>
node scripts/portfolio/mux.mjs vi docs/portfolio/vay-dung-walkthrough-vi.mp4 <path to ffmpeg>   # run from <workDir>
node scripts/portfolio/mux.mjs en docs/portfolio/vay-dung-walkthrough-en.mp4 <path to ffmpeg>
```

edge-tts uses Edge's read-aloud service unofficially: it often drops requests (the script retries) and could stop working. To record your own voice instead, read these lines and save one file per scene in place of the generated clips.

| # | Screen | Tiếng Việt | English |
|---|---|---|---|
| 1 | Home | Vay Đúng là một dự án học tập, giúp người trẻ ở Việt Nam so sánh các khoản vay tiêu dùng một cách trung thực. | Vay Đúng is a student project that helps young people in Vietnam compare consumer loans honestly. |
| 2 | Your need | Đầu tiên, bạn cho biết nhu cầu: vay hai mươi triệu đồng, trả trong hai mươi bốn tháng. | First, you describe your need: twenty million dong, repaid over twenty-four months. |
| 3 | Your finances | Tiếp theo là thu nhập, khoản nợ đang trả, tuổi, và giấy tờ chứng minh thu nhập. Mọi thông tin này chỉ nằm trong trình duyệt của bạn, không được gửi đi đâu cả. | Next: your income, the debts you already pay, your age, and your proof of income. All of this stays in your browser. Nothing is sent to a server. |
| 4 | Verdict | Kết luận luôn đứng đầu. Theo hướng dẫn của Vay Đúng, tổng tiền trả nợ mỗi tháng không nên vượt quá bốn mươi phần trăm thu nhập. | The verdict always comes first. Vay Đúng's guideline is that total debt payments should stay under forty percent of income. |
| 5 | Ranking table | Mọi khoản vay được quy về cùng một thước đo: lãi suất thực mỗi năm, tính bằng IRR từ dòng tiền thật, kể cả phí và bảo hiểm. Danh sách xếp theo mức vừa sức trước, rồi mới đến chi phí. | Every loan is converted into one measure: the real yearly rate, solved as an IRR from the actual cash flows, including fees and insurance. Loans are ranked by affordability first, then by cost. |
| 6 | Offer card and why | Mỗi thẻ ghi rõ nguồn và ngày lấy số liệu, và giải thích vì sao khoản vay đứng ở vị trí này. | Each card names its source and the date it was checked, and explains why the loan sits in this position. |
| 7 | Monthly schedule | Bạn cũng có thể xem lịch trả nợ từng tháng. | You can also see the repayment schedule, month by month. |
| 8 | "Too much" case | Nếu khoản vay vượt quá sức, ứng dụng nói thẳng: chúng tôi không khuyên bạn vay số tiền này. Sau đó gợi ý vay ít hơn, hoặc trả trong thời gian dài hơn. | When a loan is too much, the app says so plainly: we don't recommend borrowing this. Then it suggests a smaller amount, or a longer term. |
| 9 | How we rank | Cách xếp hạng được công bố đầy đủ. Không bên cho vay nào trả tiền để được xếp cao hơn. | The ranking method is published in full. No lender pays to rank higher. |
| 10 | Data | Toàn bộ dữ liệu, tám mươi hai sản phẩm từ hai mươi bên cho vay có giấy phép, đều ghi nguồn và có thể tải về. | All the data, eighty-two products from twenty licensed lenders, is sourced and can be downloaded. |
| 11 | Lender check | Cuối cùng, bạn có thể kiểm tra một bên cho vay có nằm trong danh sách được Ngân hàng Nhà nước cấp phép hay không. | Finally, you can check whether a lender is on the State Bank of Vietnam's list of licensed institutions. |
| 12 | Closing | Vay Đúng. Hiểu chi phí thật, trước khi vay. | Vay Đúng. Know the real cost, before you borrow. |
