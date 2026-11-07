/**
 * Full user journey in a real browser (Playwright/Chromium), against the
 * running dev server. Nothing external: email goes to the local dev inbox.
 *
 *   npm run mail:catcher            # optional: real SMTP path to the catcher
 *   npm run dev                     # with SMTP_* pointing at the catcher, or none
 *   node scripts/e2e-journey.cjs    # needs the `playwright` package available
 *
 * Exits non-zero on the first failed step.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const B = process.env.E2E_BASE || 'http://localhost:5173'
let step = 0
const ok = (msg) => console.log(`  PASS  ${String(++step).padStart(2)}. ${msg}`)
const die = (msg) => {
  console.log(`  FAIL  ${String(++step).padStart(2)}. ${msg}`)
  process.exit(1)
}
async function mailLink(p, to, subject, button) {
  for (let i = 0; i < 30; i++) {
    await p.goto(`${B}/api/dev/mail`)
    // Match the recipient too: other runs' mail can be in the same inbox.
    const a = p.locator('tr', { hasText: to }).locator('a', { hasText: subject }).first()
    if (await a.count()) {
      await p.goto(`${B}/api/dev/mail/${await a.getAttribute('href')}`)
      return p.locator('a', { hasText: button }).first().getAttribute('href')
    }
    await p.waitForTimeout(500)
  }
  return null
}
const appReady = (p) => p.getByText('Full Week').first().waitFor({ timeout: 15000 })
const pickerReady = (p) => p.getByText('Your space to make').first().waitFor({ timeout: 15000 })
/** Sign-in lands on the workspace picker: open Free, then open (or create) the named project. */
async function enterProject(p, name) {
  await pickerReady(p)
  await p.getByRole('button', { name: /Get Started Free/ }).click()
  // Free opens straight into the latest project (or a new one) since 9911c62;
  // the project list only appears when that isn't possible.
  await p.waitForURL(/\/app\/(project\/|free)/, { timeout: 15000 })
  if (/\/app\/project\//.test(p.url())) return appReady(p)
  await p.getByText(/Your workspace starts here|Showing \d/).first().waitFor({ timeout: 15000 })
  const card = p.getByRole('button', { name: `Open ${name}`, exact: true }).first()
  if (await card.count()) await card.click()
  else {
    await p.getByRole('button', { name: 'Create Project', exact: true }).first().click()
    await p.getByLabel('Project name').fill(name)
    await p.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click()
    await p.getByRole('button', { name: `Open ${name}`, exact: true }).first().click()
  }
  await appReady(p)
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  const email = `journey${Date.now()}@example.com`
  const pw1 = 'journey-pass-111'
  const pw2 = 'journey-pass-222'
  const eventTitle = `Planning session ${Date.now() % 10000}`
  const noteTitle = `Journey note ${Date.now() % 10000}`

  // The home page is the invite-only Coming Soon screen; the invite code opens the landing page.
  await p.goto(B, { waitUntil: 'networkidle' })
  ;(await p.getByText('Invite only').count()) ? ok('home page shows the invite-only Coming Soon screen') : die('Coming Soon screen')
  await p.fill('input[placeholder="Invite code"]', 'Invite27')
  await p.keyboard.press('Enter')
  await p.waitForURL('**/landing', { timeout: 15000 })
  await p.locator('#pricing').waitFor({ state: 'attached', timeout: 15000 })
  ok('the invite code opens the landing page')

  await p.locator('#pricing').scrollIntoViewIfNeeded()
  await p.locator('#pricing a[href="/app/signup"]').first().click()
  await p.getByRole('button', { name: 'Create account' }).waitFor()
  ok('“Get Started Free” opens registration')
  // Google is offered only when the server has Google credentials (GET /api/auth-config).
  const googleOn = (await (await p.request.get(`${B}/api/auth-config`)).json()).google === true
  const googleShown = (await p.getByRole('button', { name: 'Continue with Google' }).count()) === 1
  googleShown === googleOn
    ? ok(googleOn ? 'sign-up shows the email form plus “or continue with” Google' : 'sign-up shows the email form; Google is hidden because it is not configured')
    : die(`Google button shown=${googleShown} but configured=${googleOn}`)

  await p.getByLabel('Full name', { exact: true }).fill('Journey Tester')
  await p.getByLabel('Email address', { exact: true }).fill(email)
  await p.getByLabel('Password', { exact: true }).fill(pw1)
  await p.getByLabel('Confirm password', { exact: true }).fill(pw1)
  await p.getByRole('button', { name: 'Create account' }).click()
  await Promise.race([p.getByText('Check your email').first().waitFor(), pickerReady(p)])
  const needsVerify = (await p.getByText('Check your email').count()) > 0
  ok(`account registered${needsVerify ? ' (verification required)' : ' (verification off: no SMTP)'}`)

  if (needsVerify) {
    const link = await mailLink(p, email, 'Confirm your Desknoty email', 'Confirm email')
    link ? ok('verification email received in local inbox') : die('verification email')
    await p.goto(link)
    await enterProject(p, 'Journey')
    ok('verification link signs the user in')
  } else {
    ok('verification email step skipped (no SMTP configured)')
    ok('signed in after sign-up')
    await enterProject(p, 'Journey')
  }

  ok('workspace picker → project dashboard → new project calendar opens')
  ;(await p.getByText(/Team stand-up|Morning yoga|Sprint planning/).count()) === 0 ? ok('the new project has no demo events') : die('demo events in a new project')

  await p.getByRole('button', { name: 'New event' }).click()
  await p.getByPlaceholder('Add a title').fill(eventTitle)
  await p.getByRole('button', { name: 'Add event' }).click()
  ;(await p.getByText(eventTitle).count()) ? ok('calendar event created') : die('event create')

  await p.getByRole('button', { name: 'Notes', exact: true }).first().click()
  await p.getByRole('button', { name: /Pin note to/ }).click()
  await p.getByPlaceholder('Title').first().fill(noteTitle)
  await p.waitForTimeout(200)
  const pinLabel = await p.getByRole('button', { name: /Pin note to/ }).innerText()
  pinLabel.includes('· 1') ? ok('note created and pinned to the selected day') : die(`note pin count: ${pinLabel}`)

  ok('tasks: not part of Desknoty Free (no tasks feature exists) — skipped')

  await p.waitForTimeout(100) // well inside the 600 ms save debounce
  await p.reload()
  await appReady(p)
  ok('page refreshed immediately after editing')
  const hasNote = async () => {
    const btn = p.getByRole('button', { name: 'Notes', exact: true }).first()
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click()
    // Saved notes show as cards (title text); an open editor shows inputs.
    return p.evaluate((t) => document.body.innerText.includes(t) || [...document.querySelectorAll('input,textarea')].some((el) => el.value === t), noteTitle)
  }
  ;(await p.getByText(eventTitle).count()) && (await hasNote()) ? ok('event and note still there after refresh') : die('data lost on refresh')

  await p.getByText('Journey Tester').first().click()
  await p.getByRole('menuitem', { name: /sign out/i }).first().click()
  await p.getByRole('heading', { name: 'Welcome back' }).waitFor()
  ok('logged out')

  await p.getByLabel('Email address', { exact: true }).fill(email)
  await p.getByLabel('Password', { exact: true }).fill(pw1)
  await p.getByRole('button', { name: 'Sign in', exact: true }).click()
  await enterProject(p, 'Journey')
  ok('logged back in')
  ;(await p.getByText(eventTitle).count()) && (await hasNote()) ? ok('saved data present after logging back in') : die('data missing after login')

  await p.getByText('Journey Tester').first().click()
  await p.getByRole('menuitem', { name: /sign out/i }).first().click()
  await p.getByRole('heading', { name: 'Welcome back' }).waitFor()
  await p.goto(`${B}/app/forgot-password`, { waitUntil: 'networkidle' })
  await p.getByLabel('Email address', { exact: true }).fill(email)
  await p.getByRole('button', { name: 'Send reset link' }).click()
  await p.getByText('Check your email').first().waitFor()
  const reset = await mailLink(p, email, 'Reset your Desknoty password', 'Choose a new password')
  reset ? ok('password reset requested, email in local inbox') : die('reset email')

  await p.goto(reset)
  // The page reads the token from the URL once it has loaded.
  await p.waitForURL(/token=/)
  await p.getByRole('button', { name: 'Update password' }).and(p.locator(':enabled')).waitFor()
  if (process.env.E2E_DEBUG) {
    console.log('    reset URL now:', p.url())
    console.log('    page says:', (await p.locator('body').innerText()).slice(0, 300).replace(/\s+/g, ' '))
  }
  await p.getByLabel('New password', { exact: true }).fill(pw2)
  await p.getByLabel('Confirm password', { exact: true }).fill(pw2)
  await p.getByRole('button', { name: 'Update password' }).click()
  await p.getByText('Password updated').first().waitFor()
  ok('password reset completed')

  await p.goto(`${B}/app/signin`, { waitUntil: 'networkidle' })
  await p.getByLabel('Email address', { exact: true }).fill(email)
  await p.getByLabel('Password', { exact: true }).fill(pw2)
  await p.getByRole('button', { name: 'Sign in', exact: true }).click()
  await pickerReady(p).catch(async (e) => {
    console.log('    page says:', (await p.locator('body').innerText()).slice(0, 400).replace(/\s+/g, ' '))
    throw e
  })
  ok('signed in with the new password')

  const other = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  const q = await other.newPage()
  await q.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await q.getByLabel('Full name', { exact: true }).fill('Other Person')
  await q.getByLabel('Email address', { exact: true }).fill(`other${Date.now()}@example.com`)
  await q.getByLabel('Password', { exact: true }).fill(pw1)
  await q.getByLabel('Confirm password', { exact: true }).fill(pw1)
  await q.getByRole('button', { name: 'Create account' }).click()
  await q.waitForTimeout(1500)
  const theirs = await q.request.get(`${B}/api/projects?workspace=free`)
  const body = await theirs.text()
  !body.includes(eventTitle) && !body.includes(noteTitle) ? ok('another account cannot see this account’s data') : die('data leaked to another account')

  // Pricing lives on /landing (behind the invite code this browser already redeemed).
  await p.goto(`${B}/landing`, { waitUntil: 'networkidle' })
  await p.locator('#pricing').scrollIntoViewIfNeeded()
  // textContent: the label is uppercased by CSS, innerText would read "COMING SOON"
  const pricing = (await p.locator('#pricing').textContent()) ?? ''
  const proBuyLinks = await p.locator('#pricing a[href*="checkout"], #pricing a[href*="stripe"]').count()
  pricing.includes('Coming Soon') && !/Get Desknoty Pro/.test(pricing) && proBuyLinks === 0
    ? ok('Pro shows “Coming Soon” and cannot be purchased')
    : die('Pro purchase is reachable')

  errors.length ? die(`browser errors: ${errors.join(' | ')}`) : ok('no JavaScript errors during the journey')
  await browser.close()
  console.log('\nJourney complete.')
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
