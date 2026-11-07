# Walkthrough narration

The script read by the voiceover in `vay-dung-walkthrough-vi.mp4` and `vay-dung-walkthrough-en.mp4`, one line per scene. The voices are Microsoft's neural voices through edge-tts: HoaiMy for Vietnamese and Ava (Multilingual) for English.

To change a line or the voice, edit `scripts/portfolio/narration.json`, then:

```bash
pip install edge-tts
python scripts/portfolio/tts_edge.py <workDir>        # one clip per scene; VI_VOICE / EN_VOICE / RATE change the voice
node scripts/portfolio/record.mjs vi <workDir>        # records the live site, paced to the clips
node scripts/portfolio/record.mjs en <workDir>
node scripts/portfolio/mux.mjs vi voice-vi.mp4 <path to ffmpeg>   # run from <workDir>; voice only
node scripts/portfolio/mux.mjs en voice-en.mp4 <path to ffmpeg>
python scripts/portfolio/promo.py vi <workDir>/voice-vi.mp4 docs/portfolio/vay-dung-walkthrough-vi.mp4
python scripts/portfolio/promo.py en <workDir>/voice-en.mp4 docs/portfolio/vay-dung-walkthrough-en.mp4
```

## The edit (`promo.py`)

`promo.py` turns the plain voice-only recording into a vertical video (1080 × 1920, 30 fps), ready for TikTok, Reels or Shorts. It needs numpy, Pillow, ffmpeg and the Inter font. Both languages render in about 4 minutes on 4 cores.

- **Cuts:** still moments between scenes are cut out, and long waits (the form being filled in again) play at 3× with a "3× »" badge.
- **Camera:** the app sits in a phone frame on an animated green background. The camera zooms in on each highlighted element and punches in when the page changes.
- **Motion graphics:** a title card, a progress bar and a numbered title for each scene, a spotlight that dims everything except the element being discussed, pop-up stickers for the key numbers, captions with the numbers in yellow (so it works on mute), and an end card with the site address and "Student project · Not financial advice". During the "too much" scene the background turns red.
- **Sound** (`soundtrack.py`, all synthesized with numpy, so there are no third-party audio files or licences): an upbeat 120 BPM house-pop loop (F–C–Dm–B♭) with a breakdown during the "too much" scene. The music drops 7 dB while the voice speaks, sitting about 12–15 dB below it. The final mix is −14 LUFS, the usual level for social video.

What appears and when is in `scripts/portfolio/edit-plan.json`: scene times and titles, highlight boxes (in pixels of the 412 × 860 recording), and the sticker text. Sound effects for things that happen in the app are in `scripts/portfolio/sound-cues.json`. Both use times in the source recording and were read from it, so re-check them after recording again. To preview single frames without rendering the whole video, run `PREVIEW=3,12.5 python scripts/portfolio/promo.py en <voice video> /tmp/frame` (times in seconds of the output).

| Sound effect | When |
|---|---|
| Tap | A choice or input is tapped |
| Swish / whoosh | Scrolling / a new page or form step (with a camera punch) |
| Pop | "Why is this here" or the schedule opens |
| Bubble pop | A sticker appears |
| Glassy ping | A highlight appears |
| Riser + impact | The title card and the phone landing; the end card |
| Fast-forward swish | A 3× section starts |
| Three rising bells | The verdict says the payment is within the guideline |
| Two falling notes | The verdict says "we don't recommend" |
| Two low knocks | The lender check doesn't find the name |
| Rising arpeggio | The end card |

Always give `promo.py` the voice-only video. Given a video that already has music, the music gets added twice. `soundtrack.py` on its own adds the same music and effects to the plain recording without editing it.

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
