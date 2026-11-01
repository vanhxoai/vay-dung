# How to use this kit with Claude Code

This folder is a ready-made starting point. Claude Code reads these files automatically, so your instructions, helper agents and tools are already set up when it opens the folder.

## What's inside

| File | What it does |
|---|---|
| `CLAUDE.md` | The project brief. Claude Code reads it at the start of every session: the goal, the users, the rules, the tech stack and the domain knowledge (how to calculate the real cost of a loan). |
| `KICKOFF_PROMPT.md` | The first message you paste into Claude Code. It runs the build phase by phase. |
| `.claude/agents/` | Four helper agents Claude Code hands work to: a **market researcher** (collects lender data with sources), a **finance math checker** (independently checks every cost calculation), a **compliance reviewer** (catches misleading claims, unlicensed lenders and privacy problems), and a **QA tester** (clicks through the app in a real browser). |
| `.claude/skills/` | Three commands you can type: `/add-lender <name>`, `/refresh-data`, `/ship-check`. |
| `.mcp.json` | Connectors: **Playwright** (a real browser for testing and for reading lender websites) and **Context7** (up-to-date library documentation, so code doesn't use outdated APIs). |

## Steps

1. Install Claude Code if you haven't: https://code.claude.com/docs/en/overview
2. Unzip this folder somewhere, e.g. `~/projects/vay-dung`, and open a terminal there.
3. Run `git init` (Claude Code works best in a git repo, so every step can be undone).
4. Run `claude`. When it asks whether to trust the project's MCP servers (`.mcp.json`), approve them.
5. Press **Shift+Tab** until you see **plan mode**, then paste the whole of `KICKOFF_PROMPT.md`.
6. Read the plan it shows you, answer its questions, and approve. It then works through the phases and stops for your review at each checkpoint.

## Optional extras

- **GitHub** (to back up the code and open pull requests): `claude mcp add --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer <your GitHub token>"`. Or just install the `gh` CLI and run `gh auth login`.
- **Deploying:** a free Vercel account. Claude Code will walk you through it in Phase 6.
- **A stronger model for planning:** type `/model` in Claude Code and pick Opus for planning and review steps.

## Useful commands while it works

- `/agents` lists the helper agents. `/mcp` shows the connectors and whether they're connected.
- `/add-lender Home Credit` researches one lender and adds its products with sources.
- `/ship-check` runs the full pre-release checklist.
- If it goes off track, press **Esc** and redirect it. Press Esc twice to rewind to an earlier point.

## Before you charge money or partner with lenders

The kit tells Claude Code to research and write down Vietnam's rules on loan intermediaries, advertising credit products, and personal data protection. That research is a starting point, not legal advice. Have a Vietnamese lawyer check it before you take payment from lenders or store users' personal data.
