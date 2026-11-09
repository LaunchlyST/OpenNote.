import { createAuthClient } from 'better-auth/react'
import { API_BASE, readToken } from './api-base'

/**
 * Better Auth browser client. Requests go to `/api/auth/*` on the API origin.
 * In the normal single-host setup that is the same origin the page came from
 * (Vite proxies it in development, and `npm run serve` does the same in
 * production), so the session cookie stays first-party and httpOnly —
 * JavaScript never sees the token. When `VITE_API_BASE_URL` is set at build
 * time the client talks to that backend origin instead.
 */
export const authClient = createAuthClient({
  // A base URL with a path (Supabase: …/functions/v1) is taken as the full
  // auth URL, so name /api/auth explicitly when an API base is set.
  baseURL:
    (API_BASE && `${API_BASE}/api/auth`) ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    'http://localhost',
  // Cross-site API: the session travels as a bearer token (see api-base.ts),
  // because Safari drops the API's cookie on desknoty.com.
  ...(API_BASE
    ? {
        fetchOptions: {
          auth: { type: 'Bearer' as const, token: () => readToken() ?? '' },

        },
      }
    : {}),
})
