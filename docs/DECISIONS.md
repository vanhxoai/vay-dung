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
| 14 | 2026-11-01 | DTI threshold: no SBV rule exists. 40% stays, labeled "hướng dẫn của Vay Đúng" (Vay Đúng guideline), never as a legal rule | regulations.md §5 | Agreed (Phase 1 checkpoint) |
| 15 | 2026-11-02 | Schema v2 before Phase 2 (compliance review M1–M8) | Schema v1 couldn't separate floors and ceilings from offered rates, or minimum fees from fixed fees | Agreed |
| 16 | 2026-11-02 | When official sources conflict, store the conservative value (higher cost, stricter condition, lower max amount) and record the conflict | Borrower first; never show the cheaper of two official figures | Default (data-entry-rules.md §6) |
| 17 | 2026-11-02 | `promotional` stays null unless the source says the rate is a promotion | "Never assume". Agents had set it from the 0% figure alone | Default |
| 18 | 2026-11-02 | Products without an offered rate range are excluded from ranking and shown as "chưa đủ dữ liệu để so sánh" with a reason | Ranking on floors or ceilings would mislead | Default |
