/**
 * PayPal (Sandbox stand-in) and bank transfer, end to end against the real API
 * server on an empty SQLite database. Stripe is a stand-in too and stays as it is.
 *
 *   - a seller without Stripe can sell by bank transfer and PayPal
 *   - bank transfer: pending order with a unique reference; "I've paid" never
 *     unlocks; only the seller's confirmation does, once; receipt once
 *   - PayPal: paid only after the server verifies the capture with PayPal
 *     (order id, seller account, amount, currency); wrong amount or payee
 *     refused; retries, repeat returns and duplicate webhooks change nothing
 *   - sellers only see and change their own settings and orders
 *
 * Run with: npm run test:payments
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { startFakeStripe } from './fake-stripe.ts'
import { startFakePaypal } from './fake-paypal.ts'

const tmp = mkdtempSync(join(tmpdir(), 'desknoty-pay-'))
const PORT = 4300 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = `http://localhost:${PORT}`
let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const fake = await startFakeStripe({ webhookUrl: `${BASE}/api/stripe/webhook`, webhookSecret: 'whsec_pay' })
const pp = await startFakePaypal({ clientId: 'pp-client', secret: 'pp-secret' })
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: '', SUPABASE_DB_URL: '', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
    SIGNUP_ALLOWLIST: '', PRO_EMAILS: '', ADMIN_EMAILS: '',
    STRIPE_MODE: 'test', STRIPE_TEST_SECRET_KEY: '', STRIPE_TEST_WEBHOOK_SECRET: '',
    BETTER_AUTH_URL: ORIGIN,
    BETTER_AUTH_SECRET: 'p'.repeat(64),
    DATABASE_PATH: join(tmp, 'pay.db'),
    MAILBOX_DIR: join(tmp, 'mailbox'),
    SELLER_FILES_DIR: join(tmp, 'files'),
    SELLER_MEDIA_DIR: join(tmp, 'media'),
    API_PORT: String(PORT),
    SMTP_HOST: '', SMTP_PRESET: '',
    REQUIRE_EMAIL_VERIFICATION: 'false',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_pay',
    STRIPE_API_BASE: fake.url,
    PAYPAL_CLIENT_ID: 'pp-client',
    PAYPAL_CLIENT_SECRET: 'pp-secret',
    PAYPAL_WEBHOOK_ID: 'WH-TEST',
    PAYPAL_API_BASE: pp.url,
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
    headers: { origin: ORIGIN, 'x-forwarded-for': `10.9.${ip >> 8}.${ip & 255}`, ...(body === undefined || raw ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ')
  return { status: res.status, json, cookies }
}
const db = () => new Database(join(tmp, 'pay.db'))
const dbGet = <T>(q: string, ...p: unknown[]) => { const d = db(); try { return d.prepare(q).get(...p) as T } finally { d.close() } }
const receipts = (to: string) => {
  try {
    return readdirSync(join(tmp, 'mailbox')).map((f) => JSON.parse(readFileSync(join(tmp, 'mailbox', f), 'utf8')) as { to: string; subject: string; text: string }).filter((m) => m.to === to && /Your download/.test(m.subject))
  } catch { return [] }
}
const wait = async (fn: () => boolean) => { for (let i = 0; i < 50 && !fn(); i++) await new Promise((r) => setTimeout(r, 100)) }
const key = () => crypto.randomUUID()

try {
  const PW = 'a-long-enough-password'
  const A = (await req('POST', '/api/auth/sign-up/email', { name: 'Ava', email: 'ava@pay.test', password: PW })).cookies
  const B = (await req('POST', '/api/auth/sign-up/email', { name: 'Ben', email: 'ben@pay.test', password: PW })).cookies
  { const d = db(); d.prepare(`UPDATE "user" SET "emailVerified" = 1, plan = 'pro' WHERE email IN ('ava@pay.test','ben@pay.test')`).run(); d.close() }

  console.log('\n  A seller with no Stripe account')
  await req('POST', '/api/seller/store', { name: 'Ava Makes', handle: 'ava-pay' }, A)
  await req('POST', '/api/seller/store', { name: 'Ben Builds', handle: 'ben-pay' }, B)
  const pid = (await req('POST', '/api/seller/products', { title: 'Planner', priceMinor: 1250, currency: 'gbp' }, A)).json.product.id
  const FILE = 'PAY-TEST-FILE-' + Date.now()
  await req('PUT', `/api/seller/products/${pid}/file`, Buffer.from(FILE), A, { 'content-type': 'application/pdf', 'x-file-name': 'planner.pdf' })
  await req('POST', '/api/seller/store/publish', {}, A)
  let pub = (await req('GET', '/api/store/ava-pay')).json
  check('with nothing set up, the store shows no way to pay', pub.checkoutReady === false && pub.methods.length === 0)
  check('Stripe checkout is refused while Stripe isn’t connected', (await req('POST', '/api/store/ava-pay/checkout', { productId: pid, checkoutKey: key() })).status === 409)

  console.log('\n  Free products')
  const freeId = (await req('POST', '/api/seller/products', { title: 'Free sampler', priceMinor: 0, currency: 'gbp' }, A)).json.product.id
  await req('PUT', `/api/seller/products/${freeId}/file`, Buffer.from('FREE-FILE'), A, { 'content-type': 'application/pdf', 'x-file-name': 'free.pdf' })
  await req('POST', '/api/seller/store/publish', {}, A)
  const freePub = (await req('GET', '/api/store/ava-pay')).json.products.find((x: { id: string }) => x.id === freeId)
  check('a price of 0 is allowed and the free product goes on sale', freePub?.priceMinor === 0)
  const fk = key()
  check('a free product needs the buyer’s email', (await req('POST', '/api/store/ava-pay/checkout', { productId: freeId, checkoutKey: key() })).status === 400)
  const free1 = await req('POST', '/api/store/ava-pay/checkout', { productId: freeId, checkoutKey: fk, email: 'free-buyer@example.com' })
  const free2 = await req('POST', '/api/store/ava-pay/checkout', { productId: freeId, checkoutKey: fk, email: 'free-buyer@example.com' })
  check('getting a free product needs no payment and sends it by email', free1.status === 200 && free1.json.emailed === true && !JSON.stringify(free1.json).includes('/api/store-download/'))
  await new Promise((r) => setTimeout(r, 1500))
  const mails = receipts('free-buyer@example.com')
  check('pressing it twice sends one email', free2.status === 200 && mails.length === 1)
  const link = mails[0]?.text.match(/https?:\/\/\S+\/order\/\S+/)?.[0]
  check('the email holds the download link', Boolean(link))

  console.log('\n  Payment settings stay private and per seller')
  check('turning bank transfer on without details is refused', (await req('PUT', '/api/seller/payments', { bank: { enabled: true } }, A)).status === 400)
  check('a malformed sort code is refused', (await req('PUT', '/api/seller/payments', { bank: { enabled: true, accountName: 'Ava', sortCode: '12-34', accountNumber: '12345678' } }, A)).status === 400)
  const saved = await req('PUT', '/api/seller/payments', { bank: { enabled: true, accountName: 'Ava Makes Ltd', sortCode: '123456', accountNumber: '12345678', instructions: 'Thanks!' } }, A)
  check('Ava saves her bank details', saved.status === 200 && saved.json.store.payouts.methods.includes('bank') && saved.json.store.payouts.payments.bank.sortCode === '12-34-56')
  check('Ben does not see Ava’s bank details', (await req('GET', '/api/seller/payments', undefined, B)).json.payments.bank.accountNumber === '')
  check('an anonymous visitor can’t read payment settings', (await req('GET', '/api/seller/payments')).status === 401)
  pub = (await req('GET', '/api/store/ava-pay')).json
  check('the public store offers bank transfer and nothing else', pub.checkoutReady === true && JSON.stringify(pub.methods) === '["bank"]')
  check('the public store never shows bank details', !JSON.stringify(pub).includes('12345678'))

  console.log('\n  Bank transfer')
  check('bank checkout needs the buyer’s email', (await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'bank', checkoutKey: key() })).status === 400)
  const bk = key()
  const b1 = await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'bank', checkoutKey: bk, email: 'bank-buyer@pay.test', payerName: 'Jo Buyer', payerBank: 'Monzo' })
  const b2 = await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'bank', checkoutKey: bk, email: 'bank-buyer@pay.test' })
  const bo = b1.json?.order
  check('bank checkout creates a pending order with amount, details and a reference', b1.status === 200 && bo?.status === 'pending' && bo.method === 'bank' && /^DK-[A-Z2-9]{8}$/.test(bo.bank?.reference) && bo.bank.accountNumber === '12345678' && bo.amountMinor === 1250, JSON.stringify(b1.json).slice(0, 200))
  check('the buyer’s bank shows on their order page', b1.json?.order?.payerBank === 'Monzo')
  const pubBanks = (await req('GET', '/api/store/ava-pay')).json.banks
  check('the store lists the seller’s bank accounts by name and last 4 digits only', Array.isArray(pubBanks) && pubBanks.length >= 1 && pubBanks[0].last4.length === 4 && !JSON.stringify(pubBanks).includes('12345678'))
  check('a bank account the seller doesn’t have is refused', (await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'bank', checkoutKey: key(), email: 'x@pay.test', bankIndex: 9 })).status === 400)
  const pick = await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'bank', checkoutKey: key(), email: 'pick@pay.test', bankIndex: pubBanks[0].index })
  check('the chosen account’s details are shown to pay into', pick.status === 200 && String(pick.json?.order?.bank?.accountNumber ?? '').endsWith(pubBanks[0].last4))
  check('a retried bank checkout returns the same order', b2.json?.order?.id === bo.id && dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_order WHERE "checkoutKey" = ?`, bk).n === 1)
  const k = new URL(b1.json.orderUrl, ORIGIN).searchParams.get('k')!
  check('the unpaid bank order has no download link', bo.downloadUrl === null)
  const claimed = await req('POST', `/api/store/ava-pay/order/${bo.id}/claim`, { k })
  check('“I’ve paid” is recorded but does not unlock the download', claimed.json?.order?.status === 'pending' && claimed.json.order.downloadUrl === null && Boolean(claimed.json.order.buyerClaimedAt))
  check('“I’ve paid” with a wrong key is refused', (await req('POST', `/api/store/ava-pay/order/${bo.id}/claim`, { k: 'wrong' })).status === 404)
  check('the buyer still can’t download after claiming', (await req('GET', `/api/store/ava-pay/order/${bo.id}?k=${k}`)).json.order.downloadUrl === null)
  const sellerOrders = (await req('GET', '/api/seller/orders', undefined, A)).json.orders
  const so = sellerOrders.find((o: { id: string }) => o.id === bo.id)
  check('Ava’s Orders show the method, reference and the buyer’s claim', so?.method === 'bank' && so.reference === bo.bank.reference && Boolean(so.buyerClaimedAt))
  check('Ben can’t confirm Ava’s bank order', (await req('POST', `/api/seller/orders/${bo.id}/confirm`, {}, B)).status === 404)
  check('the seller sees who paid and from which bank', sellerOrders.some((o: { payerName: string; payerBank: string }) => o.payerName === 'Jo Buyer' && o.payerBank === 'Monzo'))
  check('Ben sees none of Ava’s orders', (await req('GET', '/api/seller/orders', undefined, B)).json.orders.length === 0)
  const c1 = await req('POST', `/api/seller/orders/${bo.id}/confirm`, {}, A)
  const c2 = await req('POST', `/api/seller/orders/${bo.id}/confirm`, {}, A)
  check('Ava confirms the transfer arrived', c1.json?.order?.status === 'paid' && c2.json?.order?.status === 'paid')
  const paidBank = (await req('GET', `/api/store/ava-pay/order/${bo.id}?k=${k}`)).json.order
  const dl = await fetch(String(paidBank.downloadUrl).replace(ORIGIN, BASE))
  check('after confirmation the buyer downloads the right file', dl.status === 200 && (await dl.text()) === FILE)
  await wait(() => receipts('bank-buyer@pay.test').length > 0)
  check('exactly one receipt for the bank order, despite two confirmations', receipts('bank-buyer@pay.test').length === 1)
  check('the receipt names the amount paid', receipts('bank-buyer@pay.test')[0]?.text.includes('£12.50'))

  const ck = key()
  const toCancel = (await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'bank', checkoutKey: ck, email: 'cancel@pay.test' })).json.order
  check('a seller can cancel an unpaid bank order', (await req('POST', `/api/seller/orders/${toCancel.id}/cancel`, {}, A)).json?.order?.status === 'cancelled')
  check('a cancelled bank order can’t be confirmed', (await req('POST', `/api/seller/orders/${toCancel.id}/confirm`, {}, A)).status === 409)

  console.log('\n  PayPal (Sandbox stand-in)')
  check('turning PayPal on without an email is refused', (await req('PUT', '/api/seller/payments', { paypal: { enabled: true } }, A)).status === 400)
  await req('PUT', '/api/seller/payments', { paypal: { enabled: true, email: 'ava-paypal@pay.test' } }, A)
  pub = (await req('GET', '/api/store/ava-pay')).json
  check('the store now offers PayPal and bank transfer', JSON.stringify(pub.methods) === '["paypal","bank"]')
  const pk = key()
  const p1 = await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'paypal', checkoutKey: pk })
  const p2 = await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'paypal', checkoutKey: pk })
  check('PayPal checkout returns a PayPal approval link', p1.status === 200 && String(p1.json?.url).startsWith(`${pp.url}/approve/`), JSON.stringify(p1.json))
  check('a retried PayPal checkout reuses the same order and PayPal order', p1.json?.url === p2.json?.url && pp.orders.size === 1 && dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_order WHERE "checkoutKey" = ?`, pk).n === 1)
  const ppId = String(p1.json.url).split('/').pop()!
  const ppOrder = pp.orders.get(ppId)!
  check('the PayPal order pays Ava’s PayPal account, exact amount', ppOrder.purchase_units[0].payee.email_address === 'ava-paypal@pay.test' && ppOrder.purchase_units[0].amount.value === '12.50' && ppOrder.purchase_units[0].amount.currency_code === 'GBP')
  const ret = new URL(ppOrder._return)
  const oid = ret.searchParams.get('paypal_order')!
  const pkey = ret.searchParams.get('k')!
  const early = await req('POST', '/api/store/ava-pay/paypal/confirm', { orderId: oid, k: pkey })
  check('coming back before paying leaves the order pending, no download', early.json?.order?.status === 'pending' && early.json.order.downloadUrl === null)
  check('confirming with a wrong key is refused', (await req('POST', '/api/store/ava-pay/paypal/confirm', { orderId: oid, k: 'nope' })).status === 404)
  pp.approve(ppId, 'pp-buyer@pay.test')
  const [r1, r2] = await Promise.all([
    req('POST', '/api/store/ava-pay/paypal/confirm', { orderId: oid, k: pkey }),
    req('POST', '/api/store/ava-pay/paypal/confirm', { orderId: oid, k: pkey }),
  ])
  check('after paying on PayPal, the server-verified order is paid', r1.json?.order?.status === 'paid' && r2.json?.order?.status === 'paid', `${r1.json?.order?.status}/${r2.json?.order?.status}`)
  check('the payment was captured exactly once', pp.captures === 1, String(pp.captures))
  const ppDl = await fetch(String(r1.json.order.downloadUrl).replace(ORIGIN, BASE))
  check('the PayPal buyer downloads the right file', ppDl.status === 200 && (await ppDl.text()) === FILE)
  const hook = (sig: string, type = 'CHECKOUT.ORDER.APPROVED', id = 'WH-EVT-1') =>
    req('POST', '/api/paypal/webhook', { id, event_type: type, resource: { id: ppId, supplementary_data: { related_ids: { order_id: ppId } } } }, '', { 'paypal-transmission-sig': sig, 'paypal-transmission-id': 't', 'paypal-transmission-time': 'now', 'paypal-cert-url': 'x', 'paypal-auth-algo': 'SHA256withRSA' })
  check('a PayPal webhook with a bad signature is refused', (await hook('bad')).status === 400)
  check('a duplicate PayPal notification is accepted', (await hook('good-sig')).status === 200 && (await hook('good-sig', 'PAYMENT.CAPTURE.COMPLETED', 'WH-EVT-2')).status === 200)
  await wait(() => receipts('pp-buyer@pay.test').length > 0)
  await new Promise((r) => setTimeout(r, 400))
  check('exactly one receipt for the PayPal order (two returns, two webhooks)', receipts('pp-buyer@pay.test').length === 1, String(receipts('pp-buyer@pay.test').length))
  check('the PayPal order shows its method to the seller', (await req('GET', '/api/seller/orders', undefined, A)).json.orders.some((o: { id: string; method: string; status: string }) => o.id === oid && o.method === 'paypal' && o.status === 'paid'))

  console.log('\n  PayPal says something is wrong: never paid')
  for (const [label, change] of [['a different amount', { value: '1.00' }], ['a different PayPal account', { payee: 'attacker@pay.test' }]] as const) {
    const tk = key()
    const t = await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'paypal', checkoutKey: tk })
    const tid = String(t.json.url).split('/').pop()!
    const tr = new URL(pp.orders.get(tid)!._return)
    pp.tamper(tid, change)
    pp.approve(tid)
    const r = await req('POST', '/api/store/ava-pay/paypal/confirm', { orderId: tr.searchParams.get('paypal_order'), k: tr.searchParams.get('k') })
    check(`PayPal reporting ${label} leaves the order unpaid, no download`, r.json?.order?.status === 'pending' && r.json.order.downloadUrl === null)
  }

  console.log('\n  Stripe keeps working alongside')
  check('Stripe can be switched off by the seller', (await req('PUT', '/api/seller/payments', { stripe: { enabled: false } }, A)).json.store.payouts.payments.stripe.enabled === false)
  check('Stripe checkout is refused when the seller switched it off', (await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'stripe', checkoutKey: key() })).status === 409)
  check('an unknown payment method is refused', (await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'crypto', checkoutKey: key() })).status === 400)
  check('a PayPal checkout key can’t be replayed as a bank order', (await req('POST', '/api/store/ava-pay/checkout', { productId: pid, method: 'bank', checkoutKey: pk, email: 'x@pay.test' })).status === 409)
} finally {
  server.kill('SIGTERM')
  await fake.close()
  await pp.close()
  rmSync(tmp, { recursive: true, force: true })
}
console.log(failures ? `\n${failures} payment check(s) failed.` : '\nAll payment checks passed.')
process.exit(failures ? 1 : 0)
