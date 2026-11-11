import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { sql } from './db.ts'
import { env } from './env.ts'
import { enqueueEmail } from './mail/index.ts'

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
export const EARLY_ACCESS_COOKIE = 'desknoty_access'
const COOKIE = EARLY_ACCESS_COOKIE
const MAX_AGE_DAYS = 30

/** The cookie carries an HMAC of a fixed label, so a hand-edited value fails. */
export function earlyAccessToken(): string {
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
  // Cookie on same-site hosting; the X-Early-Access header where the API is
  // cross-site and browsers (Safari) drop third-party cookies.
  const header = typeof req.headers['x-early-access'] === 'string' ? req.headers['x-early-access'] : undefined
  const got = header || readCookie(req.headers.cookie, COOKIE)
  if (!got) return false
  const expected = Buffer.from(earlyAccessToken())
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
export function earlyAccessCookieOptions(req: Request) {
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
  res.cookie(COOKIE, earlyAccessToken(), earlyAccessCookieOptions(req))
  res.json({ ok: true, token: earlyAccessToken() })
})

/** Whether this browser already holds a valid access cookie. */
earlyAccessRouter.get('/api/early-access/status', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store')
  // After the public launch everyone is let in.
  const { getLaunchMode } = await import('./launch.ts')
  res.json({ unlocked: hasAccess(req) || (await getLaunchMode()) === 'launched' })
})

/** The public site (differs from the API origin when they are hosted apart). */
const siteUrl = (process.env.PUBLIC_SITE_URL || env.baseURL).replace(/\/+$/, '')

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Join the launch waitlist. Signing up twice is fine and says the same thing. */
earlyAccessRouter.post('/api/waitlist', async (req: Request, res: Response) => {
  // Spam trap: a hidden "website" field people never see. Bots that fill it get a polite no.
  if (typeof req.body?.website === 'string' && req.body.website.trim()) {
    res.status(400).json({ ok: false, error: 'Please enter a valid email address.' })
    return
  }
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    res.status(400).json({ ok: false, error: 'Please enter a valid email address.' })
    return
  }
  let added = false
  let count = 0
  try {
    added = (await sql.run('INSERT INTO waitlist (email, "createdAt") VALUES (?, ?) ON CONFLICT (email) DO NOTHING', email, new Date().toISOString())).changes === 1
    count = (await sql.get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM waitlist'))?.n ?? 0
  } catch (err) {
    console.error('[waitlist] could not save signup:', err)
    res.status(500).json({ ok: false, error: 'We couldn’t save your email just now. Please try again in a minute.' })
    return
  }
  // Only a new signup gets mail: the visitor a welcome, the owner a heads-up.
  // The outbox queues and retries; a mail problem never fails the signup.
  if (added) {
    await enqueueEmail('waitlist-welcome', email, { url: siteUrl })
    const owner = (process.env.WAITLIST_NOTIFY_EMAIL ?? env.adminEmails[0] ?? '').trim()
    if (owner) await enqueueEmail('waitlist-signup', owner, { url: siteUrl, email, count })
  }
  res.json({ ok: true, alreadyJoined: !added })
})

/** How many people are on the waitlist — shown as social proof on the page. */
earlyAccessRouter.get('/api/waitlist/count', async (_req: Request, res: Response) => {
  const row = await sql.get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM waitlist')
  res.set('Cache-Control', 'no-store')
  res.json({ count: row?.n ?? 0 })
})
