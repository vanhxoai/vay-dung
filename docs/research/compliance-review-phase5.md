# Compliance review: Phase 5 (2026-11-03)

The `compliance-reviewer` agent wrote the findings. This is not legal advice. Its exact replacement wording was applied. The fixes were checked by tests, not by a second review.

## Fixed
- Privacy claims on the home page, step 2 and the privacy notice now say that page views are counted, and how. Vercel's "no third-party cookies" isn't overstated, and the US company and processing abroad are named.
- The waitlist's purpose is one launch email everywhere, including the headings and button.
- The consent text covers the data, purpose, countries, retention and rights. The consent version was bumped.
- The privacy notice lists the full rights, Gmail for email contact, and every field stored for a signup.
- Landing claims are softer: "ước tính", "hiện không nhận tiền", and being on the list isn't an endorsement. The example states its basis and that it's before fees.
- next-intl's language cookie is off. API: other sites' browser posts are refused, and bots filling the hidden field get a silent success.
- Interview guide: fuller consent script sent in advance, steps for a person in distress or at risk, no collecting other people's details, less leading questions, and notes stored outside the code repo.
- Server code is separated from the schema the browser uses.

## Blocks going public
- The operator name was confirmed by the owner on 2026-11-03 (DECISIONS #43), so this no longer blocks. Before going public, the lawyer question on cross-border transfer still applies.

## Before switching the waitlist on
See docs/validation/waitlist-setup.md: the email-sending tool must be chosen and named, data-processing contracts, a rate limit, stored consent texts per version, the legal deletion deadline, and what "ra mắt chính thức" means.

## Check once after the first deployment
Vercel's hosted script can't be read from here. On a preview, run the questionnaire with distinctive numbers and search the browser's network log for them. Confirm no cookie is set, and that the region is Singapore.

## New questions for a Vietnamese lawyer
1. May cookieless analytics run on notice alone, or does it need prior consent? If the funnel counts as behaviour tracking under Decree 356 art. 4(1)(l), must the art. 6(4) sensitivity notice appear? Would that lose the small-business relief in Law art. 38?
2. Does the 60-day dossier clock already run from the first production visitor because of analytics and hosting? Keeping the waitlist off may not avoid it.
3. Is a ticked box without email confirmation enough for the art. 6 burden of proof, or is double opt-in needed?
4. What is the withdrawal and deletion deadline? May a minimal record of consent and withdrawal be kept after deleting the email?
5. Is a one-off launch email "advertising" under Law art. 28 and the anti-spam rules? Does it need an unsubscribe link or labelling?
6. Does an email on a loan-tool waitlist imply sensitive financial information?
7. Can a private individual be the controller, and what identity details must be published?
8. Does the waitlist need an age statement, or an under-age consent process?
9. Interviews: who is the controller? Is debt and arrears information told to us sensitive under art. 4(1)(k)? Is a written "đồng ý" by message sufficient? Does a foreign video service or Gmail trigger art. 20? Are coded notes still personal data, given that quotes, lender and city could re-identify someone?
