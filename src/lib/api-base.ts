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

/**
 * Cross-site API (e.g. desknoty.com → <project>.supabase.co): browsers such as
 * Safari block the API's session cookie there as third-party. So when an API
 * base is set, the session travels as a bearer token instead: Better Auth's
 * bearer plugin returns it in the `set-auth-token` header on sign-in, it is
 * kept in this browser's storage, and sent with every request to the API.
 */
const TOKEN_KEY = 'desknoty.session'
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function writeToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: session lasts for this page only */
  }
}
if (API_BASE && typeof window !== 'undefined' && typeof window.fetch === 'function' && !(window as { __apiAuth?: boolean }).__apiAuth) {
  ;(window as { __apiAuth?: boolean }).__apiAuth = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(API_BASE)) return original(input, init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    const token = readToken()
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    const res = await original(input, { ...init, headers })
    const fresh = res.headers.get('set-auth-token')
    if (fresh) writeToken(fresh)
    if (url.includes('/api/auth/sign-out')) writeToken(null)
    return res
  }
}
