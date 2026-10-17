/**
 * Current-time indicator: only in today's column of the calendar grid, never
 * over Settings, correct local time, moves with the clock, stays aligned at
 * every zoom, independent of the blue selection, hidden on other weeks.
 *
 *   npm run dev
 *   node scripts/e2e-now-line.cjs     # needs the `playwright` package
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
const pad = (v) => String(v).padStart(2, '0')

;(async () => {
  const browser = await chromium.launch()
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const start = new Date()
  start.setHours(9, 47, 0, 0)
  await p.clock.install({ time: start })
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))

  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill('Now Tester')
  await p.getByLabel('Email address', { exact: true }).fill(`now${Date.now()}@example.com`)
  await p.getByLabel('Password', { exact: true }).fill('now-line-tester-1')
  await p.getByLabel('Confirm password', { exact: true }).fill('now-line-tester-1')
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByRole('button', { name: 'Open Free workspace' }).click()
  await p.getByRole('button', { name: /Create your first project/ }).click()
  await p.getByLabel('Project name').fill('Now')
  await p.getByRole('button', { name: 'Create project' }).click()
  await p.getByText('Full Week').first().waitFor()

  const todayKey = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  const line = p.getByTestId('now-line')
  const label = p.getByTestId('now-label')
  const col = p.locator(`[data-day="${todayKey}"]`)
  const scroller = p.locator('.scroll-area').filter({ has: p.locator('[data-day]') })
  const expectedY = async (min) => {
    const c = await col.boundingBox()
    return c.y + (min / 1440) * c.height
  }
  const lineOk = async (min) => {
    await line.scrollIntoViewIfNeeded()
    const l = await line.boundingBox()
    const c = await col.boundingBox()
    return Math.abs(l.y - (await expectedY(min))) < 2 && l.x >= c.x - 1 && l.x + l.width <= c.x + c.width + 1
  }

  // 2 + 3. Only in today's column, with the local time.
  check((await line.count()) === 1 && (await lineOk(9 * 60 + 47)), "the line sits in today's column at 09:47")
  check((await label.innerText()) === '09:47', `the time label reads ${await label.innerText()}`)
  check((await p.getByTestId('today-pill').count()) === 1, 'exactly one day is marked “Today”')
  SHOTS && (await p.screenshot({ path: `${SHOTS}/now-line.png` }))

  // 1 + 9. Never over Settings; restored on return.
  await p.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await p.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
  await p.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Account' }).click()
  check((await line.count()) === 0 && (await label.count()) === 0, 'Settings open: no current-time line or label exists')
  const red = await p.evaluate(() =>
    [...document.querySelectorAll('*')].some((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && /239, 68, 68|255, 90, 95/.test(cs.borderTopColor + cs.backgroundColor) && el.closest('[data-testid]') == null
    }),
  )
  check(!red, 'nothing red is painted over the Settings page')
  SHOTS && (await p.screenshot({ path: `${SHOTS}/now-settings.png` }))
  await p.getByRole('button', { name: 'Back to calendar' }).click()
  await p.waitForTimeout(300)
  check((await line.count()) === 1 && (await lineOk(9 * 60 + 47)), 'back on the calendar the line returns in the right place')

  // 4. Moves with time.
  await p.clock.fastForward('10:00')
  await p.waitForTimeout(200)
  check((await label.innerText()) === '09:57' && (await lineOk(9 * 60 + 57)), `ten minutes later it reads ${await label.innerText()} and has moved`)

  // 5. Aligned at every zoom.
  const toggle = p.getByRole('button', { name: /scroll wheel/ })
  await toggle.click()
  let aligned = true
  for (let i = 0; i < 3; i++) {
    const b = await col.boundingBox()
    await p.mouse.move(b.x + 20, 450)
    await p.mouse.wheel(0, 120)
    await p.waitForTimeout(180)
    if (!(await lineOk(9 * 60 + 57))) aligned = false
  }
  check(aligned && (await p.getByTestId('zoom-label').innerText()) === '5 min', 'the line stays aligned through 30, 15 and 5-minute zoom')
  await toggle.click()

  // 6 + 7. Clicking a 5-minute square selects exactly it; the line does not move.
  const lineY = (await line.boundingBox()).y - (await scroller.boundingBox()).y + (await scroller.evaluate((el) => el.scrollTop))
  await scroller.evaluate((el, m) => {
    const c = el.querySelector('[data-day]')
    el.scrollTop = (m / 1440) * c.getBoundingClientRect().height - 150
  }, 10 * 60 + 30)
  const cb = await col.boundingBox()
  await p.mouse.click(cb.x + cb.width / 2, cb.y + ((10 * 60 + 32) / 1440) * cb.height)
  const sel = p.getByTestId('slot-selected')
  const weekday = start.toLocaleDateString(undefined, { weekday: 'long' })
  check((await sel.innerText()) === `${weekday} ${start.getDate()} · 10:30–10:35`, `clicking selects ${await sel.innerText()}`)
  await p.getByRole('button', { name: /Add note/ }).click()
  await p.keyboard.type('Stand-up prep')
  await p.keyboard.press('Escape')
  await p.locator('[data-note-card]').first().click()
  await p.keyboard.press('Escape')
  const lineY2 = (await line.boundingBox()).y - (await scroller.boundingBox()).y + (await scroller.evaluate((el) => el.scrollTop))
  check(Math.abs(lineY - lineY2) < 1, 'selecting a square or a note does not move the current-time line')
  check((await p.locator('[data-note-card][data-selected]').count()) === 1, 'selecting the note marks its own card')

  // 10. The line never covers events or notes.
  await line.scrollIntoViewIfNeeded()
  const l = await line.boundingBox()
  await p.waitForTimeout(1200) // let the page's own autosave land first
  const pid = p.url().split('/').pop()
  const d = (await (await p.request.get(`${B}/api/projects/${pid}`)).json()).data
  const evStart = new Date(start)
  evStart.setHours(9, 30)
  d.events.push({ id: 'evt_now', title: 'Over the line', calendarId: d.calendars[0].id, start: evStart.toISOString(), end: new Date(+evStart + 3600e3).toISOString() })
  await p.request.put(`${B}/api/projects/${pid}/data`, { data: { data: d } })
  await p.reload()
  await p.getByText('Full Week').first().waitFor()
  await line.scrollIntoViewIfNeeded()
  const l2 = await line.boundingBox()
  const c2 = await col.boundingBox()
  const top = await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[title]')?.getAttribute('title') ?? '', [c2.x + c2.width / 2, l2.y + 1])
  const what = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.outerHTML.slice(0, 160) : 'none' }, [c2.x + c2.width / 2, l2.y + 1])
  check(top.startsWith('Over the line'), `an event under the line stays on top (the line does not cover it) [${top} | ${what}]`)

  // 8. Other weeks hide the line.
  await p.getByRole('button', { name: 'Next', exact: true }).click()
  check((await line.count()) === 0 && (await label.count()) === 0 && (await p.getByTestId('today-pill').count()) === 0, 'next week: no current-time line')
  await p.getByRole('button', { name: 'Previous', exact: true }).click()
  check((await line.count()) === 1, 'this week again: the line is back')

  check(errors.length === 0 && l.width > 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll current-time checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
