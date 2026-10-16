# OpenNote

A calendar and notes planner. Public landing page at `/`, the app at `/app`.

Built with React 19, TypeScript and Vite. The whole client is static: every
account, event and note lives in that browser's `localStorage`.

## Commands

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server on `:5173`, bound to `0.0.0.0`                |
| `npm run build`     | Type-check (`tsc -b`, src + api + config) then build     |
| `npm run preview`   | Serve the built `dist/`                                 |
| `npm run lint`      | oxlint                                                  |
| `npm test`          | SSR smoke test for the landing page and calendar         |
| `npm run test:deploy` | Deployment API safety checks (no publishing)           |

`npm run test:deploy` points the deploy hook at a throwaway HTTP server on
localhost, so it exercises the real request path without contacting a hosting
provider.

## Layout

```
src/
  landing/     public marketing site (excluded from tsconfig.app.json)
  components/  calendar, settings and shared UI
  deploy/      browser client for the deployment API
api/           serverless deployment endpoints — never bundled into the client
scripts/       smoke tests and the static landing render
```

`tsconfig.json` references three projects, all built by `npm run build`:

- `tsconfig.app.json` — `src`
- `tsconfig.node.json` — `vite.config.ts`
- `tsconfig.api.json` — `api`

---

# Deployment

Daytona is no longer used. Hosting is a static build plus a small set of
serverless functions in `api/`.

## Recommended host: Vercel

- **Fits the app exactly.** OpenNote is a static SPA, and Vercel serves it from
  `dist/` as-is.
- **The deploy API lives in the same project.** `api/` becomes `/api/*` on the
  same origin, so there is no second service, no CORS, and no second hostname.
- **Deploy hooks.** A deploy hook is a single URL that makes Vercel rebuild and
  republish the latest commit. That is what makes a one-click Deploy button
  possible without the server holding a full API token.
- **Free** on the Hobby plan for a personal project, with no seat or card.

Cloudflare Pages is a good alternative and `public/_redirects` already provides
the matching SPA fallback. The endpoint code is provider-agnostic — it only
needs a deploy hook URL, so switching providers is a matter of pointing
`DEPLOY_HOOK_URL` at the new project. Vercel is recommended because it hosts the
functions and the site together with no extra wiring.

## Configuration

Everything is server-side. Copy `.env.example` into the hosting provider's
environment variables. **Nothing here belongs in `src/`** — everything under
`api/` runs on the server only.

| Variable                  | Required | Purpose                                              |
| ------------------------- | -------- | ---------------------------------------------------- |
| `DEPLOY_PROVIDER`         | no       | `vercel` (default), `cloudflare-pages`, `netlify`, `custom` |
| `DEPLOY_HOOK_URL`         | **yes**  | The provider's deploy hook. Can publish the site.    |
| `DEPLOY_PRODUCTION_URL`   | **yes**  | The public `https://` address, shown in the UI       |
| `DEPLOY_ENABLED`          | **yes**  | Kill switch. Deploys are refused unless exactly `true` |
| `DEPLOY_ADMIN_PASSWORD`   | **yes**  | Passphrase that unlocks the Deploy page              |
| `SESSION_SECRET`          | **yes**  | Signs the admin session cookie (`openssl rand -hex 32`) |
| `DEPLOY_ADMIN_EMAILS`     | no       | Optional comma-separated account email allowlist     |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | Durable "last deployment" record |

`DEPLOY_ENABLED` ships unset, so a fresh deployment cannot publish. Nothing
happens until it is deliberately turned on.

## Where a deploy hook comes from

- **Vercel** — Project → Settings → Git → Deploy Hooks → Create. Use the
  production branch.
- **Cloudflare Pages** — Workers & Pages → your project → Settings → Deploy hooks.
- **Netlify** — Site configuration → Build & deploy → Deploy hooks.

## Admin Settings → Deploy

Settings gains a **Deploy** section. It reports the deployment status, the
hosting provider and its connection state, the production URL, the last
recorded deployment, and a **Deploy Website** button with progress and error
messages.

The button performs a real deployment: the browser posts to `/api/deploy`, the
server authenticates the admin session and then calls the provider's deploy
hook. The provider builds the latest commit and publishes it. It is not a
simulated success.

### Access control

OpenNote has no server-side account store — sign-up lives entirely in
`localStorage` (see `src/auth.tsx`), so there is no role to check against on
the server. Deployment controls are therefore gated by:

1. **A passphrase held only in the server environment**
   (`DEPLOY_ADMIN_PASSWORD`), compared in constant time and exchanged for an
   HMAC-signed, `HttpOnly`, `SameSite=Strict` session cookie.
2. **An optional email allowlist** (`DEPLOY_ADMIN_EMAILS`). When set, the
   signed-in account's email must also appear in it.

The browser is never trusted to decide who may deploy; `api/deploy.ts` refuses
without a valid session, and refuses again while `DEPLOY_ENABLED` is unset.
Both paths are covered by `npm run test:deploy`.

## Running the API locally

`npm run dev` serves only the client, so the Deploy page reports that the
deployment API is unavailable. To exercise the real endpoints, run them through
Vercel's local dev server:

```sh
npx vercel dev
```

That serves `dist/` and `api/` together. Set the variables from `.env.example`
in a `.env.local` (git-ignored) first.

## Deployment record

Serverless instances are recycled, so without a store the "last deployment" row
only survives while an instance stays warm. Configure Upstash Redis to make it
durable; otherwise the page still works, it just forgets after a recycle.