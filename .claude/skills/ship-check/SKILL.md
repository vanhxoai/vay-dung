---
name: ship-check
description: Full pre-release checklist for Vay Đúng — tests, math cross-check, compliance review, browser QA, accessibility and performance. Run before any deploy.
disable-model-invocation: true
---

Run the full pre-release check. Run independent steps in parallel where possible.

1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate-data`, `npm run build`. All must pass.
2. In parallel:
   - `finance-math-checker` agent: independently verify the cost engine.
   - `compliance-reviewer` agent: review all copy, data and data handling.
   - `qa-tester` agent: test the full flow in a phone-size browser and run `npm run test:e2e`.
3. Check accessibility (labels, contrast, keyboard navigation) and mobile performance (Lighthouse or similar) on the main pages.
4. Check that no lender data is older than 90 days; list any that is.
5. Give me one report with:
   - **Blockers** (must fix before release)
   - **Should fix soon**
   - **Fine to ship**
   and a clear verdict: ready to deploy, or not yet and why.

Don't deploy. Only report. I'll decide.
