# Lender data entry rules (schema v2)

These rules apply to anyone who writes `data/lenders/*.json`: people, the market-researcher agent, `/add-lender` and `/refresh-data`. The schema is `src/lib/data/schema.ts`. Run `npm run validate-data` after every change.

## 1. Unknown stays unknown
- An unknown figure is `{ "value": null, "sourceUrl": null, "retrievedAt": null, "confidence": null, "note": "<why it is unknown>" }`.
- An unknown classification is `{ "value": "unknown", "provenance": "none", "sourceUrl": null }`.
- An empty `fees` or `insurance` list does **not** mean "free". Set `feesCompleteness` / `insuranceCompleteness`:
  - `complete`: only when an official fee schedule for this product was read in full.
  - `partial`: some fees or insurance are known.
  - `unknown`: none are known.

## 2. Confidence (per figure)
| Level | When to use it |
|---|---|
| `high` | An official page or document states it exactly, with no conflicting official figure. |
| `medium` | Official, but ambiguous ("from X%", unclear scope), or read from a scanned or garbled document. |
| `low` | A secondary source, or an official blog or marketing page that says it is general information, is marked expired, or is older than about 12 months. |

When the source document shows its own date or effective date, set `sourceDocumentDate`. A document older than about 12 months is at most `low`.

## 3. Rates: what kind of number is it? (`rates[].kind`)
| Kind | Meaning | Used for the user's cost? |
|---|---|---|
| `offered_range` | The range the lender says it offers for this product, e.g. "18%/năm đến tối đa 49%/năm". | **Yes** |
| `advertised_floor` | "từ X%", "chỉ từ X%": the lowest rate, not necessarily the user's. | No. Shown as "từ X% (thấp nhất)". |
| `regulatory_ceiling` | The lender's published rate framework or cap (khung lãi suất), or a legal ceiling. | No. Shown as "trần công bố". |
| `benchmark` | Base rate, average lending rate, reference rate. | No. Background only. |

- A product can have several rates, e.g. new vs existing customers (`segment`), or a floor plus a ceiling.
- `basis` (flat/reducing) and `period` (monthly/yearly) record their `provenance`:
  - `stated`: the source says it, e.g. "dư nợ giảm dần", "dư nợ ban đầu", "%/năm". Put the source wording in `note`.
  - `inferred`: we worked it out, e.g. from a worked example's arithmetic or a contract clause. Explain how in `note`. The app labels these "giả định" (assumption).
- `amortization` is how the principal is repaid (annuity / equal_principal / flat / revolving). It follows the same provenance rules.

## 4. Fees
- **A minimum or maximum fee goes in `minVnd` / `maxVnd`, never in `fixedVnd`.** `fixedVnd` is only for a flat amount, e.g. "11.000đ per transfer".
- `rule`:
  - `percent_only` or `fixed_only` for a single figure;
  - `percent_with_min_max` for a percent clamped by a min/max;
  - `greater_of_percent_and_remaining_interest` for HD Saison-style rules;
  - `other` with a `note` for anything else.
- `base` says what the percent is calculated on: original principal, outstanding principal, the prepaid amount, the credit limit, or the transaction amount.
- Fees that change over time (e.g. early-repayment by year) go in `tiers`, with `percent` set to unknown. Tier boundaries must not overlap: use `from` inclusive and `to` exclusive, and say so in the note if the source is ambiguous.
- `trigger` says when the fee is charged. `timing` says how it is paid (deducted, financed, on event…).
- `payee` is `third_party` for collection-point fees. They are still a cost to the borrower.

## 5. Insurance
- `mandatory` must be sourced. "Optional" insurance that is pre-selected at signing is still recorded as optional, with a note.
- `premium.method`:
  - `percent_of_principal`: a one-off premium;
  - `annual_rate_on_declining_balance`: VPBank-style;
  - `annual_rate_on_insured_amount`: TPFico-style, with `insuredMultiplierTiers` such as `[{ "termMonthsMax": 24, "multiplier": 1.4 }, { "termMonthsMax": null, "multiplier": 1.1 }]`.
