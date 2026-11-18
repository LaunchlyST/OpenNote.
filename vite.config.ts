import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const PORT = Number(process.env.PORT ?? 5173)

// A short id for this exact build. On CI it is the commit SHA, so the live
// site can prove which commit it is serving. Locally it falls back to a
// timestamp. index.html and /version.json both carry it (see below).
const BUILD_ID = (
  process.env.BUILD_ID ??
  process.env.GITHUB_SHA ??
  new Date().toISOString().replace(/[-:TZ.]/g, '')
)
  .trim()
  .slice(0, 12)

// GitHub Pages always answers with `Cache-Control: max-age=600` and lets you
// set no headers of your own, so an open tab (or a plain refresh) can keep
// running a build from up to ten minutes ago. This plugin writes dist/version.json
// and stamps the same id into index.html; the inline check in index.html then
// loads the fresh build on its own instead of making people clear the cache.
function buildVersion(): Plugin {
  let outDir = 'dist'
  return {
    name: 'desknoty-build-version',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml(html) {
      return html.replaceAll('%DN_BUILD%', BUILD_ID)
    },
    closeBundle() {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(
        join(outDir, 'version.json'),
        `${JSON.stringify({ build: BUILD_ID, builtAt: new Date().toISOString() }, null, 2)}\n`,
      )
    },
  }
}

// GitHub Pages serves from the root of the repo (custom domain), so base is '/'.
// For project pages (user.github.io/repo), change to '/repo/'.
const BASE = process.env.BASE_PATH ?? '/'

// The Better Auth + workspace + deploy API runs as a separate Node server
// (server/). Proxying keeps it same-origin, so the httpOnly session cookie is
// first-party and the browser never sees a cross-origin request.
const API_TARGET = `http://localhost:${process.env.API_PORT ?? 3001}`
const proxy = { '/api': { target: API_TARGET, changeOrigin: false, xfwd: true } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), buildVersion()],
  base: BASE,
  server: {
    // 0.0.0.0 so the dev server is reachable from anything forwarding traffic
    // to this machine, not just localhost.
    host: true,
    port: PORT,
    // Fail loudly instead of silently moving to 5174.
    strictPort: true,
    watch: {
      // inotify is unreliable in some containers and on network filesystems;
      // poll instead so hot reload actually fires.
      usePolling: true,
      interval: 300,
    },
    proxy,
  },
  // `vite preview` serves the dist/ build; keep it reachable too.
  preview: {
    host: true,
    port: PORT,
    strictPort: true,
    proxy,
  },
})
