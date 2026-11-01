Read CLAUDE.md carefully. It's the brief for this project. We're building "Vay Đúng", a web app that helps Vietnamese borrowers choose the right loan (or decide not to borrow) by showing the real total cost, only listing licensed lenders, and matching offers to the person's need.

Start in plan mode. Give me a phase-by-phase plan, with any questions you need answered before starting. Wait for my approval before writing code.

Use what's available: the helper agents in .claude/agents (run the market-researcher agents in parallel, one per lender), the Playwright and Context7 connectors in .mcp.json, and the skills in .claude/skills. Keep a task list so I can see your progress.

## Phases (stop for my review at each ✅ checkpoint)

**Phase 0 — Setup**
Scaffold the Next.js + TypeScript + Tailwind project with Vitest, Playwright, ESLint, vi/en i18n, and the npm scripts listed in CLAUDE.md. Create docs/PROGRESS.md and docs/DECISIONS.md. Commit.
✅ Checkpoint: show me that `npm run dev` and `npm test` work.

**Phase 1 — Research (market-researcher agents, in parallel)**
1. Build data/licensed-institutions.json from the State Bank of Vietnam's official published lists of licensed banks and finance companies, with source URLs.
2. Collect consumer loan products from at least 8 licensed lenders, mixing finance companies (e.g. FE Credit, Home Credit, Mcredit, HD Saison, Shinhan Finance, Lotte Finance) and banks with digital consumer loans. One agent per lender. Every figure needs a source URL, retrieval date and confidence level. Unknown stays unknown.
3. Write docs/research/regulations.md: rules on rate disclosure, loan intermediaries/brokers, advertising credit products, personal data protection, and any debt-to-income guidance. Cite official sources and mark what is uncertain.
4. Write docs/research/scam-patterns.md: common black-credit and advance-fee scam signs, from official warnings.
✅ Checkpoint: a summary table of what was found, the gaps, and anything that surprised you.

**Phase 2 — Cost engine**
Build src/lib/finance/ as described in CLAUDE.md: flat ↔ reducing balance conversion, APR by IRR including fees and insurance, amortization schedule, total cost, affordability check. Write thorough unit tests with hand-checked examples. Then have the finance-math-checker agent independently re-derive at least 5 cases (in Python as a cross-check is fine) and fix any disagreement.
✅ Checkpoint: a short table of 5 example loans showing the advertised rate vs the real APR and the total cost.

**Phase 3 — Need-first questionnaire and recommendation**
A mobile-first flow, under 2 minutes, in plain Vietnamese:
1. What's the money for, how much, how urgent?
2. Monthly income, existing monthly debt payments, age, type of job/income proof (all processed in the browser only).
3. Results: first, the type of credit that fits the need (e.g. "an installment plan at the store is cheaper than a cash loan for buying a phone"); then matching licensed offers ranked by real cost, each showing monthly payment, total repaid, real APR, fees, data source and date; a clear affordability verdict, including "we don't recommend borrowing this amount" when it applies, with alternatives.
4. A "Why this ranking?" explanation and the disclaimer.
✅ Checkpoint: screenshots of the full flow on a phone-size screen (use Playwright).

**Phase 4 — Lender safety check**
A page where someone types a lender or app name and gets: licensed / not on the official list / matches known scam patterns, plus what to do. Link the sources.
✅ Checkpoint: test it with 3 licensed lenders and 3 made-up names.

**Phase 5 — Validation kit**
1. docs/validation/interview-guide.md: an interview guide in Vietnamese for 15–20 people who borrowed in the last 6 months (how they chose, what confused them, regrets, who they trusted), plus a note-taking template.
2. A simple landing page with a waitlist signup (email only, with consent text that follows the regulations research). Store signups through a provider I approve. Ask me before choosing one.
3. Privacy-friendly analytics (no personal data) for questionnaire completion and drop-off. Ask me before adding a provider.
✅ Checkpoint.

**Phase 6 — Quality and launch**
Run /ship-check (all tests, compliance-reviewer, qa-tester, finance-math-checker, accessibility and mobile performance). Fix the problems found. Then walk me step by step through deploying to Vercel.
✅ Final checkpoint: the live URL, a list of known limitations, and suggested next steps based on what we learned.

## Rules for the whole project
- Follow the product principles in CLAUDE.md, especially: borrower first, no made-up numbers, privacy by default.
- Commit at the end of every step, with clear messages.
- Ask me before anything that costs money, creates accounts, or would be hard to undo.
- Explain decisions simply; I'm new to web development.
