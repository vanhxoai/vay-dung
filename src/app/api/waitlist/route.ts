import { isWaitlistEnabled } from "@/config/site";
import { SignupRequest, storeSignup } from "@/lib/waitlist/signup";

/** Waitlist signup. Closed unless deliberately switched on (src/config/site.ts). Never logs the email. */
export async function POST(request: Request): Promise<Response> {
  if (!isWaitlistEnabled()) return Response.json({ error: "closed" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = SignupRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const result = await storeSignup(parsed.data, new Date());
  if (result !== "stored") return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}
