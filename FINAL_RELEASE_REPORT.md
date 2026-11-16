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

## 8. Follow-up fix (2026-11-15): “Back to the store” after a review

After submitting a review on an order page, the “Back to the store” link now uses
the order’s current published store handle (`order.storeHandle`) instead of only
the handle from the URL, so a stale receipt/thanks link lands on the live store
rather than a 404 (“This page doesn’t exist”).

- Changed: `src/store/PublicStore.tsx` — `OrderStatus` computes
  `const back = order?.storeHandle ? `/${order.storeHandle}` : `/${handle}``.
- Verified live: the freshly deployed frontend bundle (run `43706719953`, completed
  success) contains the new `?.storeHandle` logic in the live
  `PublicStore-B-F_KyJH.js` chunk.
- Verified live: the saved review appears publicly via
  `GET /api/store/x--x039/products/prd_4fa03ef1c2370c9aa6f7/reviews` — it is
  returned as visible/verified (`rev_10da1a69d670468ab472`, 5★, “I love it”,
  created 2026-11-15T10:51:41Z, edited).
- Deployed: frontend Pages workflow run `43706719953` → success; commit
  `d732d60` “Store: send the order page's Back to the store to the order's current store”
  pushed (`d6fa6c5..d732d60 main -> main`).
- API redeployed for this fix: not needed (frontend-only change); the live API was
  already serving the built-in-validation build and the public reviews endpoint.

## 8. Follow-up fix (2026-11-15): “Back to the store” after a review

After submitting a review on an order page, the “Back to the store” link now uses
the order’s current published store handle (`order.storeHandle`) instead of only
the handle from the URL, so a stale receipt/thanks link lands on the live store
rather than a 404 (“This page doesn’t exist”).

