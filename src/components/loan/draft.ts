/**
 * Switching language reloads the page, which would lose the answers. They're kept in this
 * tab's sessionStorage ONLY for that moment: read once and removed, and ignored and removed
 * after two minutes. Nothing leaves the browser.
 */
const KEY = "vay-dung-language-switch";
const MAX_AGE_MS = 2 * 60 * 1000;

export function saveDraft(form: unknown): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), form }));
  } catch {
    // Storage can be blocked; the flow simply starts again.
  }
}

/** Reads the draft once and removes it. Returns null if missing, expired or invalid. */
export function takeDraft(): unknown | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const { savedAt, form } = JSON.parse(raw) as { savedAt?: unknown; form?: unknown };
    if (typeof savedAt !== "number" || Date.now() - savedAt > MAX_AGE_MS) return null;
    return form ?? null;
  } catch {
    return null;
  }
}

/** Removes an expired draft on any page, e.g. if the language switch failed to load. */
export function clearExpiredDraft(): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const { savedAt } = JSON.parse(raw) as { savedAt?: unknown };
    if (typeof savedAt !== "number" || Date.now() - savedAt > MAX_AGE_MS) sessionStorage.removeItem(KEY);
  } catch {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Storage is blocked, so nothing was kept.
    }
  }
}
