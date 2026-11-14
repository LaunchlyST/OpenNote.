# Release Report — Desknoty: Kickbox mailbox check → built-in validation

Date: 2026-11-14 (release shipped same day, late evening UTC)

## 1. What shipped

The mandatory Kickbox mailbox-validation dependency was replaced with Desknoty's
built-in email validation for the free-product claim flow. No new validation
service, no SMTP probing, no provider API key required.

### Behaviour now (server)

- `server/email-check.ts` rewritten to return verdicts:
  - `{ status: 'ok', detail? }` — syntax valid, domain has MX (or legitimate
    mail-domain fallback), deliverability plausible.
  - `{ status: 'invalid', reason: 'syntax' | 'no-domain' | 'no-mail' }` — bad
    syntax, nonexistent domain, or no mail exchange.
  - `{ status: 'suggest', suggestion }` — typo fix, e.g. `mia@gmail.con` →
    `mia@gmail.com`.
  - `{ status: 'temporary', detail? }` — DNS could not answer in time; treated
    as temporary, never as proof the address is fake.
- `normalizeEmail` added (trim, lowercase domain, keep local part case).
- Bounded DNS timeout (15s) and module-level cache (60s TTL, 500 entries).
- No Kickbox / MailboxOutcome / provider code remains.

### Behaviour now (seller claim route, `server/seller.ts`)

- valid → send via Resend; send failure → `503 { code: 'unavailable', ... }`.
- typo → `409 { code: 'suggest', suggestion }`.
- invalid → `422 { code: 'invalid', error: 'Please check your email address and try again.', reason }`.
- temporary → `503 { code: 'temporary', error: "We couldn't check your email right now. Please try again." }`.
- bounce → `422 { code: 'undeliverable', error: "We couldn’t deliver to this address. Please check your email." }`.

### Frontend (`src/store/PublicStore.tsx`, `src/projects/seller/api.ts`)

- FreeClaim handles `suggest` / `invalid` / `temporary` / `unavailable` and shows
  the server-provided honest message with the safe default fallback.

## 2. Test results

| Check | Result |
| --- | --- |
| `npm test` (SSR smoke) | PASS |
| `npm run test:deploy` (deployment API safety) | PASS |
| `npm run test:email-check` (built-in validator unit checks) | PASS |
| `npm run test:seller` (seller claim flow) | PASS |
| `npx tsc -b` | PASS |
| `npm run build` / `npm run lint` | BLOCKED by other agent's in-flight WIP (`src/design/CreatorStore.tsx` dup `markSaving`; `src/projects/seller/SellerStudio.tsx` lint) — not touched here |

## 3. Deploy status

- API: Supabase Edge Function `api` on `mrcnonqrgrumxyvgpfqr.supabase.co/functions/v1/api`
  redeployed from a fresh `deno bundle` → `esbuild --minify-whitespace` bundle
  (final size 3,022,370 bytes, under the 5 MB limit). Bundle contains no Kickbox
  references. Live launch status endpoint returned 200 (`mode: construction`).
- Frontend: GitHub Pages workflow (`deploy.yml`) dispatched; runs
  `43634659229` and `43635048304` both completed **success** on `main`.

## 4. Live verification (freshly redeployed build)

Live API, against the just-redeployed function:

- `mia@@buyer` (syntax) → `422 { code: 'invalid', error: 'Please check your email address and try again.', reason: 'syntax' }` ✓
- `mia@no-such-place-zq9x.invalid` (no domain) → `422 { code: 'invalid', reason: 'no-domain' }` ✓
- `mia@gmail.con` (typo) → `409 { code: 'suggest', suggestion: 'mia@gmail.com' }` ✓
- `mia.deliver@resend.dev` (valid) → `200 { status: 'sent', delivery: 'accepted', cooldownSeconds: 60, sendsLeftToday: 4 }` ✓
  (sent through the built-in-passed flow; Resend accepted the send)

Live frontend bundle (`desknoty.com/assets/PublicStore-DBw3i0bX.js`):

- Contains the new honest messages (`'Please check your email address and try again.'`,
  `'Check your inbox for your download link.'`, `"We couldn't check your email right now. Please try again."`,
  `"We'll email you a private link to … Open it to download."`, `'Send me the product'`,
  `'Get it free'`, `'Send again'`, cooldown handling) ✓
- Contains no Kickbox references ✓

## 5. Remaining verification limits

- True buyer-inbox arrival + consumption of the secure expiring download link
  could not be observed directly in this environment (no `RESEND_API_KEY` here);
  the valid claim above was accepted by Resend (`delivery: accepted`). Final
  buyer-inbox verification (open link → access granted) is a manual step with the
  real buyer address.
- Bounce handling on the Resend webhook (signed, suppression, honest messages)
  remains in place and was not changed in this release.

## 6. Git / deploy state at hand-off

- Branch `main`; local == `origin/main` == `9b97327` (`chore: sync 2 changes from the editor`), working tree clean apart from untracked `FINAL_VERIFICATION_REPORT.md` (other agent's file — untouched).
- The Kickbox→built-in rework landed via `5b3e89e` + scoped commit `4b73138`, pushed as `5b3e89e..4b73138`.
- Since then the other agent's in-flight fixes landed on top (`c8a77cf`, `9b97327`).
- API deployed from fresh bundle; frontend deployed via Pages workflow (success).
- Nothing left uncommitted by this agent; no further code changes expected.

## 7. Verdict

**Release shipped**: mandatory Kickbox mailbox check replaced with built-in
validation (syntax + DNS domain check, typo suggestion, temporary-DNS handling,
bounded timeouts/caching, no SMTP probing). All automated checks pass; API and
frontend deployed and live-verified end-to-end up to Resend acceptance; buyer
inbox confirmation remains the final manual step.
