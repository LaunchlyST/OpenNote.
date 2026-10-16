/**
 * End-to-end checks for OpenNote's authentication.
 *
 * Run with: npm run test:auth
 *
 * Boots the real Better Auth handler on a throwaway SQLite database and talks
 * to it over HTTP, exactly as the browser does: sign-up, sign-in with and
 * without "Remember me", sign-out, administrator roles, and the password reset
 * round trip. Your real database is never opened.
 */
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'

const tmp = mkdtempSync(join(tmpdir(), 'opennote-auth-'))
const ORIGIN = 'http://localhost:3001'

process.env.NODE_ENV = 'development' // 'test' would switch off Better Auth's origin checks
process.env.BETTER_AUTH_URL = ORIGIN
process.env.BETTER_AUTH_SECRET = 'b'.repeat(64)
process.env.DATABASE_PATH = join(tmp, 'test.db')
process.env.SMTP_HOST = ''
process.env.ADMIN_EMAILS = 'owner@opennote.test'
process.env.REQUIRE_EMAIL_VERIFICATION = 'false'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// Without SMTP, development mail is printed to the console. Capture it.
const mail: string[] = []
const realInfo = console.info
console.info = (...args: unknown[]) => {
  mail.push(args.join(' '))
}

const { applyMigrations } = await import('../server/schema.ts')
await applyMigrations({ quiet: true })
const { toNodeHandler } = await import('better-auth/node')
const { auth } = await import('../server/auth.ts')
const { db } = await import('../server/db.ts')
const { syncRoles, verifyEmail } = await import('../server/roles.ts')

const app = express()
app.all('/api/auth/*splat', toNodeHandler(auth))
const server = app.listen(0, '127.0.0.1')
await new Promise<void>((resolve) => server.once('listening', () => resolve()))
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

interface Res {
  status: number
  body: Record<string, unknown> | null
  cookies: string[]
}

// Better Auth limits sign-in attempts per IP. Each request poses as its own
// visitor so the checks below are not throttled by one another.
let visitor = 0

