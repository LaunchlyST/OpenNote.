/**
 * Two accounts, ONE browser: sign-out must leave nothing of the previous
 * user behind — not in localStorage, not on screen, not behind the Back
 * button — and the data must come back from the server when they return.
 *
 *   npm run dev    (with or without the mail catcher)
 *   node scripts/e2e-privacy.cjs     # needs the `playwright` package
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const B = process.env.E2E_BASE || 'http://localhost:5173'
let n = 0
let failed = 0
const check = (ok, msg) => {
  n += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${String(n).padStart(2)}. ${msg}`)
  if (!ok) failed += 1
}
const stamp = Date.now() % 100000
const A = { name: 'Alice Privacy', email: `alice${Date.now()}@example.com`, pw: 'alice-pass-1234' }
const Bu = { name: 'Bob Privacy', email: `bob${Date.now()}@example.com`, pw: 'bob-pass-12345' }
const EVENT = `Alice secret meeting ${stamp}`
const NOTE = `Alice private note ${stamp}`

const appReady = (p) => p.getByText('Full Week').first().waitFor({ timeout: 15000 })
const signinReady = (p) => p.getByRole('heading', { name: 'Welcome back' }).waitFor({ timeout: 15000 })

async function confirmViaInbox(p, email) {
  for (let i = 0; i < 30; i++) {
    await p.goto(`${B}/api/dev/mail`)
    const a = p.locator('tr', { hasText: email }).locator('a', { hasText: 'Confirm your OpenNote email' }).first()
    if (await a.count()) {
      await p.goto(`${B}/api/dev/mail/${await a.getAttribute('href')}`)
      await p.goto(await p.locator('a', { hasText: 'Confirm email' }).first().getAttribute('href'))
      return
    }
    await p.waitForTimeout(400)
  }
  throw new Error('verification email not found')
}

async function signUp(p, u) {
  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill(u.name)
  await p.getByLabel('Email address', { exact: true }).fill(u.email)
  await p.getByLabel('Password', { exact: true }).fill(u.pw)
  await p.getByLabel('Confirm password', { exact: true }).fill(u.pw)
  await p.getByRole('button', { name: 'Create account' }).click()
  await Promise.race([p.getByText('Check your email').first().waitFor({ timeout: 15000 }), appReady(p)])
  if (await p.getByText('Check your email').count()) await confirmViaInbox(p, u.email)
  await appReady(p)
}

async function signIn(p, u) {
  await p.goto(`${B}/app/signin`, { waitUntil: 'networkidle' })
  await p.getByLabel('Email address', { exact: true }).fill(u.email)
  await p.getByLabel('Password', { exact: true }).fill(u.pw)
  await p.getByRole('button', { name: 'Sign in', exact: true }).click()
  await appReady(p)
}

async function signOut(p, name) {
  await p.getByText(name).first().click()
  await p.getByRole('menuitem', { name: /sign out/i }).click()
  await signinReady(p)
}

const cacheKeys = (p) => p.evaluate(() => Object.keys(localStorage).filter((k) => /^opennote\..+:.+/.test(k)))
const pageHas = (p, text) => p.evaluate((t) => document.body.innerText.includes(t) || [...document.querySelectorAll('input,textarea')].some((e) => e.value.includes(t)), text)
async function openNotes(p) {
  const btn = p.getByRole('button', { name: 'Notes', exact: true }).first()
  if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click()
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  // Record, for the whole session, every moment Alice's data is ever on screen.
  await ctx.addInitScript(([ev, note]) => {
    window.__leaks = []
    const scan = () => {
      const t = document.body ? document.body.innerText : ''
      const v = [...document.querySelectorAll('input,textarea')].map((e) => e.value).join(' ')
      if (t.includes(ev) || v.includes(note)) window.__leaks.push(location.pathname + ' @ ' + (window.__who || '?'))
    }
    new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true, attributes: true })
  }, [EVENT, NOTE])
  const p = await ctx.newPage()

  // --- User A ---
  await signUp(p, A)
  check(true, 'User A signed up and is signed in')
  await p.getByRole('button', { name: 'New event' }).click()
  await p.getByPlaceholder('Add a title').fill(EVENT)
  await p.getByRole('button', { name: 'Add event' }).click()
  await openNotes(p)
  await p.getByRole('button', { name: /Pin note to/ }).click()
  await p.getByPlaceholder('Title').first().fill(NOTE)
  check((await pageHas(p, EVENT)) && (await pageHas(p, NOTE)), 'User A created an event and a note')
  check((await cacheKeys(p)).length > 0, 'while signed in, A’s workspace is cached in this browser (normal persistence)')

  // Sign out immediately — the note edit is still inside the save debounce.
  await signOut(p, A.name)
  check(!(await pageHas(p, EVENT)) && !(await pageHas(p, NOTE)), 'after sign-out A’s data is gone from the screen')
  check((await cacheKeys(p)).length === 0, 'after sign-out no account data remains in localStorage')
  const ss = await p.evaluate(() => Object.keys(sessionStorage).filter((k) => k !== 'opennote.signout-pending'))
  check(!JSON.stringify(await p.evaluate(() => ({ ...sessionStorage }))).includes(NOTE), 'nothing of A in sessionStorage either')
  const idb = await p.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0))
  check(idb === 0, 'no IndexedDB databases are used')

  await p.goBack()
  await p.waitForTimeout(1500)
  check(!(await pageHas(p, EVENT)) && !(await pageHas(p, NOTE)), 'the Back button does not reveal A’s workspace')
  await p.waitForTimeout(1500)
  check((await cacheKeys(p)).length === 0, 'no late save wrote A’s data back into the browser')

  // --- User B, same browser ---
  await p.evaluate(() => (window.__who = 'B'))
  await signUp(p, Bu)
  await p.waitForTimeout(1200)
  check(!(await pageHas(p, EVENT)), 'User B does not see A’s event')
  await openNotes(p)
  check(!(await pageHas(p, NOTE)), 'User B does not see A’s note')
  const bWs = await (await p.request.get(`${B}/api/workspace`)).text()
  check(!bWs.includes(EVENT) && !bWs.includes(NOTE), 'B’s server workspace holds none of A’s data')
  const bKeys = await cacheKeys(p)
  const bId = (await (await p.request.get(`${B}/api/auth/get-session`)).json()).user.id
  check(bKeys.length > 0 && bKeys.every((k) => k.endsWith(`:${bId}`)), 'the browser cache now holds only B’s keys, scoped to B')
  await signOut(p, Bu.name)
  check((await cacheKeys(p)).length === 0, 'after B signs out, nothing of B remains either')

  // --- User A returns ---
  await signIn(p, A)
  await openNotes(p)
  await p.waitForTimeout(800)
  check(await pageHas(p, EVENT), 'A’s event is restored from the server')
  check(await pageHas(p, NOTE), 'A’s note (saved right before sign-out) is restored from the server')

  // --- Failed sign-out: server unreachable ---
  await p.route('**/api/auth/sign-out', (r) => r.abort())
  await p.getByText(A.name).first().click()
  await p.getByRole('menuitem', { name: /sign out/i }).click()
  await signinReady(p)
  check(!(await pageHas(p, EVENT)), 'a failed sign-out request still hides A’s data')
  check((await cacheKeys(p)).length === 0, 'a failed sign-out still clears the browser cache')
  await p.unroute('**/api/auth/sign-out')
  await p.goto(`${B}/app`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  check(!(await pageHas(p, EVENT)) && (await p.getByRole('heading', { name: 'Welcome back' }).count()) === 1, 'the unfinished sign-out is completed on the next load (A is not let back in)')
  const sess = await (await p.request.get(`${B}/api/auth/get-session`)).text()
  check(sess === 'null' || !sess.includes(A.email), 'the server session for A has really ended')

  const leaks = await p.evaluate(() => window.__leaks.filter((l) => l.endsWith('@ B')))
  check(leaks.length === 0, `A’s data never appeared on screen while B was signing in or signed in${leaks.length ? ': ' + leaks.join(', ') : ''}`)

  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll privacy checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
