/**
 * Google sign-in wiring checks.
 *
 *   npm run test:google
 *
 * Proves that the server registers the Google provider and builds a correct
 * OAuth request, without contacting Google and without any real credentials.
 *
 * Two scenarios are run in separate child processes, because server/env.ts
 * reads the environment once at module load:
 *
 *   without  no GOOGLE_* variables -> provider must be absent, not half-wired
 *   with     placeholder values     -> provider must be registered and must
 *                                     produce a valid accounts.google.com URL
 *
 * The placeholders are obviously fake and exist only for the length of the
 * child process. Nothing is written to .env or to GitHub.
 */
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FAKE_ID = '000000000000-placeholder.apps.googleusercontent.com'
const FAKE_SECRET = 'placeholder-not-a-real-secret'
const PUBLIC_ORIGIN = 'http://localhost:5173'
const EXPECTED_CALLBACK = `${PUBLIC_ORIGIN}/api/auth/callback/google`

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Boots the real auth handler and returns a base URL to talk to. */
async function boot() {
  const tmp = mkdtempSync(join(tmpdir(), 'opennote-google-'))
  process.env.DATABASE_PATH = join(tmp, 'test.db')
  process.env.BETTER_AUTH_URL = PUBLIC_ORIGIN
  process.env.BETTER_AUTH_SECRET = 'g'.repeat(64)
  process.env.SMTP_HOST = ''
  process.env.GOOGLE_CLIENT_ID = ''
  process.env.GOOGLE_CLIENT_SECRET = ''
  process.env.SMTP_USER = ''
  process.env.SMTP_PASS = ''

  if (process.argv[2] === 'with') {
    process.env.GOOGLE_CLIENT_ID = FAKE_ID
    process.env.GOOGLE_CLIENT_SECRET = FAKE_SECRET
  } else if (process.argv[2] === 'half') {
    // A client id with no secret is the most likely real-world misconfiguration.
    process.env.GOOGLE_CLIENT_ID = FAKE_ID
  }

  const express = (await import('express')).default
  const { toNodeHandler } = await import('better-auth/node')
  const { auth } = await import('../server/auth.ts')
  const { googleConfigured } = await import('../server/env.ts')
  const { getMigrations } = await import('better-auth/db/migration')
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options)
  if (toBeCreated.length || toBeAdded.length) await runMigrations()

  const app = express()
  app.disable('x-powered-by')
  // Mounted before any body parser, exactly as server/index.ts does.
  app.all('/api/auth/*splat', toNodeHandler(auth))
  app.get('/api/auth-config', (_req, res) => res.json({ google: googleConfigured }))

  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((r) => server.once('listening', () => r()))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  return {
    base,
    googleConfigured,
    close: async () => {
      const { db } = await import('../server/db.ts')
      server.close()
      await new Promise((r) => createServer().close(r))
      db.close()
      await new Promise((r) => setTimeout(r, 100))
      rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    },
  }
}

async function main() {
  const scenario = process.argv[2] ?? 'without'
  const label = scenario === 'with' ? 'Google credentials present' : scenario === 'half' ? 'Client id but no secret' : 'No credentials'
  console.log(`\n  ${label}`)

  const app = await boot()
  try {
    const config = await fetch(`${app.base}/api/auth-config`)
    const configBody = (await config.json()) as { google: boolean }
    const expected = scenario === 'with'
    check('the server reports the expected configured state', configBody.google === expected, `google=${configBody.google}`)

    // Better Auth 1.7.x registers /sign-in/social as POST-only and answers
    // with JSON { url, redirect } rather than a 302 - the browser client then
    // navigates. This mirrors exactly what authClient.signIn.social() does.
    const res = await fetch(`${app.base}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google', callbackURL: `${PUBLIC_ORIGIN}/app` }),
    })
    const text = await res.text()

    if (!expected) {
      check('the social endpoint refuses rather than half-working', res.status === 404, `status ${res.status}`)
      check('no Google URL is produced', !text.includes('accounts.google.com'), text.slice(0, 80))
      return
    }

    check('the social endpoint accepts the request', res.status === 200, `status ${res.status} ${text.slice(0, 80)}`)

    let url = ''
    try {
      url = (JSON.parse(text) as { url?: string }).url ?? ''
    } catch {
      /* the assertion below reports it */
    }

    check('it returns an authorisation URL', Boolean(url), text.slice(0, 80))
    check('it points at Google', url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), url.slice(0, 90))

    const google = new URL(url)
    check('it sends the client id', google.searchParams.get('client_id') === FAKE_ID, String(google.searchParams.get('client_id')))
    check('it sends the redirect_uri', google.searchParams.get('redirect_uri') === EXPECTED_CALLBACK, String(google.searchParams.get('redirect_uri')))
    const scopes = (google.searchParams.get('scope') ?? '').split(' ').filter(Boolean).sort()
    check(
      'it requests openid, email and profile',
      ['email', 'openid', 'profile'].every((s) => scopes.includes(s)),
      String(google.searchParams.get('scope')),
    )
    check('it includes a CSRF state parameter', Boolean(google.searchParams.get('state')))
    check('the client secret is never sent to the browser', !text.includes(FAKE_SECRET))
    check('the client secret never appears in the Google URL', !url.includes(FAKE_SECRET))
  } finally {
    await app.close()
  }
}

// Parent: run each scenario in its own process so env.ts re-reads the
// environment. server/env.ts captures the environment at module load, so these
// scenarios genuinely cannot share a process.
if (!process.argv[2]) {
  let failed = 0
  for (const scenario of ['without', 'half', 'with']) {
    const run = spawnSync(process.execPath, [process.argv[1], scenario], { stdio: 'inherit' })
    if (run.status !== 0) failed += 1
  }
  console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} scenario(s) failed.`)
  process.exit(failed === 0 ? 0 : 1)
}

await main()
console.log(failures === 0 ? '  all checks passed\n' : `  ${failures} check(s) failed\n`)
process.exit(failures === 0 ? 0 : 1)
