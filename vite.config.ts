import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Daytona exposes the sandbox through a reverse proxy at
// {port}-{sandboxId}.proxy.<domain>. Traffic arrives from outside the
// container, so the dev server must listen on 0.0.0.0 â€” binding to the
// default `localhost` makes the proxy fail with "proxy upstream error".
const PORT = Number(process.env.PORT ?? 5173)

// The Better Auth + workspace API runs as a separate Node server (server/).
// Proxying keeps it same-origin, so the httpOnly session cookie is first-party.
const API_TARGET = `http://localhost:${process.env.API_PORT ?? 3001}`
const proxy = { '/api': { target: API_TARGET, changeOrigin: false, xfwd: true } }

// Inside a Daytona sandbox the proxy terminates TLS, so the browser talks
// to the server over wss:// on 443. When not sandboxed (plain local dev) we
// leave Vite's defaults alone so HMR keeps working over ws://localhost.
const isDaytona = Boolean(
  process.env.DAYTONA_SITE_URL ??
    process.env.DAYTONA_API_URL ??
    process.env.DAYTONA_WORKSPACE_ID ??
    process.env.DAYTONA_SANDBOX_ID,
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 0.0.0.0 â€” required so the Daytona proxy can reach the dev server.
    host: true,
    port: PORT,
    // Fail loudly instead of silently moving to 5174, which the proxy
    // does not know how to route to.
    strictPort: true,
    // Accept the proxy's Host header. Without this Vite answers 403
    // "Blocked request" for the *.proxy.* domain.
    allowedHosts: true,
    watch: {
      // inotify is unreliable in sandboxed containers; poll instead so
      // hot reload actually fires.
      usePolling: true,
      interval: 300,
    },
    ...(isDaytona ? { hmr: { clientPort: 443, protocol: 'wss' } } : {}),
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
