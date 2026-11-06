import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { db } from './db.ts'
import { env } from './env.ts'
import { enqueueEmail } from './mail/index.ts'
import { EARLY_ACCESS_COOKIE, earlyAccessToken, earlyAccessCookieOptions } from './early-access.ts'

const MODE_KEY = 'launchMode'
const LAUNCH_ID_KEY = 'launchId'
const LAUNCHED_AT_KEY = 'launchedAt'

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setSetting(key: string, value: string) {
  db.prepare(
    `INSERT INTO site_settings (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
  ).run(key, value, new Date().toISOString())
}

export function getLaunchMode(): 'waitlist' | 'beta' | 'launched' {
  const v = getSetting(MODE_KEY)
  if (v === 'beta' || v === 'launched') return v
  return 'waitlist'
}

function makeToken(email: string, launchId: string): string {
  const payload = Buffer.from(email).toString('base64url')
  const sig = createHmac('sha256', env.secret).update(`launch:${launchId}:${email}`).digest('base64url')
  return `${payload}.${sig}`
}

function readToken(token: string, launchId: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  let email = ''
  try {
    email = Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null
  const expected = createHmac('sha256', env.secret).update(`launch:${launchId}:${email}`).digest('base64url')
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return email
}

async function requireAdmin(req: Request, res: Response, next: (err?: unknown) => void) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (!session) {
    res.status(401).json({ error: 'Sign in to Desknoty first.' })
    return
  }
  if ((session.user as { role?: string | null }).role !== 'admin') {
    res.status(403).json({ error: 'This account is not an administrator.' })
    return
  }
  ;(req as Request & { userId?: string; userEmail?: string }).userId = session.user.id
  ;(req as Request & { userId?: string; userEmail?: string }).userEmail = session.user.email.toLowerCase()
  next()
}

export const launchRouter = Router()

launchRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// Public: current launch mode.
launchRouter.get('/api/launch/status', (_req: Request, res: Response) => {
  res.json({ mode: getLaunchMode(), launchedAt: getSetting(LAUNCHED_AT_KEY) })
})

// Public: redeem a launch email link. Sets the early-access cookie and sends the
// browser to the landing page.
launchRouter.get('/api/launch/redeem', (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const launchId = getSetting(LAUNCH_ID_KEY)
  if (!token || !launchId) {
    res.status(400).type('text/plain').send('This link is no longer valid.')
    return
  }
  const email = readToken(token, launchId)
  if (!email) {
    res.status(400).type('text/plain').send('This link is no longer valid.')
    return
  }
  const row = db.prepare('SELECT 1 FROM waitlist WHERE email = ?').get(email)
  if (!row) {
    res.status(403).type('text/plain').send('This link is no longer valid.')
    return
  }
  res.cookie(EARLY_ACCESS_COOKIE, earlyAccessToken(), earlyAccessCookieOptions(req))
  res.redirect(302, `${env.baseURL}/landing`)
})

// Admin: send launch emails to every waitlist signup and move the site into beta.
launchRouter.post('/api/admin/launch', async (req: Request, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    requireAdmin(req, res, (err) => (err ? reject(err) : resolve()))
  }).catch(() => {})
  // requireAdmin already responded on failure; detect by status.
  if (res.headersSent) return

  const mode = getLaunchMode()
  if (mode === 'launched') {
    res.status(409).json({ error: 'Beta has already ended; the site is fully launched.' })
    return
  }
  if (mode === 'beta') {
    res.json({ mode, queued: 0, total: 0, message: 'Already in beta.' })
    return
  }

  const launchId = randomUUID()
  setSetting(LAUNCH_ID_KEY, launchId)
  setSetting(LAUNCHED_AT_KEY, new Date().toISOString())
  setSetting(MODE_KEY, 'beta')

  const rows = db.prepare('SELECT email FROM waitlist').all() as Array<{ email: string }>
  let queued = 0
  for (const row of rows) {
    const email = row.email
    const url = `${env.baseURL}/api/launch/redeem?token=${encodeURIComponent(makeToken(email, launchId))}`
    const r = enqueueEmail('waitlist-launch', email, { url })
    if (r.queued) queued++
  }
  res.status(202).json({ mode: 'beta', queued, total: rows.length })
})

// Admin: end beta — remove the waitlist page for everyone.
launchRouter.post('/api/admin/launch/end', async (req: Request, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    requireAdmin(req, res, (err) => (err ? reject(err) : resolve()))
  }).catch(() => {})
  if (res.headersSent) return
  setSetting(MODE_KEY, 'launched')
  res.json({ mode: 'launched' })
})
