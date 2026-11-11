import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { join } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'opennote-launch-'))
const PORT = 3900 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = `http://localhost:${PORT}`

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function boot(extra: Record<string, string> = {}): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      BETTER_AUTH_URL: ORIGIN,
      BETTER_AUTH_SECRET: 'd'.repeat(64),
      DATABASE_PATH: join(tmp, 'api.db'),
      MAILBOX_DIR: join(tmp, 'mailbox'),
      API_PORT: String(PORT),
      SMTP_HOST: '',
      ADMIN_EMAILS: '',
      REQUIRE_EMAIL_VERIFICATION: 'false',
      ...extra,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout!.on('data', (d) => (log += d))
  child.stderr!.on('data', (d) => (log += d))
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (log.includes('listening')) {
        clearInterval(t)
        resolve(child)
      }
    }, 100)
    child.once('exit', (code) => {
      clearInterval(t)
      reject(new Error(`server exited (${code}):\n${log}`))
    })
  })
}

function stop(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
  })
}

let ip = 0
async function req(method: string, path: string, body?: unknown, cookie = '') {
  ip += 1
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      'x-forwarded-for': `10.1.${ip >> 8}.${ip & 255}`,
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
    /* not json */
  }
  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .filter((c) => !c.endsWith('='))
    .join('; ')
  return { status: res.status, json, text, cookies }
}


/**
 * Launch modes: Under construction → Waitlist → Public launch.
 * Only an admin can switch; sign-up stays limited until the public launch;
 * the waitlist saves each email once and refuses the spam trap.
 * Run with: npm run test:launch
 */
const PASSWORD = 'a-long-enough-password'
const ADMIN = 'boss@example.com'
const signUp = (email: string) => req('POST', '/api/auth/sign-up/email', { email, password: PASSWORD, name: email.split('@')[0] })

const ENV = { ADMIN_EMAILS: ADMIN, SIGNUP_ALLOWLIST: `${ADMIN},member@example.com` }
let server = await boot(ENV)
try {
  check('starts in waitlist mode', (await req('GET', '/api/launch/status')).json?.mode === 'waitlist')
  const signedUp = await signUp(ADMIN)
  const member = await signUp('member@example.com')
  // Admin needs a verified email: verify it on the throwaway database, restart so roles re-sync, sign in again.
  await stop(server)
  const db = new Database(join(tmp, 'api.db'))
  db.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE email = ?').run(ADMIN)
  db.close()
  server = await boot(ENV)
  const admin = await req('POST', '/api/auth/sign-in/email', { email: ADMIN, password: PASSWORD })
  check('admin signed in', signedUp.status === 200 && admin.status === 200)
  check('allowlisted accounts can sign up before launch', admin.status === 200 && member.status === 200, `${admin.status} ${member.status}`)
  check('strangers cannot sign up before launch', (await signUp('stranger@example.com')).status !== 200)

  check('anonymous visitors cannot change the mode', (await req('POST', '/api/admin/launch/mode', { mode: 'launched' })).status === 401)
  check('ordinary users cannot change the mode', (await req('POST', '/api/admin/launch/mode', { mode: 'launched' }, member.cookies)).status === 403)
  check('still waitlist after refused attempts', (await req('GET', '/api/launch/status')).json?.mode === 'waitlist')
  check('unknown modes are refused', (await req('POST', '/api/admin/launch/mode', { mode: 'party' }, admin.cookies)).status === 400)

  const c = await req('POST', '/api/admin/launch/mode', { mode: 'construction' }, admin.cookies)
  check('admin switches to Under construction', c.status === 200 && (await req('GET', '/api/launch/status')).json?.mode === 'construction')

  const j1 = await req('POST', '/api/waitlist', { email: 'Fan@Example.com' })
  const j2 = await req('POST', '/api/waitlist', { email: 'fan@example.com' })
  check('waitlist saves an email', j1.status === 200 && j1.json?.ok === true && j1.json?.alreadyJoined === false)
  check('a duplicate is recognised, not saved twice', j2.status === 200 && j2.json?.alreadyJoined === true && (await req('GET', '/api/waitlist/count')).json?.count === 1)
  check('the spam trap is refused', (await req('POST', '/api/waitlist', { email: 'bot@example.com', website: 'http://spam' })).status === 400 && (await req('GET', '/api/waitlist/count')).json?.count === 1)
  check('bad emails are refused', (await req('POST', '/api/waitlist', { email: 'nope' })).status === 400)

  await req('POST', '/api/admin/launch/mode', { mode: 'waitlist' }, admin.cookies)
  check('admin switches to Waitlist', (await req('GET', '/api/launch/status')).json?.mode === 'waitlist')
  check('landing stays locked before launch', (await req('GET', '/api/early-access/status')).json?.unlocked === false)

  await req('POST', '/api/admin/launch/mode', { mode: 'launched' }, admin.cookies)
  check('admin switches to Public launch', (await req('GET', '/api/launch/status')).json?.mode === 'launched')
  check('after launch the landing page opens for everyone', (await req('GET', '/api/early-access/status')).json?.unlocked === true)
  check('after launch anyone can sign up', (await signUp('newbie@example.com')).status === 200)
  check('existing accounts still sign in', (await req('POST', '/api/auth/sign-in/email', { email: 'member@example.com', password: PASSWORD })).status === 200)
  check('waitlist emails are kept', (await req('GET', '/api/waitlist/count')).json?.count === 1)

  await req('POST', '/api/admin/launch/mode', { mode: 'waitlist' }, admin.cookies)
  check('admin can go back to Waitlist', (await req('GET', '/api/launch/status')).json?.mode === 'waitlist' && (await signUp('late@example.com')).status !== 200)
} finally {
  await stop(server)
  rmSync(tmp, { recursive: true, force: true })
}
if (failures) {
  console.log(`\n${failures} launch check(s) failed.`)
  process.exit(1)
}
console.log('\nAll launch checks passed.')
