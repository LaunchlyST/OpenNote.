/**
 * Deployment controls.
 *
 * Mounted at `/api/deploy` on the same Express server that already handles
 * Better Auth and workspace sync, so there is one API, one session model and
 * one place secrets live.
 *
 * Access is gated on a real signed-in Better Auth account whose email is in
 * `ADMIN_EMAILS` (and verified). That list is empty by default, which means nobody is
 * an administrator until you name someone — the fail-closed default.
 *
 * Publishing additionally requires `DEPLOY_ENABLED=true`. Without it this
 * router refuses every deployment, which is what keeps the button inert until
 * you deliberately switch it on.
 */
import { Router } from 'express'
import type {
  Request as Req,
  Response as Res,
  NextFunction,
} from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { db, ensureAppTables } from './db.ts'
import { env, PROVIDER_LABELS } from './env.ts'

// The prepared statements below run at module load, and ES module imports are
// evaluated before the importing file's body — so `server/index.ts` calling
// ensureAppTables() would happen too late. Create the schema here instead;
// it is idempotent.
ensureAppTables()

/** Refuses to fire twice in a row, so a double click cannot queue two builds. */
const MIN_SECONDS_BETWEEN = 60
const HOOK_TIMEOUT_MS = 15_000

interface AuthedRequest extends Req {
  userId?: string
  userEmail?: string
}

export interface DeploymentRecord {
  requestedAt: string
  provider: string
  providerLabel: string
  productionUrl: string | null
  accepted: boolean
}

const readLast = db.prepare<[], DeploymentRecord>(
  `SELECT requestedAt, provider, providerLabel, productionUrl, accepted
     FROM deployment WHERE id = 1`,
)

const writeLast = db.prepare(
  `INSERT INTO deployment (id, requestedAt, provider, providerLabel, productionUrl, requestedBy, accepted)
   VALUES (1, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     requestedAt = excluded.requestedAt,
     provider = excluded.provider,
     providerLabel = excluded.providerLabel,
     productionUrl = excluded.productionUrl,
     requestedBy = excluded.requestedBy,
     accepted = excluded.accepted`,
)

function providerLabel(): string {
  return PROVIDER_LABELS[env.deploy.provider] ?? env.deploy.provider
}

/** Everything a signed-in administrator needs, and no secrets. */
export function publicStatus() {
  const missing: string[] = []
  if (!env.deploy.hookUrl) missing.push('DEPLOY_HOOK_URL — create a deploy hook for your host and set it in the server environment.')
  if (!env.deploy.productionUrl) missing.push('DEPLOY_PRODUCTION_URL — the public https:// address the site is served from.')
  if (env.adminEmails.length === 0) missing.push('ADMIN_EMAILS — comma-separated administrator emails (must be verified).')

  const connected = Boolean(env.deploy.hookUrl)
  return {
    provider: env.deploy.provider,
    providerLabel: providerLabel(),
    connected,
    enabled: env.deploy.enabled,
    productionUrl: env.deploy.productionUrl || null,
    missing,
    ready: connected && env.deploy.enabled && env.adminEmails.length > 0,
  }
}

function readLastDeployment(): DeploymentRecord | null {
  const row = readLast.get()
  if (!row) return null
  return { ...row, accepted: Boolean(row.accepted) }
}

/**
 * Requires a signed-in account with the admin role. Runs after
 * Better Auth has had a chance to establish the session cookie.
 */
async function requireAdmin(req: AuthedRequest, res: Res, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (!session) {
    res.status(401).json({ error: 'Sign in to Desknoty first.' })
    return
  }

  const email = session.user.email.toLowerCase()
  // The role is assigned server-side by syncRoles(): on ADMIN_EMAILS and verified.
  if ((session.user as { role?: string | null }).role !== 'admin') {
    res.status(403).json({
      error:
        env.adminEmails.length === 0
          ? 'No administrator is configured. Set ADMIN_EMAILS in the server environment.'
          : 'This account is not an administrator.',
    })
    return
  }

  req.userId = session.user.id
  req.userEmail = email
  next()
}

export function deployRouter() {
  const router = Router()

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/', requireAdmin, (_req: AuthedRequest, res: Res) => {
    res.json({ ...publicStatus(), lastDeployment: readLastDeployment() })
  })

  router.post('/', requireAdmin, async (req: AuthedRequest, res: Res) => {
    // Report the most actionable blocker first.
    if (!env.deploy.hookUrl) {
      res.status(409).json({
        error: `No hosting provider is connected. Set DEPLOY_HOOK_URL for ${providerLabel()} in the server environment.`,
      })
      return
    }
    if (!env.deploy.enabled) {
      res.status(403).json({
        error: 'Deployments are switched off. Set DEPLOY_ENABLED=true when you are ready to publish.',
      })
      return
    }

    const last = readLastDeployment()
    if (last) {
      const since = (Date.now() - Date.parse(last.requestedAt)) / 1000
      if (Number.isFinite(since) && since < MIN_SECONDS_BETWEEN) {
        res.status(429).json({
          error: `A deployment was already requested ${Math.ceil(MIN_SECONDS_BETWEEN - since)}s ago. Give the current build a moment to finish.`,
          lastDeployment: last,
        })
        return
      }
    }

    let response: globalThis.Response
    try {
      response = await fetch(env.deploy.hookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'opennote-admin',
          requestedBy: req.userEmail,
          requestedAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
      })
    } catch (error) {
      res.status(502).json({
        error: `Could not reach ${providerLabel()}: ${
          error instanceof Error ? error.message : 'unknown network error'
        }.`,
      })
      return
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200)
      res.status(502).json({
        error: `${providerLabel()} rejected the deployment request (HTTP ${response.status})${detail ? `: ${detail}` : ''}.`,
      })
      return
    }

    const record: DeploymentRecord = {
      requestedAt: new Date().toISOString(),
      provider: env.deploy.provider,
      providerLabel: providerLabel(),
      productionUrl: env.deploy.productionUrl || null,
      accepted: true,
    }
    writeLast.run(
      record.requestedAt,
      record.provider,
      record.providerLabel,
      record.productionUrl,
      req.userId ?? null,
      1,
    )

    res.status(202).json({
      ...publicStatus(),
      lastDeployment: record,
      message: `${providerLabel()} accepted the deployment and is building it now. The live site updates when the build finishes.`,
    })
  })

  return router
}