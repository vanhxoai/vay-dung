import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_VERSION } from "@/config/site";
import { POST } from "./route";

const valid = { email: "a@example.com", consent: true, consentVersion: CONSENT_VERSION, locale: "vi" };

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://vaydung.test/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: "vaydung.test", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/waitlist", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is closed unless deliberately switched on, even for a valid signup", async () => {
    vi.stubEnv("WAITLIST_ENABLED", "");
    expect((await post(valid)).status).toBe(503);
  });

  describe("when switched on", () => {
    beforeEach(() => {
      vi.stubEnv("WAITLIST_ENABLED", "true");
      vi.stubEnv("SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    });

    it("rejects a signup without consent", async () => {
      expect((await post({ ...valid, consent: false })).status).toBe(400);
    });

    it("reports unavailable when no store is configured", async () => {
      expect((await post(valid)).status).toBe(503);
    });

    it("answers bots that fill the hidden field with success, without storing anything", async () => {
      // No store is configured, so a real attempt to store would have returned 503.
      expect((await post({ ...valid, website: "http://spam" })).status).toBe(200);
    });

    it("rejects browser posts from another site", async () => {
      expect((await post(valid, { origin: "https://evil.example" })).status).toBe(403);
    });
  });
});
