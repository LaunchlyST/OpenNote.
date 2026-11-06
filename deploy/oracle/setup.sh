#!/usr/bin/env bash
# Desknoty server setup for a fresh Ubuntu VM (Oracle Cloud Always Free).
#
# Run on the VM:
#   curl -fsSL https://raw.githubusercontent.com/LaunchlyST/OpenNote./main/deploy/oracle/setup.sh | bash
#
# It installs Node 22, Caddy (automatic HTTPS) and pm2, downloads Desknoty,
# asks for the few settings only you know, and starts the API on
# https://api.desknoty.com. Safe to run again: it updates and restarts.
set -euo pipefail

DOMAIN="${DOMAIN:-api.desknoty.com}"
SITE="${SITE:-https://desknoty.com}"
DIR="$HOME/desknoty"

echo "==> Installing system packages"
sudo apt-get update -y
sudo apt-get install -y git curl debian-keyring debian-archive-keyring apt-transport-https build-essential
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y caddy
fi

echo "==> Opening ports 80 and 443 in the VM firewall"
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo sh -c 'command -v netfilter-persistent >/dev/null && netfilter-persistent save' || true

echo "==> Downloading Desknoty"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone https://github.com/LaunchlyST/OpenNote..git "$DIR"; fi
cd "$DIR"
npm ci
npm run build

if [ ! -f .env ]; then
  echo "==> First run: a few settings (stored only on this server, in $DIR/.env)"
  read -rp "Your Gmail address (sends the emails): " GMAIL </dev/tty
  read -rsp "Gmail app password (16 letters, from myaccount.google.com/apppasswords): " GPASS </dev/tty; echo
  read -rp "Who may create an account (comma-separated emails): " ALLOW </dev/tty
  read -rsp "Stripe secret key (sk_test_… for the test run; leave empty to add later): " STRIPE_KEY </dev/tty; echo
  read -rsp "Stripe webhook signing secret (whsec_…; leave empty to add later): " STRIPE_WHSEC </dev/tty; echo
  cat > .env <<ENV
NODE_ENV=production
BETTER_AUTH_URL=https://$DOMAIN
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
DATABASE_PATH=data/opennote.db
API_PORT=3001
TRUSTED_ORIGINS=$SITE
ADMIN_EMAILS=$GMAIL
SMTP_PRESET=gmail
SMTP_USER=$GMAIL
SMTP_PASS=$GPASS
WAITLIST_NOTIFY_EMAIL=$GMAIL
SIGNUP_ALLOWLIST=$ALLOW
# Seller Studio (docs/seller-studio.md)
PUBLIC_API_URL=https://$DOMAIN
PUBLIC_SITE_URL=$SITE
STRIPE_SECRET_KEY=$STRIPE_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WHSEC
# Kept outside dist/ (never served as static files); back these up with data/opennote.db
SELLER_FILES_DIR=$DIR/data/seller-files
SELLER_MEDIA_DIR=$DIR/data/seller-media
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
ENV
  chmod 600 .env
fi

echo "==> Starting the API"
pm2 describe desknoty-api >/dev/null 2>&1 && pm2 restart desknoty-api || pm2 start "npm run serve" --name desknoty-api
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null

echo "==> HTTPS for $DOMAIN"
echo "$DOMAIN {
    request_body {
        max_size 210MB
    }
    reverse_proxy 127.0.0.1:3001
}" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy || sudo systemctl restart caddy

echo
echo "Done. Check it: https://$DOMAIN/api/waitlist/count"
echo "(HTTPS starts working once the DNS record for $DOMAIN points at this server.)"
