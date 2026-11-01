---
name: refresh-data
description: Re-check all lender data and the licensed-institutions list against their sources, update anything stale or changed, and report the differences.
disable-model-invocation: true
---

Refresh all lender data.

1. Re-check `data/licensed-institutions.json` against the State Bank of Vietnam's latest published lists. Report any lenders added or removed. If a listed lender is no longer licensed, remove its products from the app and tell me right away.
2. Run one `market-researcher` agent per file in `data/lenders/`, in parallel, to re-check every product against its `sourceUrl`. Prioritize files with a `retrievedAt` older than 60 days.
3. Run `npm run validate-data` and `npm test`.
4. Report: what changed (old → new), sources that no longer work, and fields that went from known to unknown.
5. Update `docs/PROGRESS.md` with the refresh date and commit with `data: refresh <date>`.
