/**
 * Deployment configuration, read from the hosting platform's environment.
 *
 * Nothing in this module is bundled into the browser: `api/` runs only on the
 * server, so the deploy hook URL, the admin passphrase and the session secret
 * stay out of the frontend bundle. `publicStatus()` is the only export shaped
 * for the client, and it deliberately omits every secret.
 */

export type ProviderId = 'vercel' | 'cloudflare-pages' | 'netlify' | 'custom'

const PROVIDER_LABELS: Record<ProviderId, string> = {
  vercel: 'Vercel',
  'cloudflare-pages': 'Cloudflare Pages',
  netlify: 'Netlify',
  custom: 'Custom host',
}

const KNOWN_PROVIDERS = Object.keys(PROVIDER_LABELS) as ProviderId[]

function env(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : null
}

function readProvider(): ProviderId {
  const raw = (env('DEPLOY_PROVIDER') ?? '').toLowerCase()
  return (KNOWN_PROVIDERS as string[]).includes(raw) ? (raw as ProviderId) : 'vercel'
}

function isEnabled(): boolean {
  const raw = (env('DEPLOY_ENABLED') ?? '').toLowerCase()
  return raw === 'true' || raw === '1' || raw === 'yes'
}

export interface DeployConfig {
  provider: ProviderId
  providerLabel: string
  /** Secret deploy-hook URL. Never sent to the browser. */
  hookUrl: string | null
  /** Public address the site is served from. Safe to show. */
  productionUrl: string | null
  /** Whether a real deployment may actually be triggered. */
  enabled: boolean
  /** Whether a hosting provider is wired up at all. */
  connected: boolean
  /** Whether the server has everything it needs to authenticate an admin. */
  authReady: boolean
  /** Human-readable list of everything still missing before a first deploy. */
  missing: string[]
}

export function readConfig(): DeployConfig {
  const provider = readProvider()
  const hookUrl = env('DEPLOY_HOOK_URL')
  const productionUrl = env('DEPLOY_PRODUCTION_URL')
  const enabled = isEnabled()
  const authReady = Boolean(env('DEPLOY_ADMIN_PASSWORD') && env('SESSION_SECRET'))

  const missing: string[] = []
  if (!hookUrl) {
    missing.push(
      `DEPLOY_HOOK_URL — create a deploy hook for the ${PROVIDER_LABELS[provider]} project and paste its URL into the server environment.`,
    )
  }
  if (!productionUrl) {
    missing.push(
      'DEPLOY_PRODUCTION_URL — the public https:// address the site will be served from.',
    )
  }
  if (!env('DEPLOY_ADMIN_PASSWORD')) {
    missing.push('DEPLOY_ADMIN_PASSWORD — the passphrase that unlocks deployment controls.')
  }
  if (!env('SESSION_SECRET')) {
    missing.push(
      'SESSION_SECRET — a long random string used to sign the admin session cookie (e.g. `openssl rand -hex 32`).',
    )
  }
  if (env('DEPLOY_ADMIN_EMAILS') === null) {
    missing.push(
      'DEPLOY_ADMIN_EMAILS — optional comma-separated emails; when set, only these may deploy.',
    )
  }

  return {
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    hookUrl,
    productionUrl,
    enabled,
    connected: Boolean(hookUrl),
    authReady,
    missing,
  }
}

/** The subset of the configuration that is safe to send to the browser. */
export function publicStatus(config: DeployConfig) {
  return {
    provider: config.provider,
    providerLabel: config.providerLabel,
    connected: config.connected,
    enabled: config.enabled,
    productionUrl: config.productionUrl,
    /** False while the server is missing its auth secrets. */
    authConfigured: config.authReady,
    /** Missing items that actually block a deployment, minus the optional ones. */
    missing: config.missing.filter((item) => !item.startsWith('DEPLOY_ADMIN_EMAILS')),
    /** A real deployment is only ever attempted when all of these hold. */
    ready: config.connected && config.enabled && config.authReady && Boolean(config.productionUrl),
  }
}