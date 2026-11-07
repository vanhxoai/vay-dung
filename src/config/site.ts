/**
 * Public facts about who runs the site, and the waitlist switch.
 * Law 91/2025 art. 9: consent must say who controls the data.
 */
export const CONTROLLER = {
  name: "Nguyễn Vân Anh",
  contactEmail: "chjopchjop1210@gmail.com",
} as const;

/** Bump when the consent text changes: each signup stores the version it agreed to. */
export const CONSENT_VERSION = "2026-11-02";

/**
 * Analytics is OFF for the soft launch (DECISIONS #49). Turning it on also means restoring
 * the privacy wording: see docs/validation/analytics-setup.md.
 */
export const ANALYTICS_ENABLED: boolean = false;

/**
 * Archive mode (DECISIONS #69): figures older than 90 days are still ranked, under a notice
 * giving the date they were collected, so the demo keeps working after the data stops being
 * updated. Turn it off if the data is maintained again: old figures then drop out of the ranking.
 */
export const ARCHIVE_MODE: boolean = true;

/** Soft launch: reachable by direct link only, so search engines are asked not to list it (DECISIONS #50). */
export const SEARCH_INDEXING_ENABLED: boolean = false;

/** Signups are deleted after this, or when we've told people the app is open, whichever is first. */
export const WAITLIST_RETENTION_MONTHS = 12;

/**
 * The waitlist is OFF until a lawyer has answered the cross-border question (DECISIONS #41).
 * Turning it on is deliberate: see docs/validation/waitlist-setup.md.
 */
export function isWaitlistEnabled(): boolean {
  return process.env.WAITLIST_ENABLED === "true";
}
