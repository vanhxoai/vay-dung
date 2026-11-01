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

**Next:** your decisions at the Phase 1 checkpoint, then Phase 2 (cost engine).
