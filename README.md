# Vay Đúng

A loan decision helper for Vietnamese borrowers: it shows the real total cost, lists only licensed lenders, and says "don't borrow" when that's the honest answer.

- Project brief: [CLAUDE.md](CLAUDE.md)
- Build phases: [KICKOFF_PROMPT.md](KICKOFF_PROMPT.md)
- Progress and decisions: [docs/PROGRESS.md](docs/PROGRESS.md), [docs/DECISIONS.md](docs/DECISIONS.md)

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Starts the app at http://localhost:3000 (or the next free port) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests at phone size (Playwright, port 3100) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run validate-data` | Checks lender data against the schema and licensed list |
