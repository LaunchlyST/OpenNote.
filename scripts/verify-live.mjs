// Proves that https://desknoty.com is serving the build in dist/, not an older
// one from a CDN or browser cache.
//
//   npm run build && npm run verify:live
//
// Compares the build id in dist/version.json with the live /version.json, and
// the asset filenames in dist/index.html with the live HTML. Every request is
// cache-busted, because GitHub Pages caches everything for ten minutes.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const site = (process.env.LIVE_URL ?? 'https://desknoty.com').replace(/\/+$/, '')
const dist = process.argv[2] ?? 'dist'
const attempts = Number(process.env.VERIFY_ATTEMPTS ?? 1)
const waitMs = Number(process.env.VERIFY_WAIT_MS ?? 10000)

const versionFile = join(dist, 'version.json')
const indexFile = join(dist, 'index.html')
if (!existsSync(versionFile) || !existsSync(indexFile)) {
  console.error(`FAIL  ${dist}/version.json or ${dist}/index.html missing — run "npm run build" first`)
  process.exit(1)
}

const localBuild = JSON.parse(readFileSync(versionFile, 'utf8')).build
const assets = (html) => [...html.matchAll(/\/assets\/[A-Za-z0-9_.\-]+\.(?:js|css)/g)].map((m) => m[0]).sort()
const want = assets(readFileSync(indexFile, 'utf8'))
if (!localBuild || want.length === 0) {
  console.error('FAIL  dist/ has no build id or no hashed assets')
  process.exit(1)
}

const get = async (path) => {
  const res = await fetch(`${site}${path}${path.includes('?') ? '&' : '?'}__=${Date.now()}`, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return res.text()
}

for (let i = 1; i <= attempts; i++) {
  let liveBuild = null
  let liveAssets = []
  try {
    liveBuild = JSON.parse(await get('/version.json')).build ?? null
    liveAssets = assets(await get('/'))
  } catch (e) {
    console.log(`attempt ${i}/${attempts}: ${e instanceof Error ? e.message : e}`)
  }

  const sameBuild = liveBuild === localBuild
  const missing = want.filter((a) => !liveAssets.includes(a))
  if (sameBuild && missing.length === 0) {
    console.log(`PASS  ${site} serves build ${localBuild}`)
    console.log(`      ${want.length} hashed assets match dist/index.html`)
    process.exit(0)
  }
  console.log(
    `attempt ${i}/${attempts}: live build ${liveBuild ?? 'unknown'}, expected ${localBuild}` +
      (missing.length ? `; missing assets: ${missing.join(', ')}` : ''),
  )
  if (i < attempts) await new Promise((r) => setTimeout(r, waitMs))
}

console.error(`FAIL  ${site} is not serving build ${localBuild} yet`)
process.exit(1)
