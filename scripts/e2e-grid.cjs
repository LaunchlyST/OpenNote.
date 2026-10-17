/**
 * Calendar grid: exact-square hover and selection, every 5-minute slot
 * selectable, alignment across zoom levels, notes stay in their slots, and
 * all seven days behave the same.
 *
 *   npm run dev
 *   node scripts/e2e-grid.cjs     # needs the `playwright` package
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
const hm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

;(async () => {
  const browser = await chromium.launch()
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))

  await p.goto(`${B}/app/signup`, { waitUntil: 'networkidle' })
  await p.getByLabel('Full name', { exact: true }).fill('Grid Tester')
  await p.getByLabel('Email address', { exact: true }).fill(`grid${Date.now()}@example.com`)
  await p.getByLabel('Password', { exact: true }).fill('grid-tester-pass1')
  await p.getByLabel('Confirm password', { exact: true }).fill('grid-tester-pass1')
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByRole('button', { name: 'Open Free workspace' }).click()
  await p.getByRole('button', { name: /Create your first project/ }).click()
  await p.getByLabel('Project name').fill('Grid')
  await p.getByRole('button', { name: 'Create project' }).click()
  await p.getByText('Full Week').first().waitFor()

  const cols = p.locator('[data-day]')
  const scroller = p.locator('.scroll-area').filter({ has: cols.first() })
  const label = () => p.getByTestId('zoom-label').innerText()
  const reveal = (minute) => scroller.evaluate((el, m) => {
    const col = el.querySelector('[data-day]')
    el.scrollTop = (m / 1440) * col.getBoundingClientRect().height - 200
  }, minute)
  /** Viewport y of `minute` in a column. */
  const yOf = async (i, minute) => {
    const b = await cols.nth(i).boundingBox()
    return { x: b.x, w: b.width, y: b.y + (minute / 1440) * b.height, h: b.height }
  }
  const zoomTo = async (target) => {
    const t = p.getByRole('button', { name: /scroll wheel/ })
    if ((await t.getAttribute('aria-pressed')) !== 'true') await t.click()
    for (let i = 0; i < 6 && (await label()) !== target; i++) {
      const order = ['1 h', '30 min', '15 min', '5 min']
      const dir = order.indexOf(target) > order.indexOf(await label()) ? 120 : -120
      const b = await cols.first().boundingBox()
      await p.mouse.move(b.x + 20, 450)
      await p.mouse.wheel(0, dir)
      await p.waitForTimeout(160)
    }
    await t.click()
  }
  const inside = (r, c) => r.x >= c.x - 0.5 && r.x + r.width <= c.x + c.w + 0.5

  // 0. Square cells at every zoom level, and they grow with the screen.
  const squareAt = async () => {
    const c = await cols.nth(3).boundingBox()
    const order = { '1 h': 60, '30 min': 30, '15 min': 15, '5 min': 5 }
    const rowH = (c.height / 1440) * order[await label()]
    return { w: c.width, h: rowH }
  }
  const sizes = []
  for (const lvl of ['1 h', '30 min', '15 min', '5 min']) {
    await zoomTo(lvl)
    const q = await squareAt()
    sizes.push(`${lvl} ${Math.round(q.w)}×${Math.round(q.h)}`)
    check(Math.abs(q.w - q.h) <= 2, `${lvl}: each slot is a square (${q.w.toFixed(0)} × ${q.h.toFixed(0)} px)`)
  }
  await zoomTo('1 h')
  const small = (await squareAt()).w
  await p.setViewportSize({ width: 1920, height: 1080 })
  await p.waitForTimeout(300)
  const big = await squareAt()
  check(big.w > small + 20 && Math.abs(big.w - big.h) <= 2, `a wider screen gives bigger squares (${Math.round(small)} → ${Math.round(big.w)} px)`)
  const ws = await cols.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
  check(Math.max(...ws) - Math.min(...ws) <= 1, `all seven columns are equal width (${ws.join(', ')})`)
  await reveal(10 * 60)
  const l10 = await p.locator('div', { hasText: /^10:00$/ }).first().boundingBox()
  check(Math.abs(l10.y + l10.height / 2 - (await yOf(0, 600)).y) < 2, 'the 10:00 label lines up with its square')
  SHOTS && (await p.screenshot({ path: `${SHOTS}/grid-squares-1920.png` }))
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.waitForTimeout(300)

  // 1. Hover highlights exactly the square under the mouse.
  await reveal(10 * 60)
  let at = await yOf(2, 10 * 60 + 30)
  await p.mouse.move(at.x + at.w / 2, at.y)
  const hover = p.getByTestId('slot-hover')
  await hover.waitFor()
  const hb = await hover.boundingBox()
  const rowTop = (await yOf(2, 600)).y
  const rowBot = (await yOf(2, 660)).y
  check((await hover.count()) === 1 && (await hover.innerText()) === '10:00–11:00', `hovering shows one square labelled ${await hover.innerText()}`)
  check(inside(hb, at) && hb.y >= rowTop - 1 && hb.y + hb.height <= rowBot + 1, 'the hovered square sits exactly in that day and hour')
  SHOTS && (await p.screenshot({ path: `${SHOTS}/grid-hover.png` }))

  // 2. Clicking selects that day and time and opens the slot popover.
  await p.mouse.click(at.x + at.w / 2, at.y)
  const sel = p.getByTestId('slot-selected')
  const day2 = await cols.nth(2).getAttribute('data-day')
  const d2 = new Date(day2 + 'T00:00')
  const wd = d2.toLocaleDateString('en-US', { weekday: 'short' })
  check((await sel.count()) === 1 && (await sel.innerText()).includes(`${d2.getDate()} · 10:00–11:00`), `click selects ${await sel.innerText()}`)
  check(await p.getByRole('dialog', { name: /Notes for 10:00–10:05/ }).isVisible(), 'the note/event popover opens for that slot')
  check((await hover.count()) === 0, 'only the selected square is highlighted (no neighbour)')
  await p.keyboard.press('Escape')
  check((await sel.count()) === 1, 'the square stays selected after closing the popover')

  // 3. At 5-minute zoom every 5-minute slot in an hour is individually selectable.
  await zoomTo('5 min')
  check((await label()) === '5 min', 'zoomed to 5-minute slots')
  let all = true
  const seen = []
  for (let k = 0; k < 12; k++) {
    const m = 9 * 60 + k * 5
    await reveal(m)
    const pt = await yOf(4, m + 2.5)
    await p.mouse.click(pt.x + pt.w / 2, pt.y)
    const txt = await sel.innerText()
    seen.push(txt.split('· ')[1])
    if (!txt.endsWith(`${hm(m)}–${hm(m + 5)}`)) all = false
    await p.keyboard.press('Escape')
  }
  check(all, `all twelve 5-minute slots 09:00–10:00 select individually (${seen[0]} … ${seen[11]})`)
  const tick = await p.locator('div', { hasText: /^09:05$/ }).count()
  check(tick > 0, 'the time column shows 5-minute labels at maximum zoom')

  // 5 (part). A note in 09:35 sits inside its slot.
  await reveal(9 * 60 + 35)
  const s35 = await yOf(4, 9 * 60 + 36)
  await p.mouse.click(s35.x + s35.w / 2, s35.y)
  await p.getByRole('button', { name: /Add note/ }).click()
  await p.getByLabel('Note 1', { exact: true }).fill('Prep agenda')
  await p.keyboard.press('Escape')
  const card = cols.nth(4).locator('[data-note-card]').first()
  const cb = await card.boundingBox()
  const t35 = (await yOf(4, 575)).y
  const t40 = (await yOf(4, 580)).y
  check(cb.y >= t35 - 1 && cb.y + cb.height <= t40 + 1, 'the note card sits inside 09:35–09:40')
  SHOTS && (await p.screenshot({ path: `${SHOTS}/grid-5min.png` }))

  // 4. Zooming keeps the grid aligned and the selection visible.
  for (const lvl of ['15 min', '30 min', '1 h']) {
    await zoomTo(lvl)
    const sb = await sel.boundingBox()
    const view = await scroller.boundingBox()
    const exp = (await yOf(4, 575)).y
    check(Math.abs(sb.y - (exp + 1)) < 2 && sb.y >= view.y && sb.y <= view.y + view.height, `${lvl}: the selected 09:35 square stays aligned and on screen`)
  }
  await zoomTo('30 min')
  const lab = p.locator('div', { hasText: /^09:30$/ }).first()
  const lb = await lab.boundingBox()
  const line = (await yOf(0, 570)).y
  check(Math.abs(lb.y + lb.height / 2 - line) < 2, '30-minute labels line up with their grid lines')
  await zoomTo('1 h')
  const out = await cols.nth(4).locator('[data-note-card]').allInnerTexts()
  check(out.some((t) => t.includes('09:35') && t.includes('Prep agenda')), 'zoomed out, the note still shows in its 09:35 slot')

  // 6. All seven days.
  await reveal(14 * 60)
  let ok7 = true
  for (let i = 0; i < 7; i++) {
    const c = await yOf(i, 14 * 60 + 20)
    await p.mouse.move(c.x + c.w / 2, c.y)
    await p.waitForTimeout(40)
    const b = await hover.boundingBox()
    if (!b || !inside(b, c) || (await hover.innerText()) !== '14:00–15:00') ok7 = false
  }
  check(ok7, 'hover works on all seven days')

  check(errors.length === 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll grid checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
