/**
 * Regulatory figures used in data checks. Sources and caveats:
 * docs/research/regulations.md.
 */

/**
 * Maximum total consumer-loan balance per customer at ONE finance company
 * (Circular 43/2016/TT-NHNN art. 3(1)), except car loans secured on the car.
 * A 2025 draft proposes 400M; not issued as of 2026-10. A lawyer must confirm
 * whether finance companies may lend more under other rules (compliance M8).
 */
export const FINANCE_COMPANY_CONSUMER_LOAN_CAP_VND = 100_000_000;
