import { isWaitlistEnabled } from "@/config/site";
import { SignupRequest } from "@/lib/waitlist/schema";
import { storeSignup } from "@/lib/waitlist/signup";

/** Waitlist signup. Closed unless deliberately switched on (src/config/site.ts). Never logs the email. */
export async function POST(request: Request): Promise<Response> {
  if (!isWaitlistEnabled()) return Response.json({ error: "closed" }, { status: 503 });

  // Stops other sites posting through a visitor's browser. It doesn't stop scripts: see the
  // rate-limit step in docs/validation/waitlist-setup.md.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = SignupRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  // A filled hidden field means a bot: look successful, store nothing.
  if (parsed.data.website) return Response.json({ ok: true });

  const result = await storeSignup(parsed.data, new Date());
  if (result !== "stored") return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}
