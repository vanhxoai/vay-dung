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
- The compliance re-check marks most items fixed. 3 decisions are open (N1, N2, N11 in compliance-review-phase1.md).

**Next:** your decisions on N1, N2 and N11, then Phase 2 (cost engine).
