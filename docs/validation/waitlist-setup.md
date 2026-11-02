# Turning on the waitlist

The waitlist is built but **off**: the home page shows no form, and `POST /api/waitlist` answers 503. It stays off until a lawyer has answered the cross-border question (`docs/research/regulations.md` §4.4, §8 question 4). See DECISIONS #41.

## Before turning it on
1. **Lawyer:** confirm the cross-border dossier (Law 91/2025 art. 20), which must be filed within 60 days of the first email stored abroad, and review the consent text (`Waitlist.consent` in `messages/*.json`) and the privacy notice (`/rieng-tu`).
2. **Controller:** confirm the name and contact in `src/config/site.ts`.
3. **Providers:** you create the accounts, and approve any cost. The code targets Supabase. If you choose another provider, only `storeSignup` in `src/lib/waitlist/signup.ts` changes. Choose how the launch email will be sent: that tool is another processor, possibly another transfer, and it must be named in `Waitlist.consent` and `Privacy.waitlist.processor`. Confirm which Supabase company signs the contract.
4. **Contracts:** sign a data-processing contract with each processor (Law 91/2025 art. 37(2); Decree 356 art. 12).
5. **Region:** `vercel.json` pins server code to Singapore (`sin1`). Check that the deployed project uses it; the privacy text says so.
6. **Rate limit:** add a Vercel Firewall rule on `POST /api/waitlist` (for example 5 per minute per IP), after confirming your plan allows it. Otherwise someone could add other people's emails.
7. **Consent record:** write the exact rendered consent text, per version and language, including name, email and months, to `docs/validation/consent-versions.md`. Stored signups point to a version, so the version must point to a text. Bump `CONSENT_VERSION` whenever the text changes.
8. **Deadlines:** replace "the legal deadline" below with the number after reading Decree 356 art. 5, and set a dated deletion reminder.
9. **Define the launch:** deletion depends on "ra mắt chính thức", so record what event that means in DECISIONS.

## Supabase setup
Create a project in the Singapore region, then run this in its SQL editor:

```sql
create table waitlist_signups (
  email text primary key,
  consented_at timestamptz not null,
  consent_version text not null,
  source_page text not null,
  locale text not null
);
-- Nobody can read or write this table with the public key. The server uses the service key.
alter table waitlist_signups enable row level security;
revoke all on waitlist_signups from anon, authenticated;
```

Set these in Vercel's environment variables, never in the code:

| Name | Value |
|---|---|
| `WAITLIST_ENABLED` | `true` |
| `SUPABASE_URL` | the project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the service role key (secret) |

Redeploy, because the home page reads the switch at build time.

## While it's on
- Honour withdrawal requests sent to the contact email: delete the row, within the legal deadline.
- Delete signups once people have been told the app is open, or after 12 months, whichever comes first.
- Send one launch email only. Anything else needs new consent.
- A free Supabase project pauses after about a week of low activity, and signups then fail with a visible error.
