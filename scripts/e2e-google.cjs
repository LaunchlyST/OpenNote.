/**
 * Clicks the real "Continue with Google" button and checks where the browser
 * goes. Google itself is not contacted: the request to accounts.google.com is
 * intercepted and inspected. Needs the server started with GOOGLE_CLIENT_ID /
 * GOOGLE_CLIENT_SECRET set (any values for this test).
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const B = process.env.E2E_BASE || 'http://localhost:5173'
let failed = 0
const check = (msg, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) failed++
}
;(async () => {
  const b = await chromium.launch()
  for (const page of ['/app/signin', '/app/signup']) {
    const p = await (await b.newContext()).newPage()
    let googleUrl = null
    await p.route('https://accounts.google.com/**', (r) => {
      googleUrl = new URL(r.request().url())
      r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Google (stand-in)</h1>' })
    })
    await p.goto(B + page, { waitUntil: 'networkidle' })
    const btn = p.getByRole('button', { name: 'Continue with Google' })
    check(`${page}: Continue with Google is shown and enabled`, (await btn.count()) === 1 && (await btn.isEnabled()))
    await btn.click()
    await p.waitForURL(/accounts\.google\.com/, { timeout: 10000 }).catch(() => {})
    check(`${page}: the browser goes to Google’s own sign-in page`, googleUrl?.origin === 'https://accounts.google.com')
    check(`${page}: Google’s account chooser is requested`, googleUrl?.searchParams.get('prompt') === 'select_account')
    check(`${page}: returns to OpenNote’s callback`, (googleUrl?.searchParams.get('redirect_uri') || '').endsWith('/api/auth/callback/google'))
  }
  // Cancelled on Google → back on sign-in with a clear message.
  const p = await (await b.newContext()).newPage()
  await p.goto(B + '/app/signin?error=access_denied', { waitUntil: 'networkidle' })
  check('a cancelled Google sign-in shows a clear message', (await p.getByRole('alert').innerText().catch(() => '')).length > 10)
  await b.close()
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll Google browser checks passed.')
  process.exit(failed ? 1 : 0)
})()
