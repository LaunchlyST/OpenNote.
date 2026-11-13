/**
 * Free checkout end to end against a real Postgres (production uses Postgres;
 * the other suites use SQLite). Prints the order, the receipt in the outbox,
 * and any server errors.
 *
 *   PG_URL=postgres://postgres@127.0.0.1:55432/dk npx tsx scripts/free-checkout-pg.ts
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import pg from 'pg'
import { readFileSync } from 'node:fs'
const await_read = (p: string) => readFileSync(p, 'utf8')

const PG = process.env.PG_URL ?? 'postgres://postgres@127.0.0.1:55432/dk'
const tmp = mkdtempSync(join(tmpdir(), 'dk-free-pg-'))
const port = await new Promise<number>((r) => { const s = createServer(); s.listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => r(p)) }) })
const BASE = `http://127.0.0.1:${port}`
const ORIGIN = `http://localhost:${port}`

let failures = 0
const check = (label: string, ok: boolean, detail = '') => { if (ok) console.log(`  PASS  ${label}`); else { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) } }

let log = ''
const child = spawn(process.execPath, ['--import', 'tsx', ...(process.env.PRELOAD ? ['--import', process.env.PRELOAD] : []), 'server/index.ts'], {
  env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: PG, SUPABASE_DB_URL: '', BETTER_AUTH_URL: ORIGIN, BETTER_AUTH_SECRET: 'p'.repeat(64), API_PORT: String(port), MAILBOX_DIR: join(tmp, 'mailbox'), SELLER_FILES_DIR: join(tmp, 'files'), SELLER_MEDIA_DIR: join(tmp, 'media'), SMTP_HOST: '', SMTP_PRESET: '', REQUIRE_EMAIL_VERIFICATION: 'false', STRIPE_SECRET_KEY: '', TIKTOK_CLIENT_KEY: '', TIKTOK_CLIENT_SECRET: '', ...(process.env.BAD_RESEND ? { MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_invalid_key_for_test', RESEND_FROM: 'Desknoty <noreply@desknoty.com>' } : {}) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout!.on('data', (d) => (log += d))
child.stderr!.on('data', (d) => (log += d))
await new Promise<void>((res, rej) => { const t = setInterval(() => log.includes('listening') && (clearInterval(t), res()), 100); child.once('exit', (c) => rej(new Error(`server exited ${c}\n${log}`))) })

const db = new pg.Client({ connectionString: PG })
await db.connect()
let cookie = ''
async function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const raw = body instanceof Buffer
  const r = await fetch(BASE + path, { method, headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}), ...(body === undefined || raw ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) })
  const set = r.headers.getSetCookie?.() ?? []
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ')
  const text = await r.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: r.status, json, text }
}

try {
  const email = `seller${Date.now()}@pg.test`
  await req('POST', '/api/auth/sign-up/email', { name: 'Ava', email, password: 'a-long-enough-password' })
  await db.query(`UPDATE "user" SET plan = 'pro', "emailVerified" = true WHERE email = $1`, [email])
  await req('POST', '/api/auth/sign-in/email', { email, password: 'a-long-enough-password' })
  const handle = `pg-free-${Date.now() % 100000}`
  const st = await req('POST', '/api/seller/store', { name: 'PG Free', handle })
  check('store created', st.status === 201 || st.status === 200, st.text.slice(0, 200))
  const p = await req('POST', '/api/seller/products', { title: 'Free planner', priceMinor: 0, currency: 'gbp' })
  const pid = p.json?.product?.id
  await req('PUT', `/api/seller/products/${pid}/file`, Buffer.from('FREE-FILE'), { 'content-type': 'application/pdf', 'x-file-name': 'free.pdf' })
  const pub = await req('POST', '/api/seller/store/publish')
  check('store published', pub.status === 200, pub.text.slice(0, 200))
  cookie = ''
  const buyer = 'buyer.real@pg.test'
  const co = await req('POST', `/api/store/${handle}/checkout`, { productId: pid, checkoutKey: `pgkey_${Date.now()}_abcdefgh`, email: buyer, method: 'stripe' })
  console.log('    checkout response:', co.status, co.text.slice(0, 300))
  const o = (await db.query(`SELECT id, status, method, "buyerEmail", "emailedAt", "receiptId" FROM seller_order WHERE "productId" = $1`, [pid])).rows
  console.log('    orders:', JSON.stringify(o))
  const mail = (await db.query(`SELECT id, kind, status, "lastError" FROM email_outbox WHERE recipient = $1 ORDER BY id DESC`, [buyer])).rows
  console.log('    outbox:', JSON.stringify(mail))
  const bad = Boolean(process.env.BAD_RESEND)
  check('the download is handed over on the page right away', Boolean(co.json?.order?.downloadUrl) && Boolean(co.json?.orderUrl))
  if (!bad) {
    check('"sent" only after the provider accepted it', co.json?.emailStatus === 'sent' && mail[0]?.status === 'sent')
    // the buyer's link: no account, just the order's private key
    const link = co.json.orderUrl as string
    const k = new URL(link, BASE).searchParams.get('k')!
    const view = await req('GET', `/api/store/${handle}/order/${co.json.order.id}?k=${encodeURIComponent(k)}`)
    check('the buyer’s order link works without signing in', view.status === 200 && view.json?.order?.status === 'paid')
    const dl = await fetch(BASE + new URL(view.json.order.downloadUrl, BASE).pathname + new URL(view.json.order.downloadUrl, BASE).search)
    check('the download link returns the file', dl.status === 200 && (await dl.text()) === 'FREE-FILE')
    check('a wrong key is refused', (await req('GET', `/api/store/${handle}/order/${co.json.order.id}?k=wrong`)).status === 404)
    // resend: same order, rate limited
    const r1 = await req('POST', `/api/store/${handle}/order/${co.json.order.id}/resend`, { k })
    check('resend sends the same order’s email again', r1.status === 200 && r1.json?.emailStatus === 'sent' && r1.json?.to === 'b***@pg.test')
    const r2 = await req('POST', `/api/store/${handle}/order/${co.json.order.id}/resend`, { k })
    check('a second resend within a minute is refused', r2.status === 429)
    const parallel = await Promise.all([1, 2, 3].map(() => req('POST', `/api/store/${handle}/order/${co.json.order.id}/resend`, { k })))
    check('parallel resends can’t get around the limit', parallel.every((r) => r.status === 429))
    check('resend needs the order key', (await req('POST', `/api/store/${handle}/order/${co.json.order.id}/resend`, { k: 'nope' })).status === 404)
    // The live situation: an order that is paid but was never emailed, checked out again with the same key.
    const key2 = `pgkey_reuse_${Date.now()}_abcdefgh`
    const first = await req('POST', `/api/store/${handle}/checkout`, { productId: pid, checkoutKey: key2, email: 'again@pg.test', method: 'stripe' })
    await db.query(`UPDATE seller_order SET "emailedAt" = NULL, "receiptId" = NULL WHERE id = $1`, [first.json.order.id])
    const again = await req('POST', `/api/store/${handle}/checkout`, { productId: pid, checkoutKey: key2, email: 'again@pg.test', method: 'stripe' })
    check('a paid but never-emailed order gets its email on the next checkout', again.json?.emailStatus === 'sent' && again.json?.order?.id === first.json.order.id)
    await db.query(`DELETE FROM seller_order WHERE id = $1`, [first.json.order.id])
    const orders = (await db.query(`SELECT count(*)::int AS n FROM seller_order WHERE "productId" = $1`, [pid])).rows[0].n
    check('resending never creates another order', orders === 1)
    const sent = (await db.query(`SELECT count(*)::int AS n FROM email_outbox WHERE recipient = $1 AND kind = 'order-receipt' AND status = 'sent'`, [buyer])).rows[0].n
    check('two receipts sent in total (checkout + one resend)', sent === 2)
    const files = (await import('node:fs')).readdirSync(join(tmp, 'mailbox'))
    const body = files.map((f) => (await_read(join(tmp, 'mailbox', f)))).join('\n')
    check('the email has the product name and the secure link', body.includes('Free planner') && body.includes(`/order/${co.json.order.id}?k=`))
  } else {
    check('a refused key is reported as failed, not sent', co.json?.emailStatus === 'failed' && co.json?.emailed === false && Boolean(co.json?.emailError))
    check('the failure is recorded for retry', mail[0]?.status === 'failed' && /Resend 40[13]/.test(String(mail[0]?.lastError)))
  }
  const errs = log.split('\n').filter((l) => /error|failed|Error/.test(l)).slice(0, 15)
  if (errs.length) console.log('    server errors:\n      ' + errs.join('\n      '))
} finally {
  await db.end()
  child.kill('SIGTERM')
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nFree checkout on Postgres passed.')
process.exit(failures ? 1 : 0)
