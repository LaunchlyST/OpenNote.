import { createAuthClient } from 'better-auth/react'
import { API_BASE } from './api-base'

/**
 * Better Auth browser client. Requests go to `/api/auth/*` on the API origin.
 * In the normal single-host setup that is the same origin the page came from
 * (Vite proxies it in development, and `npm run serve` does the same in
 * production), so the session cookie stays first-party and httpOnly —
 * JavaScript never sees the token. When `VITE_API_BASE_URL` is set at build
 * time the client talks to that backend origin instead.
 */
export const authClient = createAuthClient({
  baseURL:
    API_BASE ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    'http://localhost',
})
