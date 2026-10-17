/**
 * Notes section (documents) vs calendar time-slot notes, in a real browser.
 *
 *   npm run dev
 *   node scripts/e2e-notes-section.cjs     # needs the `playwright` package
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
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))

  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill('Notes Tester')
  await p.getByLabel('Email address', { exact: true }).fill(`notes${Date.now()}@example.com`)
  await p.getByLabel('Password', { exact: true }).fill('notes-tester-pass1')
  await p.getByLabel('Confirm password', { exact: true }).fill('notes-tester-pass1')
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByRole('button', { name: /Get Started Free/ }).click()
  await p.getByRole('button', { name: 'Create Project', exact: true }).first().click()
  await p.getByLabel('Project name').fill('Notes')
  await p.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click()
  await p.locator('[data-project-card]').first().getByRole('button', { name: /^Open Project/ }).click()
  await p.getByText('Full Week').first().waitFor()
  const projectId = p.url().split('/').pop()
  const data = async () => (await (await p.request.get(`${B}/api/projects/${projectId}`)).json()).data
  const settle = () => p.waitForTimeout(900) // autosave debounce

  const days = await p.locator('[data-day]').evaluateAll((els) => els.map((e) => e.getAttribute('data-day')))
  const sat = days[5]
  const mon = days[0]
  const badges = p.getByTestId('day-notes-badge')
  const badgeDates = () => badges.evaluateAll((els) => els.map((e) => e.getAttribute('data-date')))
  const gridCards = () => p.locator('[data-day] [data-note-card], [data-day] [title*="–"]').count()
  const panel = p.locator('aside').filter({ has: p.getByRole('heading', { name: 'Notes' }) })

  // Open the Notes section from the top-right Notes button and write a note.
  await p.getByRole('button', { name: 'Notes', exact: true }).last().click()
  await panel.getByRole('button', { name: 'New', exact: true }).click()
  await panel.getByLabel('Note title').fill('Plan launch')
  await panel.getByLabel('Note description').fill('Write the launch copy and book the room.')
  await panel.getByLabel('Note date').fill(sat)
  await panel.getByRole('button', { name: 'Save & Hide' }).click()
  await settle()

  // 1. No box in the calendar grid, no event, no slot note.
  const d1 = await data()
  check((await gridCards()) === 0 && d1.events.length === 0 && (d1.slotNotes ?? []).length === 0, 'a Notes-section note creates no grid box, event or slot note')
  check(d1.notes.length === 1 && !('time' in d1.notes[0]), 'it is saved as a document with no time')

  // 3. Indicator only on that day.
  check(JSON.stringify(await badgeDates()) === JSON.stringify([sat]) && (await badges.first().innerText()).includes('Notes (1)'), `the “Notes (1)” badge appears only on ${sat}`)
  SHOTS && (await p.screenshot({ path: `${SHOTS}/notes-badge.png` }))

  // 4. Still accessible after Save & Hide.
  check((await panel.locator('[data-note-editor]').count()) === 0 && (await panel.getByRole('button', { name: 'Open note Plan launch' }).isVisible()), 'after Save & Hide the editor closes and the note stays listed')

  // 5. Reopen and edit.
  await panel.getByRole('button', { name: 'Open note Plan launch' }).click()
  await panel.getByLabel('Note title').fill('Plan launch v2')
  await panel.getByRole('button', { name: 'Save & Hide' }).click()
  check(await panel.getByRole('button', { name: 'Open note Plan launch v2' }).isVisible(), 'the note can be reopened and edited')

  // 6. Changing the date moves the indicator.
  await panel.getByRole('button', { name: 'Open note Plan launch v2' }).click()
  await panel.getByLabel('Note date').fill(mon)
  check(JSON.stringify(await badgeDates()) === JSON.stringify([mon]), `changing the date moves the badge to ${mon}`)

  // Hide / show the date indicator.
  await panel.getByLabel('Show on calendar').uncheck()
  check((await badges.count()) === 0, 'unticking “Show on calendar” hides the badge')
  await panel.getByLabel('Show on calendar').check()
  check((await badges.count()) === 1, 'ticking it shows the badge again')

  // 7. Removing the date removes the badge but keeps the note.
  await panel.getByRole('button', { name: 'Remove date' }).click()
  await panel.getByRole('button', { name: 'Save & Hide' }).click()
  check((await badges.count()) === 0 && (await panel.getByRole('button', { name: 'Open note Plan launch v2' }).innerText()).includes('No date'), 'removing the date removes the badge and keeps the note')

  // Badge click opens the Notes section filtered to that day.
  await panel.getByRole('button', { name: 'Open note Plan launch v2' }).click()
  await panel.getByLabel('Note date').fill(sat)
  await panel.getByRole('button', { name: 'Save & Hide' }).click()
  await panel.getByRole('button', { name: 'New', exact: true }).click()
  await panel.getByLabel('Note title').fill('Undated idea')
  await panel.getByRole('button', { name: 'Save & Hide' }).click()
  await p.getByRole('button', { name: 'Notes', exact: true }).last().click() // close the panel
  await badges.first().click()
  await panel.getByTestId('notes-filter').waitFor()
  const listed = await panel.locator('[data-note-doc]').count()
  check(listed === 1 && (await panel.getByRole('button', { name: 'Open note Plan launch v2' }).isVisible()), 'clicking the badge opens Notes filtered to that day')
  await panel.getByRole('button', { name: 'Show all' }).click()
  check((await panel.locator('[data-note-doc]').count()) === 2, '“Show all” lists every note again')

  // 2. A time-slot note does not create a Notes-section document.
  const before = (await data()).notes.length
  const col = p.locator('[data-day]').nth(2)
  await col.evaluate((el) => (el.closest('.scroll-area').scrollTop = (600 / 1440) * el.getBoundingClientRect().height - 100))
  const b = await col.boundingBox()
  await p.mouse.dblclick(b.x + b.width / 2, b.y + (605 / 1440) * b.height)
  await p.getByRole('dialog', { name: /^Notes for/ }).waitFor()
  await p.keyboard.type('Call supplier')
  await p.keyboard.press('Escape')
  await settle()
  const d2 = await data()
  check(d2.notes.length === before && d2.slotNotes.length === 1 && d2.slotNotes[0].title === 'Call supplier', 'a calendar slot note is stored separately and adds no document')
  check((await panel.locator('[data-note-doc]').allInnerTexts()).every((t) => !t.includes('Call supplier')), 'the slot note does not appear in the Notes section')
  check((await col.locator('[data-note-card]').allInnerTexts()).some((t) => t.includes('Call supplier')), 'the slot note still shows in its calendar square')

  // Delete with confirmation.
  await panel.getByRole('button', { name: 'Open note Undated idea' }).click()
  await panel.getByRole('button', { name: 'Delete note' }).click()
  await panel.getByRole('button', { name: 'Cancel' }).click()
  check(await panel.getByLabel('Note title').isVisible(), 'cancelling the delete keeps the note')
  await panel.getByRole('button', { name: 'Delete note' }).click()
  await panel.getByRole('button', { name: 'Delete', exact: true }).click()
  check((await panel.getByRole('button', { name: 'Open note Undated idea' }).count()) === 0, 'confirming deletes the note')
  await settle()

  // 8. Refresh keeps everything.
  await p.reload()
  await p.getByText('Full Week').first().waitFor()
  check(JSON.stringify(await badgeDates()) === JSON.stringify([sat]), 'after refresh the badge is still on its day')
  await p.getByRole('button', { name: 'Notes', exact: true }).last().click()
  check(await panel.getByRole('button', { name: 'Open note Plan launch v2' }).isVisible(), 'after refresh the note is still in the Notes section')
  check((await p.locator('[data-day]').nth(2).locator('[data-note-card]').allInnerTexts()).some((t) => t.includes('Call supplier')), 'after refresh the slot note is still in its square')
  SHOTS && (await p.screenshot({ path: `${SHOTS}/notes-panel.png` }))

  // 9. Views keep working.
  await p.getByRole('button', { name: 'Day', exact: true }).click()
  check((await p.locator('[data-day]').count()) === 1, 'Day view works')
  await p.getByRole('button', { name: 'Month', exact: true }).click()
  await p.waitForTimeout(200)
  check((await p.locator('[data-day]').count()) === 0 && (await p.getByText(String(new Date().getFullYear())).count()) > 0, 'Month view works')
  await p.getByRole('button', { name: 'Full Week', exact: true }).click()
  check((await p.locator('[data-day]').count()) === 7, 'Full Week view works')

  // Migration of older mixed notes.
  const legacy = await p.request.post(`${B}/api/projects`, { data: { workspace: 'free', name: 'Legacy', color: 'blue' } })
  const lid = (await legacy.json()).project.id
  const ld = (await (await p.request.get(`${B}/api/projects/${lid}`)).json()).data
  ld.notes = [
    { id: 'old-slot', title: 'Old slot note', body: '', date: mon, time: '09:00', createdAt: 1 },
    { id: 'old-doc', title: 'Old timed doc', body: 'Has a description', date: mon, time: '10:00', createdAt: 2 },
  ]
  await p.request.put(`${B}/api/projects/${lid}/data`, { data: { data: ld } })
  await p.goto(`${B}/app/project/${lid}`, { waitUntil: 'networkidle' })
  await p.getByText('Full Week').first().waitFor()
  const legacyCards = await p.locator('[data-day]').first().locator('[data-note-card]').allInnerTexts()
  check(legacyCards.some((t) => t.includes('Old slot note')) && !legacyCards.some((t) => t.includes('Old timed doc')), 'migration: an old grid note stays in its square, an old document leaves the grid')
  check(JSON.stringify(await badgeDates()) === JSON.stringify([mon]), 'migration: the old document keeps its date as a badge')

  check(errors.length === 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll Notes-section checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
