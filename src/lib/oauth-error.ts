/**
 * Human-readable messages for failed Google sign-in attempts.
 *
 * When an OAuth round trip fails, Better Auth sends the browser back to
 * `errorCallbackURL` with `?error=<code>` (and sometimes Google's own
 * `error_description`). Landing there with no explanation is the worst outcome:
 * the user has just been bounced through Google and sees a normal login form
 * as if nothing happened. This turns those codes into something actionable.
 *
 * Kept separate and pure so it can be tested without a browser or a network
 * round trip.
 */

/** Codes Better Auth raises from the OAuth callback. */
const BETTER_AUTH_CODES: Record<string, string> = {
  no_code: 'Google did not send an authorisation code back. Please try again.',
  oauth_provider_not_found:
    'Google sign-in is not configured on this server. Please use your email for now.',
  issuer_missing: 'Google did not identify your account. Please try again.',
  issuer_mismatch: 'That account is not from Google. Please try again.',
  invalid_code:
    'Google sign-in expired before it finished. Please try again — it only takes a moment.',
  nonce_binding_missing:
    'Google sign-in could not be verified for security reasons. Please try again.',
  unable_to_get_user_info:
    'Google signed you in but we could not read your profile. Please try again.',
  no_callback_url:
    'Google sign-in could not find a return address. Please contact support.',
  unable_to_link_account:
    'That Google account is linked to a different OpenNote account.',
  email_does_not_match:
    'The email address from Google does not match an existing OpenNote account. Sign in with your email and password instead.',
  account_already_linked_to_different_user:
    'That Google account is already linked to a different OpenNote account.',
  email_not_found:
    'Google did not share an email address. This happens with some private or organisational accounts — please use your email and password instead.',
  account_not_linked:
    'An OpenNote account with this email already exists but its email is not verified yet. Sign in with your email and password, verify your email, then you can use Google too.',
  'account not linked':
    'An OpenNote account with this email already exists but its email is not verified yet. Sign in with your email and password, verify your email, then you can use Google too.',
  state_mismatch: 'Google sign-in could not be verified (security check failed). Please try again.',
  please_restart_the_process: 'Google sign-in expired. Please try again.',
  email_not_verified:
    'Google has not verified this email address yet. Please use your email and password for now.',
}

/** Codes Google itself returns, which Better Auth passes straight through. */
const GOOGLE_CODES: Record<string, string> = {
  access_denied:
    'Google sign-in was cancelled. You have not been signed in.',
  redirect_uri_mismatch:
    'Google sign-in is misconfigured: this app’s sign-in address does not match the one registered with Google. Please contact support.',
  invalid_client:
    'Google rejected this app’s credentials. The client ID or client secret is wrong — please contact support.',
  unauthorized_client:
    'Google has not authorised this app for sign-in. Please contact support.',
  invalid_request:
    'Google rejected the sign-in request. Please try again.',
  server_error: 'Google had a problem signing you in. Please try again in a moment.',
  temporarily_unavailable:
    'Google is temporarily unavailable. Please try again in a moment.',
}

const UNKNOWN =
  'Google sign-in did not complete. Please try again, or use your email and password.'

/**
 * Turns an OAuth failure into a message worth showing.
 *
 * @param code        the `error` query parameter, e.g. `access_denied`
 * @param description Google's `error_description`, used only to recognise
 *                    codes this module has not been taught about yet
 */
export function describeOAuthError(
  code: string | null | undefined,
  description?: string | null,
): string {
  if (!code) return UNKNOWN

  const key = code.trim().toLowerCase()
  const known = BETTER_AUTH_CODES[key] ?? GOOGLE_CODES[key]
  if (known) return known

  // Google sometimes word-codes an unrecognised failure, e.g. a redirect URI
  // that is registered to the wrong project. Recognise those before giving up.
  const text = `${key} ${description ?? ''}`.toLowerCase()
  if (text.includes('redirect_uri_mismatch') || text.includes('redirect uri mismatch')) {
    return GOOGLE_CODES.redirect_uri_mismatch
  }
  if (text.includes('invalid_client') || text.includes('client secret')) {
    return GOOGLE_CODES.invalid_client
  }
  if (text.includes('access_denied') || text.includes('denied')) {
    return GOOGLE_CODES.access_denied
  }

  return UNKNOWN
}

/**
 * Reads an OAuth failure out of the current URL.
 *
 * Returns null when there is nothing to report, and strips the parameters it
 * consumed so a refresh does not show the same error again.
 */
export function takeOAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const code = params.get('error')
  const description = params.get('error_description')
  if (!code && !description) return null

  // Clear them before returning so the message appears exactly once.
  params.delete('error')
  params.delete('error_description')
  const query = params.toString()
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
  window.history.replaceState(null, '', next)

  return describeOAuthError(code, description)
}
