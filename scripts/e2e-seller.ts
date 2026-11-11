/**
 * Seller Studio in a real browser, end to end, against the real API server,
 * the built frontend (vite preview) and a local Stripe stand-in:
 *
 *   seller signs in → Start your store → Connect TikTok (required) → adds a
 *   product with a private file → inserts a Featured product block between
 *   the header and the product grid → publishes → Stripe onboarding left
 *   incomplete, then resumed and finished → copies the bio link →
 *   a private mobile browser (iPhone, no account) opens the link, refreshes
 *   the product page directly, cancels checkout, buys with the test card,
 *   downloads the file → a duplicate webhook changes nothing → a second
 *   seller's store is separate → an unpaid visitor can't download.
 *
 * Run with: npm run build && npm run test:e2e:seller
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { sendWebhook, startFakeStripe } from './fake-stripe.ts'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright') as typeof import('playwright')

const tmp = mkdtempSync(join(tmpdir(), 'desknoty-e2e-seller-'))
const API_PORT = 4100 + Math.floor(Math.random() * 50)
const WEB_PORT = 4200 + Math.floor(Math.random() * 50)
const SITE = `http://localhost:${WEB_PORT}`
const WHSEC = 'whsec_e2e'
const HOOK = `http://127.0.0.1:${API_PORT}/api/stripe/webhook`
const SHOTS = process.env.SHOTS_DIR ?? join(tmp, 'shots')
const DB = join(tmp, 'e2e.db')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const fake = await startFakeStripe({ webhookUrl: HOOK, webhookSecret: WHSEC })
const sent = fake.sent

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

const api = await run(
  [process.execPath, '--import', 'tsx', 'server/index.ts'],
  {
    NODE_ENV: 'development',
    BETTER_AUTH_URL: SITE,
    BETTER_AUTH_SECRET: 'f'.repeat(64),
    DATABASE_PATH: DB,
    MAILBOX_DIR: join(tmp, 'mailbox'),
    SELLER_FILES_DIR: join(tmp, 'files'),
    SELLER_MEDIA_DIR: join(tmp, 'media'),
    API_PORT: String(API_PORT),
    SMTP_HOST: '',
    SMTP_PRESET: '',
    REQUIRE_EMAIL_VERIFICATION: 'false',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: WHSEC,
    STRIPE_API_BASE: fake.url,
    TIKTOK_CLIENT_KEY: '',
    TIKTOK_CLIENT_SECRET: '',
  },
  'listening',
)
const web = await run(['npx', 'vite', 'preview', '--port', String(WEB_PORT), '--strictPort'], { API_PORT: String(API_PORT) }, 'Local')

const browser = await chromium.launch()
try {
  /* ---------------------------------------------------- the seller --- */
  const seller = await browser.newContext({ viewport: { width: 1380, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await seller.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(`${SITE}/app/signin`)
  const signup = await page.request.post(`${SITE}/api/auth/sign-up/email`, { data: { name: 'Ava', email: 'ava@e2e.test', password: 'a-long-enough-password' }, headers: { origin: SITE } })
  check('seller account created', signup.ok())
  const db = new Database(DB)
  db.prepare("UPDATE \"user\" SET plan = 'pro', emailVerified = 1 WHERE email = 'ava@e2e.test'").run()
  const proj = await page.request.post(`${SITE}/api/projects`, { data: { workspace: 'pro', name: 'Studio', color: 'lime' }, headers: { origin: SITE } })
  check('Pro project created', proj.ok(), String(proj.status()))

  await page.goto(`${SITE}/app/pro`)
  await page.waitForURL(/\/app\/project\//)
  await page.getByRole('button', { name: 'Seller', exact: true }).click()

  // 1. Start your store: TikTok is required, there is no way to skip it
  await page.getByRole('heading', { name: 'Start your store' }).waitFor()
  check('no “Continue without TikTok” on the start card', (await page.getByText('Continue without TikTok').count()) === 0)
  await page.getByRole('button', { name: 'Connect TikTok' }).click()
  await page.getByLabel('Store name').fill('Ava Makes')
  await page.getByLabel('Store handle').fill('ava-makes')
  await page.getByText('● Available').waitFor()
  await page.getByRole('button', { name: /Continue to TikTok/ }).click()
  await page.getByRole('heading', { name: 'Connect your TikTok' }).waitFor()
  check('TikTok step is required: no skip button', (await page.getByRole('button', { name: /without TikTok|Skip/ }).count()) === 0)
  // the bio-code check needs real TikTok, so the test marks the step done the way the 502 fallback does
  const sid = (await (await page.request.get(`${SITE}/api/seller/store`)).json()).store.id
  await page.evaluate((k) => sessionStorage.setItem(k, '1'), `desknoty.seller.tiktok-step.${sid}`)
  await page.reload()
  await page.getByRole('button', { name: 'Seller', exact: true }).click().catch(() => {})
  await page.getByRole('tab', { name: 'Page' }).waitFor()
  check('studio opens on the Page tab', true)

  // 2. Product with a private file and a cover
  await page.getByRole('tab', { name: /Products/ }).click()
  await page.getByRole('button', { name: 'Add your first digital product' }).click()
  await page.getByPlaceholder('e.g. Content planner template').fill('Content planner')
  await page.getByPlaceholder('What buyers get, in a few lines').fill('A Notion template for planning a month of videos.')
  const price = page.locator('.ss-affix-l input')
  await price.fill('12.00')
  const file = join(tmp, 'planner.pdf')
  writeFileSync(file, 'E2E-PLANNER-FILE')
  await page.locator('input[type=file]:not([accept])').setInputFiles(file)
  await page.getByText(/planner\.pdf · /).waitFor()
  const png = join(tmp, 'cover.png')
  writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'))
  await page.locator('input[type=file][accept^="image"]').setInputFiles(png)
  await page.waitForTimeout(1200)
  await page.getByText('Ready · publish to put it on sale').waitFor()
  check('product is complete and ready to publish', true)

  // 3. Featured product between the header and the grid; pick it in the grid too
  await page.getByRole('tab', { name: 'Page' }).click()
  await page.getByRole('button', { name: 'Add a block between Profile header and Product grid' }).click()
  await page.getByRole('menuitem', { name: /Featured product/ }).click()
  await page.locator('.sb-edit select').first().selectOption({ label: 'Content planner' })
  await page.getByRole('button', { name: /^Product grid \d+ product/ }).click()
  await page.getByRole('checkbox', { name: /Content planner/ }).check()
  // Move-up / move-down controls (keyboard & touch): grid up then back down (header and footer are pinned)
  await page.getByRole('button', { name: 'Move Product grid up' }).click()
  await page.getByRole('button', { name: 'Move Product grid down' }).click()
  await page.waitForTimeout(1200)
  const order = await page.locator('.ss-slide .sp > *').evaluateAll((els) => els.map((e) => (e.classList.contains('sp-pick') ? e.querySelector(':scope > :not(.sp-grip)')! : e).className.split(' ').filter((c) => c.startsWith('sp-')).pop()))
  check('preview order: header, featured, grid, footer', JSON.stringify(order.slice(0, 4)) === JSON.stringify(['sp-head', 'sp-featured', 'sp-grid-wrap', 'sp-end']), order.join(','))
  await page.screenshot({ path: join(SHOTS, 'studio-page.png') })

  // 4. Publish
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.getByText('● Live').waitFor()
  check('published', true)

  // 5. Payouts: leave onboarding incomplete, then resume and finish
  await page.getByRole('tab', { name: 'Payouts' }).click()
  check('payouts start Not connected', await page.getByText('Not connected', { exact: true }).isVisible())
  check('the 0% platform fee and provider fees are explained once', (await page.getByText(/Desknoty platform fee: 0%\. Payment providers may charge their own fees\./).count()) === 1)
  await page.getByRole('button', { name: /Connect Stripe/ }).click()
  await page.waitForURL(/\/onboard\//)
  await page.getByRole('button', { name: 'Leave (incomplete)' }).click()
  await page.waitForURL(/tool=seller/)
  await page.getByRole('tab', { name: 'Payouts' }).click()
  await page.getByText('Setup incomplete', { exact: true }).waitFor()
  check('back from Stripe with onboarding unfinished: Setup incomplete', true)
  await page.getByRole('button', { name: /Resume setup/ }).click()
  await page.waitForURL(/\/onboard\//)
  await page.getByRole('button', { name: 'Finish (ready)' }).click()
  await page.waitForURL(/tool=seller/)
  await page.getByRole('tab', { name: 'Payouts' }).click()
  await page.getByText('Ready for payouts', { exact: true }).waitFor()
  check('resumed onboarding: Ready for payouts', true)

  // 6. Bio link
  await page.getByRole('tab', { name: 'Bio link' }).click()
  await page.getByRole('button', { name: 'Copy link' }).click()
  const bio = await page.evaluate(() => navigator.clipboard.readText())
  check('Copy link copies the short public URL', bio === `${SITE}/ava-makes`, bio)
  check('where-to-paste instructions are shown', await page.getByText('Add it to your profiles').isVisible())
  check('no console errors in the studio', errors.length === 0, errors.join(' | '))

  /* -------------------------------- a buyer on a phone, no account --- */
  const phone = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true })
  const m = await phone.newPage()
  const mErrors: string[] = []
  m.on('pageerror', (e) => mErrors.push(e.message))
  await m.goto(bio)
  await m.getByRole('heading', { name: 'Ava Makes' }).waitFor()
  const live = await m.locator('.ps .sp > *').evaluateAll((els) => els.map((e) => e.className))
  check('live page: featured product sits between header and grid', live[0].includes('sp-head') && live[1].includes('sp-featured') && live[2].includes('sp-grid-wrap'), live.join(','))
  await m.screenshot({ path: join(SHOTS, 'mobile-store.png') })

  await m.locator('.sp-card-link').first().click()
  await m.waitForURL(/\/ava-makes\/p\/prd_/)
  const productUrl = m.url()
  await m.reload()
  await m.getByRole('heading', { name: 'Content planner' }).waitFor()
  check('a direct refresh of the product URL works', true)
  check('the product shows its published price', (await m.locator('.sp-price').first().textContent()) === '£12')

  await m.getByRole('button', { name: 'Buy now' }).click()
  await m.waitForURL(/\/pay\/cs_/)
  check('Buy now opens hosted checkout (no account needed)', true)
  await m.getByRole('button', { name: 'Back' }).click()
  await m.waitForURL(/checkout=cancelled/)
  const notice = await m.getByText('Checkout cancelled. You weren’t charged.').waitFor({ timeout: 8000 }).then(() => true, () => false)
  check('cancelled checkout returns to the product with a notice', notice)

  await m.getByRole('button', { name: 'Buy now' }).click()
  await m.waitForURL(/\/pay\/cs_/)
  await m.getByRole('button', { name: 'Pay' }).click()
  await m.waitForURL(/\/thanks\?session_id=/)
  await m.getByText('Payment confirmed').waitFor()
  check('after paying, the confirmation shows the download', await m.getByRole('link', { name: /Download planner\.pdf/ }).isVisible())
  await m.screenshot({ path: join(SHOTS, 'mobile-thanks.png') })
  const dlHref = (await m.getByRole('link', { name: /Download planner\.pdf/ }).getAttribute('href'))!
  const dl = await m.request.get(dlHref)
  check('the download is the seller’s file', dl.status() === 200 && (await dl.text()) === 'E2E-PLANNER-FILE')

  // Duplicate webhook delivery
  const again = await sendWebhook(HOOK, sent.at(-1)!)
  check('a duplicate webhook is acknowledged', again.status === 200)
  const nOrders = db.prepare("SELECT COUNT(*) AS n FROM seller_order WHERE status = 'paid'").get() as { n: number }
  const nMail = db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE kind = 'order-receipt'").get() as { n: number }
  check('one paid order and one receipt email', nOrders.n === 1 && nMail.n === 1, `${nOrders.n}/${nMail.n}`)
  // Buying again after cancelling reuses the same attempt (same requestId, still-open
  // Stripe session), so there is one order in total and no stray unpaid one.
  const all = db.prepare("SELECT COUNT(*) AS n, SUM(status = 'pending') AS p FROM seller_order").get() as { n: number; p: number }
  check('cancel then buy again makes one order, not a duplicate', all.n === 1 && !all.p, `${all.n} orders, ${all.p} pending`)

  // The receipt email link
  // The mail worker sends every few seconds; wait for the receipt to land in the dev inbox.
  const { existsSync, readdirSync } = await import('node:fs')
  let mail = ''
  for (let i = 0; i < 40 && !mail; i++) {
    const dir = join(tmp, 'mailbox')
    const files = existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.json')) : []
    mail = files.map((f) => readFileSync(join(dir, f), 'utf8')).find((t) => t.includes('/order/ord_')) ?? ''
    if (!mail) await new Promise((r) => setTimeout(r, 500))
  }
  const retrieval = mail.match(/https?:\/\/[^"\s<]+\/store\/[\w-]+\/order\/ord_[a-f0-9]+\?k=[\w-]+/)?.[0]
  check('the receipt email contains a retrieval link', Boolean(retrieval))
  if (retrieval) {
    await m.goto(retrieval.replace(/&amp;/g, '&'))
    await m.getByText('Payment confirmed').waitFor()
    check('the retrieval link opens the order with a fresh download', await m.getByRole('link', { name: /Download planner\.pdf/ }).isVisible())
  }

  // An unpaid visitor
  const stranger = await browser.newContext()
  const s = await stranger.newPage()
  const forged = await s.request.get(dlHref.replace(/\.[^.]+$/, '.forged'))
  check('an unpaid visitor can’t download (forged link refused)', forged.status() === 403)
  await s.goto(productUrl)
  await s.getByRole('heading', { name: 'Content planner' }).waitFor()
  check('a stranger sees the product page but no download', (await s.getByRole('link', { name: /Download/ }).count()) === 0)

  /* ------------------------------------------------- second seller --- */
  const ben = await browser.newContext()
  const bp = await ben.newPage()
  await bp.goto(`${SITE}/app/signin`)
  await bp.request.post(`${SITE}/api/auth/sign-up/email`, { data: { name: 'Ben', email: 'ben@e2e.test', password: 'a-long-enough-password' }, headers: { origin: SITE } })
  // Seller Studio needs Pro + a verified email (test setup, like Ava above).
  {
    const dbBen = new Database(DB)
    dbBen.prepare("UPDATE \"user\" SET plan = 'pro', emailVerified = 1 WHERE email = 'ben@e2e.test'").run()
    dbBen.close()
  }
  await bp.request.post(`${SITE}/api/seller/store`, { data: { name: 'Ben Builds', handle: 'ben-builds' }, headers: { origin: SITE } })
  await bp.request.post(`${SITE}/api/seller/store/publish`, { headers: { origin: SITE } })
  await bp.goto(`${SITE}/store/ben-builds`)
  await bp.getByRole('heading', { name: 'Ben Builds' }).waitFor()
  check('second seller has a separate store without Ava’s products', (await bp.getByText('Content planner').count()) === 0)
  const benOrders = await bp.request.get(`${SITE}/api/seller/orders`)
  check('second seller sees none of Ava’s orders', (await benOrders.json()).orders.length === 0)
  check('no console errors on the public store', mErrors.length === 0, mErrors.join(' | '))
  db.close()
} finally {
  await browser.close()
  web.kill('SIGTERM')
  await new Promise<void>((r) => (api.once('exit', () => r()), api.kill('SIGTERM')))
  await fake.close()
  if (!process.env.SHOTS_DIR) rmSync(tmp, { recursive: true, force: true })
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll seller browser checks passed.')
process.exit(failures ? 1 : 0)
