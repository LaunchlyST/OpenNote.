// Serves the built site as https://desknoty.com and talks to the real hosted API,
// with every cookie to/from the API removed (what Safari does to third-party cookies).
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const SITE = process.argv[2], API_HOST = 'mrcnonqrgrumxyvgpfqr.supabase.co'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' }
let fail = 0; const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++ }
;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } })
  let cookiesSeen = 0
  await ctx.route('https://desknoty.com/**', (route) => {
    let p = new URL(route.request().url()).pathname
    let f = path.join(SITE, p)
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(path.join(f, 'index.html')) ? path.join(f, 'index.html') : path.join(SITE, 'index.html')
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: types[path.extname(f)] ?? 'application/octet-stream' })
  })
  await ctx.route(`https://${API_HOST}/**`, async (route) => {
    const h = { ...route.request().headers() }; if (h.cookie) cookiesSeen++; delete h.cookie
    const res = await route.fetch({ headers: h })
    const rh = { ...res.headers() }; delete rh['set-cookie']
    await route.fulfill({ response: res, headers: rh })
  })
  const page = await ctx.newPage()
  await page.goto('https://desknoty.com/')
  await page.fill('input[placeholder="Invite code"]', 'Invite27')
  await page.keyboard.press('Enter')
  await page.waitForURL('**/landing', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(4000)
  ok(new URL(page.url()).pathname === '/landing', `invite code opens /landing without cookies (at ${new URL(page.url()).pathname})`)
  await page.reload(); await page.waitForTimeout(5000)
  ok(new URL(page.url()).pathname === '/landing', 'early access survives a reload')
  const email = `safari-${Date.now()}@example.com`
  const signup = await page.evaluate(async ([api, email]) => {
    const r = await fetch(`${api}/api/auth/sign-up/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password: 'Safari-test-pass-2026!', name: 'Safari Test' }) })
    return r.status
  }, [`https://${API_HOST}/functions/v1`, email])
  ok(signup === 200, `sign-up from desknoty.com (HTTP ${signup})`)
  await page.goto('https://desknoty.com/app'); await page.waitForTimeout(6000)
  const session = await page.evaluate(async (api) => (await (await fetch(`${api}/api/auth/get-session`, { credentials: 'include' })).json())?.user?.email ?? null, `https://${API_HOST}/functions/v1`)
  ok(session === email, 'signed in after reload, with no cookies')
  await page.screenshot({ path: path.join(path.dirname(SITE), 'safari-app.png') })
  console.log(`  info  ${cookiesSeen} cookie header(s) stripped before reaching the API`)
  await browser.close()
  console.log(fail ? `${fail} FAILED` : 'Safari-style checks passed.')
  process.exit(fail ? 1 : 0)
})()
