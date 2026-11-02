const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from an ISO date (YYYY-MM-DD) to `today`. */
export function ageInDaysFrom(isoDate: string, today: Date): number {
  return Math.floor((today.getTime() - new Date(`${isoDate}T00:00:00Z`).getTime()) / DAY_MS);
}
