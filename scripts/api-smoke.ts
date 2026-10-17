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

  console.log('\n  Projects')
  const listA = await req('GET', '/api/projects?workspace=free', undefined, a.cookies)
  const imported = (listA.json?.projects as Array<{ id: string; name: string }>) ?? []
  check('an existing calendar is kept as a “My Calendar” project', imported.length === 1 && imported[0].name === 'My Calendar', listA.text)
  const importedData = await req('GET', `/api/projects/${imported[0]?.id}`, undefined, a.cookies)
  check('the imported project holds the user’s real data', importedData.text.includes('alice note') && importedData.text.includes('alice event'))
  const listAgain = await req('GET', '/api/projects?workspace=free', undefined, a.cookies)
  check('the import runs only once', (listAgain.json?.projects as unknown[]).length === 1)

  const c = await req('POST', '/api/auth/sign-up/email', { name: 'Cara', email: 'cara@opennote.test', password: PASSWORD })
  const demoMixed = {
    ...workspace('cara'),
    events: [
      ...workspace('cara').events,
      { id: 'demo1', title: 'Team stand-up', start: '2026-10-20T09:00:00.000Z', end: '2026-10-20T09:30:00.000Z', calendarId: 'work', seeded: true },
    ],
    notes: [...workspace('cara').notes, { id: 'demo2', title: 'Grocery list', body: 'Oat milk\nSpinach\nCoffee beans\nRye bread', createdAt: 2 }],
  }
  await req('PUT', '/api/workspace', { data: demoMixed }, c.cookies)
  const cList = await req('GET', '/api/projects?workspace=free', undefined, c.cookies)
  const cId = (cList.json?.projects as Array<{ id: string }>)[0]?.id
  const cData = await req('GET', `/api/projects/${cId}`, undefined, c.cookies)
  check('import drops demo events and notes', !cData.text.includes('Team stand-up') && !cData.text.includes('Grocery list'))
  check('import keeps the user’s own events and notes', cData.text.includes('cara event') && cData.text.includes('cara note'))

  const d = await req('POST', '/api/auth/sign-up/email', { name: 'Dan', email: 'dan@opennote.test', password: PASSWORD })
  await req('PUT', '/api/workspace', { data: { ...demoMixed, events: [demoMixed.events[1]], notes: [demoMixed.notes[1]] } }, d.cookies)
  const dList = await req('GET', '/api/projects?workspace=free', undefined, d.cookies)
  check('demo-only calendars are not imported', (dList.json?.projects as unknown[]).length === 0, dList.text)

  const created = await req('POST', '/api/projects', { workspace: 'free', name: 'Business', color: 'blue', description: 'Work things' }, b.cookies)
  const biz = created.json?.project as { id: string; name: string } | undefined
  check('a project can be created', created.status === 201 && biz?.name === 'Business', created.text)
  const bizData = await req('GET', `/api/projects/${biz?.id}`, undefined, b.cookies)
  const bd = bizData.json?.data as { events: unknown[]; notes: unknown[] }
  check('a new project starts completely empty', bd?.events.length === 0 && bd?.notes.length === 0, bizData.text)
  const personal = (await req('POST', '/api/projects', { workspace: 'free', name: 'Personal', color: 'pink' }, b.cookies)).json?.project as { id: string }
  check('project ids are unique', !!personal?.id && personal.id !== biz?.id)

  const bizWork = { ...workspace('biz'), calendars: [{ id: 'work', name: 'Work', color: 'blue', visible: true }] }
  const savedBiz = await req('PUT', `/api/projects/${biz?.id}/data`, { data: bizWork }, b.cookies)
  await req('PUT', `/api/projects/${personal.id}/data`, { data: workspace('personal') }, b.cookies)
  const readBiz = await req('GET', `/api/projects/${biz?.id}`, undefined, b.cookies)
  const readPersonal = await req('GET', `/api/projects/${personal.id}`, undefined, b.cookies)
  check('project data saves', savedBiz.status === 200)
  check('Business holds only Business content', readBiz.text.includes('biz note') && !readBiz.text.includes('personal note'))
  check('Personal holds only Personal content', readPersonal.text.includes('personal note') && !readPersonal.text.includes('biz note'))
  const badSave = await req('PUT', `/api/projects/${biz?.id}/data`, { data: { settings: {} } }, b.cookies)
  check('invalid project data is rejected', badSave.status === 400)

  const renamed = await req('PATCH', `/api/projects/${biz?.id}`, { name: 'Business 2026', color: 'purple' }, b.cookies)
  check('a project can be renamed', (renamed.json?.project as { name?: string })?.name === 'Business 2026')
  const emptyName = await req('PATCH', `/api/projects/${biz?.id}`, { name: '   ' }, b.cookies)
  check('an empty name is refused', emptyName.status === 400)
  const dupe = await req('POST', `/api/projects/${biz?.id}/duplicate`, {}, b.cookies)
  const copy = dupe.json?.project as { id: string; name: string }
  const copyData = await req('GET', `/api/projects/${copy?.id}`, undefined, b.cookies)
  check('a project can be duplicated with its content', dupe.status === 201 && copy.name === 'Business 2026 (copy)' && copyData.text.includes('biz note'))

  console.log('\n  Project isolation')
  for (const [m, p, body] of [
    ['GET', `/api/projects/${biz?.id}`, undefined],
    ['PATCH', `/api/projects/${biz?.id}`, { name: 'hacked' }],
    ['PUT', `/api/projects/${biz?.id}/data`, { data: workspace('evil') }],
    ['POST', `/api/projects/${biz?.id}/duplicate`, {}],
    ['DELETE', `/api/projects/${biz?.id}`, undefined],
  ] as const) {
    const r = await req(m, p, body, a.cookies)
    check(`Alice cannot ${m} Bob’s project (404)`, r.status === 404, `got ${r.status}`)
  }
  const bizStill = await req('GET', `/api/projects/${biz?.id}`, undefined, b.cookies)
  check('Bob’s project is untouched', bizStill.text.includes('biz note') && bizStill.text.includes('Business 2026'))
  const aliceList = await req('GET', '/api/projects?workspace=free', undefined, a.cookies)
  check('Alice’s list never shows Bob’s projects', !aliceList.text.includes('Business'))
  const anon = await req('GET', '/api/projects?workspace=free')
  check('anonymous project listing → 401', anon.status === 401)

  console.log('\n  Pro workspace')
  const proList = await req('GET', '/api/projects?workspace=pro', undefined, b.cookies)
  check('a Free account cannot list Pro projects', proList.status === 403, `got ${proList.status}`)
  const proCreate = await req('POST', '/api/projects', { workspace: 'pro', name: 'X', color: 'lime' }, b.cookies)
  check('a Free account cannot create Pro projects', proCreate.status === 403, `got ${proCreate.status}`)
  const weird = await req('GET', '/api/projects?workspace=admin', undefined, b.cookies)
  check('unknown workspaces are refused', weird.status === 400)

  const del = await req('DELETE', `/api/projects/${copy?.id}`, undefined, b.cookies)
  const delGone = await req('GET', `/api/projects/${copy?.id}`, undefined, b.cookies)
  check('a project can be deleted', del.status === 200 && delGone.status === 404)
  const origAfter = await req('GET', `/api/projects/${biz?.id}`, undefined, b.cookies)
  check('deleting a copy leaves the original', origAfter.status === 200)

  console.log('\n  Preferences')
  const prefs0 = await req('GET', '/api/preferences', undefined, b.cookies)
  check(prefs0.status === 200 && (prefs0.json?.preferences as { dateFormat?: string })?.dateFormat === 'DMY', 'new accounts get default preferences')
  const prefs1 = await req('PATCH', '/api/preferences', { preferences: { dateFormat: 'YMD', accent: 'blue', reminderLead: 30, quietStart: '21:30' } }, b.cookies)
  check(prefs1.status === 200, 'valid preferences save')
  const prefs2 = await req('GET', '/api/preferences', undefined, b.cookies)
  const p2 = prefs2.json?.preferences as Record<string, unknown>
  check(p2.dateFormat === 'YMD' && p2.accent === 'blue' && p2.reminderLead === 30 && p2.quietStart === '21:30', 'preferences persist')
  for (const [label, body] of [
    ['an unknown key', { theme: 'dark' }],
    ['a bad value', { reminderLead: 7 }],
    ['a bad time', { quietStart: '25:00' }],
  ] as const) {
    const r = await req('PATCH', '/api/preferences', { preferences: body }, b.cookies)
    check(r.status === 400, `rejects ${label}`, `got ${r.status}`)
  }
  const aPrefs = await req('GET', '/api/preferences', undefined, a.cookies)
  check((aPrefs.json?.preferences as { accent?: string })?.accent === 'lime', 'preferences are per account')
  const anonPrefs = await req('GET', '/api/preferences')
  check(anonPrefs.status === 401, 'anonymous preferences → 401')

  console.log('\n  Account deletion')
  const z = await req('POST', '/api/auth/sign-up/email', { name: 'Zed', email: 'zed@opennote.test', password: PASSWORD })
  await req('POST', '/api/projects', { workspace: 'free', name: 'Zed project', color: 'lime' }, z.cookies)
  const wrongPw = await req('POST', '/api/auth/delete-user', { password: 'not-the-password-123' }, z.cookies)
  const stillThere = await req('GET', '/api/projects?workspace=free', undefined, z.cookies)
  check(wrongPw.status !== 200 && stillThere.text.includes('Zed project'), 'a wrong password does not delete the account', `got ${wrongPw.status}`)
  const zDel = await req('POST', '/api/auth/delete-user', { password: PASSWORD }, z.cookies)
  check(zDel.status === 200, 'the account owner can delete their account', zDel.text)
  const zLogin = await req('POST', '/api/auth/sign-in/email', { email: 'zed@opennote.test', password: PASSWORD })
  check(zLogin.status !== 200, 'a deleted account can no longer sign in', `got ${zLogin.status}`)
  const bobAfter = await req('GET', '/api/projects?workspace=free', undefined, b.cookies)
  check(bobAfter.text.includes('Business 2026'), 'deleting one account leaves other accounts untouched')

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
  const projAgain = await req('GET', '/api/projects?workspace=free', undefined, b.cookies)
  check('projects survive a restart', projAgain.text.includes('Business 2026') && projAgain.text.includes('Personal'))
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
