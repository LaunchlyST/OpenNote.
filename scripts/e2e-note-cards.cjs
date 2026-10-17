/**
 * Calendar time-slot note cards (mint task cards): one card + "+N" when
 * zoomed out, up to three cards when zoomed in, checkbox saves, the
 * collaboration placeholder says Coming Soon, the Notes section is separate.
 *
 *   npm run dev
 *   node scripts/e2e-note-cards.cjs     # needs the `playwright` package
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
  await p.getByLabel('Full name', { exact: true }).fill('Card Tester')
  await p.getByLabel('Email address', { exact: true }).fill(`cards${Date.now()}@example.com`)
  await p.getByLabel('Password', { exact: true }).fill('card-tester-pass-1')
  await p.getByLabel('Confirm password', { exact: true }).fill('card-tester-pass-1')
  await p.getByRole('button', { name: 'Create account' }).click()
  await p.getByRole('button', { name: /Get Started Free/ }).click()
  await p.getByRole('button', { name: 'Create Project', exact: true }).first().click()
  await p.getByLabel('Project name').fill('Cards')
  await p.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click()
  await p.locator('[data-project-card]').first().getByRole('button', { name: /^Open Project/ }).click()
  await p.getByText('Full Week').first().waitFor()

  const col = p.locator('[data-day]').nth(1)
  const cards = col.locator('[data-note-card]')
  const pop = p.getByRole('dialog', { name: /^Notes for/ })
  const zoomLabel = () => p.getByTestId('zoom-label').innerText()
  const zoomTo = async (target) => {
    const t = p.getByRole('button', { name: /scroll wheel/ })
    await t.click()
    const order = ['1 h', '30 min', '15 min', '5 min']
    for (let i = 0; i < 6 && (await zoomLabel()) !== target; i++) {
      const b = await col.boundingBox()
      await p.mouse.move(b.x + 20, 450)
      await p.mouse.wheel(0, order.indexOf(target) > order.indexOf(await zoomLabel()) ? 120 : -120)
      await p.waitForTimeout(170)
    }
    await t.click()
  }
  const reveal = (m) => col.evaluate((el, min) => (el.closest('.scroll-area').scrollTop = (min / 1440) * el.getBoundingClientRect().height - 150), m)

  // Three notes in the 09:00 slot (one with a description).
  await reveal(540)
  const b = await col.boundingBox()
  await p.mouse.click(b.x + b.width / 2, b.y + (541 / 1440) * b.height)
  await pop.waitFor()
  await pop.getByLabel('Time slot').selectOption('540').catch(() => {})
  for (const [t, d] of [['Design 2 App Screens', 'To Do'], ['Send invoice', ''], ['Review copy', '']]) {
    await pop.getByRole('button', { name: /Add (another )?note/ }).click()
    const i = await pop.getByRole('textbox', { name: /^Note \d$/ }).count()
    await pop.getByLabel(`Note ${i}`, { exact: true }).fill(t)
    if (d) await pop.getByLabel(`Note ${i} description`).fill(d)
  }
  check((await pop.getByRole('button', { name: /Slot full/ }).isDisabled()), 'a slot holds at most 3 notes')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(200)

  // 1 + 2. Zoomed out: ONE card with +2.
  const out = await cards.allInnerTexts()
  check(out.length === 1 && out[0].includes('Design 2 App Screens') && out[0].includes('+2'), `zoomed out: one card “Design 2 App Screens +2” (${out.length} card)`)
  check(out[0].includes('09:00 – 09:05'), 'the card shows its clock time')
  SHOTS && (await cards.first().scrollIntoViewIfNeeded(), await p.screenshot({ path: `${SHOTS}/cards-1h.png` }))

  // 3. Zooming in reveals the others, max 3, all inside the slot.
  await zoomTo('5 min')
  await reveal(540)
  const zin = await cards.allInnerTexts()
  check(zin.length === 3 && ['Design 2 App Screens', 'Send invoice', 'Review copy'].every((t, i) => zin[i].includes(t)), `5-minute zoom: three separate cards (${zin.length})`)
  check(zin[0].includes('To Do'), 'the description shows when zoomed in')
  const inside = await col.evaluate((c) => {
    const r = c.getBoundingClientRect()
    const top = r.top + (540 / 1440) * r.height
    const bot = r.top + (545 / 1440) * r.height
    return [...c.querySelectorAll('[data-note-card]')].every((el) => {
      const e = el.getBoundingClientRect()
      return e.top >= top - 0.5 && e.bottom <= bot + 0.5 && e.left >= r.left - 0.5 && e.right <= r.right + 0.5
    })
  })
  check(inside, 'all cards stay inside their day and 09:00–09:05 slot')
  SHOTS && (await p.screenshot({ path: `${SHOTS}/cards-5min.png` }))

  // 8. Collaboration placeholder.
  const collab = cards.first().getByRole('button', { name: 'Team collaboration — Coming Soon' })
  await collab.hover()
  await p.waitForTimeout(200)
  const tip = cards.first().getByRole('tooltip')
  check((await tip.innerText()) === 'Team collaboration — Coming Soon' && (await tip.evaluate((e) => getComputedStyle(e).opacity)) === '1', 'the collaboration placeholder says “Team collaboration — Coming Soon”')
  await collab.click({ force: true })
  check((await pop.count()) === 0, 'clicking the placeholder does not open or change anything')

  // 7. Checkbox saves.
  await cards.nth(1).getByRole('checkbox').click()
  check((await cards.nth(1).getByRole('checkbox').getAttribute('aria-checked')) === 'true', 'ticking a card marks it done')
  check((await cards.nth(0).getByRole('checkbox').getAttribute('aria-checked')) === 'false', 'other notes stay unticked')

  // 6. Clicking a card opens the editor for its slot.
  await cards.nth(2).click()
  await pop.waitFor()
  check((await pop.getAttribute('aria-label')).includes('09:00–09:05'), 'clicking a card opens its editor for the same slot')
  await p.keyboard.press('Escape')

  // Refresh keeps everything.
  await p.waitForTimeout(1000)
  await p.reload()
  await p.getByText('Full Week').first().waitFor()
  const after = await cards.allInnerTexts()
  check(after.length === 1 && after[0].includes('+2'), 'after refresh: one card, +2, all notes kept')
  await zoomTo('5 min')
  await reveal(540)
  check((await cards.nth(1).getByRole('checkbox').getAttribute('aria-checked')) === 'true', 'the done state survives a refresh')

  // 10. Notes section untouched.
  await p.getByRole('button', { name: 'Notes', exact: true }).last().click()
  const panelDocs = await p.locator('[data-note-doc]').count()
  check(panelDocs === 0, 'calendar notes never appear in the Notes section')

  // Day view + narrow screen.
  await p.getByRole('button', { name: 'Notes', exact: true }).last().click()
  await p.getByRole('button', { name: 'Day', exact: true }).click()
  check((await p.locator('[data-day]').count()) === 1, 'Day view still works')
  await p.getByRole('button', { name: 'Full Week', exact: true }).click()
  await p.setViewportSize({ width: 820, height: 1000 })
  await p.waitForTimeout(300)
  const tablet = await col.evaluate((c) =>
    [...c.querySelectorAll('[data-note-card]')].every((el) => {
      const e = el.getBoundingClientRect()
      const r = c.getBoundingClientRect()
      return e.left >= r.left - 0.5 && e.right <= r.right + 0.5
    }),
  )
  check(tablet, 'on a tablet-width screen the cards stay inside their column')

  check(errors.length === 0, `no JavaScript errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll note-card checks passed.')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log(`  FAIL  ${e.message}`)
  process.exit(1)
})
