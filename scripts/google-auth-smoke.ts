/**
 * Google sign-in, end to end through Better Auth's real OAuth code, with
 * Google's token endpoint replaced by a stand-in INSIDE THIS TEST ONLY.
 *
 * Run with: npm run test:google
 *
 * Proves the security properties that matter: the account chooser is
 * requested, PKCE and the state check are enforced, a cancelled or forged
 * callback creates no session, a Google account can never be used to log in
 * with a made-up password, and an unverified look-alike account cannot
 * capture a Google login. It does NOT prove the real Google Cloud client is
 * configured — that needs a real sign-in against Google.
 */
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'

const tmp = mkdtempSync(join(tmpdir(), 'opennote-google-'))
const ORIGIN = 'http://localhost:3002'
process.env.NODE_ENV = 'development'
process.env.BETTER_AUTH_URL = ORIGIN
process.env.BETTER_AUTH_SECRET = 'g'.repeat(64)
process.env.DATABASE_PATH = join(tmp, 'g.db')
process.env.MAILBOX_DIR = join(tmp, 'mailbox')
process.env.SMTP_HOST = ''
process.env.REQUIRE_EMAIL_VERIFICATION = 'false'
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/* -------- Stand-in for https://oauth2.googleapis.com/token (test only) -------- */
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const idToken = (claims: Record<string, unknown>) =>
  `${b64({ alg: 'RS256', typ: 'JWT', kid: 'test' })}.${b64({ iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}.sig`
/** code → the Google identity that code stands for */
const googleCodes = new Map<string, Record<string, unknown>>()
const tokenRequests: string[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    const body = String(init?.body ?? '')
    tokenRequests.push(body)
    const code = new URLSearchParams(body).get('code') ?? ''
    const who = googleCodes.get(code)
    if (!who) return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ access_token: 'at-' + code, expires_in: 3600, token_type: 'Bearer', id_token: idToken(who) }), {
      headers: { 'content-type': 'application/json' },
    })
  }
  return realFetch(input as RequestInfo, init)
}) as typeof fetch

const { applyMigrations } = await import('../server/schema.ts')
await applyMigrations({ quiet: true })
const { toNodeHandler } = await import('better-auth/node')
const { auth } = await import('../server/auth.ts')
const { db } = await import('../server/db.ts')
const { verifyEmail } = await import('../server/roles.ts')

const app = express()
app.all('/api/auth/*splat', toNodeHandler(auth))
const server = app.listen(0, '127.0.0.1')
await new Promise<void>((r) => server.once('listening', () => r()))
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

