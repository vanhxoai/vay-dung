import { describe, expect, it } from "vitest";
import { CONSENT_VERSION } from "@/config/site";
import { SignupRequest, storeSignup } from "./signup";

const valid = { email: "a@example.com", consent: true, consentVersion: CONSENT_VERSION, locale: "vi" };
const parsed = SignupRequest.parse(valid);
const now = new Date("2026-11-02T10:00:00Z");
const env = { url: "https://x.supabase.co", key: "secret" };

describe("SignupRequest", () => {
  it("accepts an email with explicit consent", () => {
    expect(SignupRequest.safeParse(valid).success).toBe(true);
  });

  it("rejects missing or false consent: an unticked box isn't consent", () => {
    expect(SignupRequest.safeParse({ ...valid, consent: false }).success).toBe(false);
    const { consent: _omit, ...noConsent } = valid;
    void _omit;
    expect(SignupRequest.safeParse(noConsent).success).toBe(false);
  });

  it("rejects an old consent text version", () => {
    expect(SignupRequest.safeParse({ ...valid, consentVersion: "2020-01-01" }).success).toBe(false);
  });

  it("rejects bad emails and anything beyond the agreed fields", () => {
    expect(SignupRequest.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(SignupRequest.safeParse({ ...valid, income: 15000000 }).success).toBe(false);
  });

  it("rejects bots that fill the hidden field", () => {
    expect(SignupRequest.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
});

describe("storeSignup", () => {
  it("stores the email with its consent record, and nothing else", async () => {
    let body: Record<string, unknown> = {};
    const fake = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    expect(await storeSignup({ ...parsed, email: " A@Example.com " }, now, env, fake)).toBe("stored");
    expect(body).toEqual({
      email: "a@example.com",
      consented_at: "2026-11-02T10:00:00.000Z",
      consent_version: CONSENT_VERSION,
      source_page: "/",
      locale: "vi",
    });
  });

  it("reports when nothing is configured or the store fails", async () => {
    expect(await storeSignup(parsed, now, {})).toBe("not_configured");
    const down = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    expect(await storeSignup(parsed, now, env, down)).toBe("failed");
    const offline = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await storeSignup(parsed, now, env, offline)).toBe("failed");
  });
});
