/**
 * Takes REAL screenshots of the OpenNote app for the landing page.
 *
 *   npm run dev            (in another terminal)
 *   node scripts/capture-landing.cjs
 *
 * Signs up a throwaway account on the local dev server, opens the Free
 * workspace, creates a project exactly as a new user sees it (empty), and saves 1920×1200 shots to public/landing/.
 * Uses only the local dev database; nothing is published.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const B = process.env.E2E_BASE || 'http://localhost:5173'
const OUT = 'public/landing'

const CALENDARS = [
  { id: 'work', name: 'Work', color: 'lime', visible: true },
  { id: 'personal', name: 'Personal', color: 'orange', visible: true },
  { id: 'study', name: 'Study', color: 'purple', visible: true },
  { id: 'social', name: 'Social', color: 'pink', visible: true },
]
// day: 0 = Monday
const EVENTS = [
  ['Morning planning', 0, '09:00', '09:30', 'work'],
  ['Design review', 0, '11:30', '12:30', 'work'],
  ['Deep work block', 0, '14:00', '15:30', 'study'],
  ['Team meeting', 1, '10:00', '10:45', 'work'],
  ['Workshop', 1, '13:00', '15:00', 'study'],
  ['Morning yoga', 2, '09:00', '10:00', 'personal'],
  ['1:1 with Alex', 2, '15:00', '15:45', 'work'],
  ['Study session', 3, '09:30', '11:00', 'study'],
  ['Marketing sync', 3, '16:00', '17:00', 'work'],
  ['Product review', 4, '10:00', '12:00', 'work'],
  ['Lunch & learn', 4, '12:30', '13:30', 'social'],
  ['Personal appointment', 5, '11:00', '12:00', 'personal'],
  ['Dinner with friends', 5, '19:00', '21:00', 'social'],
  ['Weekly review', 6, '16:00', '17:00', 'personal'],
  ['Read a chapter', 6, '20:15', '21:00', 'study'],
  ['Team sync', 9, '10:00', '11:00', 'work'],
  ['Dentist', 11, '15:30', '16:15', 'personal'],
  ['Roadmap review', 16, '11:00', '12:00', 'study'],
]

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill('Alex Morgan')
  await p.getByLabel('Email address', { exact: true }).fill(`landing${Date.now()}@example.com`)
  await p.getByLabel('Password', { exact: true }).fill('landing-shot-2026')
  await p.getByLabel('Confirm password', { exact: true }).fill('landing-shot-2026')
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByRole('button', { name: /Get Started Free/ }).first().waitFor({ timeout: 15000 })
  await p.getByRole('button', { name: /Get Started Free/ }).first().click()
  await p.getByRole('button', { name: 'Create Project' }).first().waitFor()

  const api = async (method, path, data) => {
    const r = await p.request.fetch(`${B}/api/projects${path}`, { method, data, headers: { origin: B } })
    if (!r.ok()) throw new Error(`${method} ${path} → ${r.status()} ${await r.text()}`)
    return r.json()
  }
  for (const [name, color, description] of [
    ['Client launch', 'purple', 'Milestones and review dates'],
    ['Study plan', 'orange', 'Lectures, revision and exams'],
    ['Home & family', 'pink', 'Appointments and weekends'],
  ])
    await api('POST', '', { workspace: 'free', name, color, description })
  const { project } = await api('POST', '', { workspace: 'free', name: 'My Week', color: 'lime', description: 'Work, study and personal plans' })
  const { data } = await api('GET', `/${project.id}`)

  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const at = (day, hm) => {
    const [h, m] = hm.split(':').map(Number)
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + day, h, m).toISOString()
  }
  const key = (day) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + day)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const todayIdx = (now.getDay() + 6) % 7
  // Leave the project exactly as a new Free user sees it: one calendar
  // ("My calendar"), no events, no notes — the app's own defaults.
  void data

  // My Projects page
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${OUT}/app-projects.png` })

  await p.goto(`${B}/app/project/${project.id}`, { waitUntil: 'load' })
  await p.getByText('Full Week').first().waitFor({ timeout: 20000 })
  await p.getByText('Saved', { exact: true }).first().waitFor({ timeout: 20000 })
  const view = async (name) => {
    await p.getByRole('button', { name, exact: true }).first().click()
    await p.waitForTimeout(900)
  }
  await view('Full Week')
  // Scroll the time grid so the morning is in view, as on the landing page.
  await p.mouse.move(5, 5)
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/app-week.png` })
  await view('Day')
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/app-day.png` })
  await view('Month')
  await p.screenshot({ path: `${OUT}/app-month.png` })
  await b.close()
  console.log('Saved real screenshots to', OUT)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