let ip = 0
async function call(method: string, path: string, body?: unknown, cookie = '') {
  ip += 1
  const res = await realFetch(`${BASE}/api/auth${path}`, {
    method,
    redirect: 'manual',
    headers: {
      origin: ORIGIN,
      'x-forwarded-for': `10.3.${ip >> 8}.${ip & 255}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(text)
  } catch {
    /* redirect or text */
  }
  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .filter((c) => !c.endsWith('='))
  return { status: res.status, json, text, location: res.headers.get('location') ?? '', cookies }
}
const jar = (...lists: string[][]) => lists.flat().join('; ')
const hasSession = (cookies: string[]) => cookies.some((c) => c.startsWith('better-auth.session_token='))

/** Starts "Continue with Google" and returns the Google URL + the browser's cookies. */
async function startGoogle() {
  const r = await call('POST', '/sign-in/social', {
    provider: 'google',
    callbackURL: `${ORIGIN}/app`,
    errorCallbackURL: `${ORIGIN}/app/signin`,
    newUserCallbackURL: `${ORIGIN}/app`,
  })
  return { url: new URL(String(r.json?.url ?? 'http://invalid')), cookies: r.cookies, status: r.status }
}
/** Google "redirects back" with this code. */
async function finishGoogle(start: { url: URL; cookies: string[] }, code: string, identity?: Record<string, unknown>) {
  if (identity) googleCodes.set(code, identity)
  const state = start.url.searchParams.get('state') ?? ''
  return call('GET', `/callback/google?state=${encodeURIComponent(state)}&code=${code}`, undefined, jar(start.cookies))
}
const userCount = (email: string) => (db.prepare('SELECT count(*) n FROM "user" WHERE email = ?').get(email) as { n: number }).n

try {
  console.log('\n  Continue with Google → Google’s own page')
  {
    const s = await startGoogle()
    check('the button starts a real OAuth request', s.status === 200 && s.url.origin === 'https://accounts.google.com', s.url.href)
    check('Google’s account chooser is requested (prompt=select_account)', s.url.searchParams.get('prompt') === 'select_account')
    check('a random state is sent (CSRF protection)', (s.url.searchParams.get('state') ?? '').length >= 20)
    check('PKCE is used (S256 code challenge)', s.url.searchParams.get('code_challenge_method') === 'S256' && Boolean(s.url.searchParams.get('code_challenge')))
    check('the return address is OpenNote’s callback', s.url.searchParams.get('redirect_uri') === `${ORIGIN}/api/auth/callback/google`)
    check('only identity scopes are requested', (s.url.searchParams.get('scope') ?? '').split(' ').sort().join(' ') === 'email openid profile')
    check('the client secret is never in the browser URL', !s.url.href.includes('test-client-secret'))
  }

  console.log('\n  New and returning Google users')
  let firstUserId = ''
  {
    const s = await startGoogle()
    const r = await finishGoogle(s, 'code-new', { sub: 'google-sub-1', email: 'newperson@gmail.com', email_verified: true, name: 'New Person' })
    check('a new Google user is signed in', r.status === 302 && hasSession(r.cookies), `${r.status} ${r.location}`)
    check('…and sent to the dashboard', r.location === `${ORIGIN}/app`, r.location)
    check('an OpenNote account is created for them', userCount('newperson@gmail.com') === 1)
    const verifier = new URLSearchParams(tokenRequests.at(-1)).get('code_verifier')
    check('the code was exchanged with the PKCE verifier and client secret', Boolean(verifier) && tokenRequests.at(-1)!.includes('client_secret'))
    const me = await call('GET', '/get-session', undefined, jar(r.cookies))
    firstUserId = String((me.json?.user as { id?: string })?.id ?? '')
    check('the account is marked email-verified (Google verified it)', (me.json?.user as { emailVerified?: boolean })?.emailVerified === true)

    const s2 = await startGoogle()
    const again = await finishGoogle(s2, 'code-again', { sub: 'google-sub-1', email: 'newperson@gmail.com', email_verified: true, name: 'New Person' })
    const me2 = await call('GET', '/get-session', undefined, jar(again.cookies))
    check('a returning Google user gets their existing account', (me2.json?.user as { id?: string })?.id === firstUserId && userCount('newperson@gmail.com') === 1)
  }

  console.log('\n  Cancelled, forged and replayed callbacks')
  {
    const s = await startGoogle()
    const state = s.url.searchParams.get('state')!
    const cancel = await call('GET', `/callback/google?state=${encodeURIComponent(state)}&error=access_denied`, undefined, jar(s.cookies))
    check('cancelling on Google returns to sign-in with an error', cancel.status === 302 && cancel.location.startsWith(`${ORIGIN}/app/signin`) && cancel.location.includes('error=access_denied'), cancel.location)
    check('a cancelled sign-in creates no session', !hasSession(cancel.cookies))

    const s2 = await startGoogle()
    googleCodes.set('code-forged', { sub: 'attacker', email: 'attacker@gmail.com', email_verified: true })
    const forged = await call('GET', `/callback/google?state=not-the-real-state&code=code-forged`, undefined, jar(s2.cookies))
    check('a callback with a forged state is rejected', !hasSession(forged.cookies) && userCount('attacker@gmail.com') === 0, `${forged.status} ${forged.location}`)

    const s3 = await startGoogle()
    const noCookie = await call('GET', `/callback/google?state=${encodeURIComponent(s3.url.searchParams.get('state')!)}&code=code-forged`)
    check('a callback from a different browser (no state cookie) is rejected', !hasSession(noCookie.cookies) && userCount('attacker@gmail.com') === 0, `${noCookie.status} ${noCookie.location}`)

    const s4 = await startGoogle()
    const bad = await finishGoogle(s4, 'code-google-never-issued')
    check('an invalid authorisation code is rejected', !hasSession(bad.cookies) && bad.location.includes('error='), bad.location)

    const replay = await finishGoogle(s4, 'code-new')
    check('a used state cannot be replayed', !hasSession(replay.cookies), `${replay.status} ${replay.location}`)

    const noState = await call('GET', '/callback/google?code=code-new')
    check('a callback with no state at all is rejected', !hasSession(noState.cookies), `${noState.status}`)
  }

  console.log('\n  Google accounts and passwords')
  {
    for (const pw of ['', 'guess-1234567', 'a-completely-random-password-9']) {
      const r = await call('POST', '/sign-in/email', { email: 'newperson@gmail.com', password: pw })
      check(`a Google-only account cannot sign in with ${pw ? 'a made-up password' : 'an empty password'}`, r.status !== 200 && !hasSession(r.cookies), `got ${r.status}`)
    }
    const signup = await call('POST', '/sign-up/email', { name: 'Imposter', email: 'newperson@gmail.com', password: 'imposter-pass-123' })
    check('nobody can register a password account over a Google user’s email', signup.status !== 200 && !hasSession(signup.cookies), `got ${signup.status}`)

    // The secure way for a Google user to add a password: reset by email.
    await call('POST', '/request-password-reset', { email: 'newperson@gmail.com', redirectTo: `${ORIGIN}/app/reset-password` })
    const { processOutbox } = await import('../server/mail/index.ts')
    const { readMailbox } = await import('../server/mail/dev-inbox.ts')
    await processOutbox()
    const token = /reset-password\/(\w+)/.exec(readMailbox().find((m) => m.to === 'newperson@gmail.com')?.text ?? '')?.[1] ?? ''
    const set = await call('POST', '/reset-password', { token, newPassword: 'my-own-opennote-pw1' })
    check('a Google user can add an OpenNote password via an emailed link', set.status === 200, `got ${set.status}`)
    const withPw = await call('POST', '/sign-in/email', { email: 'newperson@gmail.com', password: 'my-own-opennote-pw1' })
    const me = await call('GET', '/get-session', undefined, jar(withPw.cookies))
    check('…then Continue with Email works with that password, same account', withPw.status === 200 && (me.json?.user as { id?: string })?.id === firstUserId)
    const wrong = await call('POST', '/sign-in/email', { email: 'newperson@gmail.com', password: 'not-my-opennote-pw1' })
    check('…and any other password is still rejected', wrong.status === 401, `got ${wrong.status}`)
  }

  console.log('\n  Account linking cannot be used for takeover')
  {
    // An attacker registers the victim's address first, without verifying it.
    const pre = await call('POST', '/sign-up/email', { name: 'Attacker', email: 'victim@gmail.com', password: 'attacker-pass-123' })
    check('(setup) attacker registers victim@gmail.com unverified', pre.status === 200)
    const s = await startGoogle()
    const r = await finishGoogle(s, 'code-victim', { sub: 'google-victim', email: 'victim@gmail.com', email_verified: true, name: 'Victim' })
    check('the victim’s Google login is NOT merged into the unverified look-alike account', !hasSession(r.cookies), `${r.status} ${r.location}`)
    const linked = db.prepare(`SELECT count(*) n FROM account a JOIN "user" u ON u.id = a.userId WHERE u.email = 'victim@gmail.com' AND a.providerId = 'google'`).get() as { n: number }
    check('no Google identity was attached to that account', linked.n === 0)
    check('the user is told why (account_not_linked)', /error=account[_ ]not[_ ]linked|error=account%20not%20linked/.test(r.location), r.location)

    // A real owner with a VERIFIED OpenNote account can link Google safely.
    await call('POST', '/sign-up/email', { name: 'Owner', email: 'owner@gmail.com', password: 'strong-pass-1234' })
    verifyEmail('owner@gmail.com')
    const ownerId = (db.prepare('SELECT id FROM "user" WHERE email = ?').get('owner@gmail.com') as { id: string }).id
    const s2 = await startGoogle()
    const r2 = await finishGoogle(s2, 'code-owner', { sub: 'google-owner', email: 'owner@gmail.com', email_verified: true, name: 'Owner' })
    const me = await call('GET', '/get-session', undefined, jar(r2.cookies))
    check('Google links to a verified account with the same verified email', (me.json?.user as { id?: string })?.id === ownerId)

    const s3 = await startGoogle()
    const r3 = await finishGoogle(s3, 'code-unverified-google', { sub: 'google-x', email: 'owner@gmail.com', email_verified: false, name: 'X' })
    check('a Google identity whose email Google has NOT verified is never linked', !hasSession(r3.cookies), r3.location)
  }

  console.log('\n  Session and admin safety')
  {
    const s = await startGoogle()
    const r = await finishGoogle(s, 'code-new-2', { sub: 'google-sub-1', email: 'newperson@gmail.com', email_verified: true, name: 'New Person' })
    const out = await call('POST', '/sign-out', {}, jar(r.cookies))
    const after = await call('GET', '/get-session', undefined, jar(r.cookies))
    check('signing out ends a Google session on the server', out.status === 200 && after.json === null)
    const role = await call('POST', '/update-user', { role: 'admin' }, jar(r.cookies))
    check('a Google user cannot make themselves admin', role.status !== 200 || (db.prepare('SELECT role FROM "user" WHERE email = ?').get('newperson@gmail.com') as { role: string }).role !== 'admin')
  }
} finally {
  globalThis.fetch = realFetch
  server.close()
  db.close()
  rmSync(tmp, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
