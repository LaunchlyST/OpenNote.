import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { sql } from './db.ts'
import { env } from './env.ts'
import { enqueueEmail } from './mail/index.ts'
import { EARLY_ACCESS_COOKIE, earlyAccessToken, earlyAccessCookieOptions } from './early-access.ts'

const MODE_KEY = 'launchMode'
const LAUNCH_ID_KEY = 'launchId'
const LAUNCHED_AT_KEY = 'launchedAt'

async function getSetting(key: string): Promise<string | null> {
  const row = await sql.get<{ value: string }>('SELECT value FROM site_settings WHERE key = ?', key)
  return row?.value ?? null
}

async function setSetting(key: string, value: string) {
  await sql.run(
    `INSERT INTO site_settings (key, value, "updatedAt") VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, "updatedAt" = excluded."updatedAt"`,
    key,
    value,
    new Date().toISOString(),
  )
}

/**
 * construction: "Under construction" page, Notify me joins the waitlist.
 * waitlist:     waitlist signup page (the default).
 * beta:         waitlist members with a launch link get in.
 * launched:     public launch; the pre-launch page and sign-up limits are gone.
 * Only an administrator changes it; nothing changes it automatically.
 */
export type LaunchMode = 'construction' | 'waitlist' | 'beta' | 'launched'
export const LAUNCH_MODES: LaunchMode[] = ['construction', 'waitlist', 'beta', 'launched']

export async function getLaunchMode(): Promise<LaunchMode> {
  const v = await getSetting(MODE_KEY)
  return (LAUNCH_MODES as string[]).includes(v ?? '') ? (v as LaunchMode) : 'waitlist'
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
launchRouter.get('/api/launch/status', async (_req: Request, res: Response) => {
  res.json({ mode: await getLaunchMode(), launchedAt: await getSetting(LAUNCHED_AT_KEY) })
})

// Public: redeem a launch email link. Sets the early-access cookie and sends the
// browser to the landing page.
launchRouter.get('/api/launch/redeem', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const launchId = await getSetting(LAUNCH_ID_KEY)
  if (!token || !launchId) {
    res.status(400).type('text/plain').send('This link is no longer valid.')
    return
  }
  const email = readToken(token, launchId)
  if (!email) {
    res.status(400).type('text/plain').send('This link is no longer valid.')
    return
  }
  const row = await sql.get('SELECT 1 AS one FROM waitlist WHERE email = ?', email)
  if (!row) {
    res.status(403).type('text/plain').send('This link is no longer valid.')
    return
  }
  res.cookie(EARLY_ACCESS_COOKIE, earlyAccessToken(), earlyAccessCookieOptions(req))
  res.redirect(302, `${(process.env.PUBLIC_SITE_URL || env.baseURL).replace(/\/+$/, '')}/landing`)
})

// Admin: send launch emails to every waitlist signup and move the site into beta.
launchRouter.post('/api/admin/launch', async (req: Request, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    requireAdmin(req, res, (err) => (err ? reject(err) : resolve()))
  }).catch(() => {})
  // requireAdmin already responded on failure; detect by status.
  if (res.headersSent) return

  const mode = await getLaunchMode()
  if (mode === 'launched') {
    res.status(409).json({ error: 'Beta has already ended; the site is fully launched.' })
    return
  }
  if (mode === 'beta') {
    res.json({ mode, queued: 0, total: 0, message: 'Already in beta.' })
    return
  }

  const launchId = randomUUID()
  await setSetting(LAUNCH_ID_KEY, launchId)
  await setSetting(LAUNCHED_AT_KEY, new Date().toISOString())
  await setSetting(MODE_KEY, 'beta')

  const rows = await sql.all<{ email: string }>('SELECT email FROM waitlist')
  let queued = 0
  for (const row of rows) {
    const email = row.email
    const url = `${env.baseURL}/api/launch/redeem?token=${encodeURIComponent(makeToken(email, launchId))}`
    const r = await enqueueEmail('waitlist-launch', email, { url })
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
  await setSetting(MODE_KEY, 'launched')
  res.json({ mode: 'launched' })
})

// Admin: switch between Under construction, Waitlist and Public launch at any time.
// (Beta, with launch emails, still goes through POST /api/admin/launch.)
launchRouter.post('/api/admin/launch/mode', async (req: Request, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    requireAdmin(req, res, (err) => (err ? reject(err) : resolve()))
  }).catch(() => {})
  if (res.headersSent) return
  const mode = typeof req.body?.mode === 'string' ? req.body.mode : ''
  if (mode !== 'construction' && mode !== 'waitlist' && mode !== 'launched') {
    res.status(400).json({ error: 'Choose construction, waitlist or launched.' })
    return
  }
  await setSetting(MODE_KEY, mode)
  if (mode === 'launched' && !(await getSetting(LAUNCHED_AT_KEY))) await setSetting(LAUNCHED_AT_KEY, new Date().toISOString())
  res.json({ mode })
})
