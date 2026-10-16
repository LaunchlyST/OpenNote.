/**
 * Admin authentication for the deployment endpoints.
 *
 * OpenNote's own sign-up lives entirely in the browser (see `src/auth.tsx`),
 * so there is no server-side account store to check a role against. The
 * deployment controls are therefore guarded by a passphrase held only in the
 * server environment, plus an optional allowlist of account emails. Both are
 * compared here, on the server; the browser is never trusted to decide who is
 * an administrator.
 *
 * A successful check mints an HMAC-signed, HttpOnly session cookie. The
 * browser cannot read or forge it, and the signing secret never leaves the
 * server.
 */
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import {
  isSecureRequest,
  setCookie,
  type ApiRequest,
  type ApiResponse,
} from './http'

const COOKIE_NAME = 'opennote_deploy_session'
const SESSION_TTL_SECONDS = 60 * 60 * 8

/** Naive per-instance throttle so the passphrase cannot be brute forced. */
const MAX_ATTEMPTS = 10
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const attempts = new Map<string, { count: number; first: number }>()

function env(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : null
}

/** Length-constant comparison, so a wrong guess cannot be timed. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) {
    // Still burn a comparison so the failure path is not obviously shorter.
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

function clientKey(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return (raw ? raw.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown'
}

export function isThrottled(req: ApiRequest): boolean {
  const key = clientKey(req)
  const entry = attempts.get(key)
  if (!entry) return false
  if (Date.now() - entry.first > ATTEMPT_WINDOW_MS) {
    attempts.delete(key)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

export function recordFailure(req: ApiRequest): void {
  const key = clientKey(req)
  const entry = attempts.get(key)
  if (!entry || Date.now() - entry.first > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() })
    return
  }
  entry.count += 1
}

export function clearFailures(req: ApiRequest): void {
  attempts.delete(clientKey(req))
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function allowedEmails(): string[] | null {
  const raw = env('DEPLOY_ADMIN_EMAILS')
  if (!raw) return null
  const list = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return list.length > 0 ? list : null
}

/**
 * Verifies the submitted passphrase and, when configured, the account email.
 * Returns null on success or a short reason on failure.
 */
export function verifyCredentials(
  passphrase: unknown,
  email: unknown,
): string | null {
  const secret = env('SESSION_SECRET')
  const expected = env('DEPLOY_ADMIN_PASSWORD')
  if (!secret || !expected) {
    return 'Deployment controls are not configured on the server yet.'
  }

  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    return 'Enter the administrator passphrase.'
  }
  if (!safeEqual(passphrase, expected)) {
    return 'That passphrase is not correct.'
  }

  const allowlist = allowedEmails()
  if (allowlist) {
    const mail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!allowlist.includes(mail)) {
      return 'This account is not on the deployment administrator list.'
    }
  }

  return null
}

export function issueSessionCookie(req: ApiRequest, res: ApiResponse): void {
  const secret = env('SESSION_SECRET') ?? ''
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000
  const nonce = randomBytes(12).toString('hex')
  const payload = `${expires}.${nonce}`
  const value = `${payload}.${signature(payload, secret)}`

  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
  if (isSecureRequest(req)) attrs.push('Secure')

  setCookie(res, attrs.join('; '))
}

export function clearSessionCookie(req: ApiRequest, res: ApiResponse): void {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ]
  if (isSecureRequest(req)) attrs.push('Secure')
  setCookie(res, attrs.join('; '))
}

/** True when the request carries a valid, unexpired admin session cookie. */
export function hasValidSession(req: ApiRequest): boolean {
  const secret = env('SESSION_SECRET')
  if (!secret) return false

  const header = req.headers.cookie
  if (!header) return false

  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
  if (!match) return false

  const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1))
  const parts = value.split('.')
  if (parts.length !== 3) return false

  const [expires, nonce, provided] = parts
  if (!Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return false

  const expected = signature(`${expires}.${nonce}`, secret)
  if (expected.length !== provided.length) return false
  return safeEqual(expected, provided)
}

/** True when the browser is allowed to see deployment controls at all. */
export function authConfigured(): boolean {
  return Boolean(env('DEPLOY_ADMIN_PASSWORD') && env('SESSION_SECRET'))
}