- A range of rates goes in `ratePercentMin` / `ratePercentMax`.
- `collection` says how the premium is collected: deducted at disbursement, financed (`added_to_loan`), monthly. It uses provenance like any classification.

## 6. Conflicts between official sources
- Record every disagreement in `conflicts[]`, giving the field path (e.g. `"amountMaxVnd"`, `"rates[0].maxPercent"`), each value with its source, and the `resolution`.
- **Source tiers decide first.** Tier 1: product page, fee schedule (biểu phí), rate disclosure, contract or T&C. Tier 2: the lender's own blog, news or "cẩm nang" pages, which call themselves general information. Tier 3: secondary sources. A lower-tier figure never overrides a higher-tier one. It is still recorded in `conflicts[]` for information.
- **Within the same tier, the stored value is the conservative one** (higher cost or stricter condition for the borrower), or null if it can't be decided. Never store the cheaper figure.
- **Flat quote vs contract rate.** Lenders often advertise a flat rate (lãi phẳng, "trên dư nợ ban đầu"), while the contract must state the equivalent annual rate on the reducing balance (Circular 39 art. 13(3)). These describe the same cost and are not a conflict. Store the advertised figure with basis `flat`, and let the engine compute the real cost.
- A field that has a conflict is never `high` confidence.
- **Finance-company cap (compliance M8):** if a finance-company product advertises more than 100,000,000 VND, add a conflict on `amountMaxVnd`. Cite the lender's page and Circular 43/2016 art. 3(1) (see docs/research/regulations.md). The resolution says "Lawyer to confirm; app does not show amounts above 100M as achievable".
- Published penalties that look above the Circular 39 art. 13(4) limits are recorded as conflicts with neutral wording ("appears to differ from …"). Never accuse a lender of breaking the law.

## 7. Worked examples
- `statedAnnualRatePercent` + `statedAnnualRateKind`: a figure such as "16,92%/năm" that is just monthly × 12 is `nominal`. It is never called APR.
- Check the lender's arithmetic. If the numbers don't add up, set `internallyConsistent: false` and explain in `note`. These examples are never used as test fixtures.
- For `equal_principal`, `monthlyPaymentVnd` is the first instalment.

## 8. Products
- `status`:
  - `active`: seen on a current official product page;
  - `campaign`: time-limited, with `validUntil` if known;
  - `unverified`: only seen indirectly (calculator data, an old notice);
  - `expired`.
- `lenderOfRecord` is the licensed institution in the contract. `brandOrChannel` is the app or brand name the user sees, e.g. "TPFico" or "FE ONLINE".
- Set `excludeFromRanking: true` with an `excludeReason` when the data can't support a fair comparison, e.g. only secondary sources, or an unverified product.
- Names: `nameVi` is the lender's Vietnamese product name, with diacritics. `nameEn` is an optional plain-English description. Don't mix languages in one field.
- `latePenalty.textVi` is plain Vietnamese a borrower can understand. Set the multiplier and the overdue-interest rate as figures when the source states them, e.g. 150% → `1.5`.
- Eligibility: record any condition the schema has a field for, such as existing customer, employer list, gross or net income, or age at loan end. Anything else goes in `otherConditions`, in Vietnamese.
- `legalName` must match `data/licensed-institutions.json` exactly.

## Ranges for a product or customer group (DECISIONS #61)

A range that names a product or customer group, with a known basis, under 12 months old, may be stored as `offered_range`. If its minimum disagrees with the lender's adverts for that product, set `minUnconfirmed` and add a borrower note: costs then use the maximum. A whole-company range stays `regulatory_ceiling`. Sites that block automated requests aren't worked around; a person checks them by hand (DECISIONS #62).