async function call(path: string, body?: unknown, cookie = ''): Promise<Res> {
  visitor += 1
  const res = await fetch(`${BASE}/api/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: ORIGIN,
      'x-forwarded-for': `10.0.${visitor >> 8}.${visitor & 255}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  return { status: res.status, body: parsed, cookies: res.headers.getSetCookie() }
}

/** The cookie header a browser would send back after this response. */
function jar(res: Res) {
  return res.cookies
    .map((c) => c.split(';')[0])
    .filter((c) => !c.endsWith('='))
    .join('; ')
}

const sessionCookie = (res: Res) => res.cookies.find((c) => c.startsWith('better-auth.session_token=')) ?? ''
const role = (email: string) =>
  (db.prepare('SELECT role FROM "user" WHERE email = ?').get(email) as { role: string } | undefined)?.role

const PASSWORD = 'a-long-enough-password'

try {
  console.log('\n  Database migration')
  {
    const cols = (db.prepare('PRAGMA table_info("user")').all() as Array<{ name: string }>).map((c) => c.name)
    check('user.role column exists', cols.includes('role'))
    check('admin plugin ban columns exist', cols.includes('banned') && cols.includes('banExpires'))
  }

  console.log('\n  Sign up, sign in, sign out')
  {
    const up = await call('/sign-up/email', { name: 'Sam User', email: 'sam@opennote.test', password: PASSWORD })
    check('sign-up succeeds', up.status === 200, `got ${up.status}`)
    check('new accounts get the user role', role('sam@opennote.test') === 'user')

    const bad = await call('/sign-in/email', { email: 'sam@opennote.test', password: 'wrong-password-123' })
    check('a wrong password is rejected', bad.status === 401, `got ${bad.status}`)

    const inn = await call('/sign-in/email', { email: 'sam@opennote.test', password: PASSWORD })
    check('sign-in succeeds', inn.status === 200, `got ${inn.status}`)
    const cookie = jar(inn)
    const me = await call('/get-session', undefined, cookie)
    check('the session identifies the user', (me.body?.user as { email?: string })?.email === 'sam@opennote.test')

    const out = await call('/sign-out', {}, cookie)
    check('sign-out succeeds', out.status === 200, `got ${out.status}`)
    const after = await call('/get-session', undefined, cookie)
    check('the old cookie no longer has a session', after.body === null)

    // Repeated guesses from one address are throttled.
    const codes: number[] = []
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
        body: JSON.stringify({ email: 'sam@opennote.test', password: 'guess-guess-guess' }),
      })
      codes.push(r.status)
    }
    check('repeated wrong passwords are rate limited', codes.includes(429), codes.join(','))
  }

  console.log('\n  Remember me')
  {
    const on = await call('/sign-in/email', { email: 'sam@opennote.test', password: PASSWORD, rememberMe: true })
    const onCookie = sessionCookie(on)
    check('checked: the cookie is persistent (Max-Age set)', /Max-Age=\d+/i.test(onCookie), onCookie)
    const days = Number(/Max-Age=(\d+)/i.exec(onCookie)?.[1] ?? 0) / 86400
    check('checked: it lasts about 30 days', days > 29 && days <= 30, `${days.toFixed(1)} days`)

    const off = await call('/sign-in/email', { email: 'sam@opennote.test', password: PASSWORD, rememberMe: false })
    const offCookie = sessionCookie(off)
    check('unchecked: a sign-in still succeeds', off.status === 200, `got ${off.status}`)
    check('unchecked: the cookie ends with the browser (no Max-Age/Expires)', Boolean(offCookie) && !/Max-Age|Expires/i.test(offCookie), offCookie)
    const me = await call('/get-session', undefined, jar(off))
    check('unchecked: the session works while the browser is open', (me.body?.user as { email?: string })?.email === 'sam@opennote.test')
  }

  console.log('\n  Administrator roles')
  {
    const up = await call('/sign-up/email', {
      name: 'Owner',
      email: 'owner@opennote.test',
      password: PASSWORD,
    })
    check('the owner can sign up', up.status === 200, `got ${up.status}`)
    check('an unverified admin email is only a user', role('owner@opennote.test') === 'user')

    const sneaky = await call('/sign-up/email', { name: 'X', email: 'x@opennote.test', password: PASSWORD, role: 'admin' })
    check('a role sent with sign-up is refused', sneaky.status === 400 && role('x@opennote.test') === undefined, `got ${sneaky.status}`)

    const userCookie = jar(await call('/sign-in/email', { email: 'sam@opennote.test', password: PASSWORD }))
    const promote = await call('/admin/set-role', { userId: 'anything', role: 'admin' }, userCookie)
    check('a user cannot call admin endpoints', promote.status === 401 || promote.status === 403, `got ${promote.status}`)

    verifyEmail('owner@opennote.test')
    check('after verification the owner is admin', role('owner@opennote.test') === 'admin')

    const adminCookie = jar(await call('/sign-in/email', { email: 'owner@opennote.test', password: PASSWORD }))
    const session = await call('/get-session', undefined, adminCookie)
    check('the session reports role admin', (session.body?.user as { role?: string })?.role === 'admin')
    const list = await call('/admin/list-users?limit=10', undefined, adminCookie)
    check('the admin can use admin endpoints', list.status === 200, `got ${list.status}`)

    db.prepare('UPDATE "user" SET role = ? WHERE email = ?').run('admin', 'sam@opennote.test')
    syncRoles()
    check('a role set outside ADMIN_EMAILS is revoked on sync', role('sam@opennote.test') === 'user')
  }

  console.log('\n  Password reset')
  {
    const oldCookie = jar(await call('/sign-in/email', { email: 'sam@opennote.test', password: PASSWORD }))
    mail.length = 0
    const req = await call('/request-password-reset', { email: 'sam@opennote.test', redirectTo: `${ORIGIN}/app/reset-password` })
    check('a reset can be requested', req.status === 200, `got ${req.status}`)
    const link = mail.join('\n').match(/https?:\/\/\S+reset-password\/(\w+)\S*/)
    check('a reset email was produced', Boolean(link), mail.join(' | '))
    const token = link?.[1] ?? ''
    check('the reset link points at the site URL (BETTER_AUTH_URL)', Boolean(link?.[0].startsWith(`${ORIGIN}/api/auth/reset-password/`)), link?.[0])
    check('the link returns the user to the reset page', Boolean(link?.[0].includes(encodeURIComponent(`${ORIGIN}/app/reset-password`))), link?.[0])

    // Better Auth checks redirectTo against trustedOrigins. Whether it refuses
    // the request or the link, the browser must never land on another site.
    mail.length = 0
    const evil = await call('/request-password-reset', { email: 'sam@opennote.test', redirectTo: 'https://evil.example/steal' })
    const evilLink = mail.join('\n').match(/https?:\/\/\S+reset-password\/\w+\S*/)?.[0]
    let landed = ''
    if (evil.status === 200 && evilLink) {
      const r = await fetch(evilLink.replace(ORIGIN, BASE), { redirect: 'manual', headers: { origin: ORIGIN } })
      landed = r.headers.get('location') ?? `status ${r.status}`
    }
    check('a reset link cannot send the user to another site', evil.status >= 400 || !landed.includes('evil.example'), `${evil.status} → ${landed}`)

    const ghost = await call('/request-password-reset', { email: 'nobody@opennote.test', redirectTo: `${ORIGIN}/app` })
    check('unknown emails get the same answer (no account probing)', ghost.status === 200)

    const row = db.prepare("SELECT expiresAt FROM verification WHERE identifier = ?").get(`reset-password:${token}`) as
      | { expiresAt: string | number }
      | undefined
    const mins = row ? (new Date(row.expiresAt).getTime() - Date.now()) / 60000 : 0
    check('the link expires in about one hour', mins > 55 && mins <= 60, `${mins.toFixed(0)} min`)

    const reset = await call('/reset-password', { token, newPassword: 'a-brand-new-password' })
    check('the token sets a new password', reset.status === 200, `got ${reset.status}`)
    const reuse = await call('/reset-password', { token, newPassword: 'yet-another-password' })
    check('the token cannot be used twice', reuse.status === 400, `got ${reuse.status}`)

    const oldPw = await call('/sign-in/email', { email: 'sam@opennote.test', password: PASSWORD })
    check('the old password no longer works', oldPw.status === 401, `got ${oldPw.status}`)
    const newPw = await call('/sign-in/email', { email: 'sam@opennote.test', password: 'a-brand-new-password' })
    check('the new password works', newPw.status === 200, `got ${newPw.status}`)
    const stale = await call('/get-session', undefined, oldCookie)
    check('other devices are signed out after a reset', stale.body === null)

    const forged = await call('/reset-password', { token: 'not-a-real-token', newPassword: 'whatever-password' })
    check('a forged token is rejected', forged.status === 400, `got ${forged.status}`)
  }
} finally {
  console.info = realInfo
  server.close()
  db.close()
  rmSync(tmp, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
