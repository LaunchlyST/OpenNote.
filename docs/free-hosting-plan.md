# £0 hosting for the Desknoty backend: Supabase Free

Status: **in progress on branch `migration/supabase`.** desknoty.com is not
switched until the hosted checks below pass. Checked November 2026.

Netlify and Turso were evaluated earlier and are **not used**. No Netlify
account or key is needed. Turso's terms limit free use to non-commercial use,
which rules it out for a store.

## Where each part runs (Supabase Free project `desknoty-test`, Frankfurt)

| Part | Runs on | Notes |
|---|---|---|
| API (Express app) | Supabase Edge Function `api` | `https://<ref>.supabase.co/functions/v1/api/...`; verify_jwt off (the app does its own auth) |
| Database | Supabase Postgres (500 MB) | Same code as local SQLite via `server/sql.ts`; set `DATABASE_URL` |
| Sign-in | Better Auth inside the function | Bearer-token sessions: a supabase.co cookie is third-party for desknoty.com |
| Product files | Private Storage bucket (1 GB total) | **50 MB per file** on Free, so `SELLER_MAX_FILE_MB=50`; short-lived signed links only for paid orders |
| Stripe webhooks | Same function, `/api/seller/webhook` | Signature-checked; duplicates ignored via `stripe_event`; Sandbox only |
| Email | SMTP on port 465 (25/587 blocked) | Outbox sent by Supabase Cron |
| Frontend | GitHub Pages (unchanged) | Built with `VITE_API_BASE_URL` pointing at the function |

## Free-plan limits

- The project pauses after 7 days without activity (resume in the dashboard; data is kept).
- No automatic backups on Free: run scripts/backup-data.ts before migrations.
- 5 GB egress and 500k function calls a month; 2 s CPU per request.
- Billing stays disabled: limits stop service, they never charge.

## Secrets (entered by the owner, never in chat or Git)

Supabase dashboard → Edge Functions → Secrets: `STRIPE_SECRET_KEY` (Sandbox
`sk_test_…`), `SMTP_USER`, `SMTP_PASS`. `BETTER_AUTH_SECRET` and the Stripe
webhook signing secret are generated during deployment and stored there
directly. `SUPABASE_DB_URL` and the service role key are provided to the
function automatically.

## Hosted checks before switching desknoty.com

Sign-in, seller isolation, product upload (≤ 50 MB), Sandbox checkout, genuine
Stripe webhook fulfilment, protected downloads (unpaid refused), duplicate
webhook delivery ignored.
