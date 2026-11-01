---
name: add-lender
description: Research one Vietnamese lender and add or update its loan products in data/lenders with sources. Use when the user asks to add, check or update a specific lender.
argument-hint: [lender name]
---

Add or update the lender "$ARGUMENTS".

1. Check `data/licensed-institutions.json`. If "$ARGUMENTS" isn't there, stop and tell me: we only list licensed lenders.
2. Use the `market-researcher` agent to collect its current consumer loan products from official sources, following its rules (source URL, retrieval date, confidence, quote basis, unknown stays null).
3. Run `npm run validate-data` and fix any schema errors.
4. If the lender has rate examples, add one as a test case for the cost engine and run `npm test`.
5. Show me a summary: products added or changed (old → new values), gaps, and low-confidence fields.
6. Commit with the message `data: add/update <lender>`.
