const TOKEN = 'desknoty.session'
export const SIGNOUT_PENDING = 'opennote.signout-pending'
const REVOKE_TOKEN = 'desknoty.session-to-revoke'
const GENERATION = 'desknoty.auth-generation'
let signedOut = false
let generation = 'initial'

/** Older browsers and some in-app webviews have no `crypto.randomUUID`. */
function newId(): string {
  try {
    const c = globalThis.crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {
    /* fall through */
  }
  return `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function authGeneration() {
  try { return localStorage.getItem(GENERATION) ?? generation } catch { return generation }
}
export function isSignedOut() {
  try { return signedOut || localStorage.getItem(SIGNOUT_PENDING) === '1' || sessionStorage.getItem(SIGNOUT_PENDING) === '1' } catch { return signedOut }
}
export function sessionToken() {
  if (isSignedOut()) return null
  try { return localStorage.getItem(TOKEN) } catch { return null }
}
export function beginSignOut() {
  const token = sessionToken()
  signedOut = true
  generation = newId()
  try { localStorage.setItem(GENERATION, generation); localStorage.setItem(SIGNOUT_PENDING, '1') } catch { /* memory guard remains */ }
  try {
    sessionStorage.setItem(SIGNOUT_PENDING, '1')
    if (token) sessionStorage.setItem(REVOKE_TOKEN, token)
  } catch { /* best effort retry across reloads */ }
  try { localStorage.removeItem(TOKEN) } catch { /* guard blocks reads */ }
  return token
}
export function tokenToRevoke() {
  try { return sessionStorage.getItem(REVOKE_TOKEN) } catch { return null }
}
export function confirmRevocation(expectedGeneration: string) {
  if (authGeneration() !== expectedGeneration) return
  try { sessionStorage.removeItem(REVOKE_TOKEN) } catch { /* harmless to retry */ }
  // Remain signed out until an explicit successful sign-in, including after refresh.
}
export function acceptSession(token: string | null, expectedGeneration: string, explicitSignIn = false) {
  if (authGeneration() !== expectedGeneration || (isSignedOut() && !explicitSignIn)) return false
  if (explicitSignIn) {
    signedOut = false
    generation = newId()
    try { localStorage.setItem(GENERATION, generation); localStorage.removeItem(SIGNOUT_PENDING); sessionStorage.removeItem(SIGNOUT_PENDING) } catch { /* memory guard cleared */ }
  }
  try { if (token) localStorage.setItem(TOKEN, token) } catch { /* storage unavailable */ }
  return true
}
