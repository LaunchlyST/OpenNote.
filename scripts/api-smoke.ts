/**
 * Boots the real OpenNote API server (server/index.ts) on a throwaway
 * database and checks what matters before inviting real users:
 *
 * - each account sees and changes only its own calendar, notes and settings
 * - every private endpoint refuses anonymous requests
 * - bad workspace data is rejected
 * - new accounts are on the Free plan, which cannot be changed from the
 *   browser, and Pro cannot be bought or reached
 * - admin-only routes refuse ordinary users
 * - accounts, sessions and data survive a server restart
 * - development-only endpoints do not exist in production mode
 *
 * Run with: npm run test:api
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'opennote-api-'))
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

const PASSWORD = 'a-long-enough-password'
const workspace = (tag: string) => ({
  events: [{ id: `e-${tag}`, title: `${tag} event`, start: '2026-10-20T09:00:00.000Z', end: '2026-10-20T10:00:00.000Z', calendarId: 'work' }],
  calendars: [{ id: 'work', name: 'Work', color: 'lime', visible: true }],
  notes: [{ id: `n-${tag}`, title: `${tag} note`, body: 'private', date: '2026-10-20', createdAt: 1 }],
  settings: { weekStartsOn: 1 },
})

let server = await boot()
try {
  console.log('\n  Two accounts, fully separate')
  const a = await req('POST', '/api/auth/sign-up/email', { name: 'Alice', email: 'alice@opennote.test', password: PASSWORD })
  const b = await req('POST', '/api/auth/sign-up/email', { name: 'Bob', email: 'bob@opennote.test', password: PASSWORD })
  check('both accounts are created', a.status === 200 && b.status === 200, `${a.status}/${b.status}`)
  const dup = await req('POST', '/api/auth/sign-up/email', { name: 'Alice 2', email: 'ALICE@opennote.test', password: PASSWORD })
  check('a duplicate email (any case) is refused', dup.status === 422 || dup.status === 400, `got ${dup.status}`)
  const badEmail = await req('POST', '/api/auth/sign-up/email', { name: 'X', email: 'not-an-email', password: PASSWORD })
  check('an invalid email is refused', badEmail.status === 400, `got ${badEmail.status}`)

  const saveA = await req('PUT', '/api/workspace', { data: workspace('alice') }, a.cookies)
  const saveB = await req('PUT', '/api/workspace', { data: workspace('bob') }, b.cookies)
  check('each saves their own workspace', saveA.status === 200 && saveB.status === 200)

  const readA = await req('GET', '/api/workspace', undefined, a.cookies)
  const readB = await req('GET', '/api/workspace', undefined, b.cookies)
  check('Alice reads only Alice’s data', readA.text.includes('alice note') && !readA.text.includes('bob'))
  check('Bob reads only Bob’s data', readB.text.includes('bob note') && !readB.text.includes('alice'))

  const sneaky = await req('GET', '/api/workspace?userId=alice', undefined, b.cookies)
  check('no parameter lets Bob read Alice’s workspace', !sneaky.text.includes('alice'))

  console.log('\n  Anonymous requests are refused')
  for (const [m, p] of [['GET', '/api/workspace'], ['PUT', '/api/workspace'], ['GET', '/api/plan'], ['POST', '/api/billing/checkout'], ['GET', '/api/admin/mail-log'], ['GET', '/api/deploy']] as const) {
    const r = await req(m, p, m === 'PUT' ? { data: workspace('x') } : undefined)
    check(`${m} ${p} → 401`, r.status === 401, `got ${r.status}`)
  }

  console.log('\n  Workspace validation')
  const bad = [
    ['event with a non-date start', { ...workspace('v'), events: [{ ...workspace('v').events[0], start: 'tomorrow-ish' }] }],
    ['event ending before it starts', { ...workspace('v'), events: [{ ...workspace('v').events[0], end: '2026-10-19T00:00:00.000Z' }] }],
    ['note with a malformed day', { ...workspace('v'), notes: [{ ...workspace('v').notes[0], date: '20/10/2026' }] }],
    ['missing lists', { settings: {} }],
  ] as const
  for (const [label, data] of bad) {
    const r = await req('PUT', '/api/workspace', { data }, a.cookies)
    check(`rejects ${label}`, r.status === 400, `got ${r.status}`)
  }
  const still = await req('GET', '/api/workspace', undefined, a.cookies)
  check('rejected saves leave the stored data untouched', still.text.includes('alice note'))

  console.log('\n  Free plan')
  const plan = await req('GET', '/api/plan', undefined, a.cookies)
  check('new accounts are on Free', plan.json?.plan === 'free', plan.text)
  check('Pro is reported as not available yet', plan.json?.proAvailable === false)
  const session = await req('GET', '/api/auth/get-session', undefined, a.cookies)
  check('the session carries plan "free"', (session.json?.user as { plan?: string })?.plan === 'free')
  const upgrade = await req('POST', '/api/auth/update-user', { plan: 'pro' }, a.cookies)
  const after = await req('GET', '/api/plan', undefined, a.cookies)
  check('the browser cannot set its own plan', upgrade.status === 400 && after.json?.plan === 'free', `${upgrade.status} → ${after.json?.plan}`)
  const signupPro = await req('POST', '/api/auth/sign-up/email', { name: 'P', email: 'p@opennote.test', password: PASSWORD, plan: 'pro' })
  const proPlan = signupPro.status === 200 ? (await req('GET', '/api/plan', undefined, signupPro.cookies)).json?.plan : 'refused'
  check('sign-up cannot choose Pro (refused or ignored → Free)', proPlan === 'refused' || proPlan === 'free', `${signupPro.status} → ${proPlan}`)
  const checkout = await req('POST', '/api/billing/checkout', {}, a.cookies)
  check('Pro cannot be purchased (checkout refused)', checkout.status === 403, `got ${checkout.status}`)
  const pro = await req('GET', '/api/pro/anything', undefined, a.cookies)
  check('Pro-only endpoints refuse Free accounts', pro.status === 403, `got ${pro.status}`)

  console.log('\n  Admin-only routes')
  const mlog = await req('GET', '/api/admin/mail-log', undefined, a.cookies)
  check('the mail log refuses a normal user', mlog.status === 403, `got ${mlog.status}`)
  const dep = await req('GET', '/api/deploy', undefined, a.cookies)
  check('deploy controls refuse a normal user', dep.status === 403, `got ${dep.status}`)

  console.log('\n  Server restart')
  await stop(server)
  server = await boot()
  const again = await req('GET', '/api/workspace', undefined, a.cookies)
  check('the session survives a restart', again.status === 200, `got ${again.status}`)
  check('the data survives a restart', again.text.includes('alice note'))
  const login = await req('POST', '/api/auth/sign-in/email', { email: 'bob@opennote.test', password: PASSWORD })
  check('accounts survive a restart (Bob can sign in)', login.status === 200, `got ${login.status}`)
  const out = await req('POST', '/api/auth/sign-out', {}, a.cookies)
  const gone = await req('GET', '/api/workspace', undefined, a.cookies)
  check('after sign-out the old cookie is useless', out.status === 200 && gone.status === 401, `${out.status}/${gone.status}`)

  console.log('\n  Development endpoints')
  const dev = await req('GET', '/api/dev/mail')
  check('the dev inbox exists in development', dev.status === 200, `got ${dev.status}`)
  await stop(server)
  server = await boot({ NODE_ENV: 'production', MAIL_TRANSPORT: 'local' })
  const prod = await req('GET', '/api/dev/mail')
  check('the dev inbox does not exist in production', prod.status === 404 && !prod.text.includes('dev inbox'), `got ${prod.status}`)
  const unknown = await req('GET', '/api/does-not-exist')
  check('unknown API paths are 404 JSON in production', unknown.status === 404 && unknown.json !== null, `got ${unknown.status}`)
  const cookieFlags = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': '10.7.7.7' },
    body: JSON.stringify({ email: 'bob@opennote.test', password: PASSWORD }),
  })
  const sc = cookieFlags.headers.getSetCookie().find((c) => c.includes('session_token')) ?? ''
  check('session cookie is HttpOnly and SameSite=Lax', /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc), sc)
} finally {
  await stop(server).catch(() => {})
  rmSync(tmp, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
