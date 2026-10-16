import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth browser client. Requests go to `/api/auth/*` on the same origin
 * (Vite proxies them to the API server in development), so the session cookie
 * is first-party and httpOnly — JavaScript never sees the token.
 */
export const authClient = createAuthClient({
  baseURL: (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost',
})
