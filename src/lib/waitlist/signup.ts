/**
 * Storing a waitlist signup with its consent record (Decree 356 art. 6: who, when, and
 * what they agreed to). Server only. Only an email is collected. It is never logged.
 */
import type { SignupRequest } from "./schema";

export type StoreResult = "stored" | "not_configured" | "failed";

/** Saves to Supabase's REST API. A repeated email is treated as success, so nobody can test who signed up. */
export async function storeSignup(
  signup: SignupRequest,
  now: Date,
  env: { url?: string; key?: string } = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY },
  fetchFn: typeof fetch = fetch,
): Promise<StoreResult> {
  if (!env.url || !env.key) return "not_configured";
  try {
    const res = await fetchFn(`${env.url}/rest/v1/waitlist_signups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        email: signup.email.trim().toLowerCase(),
        consented_at: now.toISOString(),
        consent_version: signup.consentVersion,
        source_page: "/",
        locale: signup.locale,
      }),
    });
    return res.ok ? "stored" : "failed";
  } catch {
    return "failed";
  }
}
