# Desknoty production database permissions fix — report

## Summary
Applied migration `supabase/migrations/20261118000000_revoke_client_table_access.sql`
to the production Supabase project `mrcnonqrgrumxyvgpfqr` (desknoty-test).
Removed all direct client-role (`anon`, `authenticated`) access to server-owned
tables and enabled row-level security on every public table. Backend (postgres /
service_role) access is unchanged.

## What changed in production
- Revoked ALL privileges from `anon` and `authenticated` on all 30 public tables
  (account, session, user, workspace, seller_order, seller_store, seller_product,
  seller_review, seller_review_report, user_preferences, stripe_event, verification,
  waitlist, site_settings, and 16 others).
- Enabled RLS on all 30 public tables (defense in depth; no policies added, so
  anon/authenticated get nothing by default; postgres owner and service_role bypass RLS).
- Revoked default privileges for `postgres` (and documented supabase_admin defaults,
  which cannot be altered by the migration role) so future objects are not
  auto-granted to client roles.
- Backend connectivity verified post-migration: API `/api/.../launch/status` → 200.

## Checks passed
- Migration applied successfully via `supabase db push --remote --yes` (run completed).
- Post-migration verification:
  - 30/30 public tables have RLS enabled.
  - 0/30 public tables grant any privilege to `anon`.
  - `account`, `session`, `user`, `workspace`, `seller_order`, `seller_store`,
    `user_preferences` ACL now = `{postgres=arwdDxtm, service_role=arwdDxtm}` only.
- Backend (postgres role) retains full access; service_role retains full access.
- API health check: 200.

## Access logs — what they can establish
- `auth.audit_log_entries` (Supabase Auth audit log): **0 rows** — empty.
  Desknoty uses Better Auth (not Supabase Auth), so Supabase Auth audit logs are
  never populated. No Supabase-Auth-level access trail exists.
- No application-level access logging exists in `server/` (no audit middleware,
  no request log). There is no record of which rows were read/written by client
  roles before this fix.
- **Gap:** Earlier access by `anon`/`authenticated` to server-owned tables cannot
  be established from available logs. The logs are incomplete/absent. The fix
  prevents future client-role access; it cannot retroactively prove or disprove
  prior access. (Postgres `pg_stat_statements` may retain aggregate query
  statistics but not per-user row access and is not enabled/queried here.)

## Test-account verification (pending)
- A designated test account is required to verify sign-in, private notes, seller
  preview, and an authorized download against production. The migration keeps
  backend (postgres) access intact, so these flows are expected to work; the
  user should run them with a test account. If any fail, the migration is
  reversible via the commented DOWN block in the migration file.

## Scope notes
- Homepage proxy and DNS change: separate approval, not touched.
- PR #1 and the dependency advisory: tracked separately, not touched here.
- Frontend release (PR #1) is independent; this DB fix was applied directly to
  production and does not block or depend on it.
EOF
