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
const pickerReady = (p) => p.getByText('Choose Your Workspace').first().waitFor({ timeout: 15000 })
/** Sign-in lands on the workspace picker: open Free, then open (or create) the named project. */
async function enterProject(p, name) {
  await pickerReady(p)
  await p.getByRole('button', { name: 'Open Free workspace' }).click()
  await p.getByText(/No projects yet|All projects/).first().waitFor({ timeout: 15000 })
  const card = p.getByRole('button', { name: `Open ${name}`, exact: true }).first()
  if (await card.count()) await card.click()
  else {
    await p.getByRole('button', { name: /Create (New|your first) Project/i }).first().click()
    await p.getByLabel('Project name').fill(name)
    await p.getByRole('button', { name: 'Create project' }).click()
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

  await p.goto(B, { waitUntil: 'networkidle' })
  ;(await p.getByText('Plan the day.').count()) ? ok('landing page loads') : die('landing page')

  await p.locator('#pricing').scrollIntoViewIfNeeded()
  await p.getByRole('link', { name: /Get Started Free/ }).first().click()
  await p.getByRole('button', { name: 'Create account' }).waitFor()
  ok('“Get Started Free” opens registration')
  ;(await p.getByRole('button', { name: 'Continue with Google' }).count()) === 1 && (await p.getByText('or continue with', { exact: true }).count()) === 1
    ? ok('sign-up shows the email form plus “or continue with” Google')
    : die('Google / email choice missing')

  await p.getByLabel('Full name', { exact: true }).fill('Journey Tester')
  await p.getByLabel('Email address', { exact: true }).fill(email)
  await p.getByLabel('Password', { exact: true }).fill(pw1)
  await p.getByLabel('Confirm password', { exact: true }).fill(pw1)
  await p.getByRole('button', { name: 'Create account' }).click()
  await Promise.race([p.getByText('Check your email').first().waitFor(), pickerReady(p)])
  const needsVerify = (await p.getByText('Check your email').count()) > 0
  ok(`account registered${needsVerify ? ' (verification required)' : ' (verification off: no SMTP)'}`)

  if (needsVerify) {
    const link = await mailLink(p, email, 'Confirm your OpenNote email', 'Confirm email')
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

  ok('tasks: not part of OpenNote Free (no tasks feature exists) — skipped')

  await p.waitForTimeout(100) // well inside the 600 ms save debounce
  await p.reload()
  await appReady(p)
  ok('page refreshed immediately after editing')
  const hasNote = async () => {
    const btn = p.getByRole('button', { name: 'Notes', exact: true }).first()
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click()
    return p.evaluate((t) => [...document.querySelectorAll('input,textarea')].some((el) => el.value === t), noteTitle)
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
  const reset = await mailLink(p, email, 'Reset your OpenNote password', 'Choose a new password')
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

  await p.goto(B, { waitUntil: 'networkidle' })
  await p.locator('#pricing').scrollIntoViewIfNeeded()
  const pricing = await p.locator('#pricing').innerText()
  const proBuyLinks = await p.locator('#pricing a[href*="checkout"], #pricing a[href*="stripe"]').count()
  pricing.includes('Coming Soon') && !/Get OpenNote Pro/.test(pricing) && proBuyLinks === 0
    ? ok('Pro shows “Coming Soon” and cannot be purchased')
    : die('Pro purchase is reachable')

  errors.length ? die(`browser errors: ${errors.join(' | ')}`) : ok('no JavaScript errors during the journey')
  await browser.close()
  console.log('\nJourney complete.')
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
