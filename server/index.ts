import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import { auth } from './auth.ts'
import { db } from './db.ts'
import { deployRouter } from './deploy.ts'
import { env, googleConfigured, requireEmailVerification, smtpConfigured } from './env.ts'
import { syncRoles } from './roles.ts'
import { devMailRouter } from './mail/dev-inbox.ts'
import { outboxLog, startMailWorker, transportName } from './mail/index.ts'
import { productionMailProblem, senderProblem, verifySmtp } from './mail/transport.ts'
import { applyMigrations } from './schema.ts'
import { PLANS, planOf, requirePlan } from './plans.ts'
import { validateWorkspace } from './workspace.ts'

// Additive only: adds missing tables/columns (e.g. user.role), never drops data.
await applyMigrations({ quiet: true })
const { admins } = syncRoles()
startMailWorker()
{
  const problem = productionMailProblem()
  if (problem) console.error(`[mail] EMAIL IS OFF: ${problem} Verification and reset emails will be marked failed, not sent.`)
  const sender = senderProblem()
  if (sender) console.error(`[mail] ${sender}`)
  // Prove the SMTP login works now, not when the first user signs up.
  if (transportName() === 'smtp') {
    void verifySmtp().then((r) =>
      r.ok
        ? console.log(`[mail] SMTP login OK (${env.smtp.host}:${env.smtp.port}, ${env.smtp.secure || env.smtp.requireTLS ? "encrypted" : "UNENCRYPTED — local catcher only"})`)
        : console.error(`[mail] SMTP LOGIN FAILED (${env.smtp.host}:${env.smtp.port}): ${r.error} — emails will retry and then be marked failed.`),
    )
  }
}

const app = express()
app.disable('x-powered-by')
// Behind a reverse proxy (a Node host, nginx, Fly…) so Secure cookies and
// client IPs for rate limiting are read from X-Forwarded-* headers.
app.set('trust proxy', 1)

// Better Auth must see the raw request body, so it is mounted before any
// body parser.
app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json({ limit: '2mb' }))

/** Which sign-in options the UI should offer. Contains no secrets. */
app.get('/api/auth-config', (_req, res) => {
  res.json({ google: googleConfigured, emailVerificationRequired: requireEmailVerification, emailEnabled: smtpConfigured })
})

interface AuthedRequest extends Request {
  userId?: string
}

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) {
      res.status(401).json({ error: 'Not signed in.' })
      return
    }
    req.userId = session.user.id
    next()
  } catch (err) {
    next(err)
  }
}

const getWorkspace = db.prepare<[string], { data: string; updatedAt: string }>(
  'SELECT data, updatedAt FROM workspace WHERE userId = ?',
)
const putWorkspace = db.prepare(
  `INSERT INTO workspace (userId, data, updatedAt) VALUES (?, ?, ?)
   ON CONFLICT(userId) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
)

/** The signed-in user's own workspace. There is no way to address anyone else's. */
app.get('/api/workspace', requireUser, (req: AuthedRequest, res) => {
  const row = getWorkspace.get(req.userId!)
  res.set('Cache-Control', 'no-store')
  res.json(row ? { data: JSON.parse(row.data), updatedAt: row.updatedAt } : { data: null })
})

app.put('/api/workspace', requireUser, (req: AuthedRequest, res) => {
  const data = (req.body as { data?: unknown } | undefined)?.data
  const problem = validateWorkspace(data)
  if (problem) {
    res.status(400).json({ error: `Invalid workspace: ${problem}.` })
    return
  }
  const updatedAt = new Date().toISOString()
  putWorkspace.run(req.userId!, JSON.stringify(data), updatedAt)
  res.json({ ok: true, updatedAt })
})

// Deployment controls. Gated on a signed-in account with the admin role, and inert while DEPLOY_ENABLED is not "true".
app.use('/api/deploy', deployRouter())

/** The signed-in user's plan and what it includes. */
app.get('/api/plan', requireUser, async (req: AuthedRequest, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  const plan = planOf(session?.user as { plan?: string })
  res.set('Cache-Control', 'no-store').json({ plan, name: PLANS[plan].name, features: PLANS[plan].features, proAvailable: PLANS.pro.available })
})

// Upgrading is not open: Pro is "coming soon". Any attempt to start a
// purchase is refused here, whatever the browser sends.
app.post('/api/billing/checkout', requireUser, (_req, res) => {
  res.status(403).json({ error: 'OpenNote Pro is coming soon and cannot be purchased yet. You have not been charged.' })
})

// Pro-only API surface. Nothing lives here yet; the guard is in place so a
// Free account can never reach Pro functionality once it does.
app.use('/api/pro', requirePlan('pro'), (_req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// Email delivery log for administrators: status only, never bodies or links.
app.get('/api/admin/mail-log', requireUser, async (req: AuthedRequest, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if ((session?.user as { role?: string } | undefined)?.role !== 'admin') {
    res.status(403).json({ error: 'Administrators only.' })
    return
  }
  res.set('Cache-Control', 'no-store').json({ transport: transportName(), messages: outboxLog(100) })
})

// Development inbox: read what OpenNote "sent", without any mail server.
// Never mounted in production.
if (!env.isProduction) app.use('/api/dev/mail', devMailRouter())

// In production the same server also serves the built single-page app.
const dist = resolve('dist')
// Unknown API paths are a 404, never the single-page app's HTML.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

if (env.isProduction && existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  // The app shell is never cached, so Back after sign-out re-checks the session.
  app.get('*splat', (_req, res) => res.set('Cache-Control', 'no-store').sendFile(resolve(dist, 'index.html')))
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

app.listen(env.apiPort, () => {
  console.log(`OpenNote API listening on http://localhost:${env.apiPort}`)
  console.log(`  Administrators: ${admins.length ? admins.join(', ') : 'none (set ADMIN_EMAILS and verify the address)'}`)
  console.log(`  Email delivery: ${transportName() === 'smtp' ? `SMTP via ${env.smtp.host}:${env.smtp.port}` : transportName() === 'local' ? 'local dev inbox → http://localhost:5173/api/dev/mail' : 'OFF — set SMTP_HOST'}`)
  console.log(`  Google sign-in: ${googleConfigured ? 'on' : 'off (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'}`)
  console.log(`  Email verification required: ${requireEmailVerification ? 'yes' : 'no'}`)
})
