# Lender data coverage

As of 2026-11-03. This records what the deep research found, and where it looked for what is still missing, so "not published" rests on evidence. Details and URLs are in each `data/lenders/*.json` file (`rates`, `conflicts`, `notes`, `researchNotes`). The research brief is in [data-deep-dive-brief.md](data-deep-dive-brief.md).

## Summary

| | Before | After |
|---|---|---|
| Products the app can show | 38 | 48 |
| Can be ranked | 6 | 7 |
| "Not enough data" | 32 | 41 |
| High confidence | 0 | 0 |
| Medium confidence | 15 | 23 |
| Low confidence | 23 | 25 |

Home Credit's electronics loan is newly ranked. The extra products came from the research, and most of them publish no usable range either.

## By lender

| Lender | Shown | Ranked | What we now know | Still not published (searched) |
|---|---|---|---|---|
| FE Credit | 4 | 3 | Range on the cash page, app listing with 15–35% a year flat, contract templates, voluntary insurance of about 1.5–7.99% across products, 12,000 đồng collection fee | One clear range and basis; early repayment and late fee for loans (blank in templates); no rate table in a sitemap of 1,297 addresses |
| Home Credit | 3 | 2 | Rate sheets: cash 45–55% a year for new customers, electronics 0–49.5%, 11,000 đồng per instalment | Insurance premium; a current motorbike sheet (the one we have is 21–28 months old) |
| Shinhan Finance | 4 | 1 | Unsecured 18–49% a year, tariff of 29/05/2026, early repayment 6%, optional insurance | Insurance premium and insurer; motorbike rate and term; one maximum age |
| VPBank | 5 | 1 | From 18% on the product page, 59% only on a shared sign-up form, insurance 1.3–1.8% a year | Maximum rate on a product page; whether insurance is mandatory; fee schedule for this loan type; overdraft rate |
| Lotte Finance | 5 | 0 | "From" rates, company-set ranges (8–66%, 20–66%), reducing-balance contract, app example at 24% | Rate table by scheme; insurance premium; PayLater limit and term |
| Mcredit | 4 | 0 | From 2.88% a month reducing, company-wide 0–6.25% a month, annuity terms, 5% early settlement | Range per product; insurance premium; whether about 2.9% is flat or reducing (FAQ and app example disagree) |
| HD Saison | 3 | 0 | Ceilings only. **Deep research stopped at your request** | Not researched this round |
| Techcombank | 3 | 0 | Official pages for all three, from 12.9% a year, 380 đồng per million per day, MyCash fees and late terms | Any maximum rate; the rate table its MyCash contract refers to; insurance |
| TPBank | 5 | 0 | TPFico is part of TPBank (no branded contract naming the lender found), Kredivo and FPT Telecom loans, insurance formula | Any product rate; the contract says it's set at approval |
| MB Bank | 2 | 0 | General fee schedule, early repayment 2%/1%/0.5% | Product rate (real pricing appears to be in the app only); contract template; insurance |
| ACB | 1 | 0 | Overdraft only; no unsecured salary loan in a sitemap of 1,627 addresses | Overdraft limit, maximum rate, late penalty; likely only visible after login |
| Sacombank | 4 | 0 | Vietnamese product pages, online loan terms, 2% commitment fee, unsecured overdraft | Any rate for salary loans or overdraft; which of two card-loan rate documents is right |
| VIB | 3 | 0 | Calculator uses 23–25% a year, reducing, by amount; early repayment 4%/3%/2% | A stated maximum; insurance; late penalty; Super Cash basis |
| HDBank | 2 | 0 | Bank-wide average, 13–24% in a 2025 blog, 3%/2%/1% early repayment fee | Product rate; a VND limit; the new card-loan rate it says took effect 24/09/2024 |

## The Viettel Money comparison table

Viettel Money's table (https://viettelmoney.vn/so-sanh-lai-suat-vay/) is undated and cites no sources. We used it as leads only and stored none of its figures. Results for the lenders we checked:

| Lender | Its figure | Official evidence |
|---|---|---|
| Home Credit | 19.92% | No support; rate sheet says 45–55% a year for new customers |
| FE Credit | 21% | No support |
| VPBank | 16% | Starting rate for existing customers on a different loan |
| MB Bank | 12.5–20% | One MB blog post, general and for reference, naming no product |
| ACB | 17.9% | No support |
| Sacombank | 9.6% | No support |
| VIB | 17% | No support |
| HDBank | 24% | One HDBank blog post from 2025, as the top of 13–24% |

## Sources we excluded

- `vaynhanh.mbbank.credit`: not linked from any MB page we read, and registered in March 2025 through a public registrar. We can't tie it to MB, so its figures aren't stored.
- `tpbfico.com.vn`: an unofficial lead-generation site. None of its figures are stored.

## Known gaps

- Figures taken from pages are checked against sources for the headline numbers, not every number.
- Nothing here comes from a real contract or quote. Rates shown to borrowers after approval, or inside apps, can't be reached from public pages.
- The rule for what counts as a rate range is in `docs/DECISIONS.md` #55.
