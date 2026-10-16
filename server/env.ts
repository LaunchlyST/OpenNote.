import { existsSync, readFileSync } from 'node:fs'

/**
 * Loads `.env` into `process.env`, so secrets stay out of the code. Values
 * already present in the real environment win.
 *
 * Hand-rolled rather than `process.loadEnvFile()`, because that function does
 * not strip a UTF-8 BOM — and a BOM is what Notepad and PowerShell's
 * `Set-Content -Encoding utf8` write on Windows. With one, the first key
 * becomes unparseable, `BETTER_AUTH_URL` silently disappears, and the server
 * dies with "missing required environment variable".
 */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return

  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()

    // Strip one layer of matching quotes, which people write by habit.
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    } else if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env')

const isProduction = process.env.NODE_ENV === 'production'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.example.`)
  return value
}

export const env = {
  isProduction,
  /** Public origin the app is served from, e.g. https://opennote.example.com */
  baseURL: required('BETTER_AUTH_URL'),
  /** 32+ random bytes used to sign sessions and tokens. */
  secret: required('BETTER_AUTH_SECRET'),
  databasePath: process.env.DATABASE_PATH ?? 'data/opennote.db',
  apiPort: Number(process.env.API_PORT ?? process.env.PORT ?? 3001),
  /** Extra origins allowed to call the auth API (comma separated). */
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * Headers your host's reverse proxy sets with the visitor's IP, used for
   * rate limiting. Only trust headers your proxy overwrites.
   */
  ipAddressHeaders: (process.env.IP_ADDRESS_HEADERS ?? 'x-forwarded-for,x-real-ip')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustedProxies: (process.env.TRUSTED_PROXIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * Accounts that become administrators once their email is verified. Empty
   * means nobody. DEPLOY_ADMIN_EMAILS is still read for older .env files.
   */
  adminEmails: (process.env.ADMIN_EMAILS ?? process.env.DEPLOY_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? '',
  },

  /**
   * Deployment controls. Nothing here is sent to the browser except the
   * production URL and the booleans in `publicStatus()`.
   *
   * The provider is contacted through a *deploy hook* — its own "rebuild and
   * republish the latest commit" URL. It holds no API token and can publish
   * the site, so it is a credential.
   */
  deploy: {
    provider: process.env.DEPLOY_PROVIDER ?? 'custom',
    hookUrl: process.env.DEPLOY_HOOK_URL ?? '',
    productionUrl: process.env.DEPLOY_PRODUCTION_URL ?? '',
    /** Kill switch. Deploys are refused unless this is exactly "true". */
    enabled: process.env.DEPLOY_ENABLED === 'true',
  },
}

export const PROVIDER_LABELS: Record<string, string> = {
  vercel: 'Vercel',
  'cloudflare-pages': 'Cloudflare Pages',
  netlify: 'Netlify',
  render: 'Render',
  fly: 'Fly.io',
  custom: 'Custom host',
}

export const smtpConfigured = Boolean(env.smtp.host && env.smtp.from)

/**
 * Verification is only enforced when mail can actually be delivered — otherwise
 * nobody could ever finish signing up. Override with REQUIRE_EMAIL_VERIFICATION.
 */
export const requireEmailVerification =
  process.env.REQUIRE_EMAIL_VERIFICATION !== undefined
    ? process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
    : smtpConfigured
