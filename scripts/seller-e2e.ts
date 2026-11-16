/**
 * Seller Studio in a real browser: edits typed immediately before switching
 * tabs, switching products or pressing Publish must never be lost.
 *
 * Starts the API (SQLite in a temp folder, local Stripe stand-in), serves the
 * built app (dist/) on the same origin, and drives it with Playwright.
 * Run with: npm run build && npm run test:e2e:studio
 * Browsers: chromium by default; E2E_BROWSERS=chromium,firefox,webkit for more
 * (each must be installed for Playwright).
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { createRequire } from 'node:module'
import { startFakeStripe } from './fake-stripe.ts'

const dist = resolve('dist')
if (!existsSync(join(dist, 'index.html'))) throw new Error('Build first: npm run build')
const tmp = mkdtempSync(join(tmpdir(), 'desknoty-e2e-'))
const PORT = 4200 + Math.floor(Math.random() * 90)
const BASE = `http://localhost:${PORT}`
let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const fake = await startFakeStripe({ webhookUrl: `${BASE}/api/stripe/webhook`, webhookSecret: 'whsec_e2e' })
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    BETTER_AUTH_URL: BASE,
    BETTER_AUTH_SECRET: 'f'.repeat(64),
    DATABASE_PATH: join(tmp, 'e2e.db'),
    DATABASE_URL: '',
    MAILBOX_DIR: join(tmp, 'mailbox'),
    SELLER_FILES_DIR: join(tmp, 'files'),
    SELLER_MEDIA_DIR: join(tmp, 'media'),
    API_PORT: String(PORT),
    SMTP_HOST: '',
    SMTP_PRESET: '',
    REQUIRE_EMAIL_VERIFICATION: 'false',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_e2e',
    STRIPE_API_BASE: fake.url,
    VITE_API_BASE_URL: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout!.on('data', (d) => (log += d))
server.stderr!.on('data', (d) => (log += d))
await new Promise<void>((ok, bad) => {
  const t = setInterval(() => log.includes('listening') && (clearInterval(t), ok()), 100)
  server.once('exit', (c) => (clearInterval(t), bad(new Error(`server exited ${c}\n${log}`))))
})

const api = async (method: string, path: string, body?: unknown, cookie = '') => {
  const r = await fetch(BASE + path, {
    method,
    headers: { origin: BASE, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const cookies = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  return { status: r.status, json: (await r.json().catch(() => null)) as any, cookies }
}

// Playwright is not a project dependency: use the copy installed on the machine.
type Browser = { newContext(o: unknown): Promise<any>; close(): Promise<void> }
const { chromium, firefox, webkit } = createRequire(import.meta.url)('playwright') as Record<'chromium' | 'firefox' | 'webkit', { launch(o?: unknown): Promise<Browser> }>
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
const launchers = { chromium, firefox, webkit }
const wanted = (process.env.E2E_BROWSERS ?? 'chromium').split(',').map((b) => b.trim()) as Array<keyof typeof launchers>

try {
  for (const name of wanted) {
    for (const viewport of [{ width: 1440, height: 900, label: 'desktop' }, { width: 390, height: 844, label: 'mobile' }]) {
      const tag = `${name}/${viewport.label}`
      let browser: Browser
      try {
        browser = await launchers[name].launch(name === 'chromium' && existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
      } catch (e) {
        console.log(`  SKIP  ${tag}: browser not installed (${(e as Error).message.split('\n')[0]})`)
        continue
      }
      // A fresh verified Pro seller with a store, a product and a Pro project.
      const email = `e2e-${name}-${viewport.label}-${Date.now()}@seller.test`
      const handle = `e2e-${name.slice(0, 3)}-${viewport.label.slice(0, 3)}-${Date.now().toString(36)}`
      const su = await api('POST', '/api/auth/sign-up/email', { name: 'E2E Seller', email, password: 'an-e2e-password-123' })
      const db = new Database(join(tmp, 'e2e.db'))
      db.prepare(`UPDATE "user" SET plan = 'pro', "emailVerified" = 1 WHERE email = ?`).run(email)
      db.close()
      const C = su.cookies
      const store = (await api('POST', '/api/seller/store', { name: 'E2E Shop', handle }, C)).json.store
      const prod = (await api('POST', '/api/seller/products', { title: 'First', priceMinor: 500, currency: 'gbp' }, C)).json.product
      const project = (await api('POST', '/api/projects', { name: 'Studio', workspace: 'pro' }, C)).json.project

      const ctx = await browser.newContext({ viewport })
      await ctx.addCookies(C.split('; ').filter(Boolean).map((c) => ({ name: c.split('=')[0], value: c.slice(c.indexOf('=') + 1), url: BASE })))
      await ctx.route(`${BASE}/**`, (route) => {
        const path = new URL(route.request().url()).pathname
        if (path.startsWith('/api/')) return route.continue()
        let f = join(dist, path)
        if (!existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html')
        return route.fulfill({ body: readFileSync(f), contentType: types[extname(f)] ?? 'application/octet-stream' })
      })
      const page = await ctx.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript((k) => sessionStorage.setItem(k, '1'), `desknoty.seller.tiktok-step.${store.id}`)
      await page.goto(`${BASE}/app/project/${project.id}?tool=seller`)
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /First/ }).first().click()
      const title = page.locator('input[placeholder="e.g. Content planner template"]')

      // 1. Type, then switch tab at once (well inside the 600 ms autosave delay).
      await title.fill('Typed then tab switch')
      await page.getByText(/^Page$/).first().click()
      await page.waitForTimeout(1500)
      const afterTab = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === prod.id)
      check(`${tag}: edit typed right before switching tabs is saved`, afterTab?.title === 'Typed then tab switch', afterTab?.title)

      // 2. Several quick edits: the last one wins, never an older one.
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /Typed then tab switch/ }).first().click()
      for (const t of ['v1', 'v2', 'v3', 'Final quick edit']) await title.fill(t)
      await page.waitForTimeout(2000)
      const quick = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === prod.id)
      check(`${tag}: rapid edits end on the newest value`, quick?.title === 'Final quick edit', quick?.title)

      // 3. Type, then Publish at once: the published product has the new title.
      const up = await fetch(`${BASE}/api/seller/products/${prod.id}/file`, { method: 'PUT', headers: { origin: BASE, cookie: C, 'content-type': 'application/zip', 'x-file-name': 'p.zip' }, body: 'E2E' })
      check(`${tag}: product file upload`, up.status === 200)
      await title.fill('Typed then publish')
      await page.getByRole('button', { name: /Publish/ }).first().click()
      await page.waitForTimeout(2500)
      const live = (await api('GET', `/api/store/${handle}`)).json
      check(`${tag}: edit typed right before Publish goes live`, live?.products?.[0]?.title === 'Typed then publish', JSON.stringify(live?.products?.map((p: { title: string }) => p.title)))

      // 3b. Clicking the product in the phone preview opens that product's editing page.
      const cur = (await api('GET', '/api/seller/store', undefined, C)).json.store
      const feat = { id: 'blk_e2e_featured', type: 'featured', hidden: false, data: { productId: prod.id, note: '', slides: [{ kind: 'digital', productId: prod.id }] } }
      const blocks = cur.draft.blocks.filter((b: { id: string }) => b.id !== feat.id)
      const foot = blocks.findIndex((b: { type: string }) => b.type === 'footer')
      blocks.splice(foot < 0 ? blocks.length : foot, 0, feat)
      await api('PUT', '/api/seller/store/draft', { page: { ...cur.draft, blocks }, revision: cur.revision }, C)
      await page.reload()
      await page.getByText(/^Page$/).first().waitFor({ timeout: 20000 })
      await page.waitForTimeout(1500)
      const card = page.locator('.ss-slide [data-product-id]').first()
      const cardCount = await card.count()
      // the preview card animates in, so click it without waiting for it to settle
      if (cardCount) await card.click({ force: true })
      await page.waitForTimeout(1500)
      const productsTab = await page.getByRole('tab', { name: /^Products/ }).getAttribute('aria-selected')
      const editorOpen = (await page.locator('.pg-panel').count()) > 0
      const partPanel = (await page.locator('.pe-part').count()) > 0
      check(`${tag}: clicking the product in the preview opens its editing page`, cardCount > 0 && productsTab === 'true' && editorOpen, `card=${cardCount} tab=${productsTab} editor=${editorOpen}`)
      check(`${tag}: clicking the product does not open the card-part panel`, !partPanel)

      // 4. A refresh in the middle of an edit: the edit survives and saving keeps working.
      //    (The draft is still being written when the page goes away: the editor must
      //     recover it and must not be told the product "changed elsewhere" afterwards.)
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /Typed then publish/ }).first().click()
      await title.fill('Typed then refresh')
      await page.reload()
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /Typed then refresh|Typed then publish/ }).first().click()
      await page.waitForTimeout(1500)
      const recovered = await title.inputValue()
      check(`${tag}: an edit interrupted by a refresh is kept`, recovered === 'Typed then refresh', recovered)
      // the store is in the state the editor expects: saving again works
      await title.fill('Typed after refresh')
      await page.waitForTimeout(2000)
      const afterRefresh = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === prod.id)
      check(`${tag}: saving after a refresh is not refused as "changed elsewhere"`, afterRefresh?.title === 'Typed after refresh', afterRefresh?.title)
      check(`${tag}: no "changed elsewhere" notice after a refresh`, (await page.getByText(/changed elsewhere/i).count()) === 0)

      // 4b. The save reaches the server but its reply is lost (a dropped connection):
      //      the editor still holds the old revision, and must not be told the
      //      product "changed elsewhere" when it saves again.
      let dropped = false
      await page.route('**/api/seller/products/**', async (route) => {
        if (!dropped && route.request().method() === 'PATCH') {
          dropped = true
          const sent = await route.fetch()
          await sent.body()
          await route.abort('failed')
          return
        }
        await route.continue()
      })
      await title.fill('Reply lost')
      await page.waitForTimeout(2000)
      await page.reload()
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /Reply lost|Typed after refresh/ }).first().click()
      await page.waitForTimeout(1500)
      check(`${tag}: the edit whose reply was lost is kept`, (await title.inputValue()) === 'Reply lost', await title.inputValue())
      await title.fill('Saved after a lost reply')
      await page.waitForTimeout(2500)
      const afterLost = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === prod.id)
      check(`${tag}: saving after a lost reply is not refused as "changed elsewhere"`, afterLost?.title === 'Saved after a lost reply', afterLost?.title)
      check(`${tag}: no "changed elsewhere" notice after a lost reply`, (await page.getByText(/changed elsewhere/i).count()) === 0)
      await page.unroute('**/api/seller/products/**')

      // 5. Undo must never swap the store's style.
      await page.getByRole('tab', { name: 'Page' }).click()
      await page.getByRole('button', { name: 'Add block' }).click()
      const addDialog = page.getByRole('dialog', { name: 'Add a block' })
      await addDialog.locator('.ab-q', { hasText: 'Text' }).click()
      await page.waitForTimeout(500)
      const textEditor = page.getByRole('dialog', { name: 'Edit Text' })
      if (await textEditor.count()) {
        await textEditor.getByLabel('Heading').fill('A text block')
        await textEditor.getByRole('button', { name: 'Close' }).click()
      }
      await page.waitForTimeout(1200)
      await page.getByRole('tab', { name: 'Style 2' }).click()
      await page.getByRole('button', { name: /Publish/ }).first().click()
      await page.waitForTimeout(2500)
      const styled = (await api('GET', '/api/seller/store', undefined, C)).json.store
      check(`${tag}: publishing Style 2 makes Style 2 the store's style`, styled.draft.use === 2, JSON.stringify(styled.draft.use))
      await page.getByRole('button', { name: 'Undo' }).click()
      await page.waitForTimeout(2000)
      const undone = (await api('GET', '/api/seller/store', undefined, C)).json.store
      check(`${tag}: undo does not switch the store's style back`, undone.draft.use === 2, JSON.stringify(undone.draft.use))

      // 6. Archive a product, bring it back, and keep editing it: the editor and
      //    the server must stay on the same revision.
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /Saved after a lost reply|Typed after refresh/ }).first().click()
      await page.getByRole('button', { name: 'Archive', exact: true }).click()
      await page.waitForTimeout(1500)
      const archived = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === prod.id)
      check(`${tag}: the product is archived`, archived?.archived === true, JSON.stringify(archived?.archived))
      if (archived?.archived) {
        await page.getByText(/^Archived \(1\)/).click()
        await page.getByRole('button', { name: /Saved after a lost reply|Typed after refresh/ }).first().click()
        await page.getByRole('button', { name: 'Unarchive', exact: true }).click()
        await page.waitForTimeout(1500)
        await title.fill('Edited after unarchive')
        await page.waitForTimeout(2500)
        const afterUnarchive = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === prod.id)
        check(`${tag}: editing after Unarchive is saved`, afterUnarchive?.title === 'Edited after unarchive', afterUnarchive?.title)
        check(`${tag}: no "changed elsewhere" notice after Unarchive`, (await page.getByText(/changed elsewhere/i).count()) === 0)
      }

      check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
      check(`${tag}: no horizontal overflow`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
      await page.screenshot({ path: join(tmp, `${name}-${viewport.label}.png`) })
      await browser.close()
    }
  }
} finally {
  server.kill('SIGTERM')
  await fake.close()
  // Windows may still hold a handle on the temp folder: a leftover folder must
  // not turn a passing run into a failing one.
  try { rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* keep the folder */ }
}
console.log(failures ? `\n${failures} e2e check(s) failed.` : '\nAll Seller Studio e2e checks passed.')
process.exit(failures ? 1 : 0)
