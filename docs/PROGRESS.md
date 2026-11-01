# Progress

## Phase 0: Setup (2026-11-01)
**Status:** done, waiting for your review.

- Next.js 16.4 (App Router) + TypeScript strict + Tailwind 4 + ESLint, scaffolded and moved into this repo.
- i18n with next-intl: Vietnamese at `/`, English at `/en`, a language switch on the home page, and messages in `messages/vi.json` and `messages/en.json`.
- Zod installed (the schema arrives in Phase 1).
- Vitest: `src/lib/format.ts` (Vietnamese VND formatting) with 3 tests.
- Playwright: a smoke test at phone size (390×844) covering the default language and the language switch.
- npm scripts: `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `validate-data` (a stub until Phase 1).

**Next:** Phase 1, research (licensed list, 10 lenders, regulations, scam patterns). Reopen Claude Code in this folder first so the helper agents and MCP connectors load.
