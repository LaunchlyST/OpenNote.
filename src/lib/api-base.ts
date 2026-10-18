/**
 * Where the OpenNote API lives.
 *
 * By default the frontend talks to `/api` on the same origin it was served
 * from (Vite proxies it in development, and `npm run serve` does the same in
 * production). When the frontend and the API are hosted on different origins
 * (for example a static site on GitHub Pages plus a separately hosted Node
 * backend), set `VITE_API_BASE_URL` at build time to the backend origin, e.g.
 * `https://api.desknoty.com`. Leave it empty for the normal single-host setup.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`
  return `${API_BASE}${path}`
}
