/**
 * Checks that failed Google sign-in attempts produce a message worth showing.
 *
 *   npm run test:oauth
 *
 * Pure and offline: it imports the mapper and asserts every code the app can
 * realistically be redirected back with.
 */
import { describeOAuthError } from '../src/lib/oauth-error.ts'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n  A cancelled sign-in says so')
check(
  'access_denied is reported as cancelled',
  describeOAuthError('access_denied').includes('cancelled'),
  describeOAuthError('access_denied'),
)
check(
  'access_denied does not say you are signed in',
  !/you are signed in/i.test(describeOAuthError('access_denied')),
)

console.log('\n  Misconfiguration is called out specifically')
for (const [code, hint] of [
  ['redirect_uri_mismatch', 'registered with Google'],
  ['invalid_client', 'client ID or client secret'],
  ['oauth_provider_not_found', 'not configured'],
] as const) {
  const message = describeOAuthError(code)
  check(`${code} is explained`, message.includes(hint), message)
}

console.log('\n  Expiry and verification problems are distinct')
check('invalid_code mentions retrying', describeOAuthError('invalid_code').includes('try again'))
check('email_not_verified mentions email and password', describeOAuthError('email_not_verified').includes('email and password'))
check('email_not_found explains private accounts', describeOAuthError('email_not_found').includes('private'))

console.log('\n  Account-linking conflicts point at the right fix')
check(
  'email_does_not_match suggests email and password',
  describeOAuthError('email_does_not_match').includes('email and password'),
  describeOAuthError('email_does_not_match'),
)
check(
  'account_already_linked explains the clash',
  describeOAuthError('account_already_linked_to_different_user').includes('already linked'),
)

console.log('\n  Unknown codes degrade gracefully')
check('an unknown code still returns a message', describeOAuthError('something_new').length > 20)
check('no code at all still returns a message', describeOAuthError(null).length > 20)
check(
  'an unrecognised code is described in the text',
  describeOAuthError('weird', 'redirect_uri_mismatch for this app').includes('registered with Google'),
  describeOAuthError('weird', 'redirect_uri_mismatch for this app'),
)
check(
  'Google wording is matched even under an odd code',
  describeOAuthError('oauth_error', 'Access denied by the user').includes('cancelled'),
  describeOAuthError('oauth_error', 'Access denied by the user'),
)

console.log('\n  No code leaks a raw internal name')
const allCodes = [
  'no_code', 'oauth_provider_not_found', 'issuer_missing', 'issuer_mismatch', 'invalid_code',
  'nonce_binding_missing', 'unable_to_get_user_info', 'no_callback_url', 'unable_to_link_account',
  'email_does_not_match', 'account_already_linked_to_different_user', 'email_not_found',
  'email_not_verified', 'access_denied', 'redirect_uri_mismatch', 'invalid_client',
  'unauthorized_client', 'invalid_request', 'server_error', 'temporarily_unavailable',
]
for (const code of allCodes) {
  const message = describeOAuthError(code)
  check(
    `"${code}" reads as a sentence`,
    message.length > 15 && /[.!]$/.test(message.trim()),
    message,
  )
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
