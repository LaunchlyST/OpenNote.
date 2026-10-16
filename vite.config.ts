import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Dev-server settings.
 *
 * The server binds to 0.0.0.0 so it is reachable from anything forwarding
 * traffic to this machine (containers, tunnels, `vite preview` behind a proxy),
 * not just localhost.
 */
const PORT = Number(process.env.PORT ?? 5173)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: PORT,
    // Fail loudly instead of silently moving to 5174, which a reverse proxy in
    // front of this server would not know how to route to.
    strictPort: true,
    // Accept forwarded Host headers. Without this Vite answers 403
    // "Blocked request" when reached through a proxy or tunnel.
    allowedHosts: true,
    watch: {
      // inotify is unreliable in some containers and on network filesystems;
      // poll instead so hot reload actually fires.
      usePolling: true,
      interval: 300,
    },
  },
  // `vite preview` serves the dist/ build; keep it reachable too.
  preview: {
    host: true,
    port: PORT,
    strictPort: true,
    allowedHosts: true,
  },
})