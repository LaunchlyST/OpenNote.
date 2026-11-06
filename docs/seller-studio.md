# Seller Studio: setup and how it works

Seller Studio lets a Desknoty Pro user open a store at `/store/<handle>`, build
its page from blocks, sell digital downloads, and get paid through Stripe.
Buyers need no Desknoty account.

## What runs where

| Piece | Where |
|---|---|
| Store, draft page, published page, products, orders | SQLite (`DATABASE_PATH`), tables `seller_*` |
| Product files (private) | `SELLER_FILES_DIR`, only served through signed 24-hour links for paid orders |
| Store images (public) | `SELLER_MEDIA_DIR`, served at `/api/store-media/<id>` |
| Payments | Stripe Checkout, as **direct charges on the seller's connected account** |
| Payouts | Stripe Connect Express, Stripe-hosted onboarding |
| Receipts | Desknoty's email outbox (`order-receipt`) |
| TikTok (optional) | Login Kit for Web, server-side callback with a one-time state |

Desknoty's platform fee is 0%: no `application_fee_amount` is set. Stripe's
processing fee is charged by Stripe to the seller's account on each payment.

## Production prerequisites

1. **A running Desknoty API.** desknoty.com is a static site on GitHub Pages
   and has no backend today. Host `server/` (see docs/free-backend-hosting.md),
   then build the frontend with `VITE_API_BASE_URL=https://<api host>` and set
   `TRUSTED_ORIGINS=https://desknoty.com` and `PUBLIC_API_URL` on the server.
   Until then Seller Studio shows "Seller Studio needs the Desknoty server" and
   store links show "Store not found".
2. **Stripe keys.** Turn on Connect in the Stripe dashboard (Express accounts),
   set `STRIPE_SECRET_KEY` (test mode first).
3. **Webhook.** Stripe → Developers → Webhooks → add an endpoint *listening to
   connected accounts* at `<PUBLIC_API_URL>/api/stripe/webhook` with the events
   in `.env.example`; set `STRIPE_WEBHOOK_SECRET` to its signing secret.
   Locally: `stripe listen --forward-connect-to localhost:3001/api/stripe/webhook`.
4. **File storage.** `SELLER_FILES_DIR` and `SELLER_MEDIA_DIR` must be on a
   persistent disk that is backed up. (Object storage such as S3/R2 is not
   wired in yet.)
5. **Email.** Configure SMTP (docs/self-hosted-email.md) so receipts reach
   buyers. Without it, production marks receipts failed; the download still
   shows on the confirmation page.
6. **TikTok (optional).** Create an app at developers.tiktok.com with Login Kit,
   scopes `user.info.basic` and `user.info.profile`, register the redirect URI
   above, set `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`. Without them the
   TikTok step says it isn't switched on and "Continue without TikTok" works.
7. **Custom domains / subdomains** are not offered: they need DNS, TLS and
   routing on the hosting first.

## Flow

- **Start your store** claims a unique handle (`/api/seller/store`). Optional
  Connect TikTok, or Continue without TikTok.
- **Page**: blocks (profile header, text, image, links, featured product,
  product grid, FAQ, footer). Insert above/below any block, drag to reorder,
  move up/down, duplicate, hide, delete. Product blocks list exactly the
  products the seller picks. Edits autosave to the draft; **Publish** copies
  the draft page and every complete product to the live store. The live store
  keeps the last published version until the next Publish.
- **Products**: title, description, cover, price (min 0.50), currency, private
  file. Each published product has its own URL `/store/<handle>/p/<id>`.
- **Payouts**: Not connected → Setup incomplete → Verification pending → Ready
  for payouts, read from the Stripe account (and `account.updated`). Buy now is
  enabled only when the account has `charges_enabled` and an active
  `card_payments` capability.
- **Checkout**: the server creates the session from the *published* price on the
  seller's connected account. The webhook (signature checked, each event id
  handled once) or the return page confirms payment; fulfilment marks the order
  paid and queues one receipt, however many times it runs. Cancelled, expired
  and failed payments never unlock the file.

## Tests

```sh
npm run test:seller        # API, against scripts/fake-stripe.ts
npm run build && npm run test:e2e:seller   # browser, mobile buyer included
```

Both use a local Stripe stand-in, not Stripe's test mode. Run the flow once in
real Stripe test mode (test card 4242 4242 4242 4242) before going live.
