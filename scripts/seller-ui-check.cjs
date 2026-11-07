const { chromium } = require('playwright'); const fs = require('fs'), path = require('path')
const [SITE, TOKFILE, OUT] = process.argv.slice(2); const TOK = fs.readFileSync(TOKFILE, 'utf8').trim()
const API_HOST = 'mrcnonqrgrumxyvgpfqr.supabase.co'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } })
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: vp })
    await ctx.route('https://desknoty.com/**', (route) => {
      let f = path.join(SITE, new URL(route.request().url()).pathname)
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(path.join(f, 'index.html')) ? path.join(f, 'index.html') : path.join(SITE, 'index.html')
      route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: types[path.extname(f)] ?? 'application/octet-stream' })
    })
    await ctx.route(`https://${API_HOST}/**`, async (route) => { if (process.env.DBG) console.log('  api', route.request().method(), new URL(route.request().url()).pathname, route.request().headers()['authorization'] ? 'auth' : 'noauth'); const h = { ...route.request().headers() }; delete h.cookie; const r = await route.fetch({ headers: h }); const rh = { ...r.headers() }; delete rh['set-cookie']; await route.fulfill({ response: r, headers: rh }) })
    const page = await ctx.newPage()
    const errors = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('https://desknoty.com/store/desknoty-test-shop'); await page.waitForTimeout(5000)
    const storeText = await page.textContent('body')
    console.log(name, 'public store shows product:', storeText.includes('Real test planner'))
    await page.screenshot({ path: `${OUT}/${name}-store.png` })
    await page.reload(); await page.waitForTimeout(4000)
    console.log(name, 'store survives refresh:', (await page.textContent('body')).includes('Real test planner'))
    const href = '/store/desknoty-test-shop/p/prd_5de42e6eeb57e0a9640a'
    if (href) { await page.goto('https://desknoty.com' + new URL(href, 'https://desknoty.com').pathname); await page.waitForTimeout(4000); await page.reload(); await page.waitForTimeout(4000)
      const t = await page.textContent('body'); console.log(name, 'product page direct + refresh:', t.includes('Real test planner'), /£5/.test(t)); await page.screenshot({ path: `${OUT}/${name}-product.png` }) }
    else console.log(name, 'no product link found')
    await page.evaluate((t) => localStorage.setItem('desknoty.session', t), TOK)
    await page.goto('https://desknoty.com/app/pro?tool=seller'); await page.waitForTimeout(8000)
    if (!(await page.getByText('Seller', { exact: true }).first().isVisible().catch(() => false))) { await page.selectOption('select', 'seller').catch((e) => console.log('select failed', e.message)); await page.waitForTimeout(6000) }
    if (name === 'desktop') await page.getByText('Seller', { exact: true }).first().click().catch((e) => console.log(name, 'no Seller nav:', e.message.split('\n')[0]))
    await page.waitForTimeout(6000)
    const cont = page.getByText('Continue without TikTok'); if (await cont.count()) { await cont.first().click(); await page.waitForTimeout(5000) }
    const t = await page.textContent('body')
    console.log(name, 'overflow-x:', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
    console.log(name, 'seller studio:', t.includes('desknoty-test-shop'), t.includes('Real test planner'), '| url', new URL(page.url()).pathname)
    await page.screenshot({ path: `${OUT}/${name}-studio.png` })
    console.log(name, 'page errors:', errors.slice(0, 3))
    await ctx.close()
  }
  await browser.close()
})()
