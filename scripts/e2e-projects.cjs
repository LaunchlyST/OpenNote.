/**
 * Welcome page + My Projects dashboard in a real browser: square cards,
 * rename/duplicate/delete, real creation dates, search + sort across every
 * page, pagination (1, 12, 13, 25 and 100 projects), Coming Soon links,
 * remembered page/search, responsive layout. Calendar still opens.
 *
 *   npm run dev
 *   node scripts/e2e-projects.cjs     # needs the `playwright` package
 *
 * Set E2E_SHOTS=<dir> to save screenshots.
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
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png` })

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))

  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill('Dash Tester')
  await p.getByLabel('Email address', { exact: true }).fill(`dash${Date.now()}@example.com`)
  await p.getByLabel('Password', { exact: true }).fill('dashboard-pass-12')
  await p.getByLabel('Confirm password', { exact: true }).fill('dashboard-pass-12')
  await p.getByRole('button', { name: 'Create account' }).click()

  // Welcome page
  await p.getByText('Your space to make').waitFor({ timeout: 15000 })
  check(await p.getByRole('button', { name: /Get Started Free/ }).isVisible(), 'welcome page: “Get Started Free” is the main action')
  const proBtn = p.getByRole('button', { name: 'Pro — Coming Soon' })
  check(await proBtn.isDisabled(), 'welcome page: Pro is Coming Soon and cannot be opened')
  check((await p.getByText(/Checkout is not switched on|You have not been charged/).count()) === 0, 'welcome page: no technical billing messages')
  const freeBox = await p.getByRole('article', { name: 'OpenNote Free' }).boundingBox()
  const proBox = await p.getByRole('article', { name: 'OpenNote Pro' }).boundingBox()
  check(Math.abs(freeBox.height - proBox.height) < 2 && Math.abs(freeBox.y - proBox.y) < 2, 'Free and Pro cards sit side by side at equal height')
  await shot(p, 'welcome')
  await p.setViewportSize({ width: 390, height: 844 })
  await p.waitForTimeout(200)
  const stacked = (await p.getByRole('article', { name: 'OpenNote Pro' }).boundingBox()).y > (await p.getByRole('article', { name: 'OpenNote Free' }).boundingBox()).y + 100
  check(stacked && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'welcome page on a phone: Free above Pro, no sideways scroll')
  await shot(p, 'welcome-mobile')
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.getByRole('button', { name: /Get Started Free/ }).click()

  // Empty dashboard
  await p.getByText('Your workspace starts here').waitFor()
  check(true, 'empty state: “Your workspace starts here”')
  check((await p.getByRole('button', { name: /settings/i }).count()) === 0, 'no Settings gear on My Projects')
  for (const label of ['Features', 'Explore', 'Community']) {
    await p.getByRole('navigation', { name: 'Explore OpenNote' }).getByRole('button', { name: label }).click()
    const pop = p.getByRole('dialog', { name: `${label} — Coming Soon` })
    check((await pop.innerText()).includes('This feature is being developed.'), `“${label}” shows Coming Soon`)
    await p.keyboard.press('Escape')
  }

  // Create a project (stays on My Projects, shows its real date)
  await p.getByRole('button', { name: 'Create Project', exact: true }).first().click()
  await p.getByLabel('Project name').fill('Project 2')
  const submit = p.getByRole('dialog').getByRole('button', { name: 'Create Project' })
  await submit.dblclick() // a double submit must still create one project
  await p.locator('[data-project-card]').first().waitFor()
  await p.waitForTimeout(400)
  check((await p.locator('[data-project-card]').count()) === 1, 'creating once makes exactly one project (double click guarded)')
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const card = p.locator('[data-project-card]').first()
  check((await card.getByTestId('created').innerText()) === `Created: ${today}`, `the card shows the real creation date (${today})`)

  // Rename keeps the date and the project
  const pid = await card.getAttribute('data-project-card')
  await card.getByRole('button', { name: /Actions for/ }).click()
  await p.getByRole('menuitem', { name: 'Rename' }).click()
  check((await p.getByLabel('Project name').inputValue()) === 'Project 2', 'rename shows the current name')
  await p.getByLabel('Project name').fill('My Business Calendar')
  await p.getByRole('button', { name: 'Save', exact: true }).click()
  await p.getByText('My Business Calendar').first().waitFor()
  await p.reload()
  await p.locator('[data-project-card]').first().waitFor()
  const renamed = p.locator(`[data-project-card="${pid}"]`)
  check((await renamed.innerText()).includes('My Business Calendar') && (await p.locator('[data-project-card]').count()) === 1, 'rename saves after refresh, no duplicate created')
  check((await renamed.getByTestId('created').innerText()) === `Created: ${today}`, 'renaming does not change the creation date')

  // Square cards, 4 per row
  const sq = await renamed.boundingBox()
  check(Math.abs(sq.width - sq.height) < 1.5, `cards are square (${sq.width.toFixed(0)}×${sq.height.toFixed(0)})`)

  // Bulk projects for pagination via the API, with distinct creation times
  const api = (body) => p.request.post(`${B}/api/projects`, { data: { workspace: 'free', color: 'blue', ...body } })
  for (let i = 1; i <= 99; i++) await api({ name: `Bulk ${String(i).padStart(3, '0')}` })
  await p.reload()
  await p.locator('[data-project-card]').first().waitFor()
  const count = () => p.getByTestId('project-count').innerText()
  check((await count()) === 'Showing 1–12 of 100 projects', `100 projects: ${await count()}`)
  check((await p.locator('[data-project-card]').count()) === 12, 'each page shows at most 12 projects')
  const rows = await p.locator('[data-project-card]').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))].length)
  const tops = await p.locator('[data-project-card]').evaluateAll((els) => els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().top)))
  check(rows === 3 && new Set(tops).size === 1, 'desktop: 4 square cards per row, left to right')
  const pager = p.getByRole('navigation', { name: 'Project pages' })
  check(await pager.getByRole('button', { name: 'Previous page' }).isDisabled(), 'Previous is disabled on page 1')
  await pager.getByRole('button', { name: 'Next page' }).click()
  check((await count()) === 'Showing 13–24 of 100 projects', 'Next goes to page 2')
  await pager.getByRole('button', { name: 'Last page' }).click()
  check((await count()) === 'Showing 97–100 of 100 projects' && (await pager.getByRole('button', { name: 'Next page' }).isDisabled()), 'Last opens page 9; Next disabled there')
  await pager.getByRole('button', { name: 'Previous page' }).click()
  check((await count()) === 'Showing 85–96 of 100 projects', 'Previous goes back one page')
  await pager.getByRole('button', { name: 'First page' }).click()
  check((await count()) === 'Showing 1–12 of 100 projects', 'First returns to page 1')
  const nums = await pager.getByRole('button', { name: /^Page \d+$/ }).allInnerTexts()
  check(nums.length < 9 && (await pager.innerText()).includes('…'), `many pages collapse with … (${nums.join(' ')})`)
  await shot(p, 'dashboard')

  // Search across every page
  await p.getByPlaceholder('Search your projects...').fill('Bulk 09')
  check((await count()) === 'Showing 1–10 of 10 projects', `search filters across all pages (${await count()})`)
  check((await pager.count()) === 0, 'one page of results hides the pagination')
  await p.getByPlaceholder('Search your projects...').fill('zzz-nothing')
  check(await p.getByText('No matching projects found.').isVisible(), 'no matches: “No matching projects found.”')
  await p.getByPlaceholder('Search your projects...').fill('')

  // Sorting before paging
  await p.getByLabel('Sort projects').selectOption('az')
  const firstAz = await p.locator('[data-project-card] h3').first().innerText()
  await p.getByLabel('Sort projects').selectOption('za')
  const firstZa = await p.locator('[data-project-card] h3').first().innerText()
  await p.getByLabel('Sort projects').selectOption('oldest')
  const firstOld = await p.locator('[data-project-card] h3').first().innerText()
  check(firstAz === 'Bulk 001' && firstZa === 'My Business Calendar' && firstOld === 'My Business Calendar', `sorting: A–Z ${firstAz}, Z–A ${firstZa}, oldest ${firstOld}`)
  await p.getByLabel('Sort projects').selectOption('recent')

  // Page counts for 12, 13 and 25 projects (filtered sets of known size)
  for (const [q, total, pages] of [['Bulk 00', 9, 1], ['Bulk 01', 10, 1]]) {
    await p.getByPlaceholder('Search your projects...').fill(q)
    check((await count()).endsWith(`of ${total} projects`) && (await pager.count()) === (pages > 1 ? 1 : 0), `“${q}”: ${total} projects on ${pages} page`)
  }
  await p.getByPlaceholder('Search your projects...').fill('')

  // Remember page + search when returning from a project
  await pager.getByRole('button', { name: 'Page 2' }).click()
  const onPage2 = await p.locator('[data-project-card] h3').first().innerText()
  await p.locator('[data-project-card]').first().getByRole('button', { name: /^Open Project/ }).click()
  await p.getByText('Full Week').first().waitFor()
  check(true, `opening “${onPage2}” shows its calendar`)
  await p.getByRole('button', { name: /Back to Projects/ }).click()
  await p.getByTestId('project-count').waitFor()
  check((await count()) === 'Showing 13–24 of 100 projects', 'Back to Projects restores page 2')

  // Delete with confirmation; empty last page moves back
  await pager.getByRole('button', { name: 'Last page' }).click()
  for (let k = 0; k < 4; k++) {
    await p.locator('[data-project-card]').first().getByRole('button', { name: /Actions for/ }).click()
    await p.getByRole('menuitem', { name: 'Delete' }).click()
    const dlg = p.getByRole('dialog', { name: 'Delete project?' })
    if (k === 0) {
      check((await dlg.innerText()).includes('permanently deleted'), 'delete asks for confirmation and explains it')
      await dlg.getByRole('button', { name: 'Cancel' }).click()
      check((await count()) === 'Showing 97–100 of 100 projects', 'cancelling deletes nothing')
      await p.locator('[data-project-card]').first().getByRole('button', { name: /Actions for/ }).click()
      await p.getByRole('menuitem', { name: 'Delete' }).click()
    }
    await p.getByRole('dialog', { name: 'Delete project?' }).getByRole('button', { name: 'Delete project' }).click()
    await p.waitForTimeout(300)
  }
  check((await count()) === 'Showing 85–96 of 96 projects', `emptying the last page moves to the nearest page (${await count()})`)

  // Duplicate
  await p.getByPlaceholder('Search your projects...').fill('Bulk 050')
  await p.locator('[data-project-card]').first().getByRole('button', { name: /Actions for/ }).click()
  await p.getByRole('menuitem', { name: 'Duplicate' }).click()
  await p.getByText('Bulk 050 (copy)').waitFor()
  check((await count()) === 'Showing 1–2 of 2 projects', 'duplicate keeps the original and adds a copy')
  check((await p.locator('[data-project-card]', { hasText: '(copy)' }).getByTestId('created').innerText()) === `Created: ${today}`, 'the copy gets its own creation date')

  // Exact page counts for 12, 13 and 25 projects
  for (const [tag, size] of [['PgTwelve', 12], ['PgThirteen', 13], ['PgTwentyFive', 25]]) {
    for (let i = 1; i <= size; i++) await api({ name: `${tag}-${String(i).padStart(2, '0')}` })
  }
  await p.reload()
  await p.getByTestId('project-count').waitFor()
  for (const [tag, size, pages, last] of [['PgTwelve', 12, 1, '1–12'], ['PgThirteen', 13, 2, '13–13'], ['PgTwentyFive', 25, 3, '25–25']]) {
    await p.getByPlaceholder('Search your projects...').fill(`${tag}-`)
    const hasPager = (await pager.count()) === 1
    if (hasPager) await pager.getByRole('button', { name: 'Last page' }).click()
    const nums = hasPager ? await pager.getByRole('button', { name: /^Page \d+$/ }).count() : 1
    check(nums === pages && (await count()) === `Showing ${last} of ${size} projects`, `${size} projects → ${pages} page${pages > 1 ? 's' : ''}, last page “${await count()}”`)
  }

  // Responsive
  for (const [w, cols] of [[1100, 3], [820, 2], [390, 1]]) {
    await p.getByPlaceholder('Search your projects...').fill('Bulk 01')
    await p.setViewportSize({ width: w, height: 900 })
    await p.waitForTimeout(250)
    const t = await p.locator('[data-project-card]').evaluateAll((els) => els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().top)))
    const perRow = t.filter((v) => v === t[0]).length
    const box = await p.locator('[data-project-card]').first().boundingBox()
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    check(perRow === cols && Math.abs(box.width - box.height) < 1.5 && !over, `${w}px wide: ${perRow} square cards per row, no sideways scroll`)
    if (w === 390) await shot(p, 'dashboard-mobile')
  }

  check(errors.length === 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll dashboard checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
