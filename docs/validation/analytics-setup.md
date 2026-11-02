# Turning analytics back on

Analytics is off for the soft launch (DECISIONS #49). The code is kept. Don't turn it on until a lawyer has answered whether the funnel is "behaviour tracking" under Decree 356 (docs/research/compliance-review-phase6.md).

1. Set `ANALYTICS_ENABLED` to `true` in `src/config/site.ts`.
2. Restore the wording from commit 2ad6884, in both `messages/vi.json` and `messages/en.json`: `Home.privacy`, `Flow.finances.privacy`, `Safety.privacy`, `Privacy.analytics.title`, `Privacy.analytics.body`.
3. Restore the privacy notice and analytics tests in `tests/e2e/landing.spec.ts` from the same commit.
4. Update the date in `Privacy.updated`.
5. Turn on Web Analytics for the project in the Vercel dashboard.
6. Run compliance-reviewer, then repeat the network check on a preview: distinctive numbers must not appear in any request, and no cookie may be set.
