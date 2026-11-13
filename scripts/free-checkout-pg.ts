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
import { readFileSync, readdirSync } from 'node:fs'
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
  env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: PG, SUPABASE_DB_URL: '', BETTER_AUTH_URL: ORIGIN, BETTER_AUTH_SECRET: 'p'.repeat(64), API_PORT: String(port), MAILBOX_DIR: join(tmp, 'mailbox'), SELLER_FILES_DIR: join(tmp, 'files'), SELLER_MEDIA_DIR: join(tmp, 'media'), SMTP_HOST: '', SMTP_PRESET: '', REQUIRE_EMAIL_VERIFICATION: 'false', EMAIL_ALLOW_TEST_DOMAINS: '1', STRIPE_SECRET_KEY: '', TIKTOK_CLIENT_KEY: '', TIKTOK_CLIENT_SECRET: '', ...(process.env.BAD_RESEND ? { MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_invalid_key_for_test', RESEND_FROM: 'Desknoty <noreply@desknoty.com>' } : {}) },
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
  const claim = await req('POST', `/api/store/${handle}/claim`, { productId: pid, email: buyer, name: 'Real Buyer', clientRef: `pgref_${Date.now()}_abcdefgh` })
  console.log('    claim response:', claim.status, claim.text.slice(0, 200))
  check('claim accepted and the email sent (Postgres)', claim.status === 200 && claim.json?.status === 'sent')
  check('no download link or key in the response', !/download|accessKey|ord_/.test(claim.text))
  const files = readdirSync(join(tmp, 'mailbox')).sort()
  const mail = files.map((f) => JSON.parse(readFileSync(join(tmp, 'mailbox', f), 'utf8'))).filter((m: any) => m.to === buyer).pop()
  const m = /\/claim\/(clm_[a-f0-9]+)\?t=([A-Za-z0-9_-]+)/.exec(mail?.text ?? '')
  check('the email has the claim link and product name', Boolean(m) && String(mail?.subject ?? '').includes('Free planner'))
  const open = await req('POST', `/api/store/${handle}/claim/${m![1]}/open`, { t: m![2] })
  check('opening the link creates the order on Postgres', open.status === 200 && Boolean(open.json?.order?.downloadUrl), open.text.slice(0, 200))
  const dl = await fetch(open.json.order.downloadUrl)
  check('the file downloads', dl.status === 200 && (await dl.text()) === 'FREE-FILE')
  const again = await Promise.all([1, 2].map(() => req('POST', `/api/store/${handle}/claim/${m![1]}/open`, { t: m![2] })))
  check('opening twice at once: one order', again.every((r) => r.json?.order?.id === open.json.order.id) && (await db.query(`SELECT count(*)::int AS n FROM seller_order WHERE "productId" = $1`, [pid])).rows[0].n === 1)
  const errs = log.split('\n').filter((l) => /error|failed|Error/.test(l) && !/RESEND CHECK/.test(l)).slice(0, 10)
  if (errs.length) console.log('    server errors:\n      ' + errs.join('\n      '))
} finally {
  await db.end()
  child.kill('SIGTERM')
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nFree checkout on Postgres passed.')
process.exit(failures ? 1 : 0)
