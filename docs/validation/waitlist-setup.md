# Turning on the waitlist

The waitlist is built but **off**: the home page shows no form, and `POST /api/waitlist` answers 503. It stays off until a lawyer has answered the cross-border question (`docs/research/regulations.md` §4.4, §8 question 4). See DECISIONS #41.

## Before turning it on
1. **Lawyer:** confirm the cross-border dossier (Law 91/2025 art. 20), which must be filed within 60 days of the first email stored abroad, and review the consent text (`Waitlist.consent` in `messages/*.json`) and the privacy notice (`/rieng-tu`).
2. **Controller:** confirm the name and contact in `src/config/site.ts`.
3. **Provider:** you create the account, and approve any cost. The code targets Supabase. If you choose another provider, only `storeSignup` in `src/lib/waitlist/signup.ts` changes.
4. **Privacy text:** `Privacy.waitlist.processor` names the provider and region. Update it if they change.

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
- Delete signups after 12 months, or once people have been told the app is open, whichever comes first.
- Use the list only to announce the launch. Anything else needs new consent.
- A free Supabase project pauses after about a week of low activity, and signups then fail with a visible error.
