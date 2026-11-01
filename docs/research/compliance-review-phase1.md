# Compliance review: Phase 1 data and research (2026-11-01)

The `compliance-reviewer` agent wrote this review. It is not legal advice. Each item has a status, kept up to date as we fix things.

**Status key:** ⏳ open · 🔧 fixed in schema v2 / data migration · ➡️ deferred to a later phase

## Must fix

| # | Problem | Fix | Status |
|---|---|---|---|
| M1 | Rate fields mix offered rates, advertised floors ("từ X%"), legal ceilings and benchmarks. An engine would show a floor as "your rate". Examples: HD Saison ceilings 4.99/4.92/4.79%/month; Lotte PayLater framework 0–24%; Shinhan installment 0–59%; every "chỉ từ" figure. | `rates[]` with `kind` (offered_range / advertised_floor / regulatory_ceiling / benchmark) and `segment`. Only an `offered_range` feeds the cost of a specific user. | ⏳ |
| M2 | Rate basis/period and fee/insurance timing have no provenance, so an inferred value looks the same as a stated one (Mcredit reducing; FE flat vs T&C reducing; insurance "added_to_loan" inferred). | `{ value, provenance: stated / inferred / none, sourceUrl, note }`. The engine labels inferred values "giả định" (assumption). | ⏳ |
| M3 | `fixedVnd` is used for **minimum** fees, so an engine would add it on top of the %. Examples: HD Saison 6% min 1.5M (rule "greater of 6% or remaining interest"); Mcredit 5% min 1.65M; VPBank 4%/3% with mins; TPBank min/max in notes only. | Fee fields `base`, `minVnd`, `maxVnd`, `tiers`, `rule`, `trigger`, `payee`, sourced `mandatory`. | ⏳ |
| M4 | Insurance premiums can't be represented. VPBank charges 1.3–1.8%/yr on the declining balance, collected at disbursement. TPFico charges 2.5%/yr × insured amount (140% / 110% of the loan). | `premium { method, ratePercentMin/Max, insuredMultiplierTiers, fixedVnd }`, `collection`, `beneficiary`. The engine shows cost with and without optional insurance. | ⏳ |
| M5 | Misleading worked examples. FE `statedApr` 16.92 is 1.41×12 nominal; the real IRR is ≈30% nominal / 34% effective. Techcombank total repaid is wrong on the source page (12 × 1,785,407 = 21,424,884, not 21,324,807), and the 12-month example falls below the product's 20-month minimum term. Home Credit's example is equal-principal, so "monthly payment" is only the first month. | `statedAnnualRatePercent` + `statedAnnualRateKind`; `amortization`; `internallyConsistent`. Keep inconsistent examples out of test fixtures. | ⏳ |
| M6 | Conflicts between sources were resolved toward the cheaper value (FE phone max 2.69% stored over 3.86%). | `conflicts[]` on the product. The stored value is the conservative one (higher cost) or null. | ⏳ |
| M7 | Confidence breaks the rubric. Techcombank is all blog pages ("compiled from general market info", some expired), so it should be low. Shinhan 500M is "high" despite a 300M conflict. HD Saison cash term comes from a generic FAQ. | Re-rate the confidence. Techcombank is held back from ranking until there's an official source. | ⏳ |
| M8 | Finance-company maximums contradict the 100M Circular 43 cap: Home Credit 250M, Shinhan 500M, HD Saison 101–130M. | Record as conflicts. Don't present amounts above 100M as achievable until a lawyer confirms. | ⏳ |
| M9 | Scam keywords would flag licensed lenders: "xác thực khuôn mặt", "phí bảo hiểm khoản vay", "chứng minh tài chính", "chỉ cần CCCD", "lãi suất 0%", "lãi theo ngày"… Diacritic-folding causes false matches ("gán nợ" → "gần nơi"). | Require a money-transfer verb for high severity, use word boundaries, and add a regression test that runs the patterns on licensed lenders' own text (0 high hits). The licence result shows first. | ➡️ Phase 4 |
| M10 | An alias miss ($NAP, TPFico) would call a licensed lender unlicensed. | The UI says "không tìm thấy trong danh sách NHNN (kiểm tra ngày …) — chưa xác minh", never "không được cấp phép". "FE" is matched exactly only. | ➡️ Phase 4 |

## Should fix

