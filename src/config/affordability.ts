/**
 * Affordability guideline (DECISIONS #5, #14).
 *
 * The State Bank of Vietnam sets NO debt-to-income limit for consumer loans
 * (docs/research/regulations.md §5). This is Vay Đúng's own conservative
 * guideline and must always be shown as "hướng dẫn của Vay Đúng", never as a rule.
 */
export const AFFORDABILITY = {
  /** Total monthly debt payments ÷ monthly income above this → "we don't recommend borrowing this". */
  maxDebtToIncome: 0.4,
} as const;
