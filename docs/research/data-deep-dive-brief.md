# Lender data deep dive: brief for researchers

Date: 2026-11-02. Use this date for `retrievedAt`.

## Why this exists
Of 38 products shown in the app, only 6 can be ranked. None has high confidence and 23 have low confidence. The first research pass mostly read product landing pages. This pass goes further for one purpose: find the real rate, how it is calculated, and the fees, for every product.

## Where to look, beyond the product page
Work through all of these before concluding that a figure isn't published:

1. **Rate and fee documents:** biểu lãi suất, biểu phí, "công bố lãi suất", "khung lãi suất", "thông báo lãi suất", and the lender's disclosure or investor pages. Search with `site:<lender domain> filetype:pdf`.
2. **Contract documents:** hợp đồng mẫu, điều khoản và điều kiện chung, "thỏa thuận cho vay", product T&C PDFs. These often state the rate basis, late penalties, early repayment and insurance.
3. **App store listings:** the lender's own Google Play and App Store pages. Loan apps often state minimum and maximum APR, term and a worked example there. Treat them as the lender's own statement and cite the listing URL.
4. **Public calculators on the lender's site:** use them with sample amounts and terms, without entering personal details. Record the input and output as a representative example. Rates embedded in a public page's data count only if the page itself uses them; mark confidence accordingly.
5. **Official FAQs, help centres and press releases,** including worked examples ("vay 20 triệu trả ... mỗi tháng"). A worked example can show the basis: recompute it and record whether it fits flat or reducing.
6. **Insurance pages and partner insurer documents** for premium rates and whether cover is mandatory.
7. **Major Vietnamese news outlets** reporting figures the lender gave, or SBV and Ministry statements about the lender. These are secondary; confirm at an official source if possible.

Search in Vietnamese first. Try the product's exact name, and the lender's other domains or subdomains.

## Hard rules
- Never guess or fill in a number. Unknown stays `null`.
- Every figure needs `sourceUrl`, `retrievedAt` and `confidence`. Follow the definitions in `.claude/agents/market-researcher.md`.
- Never log in, apply, submit a lead form, enter personal details, or get around a site's protections.
- Forums, affiliate "top 10" pages and loan-ad aggregators are leads only, never sources. Never copy a figure from them.
- Don't raise a confidence level unless new evidence justifies it. Don't lower it without a reason.
- Don't remove a figure unless a better source replaces it. If figures disagree, record both in `conflicts`.
- Set `sourceDocumentDate` when a document states its date. Old or undated documents must say so.
- Change `retrievedAt` only on figures you actually re-checked today.

## When a product may be ranked
Set `excludeFromRanking: false` only when all of these hold:
- The lender itself states a real offered range (`kind: "offered_range"`) with minimum and maximum, for this product.
- The basis (flat or reducing) and the period are stated, or worked out from the lender's own worked example (mark that as `provenance: "inferred"`).
- The source is official and is not contradicted by a newer official source.

A "từ X%" figure, a legal or framework ceiling, a bank-wide average, or a base rate is never an offered range. Record it under the matching `kind`. Do not stretch one to fit.

## What to change
- Edit only your own lender file, `data/lenders/<slug>.json`. Don't edit the schema, code or other lenders' files, and don't commit.
- If the schema can't hold something important (for example rates that differ by term), keep the data as close as you can and tell me in your report.
- Add a newly found consumer product if it fits salaried borrowers aged 22–35.
- Afterwards run `npm run validate-data` and fix errors in your own file only. Other researchers may be mid-edit, so ignore errors in their files.

## What to report
1. For each product, before and after: rate, basis, fees, insurance, confidence, and whether it can now be ranked. Include URLs for the key new figures.
2. For each figure still unknown: exactly where you looked, so we can say "searched, not published" with evidence. Give the URLs and search terms you tried.
3. Contradictions and surprises.
4. Any product where a figure exists but the rules above stop it being used. Say what would unlock it.
