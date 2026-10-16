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
  smtp: smtpSettings(),
  mail: {
    /**
     * smtp  – deliver through SMTP_HOST (your own server, or the local catcher)
     * local – write each message to MAILBOX_DIR and show it at /api/dev/mail
     *         (development only; never used in production)
     */
    transport: (process.env.MAIL_TRANSPORT ?? (process.env.SMTP_HOST || process.env.SMTP_PRESET ? 'smtp' : 'local')) as 'smtp' | 'local',
    mailboxDir: process.env.MAILBOX_DIR ?? 'data/mailbox',
    /** Max emails one address can be sent per hour (all kinds together). */
    perRecipientPerHour: Number(process.env.MAIL_RATE_PER_HOUR ?? 5),
    maxAttempts: Number(process.env.MAIL_MAX_ATTEMPTS ?? 5),
    /** Optional DKIM signing for a self-hosted sender domain. */
    dkim: {
      domain: process.env.DKIM_DOMAIN ?? '',
      selector: process.env.DKIM_SELECTOR ?? '',
      privateKeyPath: process.env.DKIM_PRIVATE_KEY_PATH ?? '',
    },
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

/**
 * SMTP settings, with presets for mail servers people already have:
 *
 *   SMTP_PRESET=gmail    smtp.gmail.com:587 (STARTTLS). SMTP_USER = the Gmail
 *                        address, SMTP_PASS = a Google *app password*.
 *   SMTP_PRESET=outlook  smtp-mail.outlook.com:587 (STARTTLS).
 *
 * Explicit SMTP_HOST / SMTP_PORT always win over a preset.
 */
export function smtpSettings() {
  const presets: Record<string, { host: string; port: number }> = {
    gmail: { host: 'smtp.gmail.com', port: 587 },
    outlook: { host: 'smtp-mail.outlook.com', port: 587 },
  }
  const preset = presets[(process.env.SMTP_PRESET ?? '').toLowerCase()]
  const host = process.env.SMTP_HOST || preset?.host || ''
  const port = Number(process.env.SMTP_PORT || preset?.port || 587)
  const user = (process.env.SMTP_USER ?? '').trim()
  // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces are not part of it.
  const pass = host === 'smtp.gmail.com' ? (process.env.SMTP_PASS ?? '').replace(/\s+/g, '') : (process.env.SMTP_PASS ?? '')
  // With a mailbox provider the sender must be that mailbox, so default to it.
  const from = process.env.EMAIL_FROM || (preset && user ? `OpenNote <${user}>` : '')
  return {
    host,
    port,
    user,
    pass,
    from,
    /** Implicit TLS (port 465). Defaults to true on 465, false otherwise. */
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    /** Refuse to send unless STARTTLS succeeds. On by default; off only for a local catcher. */
    requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
    /** Extra CA certificate (PEM file) to trust, e.g. a private mail server's. */
    caFile: process.env.SMTP_CA_FILE ?? '',
  }
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
