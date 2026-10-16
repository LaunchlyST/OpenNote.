# OpenNote email: what is built, and running your own mail server

OpenNote sends its own email. No third-party email service is used or needed
by the code.

## What OpenNote does itself

| Part | Where | What it does |
|---|---|---|
| Templates | `server/mail/templates.ts` | Branded HTML + plain-text emails for password reset, email verification and a test message. All values escaped. |
| Outbox (queue + log) | `server/mail/outbox.ts`, table `email_outbox` | Auth requests only queue a message, so they never wait on a mail server and response time does not reveal whether an account exists. A worker sends due messages every 5 s. |
| Retries | same | Failures retry at 30 s, 2 min, 8 min, 32 min (capped at 1 h); after `MAIL_MAX_ATTEMPTS` (default 5) the message is marked `failed`. A message caught mid-send by a crash is retried on restart. |
| Link safety | same | The body (which holds the one-time link) is erased as soon as a message is sent or fails for good. The row stays as the log entry. Logs mask addresses (`s***@example.com`) and never print links. Log rows are deleted after 30 days. |
| Rate limiting | same | At most `MAIL_RATE_PER_HOUR` (default 5) emails per address per hour, on top of Better Auth's own request limits. Addresses with line breaks, commas or lists are refused (no header injection). |
| SMTP client | `server/mail/transport.ts` | Connects to any SMTP server. STARTTLS is **required** by default (`SMTP_REQUIRE_TLS`), so a reset link is never sent in clear text by accident. Optional DKIM signing (`DKIM_*`). |
| Local dev inbox | `server/mail/dev-inbox.ts` | Without `SMTP_HOST`, messages are saved to `data/mailbox/` and shown at <http://localhost:5173/api/dev/mail>. Never mounted in production. |
| Local SMTP catcher | `server/mail/smtp-catcher.ts`, `npm run mail:catcher` | A small SMTP server on 127.0.0.1:2525 that accepts mail and drops it in the dev inbox, so the real SMTP path can be tested without any outside service. Loopback only, no relaying. |
| Admin log | `GET /api/admin/mail-log` | Delivery status for administrators. No bodies, no links. |

## Testing locally (nothing leaves your computer)

**Option A — dev inbox (default).** Leave `SMTP_HOST` empty, run `npm run dev`,
trigger "Forgot password", open <http://localhost:5173/api/dev/mail>.

**Option B — real SMTP, to the local catcher.**

```
npm run mail:catcher          # terminal 1
```
`.env`:
```
SMTP_HOST=127.0.0.1
SMTP_PORT=2525
SMTP_REQUIRE_TLS=false        # the catcher is loopback-only and has no TLS
EMAIL_FROM="OpenNote <no-reply@opennote.local>"
```
```
npm run dev                   # terminal 2
npm run mail:test -- you@example.com
```

Both options are **local tests**. They prove OpenNote builds, queues and sends
mail correctly. They do not prove delivery to Gmail, Outlook, etc.

## Ready-made tools

| Command / file | Purpose |
|---|---|
| `npm run mail:dns -- --domain <domain> --ip <server IP>` | Creates the DKIM key (`data/dkim/`, never committed) and prints the exact MX, A, SPF, DKIM, DMARC and PTR records to add. |
| `npm run mail:doctor` | Checks config, DNS (MX/SPF/DKIM/DMARC/PTR, and that the DKIM DNS key matches the private key), the SMTP login with TLS, and whether port 25 is reachable. Sends nothing. |
| `npm run mail:doctor -- --send you@gmail.com` | Same, then sends one real test email. |
| `deploy/mail/` | Docker Compose + config for **Maddy**, an established open-source mail server: TLS-only submission on 587/465 for OpenNote, DKIM signing with the same key, an outbound queue to recipients' MX servers, and an inbox for bounces and DMARC reports. |

The outbox treats a 5xx reply (bad address, policy, authentication) as
permanent and stops; 4xx and network errors are retried with backoff.

## Production safety rules (enforced in code, tested)

- Production never uses the dev inbox or a plaintext connection: with no
  `SMTP_HOST`, with `SMTP_REQUIRE_TLS=false`, or with a non-https
  `BETTER_AUTH_URL`, email is switched **off** and each message is marked
  `failed` in the log — never silently dropped or faked. The server prints
  `EMAIL IS OFF: <reason>` at startup.
- The mail server's TLS certificate is always verified (TLS 1.2+); a
  self-signed or mismatched certificate is refused.

## What real delivery to outside inboxes needs

Code cannot replace these; they are infrastructure and reputation:

1. **A domain you own** (e.g. `opennote.app`). Gmail/Outlook reject or spam
   mail from addresses whose domain you cannot prove you control. Required.
2. **A server that can send on port 25.** Most home internet providers and
   many cloud hosts (AWS, Google Cloud, Azure, DigitalOcean by default) block
   outbound port 25. Pick a VPS that allows it or will unblock it on request.
3. **A static IP with reverse DNS (PTR)** pointing to your mail hostname,
   e.g. `mail.opennote.app`. Set in the VPS provider's panel.
4. **DNS records** for the domain:
   - `MX` → `mail.opennote.app`
   - `A` → the server's IP
   - `SPF`: `TXT "v=spf1 a mx ip4:<server-ip> -all"`
   - `DKIM`: `TXT` at `<selector>._domainkey` with the public key
   - `DMARC`: `TXT` at `_dmarc` → `"v=DMARC1; p=quarantine; rua=mailto:postmaster@opennote.app"`
5. **A mail transfer agent** on that server that queues and delivers to
   recipients' MX servers: Postfix (classic), or Maddy / Stalwart (single
   binary, simpler). OpenNote connects to it like any SMTP server.
6. **A TLS certificate** for `mail.opennote.app` (free from Let's Encrypt).
7. **Warm-up and monitoring.** A new IP starts with no reputation; send low
   volumes first, watch bounces, and check your IP on blocklists
   (e.g. <https://mxtoolbox.com/blacklists.aspx>).

### Bringing up the mail server (on the VPS, with Docker)

1. Point the DNS printed by `npm run mail:dns` at the VPS and set its PTR.
2. Get a certificate: `certbot certonly --standalone -d mail.<domain>`.
3. `cd deploy/mail && cp mail.env.example mail.env` and fill it in.
4. Copy `data/dkim/opennote.private.pem` to the VPS (`DKIM_DIR`).
5. `docker compose --env-file mail.env up -d`
6. Create OpenNote's login: `docker compose exec maddy maddy creds create opennote@<domain>`.
7. Put that login in OpenNote's `.env` (below) and run `npm run mail:doctor -- --send you@gmail.com`,
   then repeat with an Outlook/Hotmail address.

### Connecting OpenNote to your own server

With Postfix/Maddy accepting authenticated submission on port 587:

```
SMTP_HOST=mail.opennote.app
SMTP_PORT=587
SMTP_USER=opennote@opennote.app
SMTP_PASS=<mailbox password>        # .env only, never committed
EMAIL_FROM="OpenNote <no-reply@opennote.app>"
```

Let the MTA do the DKIM signing, or have OpenNote sign directly:

```
openssl genrsa -out data/dkim.private.pem 2048
openssl rsa -in data/dkim.private.pem -pubout          # publish this in DNS
DKIM_DOMAIN=opennote.app
DKIM_SELECTOR=opennote
DKIM_PRIVATE_KEY_PATH=data/dkim.private.pem          # data/ is git-ignored
```

Then `npm run mail:test -- you@gmail.com` and check the inbox. In Gmail,
*Show original* should show `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
