# Decisions

Each entry records what we chose and why. "Agreed" means you approved it; "Default" means I chose it as a low-risk technical default. Defaults can be changed on request.

| # | Date | Decision | Why | Status |
|---|---|---|---|---|
| 1 | 2026-11-01 | The project lives at `C:\Users\admin\projects\vay-dung`, outside OneDrive | OneDrive sync fights with `node_modules` (thousands of files, file locks), and the accent in "Máy tính" can break tools | Agreed |
| 2 | 2026-11-01 | Lenders: FE Credit, Home Credit, Mcredit, HD Saison, Shinhan Finance, Lotte Finance, TPBank, VPBank, Techcombank, MB Bank | Six finance companies plus four banks with digital consumer loans | Agreed |
| 3 | 2026-11-01 | The headline "real APR" is the nominal yearly rate (monthly IRR × 12). The effective rate (1+r)^12 − 1 is shown in the details. Both include fees and insurance | Lenders quote nominal yearly rates, so the headline is directly comparable to their ads | Agreed |
| 4 | 2026-11-01 | Vietnamese at `/`, English at `/en` (next-intl, `localePrefix: "as-needed"`) | Shorter, cleaner links for the main audience | Agreed |
| 4b | 2026-11-01 | No browser-language auto-detect (`localeDetection: false`): `/` is always Vietnamese | Predictable, and shared links look the same for everyone | Agreed |
| 5 | 2026-11-01 | Debt-to-income threshold of 40%, labeled as a guideline | The brief's conservative default. To revisit after the SBV research in Phase 1 | Agreed (to revisit) |
| 6 | 2026-11-01 | Git author "Vay Dung Dev" with your email, set for this repo only | Commits need an identity | Agreed |
| 7 | 2026-11-01 | Next.js 16.4 (latest stable) with the scaffold defaults: `cacheComponents` and `partialPrefetching` on, and Turbopack | Current recommended setup. Next 16 renames "middleware" to `src/proxy.ts` | Default |
| 8 | 2026-11-01 | Locale via `next/root-params`: the root layout is `src/app/[locale]/layout.tsx`, with no `src/app/layout.tsx` | The approach next-intl recommends for Next ≥16.3, and it keeps pages static | Default |
| 9 | 2026-11-01 | Font: Inter with the `vietnamese` subset, replacing the scaffold's Geist | Geist doesn't cover Vietnamese diacritics well. Inter has an official Vietnamese subset | Default |
| 10 | 2026-11-01 | `@types/node` ^24, not the scaffold's ^20 | Vitest 5 requires ≥22. Your machine runs Node 26 | Default |
| 11 | 2026-11-01 | E2E tests run their own dev server on port 3100, at a 390×844 "Pixel 7" viewport | Port 3000 was already used by another app on this machine, and the tests silently hit it | Default |
| 12 | 2026-11-01 | `git config core.autocrlf true` for this repo | Avoids Windows line-ending noise in diffs | Default |
| 13 | 2026-11-01 | Vitest picks up `src/**/*.test.ts` and `scripts/**/*.test.ts`. Playwright tests live in `tests/e2e/` | Unit tests sit next to the code they test | Default |
| 14 | 2026-11-01 | DTI threshold: no SBV rule exists. 40% stays, labeled "hướng dẫn của Vay Đúng" (Vay Đúng guideline), never as a legal rule | regulations.md §5 | Agreed (2026-11-02) |
| 15 | 2026-11-02 | Schema v2 before Phase 2 (compliance review M1–M8) | Schema v1 couldn't separate floors and ceilings from offered rates, or minimum fees from fixed fees | Agreed |
| 16 | 2026-11-02 | When official sources conflict, store the conservative value (higher cost, stricter condition, lower max amount) and record the conflict | Borrower first; never show the cheaper of two official figures | Default (data-entry-rules.md §6) |
| 17 | 2026-11-02 | `promotional` stays null unless the source says the rate is a promotion | "Never assume". Agents had set it from the 0% figure alone | Default |
| 18 | 2026-11-02 | Products without an offered rate range are excluded from ranking and shown as "chưa đủ dữ liệu để so sánh" with a reason | Ranking on floors or ceilings would mislead | Default |
| 19 | 2026-11-02 | FE Credit-style "flat in the ad, reducing in the contract" is one cost described two ways, not a conflict. The engine treats advertised flat rates as flat and computes the real cost from them | Your domain knowledge, consistent with Circular 39 art. 13(3), which requires contracts to state the annual reducing-balance rate | Agreed |
| 20 | 2026-11-02 | Source tiers: a product page, fee schedule or contract always outranks a lender's blog. VPBank keeps 14.4%/yr | Blogs call themselves general information (compliance N1) | Agreed |
| 21 | 2026-11-02 | Low-confidence products are ranked, with a visible "Độ tin cậy thấp — kiểm tra lại với bên cho vay" badge and the reason | More useful comparison, with honesty kept by the label (compliance N11) | Agreed |
| 22 | 2026-11-02 | Loans are modelled in monthly periods: yearly reducing rate ÷ 12; interest rounded per month (half away from zero, exact integers); the last instalment absorbs the remainder | Standard comparison basis. Lenders accrue daily, which differs by a few đồng per month | Default |
| 23 | 2026-11-02 | Maximum term in the engine is 120 months | Consumer loans in scope are ≤ 60–72 months. Longer terms drift into a balloon payment because the level instalment is rounded (finance-math-checker) | Default |
| 24 | 2026-11-02 | "Amount received" = money in hand (principal − deducted charges). Charges paid separately are shown as "paid upfront". Total cost = everything paid − amount received | Shows honestly what lands in your account vs what you pay | Default |
| 25 | 2026-11-02 | The suggested smaller loan is computed in 100,000đ steps and is an estimate; the app re-checks it with the product's real fees before showing it | Round, easy-to-read amounts that are never above the guideline | Default |
| 26 | 2026-11-02 | No "caution" level below 40% yet. The verdict is only within / over the guideline / no income | The brief specifies only the 40% threshold. A middle "caution" band is your call | Pending: your call |
| 27 | 2026-11-02 | Rank by estimated real APR at the HIGH end of the published range; the card shows the full range | Conservative: floors may not be the rate a borrower gets | Agreed |
| 28 | 2026-11-02 | The questionnaire asks for the repayment term (6, 12, 18, 24 or 36 months, default 12), changeable on the results page | Cost depends on the term | Agreed |
| 29 | 2026-11-02 | Offer cards link only to the source page, with no apply link | Avoids looking like steering or brokering while the legal question is open | Agreed |
| 30 | 2026-11-02 | A product whose fees are entirely unknown can't be first (compliance S6). Today this puts Home Credit above Shinhan | Its real cost could be higher than we can calculate | Default, for you to confirm |
| 31 | 2026-11-02 | "ok" verdict needs a product with some known fees, open to anyone: not limited to existing customers or an employer list. Otherwise "depends" | A green verdict shouldn't rest on an offer we can't cost or the person can't get | Default (compliance M1) |
| 32 | 2026-11-02 | Headline cost includes only mandatory fees with a known amount and mandatory insurance. Optional or unclear insurance is shown separately with its cost | Unknown stays unknown; matches compliance M4/M5 | Default |
| 33 | 2026-11-02 | Answers are kept in sessionStorage only during a language switch: read once, deleted, ignored after 2 minutes | Switching language reloads the page; the copy stays in the browser and the privacy text says so | Default (compliance M13) |
| 34 | 2026-11-02 | Age accepted from 18 to 100. Income under 100,000đ or debt under 10,000đ (other than 0) is questioned as a likely typo | "3tr" or "15" would otherwise give a wrong verdict | Default |
| 35 | 2026-11-02 | E2E tests run against a production build through scripts/e2e.mjs, not Playwright's webServer option | On Windows that option can't stop the server, so runs hung and the port stayed busy | Default |
