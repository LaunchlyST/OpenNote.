# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

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

- **Email** (verification + password reset): set the `SMTP_*` and `EMAIL_FROM`
  variables. Until then, links are printed to the API console in development
  only, and email verification is not enforced.
- **Google sign-in**: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The
  button appears automatically. Authorised redirect URI:
  `<BETTER_AUTH_URL>/api/auth/callback/google`.
- **Data**: each user's calendar is stored server-side and only returned to
  that user's session (`/api/workspace`).
