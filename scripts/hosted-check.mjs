// Checks a hosted Desknoty API end to end (no local stand-ins).
// Usage: node scripts/hosted-check.mjs https://<ref>.supabase.co/functions/v1
const API = (process.argv[2] ?? '').replace(/\/+$/, '')
if (!API) throw new Error('usage: hosted-check.mjs <api base>')
const ORIGIN = 'https://desknoty.com'
let failed = 0
const ok = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++ }
async function call(method, path, { token, body, headers = {} } = {}) {
  const h = { Origin: ORIGIN, ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (body !== undefined && !(body instanceof Uint8Array)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body) }
  const r = await fetch(API + path, { method, headers: h, body, redirect: 'manual' })
  let data = null
  try { data = await r.clone().json() } catch { /* not json */ }
  return { status: r.status, data, headers: r.headers }
}
const stamp = Date.now().toString(36)
async function seller(tag) {
  const email = `hosted-${tag}-${stamp}@example.com`
  const r = await call('POST', '/api/auth/sign-up/email', { body: { email, password: `Pw-${stamp}-${tag}-Long!9`, name: `Hosted ${tag}` } })
  const token = r.headers.get('set-auth-token')
  ok(r.status === 200 && Boolean(token), `${tag}: sign-up returns a bearer session (HTTP ${r.status})`)
  const s = await call('GET', '/api/auth/get-session', { token })
  ok(s.data?.user?.email === email, `${tag}: session works cross-site with the bearer token`)
  return { email, token }
}

console.log(`Hosted checks against ${API}`)
const cors = await call('OPTIONS', '/api/seller/store', { headers: { 'Access-Control-Request-Method': 'PUT' } })
ok(cors.status === 204 && cors.headers.get('access-control-allow-origin') === ORIGIN, 'CORS allows desknoty.com')
ok((await call('GET', '/api/seller/store')).status === 401, 'seller API refuses anonymous requests')

const a = await seller('a')
const b = await seller('b')
const sa = await call('POST', '/api/seller/store', { token: a.token, body: { handle: `ha${stamp}`, name: 'Store A' } })
ok(sa.status === 201, `A creates a store (HTTP ${sa.status} ${sa.data?.error ?? ''})`)
const sb = await call('POST', '/api/seller/store', { token: b.token, body: { handle: `hb${stamp}`, name: 'Store B' } })
ok(sb.status === 201, 'B creates a store')
const p = await call('POST', '/api/seller/products', { token: a.token, body: { title: 'Hosted test pack', priceMinor: 300, currency: 'gbp' } })
const pid = p.data?.product?.id
ok(p.status === 201 && pid, 'A creates a product')
const file = new TextEncoder().encode(`desknoty hosted test ${stamp}\n`.repeat(1000))
const up = await call('PUT', `/api/seller/products/${pid}/file`, { token: a.token, body: file, headers: { 'Content-Type': 'application/zip', 'X-File-Name': 'pack.zip' } })
ok(up.status === 200 && up.data?.product?.file?.size === file.length, `A uploads the product file to private storage (HTTP ${up.status} ${up.data?.error ?? ''})`)
ok((await call('PATCH', `/api/seller/products/${pid}`, { token: b.token, body: { title: 'hijack' } })).status === 404, "B cannot edit A's product")
ok((await call('PUT', `/api/seller/products/${pid}/file`, { token: b.token, body: file, headers: { 'X-File-Name': 'x' } })).status === 404, "B cannot replace A's file")
ok((await call('DELETE', `/api/seller/products/${pid}`, { token: b.token })).status === 404, "B cannot delete A's product")
const bOrders = await call('GET', '/api/seller/orders', { token: b.token })
ok(bOrders.status === 200 && Array.isArray(bOrders.data?.orders) && bOrders.data.orders.length === 0, "B sees no orders but its own")
ok((await call('GET', '/api/store-download/forged.token')).status === 403, 'a forged download link is refused')
const big = await call('PUT', `/api/seller/products/${pid}/file`, { token: a.token, body: new Uint8Array(51 * 1024 * 1024), headers: { 'X-File-Name': 'big.bin' } })
ok(big.status >= 400, `a 51 MB file is refused (HTTP ${big.status})`)
console.log(failed ? `\n${failed} hosted check(s) FAILED` : '\nAll hosted checks passed.')
process.exit(failed ? 1 : 0)
