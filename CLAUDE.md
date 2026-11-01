# Project: Vay Đúng — a loan decision helper for Vietnamese borrowers

## The problem we solve
Vietnamese borrowers see a flood of loan apps, ads and product names, but they can't decide well because:
1. **They can't compare the offers.** Lenders quote rates differently (flat rate "lãi phẳng" vs reducing balance "dư nợ giảm dần", monthly vs yearly), add fees and bundled insurance, and run promotions. The advertised rate does not show the real cost.
2. **They don't know what they would qualify for**, so they apply blindly and get rejected.
3. **They can't tell safe lenders from scams.** Illegal "tín dụng đen" (black credit) apps and advance-fee scams are common.
4. **Nobody tells them when they shouldn't borrow**, or that another type of credit fits their need better.

We are NOT building another table of advertised rates. We are building a tool that **understands the borrower's need, shows the real total cost in plain Vietnamese, only lists licensed lenders, and is willing to say "this is too much for you."**

## Target user for the MVP
Young salaried workers (22–35) in Hanoi and Ho Chi Minh City considering their first or second consumer cash loan or installment plan, mostly on mobile phones. Keep the scope to this group until the MVP is validated.

## Product principles (do not break these)
- **The borrower's interest comes first.** Rank by real cost and fit, never by who pays us. The MVP has no paid placements and no lead selling.
- **Honest numbers only.** Every lender figure in the app must have a source URL and a retrieval date. If a number is unknown, show "chưa rõ" (unknown) — never guess or fill in a placeholder.
- **Plain Vietnamese first.** Vietnamese is the main language (English second). Write for someone with no finance background: "Bạn vay 20 triệu, trả tổng cộng 27,4 triệu trong 24 tháng."
- **Say "don't borrow" when it's true.** If the payment would put the user over the affordability threshold, say so clearly and suggest alternatives.
- **Privacy by default.** In the MVP, all calculations run in the browser. Do not send or store users' income, debts or identity on a server. No login.
- **Not financial advice.** Show a clear disclaimer. We give information and calculations, not a guarantee of approval.

## Domain knowledge: the cost engine (the heart of the product)
Put this in `src/lib/finance/`, keep it pure TypeScript with no UI code, and test it thoroughly.
- Convert every offer into the same comparable terms: **effective annual rate (APR via IRR)**, **monthly payment**, **total repaid**, **total cost (= total repaid − amount received in hand)**.
- **Flat rate vs reducing balance:** a flat rate charges interest on the original amount for the whole term, so its true rate is often close to double the quoted flat rate (about 1.8× for a 24-month loan). Convert flat to effective with an IRR calculation, not a rule of thumb.
- **Fees and insurance:** upfront fees and mandatory insurance that are deducted from the payout lower the amount actually received; fees added to the loan raise the payments. Both must go into the IRR cash flows.
- **Late payment:** show the published late-payment penalty as a separate warning; don't mix it into the APR.
- **Affordability:** total monthly debt payments ÷ monthly income. Keep the threshold in `src/config/affordability.ts` (a conservative default, e.g. 40%, labeled as a guideline). Research whether the State Bank of Vietnam (SBV) has a relevant debt-to-income rule and note the result with sources in `docs/research/regulations.md`.
- Use integer VND (no floating-point money). Round only for display.
- Every formula needs unit tests, including hand-checked examples written in the test file.

## Lender data
- Stored in `data/lenders/*.json` and validated with a Zod schema (`src/lib/data/schema.ts`).
- Each product: lender name, license type (bank / finance company), product type (cash loan, installment, credit card, BNPL…), amount range, term range, rate and its **quote basis** (flat / reducing, monthly / yearly), fees, insurance, eligibility (age, income, documents), late-payment penalty, `sourceUrl`, `retrievedAt`, `confidence` (high / medium / low).
- **Licensing:** a lender can only be listed if it appears on the SBV's published lists of licensed credit institutions / finance companies. Keep the list and its source in `data/licensed-institutions.json`.
- Never scrape behind logins and never bypass a website's protections. Prefer official product pages and published fee schedules.

## Tech stack
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS, mobile-first.
- Zod for data validation, Vitest for unit tests, Playwright for end-to-end tests.
- next-intl (or similar) for vi/en. Vietnamese is the default.
- Deploy target: Vercel. No database in the MVP (static JSON data); add one only if a phase requires it and I approve.
- Use the Context7 MCP to check current library docs before using an API you're not sure about.

## How to work
- Work in phases (see `KICKOFF_PROMPT.md`). At the end of each phase: run the tests, update `docs/PROGRESS.md`, commit, and **stop for my review**.
- Hand work to the helper agents in `.claude/agents/`:
  - `market-researcher` for all lender and regulation research (run several in parallel, one per lender).
  - `finance-math-checker` after any change to `src/lib/finance/`.
  - `compliance-reviewer` before every checkpoint that changes user-facing text or data.
  - `qa-tester` before every checkpoint that changes the UI.
- Small, focused commits with clear messages. Never commit secrets.
- If something is ambiguous and expensive to redo, ask me. Otherwise pick the sensible default and write the decision in `docs/DECISIONS.md`.
- Explain things to me simply. I'm a researcher, comfortable with Python and statistics, less experienced with web development.

## Commands
- `npm run dev` starts the app locally
- `npm test` runs the unit tests
- `npm run test:e2e` runs the Playwright tests
- `npm run lint` and `npm run typecheck`
- `npm run validate-data` checks every lender file against the schema and the licensed list
