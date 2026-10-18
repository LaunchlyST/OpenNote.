import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const PORT = Number(process.env.PORT ?? 5173)

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
  plugins: [react(), tailwindcss()],
  base: BASE,
  server: {
    // 0.0.0.0 so the dev server is reachable from anything forwarding traffic
    // to this machine, not just localhost.
    host: true,
    port: PORT,
    // Fail loudly instead of silently moving to 5174.
    strictPort: true,
    // Accept forwarded Host headers, or Vite answers 403 "Blocked request"
    // when reached through a proxy or tunnel.
    allowedHosts: true,
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
    allowedHosts: true,
    proxy,
  },
})
