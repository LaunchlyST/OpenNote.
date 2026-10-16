/**
 * Calendar zoom + up to three notes per 5-minute slot, in a real browser.
 *
 *   npm run dev
 *   node scripts/e2e-slot-notes.cjs     # needs the `playwright` package
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
const appReady = (p) => p.getByText('Full Week').first().waitFor({ timeout: 15000 })
const zoomLabel = (p) => p.getByTestId('zoom-label').innerText()
const popover = (p) => p.getByRole('dialog', { name: /^Notes for/ })

async function createProject(p, name) {
  await p.getByRole('button', { name: /Create (New|your first) Project/i }).first().click()
  await p.getByLabel('Project name').fill(name)
  await p.getByRole('button', { name: 'Create project' }).click()
  await appReady(p)
}

/** Clicks the grid of the first visible day at `minute` past midnight. */
async function clickSlot(p, minute) {
  const col = p.locator('[data-day]').first()
  const day = await col.getAttribute('data-day')
  // Scroll the time into view, then click relative to the column's top.
  await col.evaluate((el, m) => {
    const scroller = el.closest('.scroll-area')
    const h = el.getBoundingClientRect().height
    scroller.scrollTop = (m / 1440) * h - 120
  }, minute)
  const box = await col.boundingBox()
  const y = box.y + (minute / 1440) * box.height + 1
  await p.mouse.click(box.x + box.width * 0.2, y)
  await popover(p).waitFor()
  // At coarse zoom a click covers several 5-minute slots; pick the exact one.
  const select = popover(p).getByLabel('Time slot')
  if (await select.count()) await select.selectOption(String(Math.floor(minute / 5) * 5))
  return day
}

/** Ctrl + wheel over the calendar: dir 1 = in, -1 = out. */
async function wheelZoom(p, dir) {
  const box = await p.locator('[data-day]').first().boundingBox()
  await p.mouse.move(box.x + 40, 400)
  await p.keyboard.down('Control')
  await p.mouse.wheel(0, dir > 0 ? -120 : 120)
  await p.keyboard.up('Control')
  await p.waitForTimeout(160)
}

/** A two-finger pinch on the calendar, dispatched as real touch events. */
async function pinch(p, factor) {
  await p.locator('[data-day]').first().evaluate((col, f) => {
    const el = col.closest('.scroll-area')
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + 300
    const touches = (gap) => [
      new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy - gap }),
      new Touch({ identifier: 2, target: el, clientX: cx, clientY: cy + gap }),
    ]
    const fire = (type, list) =>
      el.dispatchEvent(new TouchEvent(type, { touches: list, targetTouches: list, changedTouches: list, bubbles: true, cancelable: true }))
    fire('touchstart', touches(50))
    fire('touchmove', touches(50 * f))
    fire('touchend', [])
  }, factor)
  await p.waitForTimeout(100)
}

