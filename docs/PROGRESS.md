# Progress

## Phase 0: Setup (2026-11-01)
**Status:** done, waiting for your review.

- Next.js 16.4 (App Router) + TypeScript strict + Tailwind 4 + ESLint, scaffolded and moved into this repo.
- i18n with next-intl: Vietnamese at `/`, English at `/en`, a language switch on the home page, and messages in `messages/vi.json` and `messages/en.json`.
- Zod installed (the schema arrives in Phase 1).
- Vitest: `src/lib/format.ts` (Vietnamese VND formatting) with 3 tests.
- Playwright: a smoke test at phone size (390×844) covering the default language and the language switch.
- npm scripts: `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `validate-data` (a stub until Phase 1).

## Phase 1: Research (2026-11-01)
**Status:** done, waiting for your review.

- `src/lib/data/schema.ts`: Zod schema v1. Every figure is sourced (value | null + sourceUrl, retrievedAt, confidence).
- `npm run validate-data` checks the schema, licensing, min ≤ max and data age (warning at 60 days, error at 90), with 19 unit tests.
- `data/licensed-institutions.json`: 47 banks and 16 finance companies from sbv.gov.vn, as of 30/09/2026. I spot-checked all 16 finance companies against the SBV page.
- `data/lenders/`: 10 lenders and 35 products, all licensed. 0 errors, 5 warnings (rates with unknown basis).
- `docs/research/regulations.md`: no SBV DTI rule exists. A finance company may lend at most 100M per customer (Circular 43). Cross-border data transfer is the main legal risk.
- `docs/research/scam-patterns.md`: 14 warning signs. The official portals were unreachable, so it relies on secondary sources.
- The compliance review found 10 must-fix issues, mainly that schema v1 can't separate a rate floor or ceiling from an offered rate, or a minimum fee from a fixed fee. It also found that the scam keywords flag licensed lenders. Waiting on your decision about a schema v2 before Phase 2.

## Phase 1b: Schema v2 and data clean-up (2026-11-02)
**Status:** done, waiting for your review.

- Schema v2: rate kinds (offered / "từ" floor / ceiling / benchmark), stated vs inferred, fee min/max/tiers/rules, insurance premium methods, conflicts, completeness flags, status, lender of record. All objects are strict, so no commercial fields are possible.
- The validator also checks:
  - the legal name against the SBV list, and the lender of record;
  - the 100M finance-company cap (it must be recorded as a conflict);
  - rate plausibility and fee shape;
  - worked examples, both their arithmetic and whether they fall inside the offered range;
  - future dates, using Vietnam's calendar day;
  - old source documents, which are capped at "low" confidence.
- There are 44 unit tests.
- `docs/research/data-entry-rules.md`: the rules for anyone entering data.
- All 10 lender files were migrated and reviewed. Validation gives 0 errors and 5 expected warnings.
- **6 products can be costed and ranked:** VPBank online cash loan, Shinhan cash loan, Home Credit cash loan, and FE Credit's cash, motorbike and phone loans. The other 29 are shown as "chưa đủ dữ liệu", with a reason.
- regulations.md: unverified claims are softened, and sections are added on the Law on Data, the Consumer Protection Law and MoIT website rules.
- The compliance re-check marks most items fixed. Your decisions on N1, N2 and N11 and the DTI label are recorded as DECISIONS #14 and #19–21.

## Phase 2: Cost engine (2026-11-02)
**Status:** done, waiting for your review.

- `src/lib/finance/` is pure TypeScript:
  - `schedule.ts`: annuity, equal-principal and flat schedules.
  - `irr.ts`: Newton's method with a bisection fallback.
  - `cost.ts`: money received, total paid, total cost, and the real APR (nominal and effective) including fees and insurance.
  - `charges.ts`: fees with minimums/maximums, the "greater of" rule, and the three insurance premium methods.
  - `affordability.ts`: debt-to-income check and a suggested smaller loan.
  - `late.ts`: late-payment warning, kept separate from the APR.
- Money is integer VND. Amounts derived from a rate use exact integer arithmetic, so half-đồng values round as documented.
- 115 unit tests. They include the lenders' own published examples, which the engine reproduces: FE 11,692,000 total, Home Credit 20,975,000 total, Shinhan 8,812,500/month, and TPFico premiums of 700,000 and 572,917.
- The finance-math-checker independently re-derived 15 cases in Python with exact decimals (`scripts/check/finance_check.py`): 0 failures. An IRR fuzz test over 4,094 random loans had 0 mismatches. Its 6 code findings are fixed, including an inverted IRR fallback and float rounding.

## Phase 3: Questionnaire and recommendation (2026-11-02)
**Status:** done, waiting for your review.

- `/vay`: a 3-step, mobile-first flow in Vietnamese and English. All calculation runs in the browser, and an e2e test proves typed values never go over the network.
- `src/lib/recommend/`: slim offers for the browser, eligibility filtering, ranking by estimated real APR at the high end of the range, and verdicts (ok, depends, too much, no income, no data).
- Results page: verdict first, short disclaimer, alternatives, need guidance, changeable term, offer cards (sources, dates, fees, insurance, late-payment warning), why-this-order, full disclaimer, plus "doesn't fit" and "not enough data" lists with translated reasons.
- Reviews: compliance-reviewer (14 must-fix) and qa-tester (9 bugs). See docs/research/compliance-review-phase3.md. The compliance items are fixed except the open list there. QA bugs 1–4, 7 and 8 are fixed; 6 got a loading cue; 9 is fixed. Some QA suggestions are open (below).
- Tests: 156 unit, 28 browser. Screenshots in `docs/qa/screenshots/phase3-*`.

**Known limitations:**
- Slow 3G: the form takes about 7.6 s to become usable (810 KB). To look at in Phase 6.
- Products with no numeric maximum age accept any age up to 100 (e.g. Shinhan says "to retirement age").
- Conditions aren't filtered to the user's case (e.g. "over 100M" notes appear for smaller loans).
- FE Credit's cash and phone loans can show identical numbers.
- The 2-minute target hasn't been timed with real people (Phase 5 interviews).

## Phase 4: Lender safety check (2026-11-02)
**Status:** done, waiting for your review.

- `/kiem-tra`: type a lender, app or website, and optionally tick warning signs. It runs in the browser only (an e2e test checks this).
- Results: matches the SBV list (with legal name, licence number and source), resembles a name on the list, not found, or phone number (not checked). Ticking a high-risk sign says "stop" even with a real lender's name, because impersonators use real names.
- `src/lib/safety/`: matching (accents, spacing, legal words, typos, web addresses) and signs with sources.
- Everyday bank names and websites verified and added to `data/licensed-institutions.json`.
- Reviews: compliance-reviewer (9 must-fix) and qa-tester (7 bugs), fixed; see docs/research/compliance-review-phase4.md.

**Known limitations:**
- Reporting advice is only "nearest police station"; official portals couldn't be confirmed.
- The scam signs rest on press reports of police warnings, not official pages.
- A similar name is only a hint: a lawful business can have a similar name, and a scammer can use an exact one.
- Dates on the English page use day/month/year.

## Phase 5: Validation kit (2026-11-03)
**Status:** done, waiting for your review.

- `docs/validation/interview-guide.md` and `note-template.md`: for 15–20 recent borrowers, in Vietnamese, with a consent script and steps for someone in distress.
- Landing page at `/`, privacy notice at `/rieng-tu`, and a footer on every page.
- Waitlist: form, consent, API and tests are ready, but it's **off** (`docs/validation/waitlist-setup.md`). No emails are collected.
- Analytics: Vercel Web Analytics runs only when deployed on Vercel. Questionnaire steps are counted by fixed names only.
- Reviews: compliance-reviewer and qa-tester, fixed. See docs/research/compliance-review-phase5.md.

**Known limitations:**
- The operator name is confirmed (DECISIONS #43; corrected in #53).
- With the waitlist off, there are no signup numbers.
- Analytics can only be checked for real after deployment.
- Page weight is about 385 KB, and the form takes about 7–8 s to become usable on slow 3G.
- The consent text is long on a phone (about 9 lines), and that's for the lawyer to shorten.

**Next:** Phase 6 (quality and launch).

## Phase 6: Ship-check (2026-11-02)
**Status:** checks done and problems fixed. Not deployed: waiting for your decision.

- Automated accessibility scan added (WCAG 2 A/AA, light and dark): no violations. Not tested with a real screen reader.
- Mobile speed: Lighthouse can't start a browser on this machine, so it was measured with Playwright using Lighthouse's phone settings, on a local server. First paint about 1 s, layout shift about 0, blocking time 280–390 ms (a little over the usual 200 ms goal), about 380 KB.
- Reviews: finance-math-checker (no blocker; premium low end fixed), compliance-reviewer (2 wording/logic blockers fixed; see docs/research/compliance-review-phase6.md), qa-tester (no blockers; Back button, under-20 verdict and smaller items fixed).
- Data age: nothing over 90 days. Oldest figure 2026-11-01. Warnings start 31/12/2026; products stop being ranked after 30/01/2027 unless refreshed.

- Launch path chosen: soft launch by direct link, analytics off, search listing off (DECISIONS #49, #50).

**Next:** the launch check below.

## Launch check (2026-11-02)
**Status:** live at https://vay-dung.vercel.app. Not shared with anyone yet. You decided to keep it live (2026-11-02).

The deployment went straight to production, so there was no preview step (DECISIONS #51). The planned checks ran on the live site instead:

- **Privacy:** on a simulated phone, distinctive amounts, income, debt and a made-up lender name didn't appear in any of the requests sent. All requests went to the site itself, and all of those requests were page loads (GET). No cookies, no analytics requests, no console errors.
- **Soft-launch settings:** noindex on all 6 pages checked; no email fields; the waitlist endpoint answers "closed" (503). The site has no robots.txt or sitemap.
- **Features:** the questionnaire gives a verdict with source links. The lender check recognises FE Credit, reports a made-up name as not found, and shows the scam warning when a warning sign is ticked.
- **Location:** server code runs in Singapore (sin1). Prebuilt pages were served from Hong Kong (hkg1) in this test. Both fit the notice's "outside Vietnam".
- **Lighthouse (phone settings):** performance 93 / 94 / 90 for /, /vay, /kiem-tra. Accessibility and best practices 100. SEO 60, and the failing item is the intended noindex tag. Blocking time 260–410 ms, over the usual 200 ms goal. No layout shift.

**Not tested:** a real phone, iOS Safari, a screen reader, real people.

**First real visitor:** not yet. Record the date here when it happens, because the 60-day limit may start then.

**Next:** the interviews.

## More banks: ACB, Sacombank, VIB, HDBank (2026-11-02)
**Status:** live since 2026-11-02, published with your approval. Checked on the live site: all four banks appear, nothing typed appears in requests, no cookies, noindex on the page checked, waitlist closed.

- Now 14 lender files and 45 products. Earlier counts in this file were correct at the time.
- None of the four banks can be ranked, because none publishes a usable rate range for a salary loan. They appear in the "not enough data" section, so the ranked list doesn't change.
- Compliance review: 4 must-fix items fixed. The section no longer shows bank-wide averages or uncosted rates, ACB's rate is shown per day, and reasons are specific when documents conflict or are undated. Details in DECISIONS #54.
- Daily rates can't reach the cost engine. Finance code in src/lib/finance is unchanged.
- Still unresolved: Sacombank's two documents disagree on the card-loan rate, and HDBank's card-loan sheet is undated. Only the banks can settle these.

**Next:** the interviews. Ask interviewees which lenders they'd consider and for real offers they've received.

## Lender data deep dive (2026-11-03)
**Status:** live since 2026-11-04, published with your approval after a final compliance check. See docs/research/data-coverage.md.

- 13 lenders researched from rate sheets, contracts, app listings and calculators. HD Saison stopped at your request.
- 48 products shown, 7 ranked (was 38 and 6). Most lenders state a "from" rate or a wide company range and set the real rate at approval.
- Math check: engine correct on all ranked products. Fixed a "-0%" display and flat-loan rounding of a few đồng.
- Compliance review: all 8 must-fix items addressed. Some should-fix items remain: early repayment fees for lenders without a note sit in the collapsed details, "from" notes drop their qualifiers, percent fees don't say what they apply to, and low-confidence products can still rank first.
- New lawyer questions are in the compliance report, including the 100 million cap against FE Credit's 400M and Shinhan's 500M.

Checked on the live site: nothing typed appears in requests, no cookies, the 0% and "don't borrow" cases behave correctly, and amounts above 100 million show only the cap reason.

**Next:** your decision on what to do about the 41 unranked products.

## Six more lenders and group ranges (2026-11-04)
**Status:** committed, not live. Waiting for your decision on publishing.

- Added AEON, JACCS, Mirae Asset, SFinance, TNEX and VietCredit, using the lenders' own documents. Topi was used only for leads.
- 20 lender files, 82 products shown, 14 ranked (was 14 files, 48 and 7).
- New rule (DECISIONS #61): a range naming a product or customer group can be ranked. Where its minimum disagrees with the lender's adverts, costs use the maximum and the card says so.
- Mirae Asset's 11 products stay unranked until you confirm its public PDF by hand (DECISIONS #62).
- Math check, compliance review and QA are done, with their must-fix items applied. 220 unit tests and 119 browser tests pass, and three independent math checks report no failures.
- Open: long cards, some goods loans listed under every purpose, the 1-đồng gap between the verdict and a card, and new lawyer questions, including naming a lender at a top-of-range rate.

**Next:** your decision on publishing.

## Excel data store, ranking and disclosure (2026-11-05)
**Status:** live at https://vay-dung.vercel.app since 2026-11-05, and checked on the live site. The project report is updated.

- The app is now a student project, with a banner on every page. Rates may come from comparison sites, partners or the press when no official figure exists, named on each card (DECISIONS #63).
- Data store: `data/store/loan-data.xlsx`, checked by `npm run data:import`. Optional live rate feed through `LOAN_RATES_CSV_URL`. How to use it: `docs/DATA_STORE.md`.
- 82 products shown, 67 ranked (was 14). 60 of the 67 use a figure from the lender's own pages, and 7 use another source. 15 aren't ranked: 12 overdrafts and pay-later, 1 duplicate, 2 with no rate anywhere.
- Ranking now puts fit first, then cost (DECISIONS #65). Published at `/cach-xep-hang`, including what each answer does. All the data is at `/du-lieu`, with a CSV download.
- Results gain a summary table, a sort, a source filter and a first-place warning. Each card gains "why this position" and a month-by-month schedule.
- Three weak figures stay, with notes on the card: TPBank's 2023 article, Sacombank's 9.6% and VPBank's teacher 17%. The compliance reviewer advised dropping them; you can do that in Excel.
- Open: one-off mandatory fees aren't in the cost yet (the page says so), self-employed borrowers aren't treated as lacking income papers, English pages keep some Vietnamese from the sources, and the feed's 5-minute refresh hasn't been observed. Compliance didn't reread the final text.

**Next:** your review. Figures start going stale in late January 2027.

## Live rate feed switched on (2026-11-07)
**Status:** live at https://vay-dung.vercel.app since 2026-11-07.

- Feed: the Google Sheet "Vay Đúng - nguồn lãi suất trực tiếp" in your Drive, published as CSV and set as `LOAN_RATES_CSV_URL` on Vercel (DECISIONS #68).
- It holds 25 products with the same figures as Excel. All 25 rows were accepted, and no result changed when the feed went on.
- Checked on the live site after the deploy: ranking, sorting and filters work, no typed values leave the browser, and there are no page errors.
- Refresh observed on the live site: a test edit (AEON lump-sum minimum 1.51 → 2.01) reached the published CSV in under 30 seconds and `/vay` about 2.5 minutes later, with no redeploy. The test value was set back to 1.51, and the live page showed 1.51 again at 02:22 UTC.
- Open: `/du-lieu` and `/cach-xep-hang` still show the Excel data.

## Portfolio kit and archive mode (2026-11-07)
**Status:** live at https://vay-dung.vercel.app since 2026-11-07.

- Archive mode (DECISIONS #69): after 90 days, loans stay ranked under an "old data" notice instead of disappearing, so the demo keeps working. Old figures can't give a green verdict. Compliance reviewed it, and both must-fix items are applied.
- `docs/portfolio/`: a 66-second phone-size walkthrough video of the live site and 13 screenshots.
- README rewritten for employers and reviewers: problem, method, a worked IRR example, data, quality and limitations.
- Tests: 254 unit and 140 browser tests pass, including the new archive-mode tests run with the clock set a year ahead.
- Open: no GitHub repository yet. You create it, then the code can be pushed.
