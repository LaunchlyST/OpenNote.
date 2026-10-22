import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { db } from './db.ts'
import { env } from './env.ts'

/**
 * Early-access gate for the landing page.
 *
 * The invite code is checked here, on the server, and success is remembered in
 * an httpOnly signed cookie. The browser can never mint this cookie itself —
 * only a correct code sent to `POST /api/early-access` earns one — so
 * `/landing` is protected by the backend, not by a frontend check.
 */

/** Override with EARLY_ACCESS_CODE in .env; the default matches the launch invite. */
const CODE = (process.env.EARLY_ACCESS_CODE ?? 'Invite27').trim()
const COOKIE = 'desknoty_access'
const MAX_AGE_DAYS = 30

/** The cookie carries an HMAC of a fixed label, so a hand-edited value fails. */
function token(): string {
  return createHmac('sha256', env.secret).update('early-access-v1').digest('hex')
}

function codeMatches(input: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(CODE)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readCookie(header: string | undefined, name: string): string | undefined {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1]
}

function hasAccess(req: Request): boolean {
  const got = readCookie(req.headers.cookie, COOKIE)
  if (!got) return false
  const expected = Buffer.from(token())
  try {
    return Buffer.from(got).length === expected.length && timingSafeEqual(Buffer.from(got), expected)
  } catch {
    return false
  }
}

/**
 * A frontend hosted on another registrable domain (e.g. desknoty.com calling
 * api.desknoty.com is same-site, but github.io calling api.desknoty.com is
 * not) needs SameSite=None; secure — same rule Better Auth uses in auth.ts.
 */
function cookieOptions(req: Request) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.replace(/\/+$/, '') : ''
  const registrable = (host: string) => host.split('.').slice(-2).join('.')
  let crossSite = false
  try {
    crossSite = Boolean(origin) && registrable(new URL(origin).hostname) !== registrable(new URL(env.baseURL).hostname)
  } catch {
    /* malformed Origin header: treat as same-site */
  }
  const secure = env.baseURL.startsWith('https://') || (crossSite && origin.startsWith('https://'))
  return {
    httpOnly: true,
    secure,
    sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  }
}

export const earlyAccessRouter = Router()

/** Redeem the invite code. Only a correct code sets the access cookie. */
earlyAccessRouter.post('/api/early-access', (req: Request, res: Response) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!code || !codeMatches(code)) {
    res.status(403).json({ ok: false, error: 'That invite code is not valid.' })
    return
  }
  res.cookie(COOKIE, token(), cookieOptions(req))
  res.json({ ok: true })
})

/** Whether this browser already holds a valid access cookie. */
earlyAccessRouter.get('/api/early-access/status', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store')
  res.json({ unlocked: hasAccess(req) })
})

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Join the launch waitlist. Signing up twice is fine and says the same thing. */
earlyAccessRouter.post('/api/waitlist', (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    res.status(400).json({ ok: false, error: 'Please enter a valid email address.' })
    return
  }
  try {
    db.exec('CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, createdAt TEXT NOT NULL);')
    db.prepare('INSERT OR IGNORE INTO waitlist (email, createdAt) VALUES (?, ?)').run(email, new Date().toISOString())
  } catch (err) {
    console.error('[waitlist] could not save signup:', err)
    res.status(500).json({ ok: false, error: 'We couldn’t save your email just now. Please try again in a minute.' })
    return
  }
  res.json({ ok: true })
})

/** How many people are on the waitlist — shown as social proof on the page. */
earlyAccessRouter.get('/api/waitlist/count', (_req: Request, res: Response) => {
  db.exec('CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, createdAt TEXT NOT NULL);')
  const row = db.prepare('SELECT COUNT(*) AS n FROM waitlist').get() as { n: number }
  res.set('Cache-Control', 'no-store')
  res.json({ count: row.n })
})
