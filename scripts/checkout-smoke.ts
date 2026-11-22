/**
 * Inline card / wallet checkout (Stripe Payment Element + Express Checkout Element),
 * end to end against the real API server and the local Stripe stand-in. No real
 * publishable key is required: the server side is exercised with PaymentIntents,
 * and the fake stands in for the Stripe API the server talks to.
 *
 *   - £1.00 card purchase: Buy -> inline checkout -> PaymentIntent -> success
 *     webhook -> paid -> download -> exactly one receipt
 *   - double click / duplicate checkout key reuses the same order and intent
 *   - duplicate webhook delivery is acknowledged and changes nothing
 *   - declined card then retry on the same intent succeeds
 *   - authentication required (requires_action) then success
 *   - canceled intent then fresh retry intent succeeds
 *   - wrong amount / currency / account webhook is refused, order stays unpaid
 *   - £0.01 (below the 0.50 card minimum) is rejected with the reason
 *   - browser price tampering is ignored
 *   - free download and Amazon affiliate flows stay preserved
 *
 * Run with: npx tsx scripts/checkout-smoke.ts
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { startFakeStripe } from './fake-stripe.ts'

const tmp = mkdtempSync(join(tmpdir(), 'desknoty-checkout-'))
const PORT = 4500 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = `http://localhost:${PORT}`
const WHSEC = 'whsec_checkout'
const HOOK = `${BASE}/api/stripe/webhook`

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const fake = await startFakeStripe({ webhookUrl: HOOK, webhookSecret: WHSEC })
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: '', SUPABASE_DB_URL: '', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
    SIGNUP_ALLOWLIST: '', PRO_EMAILS: '', ADMIN_EMAILS: '',
    STRIPE_MODE: 'test', STRIPE_TEST_SECRET_KEY: '', STRIPE_TEST_WEBHOOK_SECRET: '',
    BETTER_AUTH_URL: ORIGIN,
    BETTER_AUTH_SECRET: 'c'.repeat(64),
    DATABASE_PATH: join(tmp, 'checkout.db'),
    MAILBOX_DIR: join(tmp, 'mailbox'),
    SELLER_FILES_DIR: join(tmp, 'files'),
    SELLER_MEDIA_DIR: join(tmp, 'media'),
    API_PORT: String(PORT),
    SMTP_HOST: '', SMTP_PRESET: '',
    REQUIRE_EMAIL_VERIFICATION: 'false',
    EMAIL_ALLOW_TEST_DOMAINS: '1',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_TEST_PUBLISHABLE_KEY: 'pk_test_fake',
    STRIPE_WEBHOOK_SECRET: WHSEC,
    STRIPE_API_BASE: fake.url,
    TIKTOK_CLIENT_KEY: '', TIKTOK_CLIENT_SECRET: '',
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

let ip = 0
async function req(method: string, path: string, body?: unknown, cookie = '', headers: Record<string, string> = {}) {
  ip++
  const raw = body instanceof Buffer
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: { origin: ORIGIN, 'x-forwarded-for': `10.7.${ip >> 8}.${ip & 255}`, ...(body === undefined || raw ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ')
  return { status: res.status, json, text, cookies }
}
const db = () => new Database(join(tmp, 'checkout.db'))
const dbGet = <T>(q: string, ...p: unknown[]) => { const d = db(); try { return d.prepare(q).get(...p) as T } finally { d.close() } }
const dbAll = <T>(q: string, ...p: unknown[]) => { const d = db(); try { return d.prepare(q).all(...p) as T[] } finally { d.close() } }
const receipts = (to: string) => {
  try {
    return readdirSync(join(tmp, 'mailbox')).map((f) => JSON.parse(readFileSync(join(tmp, 'mailbox', f), 'utf8')) as { to: string; subject: string; text: string }).filter((m) => m.to === to && /Your download/.test(m.subject))
  } catch { return [] }
}
const wait = async (fn: () => boolean) => { for (let i = 0; i < 80 && !fn(); i++) await new Promise((r) => setTimeout(r, 100)) }
const key = () => crypto.randomUUID().replace(/-/g, '').slice(0, 32)
const FILE = 'CHECKOUT-FILE-' + Date.now()

try {
  const PW = 'a-long-enough-password'
  const A = (await req('POST', '/api/auth/sign-up/email', { name: 'Ava', email: 'ava@co.test', password: PW })).cookies
  const d = db(); d.prepare(`UPDATE "user" SET "emailVerified" = 1, plan = 'pro' WHERE email = 'ava@co.test'`).run(); d.close()
  await req('POST', '/api/seller/store', { name: 'Ava Makes', handle: 'ava-co' }, A)
  const pid = (await req('POST', '/api/seller/products', { title: 'Planner', priceMinor: 100, currency: 'gbp' }, A)).json.product.id
  await req('PUT', `/api/seller/products/${pid}/file`, Buffer.from(FILE), A, { 'content-type': 'application/pdf', 'x-file-name': 'planner.pdf' })
  await req('POST', '/api/seller/store/publish', {}, A)

  // connect Stripe
  const ob = await req('POST', '/api/seller/stripe/onboard', { returnTo: '/app/pro' }, A)
  check('Stripe onboarding link created', ob.status === 200 && String(ob.json?.url).includes('/onboard/acct_'))
  const accountId = [...fake.accounts.keys()][0]
  fake.setAccount(accountId, 'ready')
  const upd = fake.event('account.updated', fake.accounts.get(accountId)!, accountId)
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': upd.header }, body: upd.payload })
  const pub = (await req('GET', '/api/store/ava-co')).json
  check('public store offers Stripe and a publishable key', pub.methods.includes('stripe') && Boolean(pub.stripePk) && Boolean(pub.stripeAccount))
  const offer = pub.products.find((x: { id: string }) => x.id === pid)
  check('product is £1.00', offer?.priceMinor === 100)

  // quote
  const q = await req('POST', '/api/store/ava-co/quote', { productId: pid })
  check('quote total is 100 and card minimum 50', q.json?.quote?.totalMinor === 100 && q.json?.quote?.cardMinimum === 50)

  console.log('\n  £1.00 inline card purchase')
  const k1 = key()
  const co1 = await req('POST', '/api/store/ava-co/checkout', { productId: pid, checkoutKey: k1, email: 'buyer@co.test', inline: true })
  check('inline checkout returns clientSecret, orderUrl, amount, currency', co1.status === 200 && Boolean(co1.json?.clientSecret) && Boolean(co1.json?.orderUrl) && co1.json?.amountMinor === 100 && co1.json?.currency === 'gbp', JSON.stringify(co1.json).slice(0, 200))
  const order1 = await dbGet<{ id: string; sessionId: string; status: string; amountMinor: number; currency: string; buyerEmail: string }>(`SELECT id, "sessionId", status, "amountMinor", currency, "buyerEmail" FROM seller_order WHERE "checkoutKey" = ?`, k1)
  check('order created pending with pi_ session and correct amount', order1?.status === 'pending' && String(order1?.sessionId).startsWith('pi_') && order1?.amountMinor === 100 && order1?.currency === 'gbp')
  const pi1 = fake.intents.get(order1!.sessionId)!
  check('PaymentIntent created on the seller account for 100 gbp with order metadata', pi1?._account === accountId && pi1?.amount === 100 && pi1?.currency === 'gbp' && pi1?.metadata?.desknotyOrderId === order1?.id && pi1?.receipt_email === 'buyer@co.test')
  const orderUrl1 = co1.json.orderUrl
  const access1 = new URL(orderUrl1, ORIGIN).searchParams.get('k')!

  // duplicate checkout key reuses the same order + intent
  const co1b = await req('POST', '/api/store/ava-co/checkout', { productId: pid, checkoutKey: k1, email: 'buyer@co.test', inline: true })
  check('duplicate checkout key returns the same orderUrl', co1b.json?.orderUrl === orderUrl1)
  check('only one order for the key', dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_order WHERE "checkoutKey" = ?`, k1).n === 1)

  // authenticate (requires_action) then still pending
  fake.requireAction(order1!.sessionId)
  const pendAuth = await req('GET', `/api/store/ava-co/order/${order1!.id}?k=${access1}`)
  check('requires_action leaves the order pending, no download', pendAuth.json?.order?.status === 'pending' && pendAuth.json?.order?.downloadUrl === null)

  // success
  const ev1 = fake.succeedIntent(order1!.sessionId, { email: 'buyer@co.test' })
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': ev1.header }, body: ev1.payload })
  await wait(() => receipts('buyer@co.test').length > 0)
  const paid1 = await req('GET', `/api/store/ava-co/order/${order1!.id}?k=${access1}`)
  check('after success the order is paid with a download link', paid1.json?.order?.status === 'paid' && String(paid1.json?.order?.downloadUrl).includes('/api/store-download/'))
  const dl1 = await fetch(String(paid1.json.order.downloadUrl).replace(ORIGIN, BASE))
  check('the buyer downloads the right file', dl1.status === 200 && (await dl1.text()) === FILE)
  check('exactly one receipt for the card order', receipts('buyer@co.test').length === 1)

  // duplicate webhook delivery
  const ev1dup = ev1
  const wdup = await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': ev1dup.header }, body: ev1dup.payload })
  const wdupBody = await wdup.json()
  check('duplicate webhook is acknowledged (duplicate true)', wdup.status === 200 && wdupBody?.duplicate === true)
  check('duplicate webhook changes nothing (still one receipt, one order)', receipts('buyer@co.test').length === 1 && dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_order WHERE "sessionId" = ?`, order1!.sessionId).n === 1)

  console.log('\n  declined card then retry')
  const k2 = key()
  const co2 = await req('POST', '/api/store/ava-co/checkout', { productId: pid, checkoutKey: k2, email: 'decline@co.test', inline: true })
  const order2 = await dbGet<{ id: string; sessionId: string }>(`SELECT id, "sessionId" FROM seller_order WHERE "checkoutKey" = ?`, k2)
  const access2 = new URL(co2.json.orderUrl, ORIGIN).searchParams.get('k')!
  const evFail = fake.failIntent(order2!.sessionId, 'Your card was declined.')
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': evFail.header }, body: evFail.payload })
  const failed = await req('GET', `/api/store/ava-co/order/${order2!.id}?k=${access2}`)
  check('declined card marks the order failed, no download', failed.json?.order?.status === 'failed' && failed.json?.order?.downloadUrl === null)
  // retry on the same intent succeeds
  const ev2 = fake.succeedIntent(order2!.sessionId, { email: 'decline@co.test' })
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': ev2.header }, body: ev2.payload })
  await wait(() => receipts('decline@co.test').length > 0)
  const paid2 = await req('GET', `/api/store/ava-co/order/${order2!.id}?k=${access2}`)
  check('retry after decline succeeds and unlocks the download', paid2.json?.order?.status === 'paid' && String(paid2.json?.order?.downloadUrl).includes('/api/store-download/'))
  check('exactly one receipt despite decline then success', receipts('decline@co.test').length === 1)

  console.log('\n  canceled intent then fresh retry')
  const k3 = key()
  const co3 = await req('POST', '/api/store/ava-co/checkout', { productId: pid, checkoutKey: k3, email: 'cancel@co.test', inline: true })
  const order3 = await dbGet<{ id: string; sessionId: string }>(`SELECT id, "sessionId" FROM seller_order WHERE "checkoutKey" = ?`, k3)
  const oldPi3 = order3!.sessionId
  const access3 = new URL(co3.json.orderUrl, ORIGIN).searchParams.get('k')!
  const evCancel = fake.cancelIntent(order3!.sessionId)
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': evCancel.header }, body: evCancel.payload })
  const cancelled = await req('GET', `/api/store/ava-co/order/${order3!.id}?k=${access3}`)
  check('canceled intent marks the order cancelled, no download', cancelled.json?.order?.status === 'cancelled' && cancelled.json?.order?.downloadUrl === null)
  // fresh retry
  const co3b = await req('POST', '/api/store/ava-co/checkout', { productId: pid, checkoutKey: k3, email: 'cancel@co.test', inline: true })
  const order3b = await dbGet<{ id: string; sessionId: string }>(`SELECT id, "sessionId" FROM seller_order WHERE "checkoutKey" = ?`, k3)
  check('retry after cancel creates a new PaymentIntent', co3b.status === 200 && order3b?.sessionId !== oldPi3 && String(order3b?.sessionId).startsWith('pi_'))
  check('still one order for the key', dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_order WHERE "checkoutKey" = ?`, k3).n === 1)
  const newPi3 = order3b!.sessionId
  const ev3 = fake.succeedIntent(newPi3, { email: 'cancel@co.test' })
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': ev3.header }, body: ev3.payload })
  await wait(() => receipts('cancel@co.test').length > 0)
  const paid3 = await req('GET', `/api/store/ava-co/order/${order3!.id}?k=${access3}`)
  check('retry after cancel succeeds and unlocks the download', paid3.json?.order?.status === 'paid' && String(paid3.json?.order?.downloadUrl).includes('/api/store-download/'))
  check('exactly one receipt after cancel then success', receipts('cancel@co.test').length === 1)

  console.log('\n  wrong amount / currency / account refused')
  const k4 = key()
  const co4 = await req('POST', '/api/store/ava-co/checkout', { productId: pid, checkoutKey: k4, email: 'wrong@co.test', inline: true })
  const order4 = await dbGet<{ id: string; sessionId: string }>(`SELECT id, "sessionId" FROM seller_order WHERE "checkoutKey" = ?`, k4)
  const access4 = new URL(co4.json.orderUrl, ORIGIN).searchParams.get('k')!
  // wrong amount
  const pi4 = fake.intents.get(order4!.sessionId)!
  const evWrongAmt = fake.event('payment_intent.succeeded', { ...pi4, amount_received: 99, status: 'succeeded', receipt_email: 'wrong@co.test' }, accountId)
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': evWrongAmt.header }, body: evWrongAmt.payload })
  const afterWrongAmt = await req('GET', `/api/store/ava-co/order/${order4!.id}?k=${access4}`)
  check('wrong amount leaves the order unpaid', afterWrongAmt.json?.order?.status === 'pending' && afterWrongAmt.json?.order?.downloadUrl === null)
  // wrong currency
  const evWrongCur = fake.event('payment_intent.succeeded', { ...pi4, amount_received: 100, currency: 'usd', status: 'succeeded', receipt_email: 'wrong@co.test' }, accountId)
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': evWrongCur.header }, body: evWrongCur.payload })
  const afterWrongCur = await req('GET', `/api/store/ava-co/order/${order4!.id}?k=${access4}`)
  check('wrong currency leaves the order unpaid', afterWrongCur.json?.order?.status === 'pending' && afterWrongCur.json?.order?.downloadUrl === null)
  // wrong account
  const evWrongAcct = fake.event('payment_intent.succeeded', { ...pi4, amount_received: 100, status: 'succeeded', receipt_email: 'wrong@co.test' }, 'acct_other')
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': evWrongAcct.header }, body: evWrongAcct.payload })
  const afterWrongAcct = await req('GET', `/api/store/ava-co/order/${order4!.id}?k=${access4}`)
  check('wrong account leaves the order unpaid', afterWrongAcct.json?.order?.status === 'pending' && afterWrongAcct.json?.order?.downloadUrl === null)
  // correct success
  const ev4 = fake.succeedIntent(order4!.sessionId, { email: 'wrong@co.test' })
  await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': ev4.header }, body: ev4.payload })
  await wait(() => receipts('wrong@co.test').length > 0)
  const paid4 = await req('GET', `/api/store/ava-co/order/${order4!.id}?k=${access4}`)
  check('correct success afterwards pays the order', paid4.json?.order?.status === 'paid' && String(paid4.json?.order?.downloadUrl).includes('/api/store-download/'))

  console.log('\n  £0.01 minimum price')
  const pid2 = (await req('POST', '/api/seller/products', { title: 'Tiny', priceMinor: 1, currency: 'gbp' }, A)).json.product.id
  await req('PUT', `/api/seller/products/${pid2}/file`, Buffer.from('TINY'), A, { 'content-type': 'application/pdf', 'x-file-name': 'tiny.pdf' })
  await req('POST', '/api/seller/store/publish', {}, A)
  const q2 = await req('POST', '/api/store/ava-co/quote', { productId: pid2 })
  check('quote total is 1 with card minimum 50', q2.json?.quote?.totalMinor === 1 && q2.json?.quote?.cardMinimum === 50)
  const coMin = await req('POST', '/api/store/ava-co/checkout', { productId: pid2, checkoutKey: key(), email: 'tiny@co.test', inline: true })
  check('£0.01 checkout is refused with the minimum message', coMin.status === 409 && /0\.50/.test(String(coMin.json?.error ?? '')), JSON.stringify(coMin.json))
  const ordersTiny = dbAll<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_order WHERE "productId" = ?`, pid2)
  check('no order created for the £0.01 product', (ordersTiny[0]?.n ?? 0) === 0)

  console.log('\n  browser price tampering ignored')
  const tamper = await req('POST', '/api/store/ava-co/checkout', { productId: pid, checkoutKey: key(), email: 't@co.test', priceMinor: 1, amountMinor: 1, inline: true })
  check('a price sent by the browser is ignored (still 100)', tamper.status === 200 && tamper.json?.amountMinor === 100)

  console.log('\n  free download and Amazon affiliate preserved')
  const freeId = (await req('POST', '/api/seller/products', { title: 'Free sampler', priceMinor: 0, currency: 'gbp' }, A)).json.product.id
  await req('PUT', `/api/seller/products/${freeId}/file`, Buffer.from('FREE'), A, { 'content-type': 'application/pdf', 'x-file-name': 'free.pdf' })
  await req('POST', '/api/seller/store/publish', {}, A)
  const freeCo = await req('POST', '/api/store/ava-co/checkout', { productId: freeId, checkoutKey: key(), email: 'free@co.test', inline: true })
  check('free product checkout returns use_claim', freeCo.status === 409 && freeCo.json?.code === 'use_claim')
  const amazonUrl = 'https://www.amazon.co.uk/dp/B0C1ABCDEF?tag=ava-21'
  const aff = (await req('POST', '/api/seller/products', { title: 'Amazon pick', priceMinor: 0, currency: 'gbp' }, A)).json.product
  const affRev = (await req('GET', '/api/seller/store', undefined, A)).json.store.products.find((p: { id: string }) => p.id === aff.id).revision
  const affPatch = await req('PATCH', `/api/seller/products/${aff.id}`, { revision: affRev, extras: { productType: 'affiliate', affiliate: { url: amazonUrl } } }, A)
  await req('POST', '/api/seller/store/publish', {}, A)
  const affCo = await req('POST', '/api/store/ava-co/checkout', { productId: aff.id, checkoutKey: key(), email: 'aff@co.test', inline: true })
  check('Amazon affiliate checkout is refused (409)', affCo.status === 409)

  // final counts
  const paidCount = dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_order WHERE "storeId" = (SELECT id FROM seller_store WHERE handle = 'ava-co') AND status = 'paid'`).n
  check('at least the four successful card orders are paid', paidCount >= 4)
} finally {
  server.kill('SIGTERM')
  await fake.close()
  try { rmSync(tmp, { recursive: true, force: true }) } catch { /* windows file lock */ }
}
console.log(failures ? `\n${failures} checkout check(s) failed.` : '\nAll checkout checks passed.')
process.exit(failures ? 1 : 0)