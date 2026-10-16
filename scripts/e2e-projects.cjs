/**
 * Project system in a real browser: workspace picker, project dashboard,
 * create / open / rename / duplicate / delete / search, and that each
 * project's events and notes stay inside that project.
 *
 *   npm run dev
 *   node scripts/e2e-projects.cjs     # needs the `playwright` package
 *
 * Set E2E_SHOTS=<dir> to save screenshots of each screen.
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
const stamp = Date.now() % 100000
const U = { name: 'Project Tester', email: `projects${Date.now()}@example.com`, pw: 'projects-pass-123' }
const appReady = (p) => p.getByText('Full Week').first().waitFor({ timeout: 15000 })
const listReady = (p) => p.getByText(/No projects yet|All projects/).first().waitFor({ timeout: 15000 })
const pageHas = (p, t) => p.evaluate((t) => document.body.innerText.includes(t) || [...document.querySelectorAll('input,textarea')].some((e) => e.value.includes(t)), t)

async function createProject(p, name, color) {
  await p.getByRole('button', { name: /Create (New|your first) Project/i }).first().click()
  await p.getByLabel('Project name').fill(name)
  if (color) await p.getByRole('button', { name: color, exact: true }).click()
  await p.getByLabel(/Description/).fill(`${name} description`)
  await p.getByRole('button', { name: 'Create project' }).click()
  await appReady(p)
}
async function addEvent(p, title) {
  await p.getByRole('button', { name: 'New event' }).click()
  await p.getByPlaceholder('Add a title').fill(title)
  await p.getByRole('button', { name: 'Add event' }).click()
}
async function backToProjects(p) {
  await p.waitForTimeout(900) // let the autosave land
  await p.getByRole('button', { name: /Back to Projects/ }).click()
  await listReady(p)
}
async function cardAction(p, name, action) {
  await p.getByRole('button', { name: `Actions for ${name}` }).first().click()
  await p.getByRole('menuitem', { name: action }).click()
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))

  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill(U.name)
  await p.getByLabel('Email address', { exact: true }).fill(U.email)
  await p.getByLabel('Password', { exact: true }).fill(U.pw)
  await p.getByLabel('Confirm password', { exact: true }).fill(U.pw)
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByText('Choose Your Workspace').waitFor({ timeout: 15000 })
  check(true, 'after sign-up the user sees “Choose Your Workspace”, not the calendar')
  check(!(await pageHas(p, 'Full Week')), 'the calendar is not opened directly')
  check((await p.getByRole('button', { name: /Pro is coming soon|Upgrade to Pro/ }).isDisabled()), 'Pro is locked for a Free account')
  await shot(p, '1-picker')

  await p.goto(`${B}/app/pro`, { waitUntil: 'networkidle' })
  await p.getByText('The Pro workspace is locked').waitFor()
  check(true, 'typing /app/pro does not open the Pro workspace')
  await p.goto(`${B}/app`, { waitUntil: 'networkidle' })

  await p.getByRole('button', { name: 'Open Free workspace' }).click()
  await listReady(p)
  check(await pageHas(p, 'No projects yet'), 'a new account starts with an empty project library')
  await shot(p, '2-empty-dashboard')

  const BIZ = `Business ${stamp}`
  const PER = `Personal ${stamp}`
  await createProject(p, BIZ, 'Blue')
  check(/\/app\/project\/prj_/.test(p.url()), 'creating a project opens its calendar')
  check(!(await pageHas(p, 'Team stand-up')) && !(await pageHas(p, 'Morning yoga')), 'the new calendar has no demo events')
  await addEvent(p, `Invoice run ${stamp}`)
  await shot(p, '3-project-calendar')
  await backToProjects(p)
  check(await pageHas(p, BIZ), 'Back to Projects returns to the dashboard')

  await createProject(p, PER, 'Pink')
  check(!(await pageHas(p, `Invoice run ${stamp}`)), 'a second project does not show the first project’s events')
  await addEvent(p, `Gym ${stamp}`)
  await backToProjects(p)

  await p.getByRole('button', { name: `Open ${BIZ}`, exact: true }).first().click()
  await appReady(p)
  check((await pageHas(p, `Invoice run ${stamp}`)) && !(await pageHas(p, `Gym ${stamp}`)), 'Business shows only Business events')
  await p.reload()
  await appReady(p)
  check(await pageHas(p, `Invoice run ${stamp}`), 'project events survive a refresh')
  await backToProjects(p)
  check(await pageHas(p, 'Recently opened'), 'the dashboard lists recently opened projects')
  await shot(p, '4-dashboard')

  await cardAction(p, PER, /Rename/)
  await p.getByLabel('Project name').fill(`${PER} life`)
  await p.getByRole('button', { name: 'Save changes' }).click()
  await p.getByText(`${PER} life`).first().waitFor()
  check(true, 'a project can be renamed')

  await cardAction(p, BIZ, 'Duplicate')
  await p.getByText(`${BIZ} (copy)`).first().waitFor()
  check(true, 'a project can be duplicated')

  await p.getByPlaceholder('Search projects').fill('copy')
  await p.waitForTimeout(100)
  check((await pageHas(p, `${BIZ} (copy)`)) && !(await pageHas(p, `${PER} life`)), 'search filters the projects')
  await p.getByPlaceholder('Search projects').fill('')

  await cardAction(p, `${BIZ} (copy)`, 'Delete')
  await p.getByRole('dialog', { name: 'Delete project?' }).waitFor()
  await shot(p, '5-delete-confirm')
  await p.getByRole('button', { name: 'Delete project' }).click()
  await p.waitForTimeout(500)
  check((await p.getByRole('button', { name: `Open ${BIZ} (copy)`, exact: true }).count()) === 0 && (await p.getByRole('button', { name: `Open ${BIZ}`, exact: true }).count()) > 0, 'delete asks for confirmation and removes only that project')

  await p.reload()
  await listReady(p)
  check((await pageHas(p, BIZ)) && (await pageHas(p, `${PER} life`)) && !(await pageHas(p, '(copy)')), 'the project library is saved on the server')

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
  const m = await mobile.newPage()
  await m.goto(`${B}/app/free`, { waitUntil: 'networkidle' })
  await listReady(m)
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check(!overflow, 'the dashboard fits a phone screen without sideways scrolling')
  await shot(m, '6-mobile-dashboard')

  check(errors.length === 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll project checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