- Changed: `src/store/PublicStore.tsx` — `OrderStatus` computes
  `const back = order?.storeHandle ? `/${order.storeHandle}` : `/${handle}`.
- Verified live: the freshly deployed frontend bundle (run `43706719953`, completed
  success) contains the new `?.storeHandle` logic in the live
  `PublicStore-B-F_KyJH.js` chunk.
- Verified live: the saved review appears publicly via
  `GET /api/store/x--x039/products/prd_4fa03ef1c2370c9aa6f7/reviews` — it is
  returned as visible/verified (`rev_10da1a69d670468ab472`, 5★, “I love it”,
  created 2026-11-15T10:51:41Z, edited).
- Deployed: frontend Pages workflow run `43706719953` → success; commit
  `d732d60` “Store: send the order page's Back to the store to the order's current store”
  pushed (`d6fa6c5..d732d60 main -> main`).
- API redeployed for this fix: not needed (frontend-only change); the live API was
  already serving the built-in-validation build and the public reviews endpoint.

## 9. Redesign (2026-11-15): order / download page layout

Redesigned the paid-order page (`OrderStatus` in `src/store/PublicStore.tsx`) per
the attached screenshots/spec:

- Two-column layout (desktop): left column = product cover, product name and
  description; right column = download card (top) + feedback card (bottom).
- Download card: small green success icon + heading “Your download is ready”;
  “Download file” button (download icon) — filename and expiry shown separately,
  not inside the button; secondary actions “Save purchase link” and “Resend
  download email”; secure expiry/retrieval info preserved.
- Feedback: compact two-step — “How was your experience with this product?” with
  five labelled 1–5 star buttons (accessible description), then, after choosing a
  rating, the optional comment + name + submit (“Post review” / “Update review”);
  success “Thanks! Your review is live.”.
- Public feedback wording added (“This feedback is public and will be shown on the
  product as a verified buyer review.”).
- Order API now returns the product `cover` and `description` for this layout.
- Back-to-store link kept, still pointing at the order’s current store handle.

Verified: `npx tsc -b`, `npm test`, `npm run test:deploy`, `npm run test:email-check`,
`npm run test:seller`, `npx oxlint` (clean), `npm run build` all pass; playwright
(e2e-store-v2) not runnable here (playwright not installed) — e2e expectations were
updated to the new copy.

## 10. Layout fix (2026-11-15): download upper-left, feedback lower-right

Following the latest design feedback (red-circle placement guidance), the paid-order
page was restructured:

- The complete download section now lives in the **upper-left**: success icon,
  “Your download is ready”, product information (cover/name/description — grouped
  with the download), “Payment confirmed · …” for paid orders, “Download file” button
  (download icon, filename/expiry kept out of the button), expiry/purchase-link info,
  “Save purchase link” + “Resend download email”.
- The complete feedback form now lives in the **lower-right** of the same grid
  (review card bottom-aligned to the download column).
- The duplicate centred success icon + heading (`.ps-order-head`) was removed — the
  download card now owns the single success icon + heading.
- The page is no longer squeezed into the narrow storefront column: the order page
  widens its container via `.ps-main:has(> .ps-order)` (max-width 1080px) and the grid
  is a spacious two-column layout (7fr/5fr, 28px gap, comfortable card padding).
- Mobile: single-column stack, download first then review; no horizontal overflow.

Verified: `npx tsc -b`, `npm test`, `npm run test:deploy`, `npm run test:email-check`,
`npm run test:seller`, `npx oxlint` (no new issues), `npm run build` all pass.

DOM-verified in the browser on a paid dev order:
- download card at upper-left (x≈20, y≈60), feedback card lower-right (y≈666, bottom-aligned) ✓
- no horizontal overflow (scrollWidth == clientWidth) ✓
- “Back to the store” visible below ✓
- deployed frontend bundle markers confirmed live (run `43712799055` success): `ps-order-download`, `ps-order-review`, `ps-order-grid`, `ps-order-cover`, `ps-success`, `ps-download-card`, `ps-review-card`, `Save purchase link`, `Back to the store` all present; no Kickbox.

Next: visual sign-off on desktop + mobile, then live order-page check after deploy.

## 11. Seller-section audit (2026-11-16): autosave, coupon scope, affiliate, refunds

Commit `bf616b7` (“Seller Studio: fix stuck autosave, coupon scope, affiliate rules and
refund hold”) carries the fixes; this pass re-verified each one by running the suites
and by probing production with controlled test data (no charges, no refunds).

### Confirmed and fixed

| Finding | Evidence | Fix | Live check |
| --- | --- | --- | --- |
| Autosave stuck after refresh/interruption (“changed elsewhere”) | `server/seller.ts` refused any save whose `revision` was behind the server | Draft and product saves now carry a **writer token**; the server remembers the last writer (`seller_store.draftToken`, `seller_product.lastToken`), so a save whose reply was lost is accepted, while a genuine edit from elsewhere still gets `409`. The editors offer “Take the newer version”. | **Live:** first save `200`, replay with the same token at the stale revision `200`, another editor’s token `409` (“This page changed elsewhere…”) — draft content unchanged |
| Product-restricted coupon could become store-wide | coupon PATCH filtered invalid ids to an empty list and wrote `productIds = null` (whole store) | A code limited to products is **refused** when none of the chosen products is left | **Live:** `POST /api/seller/coupons` with a non-existent product → `400` “None of the products you chose is in your store any more.” and no code created |
| Editing after Unarchive failed (stale revision) | Archive/Unarchive sent `product.revision` from the render, not the queue | Archive/Unarchive now uses the queue’s own revision + token, and the response refreshes the editor | **Live:** archive `200` → unarchive `200` → edit `200`, title changed |
| Product duplication lost the free sample | duplicate INSERT did not copy `sampleFileId`/`sampleName`/`sampleSize` | The copy keeps the sample association; the paid file stays private behind the download gate | **Live:** duplicate `201` with sample `zz-sample.pdf`; public sample endpoint serves the sample bytes (not the paid file) — local test publishes the copy and asserts the bytes |
| Outdated payments/seller browser tests | assertions predated the store-page panel, the order-page “Download file” link and the new save flow | assertions updated to the intended behaviour (not weakened) | `npm run test:payments`, `npm run test:e2e:seller`, `npm run test:e2e:store` all pass |
| Affiliate text unbounded; affiliate products needed a file | `cleanExtras` trimmed but did not bound affiliate text; `productProblem` demanded a file | affiliate title ≤ 80, description/disclosure ≤ 500 chars, and an affiliate product needs no file to publish | **Live:** patch with 200/900/900-char text → stored 80/500/500, `problem: null`, no file id |
| Free claims could claim an affiliate product | claim and free-checkout paths did not exclude affiliate products | affiliate products are refused for free claims and free checkout (`409`) | local regression test (no live affiliate product is published, so not exercised in production) |
| Failed Stripe/PayPal checkout kept the coupon reserved | the order stayed `pending` with the code reserved for 24h | the order is cancelled and the code released immediately, and the buyer can retry | local test with the Stripe stand-in (`502`, code free again, retry succeeds) |
| Undo after switching store styles switched the style | undo restored a page snapshot that carried the old `use` | undo/redo always keep the current `style2`/`use` | browser test in `scripts/e2e-seller.ts` passes |
| Store images vs private files | `/api/store-media/:id` served any stored blob | only `med_` ids are served; paid files (`fil_`) and samples (`smp_`) are unreachable | **Live:** `fil_…` → `404`, `smp_…` → `404` |

### Left as-is on purpose (policy, not a defect)

- **Partial refunds** revoke every download and take the whole sale out of earnings.
  The access policy is asserted by an existing test (“partial refund revokes access and
  late payment cannot restore it”), and `/api/seller/earnings` counts only orders with
  `refunded = 0`, so a refunded sale is not counted. That is one consistent policy
  (“any refund reverses the sale”), but the intended policy was not stated anywhere, so
  it was **not** changed — flagged for the owner.

### Deployment

- Frontend: Pages workflow run `43741871304` (head `bf616b7`) → success.
- API: rebuilt with the deno bundle + esbuild recipe and deployed to
  `mrcnonqrgrumxyvgpfqr` (bundle 3,025,680 bytes). `migrateSeller()` adds
  `draftToken` / `lastToken` to existing tables on boot.
- Production checks above were run against the deployed API with temporary test
  products, which were deleted again (the live draft and published page were left
  untouched: the live draft still differs from the published page, and nothing was
  published).

### Browser coverage (local, Playwright)

- `npm run test:e2e:seller` — all checks passed (store front-to-back: sign-in, publish,
  checkout, download, receipt, refunds, second seller).
- `npm run test:e2e:store` — all checks passed (storefront, free claim, reviews, codes).
- `npm run test:e2e:studio` — all checks passed, including the new regression checks on
  desktop **and** mobile: “an edit interrupted by a refresh is kept”, “saving after a
  refresh is not refused as ‘changed elsewhere’”, “saving after a lost reply is not
  refused as ‘changed elsewhere’”, “undo does not switch the store’s style back”,
  “editing after Unarchive is saved”.
- `npm run test:seller`, `test:seller-save`, `test:payments`, `test:deploy`,
  `test:email-check`, `npm test` — all pass.

### Live UI check of the conflict path (production)

In the live Seller Studio, with a temporary product:

1. Another editor moved the product on (a save with a different writer token) → `200`.
2. Typing in the studio did **not** overwrite it — the server kept the other editor’s
   title, the studio showed “This product changed somewhere else, so it was not
   overwritten. Your edits are still here.”, the “Take the newer version” button was
   offered, and the typed text was still on screen.
3. “Take the newer version” adopted the server’s version and cleared the notice.
4. The temporary product was deleted; the live store is back to its two original
   products and nothing was published.

## 12. Seller Studio: clicking a product opens its editing page (2026-11-16)

**Confirmed bug (reproduced on the live site):** clicking a product card in the
Studio’s phone preview opened the small “Editing card” part panel (Cover / Title /
Description / Button / Card background) instead of the product’s editing page. The
click-to-edit feature added in `712f9bb` had taken over the card click.

**Fix** (`src/projects/seller/SellerStudio.tsx`):
- A click on a product card in the preview now opens that product’s editing page
  (Products tab, that product’s editor) — the same route the “All product settings”
  button already used.
- The card-part editor is still reachable: the product editor has a **“Card look”**
  button that opens the part panel for that product; while it is open, clicking a
  part in the preview moves the panel to that part.
- The preview only draws part outlines while the panel is open, and product cards in
  the preview show a pointer cursor (`src/index.css`).

**Regression test** (`scripts/seller-e2e.ts`): clicking the product in the preview
opens its editing page and does **not** open the card-part panel — on desktop and
mobile. `npm run test:e2e:studio` passes, along with `tsc -b`, `npm run build`,
`npm test` and `npm run test:deploy`.

**Deployment:** commit `e4f8aa9` pushed; frontend Pages workflow dispatched.

### Follow-up (commit `39b495d`): the Page column, and every product click

The Page column had grown two rows with the multi-page feature — a “Home / Page 2”
switcher and a strip of product tiles — and the block list was pushed down. Those
rows are gone; the column is back to **“Add block” + the block list**, so the
content moves up again. A compact **“+ Page 2”** button sits beside “Add block” so
new pages can still be created (the phone preview carries the Home/Page 2 tabs, as
the public store does).

Clicking a product is now the same everywhere on the card — cover, title,
description or button all open that product’s **editing page**; the card-part
panel is only reachable through the new “Card look” button in the product editor.
The whole product shows the pointer cursor in the editor preview.

**Verified live (production Studio):** the page switcher row and the product-tile
row are gone (0 elements), the column starts with “Add block” + “Page 2”, the
card, title and description all report `cursor: pointer`, and clicking the title
opened the product editor (Products tab selected, editor open, no card-part
panel). `npm run test:e2e:studio` passes on desktop and mobile, with
`tsc -b`, `npm run build`, `npm test`, `npm run test:deploy` and
`npm run test:seller` green.

**Deployment:** commit `39b495d` pushed; frontend Pages workflow run `43946498630`
→ success.

## 13. Seller Studio: focused card-element edits, full font library, page hide (2026-11-16)

Three follow-ups to the click-to-edit work, finished this session:

1. **Focused settings per clicked element.** Clicking a product card in the owner’s
   phone preview now opens the product’s **editing page** when the click lands on the
   card background, and the focused element’s settings (image / title / description /
   button / card background) when it lands on an element — the click carries the part.
   The focused panel lives in the Products tab (`focus` / `onFocus` on `ProductsEditor`);
   “All product settings” switches back to the complete editor.

2. **The font library is now the full CapCut-style picker everywhere.** The store-theme
   font (Theme editor) and the block font (floating editor) are buttons that open the
   searchable, category-grouped `FontPicker` (all curated Google fonts + store theme) —
   no more three-option selects. The server accepts any catalog font id
   (`TEXT_FONT_IDS`) for theme and block looks.

3. **Hide a store page.** Double-tapping a page tab under the store banner in the phone
   preview (Home / Page 2 / Page 3) hides that page; the tab row and the content drop it.
   The **“Add page”** button next to “Add block” creates and selects the next page, so the
   page you hid is followed by a page that appears.

**Verified:** `npm run test:e2e:studio` passes on desktop and mobile — clicking a card
element (title) opens the focused settings, clicking the product opens the editing page;
`tsc -b`, `npm run build`, `npm test`, `npm run test:deploy` and `npm run test:seller` green.

**Deployment:** commit `27a94b1` pushed; frontend Pages workflow run `202`
(head `27a94b1`) → success, and the live bundle at `desknoty.com` serves this
build (new markers present: focused part labels, full font picker, hidden pages).

**Deployment (carousel rework):** commit `5a73c08` pushed; frontend Pages workflow
run `204` (head `5a73c08`) → success, and the live bundle at `desknoty.com`
serves this build (new markers present: `Add product below`, `Add product slide`,
`Placement`, `hiddenPages`).

