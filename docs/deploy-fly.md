# Deploy the Desknoty API to Fly.io

The frontend stays on GitHub Pages (desknoty.com). The Express API, its SQLite
database and the seller files run on one small always-on Fly Machine with a
persistent volume, at `https://api.desknoty.com`.

Cost (Fly's published prices, November 2026): shared-cpu-1x / 512 MB running
all month ≈ $3.69, plus a 1 GB volume $0.15 ≈ **$3.84/month**. HTTPS on the
shared IPv4/IPv6 addresses has no separate charge. Fly bills a card on file,
pay as you go; there is no free plan for new organizations.

Everything below is run on **your** computer. Secrets are typed into hidden
prompts and go straight to Fly; they never appear in Git, chat or logs.

## 1. Account and CLI (one time)

```sh
curl -L https://fly.io/install.sh | sh     # macOS/Linux; Windows: iwr https://fly.io/install.ps1 -useb | iex
fly auth signup                             # or: fly auth login
```

Add a card when Fly asks (Dashboard → Billing). Nothing is charged until the
Machine runs.

## 2. Create the app and its volume

From the repository folder (the one with `fly.toml`):

```sh
fly apps create desknoty-api
fly volumes create desknoty_data --app desknoty-api --region lhr --size 1
```

Answer **yes** if Fly warns that a single volume has no replica: Desknoty
uses one SQLite file, and daily volume snapshots (kept 14 days, `fly.toml`)
are the backup.

## 3. Secrets (hidden prompts)

```sh
# Session signing key, generated on your machine:
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" | fly secrets import --app desknoty-api --stage

# Stripe Sandbox secret key (sk_test_…): typed, not shown.
read -rsp 'Stripe sk_test key: ' K; echo; printf 'STRIPE_SECRET_KEY=%s\n' "$K" | fly secrets import --app desknoty-api --stage; unset K

# Receipt email through Gmail: your address and a Google app password
# (myaccount.google.com/apppasswords, needs 2-Step Verification).
read -rp 'Gmail address: ' G; read -rsp 'Gmail app password: ' P; echo
printf 'SMTP_PRESET=gmail\nSMTP_USER=%s\nSMTP_PASS=%s\nADMIN_EMAILS=%s\n' "$G" "$P" "$G" | fly secrets import --app desknoty-api --stage; unset P
```

## 4. Deploy

```sh
fly deploy --app desknoty-api
curl https://desknoty-api.fly.dev/api/auth-config     # expect JSON
```

## 5. HTTPS on api.desknoty.com

```sh
fly certs add api.desknoty.com --app desknoty-api
```

At your DNS provider add **CNAME `api` → `desknoty-api.fly.dev`**, then
`fly certs check api.desknoty.com --app desknoty-api` until it says *Ready*.

## 6. Point the website at the API

GitHub → repository **Settings → Secrets and variables → Actions → Variables →
New repository variable**: `VITE_API_BASE_URL` = `https://api.desknoty.com`.
Then **Actions → Deploy to GitHub Pages → Run workflow**.

## 7. Stripe Sandbox webhook

Stripe Dashboard (Sandbox) → **Developers → Webhooks → Add destination** →
**Connected accounts** → endpoint `https://api.desknoty.com/api/stripe/webhook`
→ events `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`,
`account.updated`. Copy its signing secret, then:

```sh
read -rsp 'Webhook whsec: ' W; echo; printf 'STRIPE_WEBHOOK_SECRET=%s\n' "$W" | fly secrets import --app desknoty-api; unset W
```

(`fly secrets import` without `--stage` restarts the Machine with the new value.)

## Backups and data

- `/data` holds `opennote.db`, `seller-files/` (private), `seller-media/` and
  the mail log. It is a volume: restarts and deploys keep it. It is outside
  `dist/`, so nothing in it is served as a static file.
- Daily snapshots: `fly volumes snapshots list desknoty_data --app desknoty-api`.
- Off-site copy any time:
  `fly ssh sftp get /data/opennote.db ./opennote-backup.db --app desknoty-api`.
