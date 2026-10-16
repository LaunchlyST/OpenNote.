# OpenNote

A calendar and notes planner, plus a public landing page. React 19, TypeScript
and Vite, with a Better Auth + SQLite backend in `server/`.

```bash
cp .env.example .env          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:migrate            # creates the auth + workspace tables (safe to re-run)
npm run dev                   # web on :5173, API on :3001 (proxied at /api)
```

| Command               | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Web and API together                          |
| `npm run build`       | Type-check, then build `dist/`                |
| `npm run serve`       | One Node process serving `dist/` and `/api/*` |
| `npm run db:migrate`  | Create or update the database schema          |
| `npm run lint`        | oxlint                                       |
| `npm test`            | SSR smoke test                               |
| `npm run test:deploy` | Deployment API safety checks                  |
| `npm run test:auth`   | Sign-in, Remember Me, roles, password reset   |

## Layout

```
src/            React app (landing page + calendar)
server/         Express API: auth, workspace sync, deployment
scripts/        smoke tests
```

`tsconfig.json` references `tsconfig.app.json` (src), `tsconfig.node.json`
(`vite.config.ts`) and `tsconfig.server.json` (`server/`). All three are built
by `npm run build`.

## Accounts and sign-in (Better Auth)

OpenNote uses [Better Auth](https://better-auth.com) with a free local SQLite
database. No paid auth service is needed.

```bash
cp .env.example .env          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:migrate            # creates the auth + workspace tables (safe to re-run)
npm run dev                   # web on :5173, API on :3001 (proxied at /api)
```

Production: `npm run build && npm run serve` runs one Node server that serves
the site and the API. Set `BETTER_AUTH_URL` to the public https URL.

- **Email** (verification + password reset): OpenNote's own outbox — see
  *Email* below. Without `SMTP_HOST`, mail goes to a local dev inbox and email
  verification is not enforced.
- **Administrators**: set `ADMIN_EMAILS` (comma separated). An account becomes
  `admin` only once that email is verified; everyone else is `user`. Without
  SMTP, confirm your own address from the server terminal with
  `npm run admin:verify -- you@example.com`. Only admins see *Admin → Deploy*,
  and the API checks the role on every request.
- **Remember me**: checked keeps you signed in for 30 days; unchecked ends the
  session when the browser closes.
- **Data**: each user's calendar is stored server-side and only returned to
  that user's session (`/api/workspace`).

### Email (password reset + verification)

OpenNote has its own email system: branded templates, a durable outbox with
retries and rate limiting, and an SMTP client — no third-party email service.

- **Development, no setup:** leave `SMTP_HOST` empty. Emails land in a local
  inbox at <http://localhost:5173/api/dev/mail> (never leaves your computer).
- **Test the real SMTP path locally:** `npm run mail:catcher`, then set
  `SMTP_HOST=127.0.0.1`, `SMTP_PORT=2525`, `SMTP_REQUIRE_TLS=false`.
- **Real inboxes:** point `SMTP_*` at your own mail server.

Full details, and what infrastructure real delivery needs (domain, port 25,
reverse DNS, SPF/DKIM/DMARC), are in [docs/self-hosted-email.md](docs/self-hosted-email.md).

## Tests

```bash
npm test           # SSR smoke test for the landing page and calendar
npm run test:deploy # deployment API safety checks (never publishes anything)
npm run test:auth  # sign-in/out, Remember Me, admin roles, password reset
npm run test:mail  # templates, outbox, retries, rate limits, SMTP path (local)
npm run mail:test -- you@example.com  # send one test email via current settings
```

`test:deploy` boots the real Express router against a throwaway SQLite database
and a throwaway local HTTP server standing in for the provider's deploy hook. It
proves the negative cases — anonymous access refused, non-administrators
refused, and the `DEPLOY_ENABLED` kill switch holding — then confirms that an
enabled administrator really does reach the provider.

---

# Deployment

Daytona is no longer used anywhere in this project.

## Where it runs

The site is a Vite SPA **plus** a Node/Express API (`server/`) that handles
accounts, workspace sync and deployment. They are served together, so the app
needs a **Node host** (Render, Fly, Railway, or your own box) rather than a
static-only host. A static host such as Cloudflare Pages or Vercel's static tier
cannot run Better Auth and SQLite, so it cannot host OpenNote on its own.

- `npm run build` produces the static `dist/`.
- `npm run serve` runs one Express process that serves `dist/` **and** `/api/*`.
- Point the Node host's start command at `npm run serve` and its health check at
  `/api/auth-config`.

## Deploying from inside the app

With the app running, open **Settings (gear) → Admin → Deploy**. The panel shows
the deployment status, the hosting provider and whether it is connected, the
production URL, the last deployment, and a **Deploy Website** button.

The button makes a real deployment: the browser posts to `/api/deploy`, the
server checks the signed-in account and then calls the provider's deploy hook.
The provider rebuilds the latest commit and publishes it. It is not a simulated
success.

### Who may deploy

`server/deploy.ts` requires a real signed-in Better Auth session whose email is
listed in `DEPLOY_ADMIN_EMAILS`. That list is **empty by default**, so a fresh
install cannot be deployed by whichever account signs up first. The browser is
never trusted to decide this.

### The kill switch

`POST /api/deploy` refuses everything unless `DEPLOY_ENABLED=true`. It ships as
`false` in `.env.example`, so nothing publishes until you deliberately turn it
on. The button reflects this: it stays disabled while the server reports
deployments as switched off.

### Configuration

Everything lives in the server environment — see the deployment block at the
bottom of `.env.example`. None of it is bundled into the browser; the status
endpoint deliberately omits the hook URL.

| Variable                | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `DEPLOY_PROVIDER`       | Label shown in the panel                                |
| `DEPLOY_HOOK_URL`       | The provider's deploy hook. Can publish the site.        |
| `DEPLOY_PRODUCTION_URL` | The public address, shown in the panel                   |
| `DEPLOY_ENABLED`        | Kill switch. Must be exactly `true` to publish.          |
| `DEPLOY_ADMIN_EMAILS`   | Accounts allowed to deploy. Empty means nobody can.      |

The provider is contacted through a **deploy hook** — its own "rebuild and
publish the latest commit" URL — rather than a full API token. That keeps the
credential small and makes the integration provider-agnostic.

### Deployment record

The last accepted deployment is stored in the `deployment` table in the same
SQLite file as everything else, so it survives restarts.
