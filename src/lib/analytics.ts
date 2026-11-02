/**
 * Questionnaire funnel for completion and drop-off (DECISIONS #42).
 *
 * Vercel's free plan has no custom events, so each step counts as a page view at a fixed,
 * made-up address. The argument can only be one of these constants: nothing a user typed or
 * was told (amount, income, verdict, lender) can ever be sent. The real URL doesn't change.
 */
import { pageview } from "@vercel/analytics";
import { ANALYTICS_ENABLED } from "@/config/site";

export type FunnelStep = "buoc-2" | "ket-qua";

export function trackStep(step: FunnelStep): void {
  if (!ANALYTICS_ENABLED) return;
  pageview({ path: `/vay/${step}` });
}
