/**
 * Store V2 browser checks: card layouts, draggable title/description (mouse,
 * keyboard, snapping, reset), autosave across a refresh, draft vs published,
 * the product detail panel (click, deep link, Escape, Back, focus), the mobile
 * sheet with its purchase bar, and reduced motion.
 *
 *   npx tsx scripts/e2e-store-v2.ts
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright') as typeof import('playwright')

const tmp = mkdtempSync(join(tmpdir(), 'desknoty-e2e-v2-'))
/** A port nothing else is using right now. */
const freePort = () => new Promise<number>((resolve) => { const srv = createServer(); srv.listen(0, () => { const p = (srv.address() as { port: number }).port; srv.close(() => resolve(p)) }) })
const API_PORT = await freePort()
const WEB_PORT = await freePort()
const SITE = `http://localhost:${WEB_PORT}`
const DB = join(tmp, 'e2e.db')
const SHOTS = process.env.SHOTS_DIR

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  PASS  ${label}`)
  else { failures += 1; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

function run(cmd: string[], env: Record<string, string>, ready: string): Promise<ChildProcess> {
  const child = spawn(cmd[0], cmd.slice(1), { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let log = ''
  child.stdout!.on('data', (d) => (log += d))
  child.stderr!.on('data', (d) => (log += d))
  return new Promise((resolve, reject) => {
    const t = setInterval(() => log.includes(ready) && (clearInterval(t), resolve(child)), 100)
    child.once('exit', (code) => (clearInterval(t), reject(new Error(`${cmd.join(' ')} exited (${code}):\n${log}`))))
  })
}

const api = await run([process.execPath, '--import', 'tsx', 'server/index.ts'], {
  NODE_ENV: 'development', BETTER_AUTH_URL: SITE, BETTER_AUTH_SECRET: 'f'.repeat(64), DATABASE_PATH: DB,
  MAILBOX_DIR: join(tmp, 'mailbox'), SELLER_FILES_DIR: join(tmp, 'files'), SELLER_MEDIA_DIR: join(tmp, 'media'),
  API_PORT: String(API_PORT), SMTP_HOST: '', SMTP_PRESET: '', REQUIRE_EMAIL_VERIFICATION: 'false',
  STRIPE_SECRET_KEY: '', TIKTOK_CLIENT_KEY: '', TIKTOK_CLIENT_SECRET: '',
}, 'listening')
const web = await run(['npx', 'vite', 'preview', '--port', String(WEB_PORT), '--strictPort'], { API_PORT: String(API_PORT) }, 'Local')

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const H = { origin: SITE }
  await page.goto(`${SITE}/app/signin`)
  await page.request.post(`${SITE}/api/auth/sign-up/email`, { data: { name: 'Ava', email: 'ava@v2.test', password: 'a-long-enough-password' }, headers: H })
  const db = new Database(DB)
  db.prepare("UPDATE \"user\" SET plan = 'pro', emailVerified = 1 WHERE email = 'ava@v2.test'").run()
  await page.request.post(`${SITE}/api/projects`, { data: { workspace: 'pro', name: 'Studio', color: 'lime' }, headers: H })
  await page.request.post(`${SITE}/api/seller/store`, { data: { name: 'Ava Makes', handle: 'ava-makes' }, headers: H })
  const created = await (await page.request.post(`${SITE}/api/seller/products`, { data: { title: 'Content planner', description: 'A Notion template for planning a month of videos.\n\nIncludes a calendar and caption bank.', priceMinor: 1200, currency: 'gbp' }, headers: H })).json()
  const pid = created.product.id as string
  await page.request.put(`${SITE}/api/seller/products/${pid}/file`, { data: Buffer.from('PLANNER'), headers: { ...H, 'content-type': 'application/pdf', 'x-file-name': 'planner.pdf' } })
  let st = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store
  const rev = st.products.find((p: { id: string }) => p.id === pid).revision
  await page.request.patch(`${SITE}/api/seller/products/${pid}`, { data: { revision: rev, extras: { layout: 'showcase', subtitle: 'Plan a month in one afternoon', included: ['Content calendar', '120 caption ideas'], format: 'Notion template', access: 'Instant access', faq: [{ q: 'Do I need Notion?', a: 'Yes, a free account works.' }] } }, headers: H })
  st = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store
  const blocks = [st.draft.blocks[0], { id: 'blk_grid1', type: 'grid', hidden: false, data: { heading: 'Shop', productIds: [pid] } }, ...st.draft.blocks.slice(1).filter((b: { type: string }) => b.type !== 'grid')]
  await page.request.put(`${SITE}/api/seller/store/draft`, { data: { page: { ...st.draft, blocks }, revision: st.revision }, headers: H })

  // ---- Editor: Card appearance, drag and keyboard
  await page.goto(`${SITE}/app/pro`)
  await page.waitForURL(/\/app\/project\//)
  await page.evaluate((k) => sessionStorage.setItem(k, '1'), `desknoty.seller.tiktok-step.${st.id}`)
  await page.getByRole('button', { name: 'Seller', exact: true }).click()
  await page.getByRole('tab', { name: /Products/ }).click()
  await page.getByText('Content planner').first().click()
  const section = page.getByRole('button', { name: /Card appearance/ })
  await section.click()
  const title = page.getByRole('slider', { name: 'Title position' })
  await title.waitFor()
  check('editor shows the live card with a movable title', await title.isVisible())
  for (const name of ['Product details', 'Media & previews', 'Pricing & offers', 'Card appearance', 'Publishing'])
    check(`editor section: ${name}`, (await page.getByRole('button', { name: new RegExp(name.replace('&', '&')) }).count()) > 0)

  // drag the title to the middle: it snaps to the centre guide
  await title.scrollIntoViewIfNeeded()
  const box = (await title.boundingBox())!
  const zone = (await page.locator('.pe2-stage .sp-card-body').boundingBox())!
  await page.mouse.move(box.x + 5, box.y + box.height / 2)
  await page.mouse.down()
  const target = zone.x + zone.width / 2 - box.width / 2 + 5 + 4 // a little off centre, inside the snap distance
  await page.mouse.move(target, box.y + box.height / 2, { steps: 12 })
  check('centre guide shows while dragging near the middle', (await page.locator('.sp-guide').count()) === 1)
  await page.mouse.up()
  check('title snaps to the centre', (await title.getAttribute('aria-valuenow')) === '50', String(await title.getAttribute('aria-valuenow')))
  // drag far right: stays inside the card
  await title.scrollIntoViewIfNeeded()
  const b2 = (await title.boundingBox())!
  await page.mouse.move(b2.x + 5, b2.y + b2.height / 2)
  await page.mouse.down()
  await page.mouse.move(Math.min(1370, b2.x + 700), b2.y + b2.height / 2, { steps: 8 })
  await page.mouse.up()
  const tb = (await title.boundingBox())!
  const zone2 = (await page.locator('.pe2-stage .sp-card-body').boundingBox())!
  check('dragging past the edge keeps the title inside the card', (await title.getAttribute('aria-valuenow')) === '100' && tb.x + tb.width <= zone2.x + zone2.width + 1)
  // keyboard on the description
  const desc = page.getByRole('slider', { name: 'Description position' })
  await desc.focus()
  await page.keyboard.press('c')
  check('keyboard: C centres the description', (await desc.getAttribute('aria-valuenow')) === '50')
  await page.keyboard.press('ArrowRight')
  check('keyboard: arrow keys nudge it', (await desc.getAttribute('aria-valuenow')) === '52')
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  check('positions are independent', (await title.getAttribute('aria-valuenow')) === '100' && (await desc.getAttribute('aria-valuenow')) === '4')
  check('text editing still works in the inputs', await page.getByPlaceholder('e.g. Content planner template').isEditable())
  if (SHOTS) await page.locator('.pe2-look').screenshot({ path: join(SHOTS, 'editor-card.png') })

  // autosave, then refresh
  await page.waitForTimeout(2500)
  await page.reload()
  const saved = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store.products.find((p: { id: string }) => p.id === pid).extras
  check('autosave persisted positions across a refresh', saved.textPos.title === 1 && saved.textPos.desc === 0.04, JSON.stringify(saved.textPos))
  check('other card settings survive the refresh', saved.layout === 'showcase' && saved.included.length === 2)

  // ---- Publish and the live store
  await page.request.patch(`${SITE}/api/seller/products/${pid}`, { data: { revision: (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store.products.find((p: { id: string }) => p.id === pid).revision, listed: true }, headers: H })
  await page.request.post(`${SITE}/api/seller/store/publish`, { headers: H })
  const shop = await ctx.newPage()
  shop.on('pageerror', (e) => errors.push(e.message))
  await shop.goto(`${SITE}/ava-makes`)
  const card = shop.locator('.sp-card').first()
  await card.waitFor()
  check('live card uses the chosen layout', (await card.getAttribute('class'))?.includes('sp-card-showcase') ?? false)
  const liveTitle = shop.locator('.sp-card h3.sp-move').first()
  check('live title sits where the seller put it (right)', (await liveTitle.evaluate((e) => getComputedStyle(e).getPropertyValue('--tx').trim())) === '1')
  const tB = (await liveTitle.boundingBox())!, cB = (await shop.locator('.sp-card-body').first().boundingBox())!
  check('live title is inside the card', tB.x >= cB.x - 1 && tB.x + tB.width <= cB.x + cB.width + 1)
  check('live card shows subtitle and facts', (await shop.getByText('Plan a month in one afternoon').count()) > 0 && (await shop.getByText(/Notion template · 2 items included · Instant access/).count()) > 0)

  // open the detail panel from the cover
  await shop.locator('.sp-card-media a').first().click()
  const dialog = shop.getByRole('dialog', { name: 'Content planner' })
  await dialog.waitFor()
  check('clicking the cover opens the product panel', true)
  check('the panel URL is a deep link', new URL(shop.url()).searchParams.get('p') === pid)
  check('focus moves into the panel', await shop.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]'))))
  check('panel shows what’s included and the FAQ', (await dialog.getByText('120 caption ideas').count()) > 0 && (await dialog.getByText('Do I need Notion?').count()) > 0)
  await shop.waitForTimeout(700)
  if (SHOTS) await shop.screenshot({ path: join(SHOTS, 'live-panel.png') })
  await shop.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  check('Escape closes the panel and clears the link', new URL(shop.url()).searchParams.get('p') === null)
  await shop.locator('.sp-card h3 a').first().click()
  await dialog.waitFor()
  await shop.goBack()
  await dialog.waitFor({ state: 'detached' })
  check('browser Back closes the panel', new URL(shop.url()).pathname === '/ava-makes')
  await shop.goto(`${SITE}/ava-makes?p=${pid}`)
  await dialog.waitFor()
  check('a shared ?p= link opens the product directly', true)
  check('the old product page still works', (await (await ctx.request.get(`${SITE}/ava-makes/p/${pid}`)).status()) === 200)

  // ---- Stage B: offer with a real deadline, codes, and the checkout breakdown
  await page.request.put(`${SITE}/api/seller/payments`, { data: { bank: { enabled: true, bankName: 'Monzo', accountName: 'Ava Makes', sortCode: '040004', accountNumber: '12345678' } }, headers: H })
  const cur = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store.products.find((p: { id: string }) => p.id === pid)
  const endLocal = new Date(Date.now() + 26 * 3600e3).toISOString().slice(0, 16)
  await page.request.patch(`${SITE}/api/seller/products/${pid}`, { data: { revision: cur.revision, extras: { ...cur.extras, offer: { ...cur.extras.offer, on: true, kind: 'percent', value: 25, tz: 'UTC', startsLocal: null, endsLocal: endLocal, countdown: true } } }, headers: H })
  await page.request.post(`${SITE}/api/seller/coupons`, { data: { code: 'SAVE10', kind: 'percent', value: 10 }, headers: H })
  await page.request.post(`${SITE}/api/seller/coupons`, { data: { code: 'GIFT', kind: 'percent', value: 100, perCustomer: 1 }, headers: H })
  await page.request.post(`${SITE}/api/seller/store/publish`, { headers: H })
  await shop.goto(`${SITE}/ava-makes`)
  const tag = shop.locator('.sp-card .sp-price-sale').first()
  await tag.waitFor()
  check('card: crossed-out price, sale price and savings', (await tag.locator('s').innerText()).includes('12') && (await tag.locator('b').innerText()) === '£9' && (await tag.getByText('Save £3').count()) === 1)
  check('card: a countdown for the real deadline', /Ends in 1d 1h|Ends in 1d 2h|Ends in 1d 0h/.test(await tag.locator('.sp-countdown').innerText()))
  await shop.locator('.sp-card .sp-btn').first().click()
  const co = shop.getByRole('dialog', { name: /Pay for Content planner/ })
  await co.waitFor()
  await co.getByText('Offer').waitFor()
  check('checkout: the offer line matches the card', (await co.locator('.co3-total b').innerText()) === '£9')
  await co.getByLabel('Discount code').fill('nope')
  await co.getByRole('button', { name: 'Apply' }).click()
  await co.getByRole('alert').filter({ hasText: /isn’t valid/ }).waitFor()
  check('checkout: a wrong code says why and keeps the price', (await co.locator('.co3-total b').innerText()) === '£9')
  await co.getByLabel('Discount code').fill('save10')
  await co.getByRole('button', { name: 'Apply' }).click()
  await co.getByText(/Code SAVE10 applied/).waitFor()
  check('checkout: offer then code (12.00 → 9.00 → 8.10)', (await co.locator('.co3-total b').innerText()).includes('8.10') && (await co.getByText('You save £3.90').count()) === 1)
  if (SHOTS) await co.screenshot({ path: join(SHOTS, 'checkout-code.png') })
  await co.getByRole('button', { name: 'Remove' }).click()
  await co.getByLabel('Discount code').fill('GIFT')
  await co.getByRole('button', { name: 'Apply' }).click()
  await co.getByText(/Code GIFT applied/).waitFor()
  check('checkout: a 100% code makes it free', (await co.locator('.co3-total b').innerText()) === '£0' && (await co.getByRole('button', { name: 'Send digital product' }).count()) === 1)
  check('checkout: free needs an email first', await co.getByRole('button', { name: 'Send digital product' }).isDisabled())
  await co.getByLabel('Email').fill('fan@buyer.test')
  await co.getByRole('button', { name: 'Send digital product' }).click()
  await shop.getByRole('heading', { name: 'Email sent' }).waitFor({ timeout: 10000 }).catch(async () => { console.log('    checkout text:', (await co.innerText()).replace(/\s+/g, ' ').slice(0, 600)) })
  const sentH = await shop.getByRole('heading', { name: 'Email sent' }).count(), dlB = await shop.locator('.co3-sent').getByRole('button', { name: 'Download', exact: true }).count()
  check('checkout: "Email sent" only after the provider accepted it, Download right there', sentH === 1 && dlB === 1, `heading ${sentH}, download ${dlB}`)
  const again = shop.locator('.co3-sent').getByRole('button', { name: 'Resend download email' })
  await again.click()
  await again.waitFor()
  await shop.waitForTimeout(400)
  await again.click()
  await shop.locator('.co3-sent').getByText(/wait a minute/).waitFor()
  check('checkout: resending again within a minute says to wait', true)
  const order = db.prepare(`SELECT "amountMinor", "listMinor", "discountMinor", "couponCode", status FROM seller_order WHERE "couponCode" = 'GIFT'`).get() as any
  check('the order stores 0 paid, 12.00 list, 12.00 off, code GIFT', order?.amountMinor === 0 && order?.listMinor === 1200 && order?.discountMinor === 1200 && order?.status === 'paid')

  // editor: schedule with a timezone and the code list
  await page.goto(`${SITE}/app/pro`)
  await page.waitForURL(/\/app\/project\//)
  await page.evaluate((k) => sessionStorage.setItem(k, '1'), `desknoty.seller.tiktok-step.${st.id}`)
  await page.getByRole('button', { name: 'Seller', exact: true }).click()
  await page.getByRole('tab', { name: /Products/ }).click()
  await page.getByText('Content planner').first().click()
  check('editor: offer has start/end times and a timezone', (await page.getByLabel('Timezone').count()) === 1 && (await page.getByLabel('Timezone').inputValue()) === 'UTC')
  check('editor: countdown option is on for a real end time', await page.getByLabel('Show a countdown to the end').isChecked())
  await page.getByText('SAVE10', { exact: true }).waitFor()
  check('editor: codes are listed with their usage', (await page.getByText(/GIFT/).count()) > 0 && (await page.getByText('1 used · 1 per customer').count()) === 1)
  await page.getByPlaceholder('e.g. LAUNCH20').fill('vip5')
  await page.getByLabel('Discount value').fill('5')
  await page.getByPlaceholder('Unlimited').first().fill('20')
  await page.getByRole('button', { name: 'Add code' }).click()
  await page.getByText('VIP5', { exact: true }).waitFor()
  check('editor: a new code is created from the panel', (await page.getByText('0 of 20 used').count()) === 1)
  if (SHOTS) await page.locator('.pe2-coupons').screenshot({ path: join(SHOTS, 'editor-coupons.png') })

  // ---- Mobile: full screen sheet with a purchase bar that doesn't cover content
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const m = await mob.newPage()
  m.on('pageerror', (e) => errors.push(e.message))
  await m.goto(`${SITE}/ava-makes?p=${pid}`)
  const sheet = m.locator('.sp-sheet')
  await sheet.waitFor()
  const sB = (await sheet.boundingBox())!
  check('mobile: the panel is full screen', Math.round(sB.width) === 390)
  const bar = m.locator('.sp-sheet-bar')
  const barB = (await bar.boundingBox())!, scrollB = (await m.locator('.sp-sheet-scroll').boundingBox())!
  check('mobile: sticky purchase bar sits below the content, not over it', (await bar.isVisible()) && scrollB.y + scrollB.height <= barB.y + 1)
  check('reduced motion: no slide animation', (await sheet.evaluate((e) => getComputedStyle(e).animationName)) === 'none')
  check('no horizontal scrolling on mobile', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
  if (SHOTS) await m.screenshot({ path: join(SHOTS, 'mobile-sheet.png') })
  await m.goto(`${SITE}/ava-makes`)
  if (SHOTS) await m.screenshot({ path: join(SHOTS, 'mobile-store.png'), fullPage: true })

  // ---- Old API (V2 fields dropped by the server): the controls must say they can't save
  const old = await ctx.newPage()
  await old.route('**/api/seller/store', async (route) => {
    const res = await route.fetch()
    const body = await res.json()
    for (const p of body.store?.products ?? []) if (p.extras) p.extras = { offer: p.extras.offer, cta: p.extras.cta, hidden: p.extras.hidden }
    await route.fulfill({ response: res, json: body })
  })
  await old.goto(`${SITE}/app/pro`)
  await old.waitForURL(/\/app\/project\//)
  await old.evaluate((k) => sessionStorage.setItem(k, '1'), `desknoty.seller.tiktok-step.${st.id}`)
  await old.getByRole('button', { name: 'Seller', exact: true }).click()
  await old.getByRole('tab', { name: /Products/ }).click()
  await old.getByText('Content planner').first().click()
  await old.getByRole('button', { name: /Card appearance/ }).click()
  check('old API: editor says the new settings are unavailable', (await old.getByText(/Not available yet/).count()) >= 2)
  check('old API: no movable card or layout picker is offered', (await old.getByRole('slider', { name: 'Title position' }).count()) === 0 && (await old.getByRole('radio', { name: /Showcase/ }).count()) === 0)
  check('old API: subtitle and included fields are disabled', await old.getByPlaceholder('e.g. Plan a month of posts in one afternoon').isDisabled())
  check('old API: title and price still edit normally', await old.getByPlaceholder('e.g. Content planner template').isEditable())

  // old API without quotes: checkout keeps the card price and offers no code box
  const noQctx = await browser.newContext({ viewport: { width: 1380, height: 900 } })
  const noQ = await noQctx.newPage()
  await noQ.route('**/api/store/*/quote', (r) => r.fulfill({ status: 404, json: { error: 'Not found.' } }))
  await noQ.goto(`${SITE}/ava-makes`)
  await noQ.locator('.sp-card .sp-btn').first().click()
  const co0 = noQ.getByRole('dialog', { name: /Pay for/ })
  await co0.waitFor()
  await noQ.waitForTimeout(500)
  check('old API: checkout hides the code box and shows no error', (await co0.getByLabel('Discount code').count()) === 0 && (await co0.getByRole('alert').count()) === 0)
  check('old API: checkout keeps the card price', (await co0.locator('.co3-total b').innerText()) === '£9')

  // ---- Stage C: reviews, saving, sharing, samples, bundles, related products
  const sc = await browser.newContext({ viewport: { width: 1380, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const buyer = await sc.newPage()
  buyer.on('pageerror', (e) => errors.push(e.message))
  const gift = db.prepare(`SELECT id, "storeId", "accessKey" FROM seller_order WHERE "couponCode" = 'GIFT'`).get() as any
  await buyer.goto(`${SITE}/store/${gift.storeId}/order/${gift.id}?k=${encodeURIComponent(gift.accessKey)}`)
  await buyer.getByRole('heading', { name: 'Rate this product' }).waitFor()
  await buyer.getByRole('radio', { name: '4 stars' }).click()
  await buyer.getByLabel('Your review').fill('Clear layout, saved me hours.')
  await buyer.getByLabel('Name to show').fill('Mia')
  await buyer.getByRole('button', { name: 'Post review' }).click()
  await buyer.getByText('Thanks. Your review is live.').waitFor()
  check('order page: the buyer posts a verified review', true)
  await buyer.reload()
  await buyer.getByRole('heading', { name: 'Your review' }).waitFor()
  check('order page: the review is there to edit after a refresh', (await buyer.getByRole('radio', { name: '4 stars' }).getAttribute('aria-checked')) === 'true' && (await buyer.getByLabel('Your review').inputValue()).includes('saved me hours'))
  // seller adds a sample, a second product, a bundle and related products
  await page.request.put(`${SITE}/api/seller/products/${pid}/sample`, { data: Buffer.from('SAMPLE PAGES'), headers: { ...H, 'content-type': 'application/pdf', 'x-file-name': 'sample.pdf' } })
  const p2 = (await (await page.request.post(`${SITE}/api/seller/products`, { data: { title: 'Caption pack', description: '200 captions.', priceMinor: 500, currency: 'gbp' }, headers: H })).json()).product.id
  await page.request.put(`${SITE}/api/seller/products/${p2}/file`, { data: Buffer.from('CAPTIONS'), headers: { ...H, 'content-type': 'application/pdf', 'x-file-name': 'captions.pdf' } })
  const bun = (await (await page.request.post(`${SITE}/api/seller/products`, { data: { title: 'Creator bundle', priceMinor: 1400, currency: 'gbp' }, headers: H })).json()).product.id
  const prods = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store.products
  const bx = prods.find((x: any) => x.id === bun)
  await page.request.patch(`${SITE}/api/seller/products/${bun}`, { data: { revision: bx.revision, extras: { ...bx.extras, bundle: [pid, p2], layout: 'showcase' } }, headers: H })
  const px = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store.products.find((x: any) => x.id === pid)
  await page.request.patch(`${SITE}/api/seller/products/${pid}`, { data: { revision: px.revision, extras: { ...px.extras, related: [p2, bun] } }, headers: H })
  const st2 = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store
  const grid2 = st2.draft.blocks.map((b: any) => (b.type === 'grid' ? { ...b, data: { ...b.data, productIds: [pid, p2, bun] } } : b))
  await page.request.put(`${SITE}/api/seller/store/draft`, { data: { page: { ...st2.draft, blocks: grid2 }, revision: st2.revision }, headers: H })
  await page.request.post(`${SITE}/api/seller/store/publish`, { headers: H })

  await buyer.goto(`${SITE}/ava-makes`)
  const planner = buyer.locator('.sp-card', { hasText: 'Content planner' }).first()
  await planner.waitFor()
  check('card: real stars and count from reviews', (await planner.getByRole('img', { name: /Rated 4\.0 out of 5 from 1 review/ }).count()) === 1)
  check('card: a product with no reviews shows no stars', (await buyer.locator('.sp-card', { hasText: 'Caption pack' }).locator('.sp-stars').count()) === 0)
  const bundleCard = buyer.locator('.sp-card', { hasText: 'Creator bundle' })
  check('card: bundle badge with its item count', (await bundleCard.getByText('Bundle · 2').count()) === 1)
  // save as a guest: kept in this browser
  const heart = planner.getByRole('button', { name: /Save Content planner/ })
  await heart.click()
  check('save: the heart shows it’s selected', (await planner.getByRole('button', { name: /Remove Content planner from saved/ }).getAttribute('aria-pressed')) === 'true')
  await buyer.reload()
  await buyer.locator('.sp-card', { hasText: 'Content planner' }).first().waitFor()
  check('save: a guest’s saved product survives a reload (this browser)', (await buyer.locator('.sp-card', { hasText: 'Content planner' }).first().getByRole('button', { name: /Remove Content planner from saved/ }).count()) === 1)
  // panel: reviews, sample, share, related
  await buyer.locator('.sp-card', { hasText: 'Content planner' }).first().locator('.sp-card-media a').click()
  const panel = buyer.getByRole('dialog', { name: 'Content planner' })
  await panel.waitFor()
  await panel.getByText('Clear layout, saved me hours.').waitFor()
  check('panel: the review with its verified label and name', (await panel.getByText('Verified buyer').count()) >= 1 && (await panel.getByText('Mia', { exact: true }).count()) === 1)
  check('panel: rating breakdown from real reviews', (await panel.getByLabel('Rating breakdown').innerText()).replace(/\s+/g, ' ').includes('4★ 1'))
  check('panel: guests are told saved items stay in this browser', (await panel.getByText(/Saved in this browser only/).count()) === 1)
  const sampleLink = panel.getByRole('link', { name: /Free sample/ })
  check('panel: free sample points at the sample, not the paid file', (await sampleLink.getAttribute('href'))?.includes(`/api/store-sample/${pid}`) ?? false)
  await panel.getByRole('button', { name: 'Share' }).click()
  await panel.getByRole('button', { name: 'Link copied' }).waitFor()
  check('panel: share copies the product’s own link', (await buyer.evaluate(() => navigator.clipboard.readText())).endsWith(`/ava-makes?p=${pid}`))
  check('panel: related products are listed', (await panel.getByRole('heading', { name: 'You might also like' }).count()) === 1 && (await panel.locator('.sp-rel', { hasText: 'Caption pack' }).count()) === 1)
  await panel.locator('.sp-rel', { hasText: 'Creator bundle' }).click()
  const bpanel = buyer.getByRole('dialog', { name: 'Creator bundle' })
  await bpanel.waitFor()
  check('panel: a related product opens in the panel', true)
  check('bundle panel: lists every included product', (await bpanel.getByRole('heading', { name: 'In this bundle' }).count()) === 1 && (await bpanel.locator('.sp-incl li').allInnerTexts()).sort().join('|') === ['Caption pack', 'Content planner'].join('|'))
  check('bundle panel: no reviews yet is said honestly', (await bpanel.getByText(/No reviews yet/).count()) === 1)
  if (SHOTS) await buyer.screenshot({ path: join(SHOTS, 'stage-c-panel.png') })
  await buyer.keyboard.press('Escape')

  // editor: sample, bundle picker, reviews section
  await page.goto(`${SITE}/app/pro`)
  await page.waitForURL(/\/app\/project\//)
  await page.evaluate((k) => sessionStorage.setItem(k, '1'), `desknoty.seller.tiktok-step.${st.id}`)
  await page.getByRole('button', { name: 'Seller', exact: true }).click()
  await page.getByRole('tab', { name: /Products/ }).click()
  await page.getByText('Content planner').first().click()
  check('editor: the sample is shown with its file name', (await page.getByText(/sample\.pdf/).count()) >= 1)
  check('editor: bundle and related pickers', (await page.getByRole('group', { name: 'Bundle contents' }).count()) === 1 && (await page.getByRole('group', { name: 'Related products' }).count()) === 1)
  await page.getByRole('button', { name: /Reviews/ }).click()
  await page.getByText(/4\.0 out of 5/).waitFor()
  check('editor: reviews are visible to the seller but read only', (await page.getByText(/You can’t edit or hide reviews/).count()) === 1)
  if (SHOTS) await page.locator('.pe').screenshot({ path: join(SHOTS, 'stage-c-editor.png') })

  check('no page errors', errors.length === 0, errors.join(' | '))
  db.close()
} finally {
  await browser.close()
  // stop vite too, not just the npx wrapper
  try { process.kill(-web.pid!, 'SIGTERM') } catch { web.kill('SIGTERM') }
  await new Promise<void>((r) => (api.once('exit', () => r()), api.kill('SIGTERM')))
  if (!SHOTS) rmSync(tmp, { recursive: true, force: true })
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll store V2 browser checks passed.')
process.exit(failures ? 1 : 0)