| # | Problem | Status |
|---|---|---|
| S1 | Lender of record unclear for TPFico (TPBank brand?), $NAP, and partner pay-later apps. Add `lenderOfRecord` and `brandOrChannel`. Verify $NAP before using it as an alias. | ⏳ |
| S2 | `legalName` doesn't match the SBV list (Mcredit, HD Saison without diacritics, FE). The validator should check it. | ⏳ |
| S3 | Research notes still say "licensed list doesn't exist yet". | ⏳ |
| S4 | Freshness checks only `retrievedAt`, not the source document's own date (HD Saison 2020 page, Shinhan 2025 tariff, Mcredit 2025 page data, VPBank 2022 footer, TPFico 2022 notice). Add `sourceDocumentDate`; old documents get low confidence. | ⏳ |
| S5 | Expired or hidden products are listed as current (HD Saison union campaign 2024, Mcredit limit loan only in calculator JSON). Add `status` and `validUntil`. | ⏳ |
| S6 | An empty `fees`/`insurance` list can't separate "none" from "unknown". Add `feesCompleteness` / `insuranceCompleteness`. A product with unknown fees never ranks as cheapest. | ⏳ |
| S7 | Validator gaps: future-date check on every date; licensed-list age; per-period rate sanity; examples inside product ranges; "high" confidence alongside conflicts; 0% with `promotional: null`. Staleness also needs a check when the app runs. | ⏳ (runtime check ➡️ Phase 3) |
| S8 | Published penalties that look above Circular 39 art. 13(4) limits (HD Saison 150% on the whole instalment; Lotte 8% of remaining principal for not reporting an address change). Record as conflicts with neutral wording, and ask the lawyer. | ⏳ |
| S9 | regulations.md states some claims more firmly than its sources allow (the Civil Code 20% cap "does not bind"; the 100%/yr criminal threshold; the 86/VBHN-NHNN date; Circular 29/2026 not read). It also lacks Law on Data 60/2024, Consumer Protection Law 19/2023 and MoIT e-commerce notification. | ⏳ |
| S10 | scam-patterns.md: W05 "4.4%/day" doesn't match the article's own numbers (≈5.4%/day on money received). W01 wording needs care, because licensed lenders legitimately take insurance at disbursement. Reporting channels are unverified, so don't ship them. | ➡️ Phase 4 |
| S11 | Vietnamese text: HD Saison names have no diacritics, and names mix languages. Add `nameVi` / `nameEn`. | ⏳ |
| S12 | Eligibility the schema can't hold: sex-specific age (Shinhan card), age at loan end (Lotte), gross vs net income, employer whitelist (TPBank), existing-customer or salary-account requirement. | ⏳ |

## Nice to have
- Shinhan installment early-repayment tiers overlap at instalments 13, 19 and 25.
- Prefer Home Credit's motorbike product page over the homepage tile.
- No commercial fields (sponsor, affiliate, payout) in the schema, with a test that fails if one appears.
- Products with unknown rates go in a separate "chưa đủ dữ liệu để so sánh" group.
- The UI states that the licensed list covers banks and finance companies only.
- Don't cite the Home Credit mortgage DTI blog as support for 40%.

## Questions for a Vietnamese lawyer
1. Is the Circular 43 art. 3(1) 100M cap per customer per finance company fully in force? Can finance companies lend 250–500M unsecured under Circular 39? Was the 400M draft issued?
2. TPFico: is TPBank the lender of record? Can we list it as TPBank?
3. Partner apps ($NAP, ShopeePay/MoMo pay-later funded by a licensed lender): can we show them as licensed, and what must we say about the app operator?
4. Could our APR/total-cost estimate shown next to the lender's own rate be treated as misleading comparison or as advertising (Law 75/2025 art. 2(1), 8(10))? What records must we keep?
5. What wording is safe when a lender's published terms appear to exceed Circular 39 art. 13(4), or when insurance appears bundled (Law 32/2024 art. 15(5))?
6. Are HD Saison's "greater of 6% or all remaining interest" and Lotte's 8% address-change penalty enforceable, or unfair terms under Consumer Protection Law 19/2023?
7. Liability for showing pattern-based scam warnings on names that belong to a licensed lender or a lawful business.
8. Does static hosting on Vercel (foreign servers, IP logs) count as cross-border transfer under Law 91/2025 art. 20(1)(c)? Does the small-business relief cover the dossier? Does Law on Data 60/2024 add duties?
9. Is income typed into a calculator that runs only in the browser outside "processing by us"? Is it sensitive data under Decree 356 art. 4(1)(k)?
10. The current official wording of Civil Code art. 468 and Criminal Code art. 201.
11. Does a free comparison site need MoIT e-commerce notification or other registration? Would referral fees later make us an agent?
12. Does 86/VBHN-NHNN (30/6/2026) include Circular 29/2026, and does Circular 29 add affordability or disclosure duties?
