import { existsSync } from 'node:fs'

/**
 * Loads `.env` into `process.env` using Node's built-in loader, so secrets stay
 * out of the code. Values already set in the real environment win.
 */
if (existsSync('.env')) process.loadEnvFile('.env')

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
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? '',
  },
}

export const smtpConfigured = Boolean(env.smtp.host && env.smtp.from)
export const googleConfigured = Boolean(env.google.clientId && env.google.clientSecret)

/**
 * Verification is only enforced when mail can actually be delivered — otherwise
 * nobody could ever finish signing up. Override with REQUIRE_EMAIL_VERIFICATION.
 */
export const requireEmailVerification =
  process.env.REQUIRE_EMAIL_VERIFICATION !== undefined
    ? process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
    : smtpConfigured
