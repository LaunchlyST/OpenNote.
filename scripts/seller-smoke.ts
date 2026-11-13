/**
 * Seller Studio end to end, at the API level, against the real server and a
 * local Stripe stand-in (scripts/fake-stripe.ts):
 *
 *   two sellers with separate stores and handles · draft vs published page ·
 *   product between two blocks · private file · payouts states (not
 *   connected → incomplete → pending → ready) · checkout only when ready ·
 *   published price used, not the draft · unpaid visitor can't download ·
 *   signed webhook → paid, receipt queued once · duplicate webhook and a
 *   second event for the same session do nothing · bad signature refused ·
 *   cancelled checkout · expired and tampered download links refused ·
 *   receipt link re-issues a download.
 *
 * Run with: npm run test:seller
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import pg from 'pg'
import { sendWebhook, startFakeStripe } from './fake-stripe.ts'

const tmp = mkdtempSync(join(tmpdir(), 'desknoty-seller-'))
const PORT = 4000 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = `http://localhost:${PORT}`
const WHSEC = 'whsec_test_desknoty'
const HOOK = `${BASE}/api/stripe/webhook`

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Reads the server's database directly (SQLite file, or Postgres when DATABASE_URL is set). */
async function dbGet<T>(text: string, ...params: unknown[]): Promise<T> {
  if (process.env.DATABASE_URL) {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await c.connect()
    let n = 0
    const r = await c.query(text.replace(/\?/g, () => '$' + String(++n)), params)
    await c.end()
    return r.rows[0] as T
  }
  const d = new Database(join(tmp, 'seller.db'), { readonly: true })
  try {
    return d.prepare(text).get(...params) as T
  } finally {
    d.close()
  }
}

// A stand-in for public TikTok profile pages (bio-code verification).
const ttBio: Record<string, string> = {}
const ttServer = (await import('node:http')).createServer((rq, rs) => {
  const user = decodeURIComponent((rq.url ?? '').replace(/^\/@/, ''))
  if (!(user in ttBio)) return void (rs.writeHead(404), rs.end('not found'))
  const data = { __DEFAULT_SCOPE__: { 'webapp.user-detail': { userInfo: { user: { uniqueId: user, nickname: 'Ben From TikTok', signature: ttBio[user], avatarLarger: '' } } } } }
  rs.writeHead(200, { 'content-type': 'text/html' })
  rs.end(`<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script></html>`)
})
await new Promise<void>((r) => ttServer.listen(0, '127.0.0.1', () => r()))
const TT_BASE = `http://127.0.0.1:${(ttServer.address() as { port: number }).port}`

const fake = await startFakeStripe({ webhookUrl: HOOK, webhookSecret: WHSEC })

function boot(extra: Record<string, string> = {}): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: '', SUPABASE_DB_URL: '', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
      SIGNUP_ALLOWLIST: '', PRO_EMAILS: '', ADMIN_EMAILS: '',
      STRIPE_MODE: 'test', STRIPE_TEST_SECRET_KEY: '', STRIPE_TEST_WEBHOOK_SECRET: '',
      BETTER_AUTH_URL: ORIGIN,
      BETTER_AUTH_SECRET: 'e'.repeat(64),
      DATABASE_PATH: join(tmp, 'seller.db'),
      MAILBOX_DIR: join(tmp, 'mailbox'),
      SELLER_FILES_DIR: join(tmp, 'files'),
      SELLER_MEDIA_DIR: join(tmp, 'media'),
      API_PORT: String(PORT),
      SMTP_HOST: '',
      SMTP_PRESET: '',
      REQUIRE_EMAIL_VERIFICATION: 'false',
      STRIPE_SECRET_KEY: 'sk_test_fake',
      STRIPE_WEBHOOK_SECRET: WHSEC,
      STRIPE_API_BASE: fake.url,
      TIKTOK_WEB_BASE: TT_BASE,
      TIKTOK_CLIENT_KEY: '',
      TIKTOK_CLIENT_SECRET: '',
      ...extra,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout!.on('data', (d) => (log += d))
  child.stderr!.on('data', (d) => (log += d))
  return new Promise((resolve, reject) => {
    const t = setInterval(() => log.includes('listening') && (clearInterval(t), resolve(child)), 100)
    child.once('exit', (code) => (clearInterval(t), reject(new Error(`server exited (${code}):\n${log}`))))
  })
}

