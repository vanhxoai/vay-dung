# Compliance review: Phase 3 user flow (2026-11-02)

The `compliance-reviewer` agent wrote the findings. This is not legal advice. Its exact replacement wording was applied. The fixes themselves were checked by tests, not by a second review.

## Fixed
- M1 A green "ok" could rest on one product with unknown fees or restricted access.
- M2 No eligible offers now gives its own verdict (`no_data`).
- M3 A mistyped debt or income ("3tr") is rejected.
- M4 "Includes known fees and insurance" was not accurate; reworded, and the rate is labeled a Vay Đúng estimate.
- M5 How insurance is collected is now passed through, and stated when unknown.
- M6 Rate notes always state their basis and period.
- M7 Every source is linked, the rate has its own link, and the oldest figure's date is shown.
- M8 The conflict sentence now matches our source rule, and it's on the card face.
- M9 Raw research notes replaced by translated reason codes; the text no longer blames lenders.
- M10, M11 Scam and guidance wording softened to what we can support.
- M12 Short disclaimer directly under the verdict; full text adds "not credit advice or brokerage".
- M13 Temporary browser copy limited (2 minutes, read once, cleaned on every page, validated).
- M14 Finance-company 100M text reworded as our current choice, pending a lawyer.
- S1–S5, S7, S8, S10–S13: done. S6 hint added for debt payoff. S9 note added. S12 error page added. S14: English labels the Vietnamese data instead of translating it.

## Still open
- Lender-provided text (late-payment terms, documents, conditions) stays Vietnamese on /en.
- A privacy notice page is needed before launch (Phase 5/6).
- No build-time age check for the licensed list yet.
- The student loan programme in the education guidance isn't in our research (it's worded as "ask whether you qualify").

## New questions for a Vietnamese lawyer
1. Is the wording of the 100M finance-company note safe next to lenders advertising more?
2. Does "Chúng tôi không khuyên bạn vay" together with ranked options amount to advice or credit consulting despite the disclaimer?
3. Does an estimated "lãi suất thật" beside a lender's own rate, with one lender named in "vay ít hơn", count as comparative advertising needing documents (Law 75/2025 art. 2(1), art. 8(10))?
4. Is the temporary browser copy outside "processing by us" (Law 91/2025)?
5. Is the scam wording safe, given licensed lenders' charges at disbursement and the risk to lawful businesses?
6. Is "không bắt buộc" safe to state from a lender's own terms, including where insurance forms appear in every loan dossier?
7. Does the 90-day staleness handling meet any record-keeping duty for comparison claims?