async function addNote(p, text) {
  await popover(p).getByRole('button', { name: /Add (another )?note/ }).click()
  const inputs = popover(p).getByRole('textbox')
  const input = inputs.nth((await inputs.count()) - 1)
  await input.fill(text)
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))

  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill('Slot Tester')
  await p.getByLabel('Email address', { exact: true }).fill(`slots${Date.now()}@example.com`)
  await p.getByLabel('Password', { exact: true }).fill('slot-notes-pass-1')
  await p.getByLabel('Confirm password', { exact: true }).fill('slot-notes-pass-1')
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByRole('button', { name: 'Open Free workspace' }).click()
  await createProject(p, 'Alpha')
  check((await zoomLabel(p)) === '1 h', 'calendar opens zoomed out at 1-hour rows')
  check((await p.locator('[data-note-card]').count()) === 0, 'a new project has no notes')

  // 1–2. Three notes in one slot, and no fourth.
  await clickSlot(p, 9 * 60)
  const count = () => popover(p).getByTestId('slot-count').innerText()
  check((await count()).startsWith('0 of 3'), 'clicking a slot shows its (empty) note count')
  await addNote(p, 'Call client')
  check((await count()).startsWith('1 of 3'), '1 note created in the 09:00 slot')
  await addNote(p, 'Send invoice')
  check((await count()).startsWith('2 of 3'), '2nd note created in the same slot')
  await addNote(p, 'Review design')
  check((await count()).startsWith('3 of 3'), '3rd note created in the same slot')
  const addBtn = popover(p).getByRole('button', { name: /Slot full/ })
  check((await addBtn.isDisabled()) === true, 'a 4th note is prevented (Add Note disabled)')
  await shot(p, 'slot-popover-full')

  // Edit and delete inside the popover.
  await popover(p).getByLabel('Note 2', { exact: true }).fill('Send invoice #42')
  await p.keyboard.press('Escape')

  // 5. Zoomed out: first note and +2.
  await p.waitForTimeout(200)
  const firstCard = p.locator('[data-note-card]').first()
  check((await firstCard.innerText()).includes('Call client') && (await firstCard.innerText()).includes('+2'), 'zoomed out shows “Call client +2”')
  await p.locator('[data-note-card]').first().scrollIntoViewIfNeeded()
  await shot(p, 'zoomed-out')

  // 6. +2 opens all notes.
  await p.getByRole('button', { name: 'Show all 3 notes' }).click()
  await popover(p).waitFor()
  const vals = await popover(p).getByRole('textbox').evaluateAll((els) => els.map((e) => e.value))
  check(vals.join('|') === 'Call client|Send invoice #42|Review design', `+2 opens all three notes (${vals.join(', ')})`)
  await p.keyboard.press('Escape')

  // 3. Zoom 1 h → 30 → 15 → 5 min by gesture (no buttons).
  check((await p.getByRole('button', { name: /Zoom (in|out)/ }).count()) === 0, 'there are no zoom buttons')
  const labels = [await zoomLabel(p)]
  for (let i = 0; i < 3; i++) {
    await wheelZoom(p, 1)
    labels.push(await zoomLabel(p))
  }
  check(labels.join(' → ') === '1 h → 30 min → 15 min → 5 min', `Ctrl + scroll zooms in: ${labels.join(' → ')}`)
  await wheelZoom(p, 1)
  check((await zoomLabel(p)) === '5 min', 'zooming in stops at 5-minute intervals')
  const tall = await p.locator('[data-day]').first().evaluate((el) => el.getBoundingClientRect().height)
  check(tall > 24 * 56 * 5, `zoomed-in calendar is taller and scrolls (${Math.round(tall)}px)`)

  // 4. Fully zoomed in: all three cards inside the 09:00–09:05 row of that day.
  const cards = p.locator('[data-note-card]')
  const texts = await cards.allInnerTexts()
  check(texts.length === 3 && ['Call client', 'Send invoice #42', 'Review design'].every((t, i) => texts[i].includes(t)), `5-minute zoom shows all three notes (${texts.join(' / ')})`)
  const geo = await p.locator('[data-day]').first().evaluate((col) => {
    const c = col.getBoundingClientRect()
    const rowPx = c.height / 288
    const rowTop = c.top + 108 * rowPx
    return [...col.querySelectorAll('[data-note-card]')].map((el) => {
      const r = el.getBoundingClientRect()
      return r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= rowTop - 0.5 && r.bottom <= rowTop + rowPx + 0.5
    })
  })
  check(geo.length === 3 && geo.every(Boolean), 'note cards stay inside their own day and 5-minute slot')
  await p.locator('[data-note-card]').first().scrollIntoViewIfNeeded()
  await shot(p, 'zoomed-in')

  // Ctrl + wheel zooms the calendar, not the page.
  const before = await zoomLabel(p)
  await wheelZoom(p, -1)
  const pageZoom = await p.evaluate(() => window.visualViewport ? window.visualViewport.scale : 1)
  check(before === '5 min' && (await zoomLabel(p)) === '15 min' && pageZoom === 1, 'Ctrl + scroll zooms the calendar out without browser zoom')
  await pinch(p, 0.6)
  check((await zoomLabel(p)) === '30 min', 'two-finger pinch in zooms out')
  await pinch(p, 1.6)
  check((await zoomLabel(p)) === '15 min', 'two-finger pinch out zooms in')
  await pinch(p, 0.6)
  await pinch(p, 0.6)
  check((await zoomLabel(p)) === '1 h', 'pinching back reaches 1-hour rows')

  // Several occupied slots in one visible hour stay reachable.
  await clickSlot(p, 9 * 60 + 20)
  await addNote(p, 'Prep slides')
  await p.keyboard.press('Escape')
  await clickSlot(p, 9 * 60 + 40)
  await addNote(p, 'Book room')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(200)
  const hourCards = await p.locator('[data-day]').first().locator('[data-note-card]').allInnerTexts()
  check(hourCards.some((t) => t.includes('Call client')) && hourCards.some((t) => /\+\d+ more note/.test(t)), `three busy slots in one hour show an overflow indicator (${hourCards.join(' / ')})`)
  await p.getByRole('button', { name: /more note/ }).click()
  await popover(p).waitFor()
  const opts = await popover(p).getByLabel('Time slot').locator('option').allInnerTexts()
  check(opts.filter((o) => /note/.test(o)).length === 3, 'the overflow popover lists every occupied slot in that hour')
  await p.keyboard.press('Escape')

  // Delete one note.
  await clickSlot(p, 9 * 60 + 40)
  await popover(p).getByRole('button', { name: 'Delete note 1' }).click()
  check((await popover(p).getByTestId('slot-count').innerText()).startsWith('0 of 3'), 'a note can be deleted')
  await p.keyboard.press('Escape')

  // Day view zoom.
  await p.getByRole('button', { name: 'Day', exact: true }).click()
  await wheelZoom(p, 1)
  check((await zoomLabel(p)) === '30 min', 'zoom works in Day view')
  await wheelZoom(p, -1)
  await p.getByRole('button', { name: 'Full Week', exact: true }).click()

  // 8. Refresh.
  await p.waitForTimeout(1000)
  await p.reload()
  await appReady(p)
  const afterReload = await p.locator('[data-note-card]').allInnerTexts()
  check(afterReload.some((t) => t.includes('Call client') && t.includes('+2')) && afterReload.some((t) => t.includes('Prep slides')) && !afterReload.some((t) => t.includes('Book room')), `notes are still saved after a refresh (${afterReload.join(' / ').replace(/\n/g, ' ')})`)

  // Switching weeks and back.
  await p.getByRole('button', { name: 'Next', exact: true }).click()
  check((await p.locator('[data-note-card]').count()) === 0, 'next week shows none of this week’s notes')
  await p.getByRole('button', { name: 'Previous', exact: true }).click()
  check((await p.locator('[data-note-card]').count()) > 0, 'notes are back when returning to the week')

  // 7. Another project never sees them.
  await p.getByRole('button', { name: /Back to Projects/ }).click()
  await p.getByText(/All projects/).first().waitFor()
  await createProject(p, 'Beta')
  check((await p.locator('[data-note-card]').count()) === 0, 'project Beta has none of Alpha’s notes')
  await clickSlot(p, 9 * 60)
  check((await popover(p).getByTestId('slot-count').innerText()).startsWith('0 of 3'), 'Beta’s 09:00 slot is empty')
  await addNote(p, 'Beta only')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(900)
  await p.getByRole('button', { name: /Back to Projects/ }).click()
  await p.getByRole('button', { name: 'Open Alpha', exact: true }).first().click()
  await appReady(p)
  const alpha = await p.locator('[data-note-card]').allInnerTexts()
  check(alpha.some((t) => t.includes('Call client')) && !alpha.some((t) => t.includes('Beta only')), 'reopening Alpha shows only Alpha’s notes')

  check(errors.length === 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll slot-note checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
