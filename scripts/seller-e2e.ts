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
import { AMAZON_LINK_ERROR } from '../shared/amazon-link.ts'

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

      const mobileTouch = name === 'chromium' && viewport.label === 'mobile'
      const ctx = await browser.newContext({
        viewport,
        ...(mobileTouch ? { hasTouch: true, isMobile: true } : {}),
      })
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
      // A second product fills slide 2, which leaves slide 3 as the empty Product 3
      // slot. A third product exists ready to be picked into that slot.
      const prod2 = (await api('POST', '/api/seller/products', { title: 'Second product', priceMinor: 600, currency: 'gbp' }, C)).json.product
      const prod3 = (await api('POST', '/api/seller/products', { title: 'Third product', priceMinor: 700, currency: 'gbp' }, C)).json.product
      const feat = { id: 'blk_e2e_featured', type: 'featured', hidden: false, data: { productId: prod.id, note: '', slides: [{ kind: 'digital', productId: prod.id }, { kind: 'digital', productId: prod2.id }] } }
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
      const editorOpen = (await page.locator('.pg-back').count()) > 0
      check(`${tag}: clicking the product in the preview opens its editing page`, cardCount > 0 && productsTab === 'true' && editorOpen, `card=${cardCount} tab=${productsTab} editor=${editorOpen}`)

      // Clicking a product card (or any of its elements) opens its full product
      // editor. Tapping on mobile does the same.
      await page.getByText(/^Page$/).first().click()
      await page.waitForTimeout(1500)
      const titleEl = page.locator('.ss-slide [data-product-id] h3').first()
      const hadTitle = (await titleEl.count()) > 0
      if (hadTitle) {
        await titleEl.click({ force: true })
        await page.waitForTimeout(1500)
        const editorOpen = (await page.locator('.pg-back').count()) > 0
        // The editor replaces the list: no product cards, no Add Product button.
        const listGone = (await page.locator('.pg-addbtn').count()) === 0
        // ...and it is the product editor, never the Add block popup.
        const notBlockPopup = (await page.getByRole('dialog', { name: 'Add a block' }).count()) === 0
        check(`${tag}: clicking a product opens its full editor`, editorOpen && listGone && notBlockPopup, `editor=${editorOpen} listGone=${listGone} popup=${!notBlockPopup}`)

        // Back from a product opened in the carousel returns to that carousel,
        // with the block editor and the product list still intact.
        await page.getByRole('button', { name: /Back to carousel/ }).first().click()
        await page.waitForTimeout(1200)
        const backToCarousel = (await page.locator('.bl-inline').count()) > 0 && (await page.locator('.pg-back').count()) === 0
        check(`${tag}: Back to carousel restores the block editor`, backToCarousel, 'block editor did not come back')

        // Leaving the block editor and opening a product from the Products tab
        // still shows the ordinary "Back to Products" link.
        await page.getByRole('tab', { name: /^Products/ }).first().click()
        await page.waitForTimeout(1000)
        await page.getByRole('button', { name: /Typed then publish/ }).first().click()
        await page.waitForTimeout(1000)
        await page.getByRole('button', { name: /Back to Products/ }).first().click()
        await page.waitForTimeout(1200)
        const backToList = (await page.locator('.pg-addbtn').count()) === 1 && (await page.locator('.pg-back').count()) === 0
        check(`${tag}: Back to Products returns to the list`, backToList, 'list did not come back')
      }

      // 3c. The product block is a three-slot carousel: the two products, then the
      //     empty Product 3 slot. The dots follow the real slides, so there are
      //     three of them and the third one reaches the empty slot.
      await page.getByText(/^Page$/).first().click()
      await page.waitForTimeout(1500)
      // The slide tabs live in the block editor. Depending on what was open
      // before, the block row click can either open or toggle it shut, so click
      // until the tabs are actually present.
      const blockMain = page.locator(`[data-block="${feat.id}"] .bl-main`)
      for (let attempt = 0; attempt < 3 && (await page.getByRole('tab', { name: 'Slide 1' }).count()) === 0; attempt++) {
        if (await blockMain.count()) await blockMain.click()
        await page.waitForTimeout(600)
      }
      const dots = page.locator('.ss-slide .sp-dot')
      const dotCount = await dots.count()
      check(`${tag}: the carousel shows three dots for its three slots`, dotCount === 3, `dots=${dotCount}`)
      const slideTab = (n: number) => page.getByRole('tab', { name: `Slide ${n}` })
      const swipeTo = async (i: number) => {
        const track = page.locator('.ss-slide .sp-track').first()
        // A touch swipe on mobile; a scroll gesture on desktop. Both go through
        // the real scroll handler, with the product editor still open.
        if (mobileTouch) {
          const box = await track.boundingBox()
          if (box) {
            const y = Math.round(box.y + box.height / 2)
            const from = Math.round(box.x + box.width * (i > 0 ? 0.8 : 0.2))
            const to = Math.round(box.x + box.width * (i > 0 ? 0.2 : 0.8))
            const cdp = await ctx.newCDPSession(page)
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] })
            for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(from + (to - from) * step / 6), y }] })
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
            await cdp.detach()
            await page.waitForTimeout(500)
            return
          }
        }
        await track.evaluate((el, index) => { const t = el as HTMLElement; t.scrollLeft = index * t.clientWidth }, i)
        await page.waitForTimeout(500)
      }
      if (dotCount === 3) {
        // The third preview slot is a placeholder until a real third slide is
        // added: the editor shows "Empty slide" but has no third tab yet.
        await dots.nth(2).click({ force: true })
        await page.waitForTimeout(900)
        const thirdSelected = (await dots.nth(2).getAttribute('aria-selected')) === 'true'
        const emptyInThird = await page.locator('.ss-slide .sp-slide').nth(2).locator('.sp-slide-empty').count()
        const editorShowsEmpty = (await page.getByText('Empty slide', { exact: true }).count()) > 0
        check(`${tag}: the third dot selects the empty Product 3 slide`, thirdSelected && emptyInThird === 1, `selected=${thirdSelected} empty=${emptyInThird}`)
        check(`${tag}: the slide editor follows the active empty slide`, editorShowsEmpty, `editor=${editorShowsEmpty}`)
        await dots.nth(0).click({ force: true })
        await page.waitForTimeout(600)

        // Arrows and a real swipe must move the preview AND the open editor.
        await page.getByRole('button', { name: 'Next product' }).first().click({ force: true })
        await page.waitForTimeout(700)
        check(`${tag}: the Next arrow moves the carousel and the editor together`, (await dots.nth(1).getAttribute('aria-selected')) === 'true' && (await slideTab(2).getAttribute('aria-selected')) === 'true')
        await swipeTo(2)
        check(`${tag}: swiping with the editor open reaches the empty slide`, (await dots.nth(2).getAttribute('aria-selected')) === 'true' && (await page.getByText('Empty slide', { exact: true }).count()) > 0)
        await page.getByRole('button', { name: 'Previous product' }).first().click({ force: true })
        await page.waitForTimeout(700)
        check(`${tag}: the Previous arrow returns to the populated slide`, (await dots.nth(1).getAttribute('aria-selected')) === 'true' && (await slideTab(2).getAttribute('aria-selected')) === 'true')
        await dots.nth(0).click({ force: true })
        await page.waitForTimeout(600)
      }

      // 3d. Product 3 is added through the existing picker into its own slide, saved,
      //     opened in its own editor, and can be removed again.
      await page.getByText(/^Products \(/).first().click()
      await page.waitForTimeout(1200)
      const blockGrid = page.locator('section.sb-block').first().locator('.pg-grid')
      const emptySlot = blockGrid.getByRole('button', { name: 'Add product' })
      const emptySlots = await emptySlot.count()
      check(`${tag}: the Products tab offers the empty Product 3 slot`, emptySlots === 1, `slots=${emptySlots}`)
      if (emptySlots === 1) {
        await emptySlot.first().click()
        await page.waitForTimeout(900)
        const pickerOpen = await page.getByRole('dialog', { name: 'Add a product' }).count()
        const libraryOpen = await page.getByRole('dialog', { name: 'Add a block' }).count()
        check(`${tag}: the empty third slot opens the product picker, not the block library`, pickerOpen === 1 && libraryOpen === 0, `picker=${pickerOpen} library=${libraryOpen}`)

        await page.getByRole('dialog', { name: 'Add a product' }).getByRole('button', { name: /Third product/ }).first().click()
        await page.waitForTimeout(2200)
        const blocksNow = (await api('GET', '/api/seller/store', undefined, C)).json.store.draft.blocks
        const savedSlides: string[] = ((blocksNow.find((b: { id: string }) => b.id === feat.id)?.data?.slides ?? []) as { productId: string }[]).map((s) => s.productId)
        check(
          `${tag}: Product 3 is saved as its own third slide`,
          savedSlides.length === 3 && savedSlides[2] === prod3.id && new Set(savedSlides).size === 3,
          `slides=${savedSlides.length} ids=${savedSlides.join(',')}`,
        )

        const slideEditorStillOpen = (await page.locator('.bl-inline').count()) > 0
        const thirdSelected = page.getByRole('tab', { name: 'Slide 3' }).getAttribute('aria-selected')
        const thirdProductSelected = await page.locator('select[aria-label="Product for slide 3"]').inputValue().catch(() => '')
        check(
          `${tag}: picking Product 3 fills its slide and keeps the block editor open`,
          slideEditorStillOpen && (await thirdSelected) === 'true' && thirdProductSelected === prod3.id,
          `editor=${slideEditorStillOpen} slide=${await thirdSelected} product=${thirdProductSelected}`,
        )
        check(`${tag}: a Digital slide editor hides the Affiliate option`, (await page.locator('.bl-inline').getByRole('button', { name: 'Affiliate', exact: true }).count()) === 0 && (await page.locator('.bl-inline .sld-kind-static').count()) >= 1)

        // "Edit this product" opens the third product's full editor and returns
        // to the same slide rather than dropping the owner in the product list.
        await page.getByRole('button', { name: 'Edit this product' }).first().click()
        await page.waitForTimeout(1200)
        const fullEditorTitle = await title.inputValue().catch(() => '')
        const backToSlides = await page.getByRole('button', { name: /Back to carousel/ }).count()
        check(
          `${tag}: Edit this product opens the active product's full editor`,
          fullEditorTitle === 'Third product' && backToSlides === 1,
          `title=${fullEditorTitle} back=${backToSlides}`,
        )
        await page.getByRole('button', { name: /Back to carousel/ }).first().click()
        await page.waitForTimeout(1200)
        const returnedSlide = page.getByRole('tab', { name: 'Slide 3' }).getAttribute('aria-selected')
        check(`${tag}: Back to carousel preserves the active slide`, (await returnedSlide) === 'true', `slide=${await returnedSlide}`)

        // "+ Add product slide" creates a fourth, empty slide and selects it.
        const addFourth = page.getByRole('button', { name: '+ Add product slide' })
        if ((await addFourth.count()) === 1) {
          await addFourth.click()
          await page.waitForTimeout(1800)
          const fourthSelected = (await page.getByRole('tab', { name: 'Slide 4' }).getAttribute('aria-selected')) === 'true'
          // A real empty slide shows a product picker (not the preview-only
          // "Empty slide" placeholder), with no product chosen yet.
          const fourthEmpty = (await page.locator('select[aria-label="Product for slide 4"]').inputValue().catch(() => 'missing')) === ''
          const fourDots = (await page.locator('.ss-slide .sp-dot').count()) === 4
          check(`${tag}: + Add product slide creates and selects an empty fourth slide`, fourthSelected && fourthEmpty && fourDots, `selected=${fourthSelected} empty=${fourthEmpty} dots=${fourDots}`)
          // Remove that empty slide again so the next check sees three products.
          await page.getByRole('button', { name: 'Remove slide 4' }).first().click()
          await page.waitForTimeout(1600)
          check(`${tag}: an empty slide can be removed independently`, (await page.locator('.ss-slide .sp-dot').count()) === 3)
        }
        await page.getByRole('tab', { name: /^Products/ }).first().click()
        await page.waitForTimeout(1000)
        const removes = page.locator('section.sb-block').first().getByRole('button', { name: 'Remove' })
        const removeCount = await removes.count()
        await removes.nth(removeCount - 1).click()
        await page.waitForTimeout(2200)
        const afterRemove = (await api('GET', '/api/seller/store', undefined, C)).json.store.draft.blocks
        const leftSlides = (afterRemove.find((b: { id: string }) => b.id === feat.id)?.data?.slides ?? []) as unknown[]
        check(`${tag}: Product 3 can be removed again`, leftSlides.length === 2, `slides=${leftSlides.length}`)
      }

      // 3e. The Add block popup belongs to the Add block button only. Add Product
      //     and product cards must never open it.
      await page.getByText(/^Products \(/).first().click()
      await page.waitForTimeout(800)
      await page.getByRole('button', { name: /Add Product/ }).first().click()
      await page.waitForTimeout(1200)
      const blockPopupAfterAddProduct = await page.getByRole('dialog', { name: 'Add a block' }).count()
      check(`${tag}: Add Product does not open the Add block popup`, blockPopupAfterAddProduct === 0, `popup=${blockPopupAfterAddProduct}`)

      await page.getByText(/^Page$/).first().click()
      await page.waitForTimeout(1000)
      const blocksBefore = await page.locator('.ss-slide .sp-pick').count()
      await page.locator('.bl-add').first().click()
      await page.waitForTimeout(500)
      const blockPopup = await page.getByRole('dialog', { name: 'Add a block' }).count()
      check(`${tag}: Add block opens the block popup`, blockPopup === 1, `popup=${blockPopup}`)

      // Quick add tile: the block is created, added to the page and the popup closes.
      await page.locator('.ab-quick').getByRole('button', { name: /^Text$/ }).first().click()
      await page.waitForTimeout(1500)
      const blocksAfter = await page.locator('.ss-slide .sp-pick').count()
      const blockPopupClosed = await page.getByRole('dialog', { name: 'Add a block' }).count()
      check(
        `${tag}: choosing Text adds a block and closes the popup`,
        blocksAfter > blocksBefore && blockPopupClosed === 0,
        `before=${blocksBefore} after=${blocksAfter} popup=${blockPopupClosed}`,
      )

      // Quick add icon for another type: Images.
      await page.locator('.bl-add').first().click()
      await page.waitForTimeout(500)
      await page.locator('.ab-quick').getByRole('button', { name: /^Images$/ }).first().click()
      await page.waitForTimeout(1500)
      const blocksAfterImages = await page.locator('.ss-slide .sp-pick').count()
      check(
        `${tag}: choosing Images adds a block and closes the popup`,
        blocksAfterImages > blocksAfter && (await page.getByRole('dialog', { name: 'Add a block' }).count()) === 0,
        `before=${blocksAfter} after=${blocksAfterImages}`,
      )

      // 3f. Normal is the clean default: no Affiliate tools at all. An Amazon
      // product keeps the switch so it can be returned to Normal without losing
      // the shared title, description or category.
      const typeProduct = (await api('POST', '/api/seller/products', { title: 'Editor type test', priceMinor: 500, currency: 'gbp' }, C)).json.product
      await page.reload()
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /Editor type test/ }).first().click()
      const affiliateRadio = page.getByRole('radio', { name: /Affiliate Product/ })
      const normalRadio = page.getByRole('radio', { name: /Normal Product/ })
      const categoryInput = page.getByLabel('Category')
      const amazonInput = page.getByRole('textbox', { name: 'Amazon product URL' })
      check(`${tag}: a new product starts as Normal with no Affiliate option`, (await affiliateRadio.count()) === 0 && (await page.getByText('Normal Product', { exact: true }).count()) === 1 && (await page.locator('input[aria-label="Price"]').count()) === 1 && (await page.getByText('Digital delivery', { exact: true }).count()) === 1)
      check(`${tag}: the Normal editor hides Amazon fields`, (await amazonInput.count()) === 0)
      const normalEditorText = await page.locator('.ss-stack').innerText()
      check(`${tag}: the Normal editor never mentions an Amazon link`, !/Amazon link|affiliate link/i.test(normalEditorText), normalEditorText.slice(0, 400))

      const goodLink = 'https://www.amazon.co.uk/dp/B0C1ABCDEF?tag=e2e-21'
      const promoted = await api('PATCH', `/api/seller/products/${typeProduct.id}`, { revision: typeProduct.revision, extras: { productType: 'affiliate', affiliate: { url: goodLink, cta: 'View on Amazon', disclosure: 'As an Amazon Associate I earn from qualifying purchases.' } } }, C)
      check(`${tag}: an affiliate product can be opened for editing`, promoted.status === 200, String(promoted.status))
      await page.reload()
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await page.getByText(/^Products \(/).first().click()
      await page.getByRole('button', { name: /Editor type test/ }).first().click()
      await page.waitForTimeout(300)
      check(`${tag}: an Amazon product shows the switch and affiliate fields`, (await affiliateRadio.getAttribute('aria-checked')) === 'true' && (await amazonInput.count()) === 1 && (await page.locator('input[aria-label="Price"]').count()) === 0 && (await page.getByText('Digital delivery', { exact: true }).count()) === 0 && (await page.getByText('Checkout', { exact: true }).count()) === 0)
      const ctaChips = page.locator('.pe-chips button')
      check(`${tag}: the Affiliate editor shows the Amazon defaults`, (await ctaChips.filter({ hasText: 'View on Amazon' }).getAttribute('aria-pressed')) === 'true' && (await ctaChips.filter({ hasText: 'Check on Amazon' }).count()) === 1 && (await page.getByLabel('Affiliate disclosure').inputValue()).includes('Amazon Associate'))
      await categoryInput.fill('Tech')
      await amazonInput.fill('https://amazon.co.uk.evil.example/dp/B0C1ABCDEF')
      check(`${tag}: an Amazon lookalike shows the exact link error`, (await page.getByText(AMAZON_LINK_ERROR, { exact: true }).count()) > 0)
      await amazonInput.fill(goodLink)
      await page.getByRole('button', { name: 'Test link' }).click()
      await page.waitForTimeout(600)
      check(`${tag}: a valid Amazon link passes the live check`, (await page.getByText(/Valid Amazon link/).count()) > 0)
      await ctaChips.filter({ hasText: 'Check on Amazon' }).click()
      await page.waitForTimeout(2200)
      const affSaved = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === typeProduct.id)
      check(`${tag}: the Amazon type, tracking link, CTA and category are saved`, affSaved?.extras?.productType === 'affiliate' && affSaved.extras.affiliate.url === goodLink && affSaved.extras.affiliate.cta === 'Check on Amazon' && affSaved.extras.category === 'Tech', JSON.stringify(affSaved?.extras))
      await normalRadio.click()
      await page.waitForTimeout(2200)
      const backSaved = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === typeProduct.id)
      check(`${tag}: returning to Normal removes the Affiliate option but keeps shared fields`, (await affiliateRadio.count()) === 0 && (await amazonInput.count()) === 0 && (await categoryInput.inputValue()) === 'Tech' && backSaved?.extras?.productType === 'normal' && backSaved.extras.affiliate.url === goodLink, JSON.stringify(backSaved?.extras))
      await page.getByRole('button', { name: /Back to Products/ }).first().click()
      await page.waitForTimeout(800)

      // 3g. Three-dot menus: portaled, clamped, one at a time, with complete
      // block actions. Deleting a block is draft-only, product-safe and undoable.
      const emptyBlockId = 'blk_e2e_empty'
      {
        const st = (await api('GET', '/api/seller/store', undefined, C)).json.store
        const blocks = st.draft.blocks as Array<{ id: string; type: string }>
        if (!blocks.some((b) => b.id === emptyBlockId)) {
          const foot = blocks.findIndex((b) => b.type === 'footer')
          blocks.splice(foot < 0 ? blocks.length : foot, 0, { id: emptyBlockId, type: 'featured', hidden: false, data: { productId: '', note: '', slides: [] } } as never)
          await api('PUT', '/api/seller/store/draft', { page: { ...st.draft, blocks }, revision: st.revision }, C)
        }
      }
      await api('POST', '/api/seller/store/publish', undefined, C)
      await page.reload()
      await page.getByText(/^Page$/).first().waitFor({ timeout: 20000 })
      await page.getByText(/^Page$/).first().click()
      await page.waitForTimeout(1200)
      const emptyMore = page.locator(`[data-block="${emptyBlockId}"] .bl-more`)
      const featMore = page.locator(`[data-block="${feat.id}"] .bl-more`)
      // The block above is seeded through the API, but the editor also keeps a
      // localStorage copy of the page draft. A later recovery flush can replace
      // the seeded block with an older snapshot, so re-seed it when it vanishes.
      const ensureEmpty = async () => {
        if (await emptyMore.count()) return
        const st = (await api('GET', '/api/seller/store', undefined, C)).json.store
        const blocks = st.draft.blocks as Array<{ id: string; type: string }>
        if (!blocks.some((b) => b.id === emptyBlockId)) {
          const foot = blocks.findIndex((b) => b.type === 'footer')
          blocks.splice(foot < 0 ? blocks.length : foot, 0, { id: emptyBlockId, type: 'featured', hidden: false, data: { productId: '', note: '', slides: [] } } as never)
          await api('PUT', '/api/seller/store/draft', { page: { ...st.draft, blocks }, revision: st.revision }, C)
        }
        await page.evaluate((id) => localStorage.removeItem(`desknoty.seller.recovery.${id}.page`), st.id)
        await page.reload()
        await page.getByText(/^Page$/).first().waitFor({ timeout: 20000 })
        await page.getByText(/^Page$/).first().click()
        await page.waitForTimeout(800)
      }
      check(`${tag}: an empty Digital product block has a three-dot menu`, (await emptyMore.count()) === 1)
      await emptyMore.click()
      const menuLabels = await page.locator('.bl-menu-portal').getByRole('menuitem').allTextContents()
      const requiredLabels = ['Edit block', 'Duplicate block', 'Move up', 'Move down', 'Delete block']
      check(`${tag}: every Digital block menu offers all block actions`, requiredLabels.every((l) => menuLabels.includes(l)), menuLabels.join('|'))
      const pos = await page.evaluate(() => {
        const btn = document.querySelector('[data-block="blk_e2e_empty"] .bl-more')
        const menu = document.querySelector('.bl-menu-portal')
        if (!btn || !menu) return null
        const a = btn.getBoundingClientRect(), r = menu.getBoundingClientRect()
        return {
          body: menu.parentElement === document.body,
          inside: r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
          near: Math.abs(r.right - a.right) < 48 || Math.abs(r.left - a.left) < 48,
          roomBelow: window.innerHeight - a.bottom,
          menuH: r.height,
          flipped: r.bottom <= a.top + 8,
        }
      })
      check(`${tag}: the menu is portaled, anchored and inside the viewport`, Boolean(pos?.body && pos.inside && pos.near), JSON.stringify(pos))
      await featMore.click()
      const openMenus = await page.locator('.bl-menu-portal').count()
      const expanded = await page.locator('.bl-more[aria-expanded="true"]').count()
      check(`${tag}: only one block menu can be open at a time`, openMenus === 1 && expanded === 1, `menus=${openMenus} expanded=${expanded}`)
      await page.getByText(/^Page$/).first().click({ force: true })
      check(`${tag}: an outside click closes the menu`, (await page.locator('.bl-menu-portal').count()) === 0)
      await ensureEmpty()
      await emptyMore.click()
      await page.keyboard.press('Escape')
      check(`${tag}: Escape closes the menu`, (await page.locator('.bl-menu-portal').count()) === 0)
      await ensureEmpty()
      // Put the button near the bottom edge: the menu must flip up, not vanish.
      await page.evaluate(() => {
        const el = document.querySelector('[data-block="blk_e2e_empty"] .bl-more') as HTMLElement | null
        if (!el) return
        let p: HTMLElement | null = el
        while (p) { if (p.scrollHeight > p.clientHeight + 20) p.scrollTop = p.scrollHeight; p = p.parentElement }
        el.scrollIntoView({ block: 'end', inline: 'nearest' })
      })
      await page.waitForTimeout(300)
      await emptyMore.click()
      const flip = await page.evaluate(() => {
        const btn = document.querySelector('[data-block="blk_e2e_empty"] .bl-more')
        const menu = document.querySelector('.bl-menu-portal')
        if (!btn || !menu) return null
        const a = btn.getBoundingClientRect(), r = menu.getBoundingClientRect()
        return { roomBelow: window.innerHeight - a.bottom, menuH: r.height, flipped: r.bottom <= a.top + 8, inside: r.top >= -1 && r.bottom <= window.innerHeight + 1 }
      })
      check(`${tag}: a menu near the bottom flips up and stays on screen`, Boolean(flip && flip.inside && (flip.roomBelow >= flip.menuH + 14 || flip.flipped)), JSON.stringify(flip))
      const countBeforeDelete = (await api('GET', '/api/seller/store', undefined, C)).json.store.products.length
      let confirmed = false
      page.once('dialog', async (d) => { confirmed = /Delete .*Digital product/i.test(d.message()); await d.accept() })
      await page.locator('.bl-menu-portal').getByRole('menuitem', { name: 'Delete block' }).click()
      await page.waitForTimeout(2200)
      const afterDelete = (await api('GET', '/api/seller/store', undefined, C)).json.store
      const liveAfterDelete = (await api('GET', `/api/store/${handle}`)).json
      check(`${tag}: deleting a block removes only that block`, confirmed && !(afterDelete.draft.blocks as Array<{ id: string }>).some((b) => b.id === emptyBlockId) && afterDelete.products.length === countBeforeDelete)
      check(`${tag}: a draft deletion leaves the published storefront unchanged`, (liveAfterDelete.page?.blocks as Array<{ id: string }> | undefined)?.some((b) => b.id === emptyBlockId) === true)
      await page.getByRole('button', { name: 'Undo' }).first().click()
      await page.waitForTimeout(2200)
      const afterUndo = (await api('GET', '/api/seller/store', undefined, C)).json.store
      check(`${tag}: Undo restores the deleted block and keeps its product`, (afterUndo.draft.blocks as Array<{ id: string }>).some((b) => b.id === emptyBlockId) && afterUndo.products.length === countBeforeDelete)

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

      // 7. A paid product stays paid while its price is being typed. Clearing it,
      //    typing 0 / 0. / 0.10 / 10, switching products, autosaving, refreshing
      //    and publishing must never turn it into a free product.
      const guard = (await api('POST', '/api/seller/products', { title: 'Pricing guard', priceMinor: 2999, currency: 'gbp' }, C)).json.product
      const guardFile = await fetch(`${BASE}/api/seller/products/${guard.id}/file`, { method: 'PUT', headers: { origin: BASE, cookie: C, 'content-type': 'application/zip', 'x-file-name': 'guard.zip' }, body: 'E2E' })
      check(`${tag}: pricing guard product has a file so it can publish`, guardFile.status === 200)
      const guardNow = async () => (await api('GET', '/api/seller/store', undefined, C)).json.store.products.find((p: { id: string }) => p.id === guard.id)
      const price = page.locator('input[aria-label="Price"]')
      const freeSwitch = page.getByRole('switch', { name: 'Free product' })
      const openGuard = async () => {
        await page.getByText(/^Products \(/).first().click()
        await page.getByRole('button', { name: /Pricing guard/ }).first().click()
        await price.waitFor()
      }
      await page.reload()
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await openGuard()
      const initial = await guardNow()
      check(`${tag}: a new paid product starts as paid`, initial?.paymentType === 'paid' && initial.priceMinor === 2999, JSON.stringify(initial && { mode: initial.paymentType, price: initial.priceMinor }))
      check(`${tag}: the price field shows the saved price`, (await price.inputValue()) === '29.99', await price.inputValue())
      check(`${tag}: the free switch starts off`, (await freeSwitch.getAttribute('aria-checked')) === 'false')

      // Clearing the field is an unfinished edit, not a free product.
      await price.fill('')
      await page.waitForTimeout(1500)
      const cleared = await guardNow()
      check(`${tag}: clearing £29.99 keeps the input empty`, (await price.inputValue()) === '', await price.inputValue())
      check(`${tag}: clearing £29.99 does not switch to FREE`, (await freeSwitch.getAttribute('aria-checked')) === 'false' && cleared?.paymentType === 'paid' && cleared.priceMinor === 2999, JSON.stringify(cleared && { mode: cleared.paymentType, price: cleared.priceMinor }))
      check(`${tag}: clearing the price keeps focus in the input`, await price.evaluate((el: HTMLInputElement) => document.activeElement === el))
      check(`${tag}: an empty paid price shows validation`, await page.getByText('Enter a price', { exact: true }).count() > 0)

      // A zero/invalid paid price must not publish as free either.
      await page.getByRole('button', { name: /Publish/ }).first().click()
      await page.waitForTimeout(1200)
      const blocked = await guardNow()
      const liveBlocked = (await api('GET', `/api/store/${handle}`)).json.products ?? []
      check(`${tag}: publishing with an empty paid price is blocked`, blocked?.paymentType === 'paid' && blocked.priceMinor === 2999 && !liveBlocked.some((p: { id: string }) => p.id === guard.id), JSON.stringify(blocked && { mode: blocked.paymentType, price: blocked.priceMinor }))

      // Typing a price that starts with 0 must stay paid at every keystroke.
      for (const [typed, savedPrice] of [['0', 2999], ['0.', 2999], ['0.1', 10], ['0.10', 10], ['10', 1000]] as Array<[string, number]>) {
        await price.fill(typed)
        await page.waitForTimeout(1500)
        const during = await guardNow()
        check(`${tag}: typing "${typed}" keeps the exact string`, (await price.inputValue()) === typed, await price.inputValue())
        check(`${tag}: typing "${typed}" stays PAID`, (await freeSwitch.getAttribute('aria-checked')) === 'false' && during?.paymentType === 'paid' && during.priceMinor === savedPrice, JSON.stringify(during && { mode: during.paymentType, price: during.priceMinor }))
      }

      // Switching to another product and back keeps the typed value and mode.
      await page.getByRole('button', { name: /Back to Products/ }).first().click()
      await page.waitForTimeout(800)
      await page.getByRole('button', { name: /Second product/ }).first().click()
      await page.waitForTimeout(800)
      check(`${tag}: a different product has its own paid mode`, (await page.getByRole('switch', { name: 'Free product' }).getAttribute('aria-checked')) === 'false')
      await page.getByRole('button', { name: /Back to Products/ }).first().click()
      await page.getByRole('button', { name: /Pricing guard/ }).first().click()
      await price.waitFor()
      // A completed autosave drops the exact keystroke string from recovery; a
      // fresh editor may render the saved value as 10.00. The value and mode
      // must survive, and it must never become the old price or free.
      const switchedPrice = await price.inputValue()
      check(`${tag}: switching products keeps the paid price and mode`, ['10', '10.00'].includes(switchedPrice) && (await freeSwitch.getAttribute('aria-checked')) === 'false', `${switchedPrice} / ${await freeSwitch.getAttribute('aria-checked')}`)

      // A refresh rehydrates the editor from the server/recovery without a mode flip.
      await page.reload()
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await openGuard()
      await page.waitForTimeout(800)
      const guardAfterRefresh = await guardNow()
      const refreshedPrice = await price.inputValue()
      check(`${tag}: refreshing keeps the typed paid price`, ['10', '10.00'].includes(refreshedPrice) && (await freeSwitch.getAttribute('aria-checked')) === 'false', `${refreshedPrice} / ${await freeSwitch.getAttribute('aria-checked')}`)
      check(`${tag}: refreshing keeps the server product PAID`, guardAfterRefresh?.paymentType === 'paid' && guardAfterRefresh.priceMinor === 1000, JSON.stringify(guardAfterRefresh && { mode: guardAfterRefresh.paymentType, price: guardAfterRefresh.priceMinor }))

      // Publishing keeps the paid mode and the published price.
      await page.getByRole('button', { name: /Publish/ }).first().click()
      await page.waitForTimeout(2500)
      const afterPublish = await guardNow()
      const livePublished = ((await api('GET', `/api/store/${handle}`)).json.products ?? []).find((p: { id: string }) => p.id === guard.id)
      check(`${tag}: publishing keeps the server product PAID`, afterPublish?.paymentType === 'paid' && afterPublish.priceMinor === 1000, JSON.stringify(afterPublish && { mode: afterPublish.paymentType, price: afterPublish.priceMinor }))
      check(`${tag}: the live product is PAID at the new price`, livePublished?.paymentType === 'paid' && livePublished.priceMinor === 1000, JSON.stringify(livePublished && { mode: livePublished.paymentType, price: livePublished.priceMinor }))

      // Changing a published Amazon product back to Normal must warn first;
      // cancelling must leave the product exactly as it was.
      const warnCreated = await api('POST', '/api/seller/products', { title: 'Type warning test', priceMinor: 0, currency: 'gbp' }, C)
      const warnProduct = warnCreated.json.product
      const warnPatched = await api('PATCH', `/api/seller/products/${warnProduct.id}`, { revision: warnProduct.revision, extras: { productType: 'affiliate', affiliate: { url: 'https://www.amazon.co.uk/dp/B0CWARN123', cta: 'View on Amazon', disclosure: 'As an Amazon Associate I earn from qualifying purchases.' } } }, C)
      check(`${tag}: a published Amazon product can be prepared for the warning check`, warnCreated.status === 201 && warnPatched.status === 200, `${warnCreated.status}/${warnPatched.status}`)
      await api('POST', '/api/seller/store/publish', undefined, C)
      await page.reload()
      await page.getByText(/^Products \(/).first().waitFor({ timeout: 20000 })
      await page.getByText(/^Products \(/).first().click()
      await page.locator('details.pg-archived summary').filter({ hasText: 'Product library' }).first().click()
      await page.getByRole('button', { name: /Type warning test/ }).first().click()
      let typeWarned = false
      page.once('dialog', async (d) => { typeWarned = d.type() === 'confirm' && /published affiliate product to a normal product/i.test(d.message()); await d.dismiss() })
      await page.getByRole('radio', { name: /Normal Product/ }).click()
      await page.waitForTimeout(400)
      check(`${tag}: changing a published product type warns and can be cancelled`, typeWarned && (await page.getByRole('radio', { name: /Affiliate Product/ }).getAttribute('aria-checked')) === 'true', `warned=${typeWarned}`)
      await page.getByRole('button', { name: /Back to Products/ }).first().click()
      await page.waitForTimeout(600)
      await page.locator('details.pg-archived summary').filter({ hasText: 'Product library' }).first().click()
      await page.getByRole('button', { name: /Pricing guard/ }).first().click()
      await price.waitFor()

      // Only an intentional click on the selector may change the mode.
      await freeSwitch.click()
      await page.waitForTimeout(1800)
      const afterFree = await guardNow()
      check(`${tag}: the Free switch explicitly makes the product free`, (await freeSwitch.getAttribute('aria-checked')) === 'true' && afterFree?.paymentType === 'free' && afterFree.priceMinor === 0, JSON.stringify(afterFree && { mode: afterFree.paymentType, price: afterFree.priceMinor }))

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
