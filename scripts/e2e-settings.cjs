/**
 * Settings page in a real browser: every section renders, settings save to
 * the account/project and survive a refresh, unsupported features say so,
 * billing sells nothing, and nothing from the calendar shows over Settings.
 *
 *   npm run dev
 *   node scripts/e2e-settings.cjs     # needs the `playwright` package
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const B = process.env.E2E_BASE || 'http://localhost:5173'
const SHOTS = process.env.E2E_SHOTS
let n = 0
let failed = 0
const check = (ok, msg) => {
  n += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${String(n).padStart(2)}. ${msg}`)
  if (!ok) failed += 1
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  const email = `settings${Date.now()}@example.com`
  const pw = 'settings-tester-pw1'

  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill('Settings Tester')
  await p.getByLabel('Email address', { exact: true }).fill(email)
  await p.getByLabel('Password', { exact: true }).fill(pw)
  await p.getByLabel('Confirm password', { exact: true }).fill(pw)
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByRole('button', { name: 'Open Free workspace' }).click()
  await p.getByRole('button', { name: /Create your first project/ }).click()
  await p.getByLabel('Project name').fill('Prefs')
  await p.getByRole('button', { name: 'Create project' }).click()
  await p.getByText('Full Week').first().waitFor()

  const nav = p.getByRole('navigation', { name: 'Settings sections' })
  const openSettings = async () => {
    await p.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await p.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
    await p.waitForTimeout(250)
  }
  const go = async (name) => {
    await nav.getByRole('button', { name, exact: true }).click()
    await p.getByRole('heading', { name, level: 2 }).waitFor()
  }
  const shot = async (name) => SHOTS && p.screenshot({ path: `${SHOTS}/settings-${name}.png`, fullPage: false })

  await openSettings()
  const labels = await nav.getByRole('button').allInnerTexts()
  check(
    JSON.stringify(labels) === JSON.stringify(['Profile', 'Account', 'General', 'Appearance', 'Notifications', 'Calendar Preferences', 'Security', 'Billing']),
    `the eight sections in order (${labels.join(', ')})`,
  )
  check((await p.getByTestId('now-line').count()) === 0 && (await p.getByTestId('now-label').count()) === 0, 'no current-time indicator over Settings')

  // Profile
  await go('Profile')
  check((await p.getByTestId('profile-preview-name').innerText()) === 'Settings Tester', 'Profile shows the real account name')
  await p.getByLabel('Display name').fill('A')
  await p.getByRole('button', { name: 'Save changes' }).click()
  check(await p.getByText('Use at least 2 characters.').isVisible(), 'a one-letter name is rejected')
  await p.getByLabel('Display name').fill('Settings Pro')
  await p.getByRole('button', { name: 'Save changes' }).click()
  await p.getByRole('status').filter({ hasText: 'Saved' }).first().waitFor()
  await shot('profile')

  // Account
  await go('Account')
  check((await p.getByTestId('providers').innerText()).includes('Email & password'), 'Account shows the real sign-in method')
  check(await p.getByText(email).first().isVisible(), 'Account shows the registered email')
  await p.getByRole('button', { name: 'Delete account' }).click()
  const delBtn = p.getByRole('button', { name: 'Delete my account' })
  check(await delBtn.isDisabled(), 'deleting needs confirmation (button disabled until DELETE + password)')
  await p.getByRole('button', { name: 'Cancel' }).click()
  await shot('account')

  // General
  await go('General')
  await p.getByLabel('Date format').selectOption('YMD')
  await p.getByRole('status').filter({ hasText: 'Saved' }).first().waitFor()
  await p.getByLabel('Remember last calendar view').click()
  await p.waitForTimeout(400)
  await shot('general')

  // Appearance
  await go('Appearance')
  check((await p.locator('[data-theme-card="dark"]').innerText()).includes('Coming soon'), 'Dark theme is marked Coming soon, Light active')
  await p.getByRole('radio', { name: 'Blue' }).click()
  await p.waitForTimeout(500)
  const accent = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim())
  check(accent === '#60a5fa', `accent applies immediately (${accent})`)
  await shot('appearance')

  // Notifications
  await go('Notifications')
  check((await p.getByTestId('notif-permission').innerText()).length > 0, `permission status shown (${await p.getByTestId('notif-permission').innerText()})`)
  await p.getByLabel('Remind me before events').click()
  await p.getByLabel('Default reminder time').selectOption('30')
  await p.waitForTimeout(500)
  check(await p.getByText('Dated notes will be able to carry their own reminder').isVisible(), 'note reminders are marked Coming soon')
  await shot('notifications')

  // Calendar Preferences (per project)
  await go('Calendar Preferences')
  await p.getByLabel('Highlight the current day').click()
  await p.getByLabel('Current-time indicator').click()
  await p.getByLabel('Day starts at').selectOption('9')
  await shot('calendar')

  // Security
  await go('Security')
  await p.getByTestId('session-row').first().waitFor()
  check((await p.getByTestId('session-row').first().innerText()).includes('This device'), 'Security lists the real session (“This device”)')
  check(await p.getByText('A second sign-in step').isVisible(), 'two-factor is marked Coming soon')
  await shot('security')

  // Billing
  await go('Billing')
  check((await p.getByTestId('billing-message').innerText()).includes('OpenNote Pro and Business are coming soon. Enjoy OpenNote Free while we build something better.'), 'billing shows the coming-soon message')
  check((await p.locator('[data-plan="free"]').innerText()).includes('Current plan'), 'Free shows Current plan')
  check((await p.locator('[data-plan="pro"]').innerText()).includes('Coming soon') && (await p.locator('[data-plan="business"]').innerText()).includes('Coming soon'), 'Pro and Business say Coming soon')
  const buy = await p.locator('main').getByRole('button', { name: /subscribe|upgrade|choose|buy|checkout/i }).count()
  const tech = await p.getByText(/Checkout is not switched on|Pricing has not been set/).count()
  check(buy === 0 && tech === 0, 'no purchase buttons and no technical messages')
  await shot('billing')

  // Back to calendar applies calendar prefs
  await p.getByRole('button', { name: 'Back to calendar' }).click()
  await p.waitForTimeout(400)
  check((await p.getByTestId('today-pill').count()) === 0 && (await p.getByTestId('now-line').count()) === 0, 'turning off today highlight and the time line applies to the calendar')

  // Everything survives a refresh
  await p.waitForTimeout(900)
  await p.reload()
  await p.getByText('Full Week').first().waitFor()
  check((await p.getByTestId('today-pill').count()) === 0, 'calendar preferences survive a refresh')
  const accent2 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim())
  check(accent2 === '#60a5fa', 'the accent colour survives a refresh')
  await openSettings()
  check((await nav.getByRole('button', { name: 'Billing' }).getAttribute('aria-current')) === 'page' && (await p.getByRole('heading', { name: 'Billing', level: 2 }).isVisible()), 'Settings reopens on the last section')
  await go('General')
  check((await p.getByLabel('Date format').inputValue()) === 'YMD' && (await p.getByLabel('Remember last calendar view').getAttribute('aria-checked')) === 'true', 'general preferences survive a refresh')
  await go('Notifications')
  check((await p.getByLabel('Default reminder time').inputValue()) === '30', 'notification preferences survive a refresh')
  await go('Profile')
  check((await p.getByTestId('profile-preview-name').innerText()) === 'Settings Pro', 'the new display name survives a refresh')

  // Mobile layout
  await p.setViewportSize({ width: 390, height: 844 })
  await p.waitForTimeout(300)
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check(!overflow, 'no horizontal overflow on a phone')
  await shot('mobile')

  check(errors.length === 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll Settings checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