let ip = 0
async function req(method: string, path: string, body?: unknown, cookie = '', headers: Record<string, string> = {}) {
  if (body && typeof body === 'object' && !(body instanceof Buffer)) {
    const data = body as Record<string, unknown>
    if (path === '/api/seller/store/draft' && data.revision === undefined) data.revision = (await req('GET', '/api/seller/store', undefined, cookie)).json?.store?.revision
    if (method === 'PATCH' && /^\/api\/seller\/products\/[^/]+$/.test(path) && data.revision === undefined) data.revision = (await req('GET', '/api/seller/store', undefined, cookie)).json?.store?.products?.find((p: {id: string}) => path.endsWith(p.id))?.revision
  }
  ip += 1
  const raw = body instanceof Buffer
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      origin: ORIGIN,
      'x-forwarded-for': `10.2.${ip >> 8}.${ip & 255}`,
      ...(body === undefined || raw ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not json */
  }
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ')
  return { status: res.status, json, text, cookies, headers: res.headers }
}

let server = await boot()
try {
  const PASSWORD = 'a-long-enough-password'
  const a = await req('POST', '/api/auth/sign-up/email', { name: 'Ava', email: 'ava@seller.test', password: PASSWORD })
  const b = await req('POST', '/api/auth/sign-up/email', { name: 'Ben', email: 'ben@seller.test', password: PASSWORD })
  const fixtures = new Database(join(tmp, 'seller.db'))
  fixtures.prepare(`UPDATE "user" SET "emailVerified" = 1, plan = 'pro' WHERE email IN ('ava@seller.test','ben@seller.test')`).run()
  fixtures.close()
  const A = a.cookies
  const B = b.cookies

  const accessDb = new Database(join(tmp, 'seller.db'))
  accessDb.prepare(`UPDATE "user" SET plan = 'free' WHERE email = 'ben@seller.test'`).run()
  check('free accounts cannot call seller API', (await req('GET', '/api/seller/store', undefined, B)).status === 403)
  accessDb.prepare(`UPDATE "user" SET plan = 'pro', "emailVerified" = 0 WHERE email = 'ben@seller.test'`).run()
  check('unverified Pro accounts cannot call seller API', (await req('GET', '/api/seller/store', undefined, B)).status === 403)
  accessDb.prepare(`UPDATE "user" SET "emailVerified" = 1 WHERE email = 'ben@seller.test'`).run()
  accessDb.close()

  console.log('\n  Setup state')
  const setup = await req('GET', '/api/seller/setup')
  check('setup reports Stripe on and TikTok off', setup.json?.stripe === true && setup.json?.tiktok === false && setup.json?.platformFeePercent === 0)
  const tt = await req('POST', '/api/seller/tiktok/start', { returnTo: '/app/pro' }, A)
  check('Connect TikTok without credentials says it is not set up', tt.status === 503 && tt.json?.setup === true)
  check('anonymous seller API is refused', (await req('GET', '/api/seller/store')).status === 401)

  console.log('\n  Two sellers, separate stores')
  check('handle check: available', (await req('GET', '/api/seller/handle/ava-makes', undefined, A)).json?.available === true)
  const sa = await req('POST', '/api/seller/store', { name: 'Ava Makes', handle: 'ava-makes' }, A)
  check('Ava starts a store at the short address desknoty.com/<handle>', sa.status === 201 && sa.json?.store?.url === `${ORIGIN}/ava-makes`, String(sa.status))
  check('handle check: now taken for Ben', (await req('GET', '/api/seller/handle/ava-makes', undefined, B)).json?.available === false)
  const taken = await req('POST', '/api/seller/store', { name: 'Ben', handle: 'ava-makes' }, B)
  check('Ben can’t claim Ava’s handle', taken.status === 409)
  for (const h of ['signin', 'landing', 'pro', 'video']) check(`site paths can’t be store handles (${h})`, (await req('GET', `/api/seller/handle/${h}`, undefined, B)).json?.available === false)
  check('reserved handles are refused', (await req('POST', '/api/seller/store', { handle: 'admin' }, B)).status === 400)
  const sb = await req('POST', '/api/seller/store', { name: 'Ben Builds', handle: 'ben-builds' }, B)
  check('Ben starts his own store', sb.status === 201)
  check('a second store per account is refused', (await req('POST', '/api/seller/store', { handle: 'ava-two' }, A)).status === 409)

  console.log('\n  Products and private files')
  const p1 = await req('POST', '/api/seller/products', { title: 'Content planner', description: 'A Notion template', priceMinor: 1200, currency: 'gbp' }, A)
  const pid = p1.json?.product?.id as string
  check('Ava adds a product', p1.status === 201 && Boolean(pid))
  check('product needs a file before it can be published', p1.json?.product?.problem?.includes('file'))
  const up = await req('PUT', `/api/seller/products/${pid}/file`, Buffer.from('SECRET-PLANNER-CONTENT'), A, { 'content-type': 'application/pdf', 'x-file-name': 'planner.pdf' })
  check('Ava uploads the private file', up.status === 200 && up.json?.product?.file?.name === 'planner.pdf' && up.json?.product?.problem === null)
  const benEdit = await req('PATCH', `/api/seller/products/${pid}`, { title: 'hacked' }, B)
  check('Ben can’t edit Ava’s product', benEdit.status === 404)
  const benFile = await req('PUT', `/api/seller/products/${pid}/file`, Buffer.from('x'), B, { 'x-file-name': 'x' })
  check('Ben can’t replace Ava’s file', benFile.status === 404)

  console.log('\n  Page: product block between two blocks, draft vs published')
  const store = (await req('GET', '/api/seller/store', undefined, A)).json.store
  const blocks = store.draft.blocks
  const between = [
    blocks[0],
    { id: 'blk_text1', type: 'text', hidden: false, data: { heading: 'Hello', body: 'Templates I use every day.' } },
    { id: 'blk_feat1', type: 'featured', hidden: false, data: { productId: pid } },
    { id: 'blk_faq1', type: 'faq', hidden: false, data: { heading: 'FAQ', items: [{ q: 'Refunds?', a: 'Message me.' }] } },
    ...blocks.slice(1),
  ]
  const saved = await req('PUT', '/api/seller/store/draft', { page: { ...store.draft, blocks: between } }, A)
  check('draft saves with the product between text and FAQ', saved.status === 200 && saved.json.store.draft.blocks[2].data.productId === pid)
  const foreign = await req('PUT', '/api/seller/store/draft', { page: { ...store.draft, blocks: [{ id: 'blk_x123', type: 'featured', data: { productId: 'prd_not_mine' } }] } }, B)
  check('a block can only point at the seller’s own products', foreign.json?.store?.draft?.blocks?.find((x: { type: string }) => x.type === 'featured')?.data?.productId === null)
  check('the profile header is pinned first and the footer last', foreign.json?.store?.draft?.blocks?.[0]?.type === 'header' && foreign.json.store.draft.blocks.at(-1)?.type === 'footer')
  check('store is not public before Publish', (await req('GET', '/api/store/ava-makes')).status === 404)
  const beforeRevision = (await req('GET', '/api/seller/store', undefined, A)).json.store
  const writes = await Promise.all([
    req('PATCH', `/api/seller/products/${pid}`, { title: 'Latest title', revision: beforeRevision.products[0].revision }, A),
    req('PATCH', `/api/seller/products/${pid}`, { title: 'Conflicting title', revision: beforeRevision.products[0].revision }, A),
  ])
  check('concurrent stale product write is refused', writes.map(r => r.status).sort().join(',') === '200,409')
  check('stale page writes are refused', (await req('PUT', '/api/seller/store/draft', { page: beforeRevision.draft, revision: -1 }, A)).status === 409)
  await req('PATCH', `/api/seller/products/${pid}`, { title: 'Content planner' }, A)
  const pubd = await req('POST', '/api/seller/store/publish', undefined, A)
  check('Publish', pubd.status === 200 && pubd.json.store.unpublishedChanges === false)
  const live = await req('GET', '/api/store/ava-makes')
  check('public store shows the published page and product', live.status === 200 && live.json.page.blocks[2].type === 'featured' && live.json.products[0]?.id === pid)
  check('public store never exposes file details', !live.text.includes('planner.pdf') && !live.text.includes('fil_'))
  check('checkout is off before payouts are ready', live.json.checkoutReady === false)

  console.log('\n  Product cards V2: layout, crop, gallery, text position')
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex')
  const mineImg = (await req('POST', '/api/seller/media', png, A, { 'content-type': 'image/png' })).json?.id
  const benImg = (await req('POST', '/api/seller/media', png, B, { 'content-type': 'image/png' })).json?.id
  check('media uploads work for both sellers', Boolean(mineImg) && Boolean(benImg))
  const v2 = await req('PATCH', `/api/seller/products/${pid}`, { extras: {
    layout: 'showcase', subtitle: 'Plan a month\nin one afternoon', crop: { x: 130, y: 20, zoom: 9 }, gallery: [mineImg, benImg, 'med_bad', mineImg], video: mineImg,
    badges: { new: true, featured: 'yes' }, format: 'PDF', included: ['30 templates', '', 'Bonus checklist'], access: 'Instant download',
    faq: [{ q: 'Refunds?', a: 'Within 14 days.' }, { q: 'No answer', a: '' }], textPos: { title: 0.5, desc: 7 }, layoutHack: 'x',
  } }, A)
  const vx = v2.json?.product?.extras
  check('card settings save', v2.status === 200 && vx?.layout === 'showcase' && vx?.format === 'PDF' && vx?.access === 'Instant download')
  check('card text is single line and trimmed', vx?.subtitle === 'Plan a month in one afternoon' && vx?.included?.join('|') === '30 templates|Bonus checklist')
  check('crop and text positions are clamped into range', vx?.crop?.x === 100 && vx?.crop?.zoom === 2.5 && vx?.textPos?.title === 0.5 && vx?.textPos?.desc === 1)
  check('gallery keeps only the seller’s own images, once each', vx?.gallery?.length === 1 && vx.gallery[0] === mineImg)
  check('an image can’t be used as the preview video', vx?.video === null)
  check('unanswered FAQ entries are dropped', vx?.faq?.length === 1)
  const badLayout = await req('PATCH', `/api/seller/products/${pid}`, { extras: { ...vx, layout: 'mega' } }, A)
  check('an unknown layout falls back to compact', badLayout.json?.product?.extras?.layout === 'compact')
  await req('PATCH', `/api/seller/products/${pid}`, { extras: vx }, A)
  const notYet = (await req('GET', '/api/store/ava-makes')).json.products[0]
  check('card changes stay in the draft until Publish', (notYet.layout ?? 'compact') === 'compact' && !notYet.subtitle)
  await req('POST', '/api/seller/store/publish', undefined, A)
  const pub2 = (await req('GET', '/api/store/ava-makes')).json.products[0]
  check('published card settings reach the public store', pub2.layout === 'showcase' && pub2.subtitle === 'Plan a month in one afternoon' && pub2.textPos.title === 0.5 && pub2.gallery[0] === mineImg && pub2.badges.new === true)
  check('the public card shows a file type label, not the file name', pub2.fileType === 'PDF' && !JSON.stringify(pub2).includes('planner.pdf'))

  await req('PATCH', `/api/seller/products/${pid}`, { title: 'Content planner v2', priceMinor: 99 }, A)
  await req('PUT', '/api/seller/store/draft', { page: { ...store.draft, blocks: between.filter((x: { type: string }) => x.type !== 'faq') } }, A)
  const live2 = await req('GET', '/api/store/ava-makes')
  check('editing the draft keeps the last published page live', live2.json.page.blocks.some((x: { type: string }) => x.type === 'faq') && live2.json.products[0].title === 'Content planner' && live2.json.products[0].priceMinor === 1200)
  check('the editor flags unpublished changes', (await req('GET', '/api/seller/store', undefined, A)).json.store.unpublishedChanges === true)

  console.log('\n  Payouts: Stripe-hosted onboarding')
  check('status starts Not connected', (await req('GET', '/api/seller/store', undefined, A)).json.store.payouts.status === 'not_connected')
  const early = await req('POST', '/api/store/ava-makes/checkout', { productId: pid })
  check('checkout refused before the seller can take payments', early.status === 409)
  const ob = await req('POST', '/api/seller/stripe/onboard', { returnTo: '/app/pro?tool=seller' }, A)
  check('Connect bank account returns a Stripe onboarding link', ob.status === 200 && String(ob.json?.url).includes('/onboard/acct_'))
  const accountId = [...fake.accounts.keys()][0]
  const link = fake.calls.find((c) => c.path === '/v1/account_links')!
  check('return and refresh URLs come back to the studio', String(link.body.return_url).startsWith(`${ORIGIN}/app/pro?tool=seller&stripe=return`) && String(link.body.refresh_url).includes('stripe=refresh'))
  check('incomplete onboarding shows Setup incomplete', (await req('GET', '/api/seller/store?refresh=1', undefined, A)).json.store.payouts.status === 'incomplete')
  const resume = await req('POST', '/api/seller/stripe/onboard', { returnTo: '/app/pro' }, A)
  check('resuming reuses the same connected account', resume.status === 200 && fake.accounts.size === 1)
  const created = fake.calls.find((c) => c.path === '/v2/core/accounts')!.body as any
  check('account is created with Accounts v2, Stripe collecting fees and losses', created.dashboard === 'full' && created.defaults.responsibilities.fees_collector === 'stripe' && created.defaults.responsibilities.losses_collector === 'stripe')
  fake.setAccount(accountId, 'pending')
  check('submitted but verifying shows Verification pending', (await req('GET', '/api/seller/store?refresh=1', undefined, A)).json.store.payouts.status === 'pending')
  check('still no checkout while verification is pending', (await req('POST', '/api/store/ava-makes/checkout', { productId: pid })).status === 409)
  fake.setAccount(accountId, 'ready')
  const upd = fake.event('account.updated', fake.accounts.get(accountId)!, accountId)
  await sendWebhook(HOOK, upd)
  const ready = (await req('GET', '/api/seller/store', undefined, A)).json.store.payouts
  check('account.updated webhook → Ready for payouts', ready.status === 'ready' && ready.checkoutReady === true)
  check('Manage payouts opens Stripe', String((await req('POST', '/api/seller/stripe/manage', undefined, A)).json?.url).includes('/dashboard/'))
  check('Ben’s store has no payouts from Ava’s account', (await req('GET', '/api/seller/store', undefined, B)).json.store.payouts.status === 'not_connected')

  const parallelOnboard = await Promise.all([req('POST', '/api/seller/stripe/onboard', {}, B), req('POST', '/api/seller/stripe/onboard', {}, B)])
  check('concurrent onboarding reuses one account', parallelOnboard.every(r => r.status === 200) && fake.accounts.size === 2)

  console.log('\n  Checkout and fulfilment')
  const co = await req('POST', '/api/store/ava-makes/checkout', { productId: pid })
  check('Buy now creates a Checkout Session', co.status === 200 && String(co.json?.url).includes('/pay/cs_'))
  const sessCall = fake.calls.filter((c) => c.path === '/v1/checkout/sessions').at(-1)!
  const item = ((sessCall.body.line_items as any)['0'] as any).price_data
  check('session is created on the seller’s connected account', sessCall.account === accountId)
  check('the published price is charged, not the draft', item.unit_amount === '1200' && item.currency === 'gbp' && item.product_data.name === 'Content planner')
  check('no Desknoty application fee', !JSON.stringify(sessCall.body).includes('application_fee'))
  const sid = String(co.json.url).split('/pay/')[1]
  const pending = await req('GET', `/api/store/ava-makes/session/${sid}`)
  check('before payment the order is pending with no download', pending.json?.order?.status === 'pending' && pending.json.order.downloadUrl === null)
  check('Ben’s store can’t see Ava’s order', (await req('GET', `/api/store/ben-builds/session/${sid}`)).status === 404)

  const bad = await sendWebhook(HOOK, { payload: JSON.stringify({ id: 'evt_forged', type: 'checkout.session.completed', data: { object: { id: sid, payment_status: 'paid' } } }), header: 't=1,v1=deadbeef' })
  check('a webhook with a bad signature is refused', bad.status === 400)
  check('…and does not mark the order paid', (await req('GET', `/api/store/ava-makes/session/${sid}`)).json.order.status === 'pending')

  const paid = fake.pay(sid, 'buyer@example.test')
  const w1 = await sendWebhook(HOOK, paid)
  const w2 = await sendWebhook(HOOK, paid)
  const w2body = await w2.json()
  const other = fake.event('checkout.session.completed', fake.sessions.get(sid)!, accountId)
  const w3 = await sendWebhook(HOOK, other)
  check('signed webhook accepted', w1.status === 200)
  check('the same event delivered twice is acknowledged as a duplicate', w2.status === 200 && w2body.duplicate === true)
  check('a second event for the same session is accepted', w3.status === 200)
  const done = await req('GET', `/api/store/ava-makes/session/${sid}`)
  check('order is paid with a download link', done.json.order.status === 'paid' && String(done.json.order.downloadUrl).includes('/api/store-download/'))

  const orders = await dbGet<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM seller_order WHERE "sessionId" = ?', sid)
  const mails = await dbGet<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM email_outbox WHERE kind = 'order-receipt' AND recipient = 'buyer@example.test'`)
  check('exactly one order for the session', orders.n === 1)
  check('exactly one receipt email despite three deliveries', mails.n === 1, `got ${mails.n}`)

  const dl = await fetch(done.json.order.downloadUrl.replace(ORIGIN, BASE))
  const content = await dl.text()
  check('buyer downloads the file', dl.status === 200 && content === 'SECRET-PLANNER-CONTENT' && String(dl.headers.get('content-disposition')).includes('planner.pdf'))
  const token = String(done.json.order.downloadUrl).split('/api/store-download/')[1]
  const [oid, , sig] = token.split('.')
  check('a tampered link is refused', (await req('GET', `/api/store-download/${oid}.${Date.now() + 1e9}.${sig}`)).status === 403)
  check('an expired link is refused', (await req('GET', `/api/store-download/${oid}.1000.${sig}`)).status === 403)

  const retr = String(done.json.order.retrievalUrl)
  const k = new URL(retr).searchParams.get('k')
  const again = await req('GET', `/api/store/ava-makes/order/${oid}?k=${k}`)
  check('the receipt link issues a fresh download', again.status === 200 && String(again.json.order.downloadUrl).includes('/api/store-download/'))
  check('a wrong access key is refused', (await req('GET', `/api/store/ava-makes/order/${oid}?k=wrong`)).status === 404)

  console.log('\n  Unpaid, cancelled and failed')
  const co2 = await req('POST', '/api/store/ava-makes/checkout', { productId: pid })
  const sid2 = String(co2.json.url).split('/pay/')[1]
  const o2 = (await req('GET', `/api/store/ava-makes/session/${sid2}`)).json.order
  check('an unpaid visitor gets no download', o2.status === 'pending' && o2.downloadUrl === null)
  const unpaidId = (await dbGet<{ id: string }>('SELECT id FROM seller_order WHERE "sessionId" = ?', sid2)).id
  check('guessing the download URL for an unpaid order fails', (await req('GET', `/api/store-download/${unpaidId}.${Date.now() + 1e6}.x`)).status === 403)
  await sendWebhook(HOOK, fake.event('checkout.session.expired', { ...fake.sessions.get(sid2)!, status: 'expired' }, accountId))
  check('a cancelled / expired checkout is marked cancelled', (await req('GET', `/api/store/ava-makes/session/${sid2}`)).json.order.status === 'cancelled')
  const co3 = await req('POST', '/api/store/ava-makes/checkout', { productId: pid })
  const sid3 = String(co3.json.url).split('/pay/')[1]
  await sendWebhook(HOOK, fake.event('checkout.session.async_payment_failed', fake.sessions.get(sid3)!, accountId))
  check('a failed async payment is marked failed', (await req('GET', `/api/store/ava-makes/session/${sid3}`)).json.order.status === 'failed')
  {
    // free products: a stale key from a paid attempt must not break (or complete) that paid order
    const staleKey = 'stalekey_1234567890abcd'
    await req('POST', '/api/store/ava-makes/checkout', { productId: pid, checkoutKey: staleKey })
    await req('PATCH', `/api/seller/products/${pid}`, { priceMinor: 0 }, A)
    await req('POST', '/api/seller/store/publish', undefined, A)
    const fr = await req('POST', '/api/store/ava-makes/checkout', { productId: pid, checkoutKey: 'freekey_1234567890abc', email: 'buyer@example.com', method: 'card' })
    check('a free product is sent to the buyer’s email', fr.status === 200 && fr.json?.emailed === true)
    const fr2 = await req('POST', '/api/store/ava-makes/checkout', { productId: pid, checkoutKey: staleKey, email: 'buyer@example.com', method: 'card' })
    check('a free checkout with a key from an old paid attempt still works', fr2.status === 200 && fr2.json?.emailed === true)
    const stale = await dbGet<{ status: string }>('SELECT status FROM seller_order WHERE "checkoutKey" = ?', staleKey)
    check('the old paid order is not marked paid for free', stale?.status !== 'paid')
    await req('PATCH', `/api/seller/products/${pid}`, { priceMinor: 1200 }, A)
    await req('POST', '/api/seller/store/publish', undefined, A)
  }
  check('an unknown product can’t be bought', (await req('POST', '/api/store/ava-makes/checkout', { productId: 'prd_nope' })).status === 404)
  check('Ava’s product can’t be bought through Ben’s store', (await req('POST', '/api/store/ben-builds/checkout', { productId: pid })).status === 404)

  console.log('\n  Seller sees orders')
  const ords = (await req('GET', '/api/seller/orders', undefined, A)).json.orders
  check('Ava sees her orders', ords.length === 6 && ords.some((o: { status: string }) => o.status === 'paid'))
  check('Ben sees none', (await req('GET', '/api/seller/orders', undefined, B)).json.orders.length === 0)

  console.log('\n  Earnings and withdrawals')
  const paidMinor = ords.filter((o: { status: string }) => o.status === 'paid').reduce((n: number, o: { amountMinor: number }) => n + o.amountMinor, 0)
  const earn = (await req('GET', '/api/seller/earnings', undefined, A)).json
  check('earnings add up the paid orders', earn.totals[0]?.totalMinor === paidMinor && earn.totals[0]?.sales === ords.filter((o: { status: string }) => o.status === 'paid').length, JSON.stringify(earn.totals))
  check('the Stripe balance is shown and withdrawals are on in Sandbox', earn.withdrawals === true && earn.balance?.available[0]?.amountMinor === paidMinor, JSON.stringify(earn.balance))
  check('the seller’s Stripe bank accounts are listed (last 4 only, one default)', earn.banks.length === 2 && earn.banks.filter((b: { isDefault: boolean }) => b.isDefault).length === 1 && !JSON.stringify(earn.banks).match(/\d{8}/))
  check('a bank that isn’t theirs is refused', (await req('POST', '/api/seller/payouts', { currency: earn.totals[0].currency, bankId: 'ba_someone_else' }, A)).status === 400)
  const w = await req('POST', '/api/seller/payouts', { currency: earn.totals[0].currency, bankId: 'ba_test_monzo' }, A)
  check('withdraw goes to the chosen bank', w.status === 200 && fake.calls.some((c) => c.path === '/v1/payouts' && c.method === 'POST' && c.body.destination === 'ba_test_monzo'))
  check('withdraw sends the whole available balance to the bank', w.status === 200 && w.json.payout.amountMinor === paidMinor, JSON.stringify(w.json))
  const twice = await req('POST', '/api/seller/payouts', { currency: earn.totals[0].currency }, A)
  check('nothing left to withdraw afterwards', twice.status === 409)
  const earn2 = (await req('GET', '/api/seller/earnings', undefined, A)).json
  check('the withdrawal is listed and earnings are unchanged', earn2.balance.payouts.length === 1 && earn2.totals[0].totalMinor === paidMinor)
  check('Ben can’t withdraw (no Stripe set up)', (await req('POST', '/api/seller/payouts', { currency: 'gbp' }, B)).status === 409)
  check('earnings include a 30-day chart series', earn2.totals[0].days.length === 30 && earn2.totals[0].days.reduce((n: number, d: { amountMinor: number }) => n + d.amountMinor, 0) === paidMinor)
  check('signed-out visitors can’t see earnings', (await req('GET', '/api/seller/earnings')).status === 401)

  console.log('\n  Restart keeps everything')
  await new Promise<void>((r) => (server.once('exit', () => r()), server.kill('SIGTERM')))
  server = await boot()
  const after = await req('GET', '/api/store/ava-makes')
  check('store is still published after a restart', after.status === 200 && after.json.products[0]?.id === pid)
  check('orders survive a restart', (await req('GET', '/api/seller/orders', undefined, A)).json?.orders?.length === 6)
  const re = await req('GET', `/api/store/ava-makes/order/${oid}?k=${k}`)
  const reDl = await fetch(String(re.json?.order?.downloadUrl).replace(ORIGIN, BASE))
  check('the private file still downloads after a restart', reDl.status === 200 && (await reDl.text()) === 'SECRET-PLANNER-CONTENT')
  check('private files are not under the public static folder', !join(tmp, 'files').includes('dist'))
  const leak = await req('GET', `/${'data/seller-files'}`)
  check('the files folder is not served by URL', leak.status !== 200 || !leak.text.includes('SECRET'))
  console.log('\n  Purchase durability and retries')
  const retryKey = 'retry_test_checkout_001'
  const repeated = await Promise.all([req('POST', '/api/store/ava-makes/checkout', { productId: pid, checkoutKey: retryKey }), req('POST', '/api/store/ava-makes/checkout', { productId: pid, checkoutKey: retryKey })])
  check('concurrent checkout retries share one Stripe session', repeated[0].json?.url === repeated[1].json?.url && repeated.every(r => r.status === 200))
  const reservedSid = String(repeated[0].json.url).split('/pay/')[1]
  const jsonFile = await req('PUT', `/api/seller/products/${pid}/file`, Buffer.from('{"version":2}'), A, { 'content-type': 'application/json', 'x-file-name': 'version.json' })
  check('JSON uploads remain raw files', jsonFile.status === 200 && jsonFile.json.product.file.name === 'version.json')
  await req('DELETE', `/api/seller/products/${pid}`, undefined, A)
  await sendWebhook(HOOK, fake.pay(reservedSid))
  const reservedOrder = (await req('GET', `/api/store/ava-makes/session/${reservedSid}`)).json.order
  check('pending checkout keeps original file after replacement and deletion', (await (await fetch(reservedOrder.downloadUrl.replace(ORIGIN, BASE))).text()) === 'SECRET-PLANNER-CONTENT')
  await req('PUT', '/api/seller/handle', { handle: 'ava-renamed' }, A)
  check('old receipt survives handle change', (await req('GET', `/api/store/ava-makes/order/${oid}?k=${k}`)).status === 200)
  const stablePath = new URL(reservedOrder.retrievalUrl).pathname.replace('/store/', '/api/store/') + new URL(reservedOrder.retrievalUrl).search
  check('permanent purchase URL survives handle change', (await req('GET', stablePath)).json?.order?.status === 'paid')

  const charge = fake.charges.get(`ch_${reservedSid}`)!
  fake.disputes.set('du_test', { id: 'du_test', charge: charge.id, status: 'needs_response' })
  await sendWebhook(HOOK, fake.event('charge.dispute.created', { id: 'du_test' }, accountId))
  check('open dispute suspends download', (await req('GET', stablePath)).json.order.status === 'disputed' && (await fetch(reservedOrder.downloadUrl.replace(ORIGIN, BASE))).status === 403)
  fake.disputes.get('du_test')!.status = 'won'
  await sendWebhook(HOOK, fake.event('charge.dispute.closed', { id: 'du_test' }, accountId))
  check('won dispute restores access', (await req('GET', stablePath)).json.order.status === 'paid')
  await sendWebhook(HOOK, fake.event('charge.dispute.created', { id: 'du_test', status: 'needs_response' }, accountId))
  check('out-of-order dispute event uses current Stripe state', (await req('GET', stablePath)).json.order.status === 'paid')
  charge.amount_refunded = 100
  await sendWebhook(HOOK, fake.event('charge.refunded', charge, accountId))
  await sendWebhook(HOOK, fake.event('checkout.session.completed', fake.sessions.get(reservedSid)!, accountId))
  check('partial refund revokes access and late payment cannot restore it', (await req('GET', stablePath)).json.order.status === 'refunded')

  const ledger = new Database(join(tmp, 'seller.db'))
  const template = ledger.prepare('SELECT * FROM seller_order WHERE id = ?').get(oid) as Record<string, unknown>
  const insert = ledger.prepare(`INSERT INTO seller_order (${Object.keys(template).map(k => '"' + k + '"').join(',')}) VALUES (${Object.keys(template).map(() => '?').join(',')})`)
  for (let i = 0; i < 105; i++) insert.run(...Object.values({ ...template, id: `ord_page_${i}`, sessionId: null, checkoutKey: null }))
  const firstPage = (await req('GET', '/api/seller/orders', undefined, A)).json
  const secondPage = (await req('GET', `/api/seller/orders?offset=${firstPage.nextOffset}`, undefined, A)).json
  check('orders beyond 100 can be retrieved without overlap', firstPage.orders.length === 100 && secondPage.orders.length > 0 && !secondPage.orders.some((o: {id: string}) => firstPage.orders.some((p: {id: string}) => p.id === o.id)))
  ledger.pragma('foreign_keys = ON')
  ledger.prepare('DELETE FROM "user" WHERE email = ?').run('ava@seller.test')
  check('seller closure retains purchase ledger', (ledger.prepare('SELECT COUNT(*) AS n FROM seller_order').get() as {n: number}).n > 100)
  check('seller closure removes public selling access', (await req('GET', '/api/store/ava-renamed')).status === 404)
  check('buyer entitlement survives seller closure', (await req('GET', `/api/store/ava-makes/order/${oid}?k=${k}`)).json?.order?.status === 'paid')
  check('retained data satisfies foreign keys', (ledger.pragma('foreign_key_check') as unknown[]).length === 0)
  ledger.close()

  console.log('\n  Start over (delete an empty store)')
  {
    const benStore = (await req('GET', '/api/seller/store', undefined, B)).json?.store
    check('start over needs the handle typed to confirm', (await req('DELETE', '/api/seller/store', { confirm: 'wrong' }, B)).status === 400)
    check('an empty store can be deleted by its owner', (await req('DELETE', '/api/seller/store', { confirm: benStore?.handle }, B)).status === 200)
    const again = await req('POST', '/api/seller/store', { name: 'Ben Again', handle: 'ben-again' }, B)
    check('…after which the seller has no store and can start again', again.status === 201)
    // give the new store one order (test database only) and try again
    {
      const d = new Database(join(tmp, 'seller.db'))
      d.prepare(`INSERT INTO seller_order (id, "storeId", "productId", "productTitle", "fileId", "fileName", "accountId", "amountMinor", currency, "accessKey", "createdAt", status) VALUES ('ord_startover_test', ?, 'prd_x', 'X', 'fil_x', 'x', 'acct_x', 100, 'gbp', 'k', ?, 'paid')`).run(again.json.store.id, new Date().toISOString())
      d.close()
    }
    check('a store with orders can’t be deleted', (await req('DELETE', '/api/seller/store', { confirm: 'ben-again' }, B)).status === 409)
    check('…and is still there with its order', (await req('GET', '/api/seller/store', undefined, B)).json?.store?.handle === 'ben-again')
  }

  console.log('\n  TikTok by bio code')
  {
    ttBio['benmakes'] = 'Digital planners'
    check('a bad TikTok username is refused', (await req('POST', '/api/seller/tiktok/code', { username: 'no spaces!' }, B)).status === 400)
    const c = await req('POST', '/api/seller/tiktok/code', { username: '@benmakes' }, B)
    check('a code is issued for the username', c.status === 200 && /^DESK-[A-Z2-9]{6}$/.test(c.json?.code) && c.json.username === 'benmakes')
    check('verify before the code is in the bio is refused', (await req('POST', '/api/seller/tiktok/verify', {}, B)).status === 409)
    check('another seller can’t verify Ben’s code', (await req('POST', '/api/seller/tiktok/verify', {}, A)).status !== 200)
    ttBio['benmakes'] = `Digital planners ${c.json.code}`
    const v = await req('POST', '/api/seller/tiktok/verify', {}, B)
    check('with the code in the bio, TikTok connects', v.status === 200 && v.json?.store?.tiktok?.username === 'benmakes', String(v.status))
    check('the store takes the TikTok name and username', v.json?.store?.draft?.name === 'Ben From TikTok' && v.json?.store?.handle === 'benmakes')
    check('the code works once', (await req('POST', '/api/seller/tiktok/verify', {}, B)).status === 410)
  }
} finally {
  await new Promise<void>((r) => (server.once('exit', () => r()), server.kill('SIGTERM')))
  await fake.close()
  ttServer.close()
  rmSync(tmp, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll seller checks passed.')
process.exit(failures ? 1 : 0)
