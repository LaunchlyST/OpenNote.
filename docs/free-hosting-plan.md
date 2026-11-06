# £0 hosting for the Desknoty backend: options and migration plan

Status: **proposal, not applied.** Nothing here has been deployed. Checked
November 2026; re-check the providers' own pricing pages before signing up.

## Why the current backend can't move as-is

The server is one long-running Express process that keeps state on a local
disk: SQLite through `better-sqlite3` (73 synchronous `db.prepare` calls in 13
files), private product files and images in `data/`, and a mail worker on a
timer. Every genuinely free host today is either serverless (no persistent
disk, no long-running process) or a "free" VM that is a trial, sleeps, or needs
billing enabled. So a £0 setup means changing how the backend stores data.

## Options checked

| | Netlify Free + Turso Free (recommended) | Cloudflare Workers Free + D1 |
|---|---|---|
| Cost / card | $0, no card on Netlify's Free plan, hard limits (stops, never bills) | $0 for Workers + D1; R2 file storage needs a payment method on file |
| Commercial use | Netlify Free explicitly allows commercial projects. Turso: terms not confirmed, **check before launch** | No restriction found |
| Compute limits | 300 credits/month (≈150k requests, ≈15 GB bandwidth); functions run up to 60 s | 100k requests/day, **10 ms CPU per request**: Better Auth email/password sign-in is reported to exceed it |
| Database | Turso: SQLite-compatible (libSQL), ~5 GB, current DB imports as-is | D1: SQLite, 5 GB (500 MB per DB), different client API |
| Private files | Netlify Blobs (private, persistent) | R2 (card) or KV (25 MB per file) |
| Stripe webhooks | Yes (raw body available in functions) | Yes |
| Blocker | File size: requests ≤ 6 MB (≈4.5 MB binary), streamed downloads ≤ 20 MB | Auth CPU limit; R2 card |

**Recommendation: Netlify Free (API as Functions, files in Netlify Blobs) +
Turso Free (database).** It is the only combination found that is $0 without a
card, allows commercial use on the hosting side, has no CPU limit that breaks
sign-in, and keeps the SQLite schema.

Limits to accept on £0:
- **Product files up to 20 MB** (uploaded in 4 MB chunks, downloaded as a
  stream). Bigger files need paid storage.
- **~15 GB of downloads + pages a month** across the whole site; when the 300
  credits run out Netlify pauses the site until the next month (no charge).
- Turso's free terms must allow commercial use; if not, Netlify Database
  (Postgres) is the fallback, which is a bigger schema change.

## Migration required

1. **Database client:** replace `better-sqlite3` (sync) with `@libsql/client`
   (async) behind `server/db.ts`; every `db.prepare(...).get/all/run` becomes an
   awaited call; the 4 `db.transaction` blocks become `client.batch`/transactions.
   Better Auth switches to its Kysely libSQL dialect. Same tables and columns.
2. **Express on Netlify Functions:** wrap the existing app with `serverless-http`
   in `netlify/functions/api.ts`; route `/api/*` to it. Remove `app.listen` for
   that entry point (keep it for local `npm run dev`).
3. **Mail worker:** a Netlify scheduled function runs `processOutbox()` every
   few minutes instead of the in-process timer.
4. **Seller files:** move `data/seller-files` and `data/seller-media` to two
   Netlify Blobs stores (`seller-files` private, `seller-media` served by the
   API). Uploads in ≤ 4 MB chunks; downloads streamed; cap product files at 20 MB.
5. **Config:** `PUBLIC_API_URL`, `PUBLIC_SITE_URL`, `TRUSTED_ORIGINS`,
   `VITE_API_BASE_URL` as today; secrets in Netlify's environment settings.
   `api.desknoty.com` as a Netlify custom domain (free HTTPS).
6. **Tests:** run `npm run test:seller`, `npm run test:api` and
   `npm run test:e2e:seller` against the new storage layer before switching.

## Keeping the data

`npx tsx scripts/backup-data.ts` writes a consistent copy of the database
(SQLite online backup, integrity-checked) plus all seller files and images.
That copy is imported with `turso db import` and a one-off upload script to
Blobs. The original files are never modified.
