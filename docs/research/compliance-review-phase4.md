# Compliance review: Phase 4 safety check (2026-11-02)

The `compliance-reviewer` agent wrote the findings. This is not legal advice. Its exact replacement wording was applied. The fixes were checked by tests, not by a second review.

## Fixed
- M1 Unrelated businesses came back as licensed ("Công ty Lộc Phát" as LPBank, "Tài chính Thịnh Vượng" as VPBank). Words typed must now agree with the institution's type, and a bare "company" word never matches.
- M2 Place names and everyday businesses were look-alikes ("Tân Bình" contains "An Bình").
- M3 "On the list" could read as safe, and wasn't literally true for brand names. Reworded, and the green border removed.
- M4 "Not on the SBV's list" was false for institutions we skipped. It now says "in the data we took from".
- M5 "Similar" no longer implies impersonation by a lawful business.
- M6 A named lender plus the harassment sign could read as "this lender is a loan shark".
- M7 The "hold ID" sign wasn't supported by its sources; replaced by what the source says.
- M8 "A valid fee must be in the contract" was unsourced and falsely reassuring (contracts can be forged).
- M9 The "stop contact" advice reached real borrowers; now only "if you suspect a scam".
- S1 Disclaimer moved directly under the result, and it names what the list leaves out. S2 Date is the oldest of the lists, with a warning once it's old. S3, S5, S6, S7, S8, S9, S12 wording and patterns. S10 Telegram removed (not confirmed in the source).
- S11 Remaining everyday names sent to a researcher.
- From QA: the result clears when an answer changes; generic words don't point at a lender; "Shinhan" names both; phone numbers say they weren't checked; the button stays in reach; language switch reloads the page, so no hidden old page remains.

## Still open
- S4 The advice to record calls is kept (source S8), but its legality is a lawyer question.
- The TNEX legal name shows the SBV's own remark in brackets.
- No advice yet on calling your own bank straight away after paying a scammer (needs research).
- The fraud portal, the 156 line and the SBV hotline aren't shown: none could be confirmed as a current channel for loan scams (docs/research/scam-patterns.md §3).

## New questions for a Vietnamese lawyer
1. May a person record their own calls with a debt collector or suspected scammer without telling them, and use the recording as evidence? May relatives?
2. Could naming a licensed institution next to a police warning about "tín dụng đen" create defamation or unfair-competition liability, even with a disclaimer?
3. Is showing "matches the SBV list" through our own brand aliases (Cake, MSB) acceptable when the SBV pages don't show those names?
4. Does a bank under special SBV control need extra wording?
5. Does a typed company name count as personal data when it names a sole trader or a person, even if processed only in the browser?
6. May we tell users to stop contact and go to the police when the other party may be a real creditor? Must we say a genuine debt could still stand?
