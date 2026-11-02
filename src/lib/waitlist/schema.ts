/** What a waitlist signup may contain. Shared by the form and the server; holds no server code. */
import { z } from "zod";
import { CONSENT_VERSION } from "@/config/site";

export const SignupRequest = z.strictObject({
  email: z.email().max(254),
  /** Must be true: an unticked box isn't consent. */
  consent: z.literal(true),
  consentVersion: z.literal(CONSENT_VERSION),
  locale: z.enum(["vi", "en"]),
  /** Hidden field real users never fill in; bots do. The server ignores such signups silently. */
  website: z.string().max(500).optional(),
});
export type SignupRequest = z.infer<typeof SignupRequest>;
