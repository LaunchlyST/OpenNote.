// After `vite build` for GitHub Pages: make every app route load the app
// directly, without the old 404 → /?route= redirect.
//
// - dist/404.html becomes a copy of the app (unknown paths still render the
//   right page client-side; GitHub Pages sends it with HTTP 404).
// - Fixed app routes and every published store/product page get their own
//   index.html, so they answer HTTP 200 (link previews, search engines,
//   in-app browsers). Store pages come from the API's public directory;
//   if the API is unreachable the build still succeeds with the 404 fallback.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const dist = process.argv[2] ?? 'dist'
const index = join(dist, 'index.html')
if (!existsSync(index)) throw new Error(`${index} not found; run the build first`)
const place = (route) => {
  const target = join(dist, route.replace(/^\/+/, ''), 'index.html')
  if (existsSync(target)) return
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(index, target)
}
copyFileSync(index, join(dist, '404.html'))
const fixed = ['/app', '/app/signin', '/app/signup', '/app/account', '/app/free', '/app/pro', '/signin', '/signup', '/account']
for (const r of fixed) place(r)
let pages = 0
const api = (process.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
if (api) {
  try {
    const r = await fetch(`${api}/api/store-directory`, { signal: AbortSignal.timeout(20000) })
    const { stores } = await r.json()
    for (const s of stores ?? []) {
      if (!/^[a-z0-9-]{2,40}$/.test(s.handle)) continue
      place(`/store/${s.handle}`)
      place(`/store/${s.handle}/thanks`)
      pages += 2
      for (const id of s.products ?? []) if (/^prd_[a-f0-9]+$/.test(id)) (place(`/store/${s.handle}/p/${id}`), pages++)
    }
  } catch (e) {
    console.warn(`[spa-routes] store directory unavailable (${e instanceof Error ? e.message : e}); store links use the 404 fallback`)
  }
}
console.log(`[spa-routes] 404.html is the app; ${fixed.length} app routes and ${pages} store pages pre-rendered`)
