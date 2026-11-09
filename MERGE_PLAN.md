> Historical plan below is superseded by the authorized November 9 merge.
> Both main histories are retained. Conflict resolutions preserve revision-checked
> saves, immutable purchased files, retained purchase ledgers, and verified Pro
> enforcement without blanket grandfathering or a global enforcement bypass.
> Publishing is manual only; this merge and push do not deploy anything.
> The older procedure and rollback instructions below are historical, not current instructions.

# Merge plan: `seller-studio-completion` → `main`

Status: **not merged, not deployed.** Needs the owner's explicit approval.

## What differs

- `main` (`dc55b9d`) is an ancestor of `migration/supabase` (`8b2d19d`) and of
  `seller-studio-completion`. There are **no conflicts**: the merge is a
  fast-forward (checked with `git merge-tree origin/main HEAD`).
- Changes are Seller Studio and purchase-flow only: `server/seller.ts`,
  `server/auth.ts` (account-deletion guard), `server/index.ts` (JSON parser skips
  product-file uploads), `server/mail/outbox.ts` (receipts not rate limited),
  `src/projects/seller/*`, `src/store/PublicStore.tsx`, `scripts/seller-smoke.ts`.
- The owner's uncommitted work in their own `opennote` folder is **not** part of
  this branch and must be committed separately by them first.

## Behaviour changes that matter on deploy

1. **Seller API needs Pro + a verified email.** Every store that exists when
   the new server first starts is grandfathered (table `seller_grandfathered`,
   flag `site_settings.seller-enforcement-v1`). New sellers need Pro + a
   verified email, which needs working SMTP (`SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`). Deploy SMTP first.
2. Accounts with paid orders can no longer be deleted.
3. The schema change is additive only (one new table). No column or row is
   altered or dropped.

## Procedure (owner approval required for each deploy step)

1. Back up: `npx tsx scripts/backup-data.ts` locally (writes outside Git, verifies integrity), and in Supabase
   *Database → Backups* is not available on Free, so export with
   `pg_dump` (or the dashboard's SQL "Download CSV" for each seller table).
2. On the owner's PC, commit their own pending work to `main` first
   (`npm run sync:push -- "…"`), so nothing is mixed in.
3. `git checkout main`, `npm run sync:pull`,
   `git merge --ff-only origin/seller-studio-completion` (or a merge commit if
   `main` moved), then `npm run build`, `npm test`, `npm run test:deploy`,
   `npm run test:seller`.
4. Push with `npm run sync:push -- "Merge seller-studio-completion"`. This
   redeploys desknoty.com (GitHub Pages).
5. Redeploy the API: `scripts/deploy-supabase.sh mrcnonqrgrumxyvgpfqr`.
6. Verify: `node scripts/hosted-check.mjs https://mrcnonqrgrumxyvgpfqr.supabase.co/functions/v1`
   (expects Pro + verified test accounts) and open Seller Studio on desknoty.com.

## Rollback

- **Fastest (no redeploy of the site):** set the Edge Function secret
  `SELLER_ENFORCE=off` and redeploy the function: the Pro/verified rule is
  skipped for everyone; nothing else changes.
- **Code rollback:** `git revert --no-edit <merge-commit>` on `main`, then
  `npm run sync:push -- "Revert seller-studio-completion"` and
  `scripts/deploy-supabase.sh mrcnonqrgrumxyvgpfqr`. No force-push, no reset.
- **Data:** the only new data is `seller_grandfathered` and one
  `site_settings` row; leaving them in place after a revert is harmless.
  Orders, stores, products and files are never modified by this change.
