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
import { join } from 'node:path'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright') as typeof import('playwright')

const tmp = mkdtempSync(join(tmpdir(), 'desknoty-e2e-v2-'))
const API_PORT = 4300 + Math.floor(Math.random() * 50)
const WEB_PORT = 4400 + Math.floor(Math.random() * 50)
const SITE = `http://localhost:${WEB_PORT}`
const DB = join(tmp, 'e2e.db')
const SHOTS = process.env.SHOTS_DIR

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  PASS  ${label}`)
  else { failures += 1; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

function run(cmd: string[], env: Record<string, string>, ready: string): Promise<ChildProcess> {
  const child = spawn(cmd[0], cmd.slice(1), { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
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

  check('no page errors', errors.length === 0, errors.join(' | '))
  db.close()
} finally {
  await browser.close()
  web.kill('SIGTERM')
  await new Promise<void>((r) => (api.once('exit', () => r()), api.kill('SIGTERM')))
  if (!SHOTS) rmSync(tmp, { recursive: true, force: true })
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll store V2 browser checks passed.')
process.exit(failures ? 1 : 0)
