# Free backend hosting for Desknoty

GitHub Pages can only serve static files. Desknoty's accounts, sessions and
calendar data need the Node/Express API in `server/`, so the backend must run
on a host that supports Node.js, Express and persistent disk storage.

## Recommended free option: Oracle Cloud "Always Free"

Oracle Cloud Infrastructure (OCI) offers an **Always Free** tier that includes
a small virtual machine with persistent block storage at £0/month. It is the
best genuinely free fit for this project because:

- Node.js and Express run normally.
- SQLite (`data/opennote.db`) lives on a persistent disk that survives
  restarts and redeploys.
- HTTPS can be added with Caddy or nginx + Let's Encrypt.
- No paid subscription is required for the free tier resources.

Trade-offs:

- Registration requires a credit/debit card for identity verification, but the
  Always Free resources are not charged.
- You are responsible for the VM, firewall, and updates.
- Oracle can reclaim idle Always Free resources, so keep the VM in active use.

### 1. Create the account and VM

1. Sign up at https://www.oracle.com/cloud/free/ .
2. Complete identity verification (card required, not charged for Always Free).
3. Create a Compute instance:
   - Image: Ubuntu 22.04 or 24.04
   - Shape: VM.Standard.E2.1.Micro (Always Free) or VM.Standard.A1.Flex
   - Add your SSH public key.
4. Open networking:
   - Allow inbound TCP 22 (SSH), 80 and 443.
5. Note the public IP address.

### 2. Point DNS at the VM

Create an A record:

- `api.desknoty.com` -> `<VM public IP>`

Keep the existing `desknoty.com` record pointing at GitHub Pages if you want
the frontend to stay on GitHub Pages.

### 3. Install the backend on the VM

```bash
sudo apt update
sudo apt install -y git nodejs npm
sudo npm install -g pm2
git clone https://github.com/LaunchlyST/OpenNote..git opennote
cd opennote
npm ci
npm run build
```

### 4. Configure the environment

Create `/home/ubuntu/opennote/.env`:

```env
NODE_ENV=production
BETTER_AUTH_URL=https://api.desknoty.com
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
DATABASE_PATH=data/opennote.db
API_PORT=3001
TRUSTED_ORIGINS=https://desknoty.com
ADMIN_EMAILS=you@example.com
SMTP_PRESET=gmail
SMTP_USER=you@gmail.com
SMTP_PASS=<16-letter Google app password>
EMAIL_FROM=Desknoty <you@gmail.com>
REQUIRE_EMAIL_VERIFICATION=true
```

Gmail SMTP is free. Create an app password at
https://myaccount.google.com/apppasswords (requires 2-Step Verification).

### 5. Run it persistently

```bash
cd /home/ubuntu/opennote
pm2 start "npm run serve" --name desknoty-api
pm2 save
pm2 startup
```

### 6. Add HTTPS

Install Caddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```caddy
api.desknoty.com {
    reverse_proxy 127.0.0.1:3001
}
```

Then:

```bash
sudo systemctl reload caddy
```

Caddy obtains and renews the Let's Encrypt certificate automatically.

### 7. Connect the frontend on GitHub Pages

In the GitHub repository settings, add a repository variable:

- `VITE_API_BASE_URL` = `https://api.desknoty.com`

Then push to `main` (or re-run the workflow) so the Pages build calls the backend.

### 8. Verify

```bash
curl https://api.desknoty.com/api/auth-config
```

Expected: JSON like `{"google":false,"emailVerificationRequired":true,"emailEnabled":true}`.

Then test signup, verification email, login, calendar save, logout and password reset on https://desknoty.com .

## If you prefer a managed host instead

- Render/Fly/Railway free tiers do **not** provide free persistent disks for SQLite.
- You can still use them if you migrate the database to a free external SQLite-compatible
  service such as Turso, but that requires changing `server/db.ts` and the Better Auth
  adapter and is not done by default.
- For the least change and safest data persistence, use the Oracle Cloud VM above.
