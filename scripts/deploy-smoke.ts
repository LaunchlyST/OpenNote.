/**
 * Safety checks for the deployment API.
 *
 * Run with: npm run test:deploy
 *
 * Boots the real Express router against a throwaway SQLite database and a
 * throwaway HTTP server standing in for the hosting provider's deploy hook, so
 * nothing is ever published. The cases that matter are the negative ones: an
 * anonymous visitor cannot deploy, a signed-in non-administrator cannot
 * deploy, and nobody at all can deploy while DEPLOY_ENABLED is unset.
 *
 * The environment must be set before importing server/env.ts, which reads it
 * once at module load.
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'

const SECRET = 'a'.repeat(64)
const tmp = mkdtempSync(join(tmpdir(), 'opennote-deploy-'))

process.env.NODE_ENV = 'test'
process.env.BETTER_AUTH_URL = 'http://localhost:3001'
process.env.BETTER_AUTH_SECRET = SECRET
process.env.DATABASE_PATH = join(tmp, 'test.db')
process.env.SMTP_HOST = ''
// These checks sign users in and expect a session, including one who has not
// verified their address yet. Pin verification off rather than letting it
// follow whatever SMTP happens to be configured on the machine.
process.env.REQUIRE_EMAIL_VERIFICATION = 'false'
process.env.DEPLOY_PROVIDER = 'vercel'
process.env.DEPLOY_PRODUCTION_URL = 'https://opennote.example.com'
process.env.DEPLOY_HOOK_URL = ''
process.env.DEPLOY_ENABLED = 'false'
process.env.ADMIN_EMAILS = 'owner@opennote.test'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`  PASS  ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/* ------------------------------------------------------------------ */
/* A throwaway provider standing in for Vercel's deploy hook          */
/* ------------------------------------------------------------------ */

const hookHits: Array<{ method: string; body: string }> = []
const hook = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    hookHits.push({
      method: req.method ?? '',
      body: Buffer.concat(chunks).toString('utf8'),
    })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
})
await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve))
process.env.DEPLOY_HOOK_URL = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/hook`

/* ------------------------------------------------------------------ */

const { auth } = await import('../server/auth.ts')

// The throwaway database starts empty, so it has to be brought up to date the
// same way the app does it — see `applyMigrations` in server/schema.ts. This
// used to be a hand-rolled copy of just the Better Auth half, which drifted and
// left the auth tables missing, so every signed-in check below failed with 401.
{
  const { applyMigrations } = await import('../server/schema.ts')
  await applyMigrations({ quiet: true })
}

const { deployRouter, publicStatus } = await import('../server/deploy.ts')
const { env: deployEnv } = await import('../server/env.ts')

const app = express()
app.use(express.json())
app.use('/api/deploy', deployRouter())

const server = app.listen(0, '127.0.0.1')
await new Promise<void>((resolve) => server.once('listening', () => resolve()))
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body, raw: JSON.stringify(body) }
}

/** Creates a real account and returns its session cookie header value. */
async function signUp(email: string, password = 'a-long-enough-password') {
  const res = await auth.api.signUpEmail({
    body: { email, password, name: 'Test User' },
    returnHeaders: true,
  })
  const setCookie = res.headers?.get('set-cookie') ?? ''
  return setCookie.split(';')[0]
}

/** Signs an existing account back in and returns its session cookie. */
async function signIn(email: string, password = 'a-long-enough-password') {
  const res = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  })
  const setCookie = res.headers?.get('set-cookie') ?? ''
  return setCookie.split(';')[0]
}

try {
  console.log('\n  Configuration reads from the server only')
  {
    const status = publicStatus()
    check('the hook URL is never in the public status', !JSON.stringify(status).includes(process.env.DEPLOY_HOOK_URL))
    check('the secret is never in the public status', !JSON.stringify(status).includes(SECRET))
    check('status reports the provider label', status.providerLabel === 'Vercel')
    check('status reports not ready while disabled', status.ready === false)
  }

  console.log('\n  Anonymous access is refused')
  {
    const read = await api('/api/deploy')
    check('GET is 401 without a session', read.status === 401, `got ${read.status}`)

    const before = hookHits.length
    const write = await api('/api/deploy', { method: 'POST' })
    check('POST is 401 without a session', write.status === 401, `got ${write.status}`)
    check('nothing reached the provider', hookHits.length === before)
  }

  console.log('\n  A signed-in non-administrator is refused')
  {
    const cookie = await signUp('intruder@opennote.test')
    check('a session was issued', cookie.includes('='))

    const read = await api('/api/deploy', { headers: { cookie } })
    check('GET is 403 for a non-administrator', read.status === 403, `got ${read.status}`)

    const before = hookHits.length
    const write = await api('/api/deploy', { method: 'POST', headers: { cookie } })
    check('POST is 403 for a non-administrator', write.status === 403, `got ${write.status}`)
    check('nothing reached the provider', hookHits.length === before)
  }

  console.log('\n  The administrator is served, but the kill switch holds')
  {
    // On ADMIN_EMAILS but not yet verified: still refused.
    const unverified = await signUp('owner@opennote.test')
    const early = await api('/api/deploy', { headers: { cookie: unverified } })
    check('an unverified admin email is refused', early.status === 403, `got ${early.status}`)

    const { verifyEmail } = await import('../server/roles.ts')
    verifyEmail('owner@opennote.test')
    const cookie = await signIn('owner@opennote.test')
    const before = hookHits.length

    const read = await api('/api/deploy', { headers: { cookie } })
    check('GET succeeds for the administrator', read.status === 200, `got ${read.status}`)
    check('status reports the provider connected', read.body.connected === true)
    check('status reports deployments switched off', read.body.enabled === false)
    check('status reports not ready while off', read.body.ready === false)
    check('the production URL is reported', read.body.productionUrl === 'https://opennote.example.com')
    check('nothing has been deployed yet', read.body.lastDeployment === null)

    const write = await api('/api/deploy', { method: 'POST', headers: { cookie } })
    check('POST is refused while disabled', write.status === 403, `got ${write.status}`)
    check('nothing reached the provider', hookHits.length === before, `${hookHits.length - before} hit(s)`)
  }

  console.log('\n  Enabled: a real request reaches the provider')
  {
    // env.ts reads the environment once at module load, so flipping the flag
    // means mutating the exported object rather than re-importing.
    deployEnv.deploy.enabled = true

    const cookie = await signIn('owner@opennote.test')
    const before = hookHits.length

    const write = await api('/api/deploy', { method: 'POST', headers: { cookie } })
    check('POST is accepted', write.status === 202, `got ${write.status}`)
    check('status reports ready', write.body.ready === true)
    check('the deployment is recorded', Boolean(write.body.lastDeployment))
    check('the provider received exactly one request', hookHits.length === before + 1)
    check('the provider received a POST', hookHits[before]?.method === 'POST')
    check('the request names the admin', String(hookHits[before]?.body).includes('owner@opennote.test'))
    check('no secret was sent to the provider', !String(hookHits[before]?.body).includes(SECRET))

    const again = await api('/api/deploy', { method: 'POST', headers: { cookie } })
    check('a second deploy within a minute is throttled', again.status === 429, `got ${again.status}`)

    const read = await api('/api/deploy', { headers: { cookie } })
    check('the record survives and is readable', Boolean(read.body.lastDeployment))
  }
} finally {
  server.close()
  hook.close()
  // Release the SQLite handle before deleting the file, or Windows refuses.
  const { db } = await import('../server/db.ts')
  db.close()
  await new Promise((r) => setTimeout(r, 100))
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

console.log(
  failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`,
)
process.exit(failures === 0 ? 0 : 1)