# Compliance review, Phase 6 (pre-release)

Not legal advice. A static review by the compliance-reviewer agent; article references come from `docs/research/regulations.md`.

## Fixed
- The "a valid fee is in the contract" reassurance had survived in `Guidance.urgent`. Removed.
- The `no_data` verdict skipped the "don't borrow" message and the alternatives. Both now show.
- List date uses the oldest list, not the first.
- `depends` wording no longer claims the cause is always the rate.
- A green "fits" label can't appear on a product with entirely unknown fees.
- No "see N options" link above a don't-borrow verdict.
- "Currently takes no money" wording, the counting statement on the safety check, and the hosting notice covering the safety check.
- A rate read recently from a document over a year old now says the document's date.
- `npm run build` runs `validate-data` first.
- One term per idea across the site.
- Under-20s are told age is why no figures are shown, without implying that no product is open to them.

## Open gates, not code
1. **After deployment, before any real user:** on a preview, run the questionnaire with distinctive numbers and the safety check with a typed name. Search the network log for them, confirm no cookie is set, and confirm server functions run in `sin1`.
2. **Cross-border position:** no lawyer has answered it (see below).

## Questions for a lawyer
**Before an open public launch**
1. Does serving Vietnamese visitors from Vercel count as a transfer under Law 91/2025 art. 20(1)(c), and is an IP address personal data here? Who files, and does the art. 38 relief help?
2. Is the analytics funnel "behaviour tracking" under Decree 356 art. 4(1)(l)? Does the art. 6(4) notice apply, and is the small-business relief lost?
3. Is the site regulated (licence or MoIT notification)? Is the comparison "advertising" under Law 75/2025 art. 8(10)? Does "we don't recommend borrowing" plus ranked options amount to credit consulting?
4. Liability from the safety check: a named lender next to police warnings, "stop contact" advice when the creditor may be real, and the advice to record calls.
5. Can a private individual be the controller, what identity details must be published, and is registration needed for a free site?

**Soon after launch** (current wording takes the cautious line): regulations.md §8 Q3, Q5, Q6, Q8, Q9, Q13, Q16, Q17, Q19, and the phase 3 and phase 4 questions in their reviews.

**Before switching on the waitlist:** art. 20 for stored emails, phase 5 Q3–Q6 and Q8, and the checklist in `docs/validation/waitlist-setup.md`.

**Before charging money or taking lender money:** regulations.md §8 Q1, Q7, Q10, Q11, Q12, Q14, Q15, including the art. 7(6) ban on selling data.

**Interviews:** phase 5 Q9, ideally before more interviews. Debt details told directly by a known person may be more sensitive than anything the site handles.

## The cross-border timing
The risk starts with the first real visitor, not the waitlist: art. 20(1)(c) as researched has no minimum size, and `sin1` is still outside Vietnam. The dossier is due within 60 days of the first transfer. A soft launch doesn't change the legal question, but it lowers exposure. Log the date of the first production visitor and treat day 60 as a hard limit.
